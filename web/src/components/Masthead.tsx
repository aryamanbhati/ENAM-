import Link from "next/link";
import { Bell } from "./icons";

/**
 * PageHeader. One pattern for every screen: optional back link, serif title,
 * optional subtitle, and the alerts bell on the right. The `brand` prop is
 * accepted for backward compatibility and intentionally ignored so Today,
 * Portfolio, Research and Company all render with identical structure.
 */
export function Masthead({
  title,
  sub,
  back,
}: {
  title: string;
  sub?: string;
  back?: { href: string; label: string };
  /** @deprecated kept so existing call sites compile; has no visual effect. */
  brand?: boolean;
}) {
  return (
    <header className="glass sticky top-0 z-20 -mx-4 border-b border-line/70 px-4 pb-3 pt-[max(env(safe-area-inset-top),0.9rem)]">
      {back && (
        <Link href={back.href} className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
          ← {back.label}
        </Link>
      )}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate font-serif text-[27px] leading-[1.05] tracking-[-0.02em] text-ink">{title}</h1>
          {sub && <p className="mt-0.5 truncate text-[11px] text-muted">{sub}</p>}
        </div>
        <Link
          href="/settings"
          aria-label="Alerts and triggers"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-muted transition-colors hover:text-brand active:scale-95"
        >
          <Bell className="h-[18px] w-[18px]" />
        </Link>
      </div>
    </header>
  );
}
