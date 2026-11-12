"""Pipeline A: filings. Fetch, upsert by exchange ID, rules tier, triggers, alerts.

Idempotent: filings are immutable, so existing rows are left alone unless
--retier is passed. Alerts are deduplicated by (source_type, source_id).
LLM tiering for vague filings and web push come later (DESIGN.md 6.2 A).
"""
from __future__ import annotations

import json
import logging
import re
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

from ..config import REPO_ROOT
from ..models import Company, RawFiling, TierDecision
from ..sources.bse import BseClient
from .tiering import classify

log = logging.getLogger(__name__)

DEFAULT_LOOKBACK = timedelta(days=2)


def filing_row(f: RawFiling, company_id: int, d: TierDecision) -> dict:
    return {
        "id": f.id, "company_id": company_id, "exchange": "BSE", "filed_at": f.filed_at.isoformat(),
        "category": f.category, "subcategory": f.subcategory, "subject": f.subject, "headline": f.headline,
        "pdf_url": f.pdf_url, "finn_category": d.finn_category, "tier": d.tier, "tier_source": d.tier_source,
        "confidence": d.confidence, "reason": d.reason, "raw": f.raw,
        "trigger_eligible": d.trigger_eligible, "needs_llm": d.needs_llm,
    }


def dedupe_results(rows: list[dict]) -> list[dict]:
    """Companies often file results twice on one day: the 'Financial Results' filing and a
    board-meeting outcome that encloses it. Keep one alert: the outcome steps down to
    worth_knowing when a results filing exists for the same company and day."""
    has_results = {(r["_symbol"], r["filed_at"][:10]) for r in rows
                   if r["tier"] == "needs_you" and r["subcategory"] == "Financial Results"}
    for r in rows:
        if (r["tier"] == "needs_you" and r["finn_category"] == "results" and r["subcategory"] != "Financial Results"
                and (r["_symbol"], r["filed_at"][:10]) in has_results):
            r.update(tier="worth_knowing", tier_source="rule", trigger_eligible=False,
                     reason="Board outcome enclosing the results filed the same day")
    return rows


def seed_companies() -> list[Company]:
    """Offline fallback for --dry-run: read the portfolio from supabase/seed.sql."""
    sql = (REPO_ROOT / "supabase" / "seed.sql").read_text(encoding="utf-8")
    rows = re.findall(r"\('([A-Z0-9&-]+)', '(\d+)', '[A-Z0-9]+', '((?:[^']|'')+)'", sql)
    return [Company(nse_symbol=s, bse_code=c, name=n.replace("''", "'")) for s, c, n in rows]


def run(since: datetime | None, dry_run: bool, retier: bool, symbols: list[str] | None, out: Path | None) -> dict:
    db = None
    if dry_run:
        companies = seed_companies()
        enabled = {"results": True, "M&A": True, "management_change": True, "fund_raise": True, "litigation": True, "pledging": True}
    else:
        from ..db import Db

        db = Db()
        companies = [Company(**c) for c in db.select("companies", {"select": "id,nse_symbol,bse_code,name", "bse_code": "not.is.null"})]
        trig = db.select("triggers", {"select": "categories", "id": "eq.1"})
        enabled = trig[0]["categories"] if trig else {}
        if since is None:
            latest = db.select("filings", {"select": "filed_at", "order": "filed_at.desc", "limit": "1"})
            if latest:
                since = datetime.fromisoformat(latest[0]["filed_at"]) - timedelta(hours=6)

    if symbols:
        wanted = {s.upper() for s in symbols}
        companies = [c for c in companies if c.nse_symbol in wanted]
    since = since or datetime.now(timezone.utc) - DEFAULT_LOOKBACK

    rows: list[dict] = []
    failed: list[str] = []
    with BseClient() as bse:
        for c in companies:
            try:
                filings = bse.announcements(c.bse_code, since)
            except Exception as exc:
                log.error("Skipping %s: %s", c.nse_symbol, exc)
                failed.append(c.nse_symbol)
                continue
            for f in filings:
                rows.append(filing_row(f, c.id or 0, classify(f, enabled)) | {"_symbol": c.nse_symbol})
            log.info("%-11s %3d filings", c.nse_symbol, len(filings))

    rows = dedupe_results(rows)
    tiers = Counter(r["tier"] for r in rows)
    summary = {"since": since.isoformat(), "companies": len(companies), "filings": len(rows), "tiers": dict(tiers), "failed": failed}

    if out:
        out.write_text(json.dumps(rows, indent=1, default=str), encoding="utf-8")
    if db is not None:
        clean = [{k: v for k, v in r.items() if not k.startswith("_")} for r in rows]
        db.upsert("filings", clean, on_conflict="id", ignore_duplicates=not retier)
        alerts = [{"source_type": "filing", "source_id": r["id"], "trigger": r["finn_category"]} for r in rows if r["tier"] == "needs_you"]
        db.upsert("alerts", alerts, on_conflict="source_type,source_id", ignore_duplicates=True)
        summary["alerts"] = len(alerts)
    return summary
