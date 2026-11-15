import { Masthead } from "@/components/Masthead";
import { TodayView } from "@/components/TodayView";
import { WINDOWS, type WindowKey } from "@/lib/format";
import { categoryHistory, itemsInWindow, marketState, upcoming } from "@/lib/queries";

export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function Today({ searchParams }: { searchParams: Promise<{ w?: string; from?: string; to?: string }> }) {
  const { w, from, to } = await searchParams;
  const range = from && to && DATE.test(from) && DATE.test(to) && from <= to ? { from, to } : undefined;
  const win: WindowKey | "custom" = range ? "custom" : w && w in WINDOWS ? (w as WindowKey) : "7d";
  const [{ items, failed }, next] = await Promise.all([itemsInWindow(win === "custom" ? 24 : WINDOWS[win], range), upcoming()]);

  // Context for "what it means for you": how often this kind of filing happens at this company.
  const ids = [...new Set(items.map((i) => i.company.id))];
  const [hist, market] = await Promise.all([
    categoryHistory(ids),
    marketState(items.filter((i) => i.kind === "signal").map((i) => i.company.id)),
  ]);
  const since = hist.since;
  const counts = hist.counts;
  const series: Record<number, { date: string; close: number }[]> = {};
  for (const [id, s] of market) series[id] = s.series.slice(-30).map((r) => ({ date: r.date, close: r.close }));

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" });
  return (
    <>
      <Masthead title="FINN" sub={today} brand />
      <TodayView
        items={items}
        win={win}
        range={range}
        failed={failed}
        upcoming={next.map((u) => ({ symbol: u.company.nse_symbol, name: u.company.name, date: u.date }))}
        counts={counts}
        historySince={since}
        series={series}
      />
    </>
  );
}
