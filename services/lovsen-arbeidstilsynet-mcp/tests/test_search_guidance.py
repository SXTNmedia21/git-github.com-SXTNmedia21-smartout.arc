"""
test_search_guidance.py — Tests for search_guidance tool.

All tests run in LOVSEN_MCP_FIXTURE=1 mode — no outbound HTTP.
Network blocking is enforced by the RuntimeError guard in arbeidstilsynet_client.fetch_url().
"""

from __future__ import annotations

import os
import sys

import pytest

# Ensure fixture mode before any src imports
os.environ["LOVSEN_MCP_FIXTURE"] = "1"


def _reload():
    """Force module reload so FIXTURE_MODE picks up the env var."""
    mods = [k for k in sys.modules if "lovsen" in k or "arbeidstilsynet" in k]
    for m in mods:
        del sys.modules[m]


@pytest.fixture(autouse=True)
def fixture_mode_env(monkeypatch):
    monkeypatch.setenv("LOVSEN_MCP_FIXTURE", "1")


# ── Happy paths ───────────────────────────────────────────────────────────────


def test_search_guidance_hms_scope_returns_citation():
    """search_guidance(scope='hms') returns at least 1 Citation with required fields."""
    _reload()
    from src.tools.search_guidance import search_guidance

    results = search_guidance(query="systematisk helse miljø", scope="hms")

    assert isinstance(results, list)
    assert len(results) >= 1
    item = results[0]
    assert item["lov"] == "internkontrollforskriften"
    assert "verbatim_text" in item
    assert len(item["verbatim_text"]) > 50
    assert len(item["hash"]) == 64
    assert item["source_url"].startswith("https://")


def test_search_guidance_arbeidstid_scope():
    """search_guidance(scope='arbeidstid') returns arbeidstid fixture."""
    _reload()
    from src.tools.search_guidance import search_guidance

    results = search_guidance(query="nattarbeid", scope="arbeidstid")

    assert len(results) >= 1
    item = results[0]
    assert item["lov"] == "arbeidsmiljoloven"
    assert "nattarbeid" in item["verbatim_text"].lower() or "PLACEHOLDER" in item["verbatim_text"]


def test_search_guidance_risikovurdering_scope():
    """search_guidance(scope='risikovurdering') returns risikovurdering fixture."""
    _reload()
    from src.tools.search_guidance import search_guidance

    results = search_guidance(query="risikovurdering kjøkken", scope="risikovurdering")

    assert len(results) >= 1
    item = results[0]
    assert item["lov"] == "arbeidstilsynet-risikovurdering"
    assert item["paragraph"] == "template/risikovurdering-kjokken"


def test_search_guidance_keyword_routing_arbeidstid():
    """Keyword 'nattarbeid' in query routes to arbeidstid fixture without scope."""
    _reload()
    from src.tools.search_guidance import search_guidance

    results = search_guidance(query="nattarbeid regler")

    assert len(results) >= 1
    item = results[0]
    assert item["lov"] == "arbeidsmiljoloven"


def test_search_guidance_keyword_routing_risikovurdering():
    """Keyword 'risikovurdering' in query routes to risikovurdering fixture."""
    _reload()
    from src.tools.search_guidance import search_guidance

    results = search_guidance(query="risikovurdering kjøkken")

    assert len(results) >= 1
    item = results[0]
    assert item["lov"] == "arbeidstilsynet-risikovurdering"


def test_search_guidance_unknown_query_falls_back_to_hms():
    """Unknown query with no scope falls back to hms fixture."""
    _reload()
    from src.tools.search_guidance import search_guidance

    results = search_guidance(query="xyzzy not a real topic")

    assert len(results) >= 1
    # Fallback is hms_systematisk_arbeid
    assert results[0]["lov"] == "internkontrollforskriften"


# ── Limit clamping ────────────────────────────────────────────────────────────


def test_search_guidance_limit_is_respected():
    """limit parameter is honoured — results never exceed limit."""
    _reload()
    from src.tools.search_guidance import search_guidance

    results = search_guidance(query="HMS", scope="hms", limit=1)
    assert len(results) <= 1


def test_search_guidance_limit_zero_clamped_to_one():
    """limit=0 is clamped to 1 — always at least 1 result if fixture exists."""
    _reload()
    from src.tools.search_guidance import search_guidance

    results = search_guidance(query="HMS", scope="hms", limit=0)
    assert len(results) >= 1


# ── Validation errors ─────────────────────────────────────────────────────────


def test_search_guidance_invalid_scope_raises():
    """Invalid scope raises ValueError with valid scope list."""
    _reload()
    from src.tools.search_guidance import search_guidance

    with pytest.raises(ValueError, match="Invalid scope"):
        search_guidance(query="test", scope="invalid_scope")


# ── Network guard ─────────────────────────────────────────────────────────────


def test_network_guard_in_fixture_mode():
    """fetch_url raises RuntimeError if called in fixture mode — ensures zero HTTP."""
    _reload()
    from src.arbeidstilsynet_client import fetch_url

    with pytest.raises(RuntimeError, match="fixture mode"):
        fetch_url("https://www.arbeidstilsynet.no/test")
