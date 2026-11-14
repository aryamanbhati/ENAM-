"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Book, Briefcase, Sun } from "./icons";
import { FloatingBot } from "./FloatingBot";

const TABS = [
  { href: "/", label: "Today", Icon: Sun, match: (p: string) => p === "/" || p.startsWith("/settings") },
  { href: "/portfolio", label: "Portfolio", Icon: Briefcase, match: (p: string) => p.startsWith("/portfolio") || p.startsWith("/company") },
  { href: "/research", label: "Research", Icon: Book, match: (p: string) => p.startsWith("/research") },
];

/**
 * Dock. Active tab is an ink capsule with icon + label, inactive tabs are
 * ghost icon-only buttons. The Ask input is gone — a floating coral FINN bot
 * (bottom-right) replaces it, so the dock is a pure tab bar.
 */
export function BottomNav() {
  const path = usePathname();
  return (
    <>
      <nav
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(env(safe-area-inset-bottom),0.6rem)]"
        aria-label="Main"
      >
        <ul
          className="pointer-events-auto mx-auto flex max-w-[22rem] items-center justify-between gap-1 rounded-full border border-line bg-surface p-1.5 shadow-[var(--dock-shadow)]"
        >
          {TABS.map(({ href, label, Icon, match }) => {
            const active = match(path);
            return (
              <li key={href} className={active ? "flex-[1.4]" : "flex-none"}>
                <Link
                  href={href}
                  prefetch
                  aria-current={active ? "page" : undefined}
                  aria-label={label}
                  className={
                    active
                      ? "flex h-11 items-center justify-center gap-2 rounded-full bg-ink px-4 text-[13px] font-semibold text-bg transition-transform active:scale-[0.97]"
                      : "flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-raised hover:text-ink active:scale-[0.95]"
                  }
                >
                  <Icon className="h-[18px] w-[18px]" />
                  {active && <span>{label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <FloatingBot />
    </>
  );
}
