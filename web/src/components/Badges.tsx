import type { PromiseRow, Tier } from "@/lib/types";

export const TIER_LABEL: Record<Tier, string> = { needs_you: "Needs you", worth_knowing: "Worth knowing", routine: "Routine" };

export function TierBadge({ tier }: { tier: Tier }) {
  const cls = tier === "needs_you" ? "border-ink text-ink" : "border-line text-muted";
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cls}`}>{TIER_LABEL[tier]}</span>;
}

export function PageChip({ page, href, label }: { page: number | null | undefined; href?: string | null; label?: string }) {
  if (!page && !label) return null;
  const text = label ?? `p.${page}`;
  const cls = "ml-1 inline-flex items-center rounded border border-line px-1 align-[1px] text-[10px] tabular-nums text-muted hover:border-ink hover:text-ink";
  if (!href) return <span className={cls}>{text}</span>;
  const url = page ? `${href}#page=${page}` : href;
  return (
    <a href={url} target="_blank" rel="noreferrer" className={cls} title="Open the source at this page">
      {text}
    </a>
  );
}

export function Move({ v, className = "" }: { v: number | null | undefined; className?: string }) {
  if (v === null || v === undefined) return <span className={`text-muted ${className}`}>n/a</span>;
  const cls = v > 0.05 ? "text-up" : v < -0.05 ? "text-down" : "text-muted";
  return <span className={`tabular-nums ${cls} ${className}`}>{`${v > 0 ? "+" : ""}${v.toFixed(1)}%`}</span>;
}

export const VERDICT: Record<PromiseRow["verdict"], { label: string; color: string; bar: string }> = {
  delivered: { label: "Delivered", color: "text-up", bar: "bg-up" },
  partly: { label: "Partly", color: "text-partial", bar: "bg-partial" },
  missed: { label: "Missed", color: "text-down", bar: "bg-down" },
  dropped: { label: "Quietly dropped", color: "text-down", bar: "bg-down/55" },
  too_early: { label: "Too early", color: "text-early", bar: "bg-early/60" },
  not_measurable: { label: "Not measurable", color: "text-early", bar: "bg-line" },
};
