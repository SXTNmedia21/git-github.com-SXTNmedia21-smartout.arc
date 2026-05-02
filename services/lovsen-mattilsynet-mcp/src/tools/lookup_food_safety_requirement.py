"""
lookup_food_safety_requirement.py — MCP tool: fetch a specific food-safety requirement.

Returns an ADR-0242-compliant Citation dict.
In LOVSEN_MCP_FIXTURE=1 mode: reads from src/fixtures/ — zero network calls.
In live mode: fetches from Mattilsynet.no (rate-limited via client).

Category slugs map to both fixtures (offline) and live URLs (online).

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

# Known requirement categories → fixture file + live URL
_CATEGORY_MAP: dict[str, dict[str, str]] = {
    "aldersgrense-alkohol": {
        "fixture": "alkohol_servering_aldersgrense.json",
        "url": "https://www.mattilsynet.no/mat_og_vann/alkohol/",
        "lov": "alkoholloven",
        "paragraph": "krav/aldersgrense-alkohol",
    },
    "bevilling": {
        "fixture": "alkohol_servering_aldersgrense.json",
        "url": "https://www.mattilsynet.no/mat_og_vann/alkohol/",
        "lov": "alkoholloven",
        "paragraph": "krav/bevilling",
    },
    "allergener": {
        "fixture": "allergener_pliktig_merking.json",
        "url": "https://www.mattilsynet.no/mat_og_vann/merking_av_mat/allergener/",
        "lov": "matinformasjonsforskriften",
        "paragraph": "krav/allergener",
    },
    "merking": {
        "fixture": "allergener_pliktig_merking.json",
        "url": "https://www.mattilsynet.no/mat_og_vann/merking_av_mat/allergener/",
        "lov": "matinformasjonsforskriften",
        "paragraph": "krav/merking",
    },
    "kjolekjede": {
        "fixture": "hygiene_temperatur_kjedge.json",
        "url": "https://www.mattilsynet.no/mat_og_vann/produksjon_av_mat/hygiene/",
        "lov": "hygieneforskriften",
        "paragraph": "krav/kjolekjede",
    },
    "hygiene": {
        "fixture": "hygiene_temperatur_kjedge.json",
        "url": "https://www.mattilsynet.no/mat_og_vann/produksjon_av_mat/hygiene/",
        "lov": "hygieneforskriften",
        "paragraph": "krav/hygiene",
    },
    # Norwegian spelling variants
    "kjølekjede": {
        "fixture": "hygiene_temperatur_kjedge.json",
        "url": "https://www.mattilsynet.no/mat_og_vann/produksjon_av_mat/hygiene/",
        "lov": "hygieneforskriften",
        "paragraph": "krav/kjolekjede",
    },
}


def run_lookup_food_safety_requirement(category: str) -> dict[str, Any]:
    """
    Fetch a specific Norwegian food-safety requirement by category slug.

    Parameters
    ----------
    category: Requirement category, e.g. 'kjolekjede', 'allergener', 'bevilling',
              'hygiene', 'aldersgrense-alkohol', 'merking'

    Returns
    -------
    ADR-0242 Citation dict

    Raises
    ------
    ValueError       — unknown category (lists known values in message)
    FileNotFoundError — fixture missing in fixture mode
    RuntimeError     — network call attempted in fixture mode (from client guard)
    """
    category = category.strip().lower()
    if not category:
        raise ValueError("category must not be empty")

    mapping = _CATEGORY_MAP.get(category)
    if mapping is None:
        known = sorted(set(_CATEGORY_MAP.keys()))
        raise ValueError(
            f"Unknown category {category!r}. Known values: {known}. "
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
                f"Required for category {category!r} in LOVSEN_MCP_FIXTURE=1 mode."
            )
        try:
            raw = json.loads(fixture_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise ValueError(f"malformed JSON in fixture {mapping['fixture']}: {exc}") from exc

        raw = dict(raw)
        raw["fetched_at"] = now_utc_iso()
        citation = Citation(**raw)
        logger.info(f"lookup_food_safety_requirement(fixture): category={category!r} → {mapping['fixture']}")
        return citation.model_dump()

    # Live mode
    url = mapping["url"]
    logger.info(f"lookup_food_safety_requirement(live): fetching {url}")
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
