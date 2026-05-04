"""Tests for Google-first enrich_from_places refactor (Phase 2).

Covers:
  - _parse_google_places_details mapping (rating, reviews, address,
    primaryType, types[] cuisine + concept, priceLevel, editorialSummary)
  - 4-bucket priceLevel enum coverage
  - 26-keyword cuisine map subset (italian, sushi, ramen, mexican, etc.)
  - editorialSummary length guard (>=30 chars)
  - enrich_from_places provider dispatch:
      * GOOGLE_PLACES_API_KEY set + 200 → Google path used
      * GOOGLE_PLACES_API_KEY set + 429 → falls through to Serper
      * GOOGLE_PLACES_API_KEY set + 5xx → falls through to Serper
      * GOOGLE_PLACES_API_KEY missing → Serper-only path
  - sources.places.provider field for provenance
"""
from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ─── Pure mapping tests for _parse_google_places_details ──────────────────────


class TestParseGooglePlacesDetails:
    def _details(self, **overrides: Any) -> dict:
        base: dict[str, Any] = {
            "id": "ChIJabc123",
            "displayName": {"text": "Bistro Oslo"},
            "formattedAddress": "Karl Johans gate 1, 0154 Oslo, Norway",
            "primaryType": "italian_restaurant",
            "types": ["italian_restaurant", "restaurant", "food", "point_of_interest"],
            "rating": 4.4,
            "userRatingCount": 521,
            "priceLevel": "PRICE_LEVEL_MODERATE",
            "editorialSummary": {
                "text": "Klassisk italiensk bistro i hjertet av Oslo med pasta og pizza."
            },
        }
        base.update(overrides)
        return base

    def test_maps_rating_as_float(self):
        from intelligence import _parse_google_places_details
        r = _parse_google_places_details(self._details())
        assert r["google_rating"] == 4.4
        assert isinstance(r["google_rating"], float)

    def test_maps_review_count_as_int(self):
        from intelligence import _parse_google_places_details
        r = _parse_google_places_details(self._details())
        assert r["google_review_count"] == 521
        assert isinstance(r["google_review_count"], int)

    def test_maps_address(self):
        from intelligence import _parse_google_places_details
        r = _parse_google_places_details(self._details())
        assert r["address"] == "Karl Johans gate 1, 0154 Oslo, Norway"

    def test_maps_primary_type_as_google_category(self):
        from intelligence import _parse_google_places_details
        r = _parse_google_places_details(self._details())
        assert r["google_category"] == "italian_restaurant"

    def test_maps_cuisine_from_primary_type(self):
        from intelligence import _parse_google_places_details
        r = _parse_google_places_details(self._details())
        assert "Italiensk" in r["cuisine_types"]

    def test_concept_clue_includes_restaurant(self):
        from intelligence import _parse_google_places_details
        r = _parse_google_places_details(self._details())
        # primary "italian_restaurant" not in concept map; "restaurant" in types[] is
        assert "restaurant" in r["concept_clues"]

    def test_price_level_moderate_to_moderate(self):
        from intelligence import _parse_google_places_details
        r = _parse_google_places_details(self._details(priceLevel="PRICE_LEVEL_MODERATE"))
        assert r["price_category"] == "moderate"

    def test_price_level_inexpensive_to_budget(self):
        from intelligence import _parse_google_places_details
        r = _parse_google_places_details(self._details(priceLevel="PRICE_LEVEL_INEXPENSIVE"))
        assert r["price_category"] == "budget"

    def test_price_level_free_to_budget(self):
        from intelligence import _parse_google_places_details
        r = _parse_google_places_details(self._details(priceLevel="PRICE_LEVEL_FREE"))
        assert r["price_category"] == "budget"

    def test_price_level_expensive_to_premium(self):
        from intelligence import _parse_google_places_details
        r = _parse_google_places_details(self._details(priceLevel="PRICE_LEVEL_EXPENSIVE"))
        assert r["price_category"] == "premium"

    def test_price_level_very_expensive_to_fine_dining(self):
        from intelligence import _parse_google_places_details
        r = _parse_google_places_details(self._details(priceLevel="PRICE_LEVEL_VERY_EXPENSIVE"))
        assert r["price_category"] == "fine_dining"

    def test_missing_price_level_omits_field(self):
        from intelligence import _parse_google_places_details
        details = self._details()
        del details["priceLevel"]
        r = _parse_google_places_details(details)
        assert "price_category" not in r

    def test_missing_rating_omits_field(self):
        from intelligence import _parse_google_places_details
        details = self._details()
        del details["rating"]
        r = _parse_google_places_details(details)
        assert "google_rating" not in r

    def test_editorial_summary_seeds_menu_description(self):
        from intelligence import _parse_google_places_details
        r = _parse_google_places_details(self._details())
        assert "menu_description" in r
        assert "italiensk bistro" in r["menu_description"]

    def test_editorial_summary_below_30_chars_omitted(self):
        from intelligence import _parse_google_places_details
        r = _parse_google_places_details(
            self._details(editorialSummary={"text": "Short."})
        )
        assert "menu_description" not in r

    def test_editorial_summary_missing_omitted(self):
        from intelligence import _parse_google_places_details
        details = self._details()
        del details["editorialSummary"]
        r = _parse_google_places_details(details)
        assert "menu_description" not in r

    def test_sources_marks_provider_google(self):
        from intelligence import _parse_google_places_details
        r = _parse_google_places_details(self._details())
        assert r["sources"]["places"]["provider"] == "google"

    def test_sources_includes_matched_title(self):
        from intelligence import _parse_google_places_details
        r = _parse_google_places_details(self._details())
        assert r["sources"]["places"]["matched_title"] == "Bistro Oslo"

    def test_sushi_restaurant_maps_to_japansk(self):
        from intelligence import _parse_google_places_details
        r = _parse_google_places_details(
            self._details(primaryType="sushi_restaurant", types=["sushi_restaurant"])
        )
        assert "Japansk" in r["cuisine_types"]

    def test_steak_house_maps_to_steak(self):
        from intelligence import _parse_google_places_details
        r = _parse_google_places_details(
            self._details(primaryType="steak_house", types=["steak_house"])
        )
        assert "Steak" in r["cuisine_types"]

    def test_vegan_restaurant_maps_to_vegansk(self):
        from intelligence import _parse_google_places_details
        r = _parse_google_places_details(
            self._details(primaryType="vegan_restaurant", types=["vegan_restaurant"])
        )
        assert "Vegansk" in r["cuisine_types"]

    def test_unknown_primary_type_passes_through_to_category(self):
        from intelligence import _parse_google_places_details
        r = _parse_google_places_details(
            self._details(primaryType="custom_unmapped_type", types=["custom_unmapped_type"])
        )
        assert r["google_category"] == "custom_unmapped_type"
        # No cuisine label produced for unknown type
        assert "cuisine_types" not in r or "custom_unmapped_type" not in r["cuisine_types"]

    def test_cocktail_bar_concept_clue(self):
        from intelligence import _parse_google_places_details
        r = _parse_google_places_details(
            self._details(primaryType="cocktail_bar", types=["cocktail_bar", "bar"])
        )
        # cocktail_bar maps directly; bar also maps but dedup keeps unique
        assert "cocktailbar" in r["concept_clues"]

    def test_cuisine_dedup_no_duplicates(self):
        from intelligence import _parse_google_places_details
        # Same cuisine appears in primary and types[] — should appear once
        r = _parse_google_places_details(
            self._details(
                primaryType="japanese_restaurant",
                types=["japanese_restaurant", "sushi_restaurant"],
            )
        )
        assert r["cuisine_types"].count("Japansk") == 1


# ─── enrich_from_places provider routing tests ───────────────────────────────


def _mock_aiohttp_session(post_responses=None, get_responses=None):
    """Build an AsyncMock ClientSession with queued post + get responses.

    Each response is a dict with: status, json (callable returning dict), text
    (callable returning str). aiohttp uses async context managers for both
    session and response, hence the nested AsyncMock setup.
    """
    post_responses = post_responses or []
    get_responses = get_responses or []

    def _build_response(spec: dict) -> MagicMock:
        resp = MagicMock()
        resp.status = spec.get("status", 200)
        resp.json = AsyncMock(return_value=spec.get("json", {}))
        resp.text = AsyncMock(return_value=spec.get("text", ""))
        # async context manager
        resp.__aenter__ = AsyncMock(return_value=resp)
        resp.__aexit__ = AsyncMock(return_value=False)
        return resp

    session = MagicMock()
    session.__aenter__ = AsyncMock(return_value=session)
    session.__aexit__ = AsyncMock(return_value=False)
    session.post = MagicMock(side_effect=[_build_response(s) for s in post_responses])
    session.get = MagicMock(side_effect=[_build_response(s) for s in get_responses])
    return session


@pytest.mark.asyncio
async def test_enrich_uses_google_when_key_set():
    """GOOGLE_PLACES_API_KEY set + 200 OK on both calls → Google path used."""
    import intelligence

    google_search_resp = {
        "status": 200,
        "json": {"places": [{"id": "ChIJoslo123", "displayName": {"text": "Bistro Oslo"}}]},
    }
    google_details_resp = {
        "status": 200,
        "json": {
            "id": "ChIJoslo123",
            "displayName": {"text": "Bistro Oslo"},
            "formattedAddress": "Storgata 1, 0155 Oslo",
            "primaryType": "italian_restaurant",
            "types": ["italian_restaurant", "restaurant"],
            "rating": 4.5,
            "userRatingCount": 200,
            "priceLevel": "PRICE_LEVEL_MODERATE",
        },
    }

    mock_session = _mock_aiohttp_session(
        post_responses=[google_search_resp],
        get_responses=[google_details_resp],
    )
    mock_client_session = MagicMock(return_value=mock_session)

    with patch.object(intelligence, "GOOGLE_PLACES_API_KEY", "test_google_key"):
        with patch.object(intelligence.aiohttp, "ClientSession", mock_client_session):
            result = await intelligence.enrich_from_places("Bistro Oslo", "Oslo")

    assert result["sources"]["places"]["provider"] == "google"
    assert result["price_category"] == "moderate"
    assert "Italiensk" in result["cuisine_types"]
    assert result["google_rating"] == 4.5


@pytest.mark.asyncio
async def test_enrich_falls_back_to_serper_on_429():
    """Google returns 429 → fall through to Serper branch."""
    import intelligence

    google_search_429 = {"status": 429, "text": "RESOURCE_EXHAUSTED"}
    serper_resp = {
        "status": 200,
        "json": {
            "places": [
                {
                    "title": "Bistro Oslo",
                    "rating": 4.0,
                    "ratingCount": 100,
                    "category": "Restaurant",
                    "address": "Oslo",
                }
            ]
        },
    }

    mock_session = _mock_aiohttp_session(
        post_responses=[google_search_429, serper_resp],
    )
    mock_client_session = MagicMock(return_value=mock_session)

    with patch.object(intelligence, "GOOGLE_PLACES_API_KEY", "test_google_key"):
        with patch.object(intelligence, "SERPER_API_KEY", "test_serper_key"):
            with patch.object(intelligence.aiohttp, "ClientSession", mock_client_session):
                result = await intelligence.enrich_from_places("Bistro Oslo", "Oslo")

    assert result["sources"]["places"]["provider"] == "serper"
    assert result["google_rating"] == 4.0


@pytest.mark.asyncio
async def test_enrich_falls_back_to_serper_on_5xx():
    """Google returns 503 → fall through to Serper."""
    import intelligence

    google_search_503 = {"status": 503, "text": "service unavailable"}
    serper_resp = {
        "status": 200,
        "json": {
            "places": [
                {
                    "title": "Cafe Bergen",
                    "rating": 4.2,
                    "ratingCount": 50,
                    "category": "Café",
                    "address": "Bergen",
                }
            ]
        },
    }

    mock_session = _mock_aiohttp_session(
        post_responses=[google_search_503, serper_resp],
    )
    mock_client_session = MagicMock(return_value=mock_session)

    with patch.object(intelligence, "GOOGLE_PLACES_API_KEY", "test_google_key"):
        with patch.object(intelligence, "SERPER_API_KEY", "test_serper_key"):
            with patch.object(intelligence.aiohttp, "ClientSession", mock_client_session):
                result = await intelligence.enrich_from_places("Cafe Bergen", "Bergen")

    assert result["sources"]["places"]["provider"] == "serper"


@pytest.mark.asyncio
async def test_enrich_uses_serper_when_no_google_key():
    """No GOOGLE_PLACES_API_KEY → Serper-only path (no Google call attempted)."""
    import intelligence

    serper_resp = {
        "status": 200,
        "json": {
            "places": [
                {
                    "title": "Pub Trondheim",
                    "rating": 3.8,
                    "ratingCount": 30,
                    "category": "Pub",
                    "address": "Trondheim",
                }
            ]
        },
    }
    mock_session = _mock_aiohttp_session(post_responses=[serper_resp])
    mock_client_session = MagicMock(return_value=mock_session)

    with patch.object(intelligence, "GOOGLE_PLACES_API_KEY", None):
        with patch.object(intelligence, "SERPER_API_KEY", "test_serper_key"):
            with patch.object(intelligence.aiohttp, "ClientSession", mock_client_session):
                result = await intelligence.enrich_from_places("Pub Trondheim", "Trondheim")

    assert result["sources"]["places"]["provider"] == "serper"
    # Should have called Serper once, not Google
    assert mock_session.post.call_count == 1


@pytest.mark.asyncio
async def test_enrich_returns_empty_when_no_keys():
    """Neither key set → returns empty dict, no API calls."""
    import intelligence

    with patch.object(intelligence, "GOOGLE_PLACES_API_KEY", None):
        with patch.object(intelligence, "SERPER_API_KEY", None):
            result = await intelligence.enrich_from_places("Test", "Oslo")

    assert result == {}
