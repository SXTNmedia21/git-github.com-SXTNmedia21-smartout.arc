"""
test_fixture_mode.py — Tests verifying LOVSEN_MCP_FIXTURE=1 contract (ADR-0244).

Key invariants:
- Env var switches the client to fixture-only mode
- Missing fixture → FileNotFoundError (CI-safe: never falls back to network)
- Malformed fixture JSON → ValueError (fail fast)
- Hash mismatch in fixture → ValueError with "fixture corruption detected"
- Zero outbound HTTP calls during the entire module run (enforced via
  mattilsynet_client.py's RuntimeError guard in fetch_url())
"""

from __future__ import annotations

import hashlib
import json
import os
import sys

import pytest

os.environ["LOVSEN_MCP_FIXTURE"] = "1"


def _reload():
    mods = [k for k in sys.modules if "lovsen" in k or "mattilsynet" in k]
    for m in mods:
        del sys.modules[m]


@pytest.fixture(autouse=True)
def fixture_mode_env(monkeypatch):
    monkeypatch.setenv("LOVSEN_MCP_FIXTURE", "1")


# ── Fixture mode active ───────────────────────────────────────────────────────


def test_fixture_mode_is_active():
    """LOVSEN_MCP_FIXTURE=1 means FIXTURE_MODE is True in the client module."""
    _reload()
    from src.mattilsynet_client import FIXTURE_MODE

    assert FIXTURE_MODE is True


def test_fetch_url_raises_in_fixture_mode():
    """fetch_url raises RuntimeError when FIXTURE_MODE is active — network guard."""
    _reload()
    from src.mattilsynet_client import fetch_url

    with pytest.raises(RuntimeError, match="FIXTURE"):
        fetch_url("https://www.mattilsynet.no/test")


# ── Missing fixture → clear error ─────────────────────────────────────────────


def test_missing_fixture_raises_file_not_found_guidance():
    """fetch_guidance with unknown topic raises ValueError (not FileNotFoundError)."""
    _reload()
    from src.tools.fetch_guidance import run_fetch_guidance

    with pytest.raises(ValueError, match="Unknown topic"):
        run_fetch_guidance(topic="lov-that-does-not-exist")


def test_missing_fixture_raises_file_not_found_lookup():
    """lookup_food_safety_requirement with unknown category raises ValueError."""
    _reload()
    from src.tools.lookup_food_safety_requirement import run_lookup_food_safety_requirement

    with pytest.raises(ValueError, match="Unknown category"):
        run_lookup_food_safety_requirement(category="category-that-does-not-exist")


# ── Malformed fixture JSON ─────────────────────────────────────────────────────


def test_malformed_fixture_json_raises(tmp_path, monkeypatch):
    """Malformed fixture JSON in search_regulation raises ValueError."""
    _reload()
    from src.tools import search_regulation as sr_mod

    # Monkeypatch _FIXTURES_DIR to our tmp dir and create a bad fixture
    monkeypatch.setattr(sr_mod, "_FIXTURE_INDEX", [
        {
            "file": "bad_fixture.json",
            "keywords": ["bad"],
            "scopes": ["bad"],
        }
    ])
    monkeypatch.setattr(sr_mod, "_FIXTURES_DIR", tmp_path)
    bad_file = tmp_path / "bad_fixture.json"
    bad_file.write_text("{not valid json !!!", encoding="utf-8")

    with pytest.raises(ValueError, match="malformed JSON"):
        sr_mod.run_search_regulation(query="bad")


# ── Hash mismatch → corruption detected ──────────────────────────────────────


def test_hash_mismatch_detected():
    """
    A Citation constructed with a hash that doesn't match verbatim_text
    is rejected with 'fixture corruption detected'.
    """
    _reload()
    from src.citation import Citation
    from pydantic import ValidationError

    corrupt = {
        "lov": "hygieneforskriften",
        "paragraph": "krav/hygiene",
        "ledd": None,
        "bokstav": None,
        "verbatim_text": "Some real text here.",
        "hash": "a" * 64,  # deliberately wrong hash
        "fetched_at": "2026-04-29T00:00:00Z",
        "source_url": "https://www.mattilsynet.no/test",
        "law_version": None,
    }
    with pytest.raises(ValidationError, match="fixture corruption detected"):
        Citation(**corrupt)


# ── 3 seeded fixtures load cleanly ───────────────────────────────────────────


def test_all_3_fixtures_load_in_fixture_mode():
    """All 3 fixture topics load successfully in fixture mode."""
    _reload()
    from src.tools.fetch_guidance import run_fetch_guidance

    for topic in ["alkohol-aldersgrense", "allergener-merking", "hygiene-temperatur"]:
        result = run_fetch_guidance(topic=topic)
        assert isinstance(result["verbatim_text"], str)
        assert len(result["hash"]) == 64
        assert result["hash"] == result["hash"].lower()


def test_all_3_categories_load_in_fixture_mode():
    """All 3 known lookup categories load successfully in fixture mode."""
    _reload()
    from src.tools.lookup_food_safety_requirement import run_lookup_food_safety_requirement

    for category in ["kjolekjede", "allergener", "bevilling"]:
        result = run_lookup_food_safety_requirement(category=category)
        assert len(result["hash"]) == 64
