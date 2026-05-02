"""
fixtures/__init__.py — Fixture loader for lovsen-nho-reiseliv-mcp.

In LOVSEN_MCP_FIXTURE=1 mode all tool calls resolve to pre-seeded JSON fixtures.
No network access. Used for CI, offline development, and test isolation.

Fixture naming convention:
  riksavtalen_{version}_{category}.json
  e.g. riksavtalen_2024_kveldstillegg.json

Supported fixture keys (version × category combos):
  ("2024", "kveldstillegg") → riksavtalen_2024_kveldstillegg.json
  ("2024", "garantilonn")   → riksavtalen_2024_garantilonn.json
  ("2025", "kveldstillegg") → riksavtalen_2025_kveldstillegg.json
  ("2025", "garantilonn")   → riksavtalen_2025_garantilonn.json

Design: fail fast on missing/corrupt fixtures. Never silently fall back to a
different version — that would reproduce the version-confusion bug (ADR-0244).
"""

from __future__ import annotations

import hashlib
import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger("lovsen.nho_reiseliv.fixtures")

_FIXTURES_DIR = Path(__file__).parent

# Canonical fixture file map: (version, category) → Path
_FIXTURE_FILES: dict[tuple[str, str], Path] = {
    ("2024", "kveldstillegg"): _FIXTURES_DIR / "riksavtalen_2024_kveldstillegg.json",
    ("2024", "garantilonn"): _FIXTURES_DIR / "riksavtalen_2024_garantilonn.json",
    ("2025", "kveldstillegg"): _FIXTURES_DIR / "riksavtalen_2025_kveldstillegg.json",
    ("2025", "garantilonn"): _FIXTURES_DIR / "riksavtalen_2025_garantilonn.json",
}

# Category aliases — normalise input before lookup
_CATEGORY_ALIASES: dict[str, str] = {
    "kveldstillegg": "kveldstillegg",
    "garantilonn": "garantilonn",
    "garantilønn": "garantilonn",
}

# Paragraph → category mapping for fetch_riksavtalen paragraph routing
_PARAGRAPH_TO_CATEGORY: dict[str, str] = {
    "§6.1": "kveldstillegg",
    "§6": "kveldstillegg",
    "§5": "garantilonn",
}

_SUPPORTED_VERSIONS = {"2024", "2025"}
_SUPPORTED_CATEGORIES = set(_CATEGORY_ALIASES.values())


def _validate_fixture_hash(data: dict[str, Any], path: Path) -> None:
    """
    Raise ValueError if stored hash doesn't match SHA-256 of verbatim_text.

    Catches fixture corruption (e.g. verbatim_text edited but hash not updated).
    """
    expected = hashlib.sha256(data["verbatim_text"].encode("utf-8")).hexdigest()
    if data["hash"] != expected:
        raise ValueError(
            f"Fixture corruption in {path}: "
            f"hash mismatch: expected {expected[:12]}…, stored {data['hash'][:12]}…"
        )


def _load_fixture(version: str, category: str) -> dict[str, Any]:
    """
    Load and validate a fixture by version + category.

    Raises:
        ValueError: Unsupported version or category.
        FileNotFoundError: Fixture file missing from disk.
        ValueError: Malformed JSON or hash corruption.
    """
    if version not in _SUPPORTED_VERSIONS:
        raise ValueError(
            f"Unsupported Riksavtalen version: {version!r}. "
            f"Supported: {sorted(_SUPPORTED_VERSIONS)}"
        )

    canonical_cat = _CATEGORY_ALIASES.get(category)
    if canonical_cat is None:
        raise ValueError(
            f"Unknown fixture category: {category!r}. "
            f"Supported: {sorted(_SUPPORTED_CATEGORIES)}"
        )

    key = (version, canonical_cat)
    path = _FIXTURE_FILES.get(key)
    if path is None or not path.exists():
        available = [
            f"{v}/{c}" for (v, c) in _FIXTURE_FILES if _FIXTURE_FILES[(v, c)].exists()
        ]
        raise FileNotFoundError(
            f"Fixture file missing for version={version!r} category={canonical_cat!r}. "
            f"Path: {path}. Available: {available}"
        )

    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Malformed fixture JSON at {path}: {exc}") from exc

    _validate_fixture_hash(raw, path)
    return raw


def fixture_fetch_riksavtalen(version: str, paragraph: str | None = None) -> dict[str, Any]:
    """
    Return fixture Citation dict for fetch_riksavtalen tool.

    If paragraph is None, returns metadata-only dict (no verbatim text).
    Paragraph routes to the matching fixture via _PARAGRAPH_TO_CATEGORY.

    Never falls back to a different version.
    """
    if paragraph is None:
        # Metadata-only response (Phase 1 stub)
        if version not in _SUPPORTED_VERSIONS:
            raise ValueError(
                f"Unsupported Riksavtalen version: {version!r}. "
                f"Supported: {sorted(_SUPPORTED_VERSIONS)}"
            )
        return {
            "lov": "riksavtalen",
            "paragraph": f"riksavtalen/{version}/metadata",
            "verbatim_text": f"Riksavtalen {version} — NHO Reiseliv / LO tariffavtale for serveringsbransjen.",
            "source_url": f"https://www.nhoreiseliv.no/overenskomster/riksavtalen/{version}",
            "law_version": version,
            "metadata_only": True,
        }

    category = _PARAGRAPH_TO_CATEGORY.get(paragraph)
    if category is None:
        # Try prefix match: "§6" matches "§6.1"
        for para_key, cat in _PARAGRAPH_TO_CATEGORY.items():
            if paragraph.startswith(para_key) or para_key.startswith(paragraph):
                category = cat
                break

    if category is None:
        available_paragraphs = list(_PARAGRAPH_TO_CATEGORY.keys())
        raise ValueError(
            f"No fixture for paragraph {paragraph!r} version {version!r}. "
            f"Known paragraphs: {available_paragraphs}"
        )

    return _load_fixture(version, category)


def fixture_lookup_tariff_supplement(category: str, version: str) -> dict[str, Any]:
    """
    Return fixture Citation dict for lookup_tariff_supplement tool.

    Raises ValueError for unsupported version or category.
    """
    return _load_fixture(version, category)
