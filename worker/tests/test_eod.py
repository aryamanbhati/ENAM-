from finn_worker.pipelines.eod import day_metrics, explaining_filing, signals_for


def rows(closes, vols):
    return [{"date": f"2026-10-{i + 1:02d}", "close": c, "volume": v} for i, (c, v) in enumerate(zip(closes, vols))]


def test_day_metrics_move_and_volume():
    r = rows([100] * 20 + [100, 106], [1000] * 21 + [3000])
    m = day_metrics(r)
    assert round(m["move_pct"], 2) == 6.0
    assert round(m["volume_multiple"], 2) == 3.0
    assert m["date"] == "2026-10-22"


def test_day_metrics_needs_history():
    assert day_metrics(rows([100], [1])) is None
    m = day_metrics(rows([100, 101], [1, 2]))
    assert m["volume_multiple"] is None  # not enough days for an average


def test_signals_thresholds():
    m = {"date": "2026-11-12", "move_pct": -5.4, "volume_multiple": 1.9}
    s = signals_for(1, m, price_pct=5, volume_multiple=2)
    assert [x["type"] for x in s] == ["price_move"]
    assert s[0]["value"] == -5.4


def test_explaining_filing_prefers_material_and_recent():
    fs = [
        {"id": "a", "filed_at": "2026-11-11T18:00:00+05:30", "tier": "worth_knowing"},
        {"id": "b", "filed_at": "2026-11-11T19:00:00+05:30", "tier": "needs_you"},
        {"id": "c", "filed_at": "2026-11-12T10:00:00+05:30", "tier": "routine"},
        {"id": "d", "filed_at": "2026-11-05T10:00:00+05:30", "tier": "needs_you"},
    ]
    assert explaining_filing("2026-11-12", fs) == "b"
    assert explaining_filing("2026-11-20", fs) is None
