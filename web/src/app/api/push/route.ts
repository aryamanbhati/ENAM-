import { NextResponse, type NextRequest } from "next/server";
import webpush from "web-push";
import { z } from "zod";
import { canWrite, db } from "@/lib/db";

const Body = z.object({
  subscription: z.object({ endpoint: z.string().url(), keys: z.object({ p256dh: z.string(), auth: z.string() }) }),
  test: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  if (!canWrite()) return NextResponse.json({ error: "Read-only deployment" }, { status: 503 });
  const { subscription, test } = parsed.data;
  const { error } = await db().from("push_subscriptions").upsert({ endpoint: subscription.endpoint, keys: subscription.keys }, { onConflict: "endpoint" });
  if (error) return NextResponse.json({ error: "Could not save" }, { status: 500 });

  if (test && process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:finn@example.com", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    try {
      await webpush.sendNotification(subscription, JSON.stringify({ title: "FINN", body: "Notifications are on. You will hear from FINN only when something crosses your alerts.", url: "/settings" }));
    } catch {
      /* the subscription is saved; a failed test send is not fatal */
    }
  }
  return NextResponse.json({ ok: true });
}
