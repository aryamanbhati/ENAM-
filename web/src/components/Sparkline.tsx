/** 30-day close line with the signal day marked. Neutral ink; the marker carries direction. */
export function Sparkline({ points, mark }: { points: { date: string; close: number }[]; mark?: string }) {
  if (points.length < 2) return null;
  const w = 320;
  const h = 64;
  const ys = points.map((p) => p.close);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const x = (i: number) => (i / (points.length - 1)) * w;
  const y = (v: number) => h - 6 - ((v - min) / (max - min || 1)) * (h - 12);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.close).toFixed(1)}`).join(" ");
  const mi = mark ? points.findIndex((p) => p.date === mark) : -1;
  const up = mi > 0 ? points[mi].close >= points[mi - 1].close : true;
  return (
    <figure>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-16 w-full" role="img" aria-label="Closing price, last 30 trading days">
        <path d={d} fill="none" stroke="currentColor" strokeWidth={1.4} className="text-muted" />
        {mi >= 0 && <circle cx={x(mi)} cy={y(points[mi].close)} r={3.5} className={up ? "fill-up" : "fill-down"} />}
      </svg>
      <figcaption className="flex justify-between text-[10px] tabular-nums text-muted">
        <span>{new Date(points[0].date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
        <span>
          ₹{min.toLocaleString("en-IN")} to ₹{max.toLocaleString("en-IN")}
        </span>
        <span>{new Date(points[points.length - 1].date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
      </figcaption>
    </figure>
  );
}
