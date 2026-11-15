export const IST = "Asia/Kolkata";

export const CATEGORY_LABELS: Record<string, string> = {
  results: "Results",
  "M&A": "M&A",
  fund_raise: "Fund raise",
  management_change: "Management change",
  litigation: "Litigation",
  insider_trading: "Insider trading",
  earnings_call: "Earnings call",
  investor_meetings: "Investor meetings",
  credit_rating: "Credit rating",
  dividend: "Dividend",
  bonus_split: "Bonus or split",
  capex: "Capex",
  press_release: "Press release",
  postal_ballot: "Postal ballot",
  agm_egm: "AGM or EGM",
  pledging: "Pledging",
  unclassified: "Filing",
};

export function categoryLabel(c: string | null | undefined): string {
  return (c && CATEGORY_LABELS[c]) || "Filing";
}

export function shortName(name: string): string {
  return name
    .replace(/\s+(Limited|Ltd\.?|Ltd)$/i, "")
    .replace(/\s*\(India\)/i, "")
    .replace(/\s+Industries$/i, " Industries")
    .trim();
}

export function relTime(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  const m = Math.round((now - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: IST });
}

export function dateLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: IST });
}

export function pct(v: number | null | undefined, digits = 1, sign = true): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "n/a";
  const s = v.toFixed(digits);
  return `${sign && v > 0 ? "+" : ""}${s}%`;
}

export function crore(v: number | null | undefined): string {
  if (v === null || v === undefined) return "n/a";
  return `₹${Math.round(v).toLocaleString("en-IN")} cr`;
}

export function num(v: number | null | undefined, unit: string): string {
  if (v === null || v === undefined) return "n/a";
  if (unit === "pct") return `${v.toFixed(1)}%`;
  if (unit === "rs_cr") return crore(v);
  if (unit === "rs") return `₹${v.toFixed(2)}`;
  return v.toLocaleString("en-IN");
}

/**
 * Natural display title for a filing. Takes whatever string we have
 * (enrichment.one_line, headline, or cleaned subject) and makes it read as a
 * complete news sentence:
 *   - If it starts with a bare verb ("Appoints…", "Reports…", "Wins…"), it
 *     gets the company short name prepended and the first letter lowercased,
 *     so "Appoints Priya Rao" → "HDFC Bank appoints Priya Rao".
 *   - If it already starts with the company name or a subject, it is returned
 *     as is.
 *   - It is trimmed to ~90 chars on the last whole word, with an ellipsis.
 * Trailing full stops kept, repeated whitespace collapsed.
 */
const VERB_FIRST = new Set([
  "Appoints", "Reappoints", "Re-appoints", "Resigns", "Removes", "Elects",
  "Reports", "Posts", "Announces", "Declares", "Approves", "Confirms",
  "Wins", "Secures", "Receives", "Signs", "Enters", "Raises", "Issues",
  "Allots", "Allocates", "Acquires", "Invests", "Launches", "Expands",
  "Starts", "Begins", "Completes", "Closes", "Opens", "Ends", "Updates",
  "Intimates", "Informs", "Discloses", "Clarifies", "Withdraws",
]);

export function naturalTitle(raw: string | null | undefined, companyName: string | null | undefined, max = 220): string {
  const text = cleanSubject(raw ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const first = text.split(/\s+/)[0];
  let out = text;
  if (companyName && VERB_FIRST.has(first)) {
    const subj = shortName(companyName);
    out = `${subj} ${first.toLowerCase()}${text.slice(first.length)}`;
  }
  // Only a safety ceiling for pathological lengths. Card display truncation is
  // done in CSS (.clamp-2), which never leaves a dangling "...from". So the
  // detail view, which does not clamp, still receives the whole sentence.
  if (out.length > max) {
    const cut = out.slice(0, max);
    const stop = cut.lastIndexOf(" ");
    out = cut.slice(0, stop > 120 ? stop : max).trim() + "…";
  }
  return out;
}

/**
 * Clean a quoted passage pulled from a source document. Replaces OCR-style
 * double hyphens with a real em dash and tidies spacing. Used only inside a
 * blockquote: FINN's own copy still avoids em dashes per CLAUDE.md.
 */
export function cleanQuote(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/\s*--\s*/g, " — ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Strips BSE boilerplate from a subject line so the human part shows. */
export function cleanSubject(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/^Announcement under Regulation 30 \(LODR\)\s*-\s*/i, "")
    .replace(/^Board Meeting Outcome for\s*/i, "Board outcome: ")
    .replace(/^Board Meeting Intimation for\s*/i, "Board meeting: ")
    .replace(/^Compliances-\s*/i, "")
    .replace(/^Corporate Action-\s*/i, "")
    .replace(/_/g, " ")
    .trim();
}

export const WINDOWS = { "24h": 24, "7d": 24 * 7, "30d": 24 * 30 } as const;
export type WindowKey = keyof typeof WINDOWS;

/**
 * Remove "not measurable" commitments from a scorecard so they do not show in
 * counts, bars or headlines. FINN only tracks what it can actually judge.
 */
export function cleanScorecard(s: Record<string, number> | null | undefined): Record<string, number> {
  const src = s ?? {};
  const nm = src.not_measurable ?? 0;
  return { ...src, not_measurable: 0, total: Math.max((src.total ?? 0) - nm, 0) };
}

/** Scorecard headline: only promises that can be judged count toward "kept". */
export function keptLine(s: Record<string, number> | null | undefined): { head: string; sub: string } {
  const g = (k: string) => (s?.[k] ?? 0);
  const judged = g("delivered") + g("partly") + g("missed");
  const parts: string[] = [];
  if (g("dropped")) parts.push(`${g("dropped")} quietly dropped`);
  if (g("too_early")) parts.push(`${g("too_early")} too early to judge`);
  if (g("not_measurable")) parts.push(`${g("not_measurable")} not measurable`);
  const sub = parts.join(", ");
  if (!g("total")) return { head: "No explicit guidance found.", sub: "" };
  if (judged === 0) return { head: g("dropped") ? `${g("dropped")} of ${g("total")} promises quietly dropped.` : "Nothing can be judged yet.", sub };
  const kept = g("delivered");
  const partly = g("partly") ? `, ${g("partly")} partly` : "";
  return { head: `Kept ${kept} of ${judged} promise${judged === 1 ? "" : "s"} that can be judged${partly}.`, sub };
}
