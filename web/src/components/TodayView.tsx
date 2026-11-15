"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { categoryLabel, cleanSubject, naturalTitle, relTime, shortName, stripLeadingCompany, type WindowKey } from "@/lib/format";
import type { Item, Tier } from "@/lib/types";
import { AskScopeSetter } from "./Ask";
import { Avatar, CatChip, MovePill, SectionTitle } from "./Badges";
import { DetailStack } from "./DetailStack";
import { Calendar, Chevron } from "./icons";
import { ListenBriefing } from "./ListenBriefing";
import { MiniSpark } from "./Sparkline";

export type TodayProps = {
  items: Item[];
  win: WindowKey | "custom";
  range?: { from: string; to: string };
  failed: boolean;
  upcoming: { symbol: string; name: string; date: string }[];
  counts: Record<string, number>;
  historySince: string | null;
  series: Record<number, { date: string; close: number }[]>;
};

export function itemTitle(i: Item): string {
  if (i.kind === "signal") {
    const name = shortName(i.company.name);
    const parts: string[] = [];
    if (i.move !== null) parts.push(`${i.move > 0 ? "up" : "down"} ${Math.abs(i.move).toFixed(1)}%`);
    if (i.volume !== null) parts.push(`${i.volume.toFixed(1)}× its usual volume`);
    return `${name} ${parts.join(" on ")}`;
  }
  const f = i.filing;
  const raw = f.enrichment?.one_line || f.summary || (f.headline && f.headline.length > 12 ? f.headline : f.subject) || f.subcategory || "Filing";
  return naturalTitle(raw, i.company.name);
}

export function itemKind(i: Item): string {
  return i.kind === "signal" ? "Market move" : categoryLabel(i.filing.finn_category);
}

export function itemCategory(i: Item): string | null {
  return i.kind === "signal" ? "market" : i.filing.finn_category;
}

const fmtDay = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export function TodayView(props: TodayProps) {
  const { items, win, range, failed, upcoming } = props;
  const tiers = useMemo(() => {
    const t: Record<Tier, Item[]> = { needs_you: [], worth_knowing: [], routine: [] };
    // De-duplicate: the same corporate event often arrives as several filings on
    // the same day (e.g. a quarter's results as a revenue filing + a results
    // filing). Collapse those into the first (newest, richest) card per
    // company+category+day so the feed does not show the same news three times.
    const seen = new Set<string>();
    for (const i of items) {
      const cat = i.kind === "signal" ? "signal" : i.filing.finn_category ?? "x";
      const day = i.at.slice(0, 10);
      const dedupeKey = `${i.company.id}:${cat}:${day}`;
      if (i.kind === "filing" && seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      t[i.tier].push(i);
    }
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
  const wk = tiers.worth_knowing.length;
  const r = tiers.routine.length;
  const total = items.length;
  const winLabel = win === "custom" && range ? `${fmtDay(range.from)} to ${fmtDay(range.to)}` : win === "24h" ? "last 24 hours" : win === "7d" ? "last 7 days" : "last 30 days";

  // Triage promise: the hero number must stay small and urgent. On wider windows
  // the headline shows only what needs you in the last 24 hours; everything older
  // in the window becomes a calm "+N earlier" line, not a 104-sized alarm.
  const DAY = 864e5;
  const cutoff = Date.now() - DAY;
  const freshNeeds = win === "24h" ? n : tiers.needs_you.filter((i) => new Date(i.at).getTime() >= cutoff).length;
  const olderNeeds = n - freshNeeds;
  const heroCount = win === "24h" ? n : freshNeeds;
  const heroVerb = heroCount === 1 ? "thing needs" : "things need";
  const windowNoun = win === "7d" ? "this week" : win === "30d" ? "this month" : win === "custom" ? "in this range" : "today";

  const summary =
    heroCount === 0
      ? olderNeeds > 0
        ? `Nothing new today. ${olderNeeds} still need you ${windowNoun}.`
        : "Nothing needs you."
      : `${heroCount} ${heroVerb} you ${windowNoun}.`;
  const seg = (k: number) => `${total ? Math.max((k / total) * 100, k ? 4 : 0) : 0}%`;

  return (
    <div className="space-y-5 pt-4">
      <AskScopeSetter scope={{ screen: "today", window: win }} />

      {/* Hero: the count is the headline. Coral is reserved for it and the one action. */}
      <section className="hero rise p-5" aria-live="polite">
        <div className="flex justify-end">
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium opacity-80">{winLabel}</span>
        </div>
        {heroCount === 0 ? (
          <p className="mt-3 text-[40px] font-semibold leading-[1.05] tracking-[-0.03em]">
            {olderNeeds > 0 ? "Nothing new today." : "You're clear."}
          </p>
        ) : (
          <p className="mt-1 text-[38px] font-semibold leading-[1.05] tracking-[-0.03em]">
            <span className="count-in text-[64px] font-semibold leading-none" style={{ color: "var(--accent)" }}>
              {heroCount}
            </span>{" "}
            {heroVerb} you <span className="opacity-80">{windowNoun}</span>.
          </p>
        )}
        <p className="mt-3 text-[13px] opacity-80">
          {olderNeeds > 0 && (
            <>
              <b className="font-semibold">+{olderNeeds}</b> earlier {windowNoun}.{" "}
            </>
          )}
          {total} item{total === 1 ? "" : "s"} read, {r} routine hidden.
        </p>

        {total > 0 && (
          <div className="mt-4">
            <div className="flex h-[6px] gap-1 overflow-hidden rounded-full">
              <span className="grow-x rounded-full" style={{ width: seg(n), background: "var(--accent)" }} />
              <span className="grow-x rounded-full" style={{ width: seg(wk), animationDelay: "80ms", background: "color-mix(in srgb, var(--bg) 60%, transparent)" }} />
              <span className="grow-x flex-1 rounded-full" style={{ animationDelay: "160ms", background: "color-mix(in srgb, var(--bg) 22%, transparent)" }} />
            </div>
            <div className="mt-2 flex justify-between text-[10.5px] tabular-nums opacity-80">
              <span>
                <b className="font-semibold">{n}</b> need you
              </span>
              <span>
                <b className="font-semibold">{wk}</b> worth knowing
              </span>
              <span>
                <b className="font-semibold">{r}</b> routine
              </span>
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center gap-2">
          {n > 0 && (
            <button
              onClick={() => setOpen({ tier: "needs_you", index: 0 })}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-bg px-5 text-[14px] font-semibold text-ink transition-transform active:scale-[0.98]"
            >
              Start briefing →
            </button>
          )}
          <ListenBriefing
            lines={[
              summary,
              ...tiers.needs_you.slice(0, 6).map((i) => `${shortName(i.company.name)}: ${itemTitle(i)}`),
              wk ? `Plus ${wk} items worth knowing.` : "",
            ].filter(Boolean)}
          />
        </div>
      </section>

      {failed && <p className="rounded-2xl bg-partial-soft px-4 py-3 text-sm text-partial">Filings may be delayed. Showing what we have.</p>}

      <WindowPicker win={win} range={range} />

      {upcoming.length > 0 && (
        <section>
          <SectionTitle>Coming up</SectionTitle>
          <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
            {upcoming.map((u) => {
              const d = new Date(u.date);
              return (
                <Link key={u.symbol + u.date} href={`/company/${u.symbol}`} className="card flex shrink-0 items-center gap-3 !rounded-2xl px-3 py-2.5">
                  <span className="flex h-11 w-11 flex-col items-center justify-center rounded-xl bg-brand-soft leading-none text-brand">
                    <span className="text-[10px] font-semibold uppercase">{d.toLocaleDateString("en-IN", { month: "short" })}</span>
                    <span className="text-base font-semibold tabular-nums">{d.getDate()}</span>
                  </span>
                  <span>
                    <span className="block text-[13px] font-semibold">{shortName(u.name)}</span>
                    <span className="block text-[11px] text-muted">Results, {d.toLocaleDateString("en-IN", { weekday: "long" })}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section id="needs-section" className="scroll-mt-4">
        <SectionTitle count={n}>Needs you</SectionTitle>
        {n === 0 ? (
          <div className="card px-4 py-6 text-center text-sm text-muted">Nothing crossed your alerts in the {winLabel}.</div>
        ) : (
          <div className="space-y-3">
            {tiers.needs_you.map((i, idx) => (
              <NeedsCard key={i.key} item={i} delay={Math.min(idx, 6) * 45} spark={props.series[i.company.id]} onOpen={() => setOpen({ tier: "needs_you", index: idx })} />
            ))}
          </div>
        )}
      </section>

      {wk > 0 && (
        <section>
          <SectionTitle count={wk}>Worth knowing</SectionTitle>
          <div className="card divide-y divide-line overflow-hidden">
            {tiers.worth_knowing.map((i, idx) => (
              <button key={i.key} onClick={() => setOpen({ tier: "worth_knowing", index: idx })} className="flex w-full items-center gap-3 px-3.5 py-3 text-left active:bg-raised">
                <Avatar symbol={i.company.nse_symbol} name={i.company.name} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="clamp-2 block text-[14px] font-medium leading-snug">{itemTitle(i)}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
                    {i.company.nse_symbol}
                    <span className="text-faint">·</span>
                    {itemKind(i)}
                    <span className="text-faint">·</span>
                    {relTime(i.at)}
                  </span>
                </span>
                <Chevron className="h-4 w-4 shrink-0 text-faint" />
              </button>
            ))}
          </div>
        </section>
      )}

      <section id="routine-section" className="scroll-mt-4">
        <button onClick={() => setShowRoutine((v) => !v)} className="flex w-full items-center justify-between rounded-2xl border border-dashed border-line px-4 py-3 text-sm text-muted" aria-expanded={showRoutine}>
          <span>
            <b className="font-semibold tabular-nums text-ink">{r}</b> routine filing{r === 1 ? "" : "s"} hidden
          </span>
          <Chevron className={`h-4 w-4 transition-transform ${showRoutine ? "rotate-90" : ""}`} />
        </button>
        {showRoutine && (
          <ul className="fade-in mt-2 divide-y divide-line px-1">
            {tiers.routine.map((i) =>
              i.kind === "filing" ? (
                <li key={i.key} className="flex items-baseline justify-between gap-3 py-2 text-xs">
                  <span className="min-w-0 truncate">
                    <span className="font-semibold">{i.company.nse_symbol}</span> <span className="text-muted">{cleanSubject(i.filing.subcategory || i.filing.subject)}</span>
                  </span>
                  {i.filing.pdf_url && (
                    <a href={i.filing.pdf_url} target="_blank" rel="noreferrer" className="shrink-0 font-medium text-brand">
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

function WindowPicker({ win, range }: { win: WindowKey | "custom"; range?: { from: string; to: string } }) {
  const router = useRouter();
  const [custom, setCustom] = useState(win === "custom");
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(range?.from ?? new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10));
  const [to, setTo] = useState(range?.to ?? today);
  const tabs: Array<{ key: WindowKey | "custom"; label: string; href?: string; icon?: boolean }> = [
    { key: "24h", label: "24h", href: "/?w=24h" },
    { key: "7d", label: "7d", href: "/" },
    { key: "30d", label: "30d", href: "/?w=30d" },
    { key: "custom", label: "Custom", icon: true },
  ];
  const activeIndex = tabs.findIndex((t) => t.key === win);
  return (
    <div>
      <div role="tablist" aria-label="Time window" className="card relative flex !rounded-full p-1 text-[13px] font-medium">
        <span
          aria-hidden
          className="absolute top-1 bottom-1 rounded-full bg-ink transition-all"
          style={{
            left: `calc(${(activeIndex / tabs.length) * 100}% + 4px)`,
            width: `calc(${100 / tabs.length}% - 8px)`,
            transitionDuration: "var(--d-base)",
            transitionTimingFunction: "var(--e-std)",
          }}
        />
        {tabs.map((t) =>
          t.href ? (
            <Link
              key={t.key}
              href={t.href}
              role="tab"
              aria-selected={t.key === win}
              scroll={false}
              className={`relative z-[1] flex min-h-[40px] flex-1 items-center justify-center rounded-full text-center transition-colors ${t.key === win ? "text-bg" : "text-muted hover:text-ink"}`}
            >
              {t.label}
            </Link>
          ) : (
            <button
              key={t.key}
              role="tab"
              aria-selected={win === "custom"}
              onClick={() => setCustom((c) => !c)}
              className={`relative z-[1] flex min-h-[40px] flex-1 items-center justify-center gap-1 rounded-full transition-colors ${win === "custom" ? "text-bg" : custom ? "text-brand" : "text-muted hover:text-ink"}`}
            >
              <Calendar className="h-3.5 w-3.5" /> {t.label}
            </button>
          ),
        )}
      </div>
      {custom && (
        <form
          className="fade-in card mt-2 flex items-end gap-2 !rounded-2xl p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (from && to && from <= to) router.push(`/?from=${from}&to=${to}`, { scroll: false });
          }}
        >
          <label className="flex-1 text-[11px] text-muted">
            From
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="mt-1 block w-full rounded-lg border border-line bg-raised px-2 py-1.5 text-[13px] text-ink" />
          </label>
          <label className="flex-1 text-[11px] text-muted">
            To
            <input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} className="mt-1 block w-full rounded-lg border border-line bg-raised px-2 py-1.5 text-[13px] text-ink" />
          </label>
          <button className="rounded-lg bg-brand px-3 py-2 text-[13px] font-semibold text-bg">Apply</button>
        </form>
      )}
    </div>
  );
}

function NeedsCard({ item, onOpen, delay, spark }: { item: Item; onOpen: () => void; delay: number; spark?: { date: string; close: number }[] }) {
  const e = item.kind === "filing" ? item.filing.enrichment : null;
  return (
    <button
      onClick={onOpen}
      className="card rise block w-full p-4 text-left transition-transform active:scale-[0.99]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-3">
        <Avatar symbol={item.company.nse_symbol} name={item.company.name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13.5px] font-semibold">{shortName(item.company.name)}</span>
            <span className="shrink-0 text-[11px] text-faint">{relTime(item.at)}</span>
          </div>
          <div className="mt-1">
            <CatChip category={itemCategory(item)} label={itemKind(item)} />
          </div>
        </div>
        {item.kind === "signal" && item.move !== null && <MovePill v={item.move} />}
      </div>

      <p className="clamp-2 mt-3 text-[18px] font-semibold leading-[1.3] tracking-[-0.01em] text-ink">
        {stripLeadingCompany(itemTitle(item), item.company.name)}
      </p>

      {item.kind === "signal" && (
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-raised px-3 py-2.5">
          {spark && <MiniSpark values={spark.map((p) => p.close)} width={72} height={28} positive={(item.move ?? 0) >= 0} /> }
          <p className={`text-[13px] ${item.explainedBy ? "text-muted" : "font-medium text-partial"}`}>
            {item.explainedBy ? `Explained by ${categoryLabel(item.explainedBy.finn_category).toLowerCase()} filed ${relTime(item.explainedBy.filed_at)}` : "No filing explains this move"}
          </p>
        </div>
      )}

      {e?.kind === "results" && (
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {e.rows.map((r) => {
            const up = (r.yoy ?? 0) > 0.05;
            const down = (r.yoy ?? 0) < -0.05;
            return (
              <div key={r.metric} className={`rounded-xl px-2 py-2 ${r.yoy === null ? "bg-early-soft" : up ? "bg-up-soft" : down ? "bg-down-soft" : "bg-early-soft"}`}>
                <div className="text-[10px] font-medium text-muted">{r.metric}</div>
                <div className={`text-[15px] font-semibold tabular-nums ${r.yoy === null ? "text-early" : up ? "text-up" : down ? "text-down" : "text-early"}`}>
                  {r.yoy === null ? "n/a" : `${r.yoy > 0 ? "+" : ""}${r.yoy.toFixed(1)}%`}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-faint">YoY</div>
              </div>
            );
          })}
        </div>
      )}

      {e?.kind === "management" && e.people[0] && (
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-raised px-3 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-[12px] font-semibold" style={{ color: "#f6f0e4" }}>
            {e.people[0].name
              .replace(/^(Mr|Mrs|Ms|Dr|Shri|Smt)\.?\s+/i, "")
              .split(/\s+/)
              .slice(0, 2)
              .map((w) => w[0])
              .join("")}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold">{e.people[0].name}</span>
            <span className="block truncate text-[11px] capitalize text-muted">
              {e.people[0].change} · <span className="normal-case">{e.people[0].role}</span>
            </span>
          </span>
        </div>
      )}

      {item.kind === "filing" && !e && item.filing.reason && <p className="mt-2 text-xs text-muted">{item.filing.reason}</p>}
    </button>
  );
}
