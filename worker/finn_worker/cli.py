"""FINN worker entry points. Run as: python -m finn_worker.cli <command>."""
from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime
from pathlib import Path


def _iso(value: str) -> datetime:
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        from .sources.bse import IST

        dt = dt.replace(tzinfo=IST)
    return dt


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="finn_worker")
    sub = p.add_subparsers(dest="cmd", required=True)

    f = sub.add_parser("ingest-filings", help="Fetch BSE filings for the portfolio, tier them, store them")
    f.add_argument("--since", type=_iso, help="ISO datetime (IST if no offset). Default: last stored filing, else 2 days")
    f.add_argument("--symbols", nargs="*", help="Limit to these NSE symbols")
    f.add_argument("--dry-run", action="store_true", help="Do not touch the database; portfolio read from seed.sql")
    f.add_argument("--retier", action="store_true", help="Overwrite tiers of filings already stored")
    f.add_argument("--out", type=Path, help="Write tiered rows to this JSON file")

    args = p.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    if args.cmd == "ingest-filings":
        from .pipelines.filings import run

        summary = run(args.since, args.dry_run, args.retier, args.symbols, args.out)
        print(json.dumps(summary, indent=1))
        return 1 if summary["failed"] and len(summary["failed"]) == summary["companies"] else 0
    return 2


if __name__ == "__main__":
    sys.exit(main())
