"""BSE corporate announcements.

BSE's API sits behind Akamai and rejects plain httpx clients, so we use the
`bse` package (requests with browser-like headers). Requests are rate limited
and retried with exponential backoff, because BSE intermittently returns an
empty body under load.
"""
from __future__ import annotations

import logging
import re
import time
from datetime import datetime, timedelta, timezone

from ..config import CACHE_DIR
from ..models import RawFiling

log = logging.getLogger(__name__)

IST = timezone(timedelta(hours=5, minutes=30))
PDF_BASE = "https://www.bseindia.com/stockinfo/AnnPdfOpen.aspx?Pname="
PAGE_SIZE = 50
MIN_INTERVAL_S = 1.5


def parse_bse_datetime(value: str) -> datetime:
    """BSE timestamps are naive IST like '2026-11-12T20:22:14.477'."""
    value = value.strip()
    if "." in value:
        head, frac = value.split(".", 1)
        value = f"{head}.{frac[:6].ljust(6, '0')}"
    for fmt in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(value, fmt).replace(tzinfo=IST)
        except ValueError:
            continue
    raise ValueError(f"Unrecognised BSE datetime: {value!r}")


def _clean(value: object) -> str | None:
    if value is None:
        return None
    text = " ".join(str(value).split())
    return text or None


def parse_announcement(row: dict) -> RawFiling:
    """Pure: one row of BSE's AnnSubCategoryGetData 'Table' into a RawFiling."""
    attachment = _clean(row.get("ATTACHMENTNAME"))
    return RawFiling(
        id=str(row["NEWSID"]).strip(),
        bse_code=str(row["SCRIP_CD"]).strip(),
        filed_at=parse_bse_datetime(row.get("NEWS_DT") or row["DT_TM"]),
        category=_clean(row.get("CATEGORYNAME")),
        subcategory=_clean(row.get("SUBCATNAME")),
        subject=_clean(row.get("NEWSSUB")) or "",
        headline=_clean(row.get("HEADLINE")),
        pdf_url=f"{PDF_BASE}{attachment}" if attachment else None,
        raw=row,
    )


class BseClient:
    def __init__(self) -> None:
        from bse import BSE  # imported lazily so parsers stay importable without network deps

        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        self._bse = BSE(download_folder=str(CACHE_DIR))
        self._last = 0.0

    def close(self) -> None:
        self._bse.exit()

    def __enter__(self) -> "BseClient":
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def _throttle(self) -> None:
        wait = MIN_INTERVAL_S - (time.monotonic() - self._last)
        if wait > 0:
            time.sleep(wait)
        self._last = time.monotonic()

    def _page(self, scripcode: str, frm: datetime, to: datetime, page: int, attempts: int = 4) -> list[dict]:
        for attempt in range(attempts):
            self._throttle()
            try:
                data = self._bse.announcements(page_no=page, from_date=frm, to_date=to, scripcode=scripcode)
                return data.get("Table", []) or []
            except Exception as exc:  # BSE returns HTML or empty bodies when throttling
                delay = 4 * 2**attempt
                log.warning("BSE page failed (%s %s p%d, attempt %d): %s; retrying in %ds",
                            scripcode, frm.date(), page, attempt + 1, type(exc).__name__, delay)
                time.sleep(delay)
        raise RuntimeError(f"BSE announcements unavailable for {scripcode}")

    def transcript_filings(self, scripcode: str, months: int = 18, n: int = 6) -> list[tuple[str, str]]:
        """Concall transcript PDFs filed on BSE, as (period, url) oldest first.

        A fallback for companies whose screener page lists concalls but does not
        link the transcript PDF (e.g. ITC). The transcript is still filed on BSE
        as an announcement, so we find it there. One per quarter, latest filing
        wins; the earnings-call month maps to the quarter it discusses.
        """
        from .screener import concall_period, period_end  # lazy: avoids an import cycle

        since = datetime.now(IST) - timedelta(days=int(months * 30.5))
        filings = self.announcements(scripcode, since)
        by_period: dict[str, tuple[datetime, str]] = {}
        for f in filings:
            text = " ".join(x for x in (f.subcategory, f.subject, f.headline) if x)
            # "Transcript" of the earnings call, not the audio/video recording on its own.
            if not f.pdf_url or not re.search(r"transcript", text, re.I):
                continue
            try:
                period = concall_period(f.filed_at.strftime("%b %Y"))
            except Exception:
                continue
            prev = by_period.get(period)
            if prev is None or f.filed_at > prev[0]:
                by_period[period] = (f.filed_at, f.pdf_url)
        periods = sorted(by_period, key=period_end)[-n:]
        return [(p, by_period[p][1]) for p in periods]

    def announcements(self, scripcode: str, since: datetime, until: datetime | None = None) -> list[RawFiling]:
        until = until or datetime.now(IST)
        frm = since.astimezone(IST).replace(tzinfo=None)
        to = until.astimezone(IST).replace(tzinfo=None)
        rows: list[dict] = []
        for page in range(1, 21):
            batch = self._page(scripcode, frm, to, page)
            rows.extend(batch)
            if len(batch) < PAGE_SIZE:
                break
        filings = [parse_announcement(r) for r in rows if r.get("NEWSID")]
        return [f for f in filings if f.filed_at >= since]
