/** Closing-price area chart. The line takes the direction's colour; marked days get a dot. */
export function Sparkline({ points, mark, marks = [], height = 84 }: { points: { date: string; close: number }[]; mark?: string; marks?: string[]; height?: number }) {
  if (points.length < 2) return null;
  const w = 320;
  const h = height;
  const ys = points.map((p) => p.close);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const x = (i: number) => (i / (points.length - 1)) * w;
  const y = (v: number) => h - 8 - ((v - min) / (max - min || 1)) * (h - 18);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.close).toFixed(1)}`).join(" ");
  const up = ys[ys.length - 1] >= ys[0];
  const color = up ? "var(--up)" : "var(--down)";
  const id = `sg-${points[0].date}-${points.length}-${up ? "u" : "d"}`;
  const all = [...(mark ? [mark] : []), ...marks];
  return (
    <figure>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} role="img" aria-label="Closing price, recent trading days" preserveAspectRatio="none">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.28" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} />
        <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {all.map((d) => {
          const i = points.findIndex((p) => p.date === d);
          if (i < 0) return null;
          const dayUp = i > 0 ? points[i].close >= points[i - 1].close : true;
          return <circle key={d} cx={x(i)} cy={y(points[i].close)} r={4.5} fill={dayUp ? "var(--up)" : "var(--down)"} stroke="var(--surface)" strokeWidth={2} />;
        })}
      </svg>
      <figcaption className="mt-1 flex justify-between text-[10px] tabular-nums text-faint">
        <span>{new Date(points[0].date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
        <span>
          ₹{min.toLocaleString("en-IN")} to ₹{max.toLocaleString("en-IN")}
        </span>
        <span>{new Date(points[points.length - 1].date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
      </figcaption>
    </figure>
  );
}

/** Tiny inline trend for list rows. */
export function MiniSpark({ values, width = 56, height = 22, positive }: { values: number[]; width?: number; height?: number; positive?: boolean }) {
  if (values.length < 2) return <span style={{ width, height }} className="inline-block" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Colour by the day move when given (so the line agrees with the change pill),
  // otherwise fall back to the series' own start-to-end trend.
  const up = positive ?? values[values.length - 1] >= values[0];
  const d = values.map((v, i) => `${i ? "L" : "M"}${((i / (values.length - 1)) * width).toFixed(1)},${(height - 2 - ((v - min) / (max - min || 1)) * (height - 4)).toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <path d={d} fill="none" stroke={up ? "var(--up)" : "var(--down)"} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
