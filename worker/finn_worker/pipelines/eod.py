"""Pipeline B: end of day. Prices, day move and volume vs 20-day average, signals, alerts.

All maths in code (guardrail 1). A signal is stored only when it crosses the user's
threshold; it is then joined with filings from the 48 hours around it, so the UI can
say "explained by results" or "no filing explains this move".
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone

log = logging.getLogger(__name__)

TIER_RANK = {"needs_you": 0, "worth_knowing": 1, "routine": 2}


def day_metrics(rows: list[dict], window: int = 20) -> dict | None:
    """Pure: metrics for the latest day in `rows` (oldest first).

    move_pct: close vs previous close, in percent.
    volume_multiple: latest volume / mean volume of the previous `window` days.
    """
    rows = [r for r in rows if r.get("close") is not None]
    if len(rows) < 2:
        return None
    last, prev = rows[-1], rows[-2]
    move = (last["close"] / prev["close"] - 1) * 100 if prev["close"] else None
    hist = [r["volume"] for r in rows[-1 - window : -1] if r.get("volume")]
    vol_mult = None
    if last.get("volume") and len(hist) >= max(5, window // 2):
        avg = sum(hist) / len(hist)
        vol_mult = last["volume"] / avg if avg else None
    return {"date": last["date"], "close": last["close"], "move_pct": move, "volume_multiple": vol_mult}


def signals_for(company_id: int, m: dict, price_pct: float, volume_multiple: float) -> list[dict]:
    """Pure: threshold checks for one company's latest day."""
    out = []
    if m.get("move_pct") is not None and abs(m["move_pct"]) >= price_pct:
        out.append({"company_id": company_id, "date": m["date"], "type": "price_move",
                    "value": round(m["move_pct"], 2), "threshold": price_pct})
    if m.get("volume_multiple") is not None and m["volume_multiple"] >= volume_multiple:
        out.append({"company_id": company_id, "date": m["date"], "type": "volume_spike",
                    "value": round(m["volume_multiple"], 2), "threshold": volume_multiple})
    return out


def explaining_filing(signal_date: str, filings: list[dict]) -> str | None:
    """Pure: the most material filing from the 48 hours before the close (or the same evening)."""
    d = date.fromisoformat(signal_date)
    start = datetime(d.year, d.month, d.day, tzinfo=timezone(timedelta(hours=5, minutes=30))) - timedelta(hours=48)
    end = start + timedelta(hours=48 + 24)
    cands = []
    for f in filings:
        t = datetime.fromisoformat(f["filed_at"])
        if start <= t < end and f["tier"] != "routine":
            cands.append((TIER_RANK[f["tier"]], -t.timestamp(), f["id"]))
    return min(cands)[2] if cands else None


def run(dry_run: bool = False, period: str = "3mo", backfill_days: int = 0) -> dict:
    from ..db import Db
    from ..sources.prices import fetch_eod

    db = Db()
    companies = db.select("companies", {"select": "id,nse_symbol,yahoo_symbol"})
    trig = db.select("triggers", {"select": "price_pct,volume_multiple", "id": "eq.1"})[0]
    price_pct, vol_mult = float(trig["price_pct"]), float(trig["volume_multiple"])

    by_sym = {c["yahoo_symbol"]: c for c in companies if c.get("yahoo_symbol")}
    data = fetch_eod(list(by_sym), period=period)

    price_rows, signals = [], []
    since = (datetime.now(timezone.utc) - timedelta(days=5 + backfill_days * 1.5)).isoformat()
    recent = db.select("filings", {"select": "id,company_id,filed_at,tier", "filed_at": f"gte.{since}"})
    for sym, rows in data.items():
        c = by_sym[sym]
        price_rows += [{"company_id": c["id"], **r} for r in rows]
        m = day_metrics(rows)
        if not m:
            continue
        # Latest day always; with --backfill-days also each earlier trading day (prefix of rows).
        ends = range(max(2, len(rows) - backfill_days), len(rows) + 1) if backfill_days else [len(rows)]
        for end in ends:
            mm = day_metrics(rows[:end])
            if not mm:
                continue
            for s in signals_for(c["id"], mm, price_pct, vol_mult):
                s["explained_by_filing_id"] = explaining_filing(s["date"], [f for f in recent if f["company_id"] == c["id"]])
                signals.append(s)
        log.info("%-11s close=%s move=%s vol=%s", c["nse_symbol"], m["close"],
                 None if m["move_pct"] is None else f"{m['move_pct']:+.2f}%",
                 None if m["volume_multiple"] is None else f"{m['volume_multiple']:.2f}x")

    summary = {"companies": len(data), "price_rows": len(price_rows), "signals": signals}
    if dry_run:
        return summary
    db.upsert("prices_eod", price_rows, on_conflict="company_id,date")
    db.upsert("signals", signals, on_conflict="company_id,date,type")
    alerts = [{"source_type": "signal", "source_id": f"{s['company_id']}:{s['date']}:{s['type']}", "trigger": s["type"]}
              for s in signals]
    db.upsert("alerts", alerts, on_conflict="source_type,source_id", ignore_duplicates=True)
    summary["alerts"] = len(alerts)
    return summary
