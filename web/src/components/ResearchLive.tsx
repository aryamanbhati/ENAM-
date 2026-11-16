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
 * Keeps the Research list fresh while a job is in flight. Subscribes to the jobs
 * table over Supabase realtime and re-renders the server component when a research
 * job changes (so "Researching…" flips to a finished scorecard in place), with a
 * light polling fallback for when realtime is not available. Only active while
 * something is actually pending, so an idle page does no work.
 */
export function ResearchLive({ pending }: { pending: number }) {
  const router = useRouter();
  useEffect(() => {
    if (pending <= 0) return;
    const sb = browserClient();
    const ch = sb
      ?.channel("research-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, () => router.refresh())
      .subscribe();
    const poll = setInterval(() => router.refresh(), 6000);
    return () => {
      clearInterval(poll);
      if (ch) sb?.removeChannel(ch);
    };
  }, [pending, router]);
  return null;
}
