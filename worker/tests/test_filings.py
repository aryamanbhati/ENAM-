import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import pytest

from finn_worker.models import RawFiling
from finn_worker.pipelines.filings import seed_companies
from finn_worker.pipelines.tiering import apply_triggers, classify, rule_tier
from finn_worker.sources.bse import IST, parse_announcement, parse_bse_datetime

FIX = Path(__file__).resolve().parents[1] / "fixtures"
ALL_ON = {"results": True, "M&A": True, "management_change": True, "fund_raise": True, "litigation": True, "credit_rating": True}


def mk(sub, subject="Announcement under Regulation 30 (LODR)", cat="Company Update", headline=None):
    return RawFiling(id="x", bse_code="1", filed_at=datetime.now(timezone.utc), category=cat, subcategory=sub,
                     subject=subject, headline=headline, pdf_url=None, raw={})


def test_parse_datetime_variants():
    assert parse_bse_datetime("2026-11-12T20:22:14.477") == datetime(2026, 11, 12, 20, 22, 14, 477000, tzinfo=IST)
    assert parse_bse_datetime("2026-10-30T19:46:01") == datetime(2026, 10, 30, 19, 46, 1, tzinfo=IST)


def test_parse_real_fixture():
    rows = json.loads((FIX / "bse_ann_500325.json").read_text())["Table"]
    filings = [parse_announcement(r) for r in rows]
    assert len(filings) == len(rows) > 0
    f = next(x for x in filings if x.subcategory == "Financial Results")
    assert f.bse_code == "500325"
    assert f.pdf_url and f.pdf_url.endswith(".pdf")
    assert f.filed_at.tzinfo is not None


@pytest.mark.parametrize("sub,subject,cat,expected", [
    ("Financial Results", "Unaudited Financial Results", "Result", ("results", "worth_knowing")),
    ("Change in Management", None, None, ("management_change", "worth_knowing")),
    ("Newspaper Publication", None, None, ("unclassified", "routine")),
    ("Analyst / Investor Meet", None, None, ("investor_meetings", "routine")),
    ("Allotment of ESOP / ESPS", None, None, ("unclassified", "routine")),
    ("Appointment of Statutory Auditor/s", None, None, ("unclassified", "routine")),
    ("Acquisition", None, None, ("M&A", "worth_knowing")),
    ("General", "Appointment Of Shri X As Govt. Nominee Director", None, ("management_change", "worth_knowing")),
    ("General", "Receipt of GST demand order", None, ("litigation", "worth_knowing")),
    ("Outcome of Board Meeting", "Board Meeting Outcome for Unaudited Financial Results", "Board Meeting", ("results", "worth_knowing")),
    ("Board Meeting", "Board Meeting Intimation for Considering Financial Results", "Board Meeting", ("results", "routine")),
])
def test_rules(sub, subject, cat, expected):
    d = rule_tier(mk(sub, subject or "Announcement under Regulation 30 (LODR)", cat or "Company Update"))
    assert (d.finn_category, d.tier) == expected
    assert d.tier != "needs_you"


def test_vague_fails_upward():
    d = rule_tier(mk("General", "Disclosure Under Regulation 30 Of The SEBI (LODR) Regulations, 2015"))
    assert d.tier == "worth_knowing" and d.needs_llm and d.confidence < 0.5


def test_unknown_subcategory_fails_upward():
    d = rule_tier(mk("Something BSE Invented Tomorrow"))
    assert d.tier == "worth_knowing" and d.needs_llm


def test_trigger_promotes_only_when_enabled():
    d = rule_tier(mk("Change in Management"))
    assert apply_triggers(d, ALL_ON).tier == "needs_you"
    off = apply_triggers(d, {**ALL_ON, "management_change": False})
    assert off.tier == "worth_knowing"  # preferences reorder, never hide


def test_routine_never_triggers():
    d = classify(mk("Board Meeting", "Board Meeting Intimation for Financial Results", "Board Meeting"), ALL_ON)
    assert d.tier == "routine"


def test_reasons_have_no_em_dashes():
    rows = json.loads((FIX / "scan_30d.json").read_text())
    for v in rows.values():
        for r in v["rows"]:
            d = classify(parse_announcement(r), ALL_ON)
            assert "—" not in d.reason


def test_real_month_distribution_is_sane():
    """On 30 days of real filings for ~50 companies, routine should dominate needs_you."""
    rows = json.loads((FIX / "scan_30d.json").read_text())
    tiers = Counter(classify(parse_announcement(r), ALL_ON).tier for v in rows.values() for r in v["rows"])
    assert tiers["routine"] > tiers["needs_you"] > 0


def test_seed_companies_parse():
    cs = seed_companies()
    assert len(cs) == 19
    assert cs[0].nse_symbol == "RELIANCE" and cs[0].bse_code == "500325"


def test_dedupe_results_keeps_one_alert():
    from finn_worker.pipelines.filings import dedupe_results
    base = {"_symbol": "X", "filed_at": "2026-10-30T19:00:00+05:30", "finn_category": "results", "tier": "needs_you"}
    rows = [dict(base, id="1", subcategory="Financial Results"), dict(base, id="2", subcategory="Outcome of Board Meeting")]
    out = dedupe_results(rows)
    assert [r["tier"] for r in out] == ["needs_you", "worth_knowing"]
