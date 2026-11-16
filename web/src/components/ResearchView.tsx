"use client";
import { useState } from "react";
import { cleanQuote, cleanScorecard, keptLine } from "@/lib/format";
import type { CompanyMetrics } from "@/lib/queries";
import type { Company, Doc, PromiseRow, Research } from "@/lib/types";
import { useAsk } from "./Ask";
import { PageChip, SegmentedBar, StatusChip } from "./Badges";
import { MetricsPanel } from "./MetricsPanel";
import { Chevron } from "./icons";

const MENTION_LABEL: Record<string, string> = { stated: "Stated", reiterated: "Reiterated", raised: "Raised", lowered: "Lowered", silent: "Silent" };

export function ResearchView({ company, research: r, promises: allPromises, docs, metrics }: { company: Company; research: Research; promises: PromiseRow[]; docs: Doc[]; metrics?: CompanyMetrics | null }) {
  const { ask } = useAsk();
  const docUrl = new Map(docs.map((d) => [d.id, d.url]));
  // Drop "not measurable" commitments entirely: they add noise without a verdict.
  // Order the rest by outcome: delivered first, then partly, missed, quietly
  // dropped, too early, so the kept promises lead and the lapses follow.
  const VERDICT_ORDER: Record<string, number> = { delivered: 0, partly: 1, missed: 2, dropped: 3, too_early: 4, not_measurable: 5 };
  const promises = allPromises
    .filter((p) => p.verdict !== "not_measurable")
    .slice()
    .sort((a, b) => (VERDICT_ORDER[a.verdict] ?? 9) - (VERDICT_ORDER[b.verdict] ?? 9));
  const s = cleanScorecard(r.scorecard);
  const total = s.total ?? 0;
  const snap = r.snapshot;
  const latestDoc = snap?.one_liner ? docUrl.get(snap.one_liner.document_id) : null;

  return (
    <div className="space-y-7 pt-5">
      {/* 1. one-line read + provenance. The number grid lives in MetricsPanel now. */}
      <section>
        {snap?.one_liner && (
          <p className="text-[16px] leading-relaxed text-ink">
            {snap.one_liner.text}
            <PageChip page={snap.one_liner.page} href={latestDoc} />
          </p>
        )}
        <p className="mt-3 text-[11px] text-muted">
          From {r.transcripts ?? 0} concall transcripts and {r.results_filings ?? 0} quarters of results ({snap?.basis ?? "consolidated"}), latest {snap?.period}.{" "}
          {snap?.source_url && (
            <a href={snap.source_url} target="_blank" rel="noreferrer" className="underline decoration-line underline-offset-2 hover:text-ink">
              Results table
            </a>
          )}
        </p>
      </section>

      {/* The numbers, right under the business one-liner. */}
      {metrics && <MetricsPanel metrics={metrics} />}

      {/* 2. scorecard */}
      <section>
        {total === 0 ? (
          <div className="card p-5">
            {(r.transcripts ?? 0) === 0 ? (
              <>
                <p className="font-serif text-xl leading-snug">{company.name} does not publish earnings call transcripts.</p>
                <p className="mt-2 text-sm text-muted">No concall transcript was found on NSE or BSE, so there is no stated guidance to track. The quarterly numbers above are still computed from the company&apos;s own results.</p>
              </>
            ) : (
              <>
                <p className="font-serif text-xl leading-snug">No explicit guidance found in the last {r.transcripts} transcripts.</p>
                <p className="mt-2 text-sm text-muted">Management made no checkable commitment on headline numbers, so there is nothing to hold them to yet.</p>
              </>
            )}
          </div>
        ) : (
          <div className="card p-5">
            <p className="font-serif text-[28px] leading-[1.1] tracking-tight text-ink">{keptLine(s).head}</p>
            <p className="mt-1.5 text-sm text-muted">
              {total} commitment{total === 1 ? "" : "s"} tracked{keptLine(s).sub ? `: ${keptLine(s).sub}` : ""}.
            </p>
            <div className="mt-4">
              <SegmentedBar scorecard={s} />
            </div>
          </div>
        )}
      </section>

      {/* 3. promise cards */}
      {promises.length > 0 && (
        <section className="space-y-3">
          {promises.map((p) => (
            <PromiseCard key={p.id} p={p} docUrl={docUrl} onAsk={(q) => ask(q)} />
          ))}
        </section>
      )}

      {/* 4. suggested questions */}
      {r.questions && r.questions.length > 0 && (
        <section>
          <h3 className="mb-2 font-serif text-[17px] tracking-[-0.01em] text-ink">Questions worth asking</h3>
          <div className="flex flex-wrap gap-2">
            {r.questions.map((q) => (
              <button key={q.q} onClick={() => ask(q.q)} className="rounded-full border border-line px-3 py-1.5 text-left text-xs hover:border-ink">
                {q.q}
              </button>
            ))}
          </div>
        </section>
      )}

      <details className="text-xs text-muted">
        <summary className="cursor-pointer underline decoration-line underline-offset-2">How we read this</summary>
        <div className="mt-2 space-y-2 leading-relaxed">
          <p>A low-cost model lists each explicit commitment in the last {r.transcripts ?? 4} concall transcripts. Every quote is matched against the page it cites; anything that does not match is dropped.</p>
          <p>Commitments are linked across calls. If management stated a target and then stopped mentioning it, we mark it quietly dropped.</p>
          <p>Where a target is a number we can measure (revenue growth, margins, profit growth), the verdict is computed in code from reported quarterly results. Only qualitative commitments are judged by a model, and only with passages it can cite.</p>
          <p>Segment or product targets are not compared with company totals. No news, broker notes or outside knowledge are used.</p>
        </div>
      </details>
      <p className="text-[11px] text-muted">Not investment advice. Updated {new Date(r.updated_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} for {company.nse_symbol}.</p>
    </div>
  );
}

function Gauge({ p }: { p: PromiseRow }) {
  const actual = p.detail?.actual;
  if (!actual || actual.value == null || !p.target) return null;
  const m = String(p.target).match(/-?\d+(\.\d+)?/);
  const guide = m ? parseFloat(m[0]) : NaN;
  if (!isFinite(guide) || guide === 0) return null;
  const delivered = actual.value;
  const max = Math.max(guide, delivered, 0) * 1.15 || 1;
  const unit = actual.unit === "pct" ? "%" : "";
  const hit = delivered >= guide;
  return (
    <div className="mt-3">
      <div className="relative h-6 overflow-hidden rounded-lg bg-raised">
        <span className={`absolute inset-y-1 left-1 rounded-md ${hit ? "bg-up" : "bg-down"}`} style={{ width: `calc(${Math.max(Math.min((delivered / max) * 100, 100), 4)}% - 8px)` }} />
        <span className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: `${Math.min((guide / max) * 100, 99)}%` }} aria-hidden title={`Guided ${guide}${unit}`} />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] tabular-nums">
        <span className={hit ? "font-medium text-up" : "font-medium text-down"}>
          Delivered {delivered}
          {unit}
        </span>
        <span className="text-muted">
          Guided {p.target}
          {unit} · {actual.complete ? "full year" : `${actual.quarters.length} of 4 quarters`}
        </span>
      </div>
    </div>
  );
}

function PromiseCard({ p, docUrl, onAsk }: { p: PromiseRow; docUrl: Map<number, string>; onAsk: (q: string) => void }) {
  const [open, setOpen] = useState(false);
  let card: { headline?: string; body?: string } = {};
  try {
    card = p.card_text ? JSON.parse(p.card_text) : {};
  } catch {}
  const mentions = [...p.mentions].sort((a, b) => periodKey(a.period) - periodKey(b.period));
  return (
    <article className="card overflow-hidden p-4">
      <button onClick={() => setOpen((o) => !o)} className="block w-full text-left" aria-expanded={open}>
        <div className="flex items-center justify-between gap-2">
          <StatusChip verdict={p.verdict} />
          <span className="truncate text-[11px] text-muted">{p.topic}</span>
        </div>
        <p className="mt-2.5 font-serif text-[20px] leading-snug">{card.headline || p.topic}</p>
        {p.status_line && <p className="mt-1 text-[13px] tabular-nums text-muted">{p.status_line}</p>}
        <Gauge p={p} />
        <span className="mt-3 flex items-center gap-1 text-xs font-medium text-accent-ink">
          {open ? "Hide" : "Show"} the quarter-by-quarter record <Chevron className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""}`} />
        </span>
      </button>
      {open && (
        <div className="fade-in mt-3 space-y-3">
          {card.body && <p className="text-sm leading-relaxed">{card.body}</p>}
          <Timeline mentions={mentions} docUrl={docUrl} />

          {p.detail?.actual && (
            <p className="text-xs text-muted">
              {p.detail.method}. Quarters used: {p.detail.actual.quarters.join(", ")}.
            </p>
          )}
          {p.verdict_reason && <p className="text-xs text-muted">{p.verdict_reason.replace(/\[e\d+\]/g, "").trim()}</p>}
          {p.detail?.evidence && p.detail.evidence.length > 0 && (
            <p className="text-xs text-muted">
              Evidence:
              {p.detail.evidence.map((e, i) => (
                <PageChip key={i} page={e.page} href={docUrl.get(e.document_id)} label={`${e.period} p.${e.page}`} />
              ))}
            </p>
          )}
          <button onClick={() => onAsk(`Tell me more about the ${p.topic.toLowerCase()} promise`)} className="rounded-full border border-line px-3 py-1.5 text-xs">
            Ask about this promise
          </button>
        </div>
      )}
    </article>
  );
}

/**
 * Quarter-by-quarter record. Keeps every stated/raised/lowered/reiterated row
 * visible, and groups runs of three or more consecutive silent quarters into a
 * single expandable row so the timeline does not drown in "not mentioned" rows.
 */
function Timeline({
  mentions,
  docUrl,
}: {
  mentions: PromiseRow["mentions"];
  docUrl: Map<number, string>;
}) {
  type Group = { kind: "silent"; items: PromiseRow["mentions"] } | { kind: "item"; m: PromiseRow["mentions"][number] };
  const groups: Group[] = [];
  for (const m of mentions) {
    if (m.status === "silent") {
      const last = groups[groups.length - 1];
      if (last && last.kind === "silent") last.items.push(m);
      else groups.push({ kind: "silent", items: [m] });
    } else {
      groups.push({ kind: "item", m });
    }
  }
  return (
    <ol className="relative space-y-3 border-l border-line pl-4">
      {groups.map((g, i) =>
        g.kind === "item" ? (
          <MentionRow key={g.m.period} m={g.m} docUrl={docUrl} />
        ) : g.items.length >= 3 ? (
          <SilentRun key={`s-${i}`} items={g.items} docUrl={docUrl} />
        ) : (
          g.items.map((m) => <MentionRow key={m.period} m={m} docUrl={docUrl} />)
        ),
      )}
    </ol>
  );
}

function MentionRow({
  m,
  docUrl,
}: {
  m: PromiseRow["mentions"][number];
  docUrl: Map<number, string>;
}) {
  const dot =
    m.status === "silent"
      ? "border border-down bg-bg"
      : m.status === "lowered"
        ? "bg-partial"
        : "bg-ink";
  return (
    <li className="relative">
      <span className={`absolute -left-[21px] top-1.5 h-2 w-2 rounded-full ${dot}`} />
      <p className="text-xs">
        <span className="font-medium">{m.period}</span>{" "}
        <span className="text-faint">·</span>{" "}
        <span className={m.status === "silent" ? "text-down" : "text-muted"}>{MENTION_LABEL[m.status]}</span>
      </p>
      {m.quote ? (
        <blockquote className="mt-1 font-serif text-[14px] leading-relaxed text-ink/90">
          “{cleanQuote(m.quote)}”
          <PageChip page={m.page} href={m.document_id ? docUrl.get(m.document_id) : null} />
        </blockquote>
      ) : (
        <p className="mt-1 text-xs text-muted">Not mentioned on this call.</p>
      )}
    </li>
  );
}

function SilentRun({ items, docUrl }: { items: PromiseRow["mentions"]; docUrl: Map<number, string> }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="relative">
      <span className="absolute -left-[22px] top-1.5 h-2.5 w-2.5 rounded-full border border-dashed border-down bg-bg" />
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-muted hover:text-ink"
        aria-expanded={open}
      >
        {open ? "Hide" : "Show"} {items.length} silent quarter{items.length === 1 ? "" : "s"} ({items[0].period} to {items[items.length - 1].period})
      </button>
      {open && (
        <ol className="fade-in mt-2 space-y-3">
          {items.map((m) => (
            <MentionRow key={m.period} m={m} docUrl={docUrl} />
          ))}
        </ol>
      )}
    </li>
  );
}

function periodKey(p: string): number {
  const m = p.match(/Q(\d) FY(\d\d)/);
  return m ? Number(m[2]) * 10 + Number(m[1]) : 0;
}
