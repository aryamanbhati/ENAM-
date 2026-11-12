import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { canWrite, db } from "@/lib/db";

export const dynamic = "force-dynamic";

const PER_IP_PER_HOUR = Number(process.env.FINN_RESEARCH_PER_IP_HOUR ?? 3);
const DAILY_CAP = Number(process.env.FINN_RESEARCH_DAILY_CAP ?? 20);

function requester(req: NextRequest): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  return createHash("sha256").update(`finn:${ip}`).digest("hex").slice(0, 16);
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("job");
  if (!id) return NextResponse.json({ error: "job required" }, { status: 400 });
  const { data } = await db().from("jobs").select("id,status,progress,ticker").eq("id", id).maybeSingle();
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const { symbol: raw } = (await req.json().catch(() => ({}))) as { symbol?: string };
  const symbol = String(raw ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9&-]{1,20}$/.test(symbol)) return NextResponse.json({ error: "That does not look like an NSE ticker." }, { status: 400 });
  if (!canWrite()) return NextResponse.json({ error: "Research is not configured on this deployment." }, { status: 503 });

  // Already researched: open it.
  const { data: company } = await db().from("companies").select("id").eq("nse_symbol", symbol).maybeSingle();
  if (company) {
    const { data: r } = await db().from("research").select("status").eq("company_id", company.id).maybeSingle();
    if (r?.status === "ready" || r?.status === "no_guidance") return NextResponse.json({ ready: true });
  }

  // A run for this ticker already in flight: attach to it.
  const recent = new Date(Date.now() - 15 * 60e3).toISOString();
  const { data: inflight } = await db().from("jobs").select("id").eq("ticker", symbol).in("status", ["queued", "running"]).gte("created_at", recent).limit(1);
  if (inflight?.length) return NextResponse.json({ jobId: inflight[0].id });

  // Cost protection: per-IP rate limit and a global daily budget.
  const who = requester(req);
  const hourAgo = new Date(Date.now() - 3600e3).toISOString();
  const dayAgo = new Date(Date.now() - 86400e3).toISOString();
  const [{ count: mine }, { count: today }] = await Promise.all([
    db().from("jobs").select("id", { count: "exact", head: true }).eq("type", "research").eq("requester", who).gte("created_at", hourAgo),
    db().from("jobs").select("id", { count: "exact", head: true }).eq("type", "research").gte("created_at", dayAgo),
  ]);
  if ((mine ?? 0) >= PER_IP_PER_HOUR) return NextResponse.json({ error: "You have started a few research runs already. Try again in an hour." }, { status: 429 });
  if ((today ?? 0) >= DAILY_CAP) return NextResponse.json({ error: "Today's research budget is used up. New runs resume tomorrow; researched companies still open." }, { status: 429 });

  const { data: job, error } = await db().from("jobs").insert({ type: "research", ticker: symbol, status: "queued", requester: who }).select("id").single();
  if (error || !job) return NextResponse.json({ error: "Could not queue the job." }, { status: 500 });

  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_REPO || "aryamanbhati/ENAM-";
  if (!token) return NextResponse.json({ error: "Research workers are not configured." }, { status: 503 });
  const gh = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/research.yml/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    body: JSON.stringify({ ref: "main", inputs: { ticker: symbol, job_id: job.id } }),
  });
  if (!gh.ok) {
    await db().from("jobs").update({ status: "failed", error: `dispatch ${gh.status}` }).eq("id", job.id);
    return NextResponse.json({ error: "Could not start a worker. Try again shortly." }, { status: 502 });
  }
  return NextResponse.json({ jobId: job.id });
}
