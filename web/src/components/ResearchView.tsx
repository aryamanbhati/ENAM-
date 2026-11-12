"use client";
import { useState } from "react";
import { keptLine, num, pct } from "@/lib/format";
import type { Company, Doc, PromiseRow, Research } from "@/lib/types";
import { useAsk } from "./Ask";
import { PageChip, VERDICT } from "./Badges";
import { Chevron } from "./icons";

const BAR_ORDER: PromiseRow["verdict"][] = ["delivered", "partly", "missed", "dropped", "too_early", "not_measurable"];
const MENTION_LABEL: Record<string, string> = { stated: "Stated", reiterated: "Reiterated", raised: "Raised", lowered: "Lowered", silent: "Silent" };

export function ResearchView({ company, research: r, promises, docs }: { company: Company; research: Research; promises: PromiseRow[]; docs: Doc[] }) {
  const { ask } = useAsk();
  const docUrl = new Map(docs.map((d) => [d.id, d.url]));
  const s = r.scorecard ?? { total: 0 };
  const total = s.total ?? 0;
  const snap = r.snapshot;
  const latestDoc = snap?.one_liner ? docUrl.get(snap.one_liner.document_id) : null;

  return (
    <div className="space-y-7 pt-5">
      {/* 1. header + snapshot */}
      <section>
        {snap?.one_liner && (
          <p className="font-serif text-[17px] leading-relaxed">
            {snap.one_liner.text}
            <PageChip page={snap.one_liner.page} href={latestDoc} />
          </p>
        )}
        {snap && (
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
            {snap.numbers.map((n) => (
              <div key={n.label}>
                <dt className="text-[11px] text-muted">{n.label}</dt>
                <dd className="text-lg tabular-nums">
                  {num(n.value, n.unit)}
                  {n.yoy !== undefined && n.yoy !== null && <span className={`ml-1.5 text-xs ${n.yoy >= 0 ? "text-up" : "text-down"}`}>{pct(n.yoy)} YoY</span>}
                </dd>
              </div>
            ))}
          </dl>
        )}
        <p className="mt-3 text-[11px] text-muted">
          From {r.transcripts ?? 0} concall transcripts and {r.results_filings ?? 0} quarters of results ({snap?.basis ?? "consolidated"}), latest {snap?.period}.{" "}
          {snap?.source_url && (
            <a href={snap.source_url} target="_blank" rel="noreferrer" className="underline decoration-line underline-offset-2">
              Results table
            </a>
          )}
        </p>
      </section>

      {/* 2. scorecard */}
      <section>
        {total === 0 ? (
          <p className="font-serif text-xl">No explicit guidance found in the last {r.transcripts ?? 0} transcripts.</p>
        ) : (
          <>
            <p className="font-serif text-[28px] leading-tight">{keptLine(s).head}</p>
            <p className="mt-1 text-sm text-muted">
              {total} commitment{total === 1 ? "" : "s"} tracked{keptLine(s).sub ? `: ${keptLine(s).sub}` : ""}.
            </p>
            <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-line" role="img" aria-label="Promise verdicts">
              {BAR_ORDER.map((v) => (s[v] ? <span key={v} className={VERDICT[v].bar} style={{ width: `${(s[v] / total) * 100}%` }} /> : null))}
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {BAR_ORDER.filter((v) => s[v]).map((v) => (
                <li key={v} className={VERDICT[v].color}>
                  <span className="tabular-nums">{s[v]}</span> {VERDICT[v].label.toLowerCase()}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* 3. promise cards */}
      {promises.length > 0 && (
        <section className="divide-y divide-line border-y border-line">
          {promises.map((p) => (
            <PromiseCard key={p.id} p={p} docUrl={docUrl} onAsk={(q) => ask(q)} />
          ))}
        </section>
      )}

      {/* 4. suggested questions */}
      {r.questions && r.questions.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Questions worth asking</h3>
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

function PromiseCard({ p, docUrl, onAsk }: { p: PromiseRow; docUrl: Map<number, string>; onAsk: (q: string) => void }) {
  const [open, setOpen] = useState(false);
  const v = VERDICT[p.verdict];
  let card: { headline?: string; body?: string } = {};
  try {
    card = p.card_text ? JSON.parse(p.card_text) : {};
  } catch {}
  const mentions = [...p.mentions].sort((a, b) => periodKey(a.period) - periodKey(b.period));
  return (
    <article className="py-4">
      <button onClick={() => setOpen((o) => !o)} className="block w-full text-left" aria-expanded={open}>
        <div className="flex items-baseline justify-between gap-2">
          <span className={`text-[11px] font-medium uppercase tracking-wide ${v.color}`}>{v.label}</span>
          <span className="text-[11px] text-muted">{p.topic}</span>
        </div>
        <p className="mt-1 font-serif text-[19px] leading-snug">{card.headline || p.topic}</p>
        {p.status_line && <p className="mt-1 text-sm tabular-nums">{p.status_line}</p>}
        <span className="mt-2 flex items-center gap-1 text-xs text-muted">
          {open ? "Hide" : "Show"} the quarter-by-quarter record <Chevron className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""}`} />
        </span>
      </button>
      {open && (
        <div className="fade-in mt-3 space-y-3">
          {card.body && <p className="text-sm leading-relaxed">{card.body}</p>}
          <ol className="relative space-y-3 border-l border-line pl-4">
            {mentions.map((m) => (
              <li key={m.period} className="relative">
                <span className={`absolute -left-[21px] top-1.5 h-2 w-2 rounded-full ${m.status === "silent" ? "border border-down bg-bg" : m.status === "lowered" ? "bg-partial" : "bg-ink"}`} />
                <p className="text-xs">
                  <span className="font-medium">{m.period}</span> · <span className={m.status === "silent" ? "text-down" : "text-muted"}>{MENTION_LABEL[m.status]}</span>
                </p>
                {m.quote ? (
                  <blockquote className="mt-1 font-serif text-[14px] leading-relaxed text-ink/90">
                    “{m.quote}”
                    <PageChip page={m.page} href={m.document_id ? docUrl.get(m.document_id) : null} />
                  </blockquote>
                ) : (
                  <p className="mt-1 text-xs text-muted">Not mentioned on this call.</p>
                )}
              </li>
            ))}
          </ol>
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

function periodKey(p: string): number {
  const m = p.match(/Q(\d) FY(\d\d)/);
  return m ? Number(m[2]) * 10 + Number(m[1]) : 0;
}
