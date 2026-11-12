"""screener.in company page: quarterly numbers and concall transcript links.

Screener's quarterly table is a standardised copy of the company's results filings, so we treat it
as structured primary data (extractor='screener'). Values are in Rs crore.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date

from bs4 import BeautifulSoup

from .http import get_cached

BASE = "https://www.screener.in/company/{sym}/{view}/"
MONTHS = {m: i for i, m in enumerate(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], 1)}

# Screener row label -> our metric name
ROW_METRICS = {
    "sales": "revenue", "revenue": "revenue",
    "operating profit": "operating_profit", "financing profit": "operating_profit",
    "opm %": "opm_pct", "financing margin %": "opm_pct",
    "other income": "other_income", "interest": "interest", "depreciation": "depreciation",
    "profit before tax": "pbt", "net profit": "pat", "eps in rs": "eps",
}


@dataclass
class Concall:
    month: str            # 'Nov 2026'
    transcript_url: str | None
    ppt_url: str | None


@dataclass
class ScreenerPage:
    symbol: str
    name: str
    basis: str                                   # consolidated | standalone
    url: str
    quarters: list[str] = field(default_factory=list)                    # ['Sep 2023', ...]
    rows: dict[str, list[float | None]] = field(default_factory=dict)    # metric -> values per quarter
    concalls: list[Concall] = field(default_factory=list)
    bse_code: str | None = None


def parse_number(text: str) -> float | None:
    t = text.replace(",", "").replace("%", "").strip()
    if t in ("", "-", "--"):
        return None
    try:
        return float(t)
    except ValueError:
        return None


def quarter_label_to_period(label: str) -> str:
    """'Sep 2026' (quarter ended) -> 'Q2 FY27'. Indian fiscal year runs April to March."""
    mon, yr = label.split()
    m, y = MONTHS[mon[:3]], int(yr)
    q = {6: 1, 9: 2, 12: 3, 3: 4}[m]
    fy = y + 1 if m >= 4 else y
    return f"Q{q} FY{fy % 100:02d}"


def period_end(period: str) -> date:
    """'Q2 FY27' -> date(2026, 9, 30)."""
    q, fy = re.match(r"Q(\d) FY(\d\d)", period).groups()
    fy_full = 2000 + int(fy)
    return {1: date(fy_full - 1, 6, 30), 2: date(fy_full - 1, 9, 30), 3: date(fy_full - 1, 12, 31), 4: date(fy_full, 3, 31)}[int(q)]


def concall_period(month_label: str) -> str:
    """A concall held in 'Nov 2026' discusses the quarter that ended before it: 'Q2 FY27'."""
    mon, yr = month_label.split()
    m, y = MONTHS[mon[:3]], int(yr)
    if m <= 3:
        return quarter_label_to_period(f"Dec {y - 1}")
    if m <= 6:
        return quarter_label_to_period(f"Mar {y}")
    if m <= 9:
        return quarter_label_to_period(f"Jun {y}")
    return quarter_label_to_period(f"Sep {y}")


def parse_page(html: str, symbol: str, basis: str, url: str) -> ScreenerPage:
    s = BeautifulSoup(html, "lxml")
    name_el = s.select_one("h1")
    page = ScreenerPage(symbol=symbol, name=name_el.get_text(strip=True) if name_el else symbol, basis=basis, url=url)

    bse = s.find("a", href=re.compile(r"bseindia\.com/stock-share-price/.+/(\d{6})/?"))
    if bse:
        page.bse_code = re.search(r"/(\d{6})/?$", bse["href"].rstrip("/") + "/").group(1) if re.search(r"/(\d{6})/?$", bse["href"]) else None

    table = s.select_one("section#quarters table")
    if table:
        page.quarters = [th.get_text(strip=True) for th in table.select("thead th")][1:]
        for tr in table.select("tbody tr"):
            cells = [td.get_text(strip=True) for td in tr.select("td")]
            if not cells:
                continue
            label = re.sub(r"\s*\+$", "", cells[0]).strip().lower()
            metric = ROW_METRICS.get(label)
            if metric and metric not in page.rows:
                page.rows[metric] = [parse_number(c) for c in cells[1:]]

    for li in s.select("div.concalls li"):
        month_el = li.select_one("div") or li
        month = re.search(r"([A-Z][a-z]{2}) (\d{4})", month_el.get_text(" ", strip=True))
        if not month:
            continue
        tr = ppt = None
        for a in li.select("a"):
            label = a.get_text(strip=True).lower()
            if "transcript" in label and a.get("href", "").startswith("http"):
                tr = a["href"]
            elif label == "ppt":
                ppt = a.get("href")
        page.concalls.append(Concall(month=f"{month.group(1)} {month.group(2)}", transcript_url=tr, ppt_url=ppt))
    return page


def fetch(symbol: str) -> ScreenerPage:
    """Consolidated view first; fall back to standalone when the company has no consolidated numbers."""
    symbol = symbol.upper()
    for view in ("consolidated", "standalone"):
        url = BASE.format(sym=symbol, view=view)
        html = get_cached(url, kind="html").decode("utf-8", errors="replace")
        page = parse_page(html, symbol, view, url)
        if page.quarters and page.rows.get("revenue") and any(v is not None for v in page.rows["revenue"][-4:]):
            return page
    if not page.quarters:
        raise LookupError(f"screener has no quarterly data for {symbol}")
    return page


def quarterly_facts(page: ScreenerPage) -> list[dict]:
    """Facts rows (without company_id) for every quarter and metric on the page."""
    out = []
    for metric, values in page.rows.items():
        for label, v in zip(page.quarters, values):
            if v is None:
                continue
            out.append({
                "period": quarter_label_to_period(label), "metric": metric, "value": v,
                "unit": "pct" if metric.endswith("_pct") else ("rs" if metric == "eps" else "rs_cr"),
                "basis": page.basis, "source_url": page.url, "extractor": "screener", "verified": True,
                "quote": f"{label}: {v}",
            })
    return out
