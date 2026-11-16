"use client";
import { useState } from "react";
import { shortName } from "@/lib/format";

// NSE ticker -> company website, used to fetch its logo. Public company branding,
// not user data. Unmapped tickers (any NSE symbol research runs on) fall back to
// initials, and a failed logo load falls back to initials too.
const DOMAIN: Record<string, string> = {
  RELIANCE: "ril.com",
  HDFCBANK: "hdfcbank.com",
  ICICIBANK: "icicibank.com",
  INFY: "infosys.com",
  BHARTIARTL: "airtel.in",
  LT: "larsentoubro.com",
  BAJFINANCE: "bajajfinserv.in",
  TITAN: "titancompany.in",
  SUNPHARMA: "sunpharma.com",
  TATASTEEL: "tatasteel.com",
  ASIANPAINT: "asianpaints.com",
  CIPLA: "cipla.com",
  LUPIN: "lupin.com",
  TRENT: "trentlimited.com",
  DIXON: "dixoninfo.com",
  PERSISTENT: "persistent.com",
  KPITTECH: "kpit.com",
  SUZLON: "suzlon.com",
  IDEA: "myvi.in",
  TCS: "tcs.com",
  SBIN: "sbi.co.in",
  POLYCAB: "polycab.com",
  WIPRO: "wipro.com",
  TECHM: "techmahindra.com",
  HCLTECH: "hcltech.com",
  MARUTI: "marutisuzuki.com",
  ITC: "itcportal.com",
  AXISBANK: "axisbank.com",
  KOTAKBANK: "kotak.com",
  SBILIFE: "sbilife.co.in",
  ADANIENT: "adani.com",
  NESTLEIND: "nestle.in",
};

function initials(symbol: string, name?: string): string {
  if (name && name.trim()) {
    const words = shortName(name)
      .replace(/[^A-Za-z0-9& ]+/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  }
  return symbol.slice(0, 2).toUpperCase();
}

export function Avatar({ symbol, name, size = 38 }: { symbol: string; name?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const domain = DOMAIN[(symbol || "").toUpperCase()];
  const showLogo = !!domain && !failed;
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center overflow-hidden font-semibold tracking-tight"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        fontSize: size * 0.34,
        background: showLogo ? "#ffffff" : "var(--ink)",
        color: "var(--bg)",
        border: showLogo ? "1px solid var(--line)" : "none",
      }}
    >
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`}
          alt=""
          width={size}
          height={size}
          onError={() => setFailed(true)}
          className="h-full w-full object-contain"
          style={{ padding: size * 0.16 }}
        />
      ) : (
        initials(symbol, name)
      )}
    </span>
  );
}
