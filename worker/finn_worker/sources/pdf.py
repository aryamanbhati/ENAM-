"""PDF text, page by page (PyMuPDF)."""
from __future__ import annotations

import re

import pymupdf


def pages_text(data: bytes, max_pages: int | None = None) -> list[str]:
    doc = pymupdf.open(stream=data, filetype="pdf")
    n = doc.page_count if max_pages is None else min(max_pages, doc.page_count)
    out = [doc[i].get_text("text") for i in range(n)]
    doc.close()
    return out


def normalise(text: str) -> str:
    """Lower-case, unify quotes and dashes, collapse whitespace. Used for quote verification."""
    t = text.lower()
    t = t.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    t = t.replace("–", "-").replace("—", "-").replace(" ", " ")
    t = re.sub(r"-\s*\n\s*", "", t)          # words hyphenated across lines
    t = re.sub(r"[^a-z0-9%.,'\"₹$ -]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def with_page_markers(pages: list[str], max_chars_per_page: int = 6000) -> str:
    return "\n".join(f"<page n=\"{i + 1}\">\n{p[:max_chars_per_page].strip()}\n</page>" for i, p in enumerate(pages))
