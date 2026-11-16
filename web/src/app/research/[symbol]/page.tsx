import { AskScopeSetter } from "@/components/Ask";
import { Masthead } from "@/components/Masthead";
import { ResearchView } from "@/components/ResearchView";
import { RunResearch } from "@/components/RunResearch";
import { shortName } from "@/lib/format";
import { companyBySymbol, companyMetrics, research } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ResearchPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  const c = await companyBySymbol(symbol);
  const [rs, metrics] = c ? await Promise.all([research(c.id), companyMetrics(c.id)]) : [null, null];
  const r = rs?.research;
  return (
    <>
      {c && <AskScopeSetter scope={{ screen: "research", symbol: c.nse_symbol, companyId: c.id }} />}
      <Masthead title={c ? shortName(c.name) : symbol} back={{ href: "/research", label: "Research" }} />
      {r && (r.status === "ready" || r.status === "no_guidance") && rs ? (
        <ResearchView company={c!} research={r} promises={rs.promises} docs={rs.docs} metrics={metrics} />
      ) : (
        <RunResearch symbol={symbol} running={r?.status === "running"} failed={r?.status === "failed"} />
      )}
    </>
  );
}
