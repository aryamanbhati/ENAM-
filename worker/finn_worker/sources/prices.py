"""End-of-day prices from Yahoo Finance (yfinance). NSE tickers use the .NS suffix."""
from __future__ import annotations

import logging
from datetime import date

import pandas as pd

log = logging.getLogger(__name__)


def fetch_eod(yahoo_symbols: list[str], period: str = "3mo") -> dict[str, list[dict]]:
    """Return {yahoo_symbol: [{date, open, high, low, close, volume}, ...]} oldest first."""
    import yfinance as yf

    df = yf.download(yahoo_symbols, period=period, interval="1d", group_by="ticker",
                     auto_adjust=False, progress=False, threads=True)
    out: dict[str, list[dict]] = {}
    for sym in yahoo_symbols:
        try:
            sub = df[sym] if isinstance(df.columns, pd.MultiIndex) else df
        except KeyError:
            log.warning("No price data for %s", sym)
            continue
        out[sym] = frame_to_rows(sub)
    return out


def frame_to_rows(sub: pd.DataFrame) -> list[dict]:
    """Pure: a single-ticker OHLCV frame into rows, dropping days with no close."""
    rows = []
    for idx, r in sub.iterrows():
        close = r.get("Close")
        if close is None or pd.isna(close):
            continue
        d: date = idx.date() if hasattr(idx, "date") else idx
        vol = r.get("Volume")
        rows.append({
            "date": d.isoformat(),
            "open": _f(r.get("Open")), "high": _f(r.get("High")), "low": _f(r.get("Low")),
            "close": _f(close), "volume": int(vol) if vol is not None and not pd.isna(vol) else None,
        })
    return rows


def _f(v: object) -> float | None:
    if v is None or pd.isna(v):
        return None
    return round(float(v), 4)
