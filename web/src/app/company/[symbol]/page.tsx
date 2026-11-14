import Link from "next/link";
import { notFound } from "next/navigation";
import { AskScopeSetter } from "@/components/Ask";
import { Move, TierBadge, VERDICT } from "@/components/Badges";
import { Masthead } from "@/components/Masthead";
import { Sparkline } from "@/components/Sparkline";
import { categoryLabel, cleanSubject, keptLine, relTime, shortName } from "@/lib/format";
import { companyBySymbol, companyFilings, marketState, portfolio, research } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function CompanyHub({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const c = await companyBySymbol(symbol);
  if (!c) notFound();
  const [filings, market, rs, { weights }] = await Promise.all([companyFilings(c.id, 40), marketState([c.id]), research(c.id), portfolio()]);
  const m = market.get(c.id);
  const material = filings.filter((f) => f.tier !== "routine");
  const routine = filings.length - material.length;
  const r = rs.research;
  const top = rs.promises.slice(0, 3);
  return (
    <>
      <AskScopeSetter scope={{ screen: "company", symbol: c.nse_symbol, companyId: c.id }} />
      <Masthead title={shortName(c.name)} back={{ href: "/portfolio", label: "Portfolio" }} />
      <section className="flex items-baseline justify-between pt-5">
        <div>
          <p className="text-xs text-muted">
            {c.nse_symbol}
            {c.sector ? ` · ${c.sector}` : ""}
            {weights.get(c.id) ? ` · ${weights.get(c.id)}% of portfolio` : ""}
          </p>
          {m && <p className="mt-1 font-serif text-2xl tabular-nums">₹{m.close.toLocaleString("en-IN")}</p>}
        </div>
        {m && (
          <div className="text-right text-sm">
            <Move v={m.move} className="block" />
            {m.volMult && <span className="text-xs tabular-nums text-muted">{m.volMult.toFixed(1)}× volume</span>}
          </div>
        )}
      </section>
      {m && <div className="mt-3"><Sparkline points={m.series.slice(-30)} /></div>}

      <section className="mt-6">
        <h2 className="mb-1 font-serif text-[17px] tracking-[-0.01em] text-ink">Recent filings</h2>
        <ul className="divide-y divide-line">
          {material.slice(0, 12).map((f) => (
            <li key={f.id} className="py-3">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>
                  {categoryLabel(f.finn_category)} · {relTime(f.filed_at)}
                </span>
                <TierBadge tier={f.tier} />
              </div>
              <p className="mt-1 text-sm">{f.enrichment?.one_line || cleanSubject(f.headline && f.headline.length > 12 ? f.headline : f.subject)}</p>
              {f.pdf_url && (
                <a href={f.pdf_url} target="_blank" rel="noreferrer" className="text-xs text-muted underline decoration-line underline-offset-2">
                  Filing
                </a>
              )}
            </li>
          ))}
          {material.length === 0 && <li className="py-3 text-sm text-muted">No material filings in our records.</li>}
        </ul>
        {routine > 0 && <p className="mt-1 text-xs text-muted">{routine} routine filings not shown.</p>}
      </section>

      <section className="mt-8 rounded-lg border border-line p-4">
        <h2 className="font-serif text-[17px] tracking-[-0.01em] text-ink">Promised vs delivered</h2>
        {r?.status === "ready" && r.scorecard ? (
          <>
            <p className="mt-2 font-serif text-xl">{keptLine(r.scorecard).head}</p>
            <ul className="mt-2 space-y-1 text-sm">
              {top.map((p) => (
                <li key={p.id} className="flex gap-2">
                  <span className={`w-24 shrink-0 text-xs ${VERDICT[p.verdict].color}`}>{VERDICT[p.verdict].label}</span>
                  <span className="min-w-0 truncate">{p.topic}</span>
                </li>
              ))}
            </ul>
          </>
        ) : r?.status === "no_guidance" ? (
          <p className="mt-2 text-sm text-muted">No explicit guidance found in the last {r.transcripts ?? 0} transcripts.</p>
        ) : (
          <p className="mt-2 text-sm text-muted">Not researched yet.</p>
        )}
        <Link href={`/research/${c.nse_symbol}`} className="mt-3 inline-block text-sm font-medium">
          {r?.status === "ready" ? "Open research →" : "Research this company →"}
        </Link>
      </section>
    </>
  );
}
