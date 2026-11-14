import "server-only";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { embed, generateObject, type LanguageModel } from "ai";
import type { z } from "zod";
import { db } from "./db";

/**
 * Model chains. Groq's Llama 3.3 70B is the default for the assistant: it is
 * an order of magnitude faster than Gemini Flash and good enough on structured
 * output for our schemas. Gemini models stay in the chain as a fallback and
 * still serve embeddings (Groq does not expose any).
 */
const CHAINS = {
  cheap: process.env.FINN_MODEL_CHEAP || "groq/openai/gpt-oss-20b,groq/openai/gpt-oss-120b,gemini-2.5-flash-lite,gemini-1.5-flash-8b",
  strong: process.env.FINN_MODEL_STRONG || "groq/openai/gpt-oss-120b,groq/qwen/qwen3.8-27b,gemini-2.5-flash,gemini-1.5-flash",
  embed: process.env.FINN_EMBED_MODEL || "gemini-embedding-001",
};
const PRICE: [string, number, number][] = [
  ["gpt-oss-20b", 0.1, 0.5],
  ["gpt-oss-120b", 0.15, 0.75],
  ["qwen3", 0.29, 0.59],
  ["flash-lite", 0.1, 0.4],
  ["embedding", 0.15, 0],
  ["pro", 1.25, 10],
  ["flash", 0.3, 2.5],
];

const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY });
const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

/** Chain entries carry provider as a prefix:
 *    "groq/<model id>"   e.g. "groq/openai/gpt-oss-120b"
 *    "gemini/<model id>" or a bare "gemini-..." name
 *  The Groq model id can itself contain slashes (openai/gpt-oss-120b), so
 *  only the FIRST "groq/" segment is the provider prefix. */
function pick(name: string): { provider: "groq" | "google"; model: string } {
  if (name.startsWith("groq/")) return { provider: "groq", model: name.slice(5) };
  return { provider: "google", model: name.replace(/^gemini\//, "") };
}

export function models(tier: "cheap" | "strong" | "embed"): string[] {
  return CHAINS[tier]
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean)
    .filter((m) => {
      if (m.startsWith("groq/")) return !!process.env.GROQ_API_KEY;
      return !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
    });
}

export function cost(model: string, tin: number, tout: number): number {
  const p = PRICE.find(([k]) => model.includes(k));
  return p ? (tin * p[1] + tout * p[2]) / 1e6 : 0;
}

export type Usage = { model: string; tokens: number; cost: number };

async function log(step: string, model: string, tin: number, tout: number, ms: number) {
  try {
    await db().from("llm_calls").insert({ step, model, prompt_version: "web_v1", tokens_in: tin, tokens_out: tout, cost: cost(model, tin, tout), cache_hit: false, latency_ms: ms });
  } catch {}
}

(globalThis as { AI_SDK_LOG_WARNINGS?: boolean }).AI_SDK_LOG_WARNINGS = false;

export type CallOpts = { deadline?: number; perCallMs?: number; thinking?: number };

/**
 * Structured generation with fallback down the model chain on overload or rate limits.
 * `deadline` (epoch ms) bounds the whole call so a serverless function never times out;
 * `thinking` caps the model's thinking tokens (0 = none) for latency-sensitive steps.
 */
export async function structured<T>(step: string, tier: "cheap" | "strong", schema: z.ZodType<T>, system: string, prompt: string, opts: CallOpts = {}): Promise<{ object: T; usage: Usage }> {
  let last: unknown;
  const deadline = opts.deadline ?? Date.now() + 50_000;
  for (const full of models(tier)) {
    const { provider, model: name } = pick(full);
    for (let attempt = 0; attempt < 2; attempt++) {
      const left = deadline - Date.now();
      if (left < 2500) throw new Error(`${step}: out of time`);
      const t0 = Date.now();
      try {
        const mdl = provider === "groq" ? (groq(name) as LanguageModel) : (google(name) as LanguageModel);
        const r = await generateObject({
          model: mdl,
          schema,
          system,
          prompt,
          temperature: 0.1,
          maxRetries: 0,
          abortSignal: AbortSignal.timeout(Math.min(left, opts.perCallMs ?? left)),
          providerOptions:
            provider === "google" && opts.thinking !== undefined
              ? { google: { thinkingConfig: { thinkingBudget: opts.thinking } } }
              : undefined,
        });
        const tin = r.usage?.inputTokens ?? 0;
        const tout = r.usage?.outputTokens ?? 0;
        log(step, name, tin, tout, Date.now() - t0);
        return { object: r.object as T, usage: { model: name, tokens: tin + tout, cost: cost(name, tin, tout) } };
      } catch (e) {
        last = e;
        const msg = String((e as Error)?.message ?? e);
        if (/abort|timeout/i.test(msg)) break; // too slow: next model in the chain
        if (/503|overloaded|UNAVAILABLE|429|RESOURCE_EXHAUSTED|quota/i.test(msg)) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        break; // schema or other error: try the next model
      }
    }
  }
  throw new Error(`All ${tier} models failed: ${String((last as Error)?.message ?? last).slice(0, 200)}`);
}

export async function embedQuery(text: string): Promise<number[] | null> {
  for (const name of models("embed")) {
    try {
      const r = await embed({
        model: google.textEmbeddingModel(name),
        value: text,
        providerOptions: { google: { outputDimensionality: 768, taskType: "RETRIEVAL_QUERY" } },
      });
      return r.embedding;
    } catch {}
  }
  return null;
}
