"""Web push. Matching a trigger is the only path to a notification (DESIGN.md 5.2).

Sends one notification per new alert (deduplicated by alerts.pushed_at), and an optional morning digest.
Alerts older than MAX_AGE are marked pushed without sending, so a backfill never floods a phone.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone

from .. import config
from ..db import Db

log = logging.getLogger(__name__)
MAX_AGE = timedelta(hours=6)


def _send(subs: list[dict], payload: dict, db: Db) -> int:
    from pywebpush import WebPushException, webpush

    sent = 0
    for s in subs:
        try:
            webpush(subscription_info={"endpoint": s["endpoint"], "keys": s["keys"]}, data=json.dumps(payload),
                    vapid_private_key=config.env("VAPID_PRIVATE_KEY"),
                    vapid_claims={"sub": config.env("VAPID_SUBJECT", "mailto:finn@example.com")}, ttl=6 * 3600)
            sent += 1
        except WebPushException as exc:
            code = getattr(exc.response, "status_code", None)
            if code in (404, 410):  # subscription gone
                db.delete("push_subscriptions", {"endpoint": f"eq.{s['endpoint']}"})
            log.warning("push failed (%s): %s", code, str(exc)[:120])
    return sent


def run(digest: bool = False) -> dict:
    db = Db()
    if not config.env("VAPID_PRIVATE_KEY"):
        return {"skipped": "VAPID keys not set"}
    subs = db.select("push_subscriptions", {"select": "endpoint,keys"})
    pending = db.select("alerts", {"select": "id,source_type,source_id,trigger,created_at", "pushed_at": "is.null", "order": "created_at"})
    now = datetime.now(timezone.utc)
    companies = {c["id"]: c for c in db.select("companies", {"select": "id,nse_symbol,name"})}
    sent = stale = 0
    for a in pending:
        created = datetime.fromisoformat(a["created_at"])
        if now - created > MAX_AGE or not subs:
            stale += 1
        else:
            payload = _payload(db, a, companies)
            if payload:
                sent += _send(subs, payload, db)
        db.update("alerts", {"id": f"eq.{a['id']}"}, {"pushed_at": now.isoformat()})
    out = {"subscriptions": len(subs), "pending": len(pending), "sent": sent, "skipped_stale": stale}
    if digest and subs:
        out["digest"] = _send(subs, _digest(db), db)
    return out


def _payload(db: Db, a: dict, companies: dict) -> dict | None:
    if a["source_type"] == "filing":
        rows = db.select("filings", {"select": "id,company_id,summary,finn_category,subcategory", "id": f"eq.{a['source_id']}"})
        if not rows:
            return None
        f = rows[0]
        sym = companies.get(f["company_id"], {}).get("nse_symbol", "")
        label = (f.get("finn_category") or "filing").replace("_", " ")
        return {"title": f"{sym}: {label}", "body": f.get("summary") or f.get("subcategory") or "New filing", "tag": f"filing:{f['id']}",
                "url": f"/#filing:{f['id']}"}
    cid, date, typ = a["source_id"].split(":")
    sig = db.select("signals", {"select": "value,explained_by_filing_id", "company_id": f"eq.{cid}", "date": f"eq.{date}", "type": f"eq.{typ}"})
    if not sig:
        return None
    sym = companies.get(int(cid), {}).get("nse_symbol", "")
    v = float(sig[0]["value"])
    what = f"{'up' if v > 0 else 'down'} {abs(v):.1f}% today" if typ == "price_move" else f"traded {v:.1f}x its usual volume"
    why = "Explained by a recent filing." if sig[0]["explained_by_filing_id"] else "No filing explains this move."
    return {"title": f"{sym} {what}", "body": why, "tag": f"signal:{cid}:{date}", "url": f"/#signal:{cid}:{date}"}


def _digest(db: Db) -> dict:
    since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    rows = db.select("filings", {"select": "tier", "filed_at": f"gte.{since}"})
    n = sum(r["tier"] == "needs_you" for r in rows)
    routine = sum(r["tier"] == "routine" for r in rows)
    head = "Nothing needs you." if n == 0 else f"{n} thing{'s' if n != 1 else ''} need{'' if n != 1 else 's'} you."
    return {"title": "Your morning briefing", "body": f"{head} {routine} routine filings hidden.", "tag": "digest", "url": "/"}
