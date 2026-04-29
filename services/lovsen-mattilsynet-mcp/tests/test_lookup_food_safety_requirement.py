"""
test_lookup_food_safety_requirement.py — Tests for lookup_food_safety_requirement tool.

All tests run in LOVSEN_MCP_FIXTURE=1 mode — zero outbound HTTP.
Network blocking enforced by mattilsynet_client.py fetch_url() RuntimeError guard.
"""

from __future__ import annotations

import hashlib
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


# ── Happy path — known categories ─────────────────────────────────────────────


def test_lookup_kjolekjede():
    """lookup_food_safety_requirement('kjolekjede') returns valid Citation."""
    _reload()
    from src.tools.lookup_food_safety_requirement import run_lookup_food_safety_requirement

    result = run_lookup_food_safety_requirement(category="kjolekjede")
    assert result["lov"] == "hygieneforskriften"
    assert "kjøl" in result["verbatim_text"].lower() or "temperatur" in result["verbatim_text"].lower()
    assert len(result["hash"]) == 64


def test_lookup_allergener():
    """lookup_food_safety_requirement('allergener') returns valid Citation."""
    _reload()
    from src.tools.lookup_food_safety_requirement import run_lookup_food_safety_requirement

    result = run_lookup_food_safety_requirement(category="allergener")
    assert result["lov"] == "matinformasjonsforskriften"
    assert "allergen" in result["verbatim_text"].lower()
    assert len(result["hash"]) == 64


def test_lookup_bevilling():
    """lookup_food_safety_requirement('bevilling') returns valid Citation."""
    _reload()
    from src.tools.lookup_food_safety_requirement import run_lookup_food_safety_requirement

    result = run_lookup_food_safety_requirement(category="bevilling")
    assert result["lov"] == "alkoholloven"
    assert len(result["hash"]) == 64


def test_lookup_hygiene():
    """lookup_food_safety_requirement('hygiene') returns valid Citation."""
    _reload()
    from src.tools.lookup_food_safety_requirement import run_lookup_food_safety_requirement

    result = run_lookup_food_safety_requirement(category="hygiene")
    assert result["lov"] == "hygieneforskriften"


def test_lookup_aldersgrense_alkohol():
    """lookup_food_safety_requirement('aldersgrense-alkohol') returns valid Citation."""
    _reload()
    from src.tools.lookup_food_safety_requirement import run_lookup_food_safety_requirement

    result = run_lookup_food_safety_requirement(category="aldersgrense-alkohol")
    assert result["lov"] == "alkoholloven"
    assert "18" in result["verbatim_text"]


def test_lookup_merking():
    """lookup_food_safety_requirement('merking') returns valid Citation."""
    _reload()
    from src.tools.lookup_food_safety_requirement import run_lookup_food_safety_requirement

    result = run_lookup_food_safety_requirement(category="merking")
    assert result["lov"] == "matinformasjonsforskriften"


def test_lookup_hash_matches_verbatim():
    """SHA-256 of verbatim_text must equal the stored hash."""
    _reload()
    from src.tools.lookup_food_safety_requirement import run_lookup_food_safety_requirement

    result = run_lookup_food_safety_requirement(category="kjolekjede")
    expected = hashlib.sha256(result["verbatim_text"].encode("utf-8")).hexdigest()
    assert result["hash"] == expected


def test_lookup_source_url_is_mattilsynet():
    """source_url must point to mattilsynet.no."""
    _reload()
    from src.tools.lookup_food_safety_requirement import run_lookup_food_safety_requirement

    result = run_lookup_food_safety_requirement(category="hygiene")
    assert "mattilsynet.no" in result["source_url"]


# ── Error paths ────────────────────────────────────────────────────────────────


def test_lookup_unknown_category_raises():
    """Unknown category raises ValueError with list of known categories."""
    _reload()
    from src.tools.lookup_food_safety_requirement import run_lookup_food_safety_requirement

    with pytest.raises(ValueError, match="Unknown category"):
        run_lookup_food_safety_requirement(category="xyz-unknown-category")


def test_lookup_empty_category_raises():
    """Empty category raises ValueError."""
    _reload()
    from src.tools.lookup_food_safety_requirement import run_lookup_food_safety_requirement

    with pytest.raises(ValueError, match="category must not be empty"):
        run_lookup_food_safety_requirement(category="")


def test_lookup_network_never_called():
    """
    In fixture mode, fetch_url RuntimeError guard is never triggered.
    A known category must succeed without RuntimeError.
    """
    _reload()
    from src.tools.lookup_food_safety_requirement import run_lookup_food_safety_requirement

    result = run_lookup_food_safety_requirement(category="kjolekjede")
    assert result["lov"] == "hygieneforskriften"
    # If network were called, RuntimeError("LOVSEN_MCP_FIXTURE") would propagate
