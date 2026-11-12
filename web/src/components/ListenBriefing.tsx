"use client";
import { useEffect, useState } from "react";
import { Speaker } from "./icons";

/** "Listen to my briefing": reads the summary and Needs you items aloud with the browser's speech engine. */
export function ListenBriefing({ lines }: { lines: string[] }) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => setSupported(typeof window !== "undefined" && "speechSynthesis" in window), []);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  if (!supported || lines.length === 0) return null;
  return (
    <button
      onClick={() => {
        const s = window.speechSynthesis;
        if (speaking) {
          s.cancel();
          setSpeaking(false);
          return;
        }
        s.cancel();
        const u = new SpeechSynthesisUtterance(lines.join(". "));
        u.lang = "en-IN";
        u.rate = 1.02;
        u.onend = () => setSpeaking(false);
        setSpeaking(true);
        s.speak(u);
      }}
      className="flex items-center gap-1 text-xs text-muted hover:text-ink"
      aria-pressed={speaking}
    >
      <Speaker className="h-4 w-4" /> {speaking ? "Stop" : "Listen"}
    </button>
  );
}
