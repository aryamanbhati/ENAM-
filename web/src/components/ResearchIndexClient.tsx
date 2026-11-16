"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, SegmentedBar } from "@/components/Badges";
import { Chevron } from "@/components/icons";
import { cleanScorecard, shortName } from "@/lib/format";
import type { Company, Research } from "@/lib/types";

type Row = { company: Company; research: Research };
type ActiveJob = { id: string; ticker: string; status: "queued" | "running" };

function summary(scorecard: Record<string, number> | null | undefined): { line: string; muted: boolean } {
  const g = (k: string) => scorecard?.[k] ?? 0;
  const total = g("total");
  const judged = g("delivered") + g("partly") + g("missed");
  if (!total) return { line: "No guidance", muted: true };
  if (judged === 0) return { line: `${total} tracked`, muted: true };
  return { line: `${g("delivered")} of ${judged} kept`, muted: false };
}

export function ResearchIndexClient({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [jobs, setJobs] = useState<ActiveJob[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const touchStart = useRef<{ y: number; x: number } | null>(null);
  const lastJobs = useRef("");

  const refresh = useCallback(() => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    setRefreshing(true);
    router.refresh();
    window.setTimeout(() => setRefreshing(false), 1200);
  }, [router]);

  const loadJobs = useCallback(async () => {
    if (document.visibilityState === "hidden") return;
    try {
      const response = await fetch("/api/research?active=1", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { jobs?: ActiveJob[] };
      const next = data.jobs ?? [];
      const signature = next.map((j) => `${j.id}:${j.status}`).join("|");
      if (signature !== lastJobs.current) {
        const hadJobs = lastJobs.current.length > 0;
        lastJobs.current = signature;
        setJobs(next);
        if (hadJobs || next.length > 0) router.refresh();
      } else {
        setJobs(next);
      }
    } catch {
      // Keep the last good list; a temporary network error must not blank Research.
    }
  }, [router]);

  useEffect(() => {
    // Next.js may restore a cached route segment when navigating back.
    // Force a fresh server render immediately on mount, then track active jobs.
    router.refresh();
    void loadJobs();
    const poll = window.setInterval(() => void loadJobs(), 5000);
    const onResume = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
        void loadJobs();
      }
    };
    window.addEventListener("focus", onResume);
    window.addEventListener("pageshow", onResume);
    document.addEventListener("visibilitychange", onResume);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener("focus", onResume);
      window.removeEventListener("pageshow", onResume);
      document.removeEventListener("visibilitychange", onResume);
    };
  }, [loadJobs, router]);

  const listed = new Set(rows.map(({ company }) => company.nse_symbol.toUpperCase()));
  const pending = jobs.filter((job) => !listed.has(job.ticker.toUpperCase()));

  return (
    <div
      onTouchStart={(event) => {
        if (window.scrollY <= 2) touchStart.current = { y: event.touches[0].clientY, x: event.touches[0].clientX };
        else touchStart.current = null;
      }}
      onTouchEnd={(event) => {
        const start = touchStart.current;
        touchStart.current = null;
        if (!start || window.scrollY > 2) return;
        const dy = event.changedTouches[0].clientY - start.y;
        const dx = Math.abs(event.changedTouches[0].clientX - start.x);
        if (dy > 85 && dy > dx * 1.35 && !refreshing) refresh();
      }}
    >
      <div className="mb-2 flex min-h-5 items-center justify-center" aria-live="polite">
        {refreshing && <span className="inline-flex items-center gap-2 text-[11px] text-muted"><span className="h-3 w-3 animate-spin rounded-full border-2 border-line border-t-ink" />Refreshing research…</span>}
      </div>
      <ul className="space-y-2.5">
        {pending.map((job) => (
          <li key={job.id}>
            <Link href={`/research/${encodeURIComponent(job.ticker)}`} className="card flex items-center gap-3.5 px-4 py-3.5">
              <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl border border-line bg-raised font-mono text-[11px] font-semibold">{job.ticker.slice(0, 4)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-semibold text-ink">{job.ticker}</span>
                <span className="mt-0.5 block text-[11px] text-muted">Research {job.status === "queued" ? "queued" : "in progress"}</span>
              </span>
              <span className="flex w-[124px] shrink-0 flex-col items-end gap-1.5">
                <span className="text-right text-[12px] text-muted">{job.status === "queued" ? "Queued…" : "Reading…"}</span>
                <span className="sk h-1.5 w-full rounded-full" />
              </span>
              <Chevron className="h-4 w-4 shrink-0 text-faint" />
            </Link>
          </li>
        ))}
        {rows.map(({ company, research: r }) => {
          const s = r.scorecard ? cleanScorecard(r.scorecard) : null;
          const info = summary(s);
          return (
            <li key={company.id}>
              <Link href={`/research/${company.nse_symbol}`} className="card flex items-center gap-3.5 px-4 py-3.5 transition-transform active:scale-[0.99]">
                <Avatar symbol={company.nse_symbol} name={company.name} size={42} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold text-ink">{shortName(company.name)}</span>
                  <span className="mt-0.5 block font-mono text-[11px] text-muted">{company.nse_symbol}</span>
                </span>
                <span className="flex w-[124px] shrink-0 flex-col items-stretch gap-1.5">
                  {r.status === "ready" && s ? (
                    <>
                      <span className={`text-right text-[12px] font-semibold tabular-nums ${info.muted ? "text-muted" : "text-ink"}`}>{info.line}</span>
                      <SegmentedBar scorecard={s} compact showLegend={false} />
                    </>
                  ) : r.status === "running" ? (
                    <>
                      <span className="text-right text-[12px] text-muted">Reading…</span>
                      <span className="sk h-1.5 w-full rounded-full" />
                    </>
                  ) : r.status === "no_guidance" ? (
                    <>
                      <span className="text-right text-[12px] text-muted">No guidance</span>
                      <span className="h-1.5 w-full rounded-full bg-line" />
                    </>
                  ) : <span className="text-right text-[12px] capitalize text-muted">{r.status}</span>}
                </span>
                <Chevron className="h-4 w-4 shrink-0 text-faint" />
              </Link>
            </li>
          );
        })}
        {rows.length === 0 && pending.length === 0 && <li className="py-3 text-sm text-muted">Nothing researched yet. Try a ticker above.</li>}
      </ul>
    </div>
  );
}
