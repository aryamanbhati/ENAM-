import { NextResponse, type NextRequest } from "next/server";
import OpenAI from "openai";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Text-to-speech using OpenAI's tts-1-hd, voice "nova" (a warm, near-neutral
 * English voice that sounds closest to a human presenter among the shipped
 * voices). The audio streams back as mp3 so the client can start playing as
 * the bytes arrive; the whole thing is behind a per-IP rate limit so a bot
 * cannot drain the key.
 */
const hits = new Map<string, number[]>();

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "TTS not configured" }, { status: 503 });
  }
  const { text } = (await req.json().catch(() => ({ text: "" }))) as { text?: string };
  const clean = (text ?? "").trim().slice(0, 1800);
  if (!clean) return NextResponse.json({ error: "Nothing to read" }, { status: 400 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60e3);
  if (recent.length >= 6) return NextResponse.json({ error: "Too many listen requests. Give it a minute." }, { status: 429 });
  hits.set(ip, [...recent, now]);

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const r = await openai.audio.speech.create({
      model: "tts-1-hd",
      voice: "nova",
      input: clean,
      response_format: "mp3",
      speed: 1.05,
    });
    return new Response(r.body, {
      headers: {
        "content-type": "audio/mpeg",
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    console.error("tts failed", e);
    return NextResponse.json({ error: "Voice not available right now." }, { status: 503 });
  }
}
