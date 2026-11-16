"use client";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

function browserClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/rest\/v1\/?$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

/**
 * Keeps the Research list fresh. Subscribes over Supabase realtime to both the
 * jobs table (so an in-flight run's status flips in place) and the research table
 * (so a finished run appears even if no job was "pending" when the page loaded,
 * e.g. it completed just as you navigated back). A short polling fallback runs
 * only while something is actually pending, covering the case where realtime is
 * not enabled. The realtime subscription itself is always on but idle, so it
 * costs nothing on a quiet page.
 */
export function ResearchLive({ pending }: { pending: number }) {
  const router = useRouter();
  useEffect(() => {
    const sb = browserClient();
    const ch = sb
      ?.channel("research-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "research" }, () => router.refresh())
      .subscribe();
    const poll = pending > 0 ? setInterval(() => router.refresh(), 6000) : null;
    return () => {
      if (poll) clearInterval(poll);
      if (ch) sb?.removeChannel(ch);
    };
  }, [pending, router]);
  return null;
}
