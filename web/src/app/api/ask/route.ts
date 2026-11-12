import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { answer, type Scope } from "@/lib/assistant";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  question: z.string().min(2).max(400),
  scope: z.record(z.string(), z.unknown()).refine((s) => typeof s.screen === "string"),
  history: z.array(z.object({ q: z.string().max(400), a: z.string().max(2000) })).max(3).default([]),
});

const hits = new Map<string, number[]>();

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ask a question in a sentence or two." }, { status: 400 });

  // Per-IP rate limit (best effort, per server instance): 20 questions a minute.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60e3);
  if (recent.length >= 20) return NextResponse.json({ error: "Too many questions at once. Give it a minute." }, { status: 429 });
  hits.set(ip, [...recent, now]);

  try {
    const out = await answer(parsed.data.question, parsed.data.scope as unknown as Scope, parsed.data.history);
    return NextResponse.json(out);
  } catch (e) {
    console.error("ask failed", e);
    return NextResponse.json({ error: "FINN could not answer right now. The model may be busy; try again." }, { status: 503 });
  }
}
