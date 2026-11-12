"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { categoryLabel, cleanSubject, relTime, shortName, WINDOWS, type WindowKey } from "@/lib/format";
import type { Item, Tier } from "@/lib/types";
import { AskScopeSetter } from "./Ask";
import { Move } from "./Badges";
import { DetailStack } from "./DetailStack";
import { Chevron } from "./icons";

export type TodayProps = {
  items: Item[];
  win: WindowKey;
  failed: boolean;
  upcoming: { symbol: string; name: string; date: string }[];
  counts: Record<string, number>;
  historySince: string | null;
  series: Record<number, { date: string; close: number }[]>;
};

export function itemTitle(i: Item): string {
  if (i.kind === "signal") {
    const parts = [];
    if (i.move !== null) parts.push(`${i.move > 0 ? "Up" : "Down"} ${Math.abs(i.move).toFixed(1)}%`);
    if (i.volume !== null) parts.push(`${i.volume.toFixed(1)}× usual volume`);
    return parts.join(" on ");
  }
  const f = i.filing;
  return f.enrichment?.one_line || f.summary || cleanSubject(f.headline && f.headline.length > 12 ? f.headline : f.subject) || f.subcategory || "Filing";
}

export function itemKind(i: Item): string {
  return i.kind === "signal" ? "Market move" : categoryLabel(i.filing.finn_category);
}

export function TodayView(props: TodayProps) {
  const { items, win, failed, upcoming } = props;
  const tiers = useMemo(() => {
    const t: Record<Tier, Item[]> = { needs_you: [], worth_knowing: [], routine: [] };
    for (const i of items) t[i.tier].push(i);
    return t;
  }, [items]);
  const [open, setOpen] = useState<{ tier: Tier; index: number } | null>(null);
  const [showRoutine, setShowRoutine] = useState(false);

  // Deep links from notifications: /#filing:123 or /#signal:4:2026-11-12
  useEffect(() => {
    const key = decodeURIComponent(window.location.hash.slice(1));
    if (!key) return;
    for (const tier of ["needs_you", "worth_knowing", "routine"] as Tier[]) {
      const idx = tiers[tier].findIndex((i) => i.key === key);
      if (idx >= 0) return setOpen({ tier, index: idx });
    }
  }, [tiers]);

  const n = tiers.needs_you.length;
  const r = tiers.routine.length;
  const summary = n === 0 ? "Nothing needs you." : `${n} ${n === 1 ? "thing needs" : "things need"} you.`;
  const winLabel = win === "24h" ? "today" : `in the last ${win === "7d" ? "7 days" : "30 days"}`;

  return (
    <div className="pt-5">
      <AskScopeSetter scope={{ screen: "today", window: win }} />
      <section aria-live="polite">
        <p className="font-serif text-[28px] leading-tight">{summary}</p>
        <p className="mt-1 text-sm text-muted">
          {tiers.worth_knowing.length} worth knowing, {r} routine filing{r === 1 ? "" : "s"} hidden {winLabel}.
        </p>
        {failed && <p className="mt-2 text-sm text-partial">Filings may be delayed. Showing what we have.</p>}
      </section>

      <div className="mt-4 flex items-center justify-between">
        <div role="tablist" aria-label="Time window" className="inline-flex rounded-full border border-line p-0.5 text-xs">
          {(Object.keys(WINDOWS) as WindowKey[]).map((k) => (
            <Link key={k} href={k === "24h" ? "/" : `/?w=${k}`} role="tab" aria-selected={k === win} scroll={false} className={`rounded-full px-3 py-1 ${k === win ? "bg-ink text-bg" : "text-muted"}`}>
              {k}
            </Link>
          ))}
        </div>
        {n > 0 && (
          <button onClick={() => setOpen({ tier: "needs_you", index: 0 })} className="text-xs font-medium">
            Start briefing →
          </button>
        )}
      </div>

      {upcoming.length > 0 && (
        <p className="mt-4 text-sm text-muted">
          <span className="text-ink">Coming up: </span>
          {upcoming
            .slice(0, 3)
            .map((u) => `${shortName(u.name)} reports ${new Date(u.date).toLocaleDateString("en-IN", { weekday: "long", timeZone: "Asia/Kolkata" })}`)
            .join(". ")}
          .
        </p>
      )}

      <Section title="Needs you" count={n}>
        {n === 0 ? (
          <p className="py-3 text-sm text-muted">Nothing crossed your alerts {winLabel}.</p>
        ) : (
          tiers.needs_you.map((i, idx) => <NeedsCard key={i.key} item={i} onOpen={() => setOpen({ tier: "needs_you", index: idx })} />)
        )}
      </Section>

      <Section title="Worth knowing" count={tiers.worth_knowing.length}>
        {tiers.worth_knowing.map((i, idx) => (
          <Row key={i.key} item={i} onOpen={() => setOpen({ tier: "worth_knowing", index: idx })} />
        ))}
      </Section>

      <section className="mt-6 border-t border-line pt-3">
        <button onClick={() => setShowRoutine((v) => !v)} className="flex w-full items-center justify-between py-1 text-sm text-muted" aria-expanded={showRoutine}>
          <span>
            {r} routine filing{r === 1 ? "" : "s"} hidden
          </span>
          <Chevron className={`h-4 w-4 transition-transform ${showRoutine ? "rotate-90" : ""}`} />
        </button>
        {showRoutine && (
          <ul className="fade-in mt-1 divide-y divide-line">
            {tiers.routine.map((i) =>
              i.kind === "filing" ? (
                <li key={i.key} className="flex items-baseline justify-between gap-3 py-2 text-xs">
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{i.company.nse_symbol}</span> <span className="text-muted">{cleanSubject(i.filing.subcategory || i.filing.subject)}</span>
                  </span>
                  {i.filing.pdf_url && (
                    <a href={i.filing.pdf_url} target="_blank" rel="noreferrer" className="shrink-0 text-muted underline decoration-line underline-offset-2">
                      Filing
                    </a>
                  )}
                </li>
              ) : null,
            )}
          </ul>
        )}
      </section>

      {open && <DetailStack {...props} tier={open.tier} list={tiers[open.tier]} index={open.index} onIndex={(index) => setOpen({ ...open, index })} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-1 flex items-baseline gap-2 text-xs font-medium uppercase tracking-wide text-muted">
        {title} <span className="tabular-nums">{count}</span>
      </h2>
      <div className="divide-y divide-line">{children}</div>
    </section>
  );
}

function NeedsCard({ item, onOpen }: { item: Item; onOpen: () => void }) {
  const e = item.kind === "filing" ? item.filing.enrichment : null;
  return (
    <button onClick={onOpen} className="block w-full py-4 text-left">
      <div className="flex items-baseline justify-between gap-2 text-xs text-muted">
        <span>
          <span className="font-medium text-ink">{shortName(item.company.name)}</span> · {itemKind(item)}
        </span>
        <span className="shrink-0">{relTime(item.at)}</span>
      </div>
      <p className="mt-1 font-serif text-[19px] leading-snug">{itemTitle(item)}</p>
      {item.kind === "signal" && (
        <p className="mt-1 text-sm text-muted">{item.explainedBy ? `Explained by ${categoryLabel(item.explainedBy.finn_category).toLowerCase()} filed ${relTime(item.explainedBy.filed_at)}` : "No filing explains this move"}</p>
      )}
      {e?.kind === "results" && (
        <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
          {e.rows.map((r) => (
            <div key={r.metric}>
              <div className="text-muted">{r.metric}</div>
              <Move v={r.yoy} className="text-sm" /> <span className="text-[10px] text-muted">YoY</span>
            </div>
          ))}
        </div>
      )}
      {e?.kind === "management" && e.people[0] && (
        <p className="mt-1 text-sm text-muted">
          {e.people[0].name}, {e.people[0].role.toLowerCase()} ({e.people[0].change})
        </p>
      )}
      {item.kind === "filing" && !e && item.filing.reason && <p className="mt-1 text-xs text-muted">{item.filing.reason}</p>}
    </button>
  );
}

function Row({ item, onOpen }: { item: Item; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="flex w-full items-baseline gap-3 py-2.5 text-left">
      <span className="w-[4.5rem] shrink-0 truncate text-xs font-medium">{item.company.nse_symbol}</span>
      <span className="min-w-0 flex-1 truncate text-sm">{itemTitle(item)}</span>
      <span className="shrink-0 text-[11px] text-muted">{relTime(item.at)}</span>
    </button>
  );
}
