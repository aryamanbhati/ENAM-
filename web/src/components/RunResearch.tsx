"use client";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Step = { t: string; msg: string };

function browserClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/rest\/v1\/?$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

export function RunResearch({ symbol, running, failed }: { symbol: string; running: boolean; failed: boolean }) {
  const router = useRouter();
  const [jobId, setJobId] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
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
      {steps.length > 0 && (
        <ol className="mt-6 space-y-2 text-sm" aria-live="polite">
          {steps.map((s, i) => (
            <li key={i} className={i === steps.length - 1 && busy ? "text-ink" : "text-muted"}>
              {s.msg}
              {i === steps.length - 1 && busy ? "…" : ""}
            </li>
          ))}
        </ol>
      )}
      {running && !jobId && <p className="mt-4 text-sm text-muted">A research run is already in progress. Refresh in a minute.</p>}
    </section>
  );
}
