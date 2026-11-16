"""Rules tier: BSE category/subcategory/subject -> FINN category and tier.

Order of decisions (DESIGN.md 5.3):
  1. Exact rules on BSE's subcategory (and category).
  2. Keyword rules on the subject for vague subcategories ('General', 'Others', none).
  3. Anything still vague is worth_knowing with low confidence and needs_llm=True
     (fail upward; the cheap LLM may later move it down to routine).
  4. User triggers promote trigger-eligible items to needs_you. Preferences reorder,
     they never hide: a disabled trigger leaves the item in worth_knowing.

All copy in `reason` is user-facing: sentence case, no em dashes.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from ..models import RawFiling, TierDecision

CATEGORY_LABELS = {
    "results": "Results",
    "M&A": "M&A",
    "fund_raise": "Fund raise",
    "management_change": "Management change",
    "litigation": "Litigation",
    "insider_trading": "Insider trading",
    "earnings_call": "Earnings call",
    "investor_meetings": "Investor meetings",
    "credit_rating": "Credit rating",
    "dividend": "Dividend",
    "bonus_split": "Bonus or split",
    "capex": "Capex",
    "press_release": "Press release",
    "postal_ballot": "Postal ballot",
    "agm_egm": "AGM or EGM",
    "pledging": "Pledging",
    "unclassified": "Routine paperwork",
}

WK, RT = "worth_knowing", "routine"


@dataclass(frozen=True)
class Rule:
    category: str
    tier: str
    trigger: bool
    reason: str


def _r(category: str, tier: str, trigger: bool, reason: str) -> Rule:
    return Rule(category, tier, trigger, reason)


# Exact subcategory rules, keyed by lower-cased BSE SUBCATNAME.
SUBCATEGORY_RULES: dict[str, Rule] = {
    "financial results": _r("results", WK, True, "Quarterly results filing"),
    "earnings call transcript": _r("earnings_call", WK, False, "Concall transcript, feeds research"),
    "investor presentation": _r("results", WK, False, "Results deck from management"),
    "analyst / investor meet": _r("investor_meetings", RT, False, "Routine investor meeting schedule"),
    "press release / media release": _r("press_release", WK, False, "Company press release"),
    "press release / media release (revised)": _r("press_release", WK, False, "Revised company press release"),
    "newspaper publication": _r("unclassified", RT, False, "Newspaper ad, a compliance formality"),
    "allotment of esop / esps": _r("unclassified", RT, False, "Employee stock option allotment"),
    "credit rating": _r("credit_rating", WK, True, "Credit rating action"),
    "change in management": _r("management_change", WK, True, "Change in senior management"),
    "change in directorate": _r("management_change", WK, True, "Change on the board"),
    "resignation of director": _r("management_change", WK, True, "Director resignation"),
    "cessation": _r("management_change", WK, True, "Director or officer leaving"),
    "retirement": _r("management_change", WK, True, "Director or officer retiring"),
    "appointment of statutory auditor/s": _r("unclassified", RT, False, "Auditor appointment, routine"),
    "acquisition": _r("M&A", WK, True, "Acquisition update"),
    "amalgamation / merger": _r("M&A", WK, True, "Merger update"),
    "scheme of arrangement": _r("M&A", WK, True, "Scheme of arrangement"),
    "joint venture": _r("M&A", WK, True, "Joint venture update"),
    "diversification / disinvestment": _r("M&A", WK, True, "Stake sale or diversification"),
    "restructuring": _r("M&A", WK, True, "Corporate restructuring"),
    "postal ballot": _r("postal_ballot", WK, False, "Shareholders asked to vote on a resolution"),
    "egm": _r("agm_egm", RT, False, "General meeting paperwork"),
    "agm": _r("agm_egm", RT, False, "General meeting paperwork"),
    "certificate under reg. 74 (5) of sebi (dp) regulations, 2018": _r("unclassified", RT, False, "Depository compliance certificate"),
    "monitoring agency report": _r("unclassified", RT, False, "Monitoring agency report, routine"),
    "reg. 32 (1), (3) - statement of deviation & variation": _r("unclassified", RT, False, "Use of funds statement, routine"),
    "reg. 54 - asset cover details": _r("unclassified", RT, False, "Debt asset cover compliance"),
    "closure of trading window": _r("unclassified", RT, False, "Trading window closure, routine"),
    "trading window": _r("unclassified", RT, False, "Trading window closure, routine"),
    "dividend": _r("dividend", WK, True, "Dividend declared"),
    "record date": _r("dividend", RT, False, "Record date for a corporate action"),
    "date of payment of dividend": _r("dividend", RT, False, "Dividend payment date"),
    "dividend updates": _r("dividend", RT, False, "Dividend administrative update"),
    "bonus": _r("bonus_split", WK, True, "Bonus issue"),
    "stock split": _r("bonus_split", WK, True, "Stock split"),
    "sub-division": _r("bonus_split", WK, True, "Stock split"),
    "allotment of equity shares": _r("fund_raise", WK, True, "Equity shares allotted"),
    "issue of securities": _r("fund_raise", WK, True, "Securities issue"),
    "preferential issue": _r("fund_raise", WK, True, "Preferential issue"),
    "qualified institutional placement": _r("fund_raise", WK, True, "QIP"),
    "rights issue": _r("fund_raise", WK, True, "Rights issue"),
    "buy back": _r("fund_raise", WK, True, "Buyback"),
    "buyback": _r("fund_raise", WK, True, "Buyback"),
    "intimation of repayment of commercial paper (cp)": _r("unclassified", RT, False, "Commercial paper repaid on schedule"),
    "clarification": _r("press_release", WK, False, "Clarification on news or price movement"),
    "updates - corporate insolvency resolution process  (cirp)": _r("litigation", WK, True, "Insolvency proceedings update"),
    "updates - corporate insolvency resolution process (cirp)": _r("litigation", WK, True, "Insolvency proceedings update"),
    "award of order / receipt of order": _r("press_release", WK, False, "Order win"),
    "monthly business updates": _r("press_release", WK, False, "Monthly business update"),
    "disclosures under reg. 29(2) of sebi (sast) regulations, 2011": _r("insider_trading", WK, False, "Large shareholder changed their stake"),
    "disclosures under reg. 29(1) of sebi (sast) regulations, 2011": _r("insider_trading", WK, False, "Large shareholder crossed a threshold"),
    "disclosures under reg. 31(1) and 31(2) of sebi (sast) regulations, 2011": _r("pledging", WK, True, "Promoter pledge disclosure"),
    "board meeting rescheduled": _r("results", RT, False, "Board meeting date changed"),
}

VAGUE_SUBCATEGORIES = {"general", "others", "updates", "meeting updates", "company update"}

# Keyword rules for vague subcategories and board meetings, checked in order.
KEYWORD_RULES: list[tuple[re.Pattern[str], Rule]] = [
    (re.compile(r"\b(financial results?|unaudited|audited results?)\b", re.I), _r("results", WK, True, "Results filing")),
    (re.compile(r"\b(appoint\w*|resign\w*|cessation|re-?designat\w*|chief executive|managing director|\bceo\b|\bcfo\b|key managerial)\b", re.I),
     _r("management_change", WK, True, "Leadership change mentioned in the filing")),
    (re.compile(r"\b(acqui\w+|merger|amalgamat\w+|demerg\w+|joint venture|stake sale|divest\w*)\b", re.I),
     _r("M&A", WK, True, "Deal activity mentioned in the filing")),
    (re.compile(r"\b(penalt\w+|show cause|tax demand|demand order|gst|nclt|tribunal|court|litigation|adjudicat\w+|insolvency|fine imposed|sebi order)\b", re.I),
     _r("litigation", WK, True, "Legal or regulatory matter")),
    (re.compile(r"\b(preferential|qip|rights issue|buy-?back|commercial paper|non-convertible|ncds?|fund raising|raise funds)\b", re.I),
     _r("fund_raise", WK, True, "Fund raising mentioned in the filing")),
    (re.compile(r"\b(pledge\w*|encumbrance)\b", re.I), _r("pledging", WK, True, "Pledge or encumbrance")),
    (re.compile(r"\b(capex|capacity expansion|new plant|greenfield|brownfield)\b", re.I), _r("capex", WK, False, "Capacity or capex plan")),
    (re.compile(r"\b(credit rating|rating)\b", re.I), _r("credit_rating", WK, True, "Credit rating action")),
    (re.compile(r"\b(order|contract)s?\b.*\b(win|received|bagg\w*|secured|award\w*)|\b(bagg\w*|receiv\w*) of order", re.I),
     _r("press_release", WK, False, "Order win")),
    (re.compile(r"\b(trading window|newspaper|reg(ulation)?\.? ?74|loss of share certificate|duplicate share|transmission)\b", re.I),
     _r("unclassified", RT, False, "Routine compliance paperwork")),
]


def _keyword_rule(text: str) -> Rule | None:
    for pattern, rule in KEYWORD_RULES:
        if pattern.search(text):
            return rule
    return None


def _board_meeting(filing: RawFiling, sub: str) -> Rule:
    text = filing.subject + " " + (filing.headline or "")
    is_results = re.search(r"\bresults?\b", text, re.I) is not None
    if sub == "outcome of board meeting":
        if is_results:
            return _r("results", WK, True, "Board approved results")
        rule = _keyword_rule(text)
        if rule and rule.tier == WK:
            return Rule(rule.category, WK, rule.trigger, f"Board outcome: {rule.reason[0].lower()}{rule.reason[1:]}")
        return _r("unclassified", WK, False, "Board meeting outcome")
    # Intimations only announce a date; the upcoming strip uses them.
    if is_results:
        return _r("results", RT, False, "Results date announced")
    return _r("unclassified", RT, False, "Board meeting scheduled")


def rule_tier(filing: RawFiling) -> TierDecision:
    """Pure rules tier. Never returns needs_you; triggers do that."""
    sub = (filing.subcategory or "").strip().lower()
    cat = (filing.category or "").strip().lower()
    text = filing.subject + " " + (filing.headline or "")

    rule: Rule | None = None
    confidence = 0.95
    if cat == "board meeting" or sub in {"outcome of board meeting", "board meeting"}:
        rule = _board_meeting(filing, sub)
        confidence = 0.85
    elif sub in SUBCATEGORY_RULES:
        rule = SUBCATEGORY_RULES[sub]
    elif cat == "insider trading / sast":
        rule = _r("insider_trading", WK, False, "Insider or large shareholder trade")
        confidence = 0.8
    elif cat in {"corp. action", "corp action"}:
        rule = _keyword_rule(text) or _r("dividend", WK, False, "Corporate action")
        confidence = 0.7

    if rule is None and (sub in VAGUE_SUBCATEGORIES or not sub):
        rule = _keyword_rule(text)
        confidence = 0.6
        if rule is None:
            return TierDecision(
                finn_category="unclassified", tier=WK, tier_source="rule", confidence=0.3,
                reason="Vague filing, kept visible until reviewed", trigger_eligible=False, needs_llm=True,
            )
    if rule is None:
        # Unknown subcategory we have no rule for: fail upward.
        return TierDecision(
            finn_category="unclassified", tier=WK, tier_source="rule", confidence=0.4,
            reason=f"Unfamiliar filing type ({filing.subcategory}), kept visible",
            trigger_eligible=False, needs_llm=True,
        )
    return TierDecision(
        finn_category=rule.category, tier=rule.tier, tier_source="rule", confidence=confidence,
        reason=rule.reason, trigger_eligible=rule.trigger and rule.tier == WK,
        needs_llm=confidence < 0.7,
    )


def apply_triggers(decision: TierDecision, enabled: dict[str, bool]) -> TierDecision:
    """Promote to needs_you if the category is on the user's trigger list."""
    if decision.trigger_eligible and enabled.get(decision.finn_category, False):
        label = CATEGORY_LABELS.get(decision.finn_category, decision.finn_category)
        return decision.model_copy(update={
            "tier": "needs_you", "tier_source": "trigger",
            "reason": f"Matches your {label.lower()} alert. {decision.reason}.",
        })
    return decision


def classify(filing: RawFiling, enabled: dict[str, bool]) -> TierDecision:
    return apply_triggers(rule_tier(filing), enabled)
