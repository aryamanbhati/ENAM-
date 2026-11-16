import Link from "next/link";
import { notFound } from "next/navigation";
import { AskScopeSetter } from "@/components/Ask";
import { Avatar, Move, TierBadge } from "@/components/Badges";
import { Masthead } from "@/components/Masthead";
import { PriceChart } from "@/components/PriceChart";
import { categoryLabel, cleanScorecard, naturalTitle, relTime, shortName } from "@/lib/format";
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
  const scorecard = r?.scorecard ? cleanScorecard(r.scorecard) : null;
  const weight = weights.get(c.id);
  const s30 = m?.series.slice(-30) ?? [];
  const chg30 = s30.length > 1 ? (s30[s30.length - 1].close / s30[0].close - 1) * 100 : null;
  const tiles = scorecard
    ? [
        { v: scorecard.total ?? 0, l: "Promises", c: "var(--ink)", bg: "var(--raised)" },
        { v: scorecard.delivered ?? 0, l: "On track", c: "var(--up)", bg: "var(--up-soft)" },
        { v: scorecard.partly ?? 0, l: "At risk", c: "var(--worth-ink)", bg: "var(--worth-soft)" },
        { v: (scorecard.missed ?? 0) + (scorecard.dropped ?? 0), l: "Not met", c: "var(--down)", bg: "var(--down-soft)" },
      ]
    : [];
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

      {m && s30.length > 1 && (
        <div className="card mt-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[13px] font-semibold text-ink">
              Price <span className="text-muted">(30D)</span>
            </span>
            {chg30 !== null && (
              <span
                className="rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums"
                style={{ background: chg30 >= 0 ? "var(--up-soft)" : "var(--down-soft)", color: chg30 >= 0 ? "var(--up)" : "var(--down)" }}
              >
                {chg30 >= 0 ? "+" : ""}
                {chg30.toFixed(2)}%
              </span>
            )}
          </div>
          <PriceChart points={s30} />
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
              <p className="clamp-2 mt-1.5 text-[15px] font-medium leading-snug text-ink">
                {naturalTitle(f.enrichment?.one_line || (f.headline && f.headline.length > 12 ? f.headline : f.subject), c.name)}
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
        {r?.status === "ready" && scorecard ? (
          <>
            <p className="mt-1 text-[12.5px] text-muted">Tracking key management commitments.</p>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {tiles.map((t) => (
                <div key={t.l} className="rounded-[14px] px-1 py-3 text-center" style={{ background: t.bg }}>
                  <div className="font-mono text-[20px] font-semibold leading-none" style={{ color: t.c }}>{t.v}</div>
                  <div className="mt-1 text-[10px] font-medium" style={{ color: t.c, opacity: 0.85 }}>{t.l}</div>
                </div>
              ))}
            </div>
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
