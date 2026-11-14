import type { CompanyMetrics } from "@/lib/queries";
import { crore, pct } from "@/lib/format";

/**
 * Three code-only metric blocks: a growth bar chart for revenue, a margin line
 * for operating margin, and a count of director/KMP changes in the last 12
 * months. Nothing here comes from an LLM; it all reads from `facts` and the
 * filings table. Placed above the promises on the research page so the first
 * thing a reader sees is numbers, not narrative.
 */
function periodKey(p: string): number {
  const m = p.match(/Q(\d) FY(\d\d)/);
  return m ? Number(m[2]) * 10 + Number(m[1]) : 0;
}

function series(facts: CompanyMetrics["facts"], metric: string) {
  const rows = facts
    .filter((f) => f.metric === metric)
    .slice()
    .sort((a, b) => periodKey(a.period) - periodKey(b.period))
    .slice(-8);
  return rows;
}

function yoy(rows: { period: string; value: number }[]): (number | null)[] {
  return rows.map((r, i) => (i >= 4 && rows[i - 4] && rows[i - 4].value ? ((r.value / rows[i - 4].value) - 1) * 100 : null));
}

export function MetricsPanel({ metrics }: { metrics: CompanyMetrics }) {
  const rev = series(metrics.facts, "revenue");
  const pat = series(metrics.facts, "pat");
  const opm = series(metrics.facts, "opm_pct");
  const revYoY = yoy(rev);
  const patYoY = yoy(pat);

  if (rev.length === 0 && opm.length === 0 && metrics.turnover.count === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-[20px] font-semibold tracking-[-0.015em] text-ink">The numbers</h2>

      {rev.length > 1 && (
        <div className="card">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Revenue, last {rev.length} quarters</p>
              <p className="mt-1 text-[22px] font-semibold tabular-nums tracking-[-0.02em] text-ink">
                {crore(rev[rev.length - 1].value)}
              </p>
            </div>
            <YoYBadge v={revYoY[revYoY.length - 1]} />
          </div>
          <GrowthBars rows={rev} yoy={revYoY} />
        </div>
      )}

      {pat.length > 1 && (
        <div className="card">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Net profit, last {pat.length} quarters</p>
              <p className="mt-1 text-[22px] font-semibold tabular-nums tracking-[-0.02em] text-ink">
                {crore(pat[pat.length - 1].value)}
              </p>
            </div>
            <YoYBadge v={patYoY[patYoY.length - 1]} />
          </div>
          <GrowthBars rows={pat} yoy={patYoY} />
        </div>
      )}

      {opm.length > 1 && (
        <div className="card">
          <div className="flex items-baseline justify-between">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Operating margin</p>
            <p className="text-[22px] font-semibold tabular-nums tracking-[-0.02em] text-ink">
              {opm[opm.length - 1].value.toFixed(1)}%
            </p>
          </div>
          <MarginLine rows={opm} />
        </div>
      )}

      {metrics.turnover.count > 0 && (
        <div className="card">
          <div className="flex items-baseline justify-between">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Director changes, last 12 months</p>
            <p className="text-[22px] font-semibold tabular-nums tracking-[-0.02em] text-ink">{metrics.turnover.count}</p>
          </div>
          {metrics.turnover.last.length > 0 && (
            <ul className="mt-3 space-y-2">
              {metrics.turnover.last.slice(0, 3).map((p, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="min-w-0 truncate">
                    <span className="font-medium text-ink">{p.name}</span>
                    <span className="ml-1 capitalize text-muted">{p.change}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-faint">
                    {new Date(p.at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function YoYBadge({ v }: { v: number | null }) {
  if (v === null) return <span className="text-[12px] text-faint">n/a YoY</span>;
  const up = v > 0;
  return (
    <span className={`chip ${up ? "bg-up-soft text-up" : "bg-down-soft text-down"}`}>
      <span className="chip-dot" style={{ background: "currentColor" }} />
      {pct(v)} YoY
    </span>
  );
}

function GrowthBars({ rows, yoy }: { rows: { period: string; value: number }[]; yoy: (number | null)[] }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="mt-4">
      <div className="flex h-24 items-end gap-2">
        {rows.map((r, i) => {
          const h = Math.max(4, (r.value / max) * 100);
          const y = yoy[i];
          const tone = y === null ? "bg-raised" : y > 0 ? "bg-up-soft" : "bg-down-soft";
          const bar = y === null ? "bg-line" : y > 0 ? "bg-up" : "bg-down";
          return (
            <div key={r.period} className="flex flex-1 flex-col items-center justify-end gap-1">
              <div className={`w-full rounded-t-md ${tone}`} style={{ height: "100%" }}>
                <div className={`mt-auto w-full rounded-t-md ${bar}`} style={{ height: `${h}%`, minHeight: 4 }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2 text-[10px] tabular-nums text-faint">
        {rows.map((r) => (
          <span key={r.period} className="flex-1 text-center">
            {r.period.replace(/^Q(\d) FY(\d\d)$/, "Q$1·$2")}
          </span>
        ))}
      </div>
    </div>
  );
}

function MarginLine({ rows }: { rows: { period: string; value: number }[] }) {
  const w = 320;
  const h = 72;
  const vals = rows.map((r) => r.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i: number) => (i / (rows.length - 1)) * w;
  const y = (v: number) => 8 + (1 - (v - min) / span) * (h - 16);
  const d = rows.map((r, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(r.value).toFixed(1)}`).join(" ");
  const up = vals[vals.length - 1] >= vals[0];
  const color = up ? "var(--up)" : "var(--down)";
  return (
    <div className="mt-4">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: h }} preserveAspectRatio="none" aria-label="Operating margin over recent quarters">
        <path d={`${d} L${w},${h} L0,${h} Z`} fill={color} fillOpacity="0.1" />
        <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {rows.map((r, i) => (
          <circle key={r.period} cx={x(i)} cy={y(r.value)} r={2.5} fill={color} />
        ))}
      </svg>
      <div className="mt-2 flex justify-between text-[10px] tabular-nums text-faint">
        <span>{rows[0].period}</span>
        <span>{min.toFixed(1)}% to {max.toFixed(1)}%</span>
        <span>{rows[rows.length - 1].period}</span>
      </div>
    </div>
  );
}
