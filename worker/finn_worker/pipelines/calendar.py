"""Upcoming results dates for the portfolio, from BSE's results calendar (feeds the upcoming strip)."""
from __future__ import annotations

import logging
from datetime import datetime

from ..config import CACHE_DIR
from ..db import Db

log = logging.getLogger(__name__)


def parse_meeting_date(s: str) -> str | None:
    for fmt in ("%d %b %Y", "%d-%b-%Y", "%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s.strip(), fmt).date().isoformat()
        except ValueError:
            continue
    return None


def run() -> dict:
    from bse import BSE

    db = Db()
    companies = {c["bse_code"]: c["id"] for c in db.select("companies", {"select": "id,bse_code", "bse_code": "not.is.null"})}
    with BSE(download_folder=str(CACHE_DIR)) as b:
        rows = b.resultCalendar()
    events = []
    for r in rows:
        cid = companies.get(str(r.get("scrip_Code", "")).strip())
        d = parse_meeting_date(str(r.get("meeting_date", "")))
        if cid and d:
            events.append({"company_id": cid, "date": d, "kind": "results", "source": "bse_result_calendar"})
    db.upsert("events", events, on_conflict="company_id,date,kind")
    return {"calendar_rows": len(rows), "portfolio_events": len(events)}
