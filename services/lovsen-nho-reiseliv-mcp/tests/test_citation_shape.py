"""
test_citation_shape.py — Validate all fixture + tool outputs against ADR-0242 Citation.

Tests:
  1. All 4 fixture JSON files exist on disk
  2. All 4 fixture files parse cleanly as ADR-0242 Citation
  3. SHA-256 hash integrity: hash == sha256(verbatim_text) for every fixture
  4. fetch_riksavtalen output validates as Citation
  5. lookup_tariff_supplement output validates as Citation
  6. Citation model rejects wrong hash
  7. Citation model rejects non-ISO-8601 fetched_at
  8. 2024 vs 2025 fixtures have DIFFERENT verbatim_text and hash (no copy-paste seeding)
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
from pathlib import Path

import pytest

os.environ["LOVSEN_FIXTURE_MODE"] = "true"


def _reload():
    mods = [k for k in sys.modules if "lovsen" in k or "nho_reiseliv" in k]
    for m in mods:
        del sys.modules[m]


@pytest.fixture(autouse=True)
def fixture_mode_env(monkeypatch):
    monkeypatch.setenv("LOVSEN_FIXTURE_MODE", "true")


_FIXTURES_DIR = Path(__file__).parent.parent / "src" / "fixtures"

_FIXTURE_FILES = [
    _FIXTURES_DIR / "riksavtalen_2024_kveldstillegg.json",
    _FIXTURES_DIR / "riksavtalen_2024_garantilonn.json",
    _FIXTURES_DIR / "riksavtalen_2025_kveldstillegg.json",
    _FIXTURES_DIR / "riksavtalen_2025_garantilonn.json",
]


# ── Fixture file existence ────────────────────────────────────────────────────


@pytest.mark.parametrize("fixture_path", _FIXTURE_FILES, ids=lambda p: p.name)
def test_fixture_file_exists(fixture_path: Path):
    """All 4 fixture files must exist on disk."""
    assert fixture_path.exists(), f"Fixture not found: {fixture_path}"


# ── Fixture file parses as Citation ──────────────────────────────────────────


@pytest.mark.parametrize("fixture_path", _FIXTURE_FILES, ids=lambda p: p.name)
def test_fixture_file_parses_as_citation(fixture_path: Path):
    """Each fixture file parses cleanly as an ADR-0242 Citation."""
    _reload()
    from src.citation import Citation

    raw = json.loads(fixture_path.read_text(encoding="utf-8"))
    citation = Citation(**{k: v for k, v in raw.items() if not k.startswith("_")})

    assert citation.lov == "riksavtalen"
    assert citation.paragraph
    assert len(citation.hash) == 64
    assert citation.hash == citation.hash.lower()
    assert citation.source_url.startswith("https://")
    assert len(citation.verbatim_text) > 50
    assert citation.law_version in ("2024", "2025")


# ── Hash integrity ────────────────────────────────────────────────────────────


@pytest.mark.parametrize("fixture_path", _FIXTURE_FILES, ids=lambda p: p.name)
def test_fixture_hash_matches_verbatim(fixture_path: Path):
    """SHA-256 of verbatim_text must equal the stored hash field."""
    raw = json.loads(fixture_path.read_text(encoding="utf-8"))
    expected = hashlib.sha256(raw["verbatim_text"].encode("utf-8")).hexdigest()
    assert raw["hash"] == expected, (
        f"Hash mismatch in {fixture_path.name}: "
        f"expected {expected[:16]}… stored {raw['hash'][:16]}…"
    )


# ── 2024 vs 2025 differ in verbatim_text + hash ──────────────────────────────


def test_2024_2025_kveldstillegg_differ():
    """2024 and 2025 kveldstillegg fixtures have different verbatim_text and hash."""
    raw_2024 = json.loads((_FIXTURES_DIR / "riksavtalen_2024_kveldstillegg.json").read_text())
    raw_2025 = json.loads((_FIXTURES_DIR / "riksavtalen_2025_kveldstillegg.json").read_text())

    assert raw_2024["verbatim_text"] != raw_2025["verbatim_text"], (
        "2024 and 2025 kveldstillegg have identical verbatim_text — copy-paste seeding detected"
    )
    assert raw_2024["hash"] != raw_2025["hash"], (
        "2024 and 2025 kveldstillegg have identical hash"
    )


def test_2024_2025_garantilonn_differ():
    """2024 and 2025 garantilonn fixtures have different verbatim_text and hash."""
    raw_2024 = json.loads((_FIXTURES_DIR / "riksavtalen_2024_garantilonn.json").read_text())
    raw_2025 = json.loads((_FIXTURES_DIR / "riksavtalen_2025_garantilonn.json").read_text())

    assert raw_2024["verbatim_text"] != raw_2025["verbatim_text"], (
        "2024 and 2025 garantilonn have identical verbatim_text — copy-paste seeding detected"
    )
    assert raw_2024["hash"] != raw_2025["hash"], (
        "2024 and 2025 garantilonn have identical hash"
    )


# ── Tool output validation ────────────────────────────────────────────────────


def test_fetch_riksavtalen_output_validates_as_citation():
    """fetch_riksavtalen output is a valid Citation dict."""
    _reload()
    from src.tools.fetch_riksavtalen import fetch_riksavtalen
    from src.citation import Citation

    result = fetch_riksavtalen(version="2024", paragraph="§6.1")
    citation = Citation(**result)

    assert citation.lov == "riksavtalen"
    assert citation.law_version == "2024"
    assert len(citation.hash) == 64


def test_lookup_tariff_supplement_output_validates_as_citation():
    """lookup_tariff_supplement output is a valid Citation dict."""
    _reload()
    from src.tools.lookup_tariff_supplement import lookup_tariff_supplement
    from src.citation import Citation

    result = lookup_tariff_supplement(category="kveldstillegg", version="2025")
    citation = Citation(**result)

    assert citation.lov == "riksavtalen"
    assert citation.law_version == "2025"
    assert len(citation.hash) == 64


# ── Citation model rejects bad data ──────────────────────────────────────────


def test_citation_model_rejects_wrong_hash():
    """Citation model raises ValidationError when hash doesn't match verbatim_text."""
    _reload()
    from src.citation import Citation
    from pydantic import ValidationError

    with pytest.raises(ValidationError, match="hash mismatch"):
        Citation(
            lov="riksavtalen",
            paragraph="§6.1",
            verbatim_text="Some verbatim text.",
            hash="a" * 64,  # deliberately wrong
            fetched_at="2026-04-29T00:00:00+00:00",
            source_url="https://www.nhoreiseliv.no/overenskomster/riksavtalen/2024",
        )


def test_citation_model_rejects_bad_fetched_at():
    """Citation model raises ValidationError for non-ISO-8601 fetched_at."""
    _reload()
    from src.citation import Citation, compute_hash
    from pydantic import ValidationError

    text = "Test paragraph text."
    h = compute_hash(text)

    with pytest.raises(ValidationError, match="fetched_at"):
        Citation(
            lov="riksavtalen",
            paragraph="§6.1",
            verbatim_text=text,
            hash=h,
            fetched_at="not-a-date",
            source_url="https://www.nhoreiseliv.no/",
        )


def test_citation_model_rejects_short_hash():
    """Citation model raises ValidationError for hash that is not 64 hex chars."""
    _reload()
    from src.citation import Citation
    from pydantic import ValidationError

    with pytest.raises(ValidationError, match="hash must be"):
        Citation(
            lov="riksavtalen",
            paragraph="§6.1",
            verbatim_text="Some text.",
            hash="abc123",  # too short
            fetched_at="2026-04-29T00:00:00+00:00",
            source_url="https://www.nhoreiseliv.no/",
        )
