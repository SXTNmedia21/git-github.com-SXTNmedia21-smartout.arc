"""
search_guidance.py — MCP tool: search Arbeidstilsynet veiledninger

Tool contract (ADR-0244):
  search_guidance(query: str, scope: str | None = None, limit: int = 10) -> list[Citation]

  scope values: 'hms' | 'risikovurdering' | 'arbeidstid' | None
  Returns list of ADR-0242 Citation dicts.

In fixture mode (LOVSEN_MCP_FIXTURE=1): delegates to fixtures.fixture_search_guidance().
In live mode: fetches from arbeidstilsynet.no, parses result page, builds Citations.

Why separate tool file: matches the 2-tool boundary in ADR-0244; each tool owns its
own routing, parsing, and error semantics independently.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from ..arbeidstilsynet_client import FIXTURE_MODE
from ..citation import make_citation, now_utc_iso

logger = logging.getLogger("lovsen.arbeidstilsynet.search_guidance")

_SCOPE_VALUES = {"hms", "risikovurdering", "arbeidstid"}
_SOURCE_BASE = "https://www.arbeidstilsynet.no"


def search_guidance(
    query: str,
    scope: Optional[str] = None,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """
    Full-text search Arbeidstilsynet veiledninger.

    Returns list[Citation] as plain dicts (JSON-serialisable).

    Args:
        query: Search query string.
        scope: Optional filter — 'hms', 'risikovurdering', or 'arbeidstid'.
        limit: Max results to return (1–50).

    Raises:
        ValueError: Invalid scope or limit.
        RuntimeError: Live fetch failure (live mode only).
    """
    if scope is not None and scope not in _SCOPE_VALUES:
        raise ValueError(
            f"Invalid scope {scope!r}. Valid values: {sorted(_SCOPE_VALUES)}"
        )
    limit = max(1, min(50, limit))

    if FIXTURE_MODE:
        from ..fixtures import fixture_search_guidance
        results = fixture_search_guidance(query, scope, limit)
        logger.info(
            "search_guidance [fixture] query=%r scope=%r → %d result(s)",
            query, scope, len(results),
        )
        return results

    # Live mode: fetch arbeidstilsynet.no search page and parse
    return _live_search(query, scope, limit)


def _live_search(query: str, scope: Optional[str], limit: int) -> list[dict[str, Any]]:
    """
    Fetch live search results from arbeidstilsynet.no.

    Parses the HTML results page for guidance article links,
    then fetches each article and extracts verbatim text.
    """
    from ..arbeidstilsynet_client import search_arbeidstilsynet, fetch_arbeidstilsynet_page
    import re

    logger.info("search_guidance [live] query=%r scope=%r limit=%d", query, scope, limit)

    html = search_arbeidstilsynet(query, scope)

    # Extract article links from search results page
    # arbeidstilsynet.no uses <a href="/tema/..."> pattern for guidance articles
    links = re.findall(r'href="(/tema/[^"]+)"', html)
    seen: set[str] = set()
    unique_links: list[str] = []
    for link in links:
        if link not in seen:
            seen.add(link)
            unique_links.append(link)
        if len(unique_links) >= limit:
            break

    results: list[dict[str, Any]] = []
    for path in unique_links:
        try:
            article_html = fetch_arbeidstilsynet_page(path)
            citation_data = _parse_article(article_html, path, query)
            if citation_data:
                results.append(citation_data)
        except Exception as exc:
            logger.warning("Could not fetch/parse article %s: %s", path, exc)

    if not results:
        logger.warning("search_guidance: no results for query=%r scope=%r", query, scope)

    return results


def _parse_article(html: str, path: str, query: str) -> Optional[dict[str, Any]]:
    """
    Parse an arbeidstilsynet.no article page into a Citation dict.

    Extracts the main content text and builds a Citation.
    In production (P1.S2+) this would use a proper HTML parser.
    """
    import re

    # Remove HTML tags to get text content
    text = re.sub(r"<[^>]+>", " ", html)
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()

    if not text or len(text) < 50:
        return None

    # Take a window of text around the query term
    lower_text = text.lower()
    lower_query = query.lower()
    idx = lower_text.find(lower_query)
    if idx >= 0:
        start = max(0, idx - 200)
        end = min(len(text), idx + 500)
        excerpt = text[start:end].strip()
    else:
        # Fallback to first 700 chars
        excerpt = text[:700].strip()

    url = f"{_SOURCE_BASE}{path}"
    return make_citation(
        lov="arbeidstilsynet-veiledning",
        paragraph=path.strip("/").replace("/", " > "),
        verbatim_text=excerpt,
        source_url=url,
        fetched_at=now_utc_iso(),
    ).model_dump()
