"""Pipeline C: research. Promised vs delivered, from primary sources only.

Steps (DESIGN.md 6.2 C):
  1. screener: quarterly numbers into facts (code), last N transcript links
  2. transcripts: text page by page, stored as documents + chunks (+ embeddings for the assistant)
  3. cheap model extracts commitments per transcript
  4. every quote verified on its cited page, numbers verified inside the quote; failures dropped
  5. cheap model links commitments across calls; silence computed in code
  6. numeric verdicts in code from facts; strong model judges only qualitative ones, citing evidence
  7. strong model writes card text and questions from computed results only
  8. progress written to jobs throughout; idempotent (rebuilds the company's promises each run)
"""
from __future__ import annotations

import hashlib
import json
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field

from ..db import Db
from ..llm.gateway import Gateway
from ..sources import screener
from ..sources.http import content_hash, get_cached
from ..sources.pdf import pages_text, with_page_markers
from ..verify.quotes import number_in_text, quote_on_page
from . import verdicts as V

log = logging.getLogger(__name__)
N_TRANSCRIPTS = 6

# ---- schemas -----------------------------------------------------------------------------------------

Category = Literal["revenue_growth", "revenue_absolute", "ebitda_margin", "ebit_margin", "profit_growth",
                   "capex", "volume", "other"]


class Commitment(BaseModel):
    topic: str = Field(description="3 to 7 words")
    category: Category
    quote: str
    page: int
    target_low: float | None = None
    target_high: float | None = None
    scope: Literal["company", "segment"] = "segment"
    currency_or_unit: str | None = None
    timeframe_fy: str | None = Field(default=None, description="e.g. FY27")


class Commitments(BaseModel):
    items: list[Commitment]


class Mention(BaseModel):
    id: str
    status: Literal["stated", "reiterated", "raised", "lowered"]


class Thread(BaseModel):
    key: str
    topic: str
    importance: int = Field(ge=1, le=3)
    mentions: list[Mention]


class Threads(BaseModel):
    threads: list[Thread]


class QualVerdict(BaseModel):
    key: str
    verdict: Literal["delivered", "partly", "missed", "too_early", "not_measurable"]
    reason: str


class QualVerdicts(BaseModel):
    verdicts: list[QualVerdict]


class Card(BaseModel):
    key: str
    headline: str
    body: str


class Cards(BaseModel):
    one_liner: str
    one_liner_page: int
    cards: list[Card]
    questions: list[str]


# ---- helpers -----------------------------------------------------------------------------------------


class Progress:
    def __init__(self, db: Db, job_id: str | None) -> None:
        self.db, self.job_id, self.items = db, job_id, []

    def __call__(self, msg: str, status: str | None = None) -> None:
        log.info("progress: %s", msg)
        self.items.append({"t": datetime.now(timezone.utc).isoformat(), "msg": msg})
        if self.job_id:
            vals: dict = {"progress": self.items}
            if status:
                vals["status"] = status
                if status in ("done", "failed"):
                    vals["finished_at"] = datetime.now(timezone.utc).isoformat()
            self.db.update("jobs", {"id": f"eq.{self.job_id}"}, vals)


def ensure_company(db: Db, page: screener.ScreenerPage) -> dict:
    rows = db.select("companies", {"select": "*", "nse_symbol": f"eq.{page.symbol}"})
    if rows:
        return rows[0]
    row = {"nse_symbol": page.symbol, "name": page.name, "yahoo_symbol": f"{page.symbol}.NS"}
    if page.bse_code and not db.select("companies", {"select": "id", "bse_code": f"eq.{page.bse_code}"}):
        row["bse_code"] = page.bse_code
    return db.insert("companies", row, returning=True)[0]


def pick_transcripts(page: screener.ScreenerPage, n: int = N_TRANSCRIPTS) -> list[tuple[str, str]]:
    """Latest n (period, url), one per period, returned oldest first."""
    seen: dict[str, str] = {}
    for c in page.concalls:
        if not c.transcript_url:
            continue
        p = screener.concall_period(c.month)
        if p not in seen:
            seen[p] = c.transcript_url
        if len(seen) >= n:
            break
    return sorted(seen.items(), key=lambda kv: screener.period_end(kv[0]))


def store_document(db: Db, gw: Gateway | None, company_id: int, period: str, url: str, pages: list[str],
                   data: bytes) -> int:
    existing = db.select("documents", {"select": "id,content_hash", "company_id": f"eq.{company_id}", "url": f"eq.{url}"})
    h = content_hash(data)
    if existing and existing[0]["content_hash"] == h:
        doc_id = existing[0]["id"]
        if db.select("chunks", {"select": "id", "document_id": f"eq.{doc_id}", "limit": "1"}):
            return doc_id
    else:
        if existing:
            db.delete("documents", {"id": f"eq.{existing[0]['id']}"})
        doc_id = db.insert("documents", {"company_id": company_id, "type": "transcript", "period": period, "url": url,
                                         "content_hash": h, "page_count": len(pages)}, returning=True)[0]["id"]
    texts = [p.strip() for p in pages]
    keep = [(i + 1, t) for i, t in enumerate(texts) if len(t) > 80]
    embeddings: list[list[float] | None] = [None] * len(keep)
    if gw is not None and keep:
        try:
            embeddings = gw.embed([t for _, t in keep], step="research.embed")  # type: ignore[assignment]
        except Exception as exc:
            log.warning("Embedding failed, storing text only (full-text search still works): %s", exc)
    rows = [{"document_id": doc_id, "page": pg, "text": t, "embedding": e} for (pg, t), e in zip(keep, embeddings)]
    for i in range(0, len(rows), 50):
        db.insert("chunks", rows[i : i + 50])
    return doc_id


# ---- the pipeline ------------------------------------------------------------------------------------


def run(symbol: str, job_id: str | None = None, force: bool = False) -> dict:
    db = Db()
    gw = Gateway(db)
    progress = Progress(db, job_id)
    progress(f"Looking up {symbol.upper()}", status="running")
    try:
        return _run(db, gw, progress, symbol, force)
    except Exception as exc:
        log.exception("research failed")
        progress(f"Research failed: {str(exc)[:160]}", status="failed")
        raise


def _run(db: Db, gw: Gateway, progress: Progress, symbol: str, force: bool) -> dict:
    page = screener.fetch(symbol)
    company = ensure_company(db, page)
    cid = company["id"]

    # 1. facts
    facts_rows = [{"company_id": cid, **f} for f in screener.quarterly_facts(page)]
    db.upsert("facts", facts_rows, on_conflict="company_id,period,metric,basis,extractor")
    facts = {(f["period"], f["metric"]): float(f["value"]) for f in facts_rows}
    n_quarters = len(page.quarters)
    progress(f"Read {n_quarters} quarters of results ({page.basis})")

    transcripts = pick_transcripts(page)
    doc_hash = hashlib.sha256(json.dumps(transcripts).encode()).hexdigest()[:16]
    prior = db.select("research", {"select": "status,doc_set_hash", "company_id": f"eq.{cid}"})
    if prior and prior[0]["doc_set_hash"] == doc_hash and prior[0]["status"] in ("ready", "no_guidance") and not force:
        progress("Already up to date with the latest transcripts", status="done")
        return {"company_id": cid, "cached": True}
    db.upsert("research", [{"company_id": cid, "status": "running", "updated_at": datetime.now(timezone.utc).isoformat()}],
              on_conflict="company_id")

    if not transcripts:
        db.upsert("research", [{"company_id": cid, "status": "no_guidance", "doc_set_hash": doc_hash, "transcripts": 0,
                                "results_filings": n_quarters, "scorecard": {"total": 0},
                                "updated_at": datetime.now(timezone.utc).isoformat()}], on_conflict="company_id")
        progress("No concall transcripts found", status="done")
        return {"company_id": cid, "transcripts": 0}

    periods = [p for p, _ in transcripts]

    # 2-4. read, extract, verify. Transcripts are independent, so read and extract
    # them a few at a time (httpx clients are thread-safe). Results are merged back
    # in transcript order afterwards so the m-ids and ordering stay deterministic.
    def _process(period: str, url: str) -> tuple[str, dict, list, int]:
        data = get_cached(url, kind="pdf")
        pages = pages_text(data)
        doc_id = store_document(db, gw, cid, period, url, pages, data)
        out = gw.structured(step="research.promises", tier="cheap", prompt="promises", schema=Commitments,
                            values={"company": page.name, "period": period, "transcript": with_page_markers(pages)})
        verified: list = []
        dropped_local = 0
        for c in out.items:
            ok, found = quote_on_page(c.quote, pages, c.page)
            nums_ok = all(number_in_text(v, c.quote) for v in (c.target_low, c.target_high) if v is not None)
            if not ok or not nums_ok:
                dropped_local += 1
                continue
            verified.append((c, found))
        return period, {"id": doc_id, "pages": pages, "url": url}, verified, dropped_local

    progress(f"Reading {len(transcripts)} transcripts")
    results: dict[str, tuple[dict, list, int]] = {}
    with ThreadPoolExecutor(max_workers=3) as ex:
        futs = [ex.submit(_process, p, u) for p, u in transcripts]
        for fut in as_completed(futs):
            period, docinfo, verified, dropped_local = fut.result()
            results[period] = (docinfo, verified, dropped_local)
            progress(f"{period}: {len(verified)} commitments verified, {dropped_local} dropped")

    # Merge in transcript order so ids are stable regardless of completion order.
    items: list[dict] = []
    docs: dict[str, dict] = {}
    dropped = 0
    for period, _ in transcripts:
        docinfo, verified, dropped_local = results[period]
        docs[period] = docinfo
        dropped += dropped_local
        for c, found in verified:
            items.append({"id": f"m{len(items) + 1}", "period": period, "doc_id": docinfo["id"], "page": found, **c.model_dump()})

    if not items:
        db.delete("promises", {"company_id": f"eq.{cid}"})
        db.upsert("research", [{"company_id": cid, "status": "no_guidance", "doc_set_hash": doc_hash,
                                "transcripts": len(transcripts), "results_filings": n_quarters, "scorecard": {"total": 0},
                                "snapshot": snapshot(page, facts, None),
                                "updated_at": datetime.now(timezone.utc).isoformat()}], on_conflict="company_id")
        progress(f"No explicit guidance found in the last {len(transcripts)} transcripts", status="done")
        return {"company_id": cid, "promises": 0}

    # 5. link across calls
    progress("Linking commitments across calls")
    by_id = {it["id"]: it for it in items}
    listing = "\n".join(f'{it["id"]} [{it["period"]}] ({it["category"]}, {it["timeframe_fy"] or "no year"}): "{it["quote"]}"'
                        for it in items)
    linked = gw.structured(step="research.link", tier="cheap", prompt="link", schema=Threads,
                           values={"company": page.name, "periods": ", ".join(periods), "items": listing})
    threads = _sanitise_threads(linked.threads, by_id)

    # 6. verdicts
    progress("Checking promises against reported numbers")
    computed: list[dict] = []
    qual: list[dict] = []
    for t in threads:
        ms = [by_id[m.id] | {"status": m.status} for m in t.mentions]
        ms.sort(key=lambda m: periods.index(m["period"]))
        latest = ms[-1]
        mention_periods = sorted({m["period"] for m in ms}, key=periods.index)
        cat, fy = latest["category"], latest["timeframe_fy"]
        low = latest["target_low"]
        high = latest["target_high"]
        rec = {"key": t.key, "topic": t.topic, "importance": t.importance, "category": cat, "mentions": ms,
               "timeframe": fy, "target_low": low, "target_high": high, "mention_periods": mention_periods,
               "silent": V.silent_periods(mention_periods, periods)}
        unit = (latest.get("currency_or_unit") or "").lower()
        if cat in ("ebitda_margin", "ebit_margin") and ("bps" in unit or "basis" in unit):
            cat = "margin_expansion_bps"   # "expand margins by 120 to 130 bps" is a change, not a level
        elif cat in ("ebitda_margin", "ebit_margin") and low is not None and low > 60:
            cat = "other"                  # not a plausible margin level; never compare it with one
        rec["category"] = cat
        computable = (cat in V.COMPUTABLE and bool(fy) and low is not None and latest.get("scope") == "company"
                      and (cat != "revenue_absolute" or unit in ("rs_cr", "inr crore", "crore")))
        passed = V.fy_complete(fy, facts)
        actual = V.actual_for(cat, fy, facts) if computable else None
        if actual:
            verdict, tracking = V.judge(cat, low, high, actual)
            rec |= {"verdict": verdict, "tracking": tracking, "actual": actual, "method": V.METHOD[cat],
                    "status_line": V.status_line(cat, low, high, actual, verdict),
                    "verdict_reason": None}
            if verdict == "too_early" and V.is_dropped(mention_periods, periods, tracking):
                rec["verdict"], rec["status_line"] = "dropped", rec["status_line"] + ", no longer mentioned"
        elif not passed and V.is_dropped(mention_periods, periods, None):
            last = mention_periods[-1]
            rec |= {"verdict": "dropped", "status_line": f"Last mentioned in {last}, silent since",
                    "verdict_reason": f"Stated in {mention_periods[0]}, not mentioned in {', '.join(rec['silent'])}."}
        else:
            qual.append(rec)
        computed.append(rec)

    if qual:
        progress(f"Judging {len(qual)} qualitative commitments")
        evidence, ev_map = _evidence(db, gw, cid, qual, docs, periods)
        tl = "\n".join(f'{r["key"]}: {r["topic"]}. Promised: "{r["mentions"][-1]["quote"]}" ({r["mentions"][-1]["period"]}, '
                       f'timeframe {r["timeframe"] or "not stated"})' for r in qual)
        qv = gw.structured(step="research.verdict", tier="strong", prompt="verdict", schema=QualVerdicts,
                           values={"company": page.name, "latest_period": periods[-1], "threads": tl, "evidence": evidence})
        got = {v.key: v for v in qv.verdicts}
        for r in qual:
            v = got.get(r["key"])
            verdict = v.verdict if v else "not_measurable"
            reason = v.reason if v else "Not enough evidence in the transcripts."
            cited = [e for e in ev_map if f"[{e}]" in reason]
            if verdict in ("delivered", "partly", "missed") and not cited:
                verdict, reason = "not_measurable", "No passage in later calls settles this."
            r |= {"verdict": verdict, "verdict_reason": reason.replace("—", ", "),
                  "evidence": [ev_map[e] for e in cited],
                  "status_line": {"delivered": "Delivered, per later calls", "partly": "Partly delivered, per later calls",
                                  "missed": "Missed, per later calls", "too_early": "Too early to tell",
                                  "not_measurable": "Not measurable from the documents"}[verdict]}
            if V.calls_since_last_mention(r["mention_periods"], periods) == 1 and verdict in ("too_early", "not_measurable"):
                r["status_line"] += ", not mentioned on the latest call"

    # 7. card text
    progress("Writing the scorecard")
    tl = "\n".join(json.dumps({"key": r["key"], "topic": r["topic"], "verdict": r["verdict"], "status_line": r["status_line"],
                               "promised": r["mentions"][-1]["quote"], "first_stated": r["mention_periods"][0],
                               "silent_in": r["silent"], "reason": r.get("verdict_reason")}) for r in computed)
    latest_pages = docs[periods[-1]]["pages"]
    cards = gw.structured(step="research.cards", tier="strong", prompt="cards", schema=Cards,
                          values={"company": page.name, "threads": tl, "opening": with_page_markers(latest_pages[:4], 3000)})
    card_by = {c.key: c for c in cards.cards}

    # 8. write
    db.delete("promises", {"company_id": f"eq.{cid}"})
    order = {"missed": 0, "dropped": 1, "partly": 2, "too_early": 3, "delivered": 4, "not_measurable": 5}
    computed.sort(key=lambda r: (order[r["verdict"]], r["importance"]))
    for rank, r in enumerate(computed):
        card = card_by.get(r["key"])
        rule = None
        if r.get("actual"):
            rule = {"metric": r["category"], "target_low": r["target_low"], "target_high": r["target_high"], "fy": r["timeframe"]}
        prom = db.insert("promises", {
            "company_id": cid, "thread_key": r["key"], "topic": r["topic"], "category": r["category"],
            "metric": r["category"], "target": _target_text(r), "timeframe": r["timeframe"], "rule": rule,
            "verdict": r["verdict"], "verdict_reason": r.get("verdict_reason"), "status_line": r["status_line"],
            "card_text": json.dumps({"headline": card.headline if card else r["topic"], "body": card.body if card else r["status_line"]}),
            "importance": rank, "first_period": r["mention_periods"][0], "last_period": r["mention_periods"][-1],
            "detail": {"actual": r.get("actual"), "tracking": r.get("tracking"), "method": r.get("method"),
                       "silent": r["silent"], "evidence": r.get("evidence", [])},
        }, returning=True)[0]
        mrows = [{"promise_id": prom["id"], "period": m["period"], "status": m["status"], "quote": m["quote"],
                  "document_id": m["doc_id"], "page": m["page"]} for m in _one_per_period(r["mentions"])]
        mrows += [{"promise_id": prom["id"], "period": p, "status": "silent", "quote": None, "document_id": docs[p]["id"],
                   "page": None} for p in r["silent"]]
        db.insert("promise_mentions", mrows)

    score = {k: sum(1 for r in computed if r["verdict"] == k) for k in order}
    score["total"] = len(computed)
    score["quotes_verified"], score["quotes_dropped"] = len(items), dropped
    one_ok, one_page = quote_like(cards.one_liner, latest_pages, cards.one_liner_page)
    db.upsert("research", [{
        "company_id": cid, "status": "ready", "doc_set_hash": doc_hash, "transcripts": len(transcripts),
        "results_filings": n_quarters, "scorecard": score,
        "snapshot": snapshot(page, facts, {"text": cards.one_liner, "page": one_page, "document_id": docs[periods[-1]]["id"],
                                           "verified": one_ok}),
        "questions": [{"q": q, "answer": None} for q in cards.questions[:3]],
        "updated_at": datetime.now(timezone.utc).isoformat()}], on_conflict="company_id")
    progress(f"Done: {score['delivered']} of {score['total']} promises kept, {dropped} unverifiable quotes dropped", status="done")
    return {"company_id": cid, "promises": len(computed), "score": score, "dropped_quotes": dropped}


def _sanitise_threads(threads: list[Thread], by_id: dict[str, dict]) -> list[Thread]:
    """Every item exactly once; unknown ids removed; orphans become their own thread."""
    used: set[str] = set()
    out: list[Thread] = []
    keys: set[str] = set()
    for t in threads:
        ms = [m for m in t.mentions if m.id in by_id and m.id not in used]
        used |= {m.id for m in ms}
        if not ms:
            continue
        key = t.key
        while key in keys:
            key += "_b"
        keys.add(key)
        out.append(t.model_copy(update={"mentions": ms, "key": key}))
    for i, it in by_id.items():
        if i not in used:
            out.append(Thread(key=f"{it['category']}_{i}", topic=it["topic"], importance=3,
                              mentions=[Mention(id=i, status="stated")]))
    return out


def _one_per_period(ms: list[dict]) -> list[dict]:
    seen, out = set(), []
    for m in ms:
        if m["period"] not in seen:
            seen.add(m["period"])
            out.append(m)
    return out


def _target_text(r: dict) -> str | None:
    lo, hi = r["target_low"], r["target_high"]
    if lo is None:
        return None
    return f"{lo:g}" if hi in (None, lo) else f"{lo:g} to {hi:g}"


def _evidence(db: Db, gw: Gateway, cid: int, qual: list[dict], docs: dict, periods: list[str]) -> tuple[str, dict]:
    """Passages from calls after each promise was first stated, via hybrid search. Returns (text, id->ref)."""
    blocks, ev_map, seen = [], {}, set()
    for r in qual:
        later = set(periods[periods.index(r["mention_periods"][0]) + 1 :])
        if not later:
            continue
        q = f'{r["topic"]}. {r["mentions"][-1]["quote"]}'
        try:
            emb = gw.embed([q], task="RETRIEVAL_QUERY", step="research.evidence_query")[0]
            hits = db.rpc("match_chunks", {"p_company_id": cid, "p_query_embedding": emb, "p_query_text": r["topic"], "p_k": 8})
        except Exception as exc:
            log.warning("evidence search failed: %s", exc)
            hits = []
        for h in hits:
            if h["period"] not in later or h["chunk_id"] in seen:
                continue
            seen.add(h["chunk_id"])
            eid = f"e{len(ev_map) + 1}"
            ev_map[eid] = {"document_id": h["document_id"], "page": h["page"], "period": h["period"]}
            blocks.append(f'<passage id="{eid}" period="{h["period"]}" page="{h["page"]}">\n{h["text"][:2500]}\n</passage>')
            if sum(1 for e in ev_map.values() if e["period"] in later) >= 4 * len(qual):
                break
    return "\n".join(blocks) or "(no later passages found)", ev_map


def quote_like(text: str, pages: list[str], page: int) -> tuple[bool, int]:
    """The one-liner is a summary, not a quote; record whether its page reference is at least plausible."""
    ok, found = quote_on_page(text, pages, page, threshold=60)
    return ok, found or max(1, min(page, len(pages)))


def snapshot(page: screener.ScreenerPage, facts: dict, one_liner: dict | None) -> dict:
    """Four headline numbers for the latest quarter, computed in code."""
    last = screener.quarter_label_to_period(page.quarters[-1])
    yoy_p = last.replace(last[-2:], f"{int(last[-2:]) - 1:02d}")

    def g(metric: str) -> float | None:
        a, b = facts.get((last, metric)), facts.get((yoy_p, metric))
        return round((a / b - 1) * 100, 1) if a is not None and b and b > 0 else None

    rev, op = facts.get((last, "revenue")), facts.get((last, "operating_profit"))
    return {
        "period": last, "basis": page.basis, "source_url": page.url, "one_liner": one_liner,
        "numbers": [
            {"label": "Revenue", "value": rev, "unit": "rs_cr", "yoy": g("revenue")},
            {"label": "Operating margin", "value": round(op / rev * 100, 1) if rev and op is not None else None, "unit": "pct"},
            {"label": "Net profit", "value": facts.get((last, "pat")), "unit": "rs_cr", "yoy": g("pat")},
            {"label": "EPS", "value": facts.get((last, "eps")), "unit": "rs", "yoy": g("eps")},
        ],
    }
