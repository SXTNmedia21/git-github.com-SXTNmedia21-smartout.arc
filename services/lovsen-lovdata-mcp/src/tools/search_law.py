"""
search_law.py — MCP tool: full-text search within a Norwegian law on Lovdata.no.

Returns a list of ADR-0242-compliant Citation dicts (at most `limit` items).
In LOVSEN_FIXTURE_MODE=true mode: searches across available fixtures — zero HTTP.
In live mode: rate-limited via lovdata_client (1 req/sec, ADR-0244).
"""

from __future__ import annotations

import re
from typing import Any

from ..citation import Citation, now_utc_iso
from ..lovdata_client import (
    FIXTURE_MODE,
    list_fixtures,
    search_lovdata_html,
)
from ..parsers.paragraph import parse_search_results_html


def _fixture_search(query: str, lov: str | None, limit: int) -> list[dict[str, Any]]:
    """
    Simple keyword search over loaded fixtures.
    Returns at most `limit` results ranked by naive term frequency.
    """
    query_terms = [t.lower() for t in re.split(r"\s+", query.strip()) if t]
    fixtures = list_fixtures(lov=lov)

    scored: list[tuple[int, dict[str, Any]]] = []
    for fx in fixtures:
        text = fx.get("verbatim_text", "").lower()
        score = sum(text.count(term) for term in query_terms)
        if score > 0:
            # Freshen fetched_at
            fx = dict(fx)
            fx["fetched_at"] = now_utc_iso()
            scored.append((score, fx))

    # Sort descending by score, take top N
    scored.sort(key=lambda t: t[0], reverse=True)
    results = [fx for _, fx in scored[:limit]]
    return results


async def search_law(
    query: str, lov: str | None = None, limit: int = 10
) -> list[dict[str, Any]]:
    """
    Full-text search within a law (or all laws if lov is None).

    Parameters
    ----------
    query: Free-text query, e.g. "prøvetid" or "oppsigelse varsel"
    lov:   Optional law filter, e.g. "aml". None → search all available laws.
    limit: Max number of results (default 10, max 50).

    Returns
    -------
    List of ADR-0242 Citation dicts, ranked by relevance. May be empty.
    """
    query = query.strip()
    if not query:
        raise ValueError("query must not be empty")

    limit = max(1, min(limit, 50))

    if FIXTURE_MODE:
        results = _fixture_search(query, lov, limit)
        # Validate each result
        validated = []
        for item in results:
            try:
                citation = Citation(**item)
                validated.append(citation.model_dump())
            except Exception:  # noqa: BLE001
                pass  # skip malformed fixtures gracefully
        return validated

    # Live mode
    html = await search_lovdata_html(query=query, lov=lov, limit=limit)
    raw_results = parse_search_results_html(html=html, lov=lov, limit=limit)

    validated = []
    for item in raw_results:
        try:
            citation = Citation(**item)
            validated.append(citation.model_dump())
        except Exception:  # noqa: BLE001
            pass
    return validated
