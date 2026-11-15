"""The only way the worker talks to a model.

- Model names come from env (FINN_MODEL_CHEAP, FINN_MODEL_STRONG, FINN_EMBED_MODEL). Each may be a
  comma-separated fallback chain: overloaded (503) or rate-limited (429) models fall through to the next.
- Every output is structured: Pydantic schema sent as the response JSON schema, validated on return,
  rejected and retried at most twice (guardrail 9).
- Cached in llm_cache by hash(model chain + prompt version + input) (guardrail 10 + efficiency).
- Every call, hit or miss, is logged to llm_calls with tokens, cost and latency.
- Document text is untrusted: prompts wrap it in <document> tags and models get no tools (guardrail 7).

We call Gemini's REST API directly rather than through LiteLLM: one provider, two endpoints, and it keeps
the worker's dependencies small. Swapping providers means replacing `_generate` and `_embed` only.
"""
from __future__ import annotations

import hashlib
import json
import logging
import re
import time
from pathlib import Path
from typing import Any, TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from .. import config

log = logging.getLogger(__name__)
T = TypeVar("T", bound=BaseModel)

PROMPTS = config.WORKER_ROOT / "prompts"
API = "https://generativelanguage.googleapis.com/v1beta"

DEFAULT_CHAINS = {
    "cheap": "gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-3.5-flash",
    "strong": "gemini-3.6-flash,gemini-3.5-flash,gemini-3.8-flash,gemini-3.5-flash-lite",
    "embed": "gemini-embedding-001",
}
EMBED_DIMS = 768

# USD per million tokens (input, output). Free tier costs nothing; these are list prices so the writeup
# can report what the same run would cost on a paid plan. Override with FINN_PRICES='{"model": [in, out]}'.
PRICES: dict[str, tuple[float, float]] = {
    "flash-lite": (0.10, 0.40),
    "flash": (0.30, 2.50),
    "pro": (1.25, 10.0),
    "embedding": (0.15, 0.0),
}


class LlmError(RuntimeError):
    pass


def chain(tier: str) -> list[str]:
    raw = config.env({"cheap": "FINN_MODEL_CHEAP", "strong": "FINN_MODEL_STRONG", "embed": "FINN_EMBED_MODEL"}[tier]) \
        or DEFAULT_CHAINS[tier]
    return [m.strip().removeprefix("gemini/") for m in raw.split(",") if m.strip()]


def price_for(model: str) -> tuple[float, float]:
    override = config.env("FINN_PRICES")
    if override:
        table = json.loads(override)
        if model in table:
            return tuple(table[model])  # type: ignore[return-value]
    for key in ("flash-lite", "embedding", "pro", "flash"):
        if key in model:
            return PRICES[key]
    return (0.0, 0.0)


def load_prompt(name: str) -> tuple[str, str]:
    """Return (version, text) for the highest prompts/<name>_vN.md."""
    files = sorted(PROMPTS.glob(f"{name}_v*.md"), key=lambda p: int(re.search(r"_v(\d+)\.md$", p.name).group(1)))
    if not files:
        raise LlmError(f"No prompt file for {name}")
    f = files[-1]
    return f.stem, f.read_text(encoding="utf-8")


def render(template: str, **values: str) -> str:
    out = template
    for k, v in values.items():
        out = out.replace("{{" + k + "}}", v)
    return out


def _clean_schema(schema: dict) -> dict:
    """Inline $defs and drop keys Gemini's JSON-schema mode rejects."""
    defs = schema.get("$defs", {})

    def walk(node: Any) -> Any:
        if isinstance(node, dict):
            if "$ref" in node:
                return walk(defs[node["$ref"].split("/")[-1]])
            return {k: walk(v) for k, v in node.items() if k not in ("$defs", "title", "default")}
        if isinstance(node, list):
            return [walk(x) for x in node]
        return node

    return walk(schema)


class Gateway:
    def __init__(self, db: Any | None = None) -> None:
        key = config.env("GEMINI_API_KEY") or config.env("GOOGLE_API_KEY")
        if not key:
            raise LlmError("GEMINI_API_KEY is not set")
        self._http = httpx.Client(base_url=API, headers={"x-goog-api-key": key}, timeout=120)
        self._db = db
        # Reserve per-model request slots under a lock. The network call itself stays
        # outside the lock, allowing bounded concurrent requests without throttle races.
        import threading
        self._throttle_lock = threading.Lock()
        self._next_call_at: dict[str, float] = {}
        # 0.5s spaces requests to the same model (~2 req/s); override for provider quotas.
        self.min_interval = float(config.env("FINN_LLM_MIN_INTERVAL", "1.0") or 1.0)

    # -- logging and cache ---------------------------------------------------------------------------

    def _log(self, **row: Any) -> None:
        if self._db is None:
            return
        try:
            self._db.insert("llm_calls", row)
        except Exception as exc:  # logging must never break a pipeline
            log.warning("llm_calls insert failed: %s", exc)

    def _cache_get(self, key: str) -> Any | None:
        if self._db is None:
            return None
        rows = self._db.select("llm_cache", {"select": "response", "key": f"eq.{key}"})
        return rows[0]["response"] if rows else None

    def _cache_put(self, key: str, response: Any) -> None:
        if self._db is not None:
            self._db.upsert("llm_cache", [{"key": key, "response": response}], on_conflict="key")

    # -- raw calls -----------------------------------------------------------------------------------

    def _throttle(self, model: str) -> None:
        # Atomically reserve a future slot. Sleeping and HTTP I/O happen without
        # holding the lock, so other worker threads can reserve their own slots.
        with self._throttle_lock:
            now = time.monotonic()
            slot = max(now, self._next_call_at.get(model, now))
            self._next_call_at[model] = slot + self.min_interval
        wait = slot - time.monotonic()
        if wait > 0:
            time.sleep(wait)

    def _generate(self, model: str, system: str, user: str, schema: dict | None, temperature: float,
                  thinking: int | None = None) -> dict:
        body: dict[str, Any] = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {"temperature": temperature, "responseMimeType": "application/json"},
        }
        if thinking is not None:  # cap thinking tokens: latency matters more than depth for card text
            body["generationConfig"]["thinkingConfig"] = {"thinkingBudget": thinking}
        if schema is not None:
            body["generationConfig"]["responseJsonSchema"] = schema
        self._throttle(model)
        r = self._http.post(f"/models/{model}:generateContent", json=body)
        if r.status_code >= 400:
            raise httpx.HTTPStatusError(r.text[:300], request=r.request, response=r)
        return r.json()

    def _with_fallback(self, tier: str, fn) -> tuple[str, Any]:
        # Strong models are often overloaded on the free tier: fail over quickly instead of waiting.
        attempts = 2 if tier == "strong" else 4
        last: Exception | None = None
        for model in chain(tier):
            for attempt in range(attempts):
                try:
                    return model, fn(model)
                except httpx.HTTPStatusError as exc:
                    code = exc.response.status_code
                    last = exc
                    if code in (429, 500, 503) and attempt < attempts - 1:
                        delay = 4 * 2**attempt
                        m = re.search(r'"retryDelay":\s*"(\d+)s"', exc.response.text)
                        if m and code == 429:
                            delay = min(int(m.group(1)) + 1, 60)
                        log.warning("%s on %s (attempt %d), retrying in %ss", code, model, attempt + 1, delay)
                        time.sleep(delay)
                        continue
                    log.warning("%s on %s, moving down the chain", code, model)
                    break
                except httpx.TransportError as exc:
                    last = exc
                    time.sleep(3)
        raise LlmError(f"All {tier} models failed: {last}")

    # -- public --------------------------------------------------------------------------------------

    def structured(self, *, step: str, tier: str, prompt: str, schema: type[T], values: dict[str, str],
                   temperature: float = 0.1, use_cache: bool = True) -> T:
        version, template = load_prompt(prompt)
        system, _, user_t = template.partition("\n---\n")
        user = render(user_t or template, **values)
        system = render(system, **values) if user_t else "You are a careful financial analyst. Output JSON only."
        js = _clean_schema(schema.model_json_schema())
        key = hashlib.sha256(json.dumps([tier, version, system, user, js], sort_keys=True).encode()).hexdigest()  # stable across fallback-chain edits

        if use_cache:
            hit = self._cache_get(key)
            if hit is not None:
                self._log(step=step, model=chain(tier)[0], prompt_version=version, tokens_in=0, tokens_out=0,
                          cost=0, cache_hit=True, latency_ms=0)
                return schema.model_validate(hit)

        errors = ""
        for attempt in range(3):  # first try + max 2 retries on schema failure
            started = time.monotonic()
            thinking = int(config.env("FINN_STRONG_THINKING", "1024")) if tier == "strong" else None
            model, resp = self._with_fallback(tier, lambda m: self._generate(m, system, user + errors, js, temperature, thinking))
            usage = resp.get("usageMetadata", {})
            tin = usage.get("promptTokenCount", 0)
            tout = usage.get("candidatesTokenCount", 0) + usage.get("thoughtsTokenCount", 0)
            pin, pout = price_for(model)
            self._log(step=step, model=model, prompt_version=version, tokens_in=tin, tokens_out=tout,
                      cost=round((tin * pin + tout * pout) / 1e6, 6), cache_hit=False,
                      latency_ms=int((time.monotonic() - started) * 1000))
            try:
                parts = resp["candidates"][0]["content"]["parts"]
                text = "".join(p.get("text", "") for p in parts if not p.get("thought"))
                data = json.loads(text)
                out = schema.model_validate(data)
            except (KeyError, IndexError, json.JSONDecodeError, ValidationError) as exc:
                log.warning("Schema failure on %s (attempt %d): %s", step, attempt + 1, str(exc)[:200])
                errors = f"\n\nYour previous answer was invalid ({str(exc)[:300]}). Return valid JSON matching the schema."
                continue
            if use_cache:
                self._cache_put(key, out.model_dump(mode="json"))
            return out
        raise LlmError(f"{step}: no valid structured output after 3 attempts")

    def embed(self, texts: list[str], task: str = "RETRIEVAL_DOCUMENT", step: str = "embed") -> list[list[float]]:
        out: list[list[float]] = []
        for i in range(0, len(texts), 100):
            batch = texts[i : i + 100]
            started = time.monotonic()

            def call(model: str, batch=batch) -> dict:
                self._throttle(model)
                r = self._http.post(f"/models/{model}:batchEmbedContents", json={"requests": [
                    {"model": f"models/{model}", "content": {"parts": [{"text": t[:8000]}]},
                     "taskType": task, "outputDimensionality": EMBED_DIMS} for t in batch]})
                if r.status_code >= 400:
                    raise httpx.HTTPStatusError(r.text[:300], request=r.request, response=r)
                return r.json()

            model, resp = self._with_fallback("embed", call)
            out += [e["values"] for e in resp["embeddings"]]
            approx = sum(len(t) for t in batch) // 4
            self._log(step=step, model=model, prompt_version=None, tokens_in=approx, tokens_out=0,
                      cost=round(approx * price_for(model)[0] / 1e6, 6), cache_hit=False,
                      latency_ms=int((time.monotonic() - started) * 1000))
        return out
