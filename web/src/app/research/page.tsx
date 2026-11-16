import { AskScopeSetter } from "@/components/Ask";
import { Masthead } from "@/components/Masthead";
import { TickerSearch } from "@/components/TickerSearch";
import { ResearchIndexClient } from "@/components/ResearchIndexClient";
import { researchedCompanies } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ResearchIndex() {
  const rows = await researchedCompanies();
  return (
    <>
      <AskScopeSetter scope={{ screen: "portfolio" }} />
      <Masthead title="Research" sub="Explore any NSE-listed company" />
      <section className="pt-4">
        <p className="font-display text-[24px] font-bold leading-[1.15] tracking-[-0.025em] text-ink">
          The numbers, and whether management kept their word.
        </p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          Built only from a company&apos;s own concall transcripts and quarterly results. Every quote is checked against its page; every number is computed, not generated.
        </p>
        <div className="mt-4"><TickerSearch /></div>
      </section>
      <h2 className="mb-3 mt-7 px-1 text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">Researched companies</h2>
      <ResearchIndexClient rows={rows} />
    </>
  );
}
