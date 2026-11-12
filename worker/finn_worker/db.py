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

    def insert(self, table: str, rows: list[dict[str, Any]] | dict[str, Any], returning: bool = False) -> list[dict[str, Any]]:
        rows = [rows] if isinstance(rows, dict) else rows
        if not rows:
            return []
        prefer = "return=representation" if returning else "return=minimal"
        r = self._c.post(f"/{table}", headers={"Prefer": prefer}, json=rows)
        if r.status_code >= 400:
            raise RuntimeError(f"Insert into {table} failed: {r.status_code} {r.text[:500]}")
        return r.json() if returning else []

    def update(self, table: str, match: dict[str, str], values: dict[str, Any]) -> None:
        r = self._c.patch(f"/{table}", params=match, headers={"Prefer": "return=minimal"}, json=values)
        if r.status_code >= 400:
            raise RuntimeError(f"Update of {table} failed: {r.status_code} {r.text[:500]}")

    def delete(self, table: str, match: dict[str, str]) -> None:
        r = self._c.delete(f"/{table}", params=match)
        if r.status_code >= 400:
            raise RuntimeError(f"Delete from {table} failed: {r.status_code} {r.text[:500]}")

    def rpc(self, fn: str, args: dict[str, Any]) -> Any:
        r = self._c.post(f"/rpc/{fn}", json=args)
        if r.status_code >= 400:
            raise RuntimeError(f"RPC {fn} failed: {r.status_code} {r.text[:500]}")
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
