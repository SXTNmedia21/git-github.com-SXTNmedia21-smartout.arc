"""
lookup_tariff_supplement.py — MCP tool: look up a Riksavtalen tariff supplement.

Tool contract (ADR-0244):
  lookup_tariff_supplement(category: str, version: str) -> Citation

  category: Supplement type (kveldstillegg, garantilonn/garantilønn).
  version: REQUIRED — "2024" or "2025". Never defaults to latest.

  paragraph field in returned Citation: riksavtalen_{version}/{category}

Returns ADR-0242 Citation dict with law_version set to the requested version.

Why version is required:
  Each supplement category has different rates per agreement year.
  Returning 2025 kveldstillegg (27%) when 2024 was asked (25%) is a legal error.
  Version-confusion is the primary Lovsen risk (README §Risiko, ADR-0244).

In fixture mode (LOVSEN_MCP_FIXTURE=1): delegates to fixtures.fixture_lookup_tariff_supplement().
In live mode: fetches from nhoreiseliv.no, parses HTML, builds Citation.
"""

from __future__ import annotations

import logging
from typing import Any

from ..nho_reiseliv_client import FIXTURE_MODE, SUPPORTED_VERSIONS
from ..citation import make_citation, now_utc_iso

logger = logging.getLogger("lovsen.nho_reiseliv.lookup_tariff_supplement")

# Supported supplement categories (normalised)
_SUPPORTED_CATEGORIES = {
    "kveldstillegg",
    "garantilonn",
    "garantilønn",  # Norwegian ø accepted, normalised in fixture layer
}

_SOURCE_BASE = "https://www.nhoreiseliv.no/overenskomster/riksavtalen"


def lookup_tariff_supplement(
    category: str,
    version: str,
) -> dict[str, Any]:
    """
    Look up a Riksavtalen tariff supplement for the given version.

    Returns Citation dict (ADR-0242) with paragraph = riksavtalen_{version}/{category}.

    Args:
        category: Supplement category — "kveldstillegg" or "garantilonn".
        version: Riksavtalen agreement year — "2024" or "2025". REQUIRED.

    Raises:
        ValueError: Unsupported version or category.
    """
    if version not in SUPPORTED_VERSIONS:
        raise ValueError(
            f"Unsupported Riksavtalen version: {version!r}. "
            f"Supported versions: {sorted(SUPPORTED_VERSIONS)}. "
            "Specify an explicit version — no silent fallback."
        )

    if category not in _SUPPORTED_CATEGORIES:
        raise ValueError(
            f"Unknown supplement category: {category!r}. "
            f"Supported: {sorted(_SUPPORTED_CATEGORIES)}"
        )

    if FIXTURE_MODE:
        from ..fixtures import fixture_lookup_tariff_supplement
        result = fixture_lookup_tariff_supplement(category=category, version=version)
        logger.info(
            "lookup_tariff_supplement [fixture] category=%r version=%r → ok",
            category, version,
        )
        return result

    # Live mode
    return _live_lookup(category, version)


def _live_lookup(category: str, version: str) -> dict[str, Any]:
    """
    Fetch live tariff supplement from nhoreiseliv.no.

    Phase 7 (live fetch). Maps category to the relevant Riksavtalen paragraph,
    then delegates to the HTTP client.
    """
    from ..nho_reiseliv_client import fetch_riksavtalen_page
    from ..parsers.riksavtalen import extract_paragraph_text

    # Category → paragraph mapping for live mode
    _CATEGORY_TO_PARAGRAPH: dict[str, str] = {
        "kveldstillegg": "§6.1",
        "garantilonn": "§5",
        "garantilønn": "§5",
    }

    paragraph = _CATEGORY_TO_PARAGRAPH.get(category)
    if paragraph is None:
        raise ValueError(f"No paragraph mapping for category: {category!r}")

    source_url = f"{_SOURCE_BASE}/{version}"
    html = fetch_riksavtalen_page(version, paragraph)
    text = extract_paragraph_text(html, paragraph)

    if text is None:
        raise ValueError(
            f"Category {category!r} paragraph {paragraph!r} not found in Riksavtalen {version}. "
            f"Source: {source_url}"
        )

    citation = make_citation(
        lov="riksavtalen",
        paragraph=f"riksavtalen_{version}/{category}",
        verbatim_text=text,
        source_url=source_url,
        fetched_at=now_utc_iso(),
        law_version=version,
    )
    return citation.model_dump()
