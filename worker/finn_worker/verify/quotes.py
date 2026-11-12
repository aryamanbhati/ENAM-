"""Quote and number verification (guardrails 1 and 2).

A quote is accepted only if a normalised fuzzy match finds it on the cited page (or the page boundary
next to it). Numbers claimed by a model are accepted only if they appear in the verified quote.
"""
from __future__ import annotations

import re

from rapidfuzz import fuzz

from ..sources.pdf import normalise

QUOTE_THRESHOLD = 90


def quote_on_page(quote: str, pages: list[str], page: int, threshold: int = QUOTE_THRESHOLD) -> tuple[bool, int | None]:
    """Return (ok, page_found). Checks the cited page, then neighbours (quotes can straddle a page break)."""
    q = normalise(quote)
    if len(q) < 12:
        return False, None
    order = [page, page + 1, page - 1]
    for p in order:
        if 1 <= p <= len(pages):
            hay = normalise(pages[p - 1])
            if q in hay or fuzz.partial_ratio(q, hay) >= threshold:
                return True, p
    # straddling: join cited page with the next
    if 1 <= page < len(pages):
        hay = normalise(pages[page - 1] + " " + pages[page])
        if fuzz.partial_ratio(q, hay) >= threshold:
            return True, page
    return False, None


_NUM = re.compile(r"(?<![\w.])(\d{1,3}(?:,\d{2,3})+|\d+(?:\.\d+)?)")


def numbers_in(text: str) -> set[float]:
    return {float(m.replace(",", "")) for m in _NUM.findall(text)}


def number_in_text(value: float, text: str) -> bool:
    """True if `value` (as written, or as a whole number) appears in `text`."""
    found = numbers_in(text)
    return any(abs(v - value) < 1e-6 for v in found)
