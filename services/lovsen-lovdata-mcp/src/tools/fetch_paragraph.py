"""
fetch_paragraph.py — MCP tool: fetch a specific paragraph from Lovdata.no.

Returns ADR-0242-compliant Citation JSON.
In LOVSEN_MCP_FIXTURE=1 mode reads from src/fixtures/ — zero network calls.
In live mode: rate-limited via lovdata_client (1 req/sec, ADR-0244).
"""

from __future__ import annotations

import os
from typing import Any

from ..citation import Citation, compute_hash, now_utc_iso
from ..lovdata_client import (
    FIXTURE_MODE,
    load_fixture,
    fetch_law_html,
)
from ..parsers.paragraph import parse_paragraph_html


def _lov_url(lov: str, paragraph: str) -> str:
    _LOV_PATHS: dict[str, str] = {
        "aml": "lov/2005-06-17-62",
        "ferielov": "lov/1988-04-29-21",
        "otp-loven": "lov/2005-12-21-124",
        "ftrl": "lov/1997-02-28-19",
    }
    path = _LOV_PATHS.get(lov.lower(), lov.lower())
    return f"https://lovdata.no/dokument/NL/{path}/§{paragraph}"


async def fetch_paragraph(lov: str, paragraph: str, ledd: str | None = None) -> dict[str, Any]:
    """
    Fetch a specific paragraph from Lovdata.no.

    Parameters
    ----------
    lov:       Law abbreviation, e.g. "aml" (Arbeidsmiljøloven)
    paragraph: Paragraph reference, e.g. "14-6"
    ledd:      Optional sub-section, e.g. "1"

    Returns
    -------
    ADR-0242 Citation dict

    Raises
    ------
    ValueError   — paragraph not found in fixture or HTML
    FileNotFoundError — fixture missing in fixture mode
    """
    # Validate inputs eagerly
    lov = lov.strip()
    paragraph = paragraph.strip().lstrip("§")
    if not lov:
        raise ValueError("lov must not be empty")
    if not paragraph:
        raise ValueError("paragraph must not be empty")

    source_url = _lov_url(lov, paragraph)

    if FIXTURE_MODE:
        data = load_fixture(lov, paragraph)
        # Re-validate hash on load to catch fixture corruption early
        verbatim = data.get("verbatim_text", "")
        expected_hash = compute_hash(verbatim)
        if data.get("hash") != expected_hash:
            raise ValueError(
                f"fixture corruption detected: hash mismatch for {lov} §{paragraph}. "
                f"expected={expected_hash[:16]}… got={data.get('hash', '')[:16]}…"
            )
        # Update fetched_at to now (fixtures store a static timestamp; freshen on read)
        data = dict(data)
        data["fetched_at"] = now_utc_iso()
        # Validate full Citation shape
        citation = Citation(**data)
        return citation.model_dump()

    # Live mode — fetch from Lovdata
    html = await fetch_law_html(lov, paragraph)
    citation_dict = parse_paragraph_html(
        html=html,
        lov=lov,
        paragraph=paragraph,
        ledd=ledd,
        source_url=source_url,
    )
    # Validate shape before returning
    citation = Citation(**citation_dict)
    return citation.model_dump()
