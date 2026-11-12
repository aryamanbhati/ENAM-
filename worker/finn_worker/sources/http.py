"""Polite, cached HTTP for screener pages and exchange PDFs.

Every response is cached on disk by URL (and stored with its content hash), so a page or PDF is never
fetched twice. Requests are throttled per host and retried with exponential backoff.
"""
from __future__ import annotations

import hashlib
import logging
import time
from urllib.parse import urlparse

import requests

from ..config import CACHE_DIR

log = logging.getLogger(__name__)

BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"
HOST_INTERVAL = {"www.screener.in": 2.0, "www.bseindia.com": 1.5}
_last: dict[str, float] = {}
_session = requests.Session()


def url_key(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:32]


def content_hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def get_cached(url: str, kind: str = "bin", max_age_s: float | None = None, attempts: int = 4) -> bytes:
    """Fetch with disk cache. HTML pages expire after max_age_s (default 6h); PDFs never expire."""
    folder = CACHE_DIR / kind
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / url_key(url)
    if max_age_s is None:
        max_age_s = 6 * 3600 if kind == "html" else float("inf")
    if path.exists() and time.time() - path.stat().st_mtime < max_age_s:
        return path.read_bytes()

    host = urlparse(url).netloc
    headers = {"User-Agent": BROWSER_UA, "Accept": "*/*", "Accept-Language": "en-US,en;q=0.9"}
    if "bseindia" in host:
        headers["Referer"] = "https://www.bseindia.com/"
    last_exc: Exception | None = None
    for attempt in range(attempts):
        wait = HOST_INTERVAL.get(host, 1.0) - (time.monotonic() - _last.get(host, 0))
        if wait > 0:
            time.sleep(wait)
        _last[host] = time.monotonic()
        try:
            r = _session.get(url, headers=headers, timeout=90, allow_redirects=True)
            if r.status_code == 200 and r.content:
                if kind == "pdf" and not r.content.startswith(b"%PDF"):
                    raise ValueError(f"not a PDF ({r.headers.get('content-type')})")
                path.write_bytes(r.content)
                return r.content
            if r.status_code == 404:
                raise FileNotFoundError(url)
            last_exc = RuntimeError(f"HTTP {r.status_code}")
        except FileNotFoundError:
            raise
        except Exception as exc:
            last_exc = exc
        delay = 3 * 2**attempt
        log.warning("Fetch failed (%s, attempt %d): %s; retrying in %ds", url[:90], attempt + 1, last_exc, delay)
        time.sleep(delay)
    raise RuntimeError(f"Could not fetch {url}: {last_exc}")
