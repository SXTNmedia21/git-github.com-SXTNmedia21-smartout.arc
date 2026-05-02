"""
test_citation_shape.py — Validate all tool outputs against ADR-0242 Citation Pydantic model.

Tests:
1. All 3 fixture JSON files conform to Citation schema
2. fetch_paragraph output validates against Citation
3. search_law output items validate against Citation
4. get_law_metadata returns expected keys (NOT Citation — metadata dict)
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


def _reload_client():
    mods = [k for k in sys.modules if "lovsen" in k or "lovdata" in k]
    for m in mods:
        del sys.modules[m]


@pytest.fixture(autouse=True)
def fixture_mode_env(monkeypatch):
    monkeypatch.setenv("LOVSEN_MCP_FIXTURE", "1")


_FIXTURES_DIR = Path(__file__).parent.parent / "src" / "fixtures"

_FIXTURE_FILES = [
    _FIXTURES_DIR / "aml_14_6.json",
    _FIXTURES_DIR / "aml_15_3.json",
    _FIXTURES_DIR / "aml_15_6.json",
]


# ── Fixture file validation ───────────────────────────────────────────────────


@pytest.mark.parametrize("fixture_path", _FIXTURE_FILES, ids=lambda p: p.name)
def test_fixture_file_exists(fixture_path: Path):
    """All 3 fixture files must exist on disk."""
    assert fixture_path.exists(), f"Fixture not found: {fixture_path}"


@pytest.mark.parametrize("fixture_path", _FIXTURE_FILES, ids=lambda p: p.name)
def test_fixture_file_parses_as_citation(fixture_path: Path):
    """Each fixture file parses cleanly as an ADR-0242 Citation."""
    _reload_client()
    from src.citation import Citation

    raw = json.loads(fixture_path.read_text(encoding="utf-8"))
    # Citation model_validator checks hash == sha256(verbatim_text)
    citation = Citation(**raw)
    assert citation.lov == "aml"
    assert citation.paragraph.startswith("§")
    assert len(citation.hash) == 64
    assert citation.hash == citation.hash.lower()
    assert citation.source_url.startswith("https://")


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


@pytest.mark.asyncio
async def test_fetch_paragraph_output_validates_as_citation():
    """fetch_paragraph output is a valid Citation dict."""
    _reload_client()
    from src.tools.fetch_paragraph import fetch_paragraph
    from src.citation import Citation

    result = await fetch_paragraph(lov="aml", paragraph="14-6")
    citation = Citation(**result)
    assert citation.lov == "aml"
    assert citation.paragraph == "§14-6"


@pytest.mark.asyncio
async def test_search_law_all_items_validate_as_citation():
    """Every item returned by search_law validates as Citation."""
    _reload_client()
    from src.tools.search_law import search_law
    from src.citation import Citation

    results = await search_law(query="PLACEHOLDER", lov="aml")

    assert len(results) > 0
    for item in results:
        citation = Citation(**item)
        assert len(citation.hash) == 64


@pytest.mark.asyncio
async def test_get_law_metadata_is_not_citation_but_has_required_keys():
    """get_law_metadata returns a metadata dict, not a Citation."""
    _reload_client()
    from src.tools.get_law_metadata import get_law_metadata
    from src.citation import Citation
    from pydantic import ValidationError

    result = await get_law_metadata(lov="aml")

    # Must have metadata keys
    assert "name" in result
    assert "source_url" in result
    assert "total_paragraphs" in result

    # Must NOT validate as a Citation (different shape)
    with pytest.raises((ValidationError, KeyError)):
        Citation(**result)


@pytest.mark.asyncio
async def test_citation_model_rejects_wrong_hash():
    """Citation model raises ValidationError when hash doesn't match verbatim_text."""
    _reload_client()
    from src.citation import Citation
    from pydantic import ValidationError

    with pytest.raises(ValidationError, match="hash mismatch"):
        Citation(
            lov="aml",
            paragraph="§14-6",
            verbatim_text="Some text here.",
            hash="a" * 64,  # wrong hash
            fetched_at="2026-04-29T00:00:00Z",
            source_url="https://lovdata.no/test",
        )


@pytest.mark.asyncio
async def test_citation_model_rejects_bad_fetched_at():
    """Citation model raises ValidationError for non-ISO-8601 fetched_at."""
    import hashlib as _hl
    _reload_client()
    from src.citation import Citation, compute_hash
    from pydantic import ValidationError

    text = "Test paragraph text."
    h = compute_hash(text)

    with pytest.raises(ValidationError, match="fetched_at"):
        Citation(
            lov="aml",
            paragraph="§14-6",
            verbatim_text=text,
            hash=h,
            fetched_at="not-a-date",
            source_url="https://lovdata.no/test",
        )
