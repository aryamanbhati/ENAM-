import Link from "next/link";
import { Bell } from "./icons";

export function Masthead({ title, sub, back }: { title: string; sub?: string; back?: { href: string; label: string } }) {
  return (
    <header className="sticky top-0 z-20 -mx-5 border-b border-line bg-bg/95 px-5 pb-3 pt-[max(env(safe-area-inset-top),1rem)] backdrop-blur">
      {back && (
        <Link href={back.href} className="mb-1 inline-block text-xs text-muted">
          ← {back.label}
        </Link>
      )}
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="truncate font-serif text-2xl tracking-tight">{title}</h1>
        <div className="flex shrink-0 items-center gap-3">
          {sub && <span className="text-xs text-muted">{sub}</span>}
          <Link href="/settings" aria-label="Alerts and triggers" className="-m-2 p-2 text-muted hover:text-ink">
            <Bell className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
