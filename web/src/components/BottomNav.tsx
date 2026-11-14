"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Book, Briefcase, Sun } from "./icons";

const TABS = [
  { href: "/", label: "Today", Icon: Sun, match: (p: string) => p === "/" || p.startsWith("/settings") },
  { href: "/portfolio", label: "Portfolio", Icon: Briefcase, match: (p: string) => p.startsWith("/portfolio") || p.startsWith("/company") },
  { href: "/research", label: "Research", Icon: Book, match: (p: string) => p.startsWith("/research") },
];

/** Floating dock. The active tab expands into a tinted pill with its label. */
export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)]" aria-label="Main">
      <ul className="glass pointer-events-auto mx-auto flex max-w-[22rem] items-center gap-1 rounded-full p-1.5" style={{ boxShadow: "var(--dock-shadow)" }}>
        {TABS.map(({ href, label, Icon, match }) => {
          const active = match(path);
          return (
            <li key={href} className={active ? "flex-[1.6]" : "flex-1"}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-11 items-center justify-center gap-2 rounded-full text-[13px] font-medium transition-colors ${active ? "bg-brand" : "text-muted hover:text-ink"}`}
                style={active ? { color: "#f6f0e4" } : undefined}
              >
                <Icon className="h-5 w-5" />
                {active ? label : <span className="sr-only">{label}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
