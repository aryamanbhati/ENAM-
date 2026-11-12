import Link from "next/link";
import { AskScopeSetter } from "@/components/Ask";
import { Masthead } from "@/components/Masthead";
import { TickerSearch } from "@/components/TickerSearch";
import { keptLine, shortName } from "@/lib/format";
import { researchedCompanies } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ResearchIndex() {
  const rows = await researchedCompanies();
  return (
    <>
      <AskScopeSetter scope={{ screen: "portfolio" }} />
      <Masthead title="Research" />
      <section className="pt-5">
        <p className="font-serif text-[26px] leading-tight">What management promised, and what they delivered.</p>
        <p className="mt-2 text-sm text-muted">
          Built only from the company&apos;s own concall transcripts and quarterly results. Every quote is checked against its page; every number is computed, not generated.
        </p>
        <div className="mt-4">
          <TickerSearch />
        </div>
      </section>
      <ul className="mt-6 divide-y divide-line">
        {rows.map(({ company, research: r }) => (
          <li key={company.id}>
            <Link href={`/research/${company.nse_symbol}`} className="flex items-baseline justify-between gap-3 py-3">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{shortName(company.name)}</span>
                <span className="text-xs text-muted">{company.nse_symbol}</span>
              </span>
              <span className="shrink-0 text-right text-xs text-muted">
                {r.status === "ready" && r.scorecard ? (
                  <span className="block max-w-[11rem] font-serif text-sm leading-snug text-ink">{keptLine(r.scorecard).head}</span>
                ) : r.status === "no_guidance" ? (
                  "No explicit guidance"
                ) : r.status === "running" ? (
                  "Reading…"
                ) : (
                  r.status
                )}
              </span>
            </Link>
          </li>
        ))}
        {rows.length === 0 && <li className="py-3 text-sm text-muted">Nothing researched yet. Try a ticker above.</li>}
      </ul>
    </>
  );
}
