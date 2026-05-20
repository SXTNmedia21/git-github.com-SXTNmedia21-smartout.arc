"""
fetch_riksavtalen_paragraph.py — MCP tool: fetch a specific paragraph from Riksavtalen
(NHO Reiseliv tariff agreement) via Lovdata.no TARO namespace.

ADR-0347: Riksavtalen citations MUST come from Lovdata TARO namespace, NOT NHO Reiseliv
website, so that version-pinning and hash verification are anchored to the authoritative
legal source. A new tool is required because:
  - fetch_paragraph() signature has no version param
  - _LOV_PATHS hardcodes NL/lov URLs only — TARO lives at /dokument/TARO/tariff/{taro_id}/
  - Overloading would silently bypass the version-required guard (ADR-0258)

Returns ADR-0256 Citation envelope.
In LOVSEN_FIXTURE_MODE=true reads from src/fixtures/ — zero network calls (ADR-0258 canonical).
Legacy LOVSEN_MCP_FIXTURE=1 is also honoured during cutover.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Optional

from ..citation import Citation, compute_hash, now_utc_iso
from ..lovdata_client import FIXTURE_MODE

logger = logging.getLogger(__name__)

# Supported TARO IDs — extend when new Riksavtalen TARO IDs are published.
_SUPPORTED_TARO_IDS: frozenset[str] = frozenset({"taro-79", "taro-226"})

# Base URL confirmed reachable via B1 live-curl proof (2026-05-17).
_TARO_BASE = "https://lovdata.no/dokument/TARO/tariff"

_FIXTURES_DIR = Path(__file__).parent.parent / "fixtures"


# ── Fixture helpers ────────────────────────────────────────────────────────────


def _fixture_filename(taro_id: str, version: str, paragraph_slug: str) -> str:
    """
    Derive fixture filename from taro_id, version, and paragraph slug.
    e.g. taro-79, "2024-2026", "4-3" → "riksavtalen_taro-79_2024-2026_4-3.json"
    """
    safe_version = version.replace("/", "-")
    return f"riksavtalen_{taro_id}_{safe_version}_{paragraph_slug}.json"


def _load_riksavtalen_fixture(taro_id: str, version: str, paragraph_slug: str) -> dict[str, Any]:
    """Load a Riksavtalen fixture. Raises FileNotFoundError explicitly (CI safety)."""
    filename = _fixture_filename(taro_id, version, paragraph_slug)
    path = _FIXTURES_DIR / filename
    if not path.exists():
        raise FileNotFoundError(
            f"Riksavtalen fixture not found at {path} — "
            f"unset LOVSEN_FIXTURE_MODE to use live Lovdata, "
            f"or add the fixture file for taro_id={taro_id!r}, version={version!r}, "
            f"paragraph={paragraph_slug!r}"
        )
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Riksavtalen fixture {path} has malformed JSON: {exc}") from exc


# ── Paragraph normalization ────────────────────────────────────────────────────


def _normalize_paragraph(raw: str) -> tuple[str, str, Optional[str]]:
    """
    Normalize paragraph input to canonical form.

    Accepts:
      - "§4-3"      → canonical "§4-3", slug "4-3", ledd None
      - "4-3"       → canonical "§4-3", slug "4-3", ledd None
      - "§4-3.1"    → canonical "§4-3", slug "4-3", ledd "1"
      - "4-3.1"     → canonical "§4-3", slug "4-3", ledd "1"

    Returns (canonical_form, slug, extracted_ledd)
    """
    stripped = raw.strip().lstrip("§").strip()
    if not stripped:
        raise ValueError("paragraph must not be empty")

    extracted_ledd: Optional[str] = None

    # Handle "X.Y" ledd suffix, e.g. "4-3.1"
    if "." in stripped:
        parts = stripped.split(".", 1)
        stripped = parts[0]
        extracted_ledd = parts[1] if parts[1] else None

    canonical = f"§{stripped}"
    slug = stripped  # used for fixture filename, e.g. "4-3"
    return canonical, slug, extracted_ledd


# ── URL builder ────────────────────────────────────────────────────────────────


def _taro_chapter_url(taro_id: str, paragraph_slug: str) -> str:
    """
    Build the Lovdata TARO chapter URL for a paragraph.

    B1 live-proof showed:
      - %C2%A7-form returns 302 redirect
      - /KAPITTEL_N form returns 200 with full chapter content

    Strategy: fetch the chapter containing the paragraph, then extract via BeautifulSoup.
    Chapter = first numeric component of paragraph slug, e.g. "4-3" → chapter 4.
    """
    chapter = paragraph_slug.split("-")[0] if "-" in paragraph_slug else paragraph_slug
    return f"{_TARO_BASE}/{taro_id}/KAPITTEL_{chapter}"


# ── Main tool function ─────────────────────────────────────────────────────────


def fetch_riksavtalen_paragraph(
    taro_id: str,
    paragraph: str,
    version: str,
    ledd: Optional[str] = None,
) -> dict[str, Any]:
    """
    Fetch a specific paragraph from Riksavtalen (NHO Reiseliv) via Lovdata TARO namespace.

    Parameters
    ----------
    taro_id:   TARO identifier, e.g. "taro-79" or "taro-226". Required.
    paragraph: Paragraph reference, e.g. "§4-3", "4-3", or "4-3.1" (auto-normalized). Required.
    version:   Agreement version string, e.g. "2024-2026". REQUIRED — no silent fallback
               per ADR-0258 (version confusion is a legal accuracy failure).
    ledd:      Optional sub-paragraph, e.g. "1" for first ledd. If paragraph uses "X.Y"
               notation, ledd is extracted automatically and this arg is ignored.

    Returns
    -------
    ADR-0256 Citation dict with verbatim_text, hash, fetched_at, source_url, paragraph,
    law_version, and law fields.

    Raises
    ------
    ValueError        — unsupported taro_id; empty version; paragraph not found in HTML
    FileNotFoundError — fixture missing in fixture mode
    """
    # ── Input validation ───────────────────────────────────────────────────────

    taro_id = taro_id.strip().lower()
    if taro_id not in _SUPPORTED_TARO_IDS:
        raise ValueError(
            f"Unsupported taro_id: {taro_id!r}. "
            f"Supported values: {sorted(_SUPPORTED_TARO_IDS)}. "
            "Check Lovdata for the correct TARO identifier."
        )

    version = version.strip()
    if not version:
        raise ValueError(
            "version must not be empty — no silent fallback per ADR-0258. "
            "Tariff rates change between agreement periods; specify an explicit version "
            "such as '2024-2026'."
        )

    canonical_paragraph, slug, extracted_ledd = _normalize_paragraph(paragraph)

    # Prefer explicitly-provided ledd; fall back to ledd extracted from "X.Y" notation
    effective_ledd = ledd if ledd is not None else extracted_ledd

    source_url = _taro_chapter_url(taro_id, slug)

    # ── Fixture mode ───────────────────────────────────────────────────────────

    if FIXTURE_MODE:
        data = _load_riksavtalen_fixture(taro_id, version, slug)

        # Re-validate hash on load to catch fixture corruption early
        verbatim = data.get("verbatim_text", "")
        expected_hash = compute_hash(verbatim)
        if data.get("hash") != expected_hash:
            raise ValueError(
                f"fixture corruption: hash mismatch for riksavtalen {taro_id} {version} §{slug}. "
                f"expected={expected_hash[:16]}… got={data.get('hash', '')[:16]}…"
            )

        # Build Citation — freshen fetched_at, set canonical paragraph + version
        citation_data = dict(data)
        citation_data["fetched_at"] = now_utc_iso()
        citation_data["paragraph"] = canonical_paragraph
        citation_data["law_version"] = version
        citation_data["law"] = f"riksavtalen-{taro_id}"

        # Validate full Citation shape via Pydantic model
        citation = Citation(**citation_data)
        result = citation.model_dump()
        # law field is not part of Citation model — add after validation
        result["law"] = f"riksavtalen-{taro_id}"
        return result

    # ── Live mode ──────────────────────────────────────────────────────────────

    return _live_fetch(taro_id, slug, canonical_paragraph, version, effective_ledd, source_url)


def _live_fetch(
    taro_id: str,
    slug: str,
    canonical_paragraph: str,
    version: str,
    ledd: Optional[str],
    source_url: str,
) -> dict[str, Any]:
    """
    Fetch live Riksavtalen content from Lovdata TARO.

    Strategy: fetch the KAPITTEL_N page (confirmed 200 via B1 live-curl), then
    extract the paragraph text using BeautifulSoup — same approach as parse_paragraph_html.
    """
    import asyncio
    from ..lovdata_client import http_get
    from ..parsers.paragraph import _extract_paragraph_text, _clean_text
    from bs4 import BeautifulSoup

    async def _fetch() -> str:
        response = await http_get(source_url)
        return response.text

    html = asyncio.run(_fetch())
    soup = BeautifulSoup(html, "html.parser")
    # Strip leading § from slug for the extractor (it adds § internally)
    verbatim = _extract_paragraph_text(soup, slug.lstrip("§"), ledd)

    if not verbatim:
        raise ValueError(
            f"Paragraph {canonical_paragraph} not found in Lovdata TARO HTML for "
            f"{taro_id} at {source_url}"
        )

    verbatim_text = _clean_text(verbatim) if hasattr(verbatim, "strip") else verbatim
    h = compute_hash(verbatim_text)

    result = {
        "lov": f"riksavtalen-{taro_id}",
        "paragraph": canonical_paragraph,
        "ledd": ledd,
        "verbatim_text": verbatim_text,
        "hash": h,
        "fetched_at": now_utc_iso(),
        "source_url": source_url,
        "law_version": version,
        "law": f"riksavtalen-{taro_id}",
    }
    citation = Citation(**result)
    validated = citation.model_dump()
    validated["law"] = f"riksavtalen-{taro_id}"
    return validated
