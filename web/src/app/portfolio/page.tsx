import Link from "next/link";
import { AskScopeSetter } from "@/components/Ask";
import { Avatar, CountChip, MovePill } from "@/components/Badges";
import { Masthead } from "@/components/Masthead";
import { MiniSpark } from "@/components/Sparkline";
import { shortName } from "@/lib/format";
import { holdings } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Portfolio() {
  const rows = await holdings();
  const day = rows.reduce((acc, r) => acc + (r.move ?? 0) * (r.weight / 100), 0);
  const active = rows.filter((r) => r.needs + r.worth > 0).length;
  const dayUp = day >= 0;
  return (
    <>
      <AskScopeSetter scope={{ screen: "portfolio" }} />
      <Masthead title="Portfolio" sub={`${rows.length} holdings`} brand />
      <section className="hero rise mt-4 p-5">
        <div className="text-[10.5px] font-medium uppercase tracking-[0.18em] opacity-70">Weighted day move</div>
        <p className="mt-2 font-serif text-[40px] leading-none tracking-tight" style={{ color: dayUp ? "var(--up)" : "var(--accent)" }}>
          {day > 0 ? "+" : ""}
          {day.toFixed(2)}%
        </p>
        <p className="mt-3 text-[13px] opacity-80">
          {active} of {rows.length} holdings filed something worth reading this week.
        </p>
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
      <p className="mt-4 px-1 text-[11px] text-muted">Sorted by what needs you, then by the size of the day&apos;s move. The coral dot marks a holding with something that needs you this week.</p>
    </>
  );
}
