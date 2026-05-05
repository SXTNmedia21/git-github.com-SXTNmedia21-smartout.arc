"""
test_citation_shape.py — Validate all tool outputs against ADR-0242 Citation Pydantic model.

Tests:
1. All 3 fixture JSON files conform to Citation schema
2. fetch_guidance output validates against Citation for all 3 topics
3. lookup_food_safety_requirement output validates against Citation for all categories
4. search_regulation output items each validate against Citation
5. Hash integrity: Citation.hash == sha256(verbatim_text) for every fixture
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
from pathlib import Path

import pytest

os.environ["LOVSEN_MCP_FIXTURE"] = "1"


def _reload():
    mods = [k for k in sys.modules if "lovsen" in k or "mattilsynet" in k]
    for m in mods:
        del sys.modules[m]


@pytest.fixture(autouse=True)
def fixture_mode_env(monkeypatch):
    monkeypatch.setenv("LOVSEN_MCP_FIXTURE", "1")


_FIXTURES_DIR = Path(__file__).parent.parent / "src" / "fixtures"

_FIXTURE_FILES = [
    _FIXTURES_DIR / "alkohol_servering_aldersgrense.json",
    _FIXTURES_DIR / "allergener_pliktig_merking.json",
    _FIXTURES_DIR / "hygiene_temperatur_kjedge.json",
]


# ── Fixture file validation ───────────────────────────────────────────────────


@pytest.mark.parametrize("fixture_path", _FIXTURE_FILES, ids=lambda p: p.name)
def test_fixture_file_exists(fixture_path: Path):
    """All 3 fixture files must exist on disk."""
    assert fixture_path.exists(), f"Fixture not found: {fixture_path}"


@pytest.mark.parametrize("fixture_path", _FIXTURE_FILES, ids=lambda p: p.name)
def test_fixture_file_parses_as_citation(fixture_path: Path):
    """Each fixture file parses cleanly as an ADR-0242 Citation."""
    _reload()
    from src.citation import Citation

    raw = json.loads(fixture_path.read_text(encoding="utf-8"))
    citation = Citation(**raw)
    assert citation.lov
    assert citation.paragraph
    assert len(citation.hash) == 64
    assert citation.hash == citation.hash.lower()
    assert citation.source_url.startswith("https://")
    assert "mattilsynet.no" in citation.source_url


@pytest.mark.parametrize("fixture_path", _FIXTURE_FILES, ids=lambda p: p.name)
def test_fixture_hash_matches_verbatim(fixture_path: Path):
    """SHA-256 of verbatim_text must equal the stored hash."""
    raw = json.loads(fixture_path.read_text(encoding="utf-8"))
    expected = hashlib.sha256(raw["verbatim_text"].encode("utf-8")).hexdigest()
    assert raw["hash"] == expected, (
        f"Hash mismatch in {fixture_path.name}: "
        f"expected {expected[:16]}… stored {raw['hash'][:16]}…"
    )


# ── Tool output validation ────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "topic",
    ["alkohol-aldersgrense", "allergener-merking", "hygiene-temperatur"],
)
def test_fetch_guidance_output_validates_as_citation(topic: str):
    """fetch_guidance output is a valid Citation dict for all 3 known topics."""
    _reload()
    from src.tools.fetch_guidance import run_fetch_guidance
    from src.citation import Citation

    result = run_fetch_guidance(topic=topic)
    citation = Citation(**result)
    assert citation.lov
    assert citation.paragraph
    assert len(citation.hash) == 64


@pytest.mark.parametrize(
    "category",
    ["kjolekjede", "allergener", "bevilling", "hygiene", "aldersgrense-alkohol", "merking"],
)
def test_lookup_requirement_output_validates_as_citation(category: str):
    """lookup_food_safety_requirement output is a valid Citation for all known categories."""
    _reload()
    from src.tools.lookup_food_safety_requirement import run_lookup_food_safety_requirement
    from src.citation import Citation

    result = run_lookup_food_safety_requirement(category=category)
    citation = Citation(**result)
    assert citation.lov
    # paragraph comes from the fixture's own stored slug (e.g. "alkoholloven §1-5")
    # which may not start with "krav/" — the krav/ prefix is only used in live-mode parsed output
    assert citation.paragraph
    assert len(citation.hash) == 64


def test_search_regulation_all_items_validate_as_citation():
    """Every item returned by search_regulation validates as Citation."""
    _reload()
    from src.tools.search_regulation import run_search_regulation
    from src.citation import Citation

    results = run_search_regulation(query="alkohol")
    assert len(results) > 0
    for item in results:
        citation = Citation(**item)
        assert len(citation.hash) == 64


# ── Citation model self-validation tests ──────────────────────────────────────


def test_citation_model_rejects_wrong_hash():
    """Citation model raises ValidationError when hash doesn't match verbatim_text."""
    _reload()
    from src.citation import Citation
    from pydantic import ValidationError

    with pytest.raises(ValidationError, match="hash mismatch"):
        Citation(
            lov="alkoholloven",
            paragraph="alkoholloven §1-5",
            verbatim_text="Some text here.",
            hash="a" * 64,
            fetched_at="2026-04-29T00:00:00Z",
            source_url="https://www.mattilsynet.no/test",
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
            lov="alkoholloven",
            paragraph="alkoholloven §1-5",
            verbatim_text=text,
            hash=h,
            fetched_at="not-a-date",
            source_url="https://www.mattilsynet.no/test",
        )


def test_citation_model_accepts_valid_citation():
    """Citation model accepts a correctly formed Citation without raising."""
    _reload()
    from src.citation import Citation, compute_hash

    text = "Gyldig tekst om mattrygghet og hygiene."
    h = compute_hash(text)

    citation = Citation(
        lov="hygieneforskriften",
        paragraph="krav/hygiene",
        verbatim_text=text,
        hash=h,
        fetched_at="2026-04-29T12:00:00Z",
        source_url="https://www.mattilsynet.no/mat_og_vann/produksjon_av_mat/hygiene/",
    )
    assert citation.lov == "hygieneforskriften"
    assert citation.hash == h
