"use client";
import { useEffect, useRef, useState } from "react";
import { Speaker } from "./icons";

/**
 * "Listen to my briefing". Streams OpenAI's tts-1-hd through /api/tts so the
 * voice sounds like a real person, not the browser's speechSynthesis robot.
 * The MP3 is buffered as a blob URL and played through a hidden <audio>; a
 * tap cancels playback and frees the url. Falls back to browser TTS if the
 * server has no OPENAI_API_KEY configured.
 */
export function ListenBriefing({ lines }: { lines: string[] }) {
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  if (lines.length === 0) return null;

  const stop = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setState("idle");
  };

  const fallbackBrowser = () => {
    const s = window.speechSynthesis;
    if (!s) return;
    s.cancel();
    const u = new SpeechSynthesisUtterance(lines.join(". "));
    u.lang = "en-IN";
    u.rate = 1.02;
    u.onend = () => setState("idle");
    setState("playing");
    s.speak(u);
  };

  const play = async () => {
    if (state === "playing" || state === "loading") return stop();
    setState("loading");
    try {
      const r = await fetch("/api/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: lines.join(". ") }),
      });
      if (r.status === 503) {
        setState("idle");
        return fallbackBrowser();
      }
      if (!r.ok) {
        setState("idle");
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const a = new Audio(url);
      audioRef.current = a;
      a.onended = stop;
      a.onerror = stop;
      await a.play();
      setState("playing");
    } catch {
      setState("idle");
      fallbackBrowser();
    }
  };

  return (
    <button
      onClick={play}
      className="flex items-center gap-1.5 text-[12px] text-muted transition-colors hover:text-ink"
      aria-pressed={state === "playing"}
    >
      <Speaker className={`h-4 w-4 ${state === "playing" ? "text-accent" : ""}`} />
      {state === "loading" ? "Loading…" : state === "playing" ? "Stop" : "Listen"}
    </button>
  );
}
