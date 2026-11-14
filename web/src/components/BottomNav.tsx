"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { Book, Briefcase, Sun } from "./icons";

const TABS = [
  { href: "/", label: "Today", Icon: Sun, match: (p: string) => p === "/" || p.startsWith("/settings") },
  { href: "/portfolio", label: "Portfolio", Icon: Briefcase, match: (p: string) => p.startsWith("/portfolio") || p.startsWith("/company") },
  { href: "/research", label: "Research", Icon: Book, match: (p: string) => p.startsWith("/research") },
];

/**
 * Bottom tab bar. The Ask input sits above it, together they form the dock the
 * layout reserves space for. Active tab slides a cream thumb under itself and
 * reveals its label. All three tabs show the same icon + label anatomy.
 */
export function BottomNav() {
  const path = usePathname();
  const refs = useRef<Array<HTMLLIElement | null>>([]);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  const activeIndex = TABS.findIndex((t) => t.match(path));

  useLayoutEffect(() => {
    const el = refs.current[activeIndex];
    if (!el) return;
    setThumb({ left: el.offsetLeft, width: el.offsetWidth });
  }, [activeIndex, path]);

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(env(safe-area-inset-bottom),0.6rem)]"
      aria-label="Main"
    >
      <ul
        className="glass pointer-events-auto relative mx-auto flex max-w-[22rem] items-center rounded-full p-1.5"
        style={{ boxShadow: "var(--dock-shadow)" }}
      >
        {thumb && (
          <span
            aria-hidden
            className="absolute top-1.5 bottom-1.5 rounded-full bg-brand transition-all duration-220"
            style={{
              left: thumb.left,
              width: thumb.width,
              transitionDuration: "var(--d-base)",
              transitionTimingFunction: "var(--e-std)",
            }}
          />
        )}
        {TABS.map(({ href, label, Icon, match }, i) => {
          const active = match(path);
          return (
            <li
              key={href}
              ref={(el) => {
                refs.current[i] = el;
              }}
              className="relative flex-1"
            >
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative z-[1] flex h-10 items-center justify-center gap-1.5 rounded-full text-[12.5px] font-medium transition-colors ${
                  active ? "text-bg" : "text-muted hover:text-ink"
                }`}
                style={active ? { color: "#f6f0e4" } : undefined}
              >
                <Icon className="h-[18px] w-[18px]" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
