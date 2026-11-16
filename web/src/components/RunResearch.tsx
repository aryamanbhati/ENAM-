"use client";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Step = { t: string; msg: string };

/**
 * Estimate how far the research run has got from its progress messages, so the
 * UI can show a determinate-ish bar instead of a wall of text. Monotonic (only
 * moves forward); capped at 97% until the job reports done.
 */
function researchProgress(steps: Step[], status: string): { pct: number; label: string } {
  const label = steps.length ? steps[steps.length - 1].msg : "Starting the worker";
  if (status === "done") return { pct: 100, label: "Done" };
  let pct = 5;
  let transcriptsDone = 0;
  for (const s of steps) {
    const m = s.msg.toLowerCase();
    if (m.includes("queued") || m.includes("starting") || m.includes("worker")) pct = Math.max(pct, 7);
    if (m.includes("looking up")) pct = Math.max(pct, 14);
    if (m.includes("quarters of results")) pct = Math.max(pct, 22);
    if (m.includes("transcript")) pct = Math.max(pct, 28);
    if (/verified.*dropped/.test(m)) transcriptsDone++;
    if (m.includes("linking")) pct = Math.max(pct, 72);
    if (m.includes("checking promises")) pct = Math.max(pct, 80);
    if (m.includes("judging")) pct = Math.max(pct, 88);
    if (m.includes("writing the scorecard")) pct = Math.max(pct, 95);
  }
  if (transcriptsDone > 0) pct = Math.max(pct, Math.min(30 + transcriptsDone * 6, 66));
  return { pct: Math.min(pct, 97), label };
}

function browserClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/rest\/v1\/?$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

export function RunResearch({ symbol, running, failed, jobId: initialJobId = null, initialSteps = [] }: { symbol: string; running: boolean; failed: boolean; jobId?: string | null; initialSteps?: Step[] }) {
  const router = useRouter();
  const [jobId, setJobId] = useState<string | null>(initialJobId);
  const [steps, setSteps] = useState<Step[]>(initialSteps);
  const [status, setStatus] = useState<string>(running ? "running" : "idle");
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  async function start() {
    if (started.current) return;
    started.current = true;
    setError(null);
    setStatus("queued");
    const r = await fetch("/api/research", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ symbol }) });
    const data = await r.json();
    if (!r.ok) {
      setError(data.error ?? "Could not start research.");
      setStatus("idle");
      started.current = false;
      return;
    }
    if (data.ready) return router.refresh();
    setJobId(data.jobId);
    setSteps([{ t: new Date().toISOString(), msg: "Queued. Starting a worker, this takes about 30 seconds" }]);
  }

  // Live progress: Supabase realtime on the job row, with a polling fallback.
  useEffect(() => {
    if (!jobId) return;
    const sb = browserClient();
    let stop = false;
    const apply = (row: { status: string; progress: Step[] }) => {
      if (row.progress?.length) setSteps(row.progress);
      setStatus(row.status);
      if (row.status === "done") setTimeout(() => router.refresh(), 600);
    };
    const ch = sb
      ?.channel(`job-${jobId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "jobs", filter: `id=eq.${jobId}` }, (p) => apply(p.new as never))
      .subscribe();
    const poll = async () => {
      while (!stop) {
        await new Promise((r) => setTimeout(r, 4000));
        const r = await fetch(`/api/research?job=${jobId}`);
        if (r.ok) apply(await r.json());
      }
    };
    poll();
    return () => {
      stop = true;
      if (ch) sb?.removeChannel(ch);
    };
  }, [jobId, router]);

  const busy = status === "queued" || status === "running";
  return (
    <section className="pt-6">
      <p className="font-serif text-[26px] leading-tight">{busy ? `Reading ${symbol}.` : `${symbol} has not been researched yet.`}</p>
      <p className="mt-2 text-sm text-muted">
        FINN reads the last six concall transcripts and the quarterly results, lists what management committed to, checks every quote, and works out what was delivered. It takes two to four minutes the first
        time; after that it opens instantly.
      </p>
      {!busy && (
        <button onClick={start} className="mt-5 rounded-full bg-ink px-5 py-2 text-sm text-bg">
          {failed ? "Try again" : `Research ${symbol}`}
        </button>
      )}
      {error && <p className="mt-3 text-sm text-down">{error}</p>}
      {status === "failed" && <p className="mt-3 text-sm text-down">Research failed. The source may not have this company, or it may be temporarily unavailable.</p>}
      {steps.length > 0 && (() => {
        const { pct, label } = researchProgress(steps, status);
        return (
          <div className="mt-6">
            {busy && (
              <div className="card p-5" aria-live="polite">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-[13.5px] font-medium text-ink">
                    <span className="pulse-dot h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--accent)" }} />
                    <span className="truncate">{label}</span>
                  </span>
                  <span className="shrink-0 text-[15px] font-semibold tabular-nums text-ink">{pct}%</span>
                </div>
                <div className="relative mt-3 h-2.5 overflow-hidden rounded-full bg-raised">
                  <div className="absolute inset-y-0 left-0 overflow-hidden rounded-full bg-ink" style={{ width: `${pct}%`, transition: "width 600ms var(--e-std)" }}>
                    <span className="bar-sheen" />
                  </div>
                </div>
                <p className="mt-2.5 text-[11.5px] text-muted">Two to four minutes on a new company. It keeps running even if you leave this screen.</p>
              </div>
            )}
            <ol className="mt-4 space-y-1.5 text-[12.5px] text-muted">
              {steps.slice(-6).map((s, i, a) => (
                <li key={i} className={i === a.length - 1 && busy ? "text-ink" : ""}>
                  {s.msg}
                </li>
              ))}
            </ol>
          </div>
        );
      })()}
      {running && !jobId && <p className="mt-4 text-sm text-muted">A research run is already in progress. Refresh in a minute.</p>}
    </section>
  );
}
