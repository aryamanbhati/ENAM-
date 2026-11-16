import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "./db";

// Feed reads are cached briefly so switching the Today window (24h/7d/30d) and
// hopping between tabs reuses results instead of re-querying Postgres every nav.
// Data changes on a 15-min ingest cron, so a short TTL is invisible to the user.
// marketState returns a Map (not JSON-serialisable) so it is intentionally not cached.
const FEED_TTL = 45;
import type { Company, Doc, Filing, Holding, Item, PromiseRow, Research, Signal, Tier, Triggers } from "./types";

const FILING_COLS =
  "id,company_id,filed_at,category,subcategory,subject,headline,pdf_url,finn_category,tier,tier_source,confidence,reason,summary,enrichment,summary_status,trigger_eligible";

export type FactRow = { period: string; metric: string; value: number; unit: string };
export type CompanyMetrics = {
  facts: FactRow[];
  turnover: { count: number; last: { name: string; role: string; change: string; at: string }[] };
};

/** Last N quarters of the headline facts (revenue, OPM, PAT, operating profit).
 *  Plus a 12-month count of management-change filings. All derived from
 *  existing tables; no new LLM calls. */
export async function companyMetrics(companyId: number, quarters = 8): Promise<CompanyMetrics> {
  const since = new Date(Date.now() - 400 * 864e5).toISOString();
  const [{ data: facts }, { data: mgmt }] = await Promise.all([
    db()
      .from("facts")
      .select("period,metric,value,unit")
      .eq("company_id", companyId)
      .in("metric", ["revenue", "operating_profit", "pat", "opm_pct", "npm_pct"])
      .order("period", { ascending: false })
      .limit(quarters * 5),
    db()
      .from("filings")
      .select("filed_at,enrichment")
      .eq("company_id", companyId)
      .eq("finn_category", "management_change")
      .gte("filed_at", since)
      .order("filed_at", { ascending: false })
      .limit(40),
  ]);
  type MgmtEnrich = { people?: { name: string; role: string; change: string }[] };
  const last: CompanyMetrics["turnover"]["last"] = [];
  for (const m of (mgmt ?? []) as { filed_at: string; enrichment: MgmtEnrich | null }[]) {
    const p = m.enrichment?.people?.[0];
    if (p) last.push({ name: p.name, role: p.role, change: p.change, at: m.filed_at });
    if (last.length >= 5) break;
  }
  return {
    facts: ((facts ?? []) as FactRow[]).map((f) => ({ ...f, value: Number(f.value) })),
    turnover: { count: (mgmt ?? []).length, last },
  };
}

export async function portfolio(): Promise<{ companies: Map<number, Company>; weights: Map<number, number> }> {
  const [{ data: cs }, { data: hs }] = await Promise.all([
    db().from("companies").select("id,nse_symbol,bse_code,name,sector"),
    db().from("holdings").select("company_id,weight"),
  ]);
  return {
    companies: new Map((cs ?? []).map((c) => [c.id, c as Company])),
    weights: new Map((hs ?? []).map((h) => [h.company_id, Number(h.weight)])),
  };
}

export async function triggers(): Promise<Triggers> {
  const { data } = await db().from("triggers").select("categories,volume_multiple,price_pct,digest_time").eq("id", 1).single();
  return {
    categories: (data?.categories as Record<string, boolean>) ?? {},
    volume_multiple: Number(data?.volume_multiple ?? 2),
    price_pct: Number(data?.price_pct ?? 5),
    digest_time: String(data?.digest_time ?? "08:30").slice(0, 5),
  };
}

type PriceRow = { company_id: number; date: string; close: number; volume: number };

/** Latest close, day move and volume multiple per company, computed from prices_eod. */
export async function marketState(companyIds: number[]): Promise<Map<number, { close: number; move: number | null; volMult: number | null; date: string; series: PriceRow[] }>> {
  const since = new Date(Date.now() - 50 * 864e5).toISOString().slice(0, 10);
  const { data } = await db()
    .from("prices_eod")
    .select("company_id,date,close,volume")
    .in("company_id", companyIds)
    .gte("date", since)
    .order("date", { ascending: true })
    .limit(5000);
  const by = new Map<number, PriceRow[]>();
  for (const r of (data ?? []) as PriceRow[]) {
    if (!by.has(r.company_id)) by.set(r.company_id, []);
    by.get(r.company_id)!.push({ ...r, close: Number(r.close), volume: Number(r.volume) });
  }
  const out = new Map();
  for (const [id, rows] of by) {
    if (rows.length < 2) continue;
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    const hist = rows.slice(-21, -1).map((r) => r.volume).filter(Boolean);
    const avg = hist.length >= 10 ? hist.reduce((a, b) => a + b, 0) / hist.length : null;
    out.set(id, {
      close: last.close,
      date: last.date,
      move: prev.close ? (last.close / prev.close - 1) * 100 : null,
      volMult: avg ? last.volume / avg : null,
      series: rows,
    });
  }
  return out;
}

async function itemsInWindowRaw(hours: number, range?: { from: string; to: string }): Promise<{ items: Item[]; failed: boolean }> {
  try {
    // Custom ranges are whole IST days, inclusive.
    const since = range ? new Date(`${range.from}T00:00:00+05:30`).toISOString() : new Date(Date.now() - hours * 3600e3).toISOString();
    const until = range ? new Date(`${range.to}T23:59:59+05:30`).toISOString() : new Date(Date.now() + 3600e3).toISOString();
    const sinceDate = range ? range.from : since.slice(0, 10);
    const untilDate = range ? range.to : "2999-12-31";
    const [{ companies, weights }, fr, sr, trig] = await Promise.all([
      portfolio(),
      db().from("filings").select(FILING_COLS).gte("filed_at", since).lte("filed_at", until).order("filed_at", { ascending: false }).limit(2000),
      db().from("signals").select("*").gte("date", sinceDate).lte("date", untilDate).order("date", { ascending: false }),
      triggers(),
    ]);
    const filings = (fr.data ?? []) as Filing[];
    const byId = new Map(filings.map((f) => [f.id, f]));
    const items: Item[] = [];
    for (const f of filings) {
      const company = companies.get(f.company_id);
      if (!company) continue;
      const tier = liveTier(f, trig.categories);
      const filing = tier === f.tier ? f : { ...f, tier, reason: liveReason(f, tier) };
      items.push({ kind: "filing", key: `filing:${f.id}`, tier, at: f.filed_at, company, weight: weights.get(f.company_id) ?? 0, filing });
    }
    // Signals: one item per company-day, price and volume merged.
    const signals = (sr.data ?? []) as Signal[];
    const groups = new Map<string, Signal[]>();
    for (const s of signals) {
      const k = `${s.company_id}:${s.date}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(s);
    }
    const missing = [...new Set(signals.map((s) => s.explained_by_filing_id).filter((x): x is string => !!x && !byId.has(x)))];
    if (missing.length) {
      const { data } = await db().from("filings").select(FILING_COLS).in("id", missing);
      for (const f of (data ?? []) as Filing[]) byId.set(f.id, f);
    }
    for (const [k, ss] of groups) {
      const company = companies.get(ss[0].company_id);
      if (!company) continue;
      const price = ss.find((s) => s.type === "price_move");
      const vol = ss.find((s) => s.type === "volume_spike");
      const explained = ss.map((s) => s.explained_by_filing_id).find(Boolean) ?? null;
      // Signals only exist above the user's thresholds, so they are triggers: Needs you.
      const over = (price && Math.abs(Number(price.value)) >= trig.price_pct) || (vol && Number(vol.value) >= trig.volume_multiple);
      items.push({
        kind: "signal",
        key: `signal:${k}`,
        tier: over ? "needs_you" : "worth_knowing",
        at: `${ss[0].date}T15:30:00+05:30`,
        company,
        weight: weights.get(company.id) ?? 0,
        signal: price ?? vol!,
        explainedBy: explained ? byId.get(explained) ?? null : null,
        move: price ? Number(price.value) : null,
        volume: vol ? Number(vol.value) : null,
      });
    }
    items.sort((a, b) => rank(a) - rank(b) || +new Date(b.at) - +new Date(a.at));
    return { items, failed: Boolean(fr.error) };
  } catch {
    return { items: [], failed: true };
  }
}

/** Re-apply the user's current triggers: preferences reorder items, they never hide them. */
export function liveTier(f: Filing, enabled: Record<string, boolean>): Tier {
  const base: Tier = f.tier_source === "trigger" ? "worth_knowing" : f.tier;
  const eligible = f.trigger_eligible ?? f.tier_source === "trigger";
  if (base === "worth_knowing" && eligible && f.finn_category && enabled[f.finn_category]) return "needs_you";
  return base;
}

function liveReason(f: Filing, tier: Tier): string | null {
  const label = (f.finn_category ?? "this").replace(/_/g, " ");
  const core = (f.reason ?? "").replace(/^Matches your [^.]+ alert\.\s*/, "");
  if (tier === "needs_you") return `Matches your ${label} alert. ${core}`.trim();
  return core ? `${core}. Your ${label} alert is off.` : `Your ${label} alert is off.`;
}

const TIER_ORDER: Record<Tier, number> = { needs_you: 0, worth_knowing: 1, routine: 2 };
function rank(i: Item) {
  return TIER_ORDER[i.tier] * 10;
}

async function upcomingRaw(limit = 6): Promise<{ company: Company; date: string; kind: string }[]> {
  const today = new Date().toISOString().slice(0, 10);
  const [{ companies }, { data }] = await Promise.all([
    portfolio(),
    db().from("events").select("company_id,date,kind").gte("date", today).order("date").limit(40),
  ]);
  return (data ?? [])
    .filter((e) => companies.has(e.company_id))
    .slice(0, limit)
    .map((e) => ({ company: companies.get(e.company_id)!, date: e.date, kind: e.kind }));
}

async function holdingsRaw(): Promise<Holding[]> {
  const { companies, weights } = await portfolio();
  const ids = [...weights.keys()];
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const [m, { data: fs }] = await Promise.all([
    marketState(ids),
    db().from("filings").select("company_id,tier").gte("filed_at", since).in("tier", ["needs_you", "worth_knowing"]),
  ]);
  const counts = new Map<number, { needs: number; worth: number }>();
  for (const f of fs ?? []) {
    const c = counts.get(f.company_id) ?? { needs: 0, worth: 0 };
    if (f.tier === "needs_you") c.needs++;
    else c.worth++;
    counts.set(f.company_id, c);
  }
  return ids
    .map((id) => {
      const c = companies.get(id)!;
      const s = m.get(id);
      const n = counts.get(id) ?? { needs: 0, worth: 0 };
      return { ...c, weight: weights.get(id)!, close: s?.close ?? null, move: s?.move ?? null, volMult: s?.volMult ?? null, spark: s?.series.slice(-22).map((r) => r.close) ?? [], ...n };
    })
    .sort((a, b) => b.needs - a.needs || Math.abs(b.move ?? 0) - Math.abs(a.move ?? 0));
}

export async function companyBySymbol(symbol: string): Promise<Company | null> {
  const { data } = await db().from("companies").select("id,nse_symbol,bse_code,name,sector").eq("nse_symbol", symbol.toUpperCase()).maybeSingle();
  return (data as Company) ?? null;
}

export async function companyFilings(companyId: number, limit = 30): Promise<Filing[]> {
  const { data } = await db().from("filings").select(FILING_COLS).eq("company_id", companyId).order("filed_at", { ascending: false }).limit(limit);
  return (data ?? []) as Filing[];
}

export async function research(companyId: number): Promise<{ research: Research | null; promises: PromiseRow[]; docs: Doc[] }> {
  const [{ data: r }, { data: ps }, { data: docs }] = await Promise.all([
    db().from("research").select("*").eq("company_id", companyId).maybeSingle(),
    db().from("promises").select("*, mentions:promise_mentions(period,status,quote,document_id,page)").eq("company_id", companyId).order("importance"),
    db().from("documents").select("id,type,period,url,page_count").eq("company_id", companyId),
  ]);
  return { research: (r as Research) ?? null, promises: (ps ?? []) as PromiseRow[], docs: (docs ?? []) as Doc[] };
}

async function researchedCompaniesRaw(): Promise<{ company: Company; research: Research }[]> {
  const { data } = await db().from("research").select("*, company:companies(id,nse_symbol,bse_code,name,sector)").order("updated_at", { ascending: false });
  return (data ?? []).filter((r) => r.company).map((r) => ({ company: r.company as Company, research: r as Research }));
}

/** Research jobs still queued or running. A brand-new ticker has only a jobs row
 *  (no research row yet), so without this it stays invisible on the Research page
 *  until the worker finishes. Uncached so a job appears the moment you navigate back. */
export async function inFlightResearch(): Promise<{ ticker: string; name: string; status: string }[]> {
  const since = new Date(Date.now() - 30 * 60e3).toISOString();
  const { data } = await db()
    .from("jobs")
    .select("ticker,status,created_at")
    .eq("type", "research")
    .in("status", ["queued", "running"])
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  const jobs = (data ?? []) as { ticker: string; status: string }[];
  // One row per ticker (newest job wins).
  const seen = new Set<string>();
  const tickers: { ticker: string; status: string }[] = [];
  for (const j of jobs) {
    const t = (j.ticker || "").toUpperCase();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    tickers.push({ ticker: t, status: j.status });
  }
  if (!tickers.length) return [];
  const { data: cs } = await db().from("companies").select("nse_symbol,name").in("nse_symbol", [...seen]);
  const names = new Map((cs ?? []).map((c) => [c.nse_symbol.toUpperCase(), c.name]));
  return tickers.map((t) => ({ ...t, name: names.get(t.ticker) ?? t.ticker }));
}

/** The in-flight research job for a ticker, if any, so a reopened research page
 *  can reconnect to its live progress instead of showing a static placeholder. */
export async function activeResearchJob(symbol: string): Promise<{ id: string; progress: { t: string; msg: string }[]; status: string } | null> {
  const recent = new Date(Date.now() - 20 * 60e3).toISOString();
  const { data } = await db()
    .from("jobs")
    .select("id,progress,status")
    .eq("type", "research")
    .eq("ticker", symbol.toUpperCase())
    .in("status", ["queued", "running"])
    .gte("created_at", recent)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id as string, progress: (data.progress as { t: string; msg: string }[]) ?? [], status: data.status as string };
}

export async function filingById(id: string): Promise<Filing | null> {
  const { data } = await db().from("filings").select(FILING_COLS).eq("id", id).maybeSingle();
  return (data as Filing) ?? null;
}

// Cached feed reads (see FEED_TTL note at top). Arguments are part of the cache
// key, so each window / id-set is cached separately.
export const itemsInWindow = unstable_cache(itemsInWindowRaw, ["itemsInWindow"], { revalidate: FEED_TTL });
export const upcoming = unstable_cache(upcomingRaw, ["upcoming"], { revalidate: FEED_TTL });
export const holdings = unstable_cache(holdingsRaw, ["holdings"], { revalidate: FEED_TTL });
// Not cached: a just-finished research run must appear the moment you return to
// the list. unstable_cache would hide it (and survive router.refresh) for its TTL.
// This is one indexed query, so serving it fresh on each navigation is cheap.
export const researchedCompanies = researchedCompaniesRaw;

// The Today page's per-company "how often does this filing happen" scan (up to
// 5000 rows) was the heaviest part of every window switch. Cache it too.
export const categoryHistory = unstable_cache(
  async (ids: number[]): Promise<{ counts: Record<string, number>; since: string | null }> => {
    if (!ids.length) return { counts: {}, since: null };
    const { data } = await db()
      .from("filings")
      .select("company_id,finn_category,filed_at")
      .in("company_id", ids)
      .neq("tier", "routine")
      .order("filed_at", { ascending: true })
      .limit(5000);
    const rows = (data ?? []) as { company_id: number; finn_category: string; filed_at: string }[];
    const counts: Record<string, number> = {};
    for (const h of rows) counts[`${h.company_id}:${h.finn_category}`] = (counts[`${h.company_id}:${h.finn_category}`] ?? 0) + 1;
    return { counts, since: rows[0]?.filed_at ?? null };
  },
  ["categoryHistory"],
  { revalidate: FEED_TTL },
);
