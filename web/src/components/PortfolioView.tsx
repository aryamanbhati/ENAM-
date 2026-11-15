"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar, MovePill } from "@/components/Badges";
import { MiniSpark } from "@/components/Sparkline";
import { shortName } from "@/lib/format";

type Holding = {
  id: number;
  nse_symbol: string;
  name: string;
  sector: string | null;
  weight: number;
  close: number | null;
  move: number | null;
  volMult: number | null;
  spark: number[];
  needs: number;
  worth: number;
};

type Filter = "all" | "needs" | "worth" | "gainers" | "losers";
type Sort = "priority" | "weight" | "gainers" | "losers" | "price";

export function PortfolioView({ rows, dayMove }: { rows: Holding[]; dayMove: number }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("priority");

  const counts = useMemo(() => ({
    all: rows.length,
    needs: rows.filter((r) => r.needs > 0).length,
    worth: rows.filter((r) => r.worth > 0).length,
    gainers: rows.filter((r) => (r.move ?? 0) > 0.05).length,
    losers: rows.filter((r) => (r.move ?? 0) < -0.05).length,
  }), [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const selected = rows.filter((r) => {
      const matchesQuery = !q || r.nse_symbol.toLowerCase().includes(q) || r.name.toLowerCase().includes(q);
      const matchesFilter =
        filter === "all" ||
        (filter === "needs" && r.needs > 0) ||
        (filter === "worth" && r.worth > 0) ||
        (filter === "gainers" && (r.move ?? 0) > 0.05) ||
        (filter === "losers" && (r.move ?? 0) < -0.05);
      return matchesQuery && matchesFilter;
    });
    return selected.sort((a, b) => {
      if (sort === "weight") return b.weight - a.weight;
      if (sort === "gainers") return (b.move ?? -Infinity) - (a.move ?? -Infinity);
      if (sort === "losers") return (a.move ?? Infinity) - (b.move ?? Infinity);
      if (sort === "price") return (b.close ?? 0) - (a.close ?? 0);
      return b.needs - a.needs || Math.abs(b.move ?? 0) - Math.abs(a.move ?? 0);
    });
  }, [rows, filter, query, sort]);

  const advancing = rows.filter((r) => (r.move ?? 0) > 0.05).length;
  const declining = rows.filter((r) => (r.move ?? 0) < -0.05).length;
  const breadthTotal = advancing + declining;
  const filters: { key: Filter; label: string; tone: string }[] = [
    { key: "all", label: "All", tone: "text-ink" },
    { key: "needs", label: "Needs you", tone: "text-amber-ink" },
    { key: "worth", label: "Worth knowing", tone: "text-ink" },
    { key: "gainers", label: "Gainers", tone: "text-up" },
    { key: "losers", label: "Losers", tone: "text-down" },
  ];

  return (
    <div className="space-y-4">
      <section className="portfolio-hero rise p-5 text-white" aria-label="Portfolio performance summary">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-white/60">Weighted day move</p>
            <p className={`mt-2 font-display text-[40px] font-bold leading-none tracking-[-0.04em] tabular-nums ${dayMove >= 0 ? "text-mint" : "text-coral"}`}>
              {dayMove > 0 ? "+" : ""}{dayMove.toFixed(2)}%
            </p>
            <p className="mt-2 text-[11px] text-white/60">Weighted by portfolio allocation · latest available close</p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.07] px-2.5 py-1 text-[10px] font-semibold text-white/75">Daily</span>
        </div>
        <div className="mt-5">
          <div className="mb-1.5 flex justify-between text-[10px] font-medium text-white/60">
            <span>Market breadth</span>
            <span className="tabular-nums">{advancing} advancing · {declining} declining</span>
          </div>
          <div className="flex h-2 gap-[3px] overflow-hidden rounded-full bg-white/10 p-[1px]">
            <span className="rounded-full bg-mint" style={{ width: `${breadthTotal ? advancing / breadthTotal * 100 : 0}%` }} />
            <span className="rounded-full bg-coral" style={{ width: `${breadthTotal ? declining / breadthTotal * 100 : 0}%` }} />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 border-t border-white/10 pt-3.5">
          <div>
            <p className="font-display text-[23px] font-bold tabular-nums text-mint">{advancing}</p>
            <p className="text-[11px] text-white/60">Advancing</p>
          </div>
          <div className="border-l border-white/10 pl-4">
            <p className="font-display text-[23px] font-bold tabular-nums text-coral">{declining}</p>
            <p className="text-[11px] text-white/60">Declining</p>
          </div>
          <div className="border-l border-white/10 pl-4">
            <p className="font-display text-[23px] font-bold tabular-nums text-amber">{rows.reduce((sum, r) => sum + r.needs, 0)}</p>
            <p className="text-[11px] text-white/60">Needs attention</p>
          </div>
        </div>
      </section>

      <section aria-label="Filter and search holdings" className="space-y-3">
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {filters.map((item) => (
            <button
              key={item.key}
              onClick={() => setFilter(item.key)}
              aria-pressed={filter === item.key}
              className={`shrink-0 rounded-full border px-3 py-2 text-[11px] font-semibold transition-colors ${filter === item.key ? "border-ink bg-ink text-bg" : "border-line bg-surface " + item.tone}`}
            >
              {item.label} <span className="ml-0.5 tabular-nums opacity-70">{counts[item.key]}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search holdings</span>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search ticker or company" className="h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-[12px] text-ink outline-none placeholder:text-faint focus:border-ink/40" />
          </label>
          <label className="sr-only" htmlFor="portfolio-sort">Sort holdings</label>
          <select id="portfolio-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-10 max-w-[132px] rounded-xl border border-line bg-surface px-2 text-[11px] font-semibold text-ink outline-none">
            <option value="priority">Priority</option>
            <option value="weight">Weight: high</option>
            <option value="gainers">Top gainers</option>
            <option value="losers">Top losers</option>
            <option value="price">Price: high</option>
          </select>
        </div>
      </section>

      <section aria-label="Portfolio holdings">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Holdings</span>
          <span className="text-[10px] text-faint">{visible.length} of {rows.length} shown</span>
        </div>
        <div className="overflow-hidden rounded-[22px] border border-line bg-surface shadow-[var(--shadow-soft)]">
          {visible.length ? visible.map((r, i) => (
            <Link key={r.id} href={`/company/${r.nse_symbol}`} className="group flex items-center gap-3 border-b border-line/70 px-3 py-3.5 last:border-0 transition-colors hover:bg-raised/60 active:bg-raised">
              <Avatar symbol={r.nse_symbol} name={r.name} size={39} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[13px] font-semibold text-ink">{shortName(r.name)}</span>
                  {r.needs > 0 && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber" aria-label="Needs attention" />}
                </span>
                <span className="mt-1 flex items-center gap-1.5 text-[10px] text-muted">
                  <span>{r.nse_symbol}</span><span className="text-faint">·</span><span className="tabular-nums">{r.weight.toFixed(1)}% allocation</span>
                </span>
                <span className="mt-1.5 block h-1 max-w-[150px] overflow-hidden rounded-full bg-raised">
                  <span className="block h-full rounded-full bg-ink/65" style={{ width: `${Math.max(0, Math.min(r.weight, 100))}%` }} />
                </span>
              </span>
              <span className="hidden shrink-0 sm:block">
                {r.spark.length > 1 && <MiniSpark values={r.spark} width={58} height={25} positive={(r.move ?? 0) >= 0} />}
              </span>
              <span className="flex w-[76px] shrink-0 flex-col items-end gap-1">
                <MovePill v={r.move} />
                <span className="text-[10px] tabular-nums text-muted">{r.close ? `₹${r.close.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "—"}</span>
                {r.needs > 0 ? <span className="text-[9px] font-semibold text-amber-ink">{r.needs} needs you</span> : r.worth > 0 ? <span className="text-[9px] text-muted">{r.worth} worth knowing</span> : <span className="text-[9px] text-faint">No alerts</span>}
              </span>
            </Link>
          )) : (
            <p className="px-4 py-10 text-center text-[13px] text-muted">No holdings match this search and filter.</p>
          )}
        </div>
      </section>
      <p className="px-1 text-[10px] leading-relaxed text-faint">Price and move data reflect the latest available market close. Allocation percentages come from the configured portfolio weights; they are not live position valuations.</p>
    </div>
  );
}
