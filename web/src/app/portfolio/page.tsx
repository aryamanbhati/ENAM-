import Link from "next/link";
import { AskScopeSetter } from "@/components/Ask";
import { Move } from "@/components/Badges";
import { Masthead } from "@/components/Masthead";
import { shortName } from "@/lib/format";
import { holdings } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Portfolio() {
  const rows = await holdings();
  const day = rows.reduce((acc, r) => acc + (r.move ?? 0) * (r.weight / 100), 0);
  const active = rows.filter((r) => r.needs + r.worth > 0).length;
  return (
    <>
      <AskScopeSetter scope={{ screen: "portfolio" }} />
      <Masthead title="Portfolio" sub={`${rows.length} holdings`} />
      <section className="pt-5">
        <p className="font-serif text-[26px] leading-tight">
          <Move v={day} className="font-serif" /> on the day, weighted.
        </p>
        <p className="mt-1 text-sm text-muted">
          {active} of {rows.length} holdings filed something worth reading this week.
        </p>
      </section>
      <ul className="mt-5 divide-y divide-line">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/company/${r.nse_symbol}`} className="flex items-center gap-3 py-3">
              <span className="flex w-3 justify-center" aria-hidden>
                {r.needs > 0 ? <span className="h-2 w-2 rounded-full bg-ink" /> : r.worth > 0 ? <span className="h-2 w-2 rounded-full border border-muted" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{shortName(r.name)}</span>
                <span className="block text-xs text-muted">
                  {r.nse_symbol} · {r.weight}%{r.needs > 0 ? ` · ${r.needs} need${r.needs === 1 ? "s" : ""} you` : r.worth > 0 ? ` · ${r.worth} worth knowing` : ""}
                </span>
              </span>
              <span className="text-right">
                <Move v={r.move} className="block text-sm" />
                <span className="block text-[11px] tabular-nums text-muted">{r.close ? `₹${r.close.toLocaleString("en-IN")}` : ""}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[11px] text-muted">
        Sorted by what needs you, then by size of the day&apos;s move. A filled dot means something needs you; an open dot means something worth knowing, in the last 7 days.
      </p>
    </>
  );
}
