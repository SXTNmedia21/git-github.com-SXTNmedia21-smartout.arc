"""
get_law_metadata.py — MCP tool: fetch metadata for a Norwegian law from Lovdata.no.

Returns: { name, version, last_updated, total_paragraphs, source_url }
NOT a Citation — metadata only (per plan contract).
In LOVSEN_FIXTURE_MODE=true mode: derived from available fixtures — zero HTTP.
In live mode: rate-limited via lovdata_client (1 req/sec, ADR-0244).
"""

from __future__ import annotations

from typing import Any

from ..lovdata_client import (
    FIXTURE_MODE,
    list_fixtures,
    fetch_law_index_html,
)
from ..parsers.paragraph import parse_law_metadata


_LOV_NAMES: dict[str, str] = {
    "aml": "Arbeidsmiljøloven (lov 2005-06-17 nr. 62)",
    "ferielov": "Ferieloven (lov 1988-04-29 nr. 21)",
    "otp-loven": "OTP-loven (lov 2005-12-21 nr. 124)",
    "ftrl": "Folketrygdloven (lov 1997-02-28 nr. 19)",
}

_LOV_PATHS: dict[str, str] = {
    "aml": "lov/2005-06-17-62",
    "ferielov": "lov/1988-04-29-21",
    "otp-loven": "lov/2005-12-21-124",
    "ftrl": "lov/1997-02-28-19",
}


def _fixture_metadata(lov: str) -> dict[str, Any]:
    """Derive metadata from fixture files — used in fixture mode."""
    lov_key = lov.lower().strip()
    fixtures = list_fixtures(lov=lov_key)
    path = _LOV_PATHS.get(lov_key, lov_key)
    return {
        "name": _LOV_NAMES.get(lov_key, lov_key.upper()),
        "version": None,  # Not available in fixture mode
        "last_updated": None,  # Not available in fixture mode
        "total_paragraphs": len(fixtures),
        "source_url": f"https://lovdata.no/dokument/NL/{path}/",
    }


async def get_law_metadata(lov: str) -> dict[str, Any]:
    """
    Fetch metadata for a Norwegian law.

    Parameters
    ----------
    lov: Law abbreviation, e.g. "aml"

    Returns
    -------
    Dict with: name, version, last_updated, total_paragraphs, source_url
    """
    lov = lov.strip()
    if not lov:
        raise ValueError("lov must not be empty")

    if FIXTURE_MODE:
        return _fixture_metadata(lov)

    # Live mode
    html = await fetch_law_index_html(lov)
    return parse_law_metadata(html=html, lov=lov)
