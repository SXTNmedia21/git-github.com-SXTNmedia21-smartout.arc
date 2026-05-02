"""
fetch_riksavtalen.py — MCP tool: fetch a Riksavtalen paragraph for a specific version.

Tool contract (ADR-0244):
  fetch_riksavtalen(version: str, paragraph: str | None = None) -> Citation | dict

  version: REQUIRED — "2024" or "2025". Never defaults to latest (ADR-0244, README §5).
  paragraph: Optional paragraph ref (e.g. "§6.1"); if None returns metadata.

  Returns ADR-0242 Citation dict with law_version set to the requested version.

Why version is required and never defaulted:
  Tariff rates change year-over-year. Returning 2025 rates when 2024 was asked is a
  legal accuracy failure. Version-confusion is the primary risk in Lovsen (README §Risiko).

In fixture mode (LOVSEN_MCP_FIXTURE=1): delegates to fixtures.fixture_fetch_riksavtalen().
In live mode: fetches from nhoreiseliv.no, parses HTML, builds Citation.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from ..nho_reiseliv_client import FIXTURE_MODE, SUPPORTED_VERSIONS
from ..citation import make_citation, now_utc_iso

logger = logging.getLogger("lovsen.nho_reiseliv.fetch_riksavtalen")

_SOURCE_BASE = "https://www.nhoreiseliv.no/overenskomster/riksavtalen"


def fetch_riksavtalen(
    version: str,
    paragraph: Optional[str] = None,
) -> dict[str, Any]:
    """
    Fetch a Riksavtalen paragraph for the given version.

    Returns Citation dict (ADR-0242). If paragraph is None, returns metadata.

    Args:
        version: Riksavtalen agreement year — "2024" or "2025". REQUIRED.
        paragraph: Optional paragraph reference (e.g. "§6.1", "§5").

    Raises:
        ValueError: Unsupported version; paragraph not found in fixture.
    """
    if version not in SUPPORTED_VERSIONS:
        raise ValueError(
            f"Unsupported Riksavtalen version: {version!r}. "
            f"Supported versions: {sorted(SUPPORTED_VERSIONS)}. "
            "Specify an explicit version — no silent fallback."
        )

    if FIXTURE_MODE:
        from ..fixtures import fixture_fetch_riksavtalen
        result = fixture_fetch_riksavtalen(version=version, paragraph=paragraph)
        logger.info(
            "fetch_riksavtalen [fixture] version=%r paragraph=%r → ok",
            version, paragraph,
        )
        return result

    # Live mode
    return _live_fetch(version, paragraph)


def _live_fetch(version: str, paragraph: Optional[str]) -> dict[str, Any]:
    """
    Fetch live Riksavtalen content from nhoreiseliv.no.

    Phase 7 (live fetch) — for now returns a structured placeholder indicating
    live mode is not yet implemented. The network guard in fetch_url prevents
    any actual HTTP in CI / test environments.
    """
    from ..nho_reiseliv_client import fetch_riksavtalen_page
    from ..parsers.riksavtalen import extract_paragraph_text

    source_url = f"{_SOURCE_BASE}/{version}"
    html = fetch_riksavtalen_page(version, paragraph)

    if paragraph:
        text = extract_paragraph_text(html, paragraph)
        if text is None:
            raise ValueError(
                f"Paragraph {paragraph!r} not found in Riksavtalen {version}. "
                f"Check the source: {source_url}"
            )
        citation = make_citation(
            lov="riksavtalen",
            paragraph=paragraph,
            verbatim_text=text,
            source_url=source_url,
            fetched_at=now_utc_iso(),
            law_version=version,
        )
        return citation.model_dump()

    # Metadata-only
    return {
        "lov": "riksavtalen",
        "paragraph": f"riksavtalen/{version}/metadata",
        "verbatim_text": f"Riksavtalen {version} — NHO Reiseliv / LO tariffavtale.",
        "source_url": source_url,
        "law_version": version,
        "metadata_only": True,
    }
