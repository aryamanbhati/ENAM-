import Link from "next/link";
import { AskScopeSetter } from "@/components/Ask";
import { Avatar, SegmentedBar } from "@/components/Badges";
import { Masthead } from "@/components/Masthead";
import { TickerSearch } from "@/components/TickerSearch";
import { cleanScorecard, shortName } from "@/lib/format";
import { researchedCompanies } from "@/lib/queries";

export const dynamic = "force-dynamic";

function summary(scorecard: Record<string, number> | null | undefined): { line: string; muted: boolean } {
  const g = (k: string) => scorecard?.[k] ?? 0;
  const total = g("total");
  const judged = g("delivered") + g("partly") + g("missed");
  if (!total) return { line: "No guidance", muted: true };
  if (judged === 0) return { line: `${total} tracked`, muted: true };
  return { line: `${g("delivered")} of ${judged} kept`, muted: false };
}

export default async function ResearchIndex() {
  const rows = await researchedCompanies();
  return (
    <>
      <AskScopeSetter scope={{ screen: "portfolio" }} />
      <Masthead title="Research" sub="Any company, from its own filings" />
      <section className="pt-5">
        <p className="text-[26px] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">
          The numbers, and whether management kept their word.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Built only from the company&apos;s own concall transcripts and quarterly results: eight-quarter trajectory, and every explicit commitment tracked against what was delivered. Every quote is checked against its page; every number is computed, not generated.
        </p>
        <div className="mt-4">
          <TickerSearch />
        </div>
      </section>
      <ul className="mt-6 divide-y divide-line">
        {rows.map(({ company, research: r }) => {
          const s = r.scorecard ? cleanScorecard(r.scorecard) : null;
          const info = summary(s);
          return (
            <li key={company.id}>
              <Link
                href={`/research/${company.nse_symbol}`}
                className="group flex items-center gap-3 py-3.5 transition-colors active:bg-raised"
              >
                <Avatar symbol={company.nse_symbol} name={company.name} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-ink">
                    {shortName(company.name)}
                  </span>
                  <span className="block text-[11px] text-muted">{company.nse_symbol}</span>
                </span>
                <span className="flex w-[128px] shrink-0 flex-col items-stretch gap-1.5">
                  {r.status === "ready" && s ? (
                    <>
                      <span className={`text-right text-[12px] font-semibold tabular-nums ${info.muted ? "text-muted" : "text-ink"}`}>
                        {info.line}
                      </span>
                      <SegmentedBar scorecard={s} compact showLegend={false} />
                    </>
                  ) : r.status === "running" ? (
                    <>
                      <span className="text-right text-[12px] text-muted">Reading…</span>
                      <span className="sk h-1.5 w-full rounded-full" />
                    </>
                  ) : r.status === "no_guidance" ? (
                    <>
                      <span className="text-right text-[12px] text-muted">No guidance</span>
                      <span className="h-1.5 w-full rounded-full bg-line" />
                    </>
                  ) : (
                    <span className="text-right text-[12px] capitalize text-muted">{r.status}</span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
        {rows.length === 0 && <li className="py-3 text-sm text-muted">Nothing researched yet. Try a ticker above.</li>}
      </ul>
    </>
  );
}
