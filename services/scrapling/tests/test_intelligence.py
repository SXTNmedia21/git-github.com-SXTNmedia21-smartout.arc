"""Tests for WorkspaceIntelligence model, merge logic, gap detection, and query building."""
import pytest
from datetime import datetime


def test_default_intelligence_has_all_none():
    from intelligence import WorkspaceIntelligence
    intel = WorkspaceIntelligence()
    assert intel.company_name is None
    assert intel.founding_date is None
    assert intel.sources == {}
    assert intel.concept_clues == []


def test_merge_partial_sets_none_fields():
    from intelligence import WorkspaceIntelligence, merge_partial
    intel = WorkspaceIntelligence(company_name="Test")
    partial = {"founding_date": "2004-06-15", "city": "Trondheim"}
    result = merge_partial(intel, partial)
    assert result.founding_date == "2004-06-15"
    assert result.city == "Trondheim"
    assert result.company_name == "Test"


def test_merge_partial_does_not_overwrite_existing_scalars():
    from intelligence import WorkspaceIntelligence, merge_partial
    intel = WorkspaceIntelligence(city="Oslo")
    partial = {"city": "Bergen"}
    result = merge_partial(intel, partial)
    assert result.city == "Oslo"


def test_merge_partial_deduplicates_lists():
    from intelligence import WorkspaceIntelligence, merge_partial
    intel = WorkspaceIntelligence(concept_clues=["sjomat", "fine dining"])
    partial = {"concept_clues": ["fine dining", "lokale ravarer"]}
    result = merge_partial(intel, partial)
    assert result.concept_clues == ["sjomat", "fine dining", "lokale ravarer"]


def test_merge_partial_deep_merges_sources():
    from intelligence import WorkspaceIntelligence, merge_partial
    intel = WorkspaceIntelligence(sources={"brreg": {"fetched_at": "2026-01-01T00:00:00Z"}})
    partial = {"sources": {"scrape": {"fetched_at": "2026-01-01T00:01:00Z", "urls_scraped": ["https://x.no"]}}}
    result = merge_partial(intel, partial)
    assert "brreg" in result.sources
    assert "scrape" in result.sources


def test_compute_gaps_all_missing():
    from intelligence import WorkspaceIntelligence, compute_gaps
    intel = WorkspaceIntelligence()
    gaps = compute_gaps(intel)
    assert "web_search" in gaps
    assert "no_founding_date" in gaps
    assert "no_concept_clues" in gaps


def test_compute_gaps_all_filled():
    from intelligence import WorkspaceIntelligence, compute_gaps
    intel = WorkspaceIntelligence(
        founding_date="2004-06-15",
        concept_clues=["sjomat"],
        cuisine_types=["nordisk"],
        google_rating=4.5,
        sources={"web_search": {"fetched_at": "2026-01-01T00:00:00Z", "queries_used": []}}
    )
    gaps = compute_gaps(intel)
    assert gaps == []


def test_build_query_candidates():
    from intelligence import build_query_candidates
    queries = build_query_candidates("Solsiden", "Trondheim")
    assert queries[0] == "Solsiden Trondheim"
    assert "Solsiden anmeldelse" in queries
    assert "Solsiden historie apnet" in queries
    assert "Solsiden Trondheim restaurant" in queries


def test_build_query_candidates_no_city():
    from intelligence import build_query_candidates
    queries = build_query_candidates("Solsiden", None)
    assert queries[0] == "Solsiden"
    assert "Solsiden Trondheim restaurant" not in queries


def test_has_unused_queries_first_call():
    from intelligence import WorkspaceIntelligence, has_unused_queries
    intel = WorkspaceIntelligence()
    assert has_unused_queries(intel, "Solsiden", "Trondheim") is True


def test_has_unused_queries_all_used():
    from intelligence import WorkspaceIntelligence, has_unused_queries, build_query_candidates
    all_queries = build_query_candidates("Solsiden", "Trondheim")
    intel = WorkspaceIntelligence(sources={
        "web_search": {"fetched_at": "2026-01-01", "queries_used": all_queries}
    })
    assert has_unused_queries(intel, "Solsiden", "Trondheim") is False


def test_build_context_basic():
    from intelligence import WorkspaceIntelligence, build_context
    intel = WorkspaceIntelligence(
        company_name="Solsiden",
        city="Trondheim",
        founding_date="2004-06-15",
        years_in_business=22,
        industry="Restaurant og kafedrift",
    )
    ctx = build_context(intel)
    assert "Solsiden" in ctx
    assert "Trondheim" in ctx
    assert "2004-06-15" in ctx
    assert "22" in ctx


def test_build_context_empty_intelligence():
    from intelligence import WorkspaceIntelligence, build_context
    intel = WorkspaceIntelligence()
    ctx = build_context(intel)
    assert ctx == ""


def test_years_in_business_computed():
    from intelligence import compute_years_in_business
    years = compute_years_in_business("2004-06-15")
    expected = datetime.now().year - 2004
    assert years == expected


def test_years_in_business_none():
    from intelligence import compute_years_in_business
    assert compute_years_in_business(None) is None
