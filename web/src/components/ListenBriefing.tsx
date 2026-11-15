"use client";
import { useEffect, useState } from "react";
import { Speaker } from "./icons";

/**
 * "Listen to my briefing": reads the summary and Needs-you items aloud with the
 * browser's speech engine. Kept deliberately simple so Stop is instant and
 * reliable (speechSynthesis.cancel). No network, no cost.
 */
export function ListenBriefing({ lines }: { lines: string[] }) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => setSupported(typeof window !== "undefined" && "speechSynthesis" in window), []);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  if (!supported || lines.length === 0) return null;

  const toggle = () => {
    const s = window.speechSynthesis;
    if (speaking || s.speaking) {
      s.cancel();
      setSpeaking(false);
      return;
    }
    s.cancel();
    const u = new SpeechSynthesisUtterance(lines.join(". "));
    u.lang = "en-IN";
    u.rate = 1.02;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    s.speak(u);
  };

  return (
    <button
      onClick={toggle}
      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-bg/90 transition-colors hover:text-bg"
      aria-pressed={speaking}
    >
      <Speaker className={`h-[18px] w-[18px] ${speaking ? "text-accent" : ""}`} />
      {speaking ? "Stop" : "Listen"}
    </button>
  );
}
