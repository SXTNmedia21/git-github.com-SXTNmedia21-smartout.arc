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


# ── Generate endpoint tests ──────────────────────────────────────────


def test_build_prompt_includes_context():
    from intelligence import WorkspaceIntelligence, build_generate_prompt
    intel = WorkspaceIntelligence(
        company_name="Solsiden",
        city="Trondheim",
        founding_date="2004-06-15",
        years_in_business=22,
    )
    prompt = build_generate_prompt(intel)
    assert "Solsiden" in prompt
    assert "300 tegn" in prompt
    assert "Google Business" in prompt
    assert "naboen" in prompt


@pytest.mark.asyncio
async def test_handle_generate_calls_openrouter():
    from intelligence import handle_generate, GenerateRequest, WorkspaceIntelligence
    import json
    intel = WorkspaceIntelligence(
        company_name="Solsiden",
        city="Trondheim",
        founding_date="2004-06-15",
        years_in_business=22,
        concept_clues=["sjomat", "uteservering"],
    )
    mock_ai_response = {
        "choices": [{"message": {"content": json.dumps({
            "about_us": "Solsiden ligger pa havna.",
            "our_history": "Siden 2004.",
            "our_concept": "Fersk sjomat."
        })}}]
    }
    from unittest.mock import AsyncMock, patch, MagicMock

    mock_resp = AsyncMock()
    mock_resp.status = 200
    mock_resp.json = AsyncMock(return_value=mock_ai_response)
    mock_resp.__aenter__ = AsyncMock(return_value=mock_resp)
    mock_resp.__aexit__ = AsyncMock(return_value=False)

    mock_session = MagicMock()
    mock_session.post = MagicMock(return_value=mock_resp)
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock(return_value=False)

    with patch("intelligence.aiohttp") as mock_aiohttp:
        mock_aiohttp.ClientTimeout = MagicMock()
        mock_aiohttp.ClientSession = MagicMock(return_value=mock_session)

        with patch("intelligence.OPENROUTER_API_KEY", "test-key"):
            result = await handle_generate(GenerateRequest(intelligence=intel))

    assert result.about_us == "Solsiden ligger pa havna."
    assert result.our_history == "Siden 2004."
    assert result.our_concept == "Fersk sjomat."


def test_extract_json_from_llm_code_block():
    from intelligence import _extract_json_from_llm
    text = '```json\n{"about_us": "test"}\n```'
    assert _extract_json_from_llm(text) == '{"about_us": "test"}'


def test_extract_json_from_llm_raw_object():
    from intelligence import _extract_json_from_llm
    text = 'Here is the result: {"about_us": "test"}'
    assert _extract_json_from_llm(text) == '{"about_us": "test"}'


# ── Smart BRREG search ──────────────────────────────────────────────


class TestNormalizeCompanyName:
    def test_strips_legal_suffix(self):
        from intelligence import normalize_company_name
        assert normalize_company_name("RØRA CAFE AS") == "røra cafe"
        assert normalize_company_name("Cafe Røra ENK") == "cafe røra"
        assert normalize_company_name("DNB ASA") == "dnb"
        assert normalize_company_name("FOO BAR DA") == "foo bar"

    def test_preserves_norwegian_chars(self):
        from intelligence import normalize_company_name
        assert normalize_company_name("RØDE KORS") == "røde kors"

    def test_collapses_whitespace(self):
        from intelligence import normalize_company_name
        assert normalize_company_name("  CAFE   OSEBRO  AS  ") == "cafe osebro"

    def test_handles_empty_and_none(self):
        from intelligence import normalize_company_name
        assert normalize_company_name("") == ""
        assert normalize_company_name(None) == ""

    def test_strips_punctuation(self):
        from intelligence import normalize_company_name
        # apostrophes and ampersands removed, words preserved
        result = normalize_company_name("CAFE'S MAT & DRIKKE AS")
        assert "cafe" in result and "mat" in result and "drikke" in result


class TestCoreTokens:
    def test_extracts_distinctive_token(self):
        from intelligence import core_tokens
        assert core_tokens("Røra Cafe AS") == {"røra"}
        assert core_tokens("CAFE OSEBRO AS") == {"osebro"}

    def test_only_generic_returns_empty(self):
        from intelligence import core_tokens
        assert core_tokens("CAFE BAR AS") == set()

    def test_multi_core_tokens(self):
        from intelligence import core_tokens
        assert core_tokens("Solsiden Brygge AS") == {"solsiden", "brygge"}

    def test_drops_single_char_tokens(self):
        from intelligence import core_tokens
        assert core_tokens("A B C AS") == set()


class TestNameSimilarity:
    def test_perfect_match_high(self):
        from intelligence import compute_name_similarity
        assert compute_name_similarity("RØRA CAFE AS", "Røra Cafe") >= 45

    def test_token_reorder_high(self):
        from intelligence import compute_name_similarity
        assert compute_name_similarity("CAFE OSEBRO", "Osebro Cafe") >= 40

    def test_no_overlap_lower_than_perfect(self):
        from intelligence import compute_name_similarity
        none = compute_name_similarity("CAFE LEA AS", "Røra Cafe")
        perf = compute_name_similarity("RØRA CAFE AS", "Røra Cafe")
        assert none < perf

    def test_returns_in_range(self):
        from intelligence import compute_name_similarity
        score = compute_name_similarity("RØRA CAFE AS", "Røra Cafe")
        assert 0 <= score <= 50


class TestScoreBrregCandidate:
    def _entity(self, navn, form="AS", nace="56.101", poststed="PORSGRUNN",
                konkurs=False, avvikling=False):
        return {
            "navn": navn,
            "organisasjonsform": {"kode": form},
            "naeringskode1": {"kode": nace},
            "forretningsadresse": {"poststed": poststed},
            "konkurs": konkurs,
            "underAvvikling": avvikling,
        }

    def test_perfect_match_high(self):
        from intelligence import score_brreg_candidate
        score = score_brreg_candidate(
            self._entity("RØRA CAFE AS"), "Røra Cafe", "Porsgrunn", "restaurant"
        )
        assert score >= 80

    def test_wrong_city_loses_30(self):
        from intelligence import score_brreg_candidate
        perfect = score_brreg_candidate(
            self._entity("RØRA CAFE AS"), "Røra Cafe", "Porsgrunn", "restaurant"
        )
        wrong = score_brreg_candidate(
            self._entity("RØRA CAFE AS", poststed="OSLO"),
            "Røra Cafe", "Porsgrunn", "restaurant",
        )
        assert abs((perfect - wrong) - 30) < 1

    def test_wrong_industry_loses_15(self):
        from intelligence import score_brreg_candidate
        perfect = score_brreg_candidate(
            self._entity("RØRA CAFE AS"), "Røra Cafe", "Porsgrunn", "restaurant"
        )
        wrong = score_brreg_candidate(
            self._entity("RØRA CAFE AS", nace="47.110"),
            "Røra Cafe", "Porsgrunn", "restaurant",
        )
        assert abs((perfect - wrong) - 15) < 1

    def test_non_commercial_form_penalized(self):
        from intelligence import score_brreg_candidate
        score = score_brreg_candidate(
            self._entity("RØRA BÅTFORENING", form="FLI", nace="94.992", poststed="INDERØY"),
            "Røra Cafe", "Porsgrunn", "restaurant",
        )
        # Wrong city, wrong industry, FLI penalty — should be very low
        assert score < 30

    def test_bankrupt_negative(self):
        from intelligence import score_brreg_candidate
        score = score_brreg_candidate(
            self._entity("RØRA CAFE AS", konkurs=True),
            "Røra Cafe", "Porsgrunn", "restaurant",
        )
        assert score < 0

    def test_avvikling_negative(self):
        from intelligence import score_brreg_candidate
        score = score_brreg_candidate(
            self._entity("RØRA CAFE AS", avvikling=True),
            "Røra Cafe", "Porsgrunn", "restaurant",
        )
        assert score < 0

    def test_no_industry_no_industry_bonus(self):
        from intelligence import score_brreg_candidate
        with_ind = score_brreg_candidate(
            self._entity("RØRA CAFE AS"), "Røra Cafe", "Porsgrunn", "restaurant"
        )
        without = score_brreg_candidate(
            self._entity("RØRA CAFE AS"), "Røra Cafe", "Porsgrunn", None
        )
        assert without < with_ind


class TestIndustryNaceMap:
    def test_required_industries_present(self):
        from intelligence import INDUSTRY_NACE_MAP
        for ind in ["restaurant", "cafe", "bar", "hotel", "catering", "fast_food", "retail", "other"]:
            assert ind in INDUSTRY_NACE_MAP

    def test_restaurant_uses_5610_prefix(self):
        from intelligence import INDUSTRY_NACE_MAP
        assert any(p.startswith("56.10") for p in INDUSTRY_NACE_MAP["restaurant"])


@pytest.mark.asyncio
async def test_smart_brreg_search_returns_places_match_key():
    """Response always contains placesMatch key, even when not configured."""
    from intelligence import smart_brreg_search
    result = await smart_brreg_search("Cafe Osebro", "Porsgrunn", "restaurant")
    assert "candidates" in result
    assert "needOrgNumber" in result
    assert "placesMatch" in result


@pytest.mark.asyncio
async def test_smart_brreg_search_empty_input_needs_org():
    from intelligence import smart_brreg_search
    result = await smart_brreg_search("", "Oslo", "restaurant")
    assert result["needOrgNumber"] is True
    assert result["candidates"] == []


@pytest.mark.asyncio
async def test_smart_brreg_search_short_input_needs_org():
    from intelligence import smart_brreg_search
    result = await smart_brreg_search("A", "Oslo", None)
    assert result["needOrgNumber"] is True


@pytest.mark.asyncio
async def test_lookup_brreg_by_org_invalid_length():
    from intelligence import lookup_brreg_by_org
    assert await lookup_brreg_by_org("12345") is None
    assert await lookup_brreg_by_org("") is None


@pytest.mark.asyncio
async def test_lookup_brreg_by_org_strips_spaces():
    """Cleaning-only path — does not require live BRREG when len mismatches."""
    from intelligence import lookup_brreg_by_org
    # 8-digit input (with space) → fails length check, returns None
    assert await lookup_brreg_by_org("12 345 678") is None
