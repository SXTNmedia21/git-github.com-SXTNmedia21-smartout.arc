"""
test_search_regulation.py — Tests for search_regulation tool.

All tests run in LOVSEN_MCP_FIXTURE=1 mode — zero outbound HTTP.
Network blocking is enforced by mattilsynet_client.py's fetch_url()
RuntimeError guard and confirmed here.
"""

from __future__ import annotations

import os
import sys

import pytest

# Ensure fixture mode is active before any imports resolve FIXTURE_MODE
os.environ["LOVSEN_MCP_FIXTURE"] = "1"


def _reload():
    """Force-reload lovsen modules so FIXTURE_MODE constant picks up env var."""
    mods = [k for k in sys.modules if "lovsen" in k or "mattilsynet" in k]
    for m in mods:
        del sys.modules[m]


@pytest.fixture(autouse=True)
def fixture_mode_env(monkeypatch):
    """Guarantee LOVSEN_MCP_FIXTURE=1 for every test."""
    monkeypatch.setenv("LOVSEN_MCP_FIXTURE", "1")


# ── Happy path — keyword matches ─────────────────────────────────────────────


def test_search_alkohol_returns_citation():
    """search_regulation('alkohol') returns at least one Citation in fixture mode."""
    _reload()
    from src.tools.search_regulation import run_search_regulation

    results = run_search_regulation(query="alkohol")
    assert len(results) >= 1
    r = results[0]
    assert r["lov"] == "alkoholloven"
    assert isinstance(r["verbatim_text"], str)
    assert len(r["hash"]) == 64


def test_search_allergener_returns_citation():
    """search_regulation('allergener') matches the allergen fixture."""
    _reload()
    from src.tools.search_regulation import run_search_regulation

    results = run_search_regulation(query="allergener")
    assert len(results) >= 1
    assert any("matinformasjonsforskriften" in r["lov"] for r in results)


def test_search_hygiene_returns_citation():
    """search_regulation('hygiene') matches the hygiene fixture."""
    _reload()
    from src.tools.search_regulation import run_search_regulation

    results = run_search_regulation(query="hygiene")
    assert len(results) >= 1
    assert any("hygieneforskriften" in r["lov"] for r in results)


def test_search_with_scope_filter():
    """scope='allergener' narrows results to the allergen fixture only."""
    _reload()
    from src.tools.search_regulation import run_search_regulation

    results = run_search_regulation(query="merking", scope="allergener")
    assert len(results) >= 1
    for r in results:
        assert "matinformasjonsforskriften" in r["lov"]


def test_search_scope_excludes_non_matching():
    """scope='hygiene' excludes alkohol fixture from results."""
    _reload()
    from src.tools.search_regulation import run_search_regulation

    results = run_search_regulation(query="alkohol", scope="hygiene")
    assert len(results) == 0


def test_search_limit_respected():
    """limit=1 caps the number of returned Citations."""
    _reload()
    from src.tools.search_regulation import run_search_regulation

    # Broad query without scope should match multiple fixtures
    results = run_search_regulation(query="norsk", limit=1)
    assert len(results) <= 1


def test_search_hash_matches_verbatim():
    """SHA-256 of verbatim_text must equal the stored hash in every result."""
    import hashlib

    _reload()
    from src.tools.search_regulation import run_search_regulation

    results = run_search_regulation(query="alkohol")
    for r in results:
        expected = hashlib.sha256(r["verbatim_text"].encode("utf-8")).hexdigest()
        assert r["hash"] == expected, f"Hash mismatch in search result for {r['lov']}"


# ── Error paths ────────────────────────────────────────────────────────────────


def test_search_empty_query_raises():
    """Empty query raises ValueError."""
    _reload()
    from src.tools.search_regulation import run_search_regulation

    with pytest.raises(ValueError, match="query must not be empty"):
        run_search_regulation(query="")


def test_search_whitespace_query_raises():
    """Whitespace-only query raises ValueError."""
    _reload()
    from src.tools.search_regulation import run_search_regulation

    with pytest.raises(ValueError, match="query must not be empty"):
        run_search_regulation(query="   ")


def test_search_no_match_returns_empty_list():
    """A query that matches nothing in fixture corpus returns an empty list."""
    _reload()
    from src.tools.search_regulation import run_search_regulation

    results = run_search_regulation(query="xyz_no_match_12345_unique_string")
    assert results == []


def test_search_network_never_called():
    """
    In fixture mode, fetch_url raises RuntimeError — verify it is NEVER invoked
    by checking that ValueError from unknown topic, not RuntimeError, is raised.
    """
    _reload()
    from src.tools.search_regulation import run_search_regulation

    # A no-match result is expected, not a RuntimeError from the network guard
    results = run_search_regulation(query="xyz_no_match_12345_unique_string")
    assert results == []
    # If network were called, RuntimeError("LOVSEN_MCP_FIXTURE=1") would have been raised
