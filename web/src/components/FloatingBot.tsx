"use client";
import { useEffect, useRef, useState } from "react";
import { useAsk } from "./Ask";

/**
 * Floating FINN bot. A 56px coral disc that sits above the dock on every
 * screen. One tap opens the Ask sheet with the current scope; a long-press
 * starts speech. Pulses once when the screen scope changes so the user knows
 * the bot is now listening to this context.
 */
export function FloatingBot() {
  const { setOpen, open, scope } = useAsk();
  const [pulse, setPulse] = useState(false);
  const scopeKey = JSON.stringify(scope);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);

  useEffect(() => {
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 2400);
    return () => clearTimeout(t);
  }, [scopeKey]);

  if (open) return null;

  const start = () => {
    held.current = false;
    hold.current = setTimeout(() => {
      held.current = true;
      setOpen(true);
      // mic hint: Ask sheet autofocuses the input; dictation is one tap away
    }, 420);
  };
  const end = () => {
    if (hold.current) clearTimeout(hold.current);
    if (!held.current) setOpen(true);
  };

  return (
    <button
      type="button"
      aria-label="Ask FINN"
      onPointerDown={start}
      onPointerUp={end}
      onPointerLeave={() => {
        if (hold.current) clearTimeout(hold.current);
      }}
      className={`fixed right-4 z-40 flex items-center justify-center rounded-full text-white transition-transform active:scale-95 ${
        pulse ? "bot-pulse" : ""
      }`}
      style={{
        bottom: "calc(var(--dock-h) + env(safe-area-inset-bottom) - 28px)",
        width: "var(--bot-size)",
        height: "var(--bot-size)",
        background: "var(--accent)",
        boxShadow: "var(--shadow-bot)",
      }}
    >
      <BotGlyph />
    </button>
  );
}

function BotGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="7" width="16" height="12" rx="4" />
      <circle cx="9" cy="13" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13" r="1.2" fill="currentColor" stroke="none" />
      <path d="M12 3v4" />
      <circle cx="12" cy="3" r="1" fill="currentColor" stroke="none" />
      <path d="M8 19v1.5M16 19v1.5" />
    </svg>
  );
}
