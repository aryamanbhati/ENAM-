"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bars, Chat, Home, Search } from "./icons";

const TABS = [
  { href: "/", label: "Home", Icon: Home, match: (p: string) => p === "/" || p.startsWith("/settings") },
  { href: "/portfolio", label: "Portfolio", Icon: Bars, match: (p: string) => p.startsWith("/portfolio") || p.startsWith("/company") },
  { href: "/research", label: "Research", Icon: Search, match: (p: string) => p.startsWith("/research") },
  { href: "/ask", label: "Ask FINN", Icon: Chat, match: (p: string) => p.startsWith("/ask") },
];

/** Four-tab dock, anchored flush to the bottom edge. Active tab is an ink pill. */
export function BottomNav() {
  const path = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
      aria-label="Main"
    >
      <ul className="mx-auto flex max-w-md items-stretch gap-1 px-3 pt-1.5 pb-1">
        {TABS.map(({ href, label, Icon, match }) => {
          const active = match(path);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                prefetch
                aria-current={active ? "page" : undefined}
                className={`flex w-full flex-col items-center gap-1 rounded-[16px] py-2 text-[10.5px] font-medium transition-colors ${
                  active ? "bg-ink text-bg" : "text-muted hover:text-ink"
                }`}
              >
                <Icon className="h-[18px] w-[18px]" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
