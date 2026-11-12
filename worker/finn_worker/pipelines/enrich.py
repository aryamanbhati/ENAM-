"""Filing enrichment: summaries with cited points, results numbers, management bios, vague-filing tiering.

- Vague filings (needs_llm): cheap model decides worth_knowing vs routine. Low confidence or failure keeps
  worth_knowing (guardrail 5: fail upward).
- Every key point carries a supporting quote verified on its page; unverified points are dropped.
- Results: the model copies numbers; each must appear on the cited page (guardrail 1). QoQ, YoY and EBITDA
  (PBT + finance costs + D&A) are computed here. PBT - tax is checked against PAT.
- Management change: bios copied from the filing and verified; no LinkedIn, no web search.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Literal

from pydantic import BaseModel, Field

from ..db import Db
from ..llm.gateway import Gateway, LlmError
from ..sources.http import get_cached
from ..sources.pdf import pages_text, with_page_markers
from ..verify.quotes import number_in_text, quote_on_page

log = logging.getLogger(__name__)


class Point(BaseModel):
    text: str
    quote: str
    page: int


class Summary(BaseModel):
    one_line: str
    points: list[Point]
    material: bool
    confidence: float = Field(ge=0, le=1)


class Cols(BaseModel):
    current: float | None = None
    previous: float | None = None
    year_ago: float | None = None


class ResultsOut(BaseModel):
    found: bool
    basis: Literal["consolidated", "standalone"] = "consolidated"
    unit: str = "crore"
    period_label: str | None = None
    page: int | None = None
    revenue: Cols = Cols()
    finance_costs: Cols | None = None
    depreciation: Cols | None = None
    pbt: Cols = Cols()
    tax: Cols | None = None
    pat: Cols = Cols()


class Person(BaseModel):
    name: str
    role: str
    change: Literal["appointed", "resigned", "retired", "redesignated", "other"]
    effective: str | None = None
    bio: str | None = None
    bio_page: int | None = None
    reason: str | None = None


class People(BaseModel):
    people: list[Person]


def _pct(a: float | None, b: float | None) -> float | None:
    if a is None or b is None or b == 0:
        return None
    return round((a / abs(b) - (1 if b > 0 else -1)) * 100, 1) if b > 0 else round((a - b) / abs(b) * 100, 1)


def results_rows(r: ResultsOut, page_text: str) -> tuple[list[dict], list[dict]]:
    """Pure: verified rows + checks. A metric whose current value is not on the page is dropped."""
    def ok(v: float | None) -> bool:
        return v is not None and number_in_text(abs(v), page_text)

    rows, checks = [], []
    for name, cols in (("Revenue", r.revenue), ("PBT", r.pbt), ("PAT", r.pat)):
        if not ok(cols.current):
            continue
        prev = cols.previous if ok(cols.previous) else None
        ya = cols.year_ago if ok(cols.year_ago) else None
        rows.append({"metric": name, "current": cols.current, "prev": prev, "yoy_base": ya,
                     "qoq": _pct(cols.current, prev), "yoy": _pct(cols.current, ya), "page": r.page})
    # EBITDA, computed: PBT + finance costs + D&A, only from verified inputs
    fc, da = r.finance_costs, r.depreciation
    if fc and da and all(ok(x) for x in (r.pbt.current, fc.current, da.current)):
        def e(i: str) -> float | None:
            vals = [getattr(r.pbt, i), getattr(fc, i), getattr(da, i)]
            return sum(vals) if all(v is not None and ok(v) for v in vals) else None  # type: ignore[misc]
        cur, prev, ya = e("current"), e("previous"), e("year_ago")
        rows.insert(1, {"metric": "EBITDA", "current": cur, "prev": prev, "yoy_base": ya, "qoq": _pct(cur, prev),
                        "yoy": _pct(cur, ya), "page": r.page, "computed": "PBT + finance costs + D&A"})
    if r.tax and ok(r.tax.current) and ok(r.pbt.current) and ok(r.pat.current):
        implied = r.pbt.current - r.tax.current  # type: ignore[operator]
        good = abs(implied - r.pat.current) <= max(0.03 * abs(r.pat.current), 1)  # type: ignore[arg-type]
        checks.append({"name": "pbt_minus_tax", "ok": good,
                       "detail": "PBT minus tax matches PAT" if good else f"PBT minus tax ({implied:,.0f}) differs from PAT ({r.pat.current:,.0f}), possibly minority interest or associates"})
    return rows, checks


def _pick_pages(pages: list[str], keys: tuple[str, ...], n: int) -> list[int]:
    scored = sorted(range(len(pages)), key=lambda i: -sum(pages[i].lower().count(k) for k in keys))
    return sorted(scored[:n])


def run(days: int = 3, limit: int = 60, ids: list[str] | None = None) -> dict:
    db = Db()
    gw = Gateway(db)
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    params = {"select": "id,company_id,filed_at,finn_category,subcategory,category,subject,headline,pdf_url,tier,tier_source,needs_llm,trigger_eligible,reason",
              "summary_status": "in.(none,failed)", "tier": "neq.routine", "order": "filed_at.desc", "limit": str(limit)}
    if ids:
        params = {k: v for k, v in params.items() if k not in ("summary_status", "tier")} | {"id": f"in.({','.join(ids)})"}
    else:
        params["filed_at"] = f"gte.{since}"
    rows = db.select("filings", params)
    names = {c["id"]: c["name"] for c in db.select("companies", {"select": "id,name"})}
    stats = {"seen": len(rows), "summarised": 0, "demoted": 0, "results": 0, "people": 0, "failed": 0}

    for f in rows:
        try:
            _enrich_one(db, gw, f, names.get(f["company_id"], ""), stats)
        except (LlmError, Exception) as exc:  # one bad filing must not stop the batch
            log.warning("enrich failed for %s: %s", f["id"], str(exc)[:200])
            stats["failed"] += 1
            db.update("filings", {"id": f"eq.{f['id']}"}, {"summary_status": "failed"})
    return stats


def _enrich_one(db: Db, gw: Gateway, f: dict, company: str, stats: dict) -> None:
    if not f.get("pdf_url"):
        db.update("filings", {"id": f"eq.{f['id']}"}, {"summary_status": "ready"})
        return
    data = get_cached(f["pdf_url"], kind="pdf")
    pages = pages_text(data, max_pages=40)
    head = pages[:6]
    s = gw.structured(step="filings.summary", tier="cheap", prompt="filing_summary", schema=Summary,
                      values={"company": company, "category": f"{f.get('category')} / {f.get('subcategory')}",
                              "subject": f.get("subject") or "", "text": with_page_markers(head, 5000)})
    points = []
    for p in s.points[:4]:
        okq, found = quote_on_page(p.quote, pages, p.page, threshold=88)
        if okq:
            points.append({"text": p.text.replace("—", ", "), "page": found})
    upd: dict = {"summary": s.one_line.replace("—", ", "), "summary_status": "ready"}
    enrichment: dict = {"kind": "none", "one_line": upd["summary"], "points": points}

    # Vague filing: the model may move it down to routine, only when confident (fail upward).
    if f.get("needs_llm") and f["tier"] == "worth_knowing" and f["tier_source"] == "rule":
        if not s.material and s.confidence >= 0.75:
            upd |= {"tier": "routine", "tier_source": "llm", "confidence": s.confidence,
                    "reason": "Routine paperwork, judged by model"}
            stats["demoted"] += 1
        else:
            upd |= {"tier_source": "llm", "confidence": s.confidence,
                    "reason": "Material, judged by model" if s.material else "Kept visible, model unsure it is routine"}

    cat = f.get("finn_category")
    if cat == "results" and (f.get("subcategory") == "Financial Results" or f.get("trigger_eligible")):
        idx = _pick_pages(pages, ("profit before tax", "revenue from operations", "finance cost", "total income"), 4)
        rr = gw.structured(step="filings.results", tier="cheap", prompt="results_extract", schema=ResultsOut,
                           values={"company": company, "text": "\n".join(f'<page n="{i + 1}">\n{pages[i][:9000]}\n</page>' for i in idx)})
        if rr.found and rr.page and 1 <= rr.page <= len(pages):
            rows_, checks = results_rows(rr, pages[rr.page - 1])
            if rows_:
                unit = "lakh" if "lakh" in rr.unit.lower() else ("million" if "million" in rr.unit.lower() else "crore")
                unit, xcheck = screener_cross_check(db, f["company_id"], f.get("filed_at"), rows_, unit, rr.basis)
                if xcheck:
                    checks.append(xcheck)
                enrichment |= {"kind": "results", "period": rr.period_label or "", "basis": rr.basis, "unit": unit,
                               "rows": rows_, "checks": checks, "guidance_line": _guidance_line(db, f["company_id"])}
                stats["results"] += 1
    elif cat == "management_change":
        pp = gw.structured(step="filings.people", tier="cheap", prompt="people_extract", schema=People,
                           values={"company": company, "text": with_page_markers(pages[:8], 6000)})
        people = []
        for p in pp.people[:4]:
            bio, page = p.bio, p.bio_page
            if bio:
                okb, found = quote_on_page(bio, pages, page or 1, threshold=85)
                bio, page = (bio, found) if okb else (None, None)
            people.append({"name": p.name, "role": p.role, "change": p.change, "effective": p.effective,
                           "bio": bio, "bio_page": page, "bio_source": "filing" if bio else None})
        if people:
            enrichment |= {"kind": "management", "people": people}
            stats["people"] += 1

    upd["enrichment"] = enrichment
    db.update("filings", {"id": f"eq.{f['id']}"}, upd)
    stats["summarised"] += 1


SCALE = {"crore": 1.0, "million": 0.1, "lakh": 0.01}


def unit_from_ratios(ratios: list[float], unit: str) -> str:
    """Pure: if every extracted/screener ratio is ~10x or ~100x off, the unit was misread; return the fix."""
    if not ratios:
        return unit
    for cand, scale in SCALE.items():
        if all(abs(r * scale / SCALE[unit] - 1) <= 0.02 for r in ratios):
            return cand
    return unit


def screener_cross_check(db: Db, company_id: int, filed_at: str | None, rows: list[dict], unit: str, basis: str) -> tuple[str, dict | None]:
    """DESIGN.md 5.5: cross-check against screener. Fixes a misread unit; otherwise reports agreement."""
    from ..sources.screener import quarter_label_to_period

    if not filed_at:
        return unit, None
    d = datetime.fromisoformat(filed_at)
    label = {1: f"Dec {d.year - 1}", 2: f"Dec {d.year - 1}", 3: f"Dec {d.year - 1}", 4: f"Mar {d.year}", 5: f"Mar {d.year}",
             6: f"Mar {d.year}", 7: f"Jun {d.year}", 8: f"Jun {d.year}", 9: f"Jun {d.year}", 10: f"Sep {d.year}",
             11: f"Sep {d.year}", 12: f"Sep {d.year}"}[d.month]
    period = quarter_label_to_period(label)
    facts = {f["metric"]: float(f["value"]) for f in db.select("facts", {
        "select": "metric,value", "company_id": f"eq.{company_id}", "period": f"eq.{period}", "extractor": "eq.screener"})}
    keys = {"Revenue": "revenue", "PBT": "pbt", "PAT": "pat"}
    pairs = [(r["current"] * SCALE[unit], facts[keys[r["metric"]]]) for r in rows if keys.get(r["metric"]) in facts and facts[keys[r["metric"]]]]
    if not pairs:
        return unit, None
    fixed = unit_from_ratios([a / b for a, b in pairs], unit)
    if fixed != unit:
        return fixed, {"name": "unit", "ok": True, "detail": f"Unit corrected to {fixed} after cross-checking with screener"}
    agree = sum(abs(a - b) <= max(0.01 * abs(b), 1) for a, b in pairs)
    ok = agree == len(pairs)
    detail = "Matches screener's quarterly table" if ok else f"{len(pairs) - agree} of {len(pairs)} figures differ from screener's {basis if basis == 'consolidated' else 'consolidated'} table"
    return unit, {"name": "screener", "ok": ok, "detail": detail}


def _guidance_line(db: Db, company_id: int) -> str | None:
    """One line linking push to pull: the headline revenue promise, if researched."""
    ps = db.select("promises", {"select": "status_line,category", "company_id": f"eq.{company_id}",
                                "category": "in.(revenue_growth,revenue_absolute,ebitda_margin)", "order": "importance", "limit": "1"})
    return ps[0]["status_line"] if ps and ps[0].get("status_line") else None
