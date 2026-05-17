"""
test_get_law_metadata.py — Tests for get_law_metadata tool.

All tests run in LOVSEN_FIXTURE_MODE=true mode — no outbound HTTP.
In fixture mode, metadata is derived from available fixture files.
"""

from __future__ import annotations

import os
import sys
import pytest

os.environ["LOVSEN_FIXTURE_MODE"] = "true"


def _reload_client():
    mods = [k for k in sys.modules if "lovsen" in k or "lovdata" in k]
    for m in mods:
        del sys.modules[m]


@pytest.fixture(autouse=True)
def fixture_mode_env(monkeypatch):
    monkeypatch.setenv("LOVSEN_FIXTURE_MODE", "true")


@pytest.mark.asyncio
async def test_get_law_metadata_returns_dict():
    """get_law_metadata returns a dict with required keys."""
    _reload_client()
    from src.tools.get_law_metadata import get_law_metadata

    result = await get_law_metadata(lov="aml")

    assert isinstance(result, dict)
    assert "name" in result
    assert "version" in result
    assert "last_updated" in result
    assert "total_paragraphs" in result
    assert "source_url" in result


@pytest.mark.asyncio
async def test_get_law_metadata_name_contains_aml():
    """get_law_metadata for 'aml' returns name containing 'Arbeidsmiljo' or 'aml'."""
    _reload_client()
    from src.tools.get_law_metadata import get_law_metadata

    result = await get_law_metadata(lov="aml")

    name = result["name"].lower()
    assert "arbeidsmilj" in name or "aml" in name


@pytest.mark.asyncio
async def test_get_law_metadata_source_url_is_https():
    """source_url in metadata starts with https://lovdata.no."""
    _reload_client()
    from src.tools.get_law_metadata import get_law_metadata

    result = await get_law_metadata(lov="aml")

    assert result["source_url"].startswith("https://lovdata.no")


@pytest.mark.asyncio
async def test_get_law_metadata_total_paragraphs_from_fixtures():
    """total_paragraphs reflects the number of loaded aml fixtures (at least 3)."""
    _reload_client()
    from src.tools.get_law_metadata import get_law_metadata

    result = await get_law_metadata(lov="aml")

    # We seeded 3 aml fixtures
    assert result["total_paragraphs"] >= 3


@pytest.mark.asyncio
async def test_get_law_metadata_empty_lov_raises():
    """get_law_metadata raises ValueError for empty lov."""
    _reload_client()
    from src.tools.get_law_metadata import get_law_metadata

    with pytest.raises(ValueError, match="lov must not be empty"):
        await get_law_metadata(lov="")


@pytest.mark.asyncio
async def test_get_law_metadata_unknown_lov_returns_default():
    """get_law_metadata returns a result even for unknown laws (derives name from lov key)."""
    _reload_client()
    from src.tools.get_law_metadata import get_law_metadata

    result = await get_law_metadata(lov="unknownlaw")

    assert isinstance(result, dict)
    assert result["total_paragraphs"] == 0  # no fixtures for unknown law
    assert result["source_url"].startswith("https://lovdata.no")
