import { Masthead } from "@/components/Masthead";
import { TodayView } from "@/components/TodayView";
import { db } from "@/lib/db";
import { WINDOWS, type WindowKey } from "@/lib/format";
import { itemsInWindow, marketState, upcoming } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Today({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const { w } = await searchParams;
  const win: WindowKey = w && w in WINDOWS ? (w as WindowKey) : "24h";
  const [{ items, failed }, next] = await Promise.all([itemsInWindow(WINDOWS[win]), upcoming()]);

  // Context for "what it means for you": how often this kind of filing happens at this company.
  const ids = [...new Set(items.map((i) => i.company.id))];
  const [hist, market] = await Promise.all([
    ids.length
      ? db().from("filings").select("company_id,finn_category,filed_at").in("company_id", ids).neq("tier", "routine").order("filed_at", { ascending: true }).limit(5000)
      : Promise.resolve({ data: [] as { company_id: number; finn_category: string; filed_at: string }[] }),
    marketState(items.filter((i) => i.kind === "signal").map((i) => i.company.id)),
  ]);
  const since = hist.data?.[0]?.filed_at ?? null;
  const counts: Record<string, number> = {};
  for (const h of hist.data ?? []) counts[`${h.company_id}:${h.finn_category}`] = (counts[`${h.company_id}:${h.finn_category}`] ?? 0) + 1;
  const series: Record<number, { date: string; close: number }[]> = {};
  for (const [id, s] of market) series[id] = s.series.slice(-30).map((r) => ({ date: r.date, close: r.close }));

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" });
  return (
    <>
      <Masthead title="FINN" sub={today} />
      <TodayView items={items} win={win} failed={failed} upcoming={next.map((u) => ({ symbol: u.company.nse_symbol, name: u.company.name, date: u.date }))} counts={counts} historySince={since} series={series} />
    </>
  );
}
