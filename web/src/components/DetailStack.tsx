"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { categoryLabel, cleanSubject, dateLabel, pct, relTime, shortName } from "@/lib/format";
import type { Item, Tier } from "@/lib/types";
import { useAsk } from "./Ask";
import { Move, PageChip, TIER_LABEL, TierBadge } from "./Badges";
import { Close, Doc } from "./icons";
import { Sparkline } from "./Sparkline";
import { itemKind, itemTitle, type TodayProps } from "./TodayView";

type Props = TodayProps & { tier: Tier; list: Item[]; index: number; onIndex: (i: number) => void; onClose: () => void };

export function DetailStack(props: Props) {
  const { list, index, onIndex, onClose, tier, win } = props;
  const { setScope } = useAsk();
  const done = index >= list.length;
  const item = list[index];
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const go = useCallback((d: number) => onIndex(Math.max(0, Math.min(list.length, index + d))), [index, list.length, onIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [go, onClose]);

  useEffect(() => {
    scroller.current?.scrollTo(0, 0);
    if (!item) setScope({ screen: "today", window: win });
    else if (item.kind === "filing") setScope({ screen: "filing", filingId: item.filing.id, companyId: item.company.id, symbol: item.company.nse_symbol });
    else setScope({ screen: "signal", companyId: item.company.id, symbol: item.company.nse_symbol, date: item.signal.date });
  }, [item, setScope, win]);

  useEffect(() => () => setScope({ screen: "today", window: win }), [setScope, win]);

  return (
    <div className="fade-in fixed inset-0 z-40 bg-bg" role="dialog" aria-label={`${TIER_LABEL[tier]} item ${Math.min(index + 1, list.length)} of ${list.length}`}>
      <div className="mx-auto flex h-full max-w-md flex-col">
        <div className="flex items-center justify-between px-5 pb-2 pt-[max(env(safe-area-inset-top),0.9rem)]">
          <button onClick={onClose} aria-label="Close" className="-m-2 p-2 text-muted">
            <Close className="h-5 w-5" />
          </button>
          <div className="flex gap-1" aria-hidden>
            {list.map((_, i) => (
              <span key={i} className={`h-1 rounded-full transition-all ${i === index ? "w-5 bg-accent" : "w-1.5 bg-line"}`} />
            ))}
          </div>
          <span className="text-xs tabular-nums text-muted">{done ? "Done" : `${index + 1} of ${list.length}`}</span>
        </div>

        <div
          ref={scroller}
          className="flex-1 overflow-y-auto px-5 pb-40"
          style={{ transform: `translateX(${dx}px)`, transition: start.current ? "none" : "transform 180ms ease-out" }}
          onPointerDown={(e) => {
            start.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerMove={(e) => {
            if (!start.current) return;
            const x = e.clientX - start.current.x;
            if (Math.abs(x) > Math.abs(e.clientY - start.current.y) && Math.abs(x) > 8) setDx(x);
          }}
          onPointerUp={() => {
            const d = dx;
            start.current = null;
            setDx(0);
            if (d < -70) go(1);
            else if (d > 70) go(-1);
          }}
          onPointerCancel={() => {
            start.current = null;
            setDx(0);
          }}
        >
          {done ? <CaughtUp {...props} /> : <Detail item={item} {...props} />}
        </div>

        {!done && (
          <div className="pointer-events-none fixed inset-x-0 bottom-[calc(112px+env(safe-area-inset-bottom))] z-40">
            <div className="mx-auto flex max-w-md justify-between px-5">
              <button onClick={() => go(-1)} disabled={index === 0} className="pointer-events-auto rounded-full border border-line bg-surface px-3 py-1 text-xs disabled:opacity-0">
                ← Previous
              </button>
              <button onClick={() => go(1)} className="pointer-events-auto rounded-full border border-line bg-surface px-3 py-1 text-xs">
                {index === list.length - 1 ? "Finish" : "Next →"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Detail({ item, counts, historySince, series }: { item: Item } & Props) {
  const { ask } = useAsk();
  const f = item.kind === "filing" ? item.filing : item.explainedBy;
  const e = item.kind === "filing" ? item.filing.enrichment : null;
  const points = e?.points ?? [];
  const cat = item.kind === "filing" ? item.filing.finn_category : null;
  const seen = cat ? counts[`${item.company.id}:${cat}`] ?? 0 : 0;
  const since = historySince ? new Date(historySince).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : null;

  const questions =
    item.kind === "signal"
      ? ["Why might it have moved?", "Has this happened before?", `What did ${item.company.nse_symbol} file recently?`]
      : cat === "results"
        ? ["How do these compare with guidance?", "What drove the change in profit?", "What did management say on the call?"]
        : cat === "management_change"
          ? ["Who else changed recently?", "What does this role oversee?", "Was a reason given?"]
          : ["What does this mean for the company?", "Has this happened before?", "What else did they file recently?"];

  return (
    <article className="space-y-6 pt-2">
      {/* 1. header */}
      <header className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted">
          <Link href={`/company/${item.company.nse_symbol}`} className="font-medium text-ink underline decoration-line underline-offset-4">
            {shortName(item.company.name)}
          </Link>
          <TierBadge tier={item.tier} />
        </div>
        <p className="text-xs text-muted">
          {itemKind(item)} · {item.kind === "filing" ? dateLabel(item.at) : new Date(item.signal.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
        </p>
        <h2 className="font-serif text-[26px] leading-tight">{itemTitle(item)}</h2>
        <p className="text-sm text-muted">
          <span className="text-ink">Why this is here: </span>
          {item.kind === "signal"
            ? `${item.move !== null ? `Moved ${pct(item.move)}` : ""}${item.move !== null && item.volume !== null ? " and traded " : ""}${item.volume !== null ? `${item.volume.toFixed(1)}× its 20-day average volume` : ""}, past your alert threshold.`
            : item.filing.reason}
          {item.kind === "filing" && item.filing.tier_source === "llm" && item.filing.confidence !== null && <span> Classified by model, {Math.round(item.filing.confidence * 100)}% confident.</span>}
        </p>
      </header>

      {/* 2. enrichment */}
      {item.kind === "signal" && (
        <section className="space-y-3">
          {series[item.company.id] && <Sparkline points={series[item.company.id]} mark={item.signal.date} />}
          <p className="font-serif text-lg leading-snug">
            {item.explainedBy ? (
              <>
                Explained by {categoryLabel(item.explainedBy.finn_category).toLowerCase()} filed {relTime(item.explainedBy.filed_at)}: {cleanSubject(item.explainedBy.enrichment?.one_line || item.explainedBy.headline || item.explainedBy.subject)}
              </>
            ) : (
              "No filing in the 48 hours around this move explains it."
            )}
          </p>
        </section>
      )}

      {e?.kind === "results" && (
        <section>
          <h3 className="mb-2 font-serif text-[17px] tracking-[-0.01em] text-ink">
            {e.period} results, {e.basis}
          </h3>
          <table className="w-full text-sm tabular-nums">
            <thead className="text-[11px] text-muted">
              <tr>
                <th className="py-1 text-left font-normal">{e.unit === "lakh" ? "₹ lakh" : "₹ crore"}</th>
                <th className="text-right font-normal">This qtr</th>
                <th className="text-right font-normal">QoQ</th>
                <th className="text-right font-normal">YoY</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {e.rows.map((r) => (
                <tr key={r.metric}>
                  <td className="py-2">
                    {r.metric}
                    <PageChip page={r.page} href={f?.pdf_url} label={r.computed ? "computed" : undefined} />
                  </td>
                  <td className="text-right">{r.current.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                  <td className="text-right">
                    <Move v={r.qoq} />
                  </td>
                  <td className="text-right">
                    <Move v={r.yoy} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {e.rows.some((r) => r.computed) && <p className="mt-2 text-[11px] text-muted">EBITDA is not reported in the filing. Computed as PBT + finance costs + depreciation and amortisation.</p>}
          {e.checks.some((c) => !c.ok) && <p className="mt-1 text-[11px] text-partial">Check: {e.checks.filter((c) => !c.ok).map((c) => c.detail).join(". ")}</p>}
          {e.guidance_line && <p className="mt-2 text-sm">{e.guidance_line}</p>}
        </section>
      )}

      {e?.kind === "management" && (
        <section className="space-y-4">
          {e.people.map((p) => (
            <div key={p.name}>
              <p className="font-medium">{p.name}</p>
              <p className="text-xs text-muted">
                {p.role} · {p.change}
                {p.effective ? `, effective ${p.effective}` : ""}
              </p>
              {p.bio ? (
                <p className="mt-1 font-serif text-[15px] leading-relaxed">
                  {p.bio}
                  <PageChip page={p.bio_page} href={f?.pdf_url} />
                  {p.bio_source === "outside" && <span className="ml-1 text-[10px] text-muted">(outside source)</span>}
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted">The filing has no profile for this person.</p>
              )}
            </div>
          ))}
        </section>
      )}

      {/* 3. key points */}
      {points.length > 0 && (
        <section>
          <h3 className="mb-2 font-serif text-[17px] tracking-[-0.01em] text-ink">Key points</h3>
          <ul className="space-y-2 font-serif text-[15px] leading-relaxed">
            {points.map((p, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-muted">·</span>
                <span>
                  {p.text}
                  <PageChip page={p.page} href={f?.pdf_url} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {item.kind === "filing" && !e && item.tier !== "routine" && <p className="text-sm text-muted">Summary not generated yet. The filing itself is one tap below.</p>}

      {/* 4. what it means for you */}
      <section className="rounded-lg border border-line p-3 text-sm">
        <span className="text-muted">For you: </span>
        {item.weight > 0 ? `${item.weight}% of your portfolio.` : "Not in your portfolio."}{" "}
        {e?.for_you
          ? e.for_you
          : cat && seen > 0 && since
            ? seen === 1
              ? `The only ${categoryLabel(cat).toLowerCase()} filing from ${item.company.nse_symbol} since ${since}.`
              : `${seen} ${categoryLabel(cat).toLowerCase()} filings from ${item.company.nse_symbol} since ${since}.`
            : null}
      </section>

      {/* 5. original filing */}
      {f?.pdf_url && (
        <a href={f.pdf_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-medium">
          <Doc className="h-4 w-4" /> Open the original filing
        </a>
      )}

      {/* 6. next steps */}
      <section>
        <h3 className="mb-2 font-serif text-[17px] tracking-[-0.01em] text-ink">Ask next</h3>
        <div className="flex flex-wrap gap-2">
          {questions.map((q) => (
            <button key={q} onClick={() => ask(q)} className="rounded-full border border-line px-3 py-1.5 text-xs hover:border-ink">
              {q}
            </button>
          ))}
          <Link href={`/research/${item.company.nse_symbol}`} className="rounded-full border border-line px-3 py-1.5 text-xs hover:border-ink">
            Promises vs delivery →
          </Link>
        </div>
      </section>
    </article>
  );
}

function CaughtUp({ upcoming, tier, onClose, list }: Props) {
  return (
    <div className="flex min-h-[60dvh] flex-col justify-center gap-4 text-center">
      <p className="font-serif text-3xl">You&apos;re caught up.</p>
      <p className="text-sm text-muted">
        {list.length} {TIER_LABEL[tier].toLowerCase()} item{list.length === 1 ? "" : "s"} reviewed.
      </p>
      {upcoming.length > 0 && (
        <p className="text-sm">
          Next: {upcoming.slice(0, 2).map((u) => `${shortName(u.name)} reports ${new Date(u.date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}`).join(", ")}.
        </p>
      )}
      <button onClick={onClose} className="mx-auto mt-2 rounded-full bg-ink px-5 py-2 text-sm text-bg">
        Back to today
      </button>
    </div>
  );
}

