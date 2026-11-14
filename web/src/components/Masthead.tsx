import Link from "next/link";
import { Bell } from "./icons";

/**
 * PageHeader. Non-sticky by default, which both looks cleaner on one-screen
 * pages and avoids the scroll-paint cost of a backdrop-filter sticky header.
 * One pattern: optional back link, title, optional subtitle, and the alerts
 * bell on the right.
 */
export function Masthead({
  title,
  sub,
  back,
}: {
  title: string;
  sub?: string;
  back?: { href: string; label: string };
  /** @deprecated kept for existing call sites; no visual effect. */
  brand?: boolean;
}) {
  return (
    <header className="flex flex-col gap-3 pt-[max(env(safe-area-inset-top),1rem)] pb-2">
      {back && (
        <Link
          href={back.href}
          prefetch
          className="inline-flex items-center gap-1 text-[12px] font-medium text-muted transition-colors hover:text-ink"
        >
          ← {back.label}
        </Link>
      )}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-[28px] font-semibold leading-[1.1] tracking-[-0.025em] text-ink">
            {title}
          </h1>
          {sub && <p className="mt-1 truncate text-[13px] text-muted">{sub}</p>}
        </div>
        <Link
          href="/settings"
          prefetch
          aria-label="Alerts and triggers"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-muted transition-colors hover:text-ink active:scale-95"
        >
          <Bell className="h-[18px] w-[18px]" />
        </Link>
      </div>
    </header>
  );
}
