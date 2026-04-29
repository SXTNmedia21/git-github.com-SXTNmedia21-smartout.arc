"""
fetch_guidance.py — MCP tool: fetch a published Mattilsynet guidance document.

Returns an ADR-0242-compliant Citation dict.
In LOVSEN_MCP_FIXTURE=1 mode: reads from src/fixtures/ — zero network calls.
In live mode: fetches from Mattilsynet.no (rate-limited via client).

Topic slugs map to both fixtures (offline) and live URLs (online).

Reference: docs/decisions/0242-lovsen-citation-contract.md
           docs/decisions/0244-lovsen-mcp-boundary.md
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_FIXTURES_DIR = Path(__file__).parent.parent / "fixtures"

# Known topic slugs → fixture file + live URL
_TOPIC_MAP: dict[str, dict[str, str]] = {
    "alkohol-aldersgrense": {
        "fixture": "alkohol_servering_aldersgrense.json",
        "url": "https://www.mattilsynet.no/mat_og_vann/alkohol/",
        "lov": "alkoholloven",
        "paragraph": "guidance/alkohol-aldersgrense",
    },
    "allergener-merking": {
        "fixture": "allergener_pliktig_merking.json",
        "url": "https://www.mattilsynet.no/mat_og_vann/merking_av_mat/allergener/",
        "lov": "matinformasjonsforskriften",
        "paragraph": "guidance/allergener-merking",
    },
    "hygiene-temperatur": {
        "fixture": "hygiene_temperatur_kjedge.json",
        "url": "https://www.mattilsynet.no/mat_og_vann/produksjon_av_mat/hygiene/",
        "lov": "hygieneforskriften",
        "paragraph": "guidance/hygiene-temperatur",
    },
    # Aliases — map to the same fixtures
    "alkohol": {
        "fixture": "alkohol_servering_aldersgrense.json",
        "url": "https://www.mattilsynet.no/mat_og_vann/alkohol/",
        "lov": "alkoholloven",
        "paragraph": "guidance/alkohol-aldersgrense",
    },
    "allergener": {
        "fixture": "allergener_pliktig_merking.json",
        "url": "https://www.mattilsynet.no/mat_og_vann/merking_av_mat/allergener/",
        "lov": "matinformasjonsforskriften",
        "paragraph": "guidance/allergener-merking",
    },
    "hygiene": {
        "fixture": "hygiene_temperatur_kjedge.json",
        "url": "https://www.mattilsynet.no/mat_og_vann/produksjon_av_mat/hygiene/",
        "lov": "hygieneforskriften",
        "paragraph": "guidance/hygiene-temperatur",
    },
}


def run_fetch_guidance(topic: str) -> dict[str, Any]:
    """
    Fetch a published Mattilsynet guidance document by topic slug.

    Parameters
    ----------
    topic: Topic slug, e.g. 'alkohol-aldersgrense', 'allergener-merking', 'hygiene-temperatur'

    Returns
    -------
    ADR-0242 Citation dict

    Raises
    ------
    ValueError       — unknown topic slug (lists known slugs in message)
    FileNotFoundError — fixture missing in fixture mode
    RuntimeError     — network call attempted in fixture mode (from client guard)
    """
    topic = topic.strip().lower()
    if not topic:
        raise ValueError("topic must not be empty")

    mapping = _TOPIC_MAP.get(topic)
    if mapping is None:
        known = sorted(set(_TOPIC_MAP.keys()))
        raise ValueError(
            f"Unknown topic {topic!r}. Known slugs: {known}. "
            "Add a fixture file to extend the corpus."
        )

    from ..mattilsynet_client import FIXTURE_MODE, fetch_url
    from ..citation import Citation, now_utc_iso
    from ..parsers.regulation import parse_mattilsynet_page

    if FIXTURE_MODE:
        fixture_path = _FIXTURES_DIR / mapping["fixture"]
        if not fixture_path.exists():
            raise FileNotFoundError(
                f"fixture not found: {fixture_path}. "
                f"Required for topic {topic!r} in LOVSEN_MCP_FIXTURE=1 mode."
            )
        try:
            raw = json.loads(fixture_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise ValueError(f"malformed JSON in fixture {mapping['fixture']}: {exc}") from exc

        raw = dict(raw)
        raw["fetched_at"] = now_utc_iso()
        citation = Citation(**raw)
        logger.info(f"fetch_guidance(fixture): topic={topic!r} → {mapping['fixture']}")
        return citation.model_dump()

    # Live mode
    url = mapping["url"]
    logger.info(f"fetch_guidance(live): fetching {url}")
    html = fetch_url(url)
    fetched_at = now_utc_iso()
    parsed = parse_mattilsynet_page(
        html=html,
        lov=mapping["lov"],
        paragraph=mapping["paragraph"],
        source_url=url,
        fetched_at=fetched_at,
    )
    citation = Citation(**parsed)
    return citation.model_dump()
