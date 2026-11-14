import Link from "next/link";
import { Bell } from "./icons";

export function Masthead({ title, sub, back, brand }: { title: string; sub?: string; back?: { href: string; label: string }; brand?: boolean }) {
  return (
    <header className="glass sticky top-0 z-20 -mx-4 border-b border-line/70 px-4 pb-3 pt-[max(env(safe-area-inset-top),0.9rem)]">
      {back && (
        <Link href={back.href} className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-brand">
          ← {back.label}
        </Link>
      )}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {brand && (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-brand font-serif text-lg leading-none" style={{ color: "#f6f0e4" }} aria-hidden>
              F
            </span>
          )}
          <div className="min-w-0">
            <h1 className={`truncate tracking-tight ${brand ? "text-[17px] font-semibold" : "font-serif text-[26px] leading-tight"}`}>{title}</h1>
            {sub && <p className="truncate text-[11px] text-muted">{sub}</p>}
          </div>
        </div>
        <Link href="/settings" aria-label="Alerts and triggers" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-muted hover:text-brand">
          <Bell className="h-[18px] w-[18px]" />
        </Link>
      </div>
    </header>
  );
}
