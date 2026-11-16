import Link from "next/link";
import { AskScopeSetter } from "@/components/Ask";
import { Avatar, MovePill } from "@/components/Badges";
import { Masthead } from "@/components/Masthead";
import { MiniSpark } from "@/components/Sparkline";
import { Chevron } from "@/components/icons";
import { shortName } from "@/lib/format";
import { holdings } from "@/lib/queries";

export const dynamic = "force-dynamic";

const UP = "#34d399";
const DOWN = "#f87171";
const AMBER = "#fbbf24";
const CREAM = "rgba(246,240,228,";

/** Weighted, normalised portfolio index from each holding's spark, so the hero
 *  shows the portfolio's own trend (computed from real closes, nothing invented). */
function portfolioIndex(rows: { spark: number[]; weight: number }[]): number[] {
  const s = rows.filter((r) => r.spark.length > 1);
  if (!s.length) return [];
  const len = Math.min(...s.map((r) => r.spark.length));
  if (len < 2) return [];
  const out: number[] = [];
  for (let d = 0; d < len; d++) {
    let num = 0;
    let den = 0;
    for (const r of s) {
      const v = r.spark.slice(-len);
      num += r.weight * (v[d] / v[0]);
      den += r.weight;
    }
    out.push(den ? num / den : 1);
  }
  return out;
}

function AreaSpark({ values, up, height = 72 }: { values: number[]; up: boolean; height?: number }) {
  if (values.length < 2) return null;
  const w = 320;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const x = (i: number) => (i / (values.length - 1)) * w;
  const y = (v: number) => height - 6 - ((v - min) / (max - min || 1)) * (height - 14);
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const c = up ? UP : DOWN;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="pf-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c} stopOpacity="0.32" />
          <stop offset="1" stopColor={c} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${height} L0,${height} Z`} fill="url(#pf-area)" />
      <path d={line} fill="none" stroke={c} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default async function Portfolio() {
  const rows = await holdings();
  const day = rows.reduce((acc, r) => acc + (r.move ?? 0) * (r.weight / 100), 0);
  const dayUp = day >= 0;
  const up = rows.filter((r) => (r.move ?? 0) > 0.05).length;
  const down = rows.filter((r) => (r.move ?? 0) < -0.05).length;
  const needsTotal = rows.reduce((a, r) => a + r.needs, 0);
  const index = portfolioIndex(rows);
  const stats = [
    { value: up, label: "Advancing", color: UP },
    { value: down, label: "Declining", color: DOWN },
    { value: needsTotal, label: "Needs attention", color: needsTotal ? AMBER : `${CREAM}0.9)` },
  ];
  return (
    <>
      <AskScopeSetter scope={{ screen: "portfolio" }} />
      <Masthead title="Portfolio" sub={`${rows.length} holdings · your tracked universe`} brand />

      <section className="rise mt-2 overflow-hidden rounded-[24px] p-5 text-bg shadow-[0_20px_45px_-24px_rgba(14,17,23,0.55)]" style={{ background: "var(--obsidian)" }}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: `${CREAM}0.7)` }}>
              Weighted day move
            </div>
            <p className="mt-1.5 font-mono text-[40px] font-semibold leading-none tracking-[-0.02em]" style={{ color: dayUp ? UP : DOWN }}>
              {day > 0 ? "+" : ""}
              {day.toFixed(2)}%
            </p>
          </div>
          <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: `${CREAM}0.12)`, color: `${CREAM}0.95)` }}>
            Today
          </span>
        </div>

        {index.length > 1 && (
          <div className="mt-3">
            <AreaSpark values={index} up={dayUp} />
          </div>
        )}

        <div className="mt-3 grid grid-cols-3 border-t pt-3.5" style={{ borderColor: `${CREAM}0.16)` }}>
          {stats.map((s, i) => (
            <div key={s.label} className={i > 0 ? "border-l pl-4" : ""} style={i > 0 ? { borderColor: `${CREAM}0.16)` } : undefined}>
              <div className="font-mono text-[22px] font-semibold leading-none" style={{ color: s.color }}>
                {s.value}
              </div>
              <div className="mt-1.5 text-[11px]" style={{ color: `${CREAM}0.7)` }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      <ul className="mt-5 space-y-2">
        {rows.map((r, i) => (
          <li key={r.id}>
            <Link
              href={`/company/${r.nse_symbol}`}
              className="card tight rise flex items-center gap-3 transition-transform active:scale-[0.99]"
              style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
            >
              <Avatar symbol={r.nse_symbol} name={r.name} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold">{shortName(r.name)}</span>
                <span className="mt-0.5 flex items-center gap-1 text-[11px]">
                  <span className="font-mono text-muted">Alloc {r.weight}%</span>
                  {r.needs > 0 ? (
                    <>
                      <span className="text-faint">·</span>
                      <span className="font-medium text-accent-ink">{r.needs} need{r.needs === 1 ? "s" : ""} you</span>
                    </>
                  ) : r.worth > 0 ? (
                    <>
                      <span className="text-faint">·</span>
                      <span className="text-muted">{r.worth} worth knowing</span>
                    </>
                  ) : null}
                </span>
              </span>
              <span className="hidden w-[48px] shrink-0 sm:block">
                {r.spark.length > 1 && <MiniSpark values={r.spark} width={48} height={24} positive={(r.move ?? 0) >= 0} />}
              </span>
              <span className="flex w-[80px] shrink-0 flex-col items-end gap-1">
                <span className="font-mono text-[12.5px] font-medium text-ink">{r.close ? `₹${r.close.toLocaleString("en-IN")}` : ""}</span>
                <MovePill v={r.move} />
              </span>
              <Chevron className="h-4 w-4 shrink-0 text-faint" />
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-4 px-1 text-[11px] text-muted">Sorted by what needs you, then by the size of the day&apos;s move.</p>
    </>
  );
}
