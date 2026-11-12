import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canWrite, db } from "@/lib/db";

const Body = z.object({
  categories: z.record(z.string(), z.boolean()),
  volume_multiple: z.number().min(1).max(20),
  price_pct: z.number().min(0.5).max(50),
  digest_time: z.string().regex(/^\d{2}:\d{2}$/),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid settings" }, { status: 400 });
  if (!canWrite()) return NextResponse.json({ error: "Read-only deployment" }, { status: 503 });
  const { error } = await db().from("triggers").update({ ...parsed.data, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) return NextResponse.json({ error: "Could not save" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
