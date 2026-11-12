"""Numeric verdicts, computed in code from facts (guardrail 1). Pure functions, unit tested.

A promise becomes a measurable rule when it has a category we can compute from quarterly results,
a numeric target and a fiscal year. Actuals come from screener's quarterly table:
  revenue_growth   sum(revenue) over the FY's reported quarters vs the same quarters a year earlier
  profit_growth    same with PAT
  ebitda_margin    sum(operating profit) / sum(revenue)       (screener's operating profit is EBITDA-like)
  ebit_margin      sum(operating profit - depreciation) / sum(revenue)
  revenue_absolute sum(revenue) for the full FY
Incomplete years are 'too_early' with a tracking number; complete years get delivered / partly / missed.
"""
from __future__ import annotations

import re

COMPUTABLE = {"revenue_growth", "profit_growth", "ebitda_margin", "ebit_margin", "revenue_absolute"}
METHOD = {
    "revenue_growth": "Revenue growth over the same quarters a year earlier, from quarterly results",
    "profit_growth": "Net profit growth over the same quarters a year earlier, from quarterly results",
    "ebitda_margin": "Operating profit divided by revenue, from quarterly results",
    "ebit_margin": "Operating profit minus depreciation, divided by revenue, from quarterly results",
    "revenue_absolute": "Sum of the year's quarterly revenue, from quarterly results",
}


def fy_quarters(fy: str) -> list[str]:
    n = int(re.match(r"FY(\d\d)", fy).group(1))
    return [f"Q{q} FY{n:02d}" for q in (1, 2, 3, 4)]


def prev_fy(fy: str) -> str:
    return f"FY{int(fy[2:]) - 1:02d}"


def _sum(facts: dict[tuple[str, str], float], metric: str, periods: list[str]) -> float | None:
    vals = [facts.get((p, metric)) for p in periods]
    return None if any(v is None for v in vals) or not vals else sum(vals)  # type: ignore[arg-type]


def actual_for(category: str, fy: str, facts: dict[tuple[str, str], float]) -> dict | None:
    """Return {value, quarters, complete, unit} or None if the numbers are not available."""
    qs = [q for q in fy_quarters(fy) if (q, "revenue") in facts]
    if not qs:
        return None
    complete = len(qs) == 4
    if category in ("revenue_growth", "profit_growth"):
        metric = "revenue" if category == "revenue_growth" else "pat"
        prior = [q.replace(fy, prev_fy(fy)) for q in qs]
        cur, old = _sum(facts, metric, qs), _sum(facts, metric, prior)
        if cur is None or not old or old <= 0:
            return None
        return {"value": round((cur / old - 1) * 100, 1), "unit": "pct", "quarters": qs, "complete": complete,
                "current": cur, "prior": old}
    if category in ("ebitda_margin", "ebit_margin"):
        rev, op = _sum(facts, "revenue", qs), _sum(facts, "operating_profit", qs)
        if not rev or op is None:
            return None
        if category == "ebit_margin":
            dep = _sum(facts, "depreciation", qs)
            if dep is None:
                return None
            op -= dep
        return {"value": round(op / rev * 100, 1), "unit": "pct", "quarters": qs, "complete": complete}
    if category == "revenue_absolute":
        rev = _sum(facts, "revenue", qs)
        if rev is None:
            return None
        return {"value": round(rev, 0), "unit": "rs_cr", "quarters": qs, "complete": complete}
    return None


def judge(category: str, low: float, high: float | None, actual: dict) -> tuple[str, str]:
    """Return (verdict, tracking) where tracking is on_track / behind / ahead for incomplete years."""
    high = high if high is not None else low
    v = actual["value"]
    if category in ("ebitda_margin", "ebit_margin"):
        gap_ok, partly_ok = v >= low, v >= low - 1.0              # within 1 point counts as partly
    elif category == "revenue_absolute" and not actual["complete"]:
        frac = len(actual["quarters"]) / 4                        # compare against pro-rata target
        gap_ok, partly_ok = v >= low * frac, v >= 0.85 * low * frac
    else:
        gap_ok, partly_ok = v >= low, v >= 0.7 * low if low > 0 else v >= low - 5
    if not actual["complete"]:
        return "too_early", ("ahead" if v > high else "on_track") if gap_ok else "behind"
    if gap_ok:
        return "delivered", "done"
    return ("partly" if partly_ok else "missed"), "done"


def fmt(v: float, unit: str) -> str:
    if unit == "pct":
        return f"{v:g}%"
    if unit == "rs_cr":
        return f"Rs {v:,.0f} cr"
    return f"{v:g}"


def status_line(category: str, low: float, high: float | None, actual: dict, verdict: str) -> str:
    target = fmt(low, actual["unit"]) if high in (None, low) else f"{low:g} to {fmt(high, actual['unit'])}"
    what = {"revenue_growth": "growth", "profit_growth": "profit growth", "ebitda_margin": "margin",
            "ebit_margin": "EBIT margin", "revenue_absolute": "revenue"}[category]
    n = len(actual["quarters"])
    so_far = f" after {n} quarter{'s' if n != 1 else ''}" if not actual["complete"] else ""
    verb = "tracking" if verdict == "too_early" else "delivered"
    return f"Guided {target} {what}, {verb} {fmt(actual['value'], actual['unit'])}{so_far}"


def silent_periods(mention_periods: list[str], all_periods: list[str]) -> list[str]:
    """Periods after the first mention where the thread was not mentioned."""
    if not mention_periods:
        return []
    first = min(all_periods.index(p) for p in mention_periods)
    return [p for p in all_periods[first + 1 :] if p not in mention_periods]


def is_dropped(mention_periods: list[str], all_periods: list[str]) -> bool:
    """Quietly dropped: stated, then absent from the latest call (and every call since the last mention).
    Needs at least one later call to be silent in. A thread first stated in the latest call is not dropped."""
    if not mention_periods or not all_periods:
        return False
    last = max(all_periods.index(p) for p in mention_periods)
    return last < len(all_periods) - 1
