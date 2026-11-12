from pathlib import Path

from finn_worker.pipelines.verdicts import actual_for, is_dropped, judge, silent_periods, status_line
from finn_worker.sources.screener import concall_period, parse_page, quarter_label_to_period, quarterly_facts
from finn_worker.verify.quotes import number_in_text, quote_on_page

FIX = Path(__file__).resolve().parents[1] / "fixtures"


def test_period_mapping():
    assert quarter_label_to_period("Sep 2026") == "Q2 FY27"
    assert quarter_label_to_period("Mar 2026") == "Q4 FY26"
    assert quarter_label_to_period("Dec 2025") == "Q3 FY26"
    assert concall_period("Nov 2026") == "Q2 FY27"
    assert concall_period("Feb 2026") == "Q3 FY26"
    assert concall_period("May 2026") == "Q4 FY26"
    assert concall_period("Aug 2026") == "Q1 FY27"


def test_screener_fixture_parses():
    html = (FIX / "screener_RELIANCE.html").read_text(encoding="utf-8")
    p = parse_page(html, "RELIANCE", "consolidated", "u")
    assert p.quarters[-1] == "Sep 2026"
    assert p.rows["revenue"][-1] == 330601.0
    assert p.rows["pbt"][-1] == 38613.0
    assert sum(1 for c in p.concalls if c.transcript_url) >= 4
    facts = quarterly_facts(p)
    assert any(f["period"] == "Q2 FY27" and f["metric"] == "pat" and f["value"] == 29550.0 for f in facts)


def facts_for(rev_old, rev_new, op_new=None):
    f = {}
    for i, v in enumerate(rev_old):
        f[(f"Q{i + 1} FY26", "revenue")] = v
    for i, v in enumerate(rev_new):
        f[(f"Q{i + 1} FY27", "revenue")] = v
        if op_new:
            f[(f"Q{i + 1} FY27", "operating_profit")] = op_new[i]
    return f


def test_growth_tracking_and_verdicts():
    f = facts_for([100, 100, 100, 100], [109, 109])
    a = actual_for("revenue_growth", "FY27", f)
    assert a["value"] == 9.0 and not a["complete"]
    v, tr = judge("revenue_growth", 15, None, a)
    assert (v, tr) == ("too_early", "behind")
    assert status_line("revenue_growth", 15, None, a, v) == "Guided 15% growth, tracking 9% after 2 quarters"

    full = facts_for([100] * 4, [116] * 4)
    a = actual_for("revenue_growth", "FY27", full)
    assert judge("revenue_growth", 15, 18, a)[0] == "delivered"
    a = actual_for("revenue_growth", "FY27", facts_for([100] * 4, [111] * 4))
    assert judge("revenue_growth", 15, None, a)[0] == "partly"
    a = actual_for("revenue_growth", "FY27", facts_for([100] * 4, [102] * 4))
    assert judge("revenue_growth", 15, None, a)[0] == "missed"


def test_margin():
    f = facts_for([100] * 4, [100] * 4, op_new=[11, 11, 11, 11])
    a = actual_for("ebitda_margin", "FY27", f)
    assert a["value"] == 11.0
    assert judge("ebitda_margin", 12, 13, a)[0] == "partly"
    assert judge("ebitda_margin", 13, None, a)[0] == "missed"


def test_missing_numbers_are_not_guessed():
    assert actual_for("revenue_growth", "FY29", facts_for([100], [110])) is None


def test_silence_and_dropped():
    periods = ["Q3 FY26", "Q4 FY26", "Q1 FY27", "Q2 FY27"]
    assert silent_periods(["Q3 FY26", "Q4 FY26"], periods) == ["Q1 FY27", "Q2 FY27"]
    assert is_dropped(["Q3 FY26", "Q4 FY26"], periods)                    # silent on the last two calls
    assert not is_dropped(["Q3 FY26", "Q1 FY27"], periods)                # silent once: not enough alone
    assert is_dropped(["Q3 FY26", "Q1 FY27"], periods, tracking="behind")  # silent once and behind
    assert not is_dropped(["Q3 FY26"], periods, tracking="ahead")         # beating it: never dropped
    assert not is_dropped(["Q3 FY26", "Q2 FY27"], periods)
    assert not is_dropped(["Q2 FY27"], periods)


def test_quote_verification():
    pages = ["intro text", "We expect revenue growth of 18 to 20% in FY27,\ndriven by new customers.", "end"]
    assert quote_on_page("We expect revenue growth of 18 to 20% in FY27, driven by new customers.", pages, 2) == (True, 2)
    assert quote_on_page("We expect revenue growth of 18 to 20% in FY27", pages, 1) == (True, 2)  # neighbour page
    assert quote_on_page("We expect margins of 30% next year.", pages, 2)[0] is False
    assert number_in_text(18, "growth of 18 to 20%") and not number_in_text(15, "growth of 18 to 20%")
    assert number_in_text(1200, "capex of Rs 1,200 crore")


def test_margin_expansion_bps_and_fy_complete():
    from finn_worker.pipelines.verdicts import fy_complete
    f = facts_for([100] * 4, [100] * 4, op_new=[12, 12, 12, 12])
    for i in range(4):
        f[(f"Q{i + 1} FY26", "operating_profit")] = 10.8
    a = actual_for("margin_expansion_bps", "FY27", f)
    assert a["value"] == 120 and a["unit"] == "bps"
    assert judge("margin_expansion_bps", 120, 130, a)[0] == "delivered"
    assert fy_complete("FY27", f) and fy_complete("FY26", f) and not fy_complete("FY28", f)


def test_unit_from_ratios():
    from finn_worker.pipelines.enrich import unit_from_ratios
    assert unit_from_ratios([10.0, 10.01, 9.99], "crore") == "million"
    assert unit_from_ratios([100.0, 100.0], "crore") == "lakh"
    assert unit_from_ratios([1.0, 0.99], "crore") == "crore"
    assert unit_from_ratios([1.0, 1.8], "crore") == "crore"   # mixed: leave it, report the mismatch
