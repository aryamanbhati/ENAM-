import { AskScopeSetter } from "@/components/Ask";
import { Masthead } from "@/components/Masthead";
import { ResearchView } from "@/components/ResearchView";
import { RunResearch } from "@/components/RunResearch";
import { shortName } from "@/lib/format";
import { activeResearchJob, companyBySymbol, companyMetrics, research } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ResearchPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  const c = await companyBySymbol(symbol);
  const [rs, metrics, job] = c
    ? await Promise.all([research(c.id), companyMetrics(c.id), activeResearchJob(symbol)])
    : [null, null, await activeResearchJob(symbol)];
  const r = rs?.research;
  const ready = r && (r.status === "ready" || r.status === "no_guidance") && rs && !job;
  return (
    <>
      {c && <AskScopeSetter scope={{ screen: "research", symbol: c.nse_symbol, companyId: c.id }} />}
      <Masthead title={c ? shortName(c.name) : symbol} back={{ href: "/research", label: "Research" }} />
      {ready ? (
        <ResearchView company={c!} research={r!} promises={rs!.promises} docs={rs!.docs} metrics={metrics} />
      ) : (
        <RunResearch
          symbol={symbol}
          running={r?.status === "running" || !!job}
          failed={r?.status === "failed"}
          jobId={job?.id ?? null}
          initialSteps={job?.progress ?? []}
        />
      )}
    </>
  );
}
