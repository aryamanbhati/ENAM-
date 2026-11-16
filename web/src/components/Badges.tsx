import { categoryLabel } from "@/lib/format";
import type { PromiseRow, Tier } from "@/lib/types";

export const TIER_LABEL: Record<Tier, string> = { needs_you: "Needs you", worth_knowing: "Worth knowing", routine: "Routine" };

export function TierBadge({ tier }: { tier: Tier }) {
  if (tier === "needs_you") {
    return (
      <span className="chip" style={{ background: "var(--accent)", color: "#fff" }}>
        <span className="chip-dot" style={{ background: "#fff" }} />
        Needs you
      </span>
    );
  }
  if (tier === "worth_knowing") {
    return (
      <span className="chip" style={{ background: "var(--raised)", color: "var(--muted)" }}>
        Worth knowing
      </span>
    );
  }
  return (
    <span className="chip" style={{ background: "var(--raised)", color: "var(--early)" }}>
      Routine
    </span>
  );
}

// Company avatar (logo with initials fallback) lives in its own client module.
export { Avatar } from "./Avatar";

/* Category chip: navy ink on a warm tint, same for every category. */
export function CatChip({ category, label }: { category: string | null | undefined; label?: string }) {
  return (
    <span className="chip" style={{ background: "var(--raised)", color: "var(--brand)" }}>
      {label ?? categoryLabel(category)}
    </span>
  );
}

/**
 * Citation chip. Neutral by default: a raised pill with muted ink, as asked.
 * Keeps its tabular numerals so the page reference always aligns.
 */
export function PageChip({ page, href, label }: { page: number | null | undefined; href?: string | null; label?: string }) {
  if (!page && !label) return null;
  const text = label ?? `p.${page}`;
  const cls =
    "ml-1.5 inline-flex items-center rounded-md border border-line bg-raised px-1.5 py-px align-[1px] text-[10px] font-medium tabular-nums text-muted transition-colors";
  if (!href) return <span className={cls}>{text}</span>;
  const url = page ? `${href}#page=${page}` : href;
  return (
    <a href={url} target="_blank" rel="noreferrer" className={`${cls} hover:border-ink hover:text-ink`} title="Open the source at this page">
      {text}
    </a>
  );
}

/** Plain coloured figure. */
export function Move({ v, className = "", digits = 1 }: { v: number | null | undefined; className?: string; digits?: number }) {
  if (v === null || v === undefined) return <span className={`text-faint ${className}`}>n/a</span>;
  const cls = v > 0.05 ? "text-up" : v < -0.05 ? "text-down" : "text-muted";
  return <span className={`tabular-nums ${cls} ${className}`}>{`${v > 0 ? "+" : ""}${v.toFixed(digits)}%`}</span>;
}

/**
 * ChangePill. Fixed minimum width so price-move columns line up down a list.
 */
export function MovePill({ v, className = "" }: { v: number | null | undefined; className?: string }) {
  const base =
    "inline-flex items-center justify-end gap-0.5 rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums";
  const style = { minWidth: "60px" };
  if (v === null || v === undefined)
    return (
      <span className={`${base} bg-early-soft text-early ${className}`} style={style}>
        n/a
      </span>
    );
  const up = v > 0.05;
  const down = v < -0.05;
  const cls = up ? "bg-up-soft text-up" : down ? "bg-down-soft text-down" : "bg-early-soft text-early";
  return (
    <span className={`${base} ${cls} ${className}`} style={style}>
      <span className="text-[8px] leading-none">{up ? "▲" : down ? "▼" : "■"}</span>
      {Math.abs(v).toFixed(1)}%
    </span>
  );
}

export const VERDICT: Record<PromiseRow["verdict"], { label: string; color: string; bar: string; soft: string; token: string }> = {
  delivered: { label: "Delivered", color: "text-up", bar: "bg-up", soft: "bg-up-soft", token: "var(--up)" },
  partly: { label: "Partly delivered", color: "text-partial", bar: "bg-partial", soft: "bg-partial-soft", token: "var(--partial)" },
  missed: { label: "Missed", color: "text-down", bar: "bg-down", soft: "bg-down-soft", token: "var(--down)" },
  dropped: { label: "Quietly dropped", color: "text-down", bar: "bg-down/45", soft: "bg-down-soft", token: "var(--down)" },
  too_early: { label: "Too early", color: "text-early", bar: "bg-early/50", soft: "bg-early-soft", token: "var(--early)" },
  not_measurable: { label: "Not measurable", color: "text-early", bar: "bg-line", soft: "bg-early-soft", token: "var(--early)" },
};

/** Single verdict chip with the same anatomy as TierBadge. */
export function StatusChip({ verdict }: { verdict: PromiseRow["verdict"] }) {
  const v = VERDICT[verdict];
  return (
    <span className={`chip ${v.soft} ${v.color}`}>
      <span className="chip-dot" style={{ background: v.token }} />
      {v.label}
    </span>
  );
}

/** Neutral count chip, e.g. "2 need you". */
export function CountChip({ n, label, tone = "accent" }: { n: number; label: string; tone?: "accent" | "muted" }) {
  const style =
    tone === "accent"
      ? { background: "var(--accent-soft)", color: "var(--accent-ink)" }
      : { background: "var(--raised)", color: "var(--muted)" };
  return (
    <span className="chip" style={style}>
      <span className="tabular-nums">{n}</span>
      {label}
    </span>
  );
}

export function SectionTitle({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <h2 className="mb-3 flex items-baseline gap-2 px-1 font-serif text-[20px] leading-none tracking-[-0.01em] text-ink">
      {children}
      {count !== undefined && <span className="font-sans text-[13px] font-medium tabular-nums text-muted">{count}</span>}
    </h2>
  );
}

/* Small label above a metric. The only place caps belong. Not a heading. */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-muted">{children}</span>;
}

/**
 * Promise-breakdown segmented bar with legend. Rounded ends, small gaps.
 * Legend dots match the verdict colour exactly.
 */
export function SegmentedBar({
  scorecard,
  compact = false,
  showLegend = true,
}: {
  scorecard: Record<string, number> | null | undefined;
  compact?: boolean;
  showLegend?: boolean;
}) {
  const order: PromiseRow["verdict"][] = ["delivered", "partly", "missed", "dropped", "too_early", "not_measurable"];
  const total = scorecard?.total ?? 0;
  if (!total) return null;
  return (
    <div>
      <div className="seg-bar" role="img" aria-label="Promise verdicts" style={{ height: compact ? 6 : 8 }}>
        {order.map((v) =>
          scorecard?.[v] ? (
            <span
              key={v}
              className="grow-x"
              style={{ width: `${(scorecard[v] / total) * 100}%`, background: VERDICT[v].token }}
            />
          ) : null,
        )}
      </div>
      {showLegend && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
          {order
            .filter((v) => scorecard?.[v])
            .map((v) => (
              <li key={v} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: VERDICT[v].token }} />
                <span className="font-medium tabular-nums">{scorecard?.[v]}</span>
                <span className="text-muted">{VERDICT[v].label.toLowerCase()}</span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
