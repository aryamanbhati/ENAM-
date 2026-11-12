"""Apply SQL migrations in order, once each, tracked in a _migrations table."""
from __future__ import annotations

import sys

from . import config


def run(mark_applied: list[str]) -> int:
    import psycopg

    url = config.env("DATABASE_URL")
    if not url:
        print("DATABASE_URL is not set", file=sys.stderr)
        return 1
    files = sorted((config.REPO_ROOT / "supabase" / "migrations").glob("*.sql"))
    with psycopg.connect(url, autocommit=True) as conn:
        conn.execute("create table if not exists _migrations (name text primary key, applied_at timestamptz default now())")
        done = {r[0] for r in conn.execute("select name from _migrations").fetchall()}
        for name in mark_applied:
            conn.execute("insert into _migrations (name) values (%s) on conflict do nothing", (name,))
            done.add(name)
        for f in files:
            if f.name in done:
                continue
            print(f"applying {f.name}")
            with conn.transaction():
                conn.execute(f.read_text(encoding="utf-8"))
                conn.execute("insert into _migrations (name) values (%s)", (f.name,))
        print("up to date")
    return 0
