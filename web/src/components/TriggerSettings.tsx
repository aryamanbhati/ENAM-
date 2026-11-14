"use client";
import { useEffect, useState } from "react";
import { CATEGORY_LABELS } from "@/lib/format";
import type { Triggers } from "@/lib/types";

const CATS = ["results", "M&A", "management_change", "fund_raise", "litigation", "credit_rating", "pledging", "dividend", "bonus_split", "insider_trading", "capex"];
const HINT: Record<string, string> = {
  results: "Quarterly and annual results",
  "M&A": "Acquisitions, mergers, stake sales, joint ventures",
  management_change: "CEO, CFO, MD or director joining or leaving",
  fund_raise: "QIPs, rights, preferential issues, buybacks, debt",
  litigation: "Lawsuits, regulatory orders, insolvency",
  credit_rating: "Upgrades, downgrades, reaffirmations",
  pledging: "Promoter pledges and releases",
  dividend: "Dividends declared",
  bonus_split: "Bonus issues and stock splits",
  insider_trading: "Insiders or large holders trading",
  capex: "New plants and capacity",
};

function b64ToBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function TriggerSettings({ initial, vapidKey }: { initial: Triggers; vapidKey: string }) {
  const [t, setT] = useState(initial);
  const [saved, setSaved] = useState<string | null>(null);
  const [push, setPush] = useState<"unknown" | "unsupported" | "needs-install" | "off" | "on" | "denied">("unknown");

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        const ios = /iphone|ipad/i.test(navigator.userAgent);
        const standalone = window.matchMedia("(display-mode: standalone)").matches;
        return setPush(ios && !standalone ? "needs-install" : "unsupported");
      }
      if (Notification.permission === "denied") return setPush("denied");
      const reg = await navigator.serviceWorker.ready;
      setPush((await reg.pushManager.getSubscription()) ? "on" : "off");
    })();
  }, []);

  async function save(next: Triggers) {
    setT(next);
    setSaved("Saving");
    const r = await fetch("/api/triggers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
    setSaved(r.ok ? "Saved" : "Could not save");
    setTimeout(() => setSaved(null), 1500);
  }

  async function enablePush() {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return setPush("denied");
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(vapidKey) });
    const r = await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON(), test: true }) });
    setPush(r.ok ? "on" : "off");
  }

  return (
    <div className="space-y-8 pt-5">
      <p className="text-sm text-muted">
        Anything that matches an alert goes to the top of Today under Needs you, and sends one notification. Turning an alert off never hides anything: it moves to Worth knowing.
      </p>

      <section>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Notifications</h2>
        {push === "on" && <p className="text-sm">On for this device.</p>}
        {push === "off" && vapidKey && (
          <button onClick={enablePush} className="rounded-full bg-ink px-4 py-2 text-sm text-bg">
            Turn on notifications
          </button>
        )}
        {push === "needs-install" && <p className="text-sm">On iPhone, tap Share, then Add to Home Screen, and open FINN from there to turn on notifications.</p>}
        {push === "denied" && <p className="text-sm text-muted">Notifications are blocked in your browser settings.</p>}
        {push === "unsupported" && <p className="text-sm text-muted">This browser does not support web notifications.</p>}
      </section>

      <section>
        <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Market moves</h2>
        <Slider label="Price move in a day" value={t.price_pct} min={1} max={15} step={0.5} unit="%" prefix="±" onChange={(v) => save({ ...t, price_pct: v })} />
        <Slider label="Volume above its 20-day average" value={t.volume_multiple} min={1.2} max={6} step={0.1} unit="×" onChange={(v) => save({ ...t, volume_multiple: v })} />
      </section>

      <section>
        <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Announcements</h2>
        <ul className="divide-y divide-line">
          {CATS.map((c) => (
            <li key={c} className="flex items-center justify-between gap-4 py-3">
              <span>
                <span className="block text-sm">{CATEGORY_LABELS[c]}</span>
                <span className="block text-xs text-muted">{HINT[c]}</span>
              </span>
              <Toggle on={!!t.categories[c]} label={CATEGORY_LABELS[c]} onChange={(on) => save({ ...t, categories: { ...t.categories, [c]: on } })} />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Morning digest</h2>
        <label className="flex items-center justify-between py-2 text-sm">
          Notify me at
          <input type="time" value={t.digest_time} onChange={(e) => save({ ...t, digest_time: e.target.value })} className="rounded border border-line bg-surface px-2 py-1 tabular-nums" />
        </label>
      </section>
      <p className="h-4 text-xs text-muted" aria-live="polite">
        {saved}
      </p>
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${on ? "bg-[var(--accent)]" : "bg-line"}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${on ? "translate-x-[18px]" : "translate-x-0.5"}`} />
    </button>
  );
}

function Slider(p: { label: string; value: number; min: number; max: number; step: number; unit: string; prefix?: string; onChange: (v: number) => void }) {
  const [v, setV] = useState(p.value);
  return (
    <label className="block py-3">
      <span className="flex justify-between text-sm">
        {p.label}
        <span className="tabular-nums">
          {p.prefix}
          {v}
          {p.unit}
        </span>
      </span>
      <input type="range" min={p.min} max={p.max} step={p.step} value={v} onChange={(e) => setV(Number(e.target.value))} onPointerUp={() => p.onChange(v)} onKeyUp={() => p.onChange(v)} className="mt-2 w-full accent-current" />
    </label>
  );
}
