"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAsk } from "./Ask";
import { Bars, Chat, Home, Search } from "./icons";

const TABS = [
  { href: "/", label: "Home", Icon: Home, match: (p: string) => p === "/" || p.startsWith("/settings") },
  { href: "/portfolio", label: "Portfolio", Icon: Bars, match: (p: string) => p.startsWith("/portfolio") || p.startsWith("/company") },
  { href: "/research", label: "Research", Icon: Search, match: (p: string) => p.startsWith("/research") },
];

/** Four-tab dock: Home, Portfolio, Research, and Ask FINN (which opens the
 *  assistant sheet rather than navigating). Active tab is an ink pill. */
export function BottomNav() {
  const path = usePathname();
  const { setOpen } = useAsk();
  const item = (active: boolean) =>
    `flex w-full flex-col items-center gap-1 rounded-[16px] py-2 text-[10.5px] font-medium transition-colors ${
      active ? "bg-ink text-bg" : "text-muted hover:text-ink"
    }`;
  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(env(safe-area-inset-bottom),0.6rem)]"
      aria-label="Main"
    >
      <ul className="pointer-events-auto mx-auto flex max-w-[24rem] items-stretch gap-1 rounded-[22px] border border-line bg-surface p-1.5 shadow-[var(--dock-shadow)]">
        {TABS.map(({ href, label, Icon, match }) => {
          const active = match(path);
          return (
            <li key={href} className="flex-1">
              <Link href={href} prefetch aria-current={active ? "page" : undefined} className={item(active)}>
                <Icon className="h-[18px] w-[18px]" />
                {label}
              </Link>
            </li>
          );
        })}
        <li className="flex-1">
          <button type="button" onClick={() => setOpen(true)} aria-label="Ask FINN" className={item(false)}>
            <Chat className="h-[18px] w-[18px]" />
            Ask FINN
          </button>
        </li>
      </ul>
    </nav>
  );
}
