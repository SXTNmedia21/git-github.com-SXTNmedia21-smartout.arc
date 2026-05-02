"""
search_regulation.py — MCP tool: search Mattilsynet.no regulations.

Returns a list of ADR-0242-compliant Citation dicts.
In LOVSEN_MCP_FIXTURE=1 mode: returns Citations from fixture files matching
the query/scope — zero network calls.
In live mode: queries Mattilsynet.no search endpoint (rate-limited via client).

Reference: docs/decisions/0242-lovsen-citation-contract.md
           docs/decisions/0244-lovsen-mcp-boundary.md
"""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Fixture directory relative to this file: src/tools/ → src/fixtures/
_FIXTURES_DIR = Path(__file__).parent.parent / "fixtures"

# Map fixture files to searchable metadata
_FIXTURE_INDEX: list[dict[str, Any]] = [
    {
        "file": "alkohol_servering_aldersgrense.json",
        "keywords": ["alkohol", "aldersgrense", "skjenke", "bevilling", "18 år", "servering"],
        "scopes": ["alkohol", "bevilling", "aldersgrense"],
    },
    {
        "file": "allergener_pliktig_merking.json",
        "keywords": ["allergen", "allergener", "merking", "matinformasjon", "gluten", "laktose"],
        "scopes": ["allergener", "merking"],
    },
    {
        "file": "hygiene_temperatur_kjedge.json",
        "keywords": ["hygiene", "kjøl", "temperatur", "kjølekjede", "haccp", "frysing"],
        "scopes": ["hygiene"],
    },
]


def _load_fixture(filename: str) -> dict[str, Any]:
    """Load and parse a fixture JSON file. Raises FileNotFoundError if missing."""
    path = _FIXTURES_DIR / filename
    if not path.exists():
        raise FileNotFoundError(
            f"fixture not found: {path}. "
            "Fixture file is required in LOVSEN_MCP_FIXTURE=1 mode."
        )
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"malformed JSON in fixture {filename}: {exc}") from exc


def _fixture_matches(
    entry: dict[str, Any],
    query: str,
    scope: str | None,
) -> bool:
    """Return True if a fixture index entry matches the query + optional scope filter."""
    query_lower = query.lower()
    keywords_lower = [k.lower() for k in entry["keywords"]]
    scopes_lower = [s.lower() for s in entry["scopes"]]

    # Scope filter first (fast reject)
    if scope is not None and scope.lower() not in scopes_lower:
        return False

    # Query must match at least one keyword or appear in the keyword list
    return any(query_lower in kw or kw in query_lower for kw in keywords_lower)


def run_search_regulation(
    query: str,
    scope: str | None = None,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """
    Search Mattilsynet.no for Norwegian food-safety regulations.

    Parameters
    ----------
    query: Full-text search query (Norwegian preferred)
    scope: Optional domain filter ('alkohol', 'hygiene', 'allergener', etc.)
    limit: Max results (default 10, capped at 20)

    Returns
    -------
    List of ADR-0242 Citation dicts

    Raises
    ------
    ValueError  — invalid input
    RuntimeError — network call attempted in fixture mode
    """
    query = query.strip()
    if not query:
        raise ValueError("query must not be empty")

    limit = min(int(limit), 20)

    from ..mattilsynet_client import FIXTURE_MODE, fetch_url
    from ..citation import Citation, now_utc_iso
    from ..parsers.regulation import parse_mattilsynet_page

    if FIXTURE_MODE:
        results: list[dict[str, Any]] = []
        for entry in _FIXTURE_INDEX:
            if len(results) >= limit:
                break
            if _fixture_matches(entry, query, scope):
                raw = _load_fixture(entry["file"])
                # Freshen fetched_at on every read (fixtures store a static stamp)
                raw = dict(raw)
                raw["fetched_at"] = now_utc_iso()
                citation = Citation(**raw)
                results.append(citation.model_dump())

        logger.info(
            f"search_regulation(fixture): query={query!r} scope={scope!r} → {len(results)} results"
        )
        return results

    # Live mode: query Mattilsynet search
    # Mattilsynet.no does not expose a public search API; we fall back to their
    # search page and parse results. For P1.S1b this path is exercised in integration
    # testing only — all CI tests use fixture mode.
    search_url = (
        f"https://www.mattilsynet.no/sok/?q={query.replace(' ', '+')}"
        + (f"&tema={scope}" if scope else "")
    )
    logger.info(f"search_regulation(live): fetching {search_url}")
    html = fetch_url(search_url)
    # In live mode we return a single search-page Citation as a summary
    fetched_at = now_utc_iso()
    parsed = parse_mattilsynet_page(
        html=html,
        lov="mattilsynet-search",
        paragraph=f"search/{query[:50]}",
        source_url=search_url,
        fetched_at=fetched_at,
    )
    citation = Citation(**parsed)
    return [citation.model_dump()]
