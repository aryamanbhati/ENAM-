import Link from "next/link";
import { notFound } from "next/navigation";
import { AskScopeSetter } from "@/components/Ask";
import { Avatar, Move, SegmentedBar, StatusChip, TierBadge, VERDICT } from "@/components/Badges";
import { Masthead } from "@/components/Masthead";
import { PriceChart } from "@/components/PriceChart";
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
  const weight = weights.get(c.id);
  return (
    <>
      <AskScopeSetter scope={{ screen: "company", symbol: c.nse_symbol, companyId: c.id }} />
      <Masthead title={shortName(c.name)} back={{ href: "/portfolio", label: "Portfolio" }} />

      {/* Meta + current price in one row, matching the shared header pattern */}
      <section className="flex items-start justify-between gap-3 pt-5">
        <div className="flex items-center gap-3">
          <Avatar symbol={c.nse_symbol} name={c.name} size={40} />
          <div>
            <p className="text-[11px] text-muted">
              <span className="font-medium text-ink">{c.nse_symbol}</span>
              {c.sector ? <> · {c.sector}</> : null}
              {weight ? <> · {weight}% of portfolio</> : null}
            </p>
            {m && (
              <p className="mt-1 flex items-baseline gap-2">
                <span className="font-serif text-[26px] leading-none tabular-nums text-ink">
                  ₹{m.close.toLocaleString("en-IN")}
                </span>
                <Move v={m.move} />
              </p>
            )}
          </div>
        </div>
        {m?.volMult && (
          <div className="text-right text-[11px] tabular-nums text-muted">
            <span className="block">{m.volMult.toFixed(1)}× volume</span>
            <span className="block text-faint">20-day avg</span>
          </div>
        )}
      </section>

      {m && (
        <div className="mt-4">
          <PriceChart points={m.series.slice(-30)} />
        </div>
      )}

      <section className="mt-7">
        <h2 className="mb-2 flex items-baseline gap-2 font-serif text-[20px] tracking-[-0.01em] text-ink">
          Recent filings <span className="font-sans text-[12px] font-medium tabular-nums text-muted">{material.length}</span>
        </h2>
        <ul className="divide-y divide-line">
          {material.slice(0, 12).map((f) => (
            <li key={f.id} className="py-3.5">
              <div className="flex items-center justify-between gap-2 text-[11px] text-muted">
                <span className="truncate">
                  <span className="font-medium text-ink">{categoryLabel(f.finn_category)}</span>
                  <span className="mx-1.5 text-faint">·</span>
                  {relTime(f.filed_at)}
                </span>
                <TierBadge tier={f.tier} />
              </div>
              <p className="mt-1.5 line-clamp-2 text-[14px] leading-snug text-ink">
                {f.enrichment?.one_line || cleanSubject(f.headline && f.headline.length > 12 ? f.headline : f.subject)}
              </p>
              {f.pdf_url && (
                <a
                  href={f.pdf_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-brand hover:underline"
                >
                  View filing →
                </a>
              )}
            </li>
          ))}
          {material.length === 0 && <li className="py-3 text-sm text-muted">No material filings in our records.</li>}
        </ul>
        {routine > 0 && <p className="mt-2 text-[11px] text-muted">{routine} routine filings not shown.</p>}
      </section>

      <section className="card mt-8 p-5">
        <h2 className="font-serif text-[20px] tracking-[-0.01em] text-ink">Promised vs delivered</h2>
        {r?.status === "ready" && r.scorecard ? (
          <>
            <p className="mt-2 font-serif text-[22px] leading-snug text-ink">{keptLine(r.scorecard).head}</p>
            <div className="mt-3">
              <SegmentedBar scorecard={r.scorecard} compact showLegend={false} />
            </div>
            <ul className="mt-4 space-y-2">
              {top.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <StatusChip verdict={p.verdict} />
                  <span className={`min-w-0 truncate text-[13px] ${VERDICT[p.verdict].color}`}>{p.topic}</span>
                </li>
              ))}
            </ul>
          </>
        ) : r?.status === "no_guidance" ? (
          <p className="mt-2 text-sm text-muted">No explicit guidance found in the last {r.transcripts ?? 0} transcripts.</p>
        ) : (
          <p className="mt-2 text-sm text-muted">Not researched yet.</p>
        )}
        <Link
          href={`/research/${c.nse_symbol}`}
          className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-brand hover:underline"
        >
          {r?.status === "ready" ? "Open research" : "Research this company"} →
        </Link>
      </section>
    </>
  );
}
