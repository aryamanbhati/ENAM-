"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function TickerSearch() {
  const [q, setQ] = useState("");
  const router = useRouter();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const s = q.trim().toUpperCase().replace(/\.NS$/, "");
        if (/^[A-Z0-9&-]{1,20}$/.test(s)) router.push(`/research/${encodeURIComponent(s)}`);
      }}
      className="flex gap-2"
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Any NSE ticker, e.g. PERSISTENT"
        autoCapitalize="characters"
        className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm uppercase outline-none placeholder:normal-case placeholder:text-muted focus:border-ink"
        aria-label="NSE ticker"
      />
      <button className="rounded-lg bg-ink px-4 text-sm text-bg">Open</button>
    </form>
  );
}
