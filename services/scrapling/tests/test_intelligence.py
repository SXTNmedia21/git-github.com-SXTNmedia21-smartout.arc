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


# ── Enrichment function tests ────────────────────────────────────────

@pytest.mark.asyncio
async def test_enrich_from_brreg_by_org_number():
    """Mock aiohttp to simulate BRREG direct lookup by org number."""
    from unittest.mock import AsyncMock, MagicMock, patch
    from intelligence import enrich_from_brreg

    brreg_response = {
        "organisasjonsnummer": "912345678",
        "stiftelsesdato": "2004-06-15",
        "forretningsadresse": {
            "adresse": ["Munkegata 10"],
            "postnummer": "7011",
            "poststed": "TRONDHEIM",
        },
        "naeringskode1": {
            "kode": "56.101",
            "beskrivelse": "Drift av restauranter og kafeer",
        },
    }

    mock_resp = AsyncMock()
    mock_resp.status = 200
    mock_resp.json = AsyncMock(return_value=brreg_response)
    mock_resp.__aenter__ = AsyncMock(return_value=mock_resp)
    mock_resp.__aexit__ = AsyncMock(return_value=False)

    mock_session = MagicMock()
    mock_session.get = MagicMock(return_value=mock_resp)
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock(return_value=False)

    with patch("intelligence.aiohttp") as mock_aiohttp:
        mock_aiohttp.ClientTimeout = MagicMock()
        mock_aiohttp.ClientSession = MagicMock(return_value=mock_session)

        result = await enrich_from_brreg(org_number="912345678")

    assert result["founding_date"] == "2004-06-15"
    assert result["industry"] == "Drift av restauranter og kafeer"
    assert "TRONDHEIM" in result["address"]
    assert result["org_number"] == "912345678"
    assert "brreg" in result["sources"]
    assert result["years_in_business"] == datetime.now().year - 2004


@pytest.mark.asyncio
async def test_enrich_from_brreg_search_by_name():
    """Mock aiohttp to simulate BRREG name search with city matching."""
    from unittest.mock import AsyncMock, MagicMock, patch
    from intelligence import enrich_from_brreg

    search_response = {
        "_embedded": {
            "enheter": [
                {
                    "organisasjonsnummer": "111111111",
                    "stiftelsesdato": "2010-01-01",
                    "forretningsadresse": {
                        "adresse": ["Storgata 1"],
                        "postnummer": "0182",
                        "poststed": "OSLO",
                    },
                    "naeringskode1": {"kode": "56.101", "beskrivelse": "Restaurant"},
                },
                {
                    "organisasjonsnummer": "222222222",
                    "stiftelsesdato": "2015-05-20",
                    "forretningsadresse": {
                        "adresse": ["Nordre gate 5"],
                        "postnummer": "7011",
                        "poststed": "TRONDHEIM",
                    },
                    "naeringskode1": {"kode": "56.101", "beskrivelse": "Kafedrift"},
                },
            ]
        }
    }

    mock_resp = AsyncMock()
    mock_resp.status = 200
    mock_resp.json = AsyncMock(return_value=search_response)
    mock_resp.__aenter__ = AsyncMock(return_value=mock_resp)
    mock_resp.__aexit__ = AsyncMock(return_value=False)

    mock_session = MagicMock()
    mock_session.get = MagicMock(return_value=mock_resp)
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock(return_value=False)

    with patch("intelligence.aiohttp") as mock_aiohttp:
        mock_aiohttp.ClientTimeout = MagicMock()
        mock_aiohttp.ClientSession = MagicMock(return_value=mock_session)

        result = await enrich_from_brreg(company_name="TestKafe", city="Trondheim")

    # Should pick the Trondheim match
    assert result["org_number"] == "222222222"
    assert result["founding_date"] == "2015-05-20"
    assert "brreg" in result["sources"]


@pytest.mark.asyncio
async def test_enrich_from_web_search():
    """Mock aiohttp to simulate Serper API response."""
    from unittest.mock import AsyncMock, MagicMock, patch
    from intelligence import enrich_from_web_search, WorkspaceIntelligence

    serper_organic_response = {
        "knowledgeGraph": {
            "rating": "4.3",
            "reviewCount": "1,204",
        },
        "organic": [
            {
                "title": "Solsiden Restaurant - Trondheim",
                "snippet": "Fantastisk sjomat restaurant med uteservering ved kanalen.",
                "link": "https://example.com/solsiden",
            },
            {
                "title": "Solsiden - TripAdvisor",
                "snippet": "4.5 / 5 basert pa 800 anmeldelser",
                "link": "https://tripadvisor.com/Solsiden",
            },
        ],
    }

    serper_news_response = {
        "news": [
            {
                "title": "Solsiden apner ny terrasse",
                "snippet": "Restauranten utvider med sommersesong.",
                "source": "Adressa",
                "date": "2026-03-01",
                "link": "https://adressa.no/solsiden",
            },
        ],
    }

    call_count = 0

    def mock_post(*args, **kwargs):
        """Return a sync context manager that yields a mock response."""
        nonlocal call_count
        call_count += 1
        mock_resp = AsyncMock()
        mock_resp.status = 200
        if call_count % 2 == 1:
            mock_resp.json = AsyncMock(return_value=serper_organic_response)
        else:
            mock_resp.json = AsyncMock(return_value=serper_news_response)
        mock_resp.__aenter__ = AsyncMock(return_value=mock_resp)
        mock_resp.__aexit__ = AsyncMock(return_value=False)
        return mock_resp

    mock_session = MagicMock()
    mock_session.post = mock_post
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock(return_value=False)

    intel = WorkspaceIntelligence()

    with patch("intelligence.aiohttp") as mock_aiohttp:
        mock_aiohttp.ClientTimeout = MagicMock()
        mock_aiohttp.ClientSession = MagicMock(return_value=mock_session)

        result = await enrich_from_web_search(
            intel, "Solsiden", "Trondheim", serper_api_key="test-key"
        )

    assert result["google_rating"] == 4.3
    assert result["google_review_count"] == 1204
    assert len(result["web_mentions"]) >= 1
    assert any(r["source"] == "TripAdvisor" for r in result.get("external_ratings", []))
    assert "web_search" in result["sources"]
    assert len(result["sources"]["web_search"]["queries_used"]) > 0


@pytest.mark.asyncio
async def test_enrich_from_web_search_no_api_key():
    """Without API key, web search should return empty dict."""
    from intelligence import enrich_from_web_search, WorkspaceIntelligence

    intel = WorkspaceIntelligence()
    result = await enrich_from_web_search(intel, "Test", serper_api_key=None)
    assert result == {}


@pytest.mark.asyncio
async def test_handle_enrich_seeds_identity():
    """handle_enrich should seed identity fields on the intelligence model."""
    from unittest.mock import AsyncMock, patch
    from intelligence import handle_enrich, EnrichRequest

    with patch("intelligence.enrich_from_brreg", new_callable=AsyncMock, return_value={}), \
         patch("intelligence.enrich_from_scrape", new_callable=AsyncMock, return_value={}), \
         patch("intelligence.enrich_from_web_search", new_callable=AsyncMock, return_value={}):

        req = EnrichRequest(
            company_name="TestCo",
            city="Oslo",
            website_url="https://testco.no",
        )
        resp = await handle_enrich(req)

    assert resp.intelligence.company_name == "TestCo"
    assert resp.intelligence.city == "Oslo"
    assert resp.intelligence.website_url == "https://testco.no"
