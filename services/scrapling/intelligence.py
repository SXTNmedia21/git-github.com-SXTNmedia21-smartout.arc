"""
Workspace Intelligence — structured company data model, merge logic, and content generation.

This module powers the join wizard Step 3 content pipeline:
- WorkspaceIntelligence: the core data model (all fields nullable)
- merge_partial: safe merge of enrichment results (no overwrites, list dedup)
- compute_gaps: what data is still missing
- build_context: curated text block for the LLM prompt
- build_query_candidates / has_unused_queries: web search query management
"""

import json
import re
import logging
import asyncio
import os
from datetime import datetime
from typing import Optional

from pydantic import BaseModel

# These are used by downstream modules (enrich/generate endpoints),
# imported here so intelligence.py can be extended without extra imports.
# Guarded to allow standalone use (e.g. tests without full deps installed).
try:
    import aiohttp  # noqa: F401
except ImportError:
    aiohttp = None  # type: ignore[assignment]

try:
    from fastapi import Depends, HTTPException  # noqa: F401
except ImportError:
    pass

logger = logging.getLogger("scrapling.intelligence")


class WorkspaceIntelligence(BaseModel):
    # Identity (BRREG + user input)
    company_name: Optional[str] = None
    org_number: Optional[str] = None
    founding_date: Optional[str] = None
    years_in_business: Optional[int] = None
    industry: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None

    # Web presence (scrape)
    website_url: Optional[str] = None
    website_description: Optional[str] = None
    website_about_text: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    logo_url: Optional[str] = None
    social_links: dict[str, str] = {}
    menus: list[dict] = []
    reservation_url: Optional[str] = None

    # Web intelligence (Serper)
    google_rating: Optional[float] = None
    google_review_count: Optional[int] = None
    external_ratings: list[dict] = []
    news_articles: list[dict] = []
    web_mentions: list[str] = []
    seasonal_patterns: list[str] = []

    # Derived intelligence
    cuisine_types: list[str] = []
    price_range: Optional[str] = None
    concept_clues: list[str] = []

    # Source tracking
    sources: dict = {}


def merge_partial(intel: WorkspaceIntelligence, partial: dict) -> WorkspaceIntelligence:
    """Merge a partial enrichment result into the intelligence model.
    List fields are merged and deduplicated. Dict fields are deep-merged.
    Scalar fields are only set if currently None (first source wins)."""
    update = {}
    for key, value in partial.items():
        current = getattr(intel, key, None)
        if isinstance(current, list) and isinstance(value, list):
            merged = list(dict.fromkeys(current + value))
            update[key] = merged
        elif isinstance(current, dict) and isinstance(value, dict):
            update[key] = {**current, **value}
        elif current is None and value is not None:
            update[key] = value
    return intel.model_copy(update=update)


def compute_gaps(intel: WorkspaceIntelligence) -> list[str]:
    """Return list of missing data points. Empty list = fully enriched."""
    gaps = []
    if "web_search" not in intel.sources:
        gaps.append("web_search")
    if intel.founding_date is None:
        gaps.append("no_founding_date")
    if not intel.concept_clues:
        gaps.append("no_concept_clues")
    if not intel.cuisine_types:
        gaps.append("no_cuisine_types")
    if intel.google_rating is None:
        gaps.append("no_google_rating")
    return gaps


def build_query_candidates(company_name: str, city: Optional[str]) -> list[str]:
    """All possible search queries, ordered by priority."""
    queries = [
        f"{company_name} {city or ''}".strip(),
        f"{company_name} anmeldelse",
        f"{company_name} historie apnet",
        f"{company_name} konsept mat",
    ]
    if city:
        queries.append(f"{company_name} {city} restaurant")
    return queries


def has_unused_queries(intel: WorkspaceIntelligence, company_name: str, city: Optional[str]) -> bool:
    """Check if there are search queries we haven't tried yet."""
    ws = intel.sources.get("web_search", {})
    used = set(ws.get("queries_used", []))
    candidates = build_query_candidates(company_name, city)
    return any(q not in used for q in candidates)


def build_context(intel: WorkspaceIntelligence) -> str:
    """Build a curated text block from intelligence for the LLM prompt.
    Not a raw JSON dump — a human-readable summary of known facts."""
    lines: list[str] = []
    if intel.company_name:
        lines.append(f"Navn: {intel.company_name}")
    if intel.city:
        lines.append(f"By: {intel.city}")
    if intel.founding_date:
        years = f" ({intel.years_in_business} ar)" if intel.years_in_business else ""
        lines.append(f"Stiftet: {intel.founding_date}{years}")
    if intel.industry:
        lines.append(f"Bransje: {intel.industry}")
    if intel.cuisine_types:
        lines.append(f"Kjokken: {', '.join(intel.cuisine_types)}")
    if intel.price_range:
        lines.append(f"Priskategori: {intel.price_range}")
    if intel.concept_clues:
        lines.append(f"Konseptord: {', '.join(intel.concept_clues)}")
    if intel.website_description:
        lines.append(f"Nettside-beskrivelse: {intel.website_description}")
    if intel.website_about_text:
        about = intel.website_about_text[:500]
        lines.append(f"Fra 'Om oss'-siden: {about}")
    if intel.google_rating:
        rating_str = f"Google: {intel.google_rating}/5"
        if intel.google_review_count:
            rating_str += f" ({intel.google_review_count} anmeldelser)"
        lines.append(rating_str)
    if intel.external_ratings:
        for r in intel.external_ratings[:3]:
            lines.append(f"{r.get('source', '?')}: {r.get('rating', '?')}/5")
    if intel.news_articles:
        lines.append("Nevnt i media:")
        for a in intel.news_articles[:3]:
            lines.append(f"  - {a.get('title', '')}: {a.get('snippet', '')[:100]}")
    if intel.web_mentions:
        lines.append("Fra Google-resultater:")
        for m in intel.web_mentions[:3]:
            lines.append(f"  - {m[:150]}")
    if intel.seasonal_patterns:
        lines.append(f"Sesongaktiviteter: {', '.join(intel.seasonal_patterns)}")
    return "\n".join(lines)


def compute_years_in_business(founding_date: Optional[str]) -> Optional[int]:
    """Compute years since founding. Returns None if no date."""
    if not founding_date:
        return None
    try:
        year = datetime.fromisoformat(founding_date).year
        return datetime.now().year - year
    except (ValueError, TypeError):
        return None
