"use client";
import { useState } from "react";
import type { CompanyMetrics } from "@/lib/queries";
import { crore, pct } from "@/lib/format";

/**
 * "The numbers": a compact, terminal-style block of code-only metrics. Nothing
 * here comes from an LLM; it all reads from the facts table and the filings.
 * A tight stat header, then revenue and net-profit trajectories as properly
 * scaled bar charts, an operating-margin line, and director turnover.
 */
function periodKey(p: string): number {
  const m = p.match(/Q(\d) FY(\d\d)/);
  return m ? Number(m[2]) * 10 + Number(m[1]) : 0;
}

const qLabel = (p: string) => p.replace(/^Q(\d) FY(\d\d)$/, "Q$1·$2");

function series(facts: CompanyMetrics["facts"], metric: string) {
  return facts
    .filter((f) => f.metric === metric)
    .slice()
    .sort((a, b) => periodKey(a.period) - periodKey(b.period))
    .slice(-8);
}

function latestYoY(rows: { value: number }[]): number | null {
  const n = rows.length;
  if (n < 5 || !rows[n - 5].value) return null;
  return (rows[n - 1].value / rows[n - 5].value - 1) * 100;
}

export function MetricsPanel({ metrics }: { metrics: CompanyMetrics }) {
  const rev = series(metrics.facts, "revenue");
  const pat = series(metrics.facts, "pat");
  const opm = series(metrics.facts, "opm_pct");

  if (rev.length < 2 && opm.length < 2 && metrics.turnover.count === 0) return null;

  const stats = [
    rev.length ? { label: "Revenue", value: crore(rev[rev.length - 1].value), yoy: latestYoY(rev) } : null,
    pat.length ? { label: "Net profit", value: crore(pat[pat.length - 1].value), yoy: latestYoY(pat) } : null,
    opm.length ? { label: "Op margin", value: `${opm[opm.length - 1].value.toFixed(1)}%`, yoy: null } : null,
  ].filter(Boolean) as { label: string; value: string; yoy: number | null }[];

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[20px] font-semibold tracking-[-0.015em] text-ink">The numbers</h2>
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Last 8 quarters</span>
      </div>

      {/* Stat header: tight, tabular, terminal-like */}
      <div className="grid grid-cols-3 overflow-hidden rounded-[14px] border border-line bg-surface">
        {stats.map((st, i) => (
          <div key={st.label} className={`px-3 py-3 ${i > 0 ? "border-l border-line" : ""}`}>
            <div className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted">{st.label}</div>
            <div className="mt-1 text-[17px] font-semibold tabular-nums tracking-[-0.02em] text-ink">{st.value}</div>
            {st.yoy !== null ? (
              <div className={`mt-0.5 text-[11px] font-medium tabular-nums ${st.yoy >= 0 ? "text-up" : "text-down"}`}>
                {pct(st.yoy)} YoY
              </div>
            ) : (
              <div className="mt-0.5 text-[11px] text-faint">latest</div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 space-y-3">
        {rev.length > 1 && <BarChart title="Revenue" rows={rev} unit="cr" />}
        {pat.length > 1 && <BarChart title="Net profit" rows={pat} unit="cr" />}
        {opm.length > 1 && <MarginChart rows={opm} />}

        {metrics.turnover.count > 0 && (
          <div className="rounded-[14px] border border-line bg-surface p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Director changes · 12 mo</span>
              <span className="text-[18px] font-semibold tabular-nums text-ink">{metrics.turnover.count}</span>
            </div>
            {metrics.turnover.last.length > 0 && (
              <ul className="mt-3 divide-y divide-line">
                {metrics.turnover.last.slice(0, 3).map((p, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-3 py-1.5 text-[13px]">
                    <span className="min-w-0 truncate">
                      <span className="font-medium text-ink">{p.name}</span>
                      <span className="ml-1.5 capitalize text-muted">{p.change}</span>
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-faint">
                      {new Date(p.at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Bar chart with an honest-but-readable scale: the baseline sits just below the
 * smallest bar so the quarter-to-quarter trend is visible (a zero baseline
 * flattens a stable series into eight near-equal bars). The value range is
 * labelled so the baseline is never misread. The latest bar is highlighted.
 */
function BarChart({ title, rows, unit }: { title: string; rows: { period: string; value: number }[]; unit: string }) {
  const [active, setActive] = useState<number | null>(null);
  const vals = rows.map((r) => r.value);
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const base = Math.max(0, min - (max - min) * 0.35);
  const span = max - base || 1;
  const first = rows[0].value;
  const last = rows[rows.length - 1].value;
  const trendUp = last >= first;
  // What the header figure shows: the tapped bar if any, else the latest.
  const shown = active !== null ? rows[active] : rows[rows.length - 1];

  return (
    <div className="rounded-[14px] border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">{title}</span>
        <span className="text-[16px] font-semibold tabular-nums tracking-[-0.02em] text-ink">
          <span className="mr-1.5 text-[11px] font-medium text-muted">{active !== null ? qLabel(shown.period) : "latest"}</span>
          ₹{Math.round(shown.value).toLocaleString("en-IN")} {unit}
        </span>
      </div>
      <div className="relative mt-3 flex h-24 items-end gap-[6px]">
        {/* baseline rule */}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-line" />
        {rows.map((r, i) => {
          const h = ((r.value - base) / span) * 100;
          const latest = i === rows.length - 1;
          const on = active === i;
          return (
            <button
              type="button"
              key={r.period}
              onClick={() => setActive((a) => (a === i ? null : i))}
              aria-label={`${r.period}: ${Math.round(r.value).toLocaleString("en-IN")} ${unit}`}
              className="group relative flex h-full flex-1 cursor-pointer flex-col justify-end border-0 bg-transparent p-0"
            >
              <span
                className={`pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] font-medium text-bg shadow transition-opacity group-hover:opacity-100 ${on ? "opacity-100" : "opacity-0"}`}
              >
                {qLabel(r.period)} · ₹{Math.round(r.value).toLocaleString("en-IN")} {unit}
              </span>
              <span
                className={`w-full rounded-[3px] transition-opacity group-hover:opacity-80 ${on ? "opacity-80 ring-2 ring-ink/20" : ""} ${latest ? (trendUp ? "bg-up" : "bg-down") : "bg-brand/25"}`}
                style={{ height: `${Math.max(h, 4)}%` }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex gap-[6px]">
        {rows.map((r, i) => (
          <span
            key={r.period}
            className={`flex-1 text-center text-[9.5px] tabular-nums ${i === rows.length - 1 ? "font-semibold text-muted" : "text-faint"}`}
          >
            {qLabel(r.period)}
          </span>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] tabular-nums text-faint">
        <span>low ₹{Math.round(min).toLocaleString("en-IN")}</span>
        <span>high ₹{Math.round(max).toLocaleString("en-IN")}</span>
      </div>
    </div>
  );
}

function MarginChart({ rows }: { rows: { period: string; value: number }[] }) {
  const w = 300;
  const h = 72;
  const vals = rows.map((r) => r.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const pad = (max - min) * 0.2 || 1;
  const lo = min - pad;
  const span = max - lo || 1;
  const x = (i: number) => (i / (rows.length - 1)) * w;
  const y = (v: number) => 6 + (1 - (v - lo) / span) * (h - 12);
  const d = rows.map((r, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(r.value).toFixed(1)}`).join(" ");
  const up = vals[vals.length - 1] >= vals[0];
  const color = up ? "var(--up)" : "var(--down)";
  const last = rows[rows.length - 1];

  return (
    <div className="rounded-[14px] border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Operating margin</span>
        <span className="text-[16px] font-semibold tabular-nums tracking-[-0.02em] text-ink">{last.value.toFixed(1)}%</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 w-full" style={{ height: h }} preserveAspectRatio="none" aria-label="Operating margin trend">
        <path d={`${d} L${w},${h} L0,${h} Z`} fill={color} fillOpacity="0.08" />
        <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <circle cx={x(rows.length - 1)} cy={y(last.value)} r={3} fill={color} stroke="var(--surface)" strokeWidth={2} />
      </svg>
      <div className="mt-2 flex justify-between text-[10px] tabular-nums text-faint">
        <span>{qLabel(rows[0].period)} · {min.toFixed(1)}%</span>
        <span>{qLabel(last.period)} · {max.toFixed(1)}% high</span>
      </div>
    </div>
  );
}
