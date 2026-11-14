export type Tier = "needs_you" | "worth_knowing" | "routine";

export type Company = {
  id: number;
  nse_symbol: string;
  bse_code: string | null;
  name: string;
  sector: string | null;
};

export type ResultsEnrichment = {
  kind: "results";
  period: string;
  basis: "consolidated" | "standalone";
  unit: string;
  rows: { metric: "Revenue" | "EBITDA" | "PBT" | "PAT"; current: number; prev: number | null; yoy_base: number | null; qoq: number | null; yoy: number | null; page: number | null; computed?: string }[];
  checks: { name: string; ok: boolean; detail: string }[];
  guidance_line?: string | null;
};

export type PersonEnrichment = {
  kind: "management";
  people: { name: string; role: string; change: "appointed" | "resigned" | "retired" | "redesignated" | "other"; effective: string | null; bio: string | null; bio_page: number | null; bio_source: "filing" | "outside" | null }[];
};

export type Enrichment = ResultsEnrichment | PersonEnrichment | { kind: "none" };

export type KeyPoint = { text: string; page: number | null };

export type Filing = {
  id: string;
  company_id: number;
  filed_at: string;
  category: string | null;
  subcategory: string | null;
  subject: string | null;
  headline: string | null;
  pdf_url: string | null;
  finn_category: string | null;
  tier: Tier;
  tier_source: "rule" | "llm" | "trigger";
  confidence: number | null;
  reason: string | null;
  summary: string | null;
  enrichment: (Enrichment & { points?: KeyPoint[]; one_line?: string; for_you?: string }) | null;
  summary_status: string;
  trigger_eligible?: boolean;
};

export type Signal = {
  id: number;
  company_id: number;
  date: string;
  type: "price_move" | "volume_spike";
  value: number;
  threshold: number;
  explained_by_filing_id: string | null;
};

/** One row on the Today screen: a filing or a market signal, already tiered. */
export type Item =
  | { kind: "filing"; key: string; tier: Tier; at: string; company: Company; weight: number; filing: Filing }
  | { kind: "signal"; key: string; tier: Tier; at: string; company: Company; weight: number; signal: Signal; explainedBy: Filing | null; move: number | null; volume: number | null };

export type Holding = Company & { weight: number; close: number | null; move: number | null; volMult: number | null; needs: number; worth: number; spark: number[] };

export type Triggers = {
  categories: Record<string, boolean>;
  volume_multiple: number;
  price_pct: number;
  digest_time: string;
};

export type PromiseRow = {
  id: number;
  company_id: number;
  thread_key: string;
  topic: string;
  category: string;
  target: string | null;
  timeframe: string | null;
  verdict: "delivered" | "partly" | "missed" | "dropped" | "too_early" | "not_measurable";
  verdict_reason: string | null;
  status_line: string | null;
  card_text: string | null;
  importance: number;
  first_period: string | null;
  last_period: string | null;
  detail: {
    actual?: { value: number; unit: string; quarters: string[]; complete: boolean } | null;
    tracking?: string | null;
    method?: string | null;
    silent?: string[];
    evidence?: { document_id: number; page: number; period: string }[];
  } | null;
  mentions: { period: string; status: string; quote: string | null; document_id: number | null; page: number | null }[];
};

export type Research = {
  company_id: number;
  status: "none" | "running" | "ready" | "failed" | "no_guidance";
  scorecard: Record<string, number> | null;
  snapshot: {
    period: string;
    basis: string;
    source_url: string;
    one_liner: { text: string; page: number; document_id: number; verified: boolean } | null;
    numbers: { label: string; value: number | null; unit: string; yoy?: number | null }[];
  } | null;
  questions: { q: string; answer: unknown }[] | null;
  transcripts: number | null;
  results_filings: number | null;
  updated_at: string;
};

export type Doc = { id: number; type: string; period: string | null; url: string; page_count: number | null };
