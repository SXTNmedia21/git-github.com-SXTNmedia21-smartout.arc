"""
test_citation_shape.py — Validate all tool outputs against ADR-0242 Citation Pydantic model.

Tests:
1. All 3 fixture JSON files exist on disk
2. All 3 fixture files parse cleanly as ADR-0242 Citation
3. SHA-256 hash integrity: hash == sha256(verbatim_text) for every fixture
4. search_guidance output items validate as Citation
5. fetch_workplace_assessment_template output validates as Citation
6. Citation model rejects wrong hash
7. Citation model rejects non-ISO-8601 fetched_at
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
    mods = [k for k in sys.modules if "lovsen" in k or "arbeidstilsynet" in k]
    for m in mods:
        del sys.modules[m]


@pytest.fixture(autouse=True)
def fixture_mode_env(monkeypatch):
    monkeypatch.setenv("LOVSEN_MCP_FIXTURE", "1")


_FIXTURES_DIR = Path(__file__).parent.parent / "src" / "fixtures"

_FIXTURE_FILES = [
    _FIXTURES_DIR / "hms_systematisk_arbeid.json",
    _FIXTURES_DIR / "arbeidstid_natt_skift.json",
    _FIXTURES_DIR / "risikovurdering_kjokken_template.json",
]


# ── Fixture file existence ────────────────────────────────────────────────────


@pytest.mark.parametrize("fixture_path", _FIXTURE_FILES, ids=lambda p: p.name)
def test_fixture_file_exists(fixture_path: Path):
    """All 3 fixture files must exist on disk."""
    assert fixture_path.exists(), f"Fixture not found: {fixture_path}"


# ── Fixture file parses as Citation ──────────────────────────────────────────


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
    assert len(citation.verbatim_text) > 50


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


# ── Tool output validation ────────────────────────────────────────────────────


def test_search_guidance_output_validates_as_citation():
    """search_guidance output items are valid Citation dicts."""
    _reload()
    from src.tools.search_guidance import search_guidance
    from src.citation import Citation

    results = search_guidance(query="HMS systematisk", scope="hms")

    assert len(results) > 0
    for item in results:
        citation = Citation(**item)
        assert len(citation.hash) == 64


def test_fetch_template_output_validates_as_citation():
    """fetch_workplace_assessment_template output is a valid Citation dict."""
    _reload()
    from src.tools.fetch_workplace_assessment_template import fetch_workplace_assessment_template
    from src.citation import Citation

    result = fetch_workplace_assessment_template(template_id="risikovurdering-kjokken")
    citation = Citation(**result)

    assert citation.lov == "arbeidstilsynet-risikovurdering"
    assert citation.paragraph == "template/risikovurdering-kjokken"


def test_all_3_scopes_return_citation_compliant_output():
    """Each scope returns Citation-compliant output."""
    _reload()
    from src.tools.search_guidance import search_guidance
    from src.citation import Citation

    for scope in ["hms", "arbeidstid", "risikovurdering"]:
        results = search_guidance(query="test", scope=scope)
        assert len(results) >= 1, f"No results for scope={scope}"
        citation = Citation(**results[0])
        assert len(citation.hash) == 64


# ── Citation model rejects bad data ──────────────────────────────────────────


def test_citation_model_rejects_wrong_hash():
    """Citation model raises ValidationError when hash doesn't match verbatim_text."""
    _reload()
    from src.citation import Citation
    from pydantic import ValidationError

    with pytest.raises(ValidationError, match="hash mismatch"):
        Citation(
            lov="arbeidstilsynet-veiledning",
            paragraph="§5",
            verbatim_text="Some verbatim text.",
            hash="a" * 64,  # deliberately wrong
            fetched_at="2026-04-29T00:00:00+00:00",
            source_url="https://www.arbeidstilsynet.no/tema/",
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
            lov="arbeidstilsynet-veiledning",
            paragraph="§5",
            verbatim_text=text,
            hash=h,
            fetched_at="not-a-date",
            source_url="https://www.arbeidstilsynet.no/",
        )


def test_citation_model_rejects_short_hash():
    """Citation model raises ValidationError for hash that is not 64 hex chars."""
    _reload()
    from src.citation import Citation
    from pydantic import ValidationError

    with pytest.raises(ValidationError, match="hash must be"):
        Citation(
            lov="arbeidstilsynet-veiledning",
            paragraph="§5",
            verbatim_text="Some text.",
            hash="abc123",  # too short
            fetched_at="2026-04-29T00:00:00+00:00",
            source_url="https://www.arbeidstilsynet.no/",
        )
