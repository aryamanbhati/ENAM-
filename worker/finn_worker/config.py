"""Environment config. Loads .env.local from the repo root if present."""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[2]
WORKER_ROOT = REPO_ROOT / "worker"
CACHE_DIR = WORKER_ROOT / ".cache"

load_dotenv(REPO_ROOT / ".env.local")
load_dotenv(REPO_ROOT / ".env")


def env(name: str, default: str | None = None) -> str | None:
    value = os.environ.get(name)
    return value if value else default


def _project_url(url: str | None) -> str | None:
    """Accept the bare project URL or the Data API URL ending in /rest/v1."""
    if not url:
        return None
    url = url.strip().rstrip("/")
    return url[: -len("/rest/v1")] if url.endswith("/rest/v1") else url


SUPABASE_URL = _project_url(env("SUPABASE_URL"))
SUPABASE_SERVICE_ROLE_KEY = env("SUPABASE_SERVICE_ROLE_KEY")
USER_AGENT = env("FINN_USER_AGENT", "FINN-research-prototype/0.1")
