import { categoryLabel } from "@/lib/format";
import type { PromiseRow, Tier } from "@/lib/types";

export const TIER_LABEL: Record<Tier, string> = { needs_you: "Needs you", worth_knowing: "Worth knowing", routine: "Routine" };

export function TierBadge({ tier }: { tier: Tier }) {
  const cls = tier === "needs_you" ? "bg-[var(--accent)] text-white" : tier === "worth_knowing" ? "bg-raised text-muted" : "bg-raised text-early";
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>{TIER_LABEL[tier]}</span>;
}

/* Company monogram: one navy tile with cream initials. No colour per company. */
export function Avatar({ symbol, size = 38 }: { symbol: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center bg-brand font-semibold tracking-tight"
      style={{ width: size, height: size, borderRadius: size * 0.32, fontSize: size * 0.34, color: "#f6f0e4" }}
    >
      {symbol.slice(0, 2)}
    </span>
  );
}

/* Category chip: navy ink on a warm tint, same for every category. The tier badge
   carries the only colour that matters (coral for Needs you). */
export function CatChip({ category, label }: { category: string | null | undefined; label?: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-raised px-2 py-0.5 text-[11px] font-medium text-brand">
      {label ?? categoryLabel(category)}
    </span>
  );
}

export function PageChip({ page, href, label }: { page: number | null | undefined; href?: string | null; label?: string }) {
  if (!page && !label) return null;
  const text = label ?? `p.${page}`;
  const cls = "ml-1.5 inline-flex items-center rounded-md bg-accent-soft px-1.5 py-px align-[1px] text-[10px] font-medium tabular-nums text-accent-ink";
  if (!href) return <span className={cls}>{text}</span>;
  const url = page ? `${href}#page=${page}` : href;
  return (
    <a href={url} target="_blank" rel="noreferrer" className={`${cls} hover:underline`} title="Open the source at this page">
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

/** Figure on a soft tinted pill with a direction arrow. */
export function MovePill({ v, className = "" }: { v: number | null | undefined; className?: string }) {
  if (v === null || v === undefined) return <span className={`rounded-full bg-early-soft px-2 py-0.5 text-xs text-early ${className}`}>n/a</span>;
  const up = v > 0.05;
  const down = v < -0.05;
  const cls = up ? "bg-up-soft text-up" : down ? "bg-down-soft text-down" : "bg-early-soft text-early";
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${cls} ${className}`}>
      <span className="text-[8px]">{up ? "▲" : down ? "▼" : "■"}</span>
      {Math.abs(v).toFixed(1)}%
    </span>
  );
}

export const VERDICT: Record<PromiseRow["verdict"], { label: string; color: string; bar: string; soft: string }> = {
  delivered: { label: "Delivered", color: "text-up", bar: "bg-up", soft: "bg-up-soft" },
  partly: { label: "Partly delivered", color: "text-partial", bar: "bg-partial", soft: "bg-partial-soft" },
  missed: { label: "Missed", color: "text-down", bar: "bg-down", soft: "bg-down-soft" },
  dropped: { label: "Quietly dropped", color: "text-down", bar: "bg-down/45", soft: "bg-down-soft" },
  too_early: { label: "Too early", color: "text-early", bar: "bg-early/50", soft: "bg-early-soft" },
  not_measurable: { label: "Not measurable", color: "text-early", bar: "bg-line", soft: "bg-early-soft" },
};

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
