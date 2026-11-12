"""Evaluation (DESIGN.md 6.8). Writes eval/results/<name>.json and prints a summary.

classifier  Tier decisions vs eval/classifier_labels.csv (material vs routine). Reports accuracy for the
            rules tier alone and for the final tier (rules + model), and how often errors went upward.
results     Results-filing numbers extracted from PDFs vs screener's quarterly table (independent source).
promises    Quote verification pass rate per researched company, and verdict mix.
cost        Measured model usage from llm_calls: per step, per research run, cache hit rate.
"""
from __future__ import annotations

import csv
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone

from .config import REPO_ROOT
from .db import Db
from .sources.bse import parse_announcement
from .models import RawFiling
from .pipelines.tiering import rule_tier

OUT = REPO_ROOT / "eval" / "results"


def _write(name: str, data: dict) -> dict:
    OUT.mkdir(parents=True, exist_ok=True)
    data["generated_at"] = datetime.now(timezone.utc).isoformat()
    (OUT / f"{name}.json").write_text(json.dumps(data, indent=1, default=str), encoding="utf-8")
    return data


def classifier(db: Db) -> dict:
    labels = {r["id"]: r["label"] for r in csv.DictReader(open(REPO_ROOT / "eval" / "classifier_labels.csv", encoding="utf-8"))
              if r["label"] in ("material", "routine")}
    rows = db.select("filings", {"select": "id,tier,tier_source,raw", "id": f"in.({','.join(labels)})"})
    rule_ok = final_ok = 0
    up = down = 0          # errors: routine shown as material (up) vs material hidden as routine (down)
    rule_up = rule_down = 0
    by_src = Counter()
    misses = []
    for r in rows:
        truth = labels[r["id"]]
        f: RawFiling = parse_announcement(r["raw"])
        rule_pred = "routine" if rule_tier(f).tier == "routine" else "material"
        final_pred = "routine" if r["tier"] == "routine" else "material"
        by_src[r["tier_source"]] += 1
        rule_ok += rule_pred == truth
        final_ok += final_pred == truth
        if rule_pred != truth:
            rule_up += rule_pred == "material"
            rule_down += rule_pred == "routine"
        if final_pred != truth:
            up += final_pred == "material"
            down += final_pred == "routine"
            misses.append({"id": r["id"], "subcategory": f.subcategory, "subject": f.subject[:120], "truth": truth, "pred": final_pred})
    n = len(rows)
    return _write("classifier", {
        "n": n, "labels": "material vs routine, labelled by the developer using the reference categories",
        "rules_accuracy": round(rule_ok / n, 3), "rules_errors_upward": rule_up, "rules_errors_downward": rule_down,
        "final_accuracy": round(final_ok / n, 3), "final_errors_upward": up, "final_errors_downward": down,
        "tier_sources": dict(by_src), "misses": misses,
    })


def results(db: Db) -> dict:
    """Compare PDF-extracted current-quarter numbers with screener's quarterly table (both in Rs crore)."""
    from .sources.screener import quarter_label_to_period

    rows = db.select("filings", {"select": "id,company_id,filed_at,enrichment", "enrichment->>kind": "eq.results"})
    facts = db.select("facts", {"select": "company_id,period,metric,value,basis", "metric": "in.(revenue,pbt,pat)", "extractor": "eq.screener"})
    by = defaultdict(dict)
    for f in facts:
        by[(f["company_id"], f["period"])][f["metric"]] = float(f["value"])
    checked = matched = 0
    detail = []
    for r in rows:
        e = r["enrichment"]
        filed = datetime.fromisoformat(r["filed_at"])
        # results filed in Oct/Nov 2026 are for the quarter ended Sep 2026, etc.
        m, y = filed.month, filed.year
        label = {1: f"Dec {y - 1}", 2: f"Dec {y - 1}", 3: f"Dec {y - 1}", 4: f"Mar {y}", 5: f"Mar {y}", 6: f"Mar {y}",
                 7: f"Jun {y}", 8: f"Jun {y}", 9: f"Jun {y}", 10: f"Sep {y}", 11: f"Sep {y}", 12: f"Sep {y}"}[m]
        period = quarter_label_to_period(label)
        ref = by.get((r["company_id"], period))
        if not ref:
            continue
        scale = {"lakh": 0.01, "million": 0.1, "crore": 1.0}.get(e.get("unit", "crore"), 1.0)
        for row in e["rows"]:
            key = {"Revenue": "revenue", "PBT": "pbt", "PAT": "pat"}.get(row["metric"])
            if not key or key not in ref:
                continue
            ours = row["current"] * scale
            theirs = ref[key]
            ok = abs(ours - theirs) <= max(0.01 * abs(theirs), 1.0)
            checked += 1
            matched += ok
            detail.append({"filing": r["id"], "period": period, "metric": key, "ours_cr": round(ours, 1), "screener_cr": theirs,
                           "basis": e.get("basis"), "match": ok})
    return _write("results", {"compared": checked, "matched_within_1pct": matched,
                              "match_rate": round(matched / checked, 3) if checked else None, "detail": detail,
                              "note": "Mismatches are often basis differences (standalone vs consolidated) or revenue definitions (total income vs revenue from operations)."})


def promises(db: Db) -> dict:
    rs = db.select("research", {"select": "company_id,status,scorecard,transcripts", "status": "in.(ready,no_guidance)"})
    names = {c["id"]: c["nse_symbol"] for c in db.select("companies", {"select": "id,nse_symbol"})}
    per = []
    tv = td = 0
    for r in rs:
        s = r["scorecard"] or {}
        v, d = s.get("quotes_verified", 0), s.get("quotes_dropped", 0)
        tv, td = tv + v, td + d
        per.append({"symbol": names.get(r["company_id"]), "transcripts": r["transcripts"], "promises": s.get("total", 0),
                    "quotes_verified": v, "quotes_dropped": d,
                    "verdicts": {k: s.get(k, 0) for k in ("delivered", "partly", "missed", "dropped", "too_early", "not_measurable")}})
    return _write("promises", {"companies": per, "quote_verification_pass_rate": round(tv / (tv + td), 3) if tv + td else None,
                               "note": "Precision and recall against hand-labelled promises need human labels; see eval/README.md."})


def cost(db: Db) -> dict:
    calls = db.select("llm_calls", {"select": "step,model,tokens_in,tokens_out,cost,cache_hit,latency_ms", "limit": "10000"})
    by = defaultdict(lambda: {"calls": 0, "cache_hits": 0, "tokens_in": 0, "tokens_out": 0, "cost_usd": 0.0})
    for c in calls:
        b = by[c["step"]]
        b["calls"] += 1
        b["cache_hits"] += bool(c["cache_hit"])
        b["tokens_in"] += c["tokens_in"] or 0
        b["tokens_out"] += c["tokens_out"] or 0
        b["cost_usd"] += float(c["cost"] or 0)
    research_cost = sum(v["cost_usd"] for k, v in by.items() if k.startswith("research."))
    n_research = len(db.select("research", {"select": "company_id", "status": "in.(ready,no_guidance)"}))
    total = sum(v["cost_usd"] for v in by.values())
    hits = sum(v["cache_hits"] for v in by.values())
    return _write("cost", {
        "by_step": {k: {**v, "cost_usd": round(v["cost_usd"], 4)} for k, v in sorted(by.items())},
        "total_calls": len(calls), "cache_hit_rate": round(hits / len(calls), 3) if calls else None,
        "total_cost_usd_at_list_price": round(total, 4), "actual_cost_usd": 0.0,
        "research_runs": n_research, "avg_research_cost_usd": round(research_cost / n_research, 4) if n_research else None,
        "models": dict(Counter(c["model"] for c in calls)),
        "note": "Built on Gemini's free tier, so actual spend is zero. Costs are what the same tokens would cost at paid list prices.",
    })


def run(name: str) -> dict:
    db = Db()
    fn = {"classifier": classifier, "results": results, "promises": promises, "cost": cost}[name]
    return fn(db)
