"""Minimal Supabase (PostgREST) client using the service role key. Worker only."""
from __future__ import annotations

from typing import Any

import httpx

from . import config


class Db:
    def __init__(self, url: str | None = None, key: str | None = None) -> None:
        url = url or config.SUPABASE_URL
        key = key or config.SUPABASE_SERVICE_ROLE_KEY
        if not url or not key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.example)")
        headers = {"apikey": key, "Content-Type": "application/json"}
        if not key.startswith("sb_"):
            # Legacy JWT keys also go in Authorization. New sb_secret_ keys are not JWTs: apikey alone.
            headers["Authorization"] = f"Bearer {key}"
        self._c = httpx.Client(base_url=f"{url.rstrip('/')}/rest/v1", headers=headers, timeout=30)

    def select(self, table: str, params: dict[str, str] | None = None) -> list[dict[str, Any]]:
        r = self._c.get(f"/{table}", params=params or {"select": "*"})
        r.raise_for_status()
        return r.json()

    def upsert(self, table: str, rows: list[dict[str, Any]], on_conflict: str, ignore_duplicates: bool = False) -> None:
        if not rows:
            return
        resolution = "ignore-duplicates" if ignore_duplicates else "merge-duplicates"
        for i in range(0, len(rows), 500):
            r = self._c.post(
                f"/{table}", params={"on_conflict": on_conflict},
                headers={"Prefer": f"resolution={resolution},return=minimal"}, json=rows[i : i + 500],
            )
            if r.status_code >= 400:
                raise RuntimeError(f"Upsert into {table} failed: {r.status_code} {r.text[:500]}")
