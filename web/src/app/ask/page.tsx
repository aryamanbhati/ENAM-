"use client";
import { useState } from "react";
import { AnswerView, AskScopeSetter, useAsk } from "@/components/Ask";
import { Masthead } from "@/components/Masthead";
import { Send, Sparkles } from "@/components/icons";

const SUGGESTIONS = [
  "What needs me today?",
  "Summarise HDFC Bank's latest results",
  "What did management promise at KPIT, and did they deliver?",
  "Any unusual price or volume moves this week?",
];

export default function AskPage() {
  const { ask, turns, busy } = useAsk();
  const [q, setQ] = useState("");

  return (
    <>
      <AskScopeSetter scope={{ screen: "today", window: "7d" }} />
      <Masthead title="Ask FINN" sub="Answers from your filings, results and prices" />

      {turns.length === 0 ? (
        <section className="flex flex-col items-center pt-10 pb-28 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-[20px]" style={{ background: "var(--accent-soft)" }}>
            <Sparkles className="h-8 w-8 text-accent" />
          </span>
          <h2 className="mt-5 font-display text-[22px] font-bold tracking-[-0.02em] text-ink">How can I help you today?</h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
            Grounded only in your portfolio&apos;s primary sources. Every answer cites where it came from.
          </p>
          <div className="mt-6 w-full space-y-2.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                className="card flex w-full items-center gap-3 px-4 py-3.5 text-left text-[14px] font-medium text-ink transition-transform active:scale-[0.99]"
              >
                <Sparkles className="h-4 w-4 shrink-0 text-accent" />
                {s}
              </button>
            ))}
          </div>
        </section>
      ) : (
        <div className="space-y-6 pt-4 pb-28">
          {turns.map((t, i) => (
            <div key={i} className="space-y-2.5">
              <div className="ml-auto max-w-[85%] rounded-[18px] rounded-br-md bg-ink px-3.5 py-2 text-[14px] leading-snug text-bg">{t.q}</div>
              {t.a && <AnswerView a={t.a} />}
              {t.error && <p className="text-[14px] text-down">{t.error}</p>}
              {!t.a && !t.error && (
                <div className="space-y-2.5">
                  <p className="flex items-center gap-2 text-[13px] text-muted">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: "var(--accent)" }} />
                    FINN is reading the filings and transcripts…
                  </p>
                  <div className="sk h-3 w-5/6" />
                  <div className="sk h-3 w-4/6" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
          setQ("");
        }}
        className="fixed inset-x-0 z-20 mx-auto max-w-md px-4"
        style={{ bottom: "calc(var(--dock-h) + env(safe-area-inset-bottom))" }}
      >
        <div className="mb-2 flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 shadow-[var(--shadow-soft)]">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            disabled={busy}
            placeholder="Ask a question…"
            className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted"
          />
          <button type="submit" disabled={busy || !q.trim()} aria-label="Send" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-bg transition-opacity disabled:opacity-35">
            <Send className="h-[18px] w-[18px]" />
          </button>
        </div>
      </form>
    </>
  );
}
