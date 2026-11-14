"use client";
import { useMemo, useRef, useState } from "react";

/**
 * Hover-and-touch price chart. Builds the same area + line as Sparkline but
 * adds a crosshair with a date and price tooltip that tracks the pointer.
 * Axis labels show the start date, price range and end date underneath.
 */
export function PriceChart({
  points,
  mark,
  marks = [],
  height = 120,
}: {
  points: { date: string; close: number }[];
  mark?: string;
  marks?: string[];
  height?: number;
}) {
  const [i, setI] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);

  const g = useMemo(() => {
    if (points.length < 2) return null;
    const w = 320;
    const h = height;
    const ys = points.map((p) => p.close);
    const min = Math.min(...ys);
    const max = Math.max(...ys);
    const x = (idx: number) => (idx / (points.length - 1)) * w;
    const y = (v: number) => h - 10 - ((v - min) / (max - min || 1)) * (h - 22);
    const up = ys[ys.length - 1] >= ys[0];
    const color = up ? "var(--up)" : "var(--down)";
    const line = points.map((p, idx) => `${idx ? "L" : "M"}${x(idx).toFixed(1)},${y(p.close).toFixed(1)}`).join(" ");
    return { w, h, min, max, up, color, line, x, y };
  }, [points, height]);

  if (!g) return null;

  const onMove = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const rel = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    setI(Math.round(rel * (points.length - 1)));
  };

  const cur = i !== null ? points[i] : null;
  const all = [...(mark ? [mark] : []), ...marks];

  return (
    <figure className="relative">
      <svg
        ref={ref}
        viewBox={`0 0 ${g.w} ${g.h}`}
        className="w-full touch-none select-none"
        style={{ height: g.h }}
        role="img"
        aria-label="Closing price over recent trading days"
        preserveAspectRatio="none"
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          onMove(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons || e.pointerType !== "mouse") onMove(e.clientX);
          else if (e.pointerType === "mouse") onMove(e.clientX);
        }}
        onPointerLeave={() => setI(null)}
      >
        <defs>
          <linearGradient id="pc-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={g.color} stopOpacity="0.28" />
            <stop offset="1" stopColor={g.color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${g.line} L${g.w},${g.h} L0,${g.h} Z`} fill="url(#pc-grad)" />
        <path
          d={g.line}
          fill="none"
          stroke={g.color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {all.map((d) => {
          const idx = points.findIndex((p) => p.date === d);
          if (idx < 0) return null;
          const dayUp = idx > 0 ? points[idx].close >= points[idx - 1].close : true;
          return (
            <circle
              key={d}
              cx={g.x(idx)}
              cy={g.y(points[idx].close)}
              r={4.5}
              fill={dayUp ? "var(--up)" : "var(--down)"}
              stroke="var(--surface)"
              strokeWidth={2}
            />
          );
        })}
        {cur && (
          <>
            <line
              x1={g.x(i!)}
              x2={g.x(i!)}
              y1={0}
              y2={g.h - 10}
              stroke="var(--ink)"
              strokeOpacity={0.35}
              strokeDasharray="2 3"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={g.x(i!)} cy={g.y(cur.close)} r={4} fill="var(--ink)" stroke="var(--surface)" strokeWidth={2} />
          </>
        )}
      </svg>

      {cur && (
        <div
          className="pointer-events-none absolute -top-1 rounded-md border border-line bg-surface px-2 py-1 text-[11px] leading-tight shadow"
          style={{
            left: `clamp(0px, calc(${((i! / (points.length - 1)) * 100).toFixed(1)}% - 44px), calc(100% - 88px))`,
            boxShadow: "var(--shadow-soft)",
          }}
          role="status"
          aria-live="polite"
        >
          <div className="text-faint">
            {new Date(cur.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
          </div>
          <div className="font-semibold tabular-nums text-ink">₹{cur.close.toLocaleString("en-IN")}</div>
        </div>
      )}

      <figcaption className="mt-1 flex justify-between text-[10px] tabular-nums text-faint">
        <span>{new Date(points[0].date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
        <span>
          ₹{g.min.toLocaleString("en-IN")} to ₹{g.max.toLocaleString("en-IN")}
        </span>
        <span>{new Date(points[points.length - 1].date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
      </figcaption>
    </figure>
  );
}
