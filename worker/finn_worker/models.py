"""Shared Pydantic models."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

Tier = Literal["needs_you", "worth_knowing", "routine"]
TierSource = Literal["rule", "llm", "trigger"]


class Company(BaseModel):
    id: int | None = None
    nse_symbol: str
    bse_code: str
    name: str


class RawFiling(BaseModel):
    """A filing as parsed from the exchange, before tiering."""

    id: str
    bse_code: str
    filed_at: datetime
    category: str | None
    subcategory: str | None
    subject: str
    headline: str | None
    pdf_url: str | None
    raw: dict


class TierDecision(BaseModel):
    finn_category: str
    tier: Tier
    tier_source: TierSource
    confidence: float
    reason: str
    trigger_eligible: bool
    needs_llm: bool = False
