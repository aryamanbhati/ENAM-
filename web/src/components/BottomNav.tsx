"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Book, Briefcase, Sun } from "./icons";

const TABS = [
  { href: "/", label: "Today", Icon: Sun, match: (p: string) => p === "/" },
  { href: "/portfolio", label: "Portfolio", Icon: Briefcase, match: (p: string) => p.startsWith("/portfolio") || p.startsWith("/company") },
  { href: "/research", label: "Research", Icon: Book, match: (p: string) => p.startsWith("/research") },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-md">
        {TABS.map(({ href, label, Icon, match }) => {
          const active = match(path);
          return (
            <li key={href} className="flex-1">
              <Link href={href} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${active ? "text-ink" : "text-muted"}`} aria-current={active ? "page" : undefined}>
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
