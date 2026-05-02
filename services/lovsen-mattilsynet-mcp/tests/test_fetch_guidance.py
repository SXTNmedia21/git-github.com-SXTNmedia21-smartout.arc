"""
test_fetch_guidance.py — Tests for fetch_guidance tool.

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


# ── Happy path — 3 known topics ───────────────────────────────────────────────


def test_fetch_alkohol_aldersgrense():
    """fetch_guidance('alkohol-aldersgrense') returns valid Citation from fixture."""
    _reload()
    from src.tools.fetch_guidance import run_fetch_guidance

    result = run_fetch_guidance(topic="alkohol-aldersgrense")
    assert result["lov"] == "alkoholloven"
    assert "alkohol" in result["verbatim_text"].lower()
    assert len(result["hash"]) == 64
    assert result["source_url"].startswith("https://")


def test_fetch_allergener_merking():
    """fetch_guidance('allergener-merking') returns valid Citation from fixture."""
    _reload()
    from src.tools.fetch_guidance import run_fetch_guidance

    result = run_fetch_guidance(topic="allergener-merking")
    assert result["lov"] == "matinformasjonsforskriften"
    assert "allergen" in result["verbatim_text"].lower()
    assert len(result["hash"]) == 64


def test_fetch_hygiene_temperatur():
    """fetch_guidance('hygiene-temperatur') returns valid Citation from fixture."""
    _reload()
    from src.tools.fetch_guidance import run_fetch_guidance

    result = run_fetch_guidance(topic="hygiene-temperatur")
    assert result["lov"] == "hygieneforskriften"
    assert "kjøl" in result["verbatim_text"].lower() or "temperatur" in result["verbatim_text"].lower()
    assert len(result["hash"]) == 64


def test_fetch_alkohol_alias():
    """Short alias 'alkohol' resolves to the same fixture as 'alkohol-aldersgrense'."""
    _reload()
    from src.tools.fetch_guidance import run_fetch_guidance

    result = run_fetch_guidance(topic="alkohol")
    assert result["lov"] == "alkoholloven"


def test_fetch_fetched_at_is_iso8601():
    """fetched_at in returned Citation is valid ISO-8601."""
    from datetime import datetime

    _reload()
    from src.tools.fetch_guidance import run_fetch_guidance

    result = run_fetch_guidance(topic="alkohol-aldersgrense")
    dt = datetime.fromisoformat(result["fetched_at"].replace("Z", "+00:00"))
    assert dt.year >= 2026


def test_fetch_hash_matches_verbatim():
    """SHA-256 of verbatim_text must equal the stored hash."""
    _reload()
    from src.tools.fetch_guidance import run_fetch_guidance

    result = run_fetch_guidance(topic="allergener-merking")
    expected = hashlib.sha256(result["verbatim_text"].encode("utf-8")).hexdigest()
    assert result["hash"] == expected


# ── Error paths ────────────────────────────────────────────────────────────────


def test_fetch_unknown_topic_raises_value_error():
    """Unknown topic raises ValueError with list of known slugs."""
    _reload()
    from src.tools.fetch_guidance import run_fetch_guidance

    with pytest.raises(ValueError, match="Unknown topic"):
        run_fetch_guidance(topic="unknown-topic-xyz")


def test_fetch_empty_topic_raises_value_error():
    """Empty topic raises ValueError."""
    _reload()
    from src.tools.fetch_guidance import run_fetch_guidance

    with pytest.raises(ValueError, match="topic must not be empty"):
        run_fetch_guidance(topic="")


def test_fetch_network_never_called():
    """
    In fixture mode, fetch_url RuntimeError guard is never triggered.
    If network were called, RuntimeError would propagate here.
    A known topic must succeed without RuntimeError.
    """
    _reload()
    from src.tools.fetch_guidance import run_fetch_guidance

    # Must not raise RuntimeError from the network guard
    result = run_fetch_guidance(topic="hygiene-temperatur")
    assert result["lov"] == "hygieneforskriften"
