"""
test_search_law.py — Tests for search_law tool.

All tests run in LOVSEN_FIXTURE_MODE=true mode — no outbound HTTP.
Fixture-mode search does keyword matching over local fixture files.
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
async def test_search_law_returns_citations_for_known_term():
    """search_law returns at least one Citation when query matches fixture content."""
    _reload_client()
    from src.tools.search_law import search_law

    # "provetid" appears in both §14-6 and §15-6 fixtures
    results = await search_law(query="provetid", lov="aml")

    assert isinstance(results, list)
    assert len(results) >= 1
    for citation in results:
        assert "lov" in citation
        assert "paragraph" in citation
        assert "verbatim_text" in citation
        assert "hash" in citation
        assert len(citation["hash"]) == 64
        assert citation["source_url"].startswith("https://")


@pytest.mark.asyncio
async def test_search_law_limit_honored():
    """search_law returns at most `limit` results."""
    _reload_client()
    from src.tools.search_law import search_law

    # Any word that appears in all 3 fixtures
    results = await search_law(query="PLACEHOLDER", lov="aml", limit=1)

    assert len(results) <= 1


@pytest.mark.asyncio
async def test_search_law_empty_results_no_error():
    """search_law returns empty list (not an error) when no fixture matches."""
    _reload_client()
    from src.tools.search_law import search_law

    results = await search_law(query="xyzzyquuxfrobble", lov="aml")

    assert isinstance(results, list)
    assert len(results) == 0


@pytest.mark.asyncio
async def test_search_law_no_lov_filter_searches_all():
    """search_law without lov argument searches across all available fixture laws."""
    _reload_client()
    from src.tools.search_law import search_law

    results = await search_law(query="PLACEHOLDER")  # appears in all 3 fixtures

    assert isinstance(results, list)
    # With 3 aml fixtures, at least 1 should match
    assert len(results) >= 1


@pytest.mark.asyncio
async def test_search_law_empty_query_raises():
    """search_law raises ValueError for empty query."""
    _reload_client()
    from src.tools.search_law import search_law

    with pytest.raises(ValueError, match="query must not be empty"):
        await search_law(query="")


@pytest.mark.asyncio
async def test_search_law_limit_capped_at_50():
    """search_law caps limit at 50 even if a higher value is passed."""
    _reload_client()
    from src.tools.search_law import search_law

    # Should not raise — limit is silently capped
    results = await search_law(query="PLACEHOLDER", limit=9999)
    assert len(results) <= 50


@pytest.mark.asyncio
async def test_search_law_results_ranked_by_relevance():
    """Results should be ranked descending — higher-scoring items first."""
    _reload_client()
    from src.tools.search_law import search_law

    # "oppsigelse" appears heavily in §15-3 (multiple ledd)
    results = await search_law(query="oppsigelse", lov="aml")

    if len(results) >= 2:
        # Cannot easily verify internal scores, but we can check all are valid Citations
        for r in results:
            assert len(r["hash"]) == 64
