import Link from "next/link";
import { AskScopeSetter } from "@/components/Ask";
import { Avatar, CountChip, MovePill } from "@/components/Badges";
import { Masthead } from "@/components/Masthead";
import { MiniSpark } from "@/components/Sparkline";
import { shortName } from "@/lib/format";
import { holdings } from "@/lib/queries";

export const dynamic = "force-dynamic";

// Brighter green/coral read better on the dark hero than the on-light tokens.
const UP_ON_DARK = "#5fd9a0";
const DOWN_ON_DARK = "#ff8a6b";
const CREAM = "#f6f0e4";

export default async function Portfolio() {
  const rows = await holdings();
  const day = rows.reduce((acc, r) => acc + (r.move ?? 0) * (r.weight / 100), 0);
  const dayUp = day >= 0;
  const up = rows.filter((r) => (r.move ?? 0) > 0.05).length;
  const down = rows.filter((r) => (r.move ?? 0) < -0.05).length;
  const needsTotal = rows.reduce((a, r) => a + r.needs, 0);
  const stats = [
    { value: up, label: "up", color: UP_ON_DARK },
    { value: down, label: "down", color: DOWN_ON_DARK },
    { value: needsTotal, label: needsTotal === 1 ? "needs you" : "need you", color: needsTotal ? DOWN_ON_DARK : CREAM },
  ];
  return (
    <>
      <AskScopeSetter scope={{ screen: "portfolio" }} />
      <Masthead title="Portfolio" sub={`${rows.length} holdings`} brand />
      <section className="hero rise mt-4 p-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: "rgba(246,240,228,0.72)" }}>
              Weighted day move
            </div>
            <p className="mt-1.5 text-[42px] font-semibold leading-none tracking-[-0.03em] tabular-nums" style={{ color: dayUp ? UP_ON_DARK : DOWN_ON_DARK }}>
              {day > 0 ? "+" : ""}
              {day.toFixed(2)}%
            </p>
          </div>
          <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: "rgba(246,240,228,0.12)", color: CREAM }}>
            Today
          </span>
        </div>
        <div className="mt-5 grid grid-cols-3 border-t pt-3.5" style={{ borderColor: "rgba(246,240,228,0.16)" }}>
          {stats.map((s, i) => (
            <div key={s.label} className={i > 0 ? "border-l pl-4" : ""} style={i > 0 ? { borderColor: "rgba(246,240,228,0.16)" } : undefined}>
              <div className="text-[22px] font-semibold leading-none tabular-nums" style={{ color: s.color }}>
                {s.value}
              </div>
              <div className="mt-1.5 text-[11.5px]" style={{ color: "rgba(246,240,228,0.72)" }}>
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
              className="card rise flex items-center gap-3 p-3 transition-transform active:scale-[0.99]"
              style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
            >
              <Avatar symbol={r.nse_symbol} name={r.name} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold">{shortName(r.name)}</span>
                <span className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
                  <span className="tabular-nums">{r.weight}%</span>
                  {r.needs > 0 ? (
                    <CountChip n={r.needs} label={r.needs === 1 ? "needs you" : "need you"} />
                  ) : r.worth > 0 ? (
                    <CountChip n={r.worth} label="worth knowing" tone="muted" />
                  ) : null}
                </span>
              </span>
              <span className="hidden w-[56px] shrink-0 sm:block">
                {r.spark.length > 1 && <MiniSpark values={r.spark} width={56} height={26} />}
              </span>
              <span className="flex w-[82px] shrink-0 flex-col items-end gap-1">
                <MovePill v={r.move} />
                <span className="text-[11px] tabular-nums text-muted">{r.close ? `₹${r.close.toLocaleString("en-IN")}` : ""}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-4 px-1 text-[11px] text-muted">Sorted by what needs you, then by the size of the day&apos;s move.</p>
    </>
  );
}
