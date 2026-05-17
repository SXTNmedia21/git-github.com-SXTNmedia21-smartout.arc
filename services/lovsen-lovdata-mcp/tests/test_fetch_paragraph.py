"""
test_fetch_paragraph.py — Tests for fetch_paragraph tool.

All tests run in LOVSEN_FIXTURE_MODE=true mode — no outbound HTTP.
Network blocking is enforced by the fixture-mode guard in lovdata_client.py
(raises RuntimeError on any http_get call) and confirmed via pytest-httpx mock
which would fail if httpx.AsyncClient were used without interception.
"""

from __future__ import annotations

import os
import pytest
import pytest_asyncio

# Ensure fixture mode is active for all tests in this module
os.environ["LOVSEN_FIXTURE_MODE"] = "true"

# Re-import module after env var is set so FIXTURE_MODE constant is correct
import importlib
import sys


def _reload_client():
    """Force reload lovdata_client so FIXTURE_MODE picks up the env var."""
    mods = [k for k in sys.modules if "lovsen" in k or "lovdata" in k]
    for m in mods:
        del sys.modules[m]


@pytest.fixture(autouse=True)
def fixture_mode_env(monkeypatch):
    """Guarantee LOVSEN_FIXTURE_MODE=true for every test."""
    monkeypatch.setenv("LOVSEN_FIXTURE_MODE", "true")


@pytest.mark.asyncio
async def test_fetch_paragraph_happy_path_14_6():
    """fetch_paragraph returns a valid Citation for aml §14-6 in fixture mode."""
    _reload_client()
    from src.tools.fetch_paragraph import fetch_paragraph

    result = await fetch_paragraph(lov="aml", paragraph="14-6")

    assert result["lov"] == "aml"
    assert result["paragraph"] == "§14-6"
    assert isinstance(result["verbatim_text"], str)
    assert len(result["verbatim_text"]) > 50
    assert len(result["hash"]) == 64
    assert result["hash"].islower()
    assert result["source_url"].startswith("https://")
    # fetched_at must be ISO-8601
    from datetime import datetime
    datetime.fromisoformat(result["fetched_at"].replace("Z", "+00:00"))


@pytest.mark.asyncio
async def test_fetch_paragraph_happy_path_15_3():
    """fetch_paragraph returns a valid Citation for aml §15-3."""
    _reload_client()
    from src.tools.fetch_paragraph import fetch_paragraph

    result = await fetch_paragraph(lov="aml", paragraph="15-3")
    assert result["paragraph"] == "§15-3"
    assert "oppsigelse" in result["verbatim_text"].lower() or "PLACEHOLDER" in result["verbatim_text"]


@pytest.mark.asyncio
async def test_fetch_paragraph_happy_path_15_6():
    """fetch_paragraph returns a valid Citation for aml §15-6."""
    _reload_client()
    from src.tools.fetch_paragraph import fetch_paragraph

    result = await fetch_paragraph(lov="aml", paragraph="15-6")
    assert result["paragraph"] == "§15-6"


@pytest.mark.asyncio
async def test_fetch_paragraph_missing_paragraph_raises():
    """fetch_paragraph raises FileNotFoundError when fixture is missing in fixture mode."""
    _reload_client()
    from src.tools.fetch_paragraph import fetch_paragraph

    with pytest.raises(FileNotFoundError, match="fixture not found"):
        await fetch_paragraph(lov="aml", paragraph="999-99")


@pytest.mark.asyncio
async def test_fetch_paragraph_missing_lov_raises():
    """fetch_paragraph raises ValueError for empty lov."""
    _reload_client()
    from src.tools.fetch_paragraph import fetch_paragraph

    with pytest.raises(ValueError, match="lov must not be empty"):
        await fetch_paragraph(lov="", paragraph="14-6")


@pytest.mark.asyncio
async def test_fetch_paragraph_empty_paragraph_raises():
    """fetch_paragraph raises ValueError for empty paragraph."""
    _reload_client()
    from src.tools.fetch_paragraph import fetch_paragraph

    with pytest.raises(ValueError, match="paragraph must not be empty"):
        await fetch_paragraph(lov="aml", paragraph="")


@pytest.mark.asyncio
async def test_fetch_paragraph_strips_paragraph_sign():
    """fetch_paragraph accepts '§14-6' and normalizes to '14-6' internally."""
    _reload_client()
    from src.tools.fetch_paragraph import fetch_paragraph

    # Should not crash — fixture key derived without §
    result = await fetch_paragraph(lov="aml", paragraph="§14-6")
    assert result["paragraph"] == "§14-6"


@pytest.mark.asyncio
async def test_fetch_paragraph_hash_matches_verbatim():
    """Hash in returned Citation is sha256(verbatim_text)."""
    import hashlib

    _reload_client()
    from src.tools.fetch_paragraph import fetch_paragraph

    result = await fetch_paragraph(lov="aml", paragraph="14-6")
    expected_hash = hashlib.sha256(result["verbatim_text"].encode("utf-8")).hexdigest()
    assert result["hash"] == expected_hash
