"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Close, Mic } from "./icons";

/** What the assistant knows about where the user is. Set by each screen and by the open card. */
export type AskScope =
  | { screen: "today"; window: string }
  | { screen: "portfolio" }
  | { screen: "company"; symbol: string; companyId: number }
  | { screen: "research"; symbol: string; companyId: number; promise?: string }
  | { screen: "filing"; filingId: string; companyId: number; symbol: string }
  | { screen: "signal"; companyId: number; symbol: string; date: string };

type Source = { id: string; label: string; href?: string | null };
type Answer = {
  text: string;
  sources: Source[];
  trace?: { agents: string[]; tokens: number; cost: number; ms: number; cached: boolean; removed: number };
  pointer?: string | null;
};
type Turn = { q: string; a?: Answer; error?: string };

type Ctx = { scope: AskScope; setScope: (s: AskScope) => void; ask: (q: string) => void; open: boolean; setOpen: (o: boolean) => void };
const AskCtx = createContext<Ctx | null>(null);

export function useAsk() {
  const c = useContext(AskCtx);
  if (!c) throw new Error("useAsk outside provider");
  return c;
}

/** Screens call this to tell the assistant what is on screen. */
export function AskScopeSetter({ scope }: { scope: AskScope }) {
  const { setScope } = useAsk();
  const key = JSON.stringify(scope);
  useEffect(() => setScope(JSON.parse(key)), [key, setScope]);
  return null;
}

export function AskProvider({ children }: { children: React.ReactNode }) {
  const [scope, setScopeState] = useState<AskScope>({ screen: "today", window: "24h" });
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const scopeKey = useRef("");

  const setScope = useCallback((s: AskScope) => {
    const k = JSON.stringify(s);
    if (k !== scopeKey.current) {
      scopeKey.current = k;
      setScopeState(s);
      setTurns([]); // knowledge scope follows the screen, so memory resets with it
    }
  }, []);

  const ask = useCallback(
    async (q: string) => {
      const question = q.trim();
      if (!question || busy) return;
      setOpen(true);
      setBusy(true);
      setTurns((t) => [...t, { q: question }]);
      try {
        const history = turns.filter((t) => t.a).slice(-3).map((t) => ({ q: t.q, a: t.a!.text }));
        const r = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question, scope, history }) });
        const data = await r.json();
        setTurns((t) => t.map((x, i) => (i === t.length - 1 ? (r.ok ? { ...x, a: data } : { ...x, error: data.error ?? "Something went wrong." }) : x)));
      } catch {
        setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, error: "Could not reach FINN. Try again." } : x)));
      } finally {
        setBusy(false);
      }
    },
    [busy, scope, turns],
  );

  return (
    <AskCtx.Provider value={{ scope, setScope, ask, open, setOpen }}>
      {children}
      <AskBar />
      <AskSheet turns={turns} busy={busy} />
    </AskCtx.Provider>
  );
}

const PLACEHOLDER: Record<AskScope["screen"], string> = {
  today: "Ask about today's filings and moves",
  portfolio: "Ask about your holdings",
  company: "Ask about this company",
  research: "Ask about this company's promises",
  filing: "Ask about this filing",
  signal: "Ask about this move",
};

function useSpeech(onText: (t: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const rec = useRef<{ start: () => void; stop: () => void } | null>(null);
  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;
    setSupported(true);
    const r = new SR() as {
      lang: string; interimResults: boolean; start: () => void; stop: () => void;
      onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void;
    };
    r.lang = "en-IN";
    r.interimResults = false;
    r.onresult = (e) => onText(e.results[0][0].transcript);
    r.onend = () => setListening(false);
    rec.current = r;
  }, [onText]);
  return {
    supported,
    listening,
    toggle: () => {
      if (!rec.current) return;
      if (listening) rec.current.stop();
      else {
        setListening(true);
        rec.current.start();
      }
    },
  };
}

function AskBar() {
  const { scope, ask, open } = useAsk();
  const [q, setQ] = useState("");
  const speech = useSpeech(useCallback((t: string) => ask(t), [ask]));
  if (open) return null;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        ask(q);
        setQ("");
      }}
      className="fixed inset-x-0 bottom-[calc(52px+env(safe-area-inset-bottom))] z-[45] px-4 pb-2"
    >
      <div className="mx-auto flex max-w-md items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={PLACEHOLDER[scope.screen]}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
          aria-label="Ask FINN"
        />
        {speech.supported && (
          <button type="button" onClick={speech.toggle} aria-label={speech.listening ? "Stop listening" : "Speak your question"} className={`-m-1 p-1 ${speech.listening ? "text-down" : "text-muted"}`}>
            <Mic className="h-4 w-4" />
          </button>
        )}
      </div>
    </form>
  );
}

function AskSheet({ turns, busy }: { turns: Turn[]; busy: boolean }) {
  const { open, setOpen, ask, scope } = useAsk();
  const [q, setQ] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [turns, busy]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-label="Ask FINN">
      <button className="absolute inset-0 bg-black/25" aria-label="Close" onClick={() => setOpen(false)} />
      <div className="sheet-in relative mx-auto flex max-h-[62dvh] w-full max-w-md flex-col rounded-t-2xl border border-line bg-surface pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <span className="text-xs text-muted">{scopeLabel(scope)}</span>
          <button onClick={() => setOpen(false)} aria-label="Close" className="-m-2 p-2 text-muted">
            <Close className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-3">
          {turns.map((t, i) => (
            <div key={i} className="space-y-2">
              <p className="text-sm font-medium">{t.q}</p>
              {t.a && <AnswerView a={t.a} />}
              {t.error && <p className="text-sm text-down">{t.error}</p>}
              {!t.a && !t.error && <p className="text-sm text-muted">Reading the sources…</p>}
            </div>
          ))}
          <div ref={end} />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(q);
            setQ("");
          }}
          className="border-t border-line px-4 py-3"
        >
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} disabled={busy} placeholder="Ask a follow-up" className="w-full bg-transparent text-sm outline-none placeholder:text-muted" />
        </form>
      </div>
    </div>
  );
}

function scopeLabel(s: AskScope): string {
  switch (s.screen) {
    case "today":
      return `Reading your portfolio's filings and prices, last ${s.window}`;
    case "portfolio":
      return "Reading your portfolio's filings and prices";
    case "company":
      return `Reading ${s.symbol}'s filings and prices`;
    case "research":
      return `Reading ${s.symbol}'s transcripts and results only`;
    case "filing":
      return `Reading this ${s.symbol} filing`;
    case "signal":
      return `Reading ${s.symbol}'s prices and filings`;
  }
}

function AnswerView({ a }: { a: Answer }) {
  const [showTrace, setShowTrace] = useState(false);
  const parts = a.text.split(/(\[[a-z]\d+\])/g);
  const byId = new Map(a.sources.map((s) => [s.id, s]));
  return (
    <div className="space-y-2">
      <p className="font-serif text-[15px] leading-relaxed">
        {parts.map((p, i) => {
          const m = p.match(/^\[([a-z]\d+)\]$/);
          if (!m) return <span key={i}>{p}</span>;
          const s = byId.get(m[1]);
          if (!s) return null;
          return s.href ? (
            <a key={i} href={s.href} target="_blank" rel="noreferrer" title={s.label} className="mx-0.5 inline-flex rounded border border-line px-1 align-[2px] font-sans text-[10px] tabular-nums text-muted hover:text-ink">
              {s.id}
            </a>
          ) : (
            <span key={i} title={s.label} className="mx-0.5 inline-flex rounded border border-line px-1 align-[2px] font-sans text-[10px] text-muted">
              {s.id}
            </span>
          );
        })}
      </p>
      {a.pointer && <p className="text-xs text-muted">See: {a.pointer}</p>}
      {a.sources.length > 0 && (
        <ul className="space-y-0.5 text-xs text-muted">
          {a.sources.map((s) => (
            <li key={s.id}>
              <span className="tabular-nums">{s.id}</span>{" "}
              {s.href ? (
                <a href={s.href} target="_blank" rel="noreferrer" className="underline decoration-line underline-offset-2 hover:text-ink">
                  {s.label}
                </a>
              ) : (
                s.label
              )}
            </li>
          ))}
        </ul>
      )}
      {a.trace && (
        <button onClick={() => setShowTrace((v) => !v)} className="text-[11px] text-muted underline decoration-line underline-offset-2">
          How I answered this
        </button>
      )}
      {a.trace && showTrace && (
        <p className="text-[11px] leading-relaxed text-muted">
          {a.trace.cached ? "Answered from cache. " : ""}
          Agents: {a.trace.agents.join(", ")}. {a.sources.length} source{a.sources.length === 1 ? "" : "s"}.{" "}
          {a.trace.removed > 0 ? `${a.trace.removed} uncited sentence${a.trace.removed === 1 ? "" : "s"} removed. ` : ""}
          {a.trace.tokens.toLocaleString("en-IN")} tokens, ${a.trace.cost.toFixed(4)}, {(a.trace.ms / 1000).toFixed(1)}s.
        </p>
      )}
    </div>
  );
}
