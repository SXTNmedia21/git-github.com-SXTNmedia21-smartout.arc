"""Tests for /hospitality-search endpoint and lead_research.py pipeline."""
from __future__ import annotations

import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ─── Unit tests for lead_research helpers ─────────────────────────────────────

class TestEmailFiltering:
    def test_filters_placeholder_user_at_domain(self):
        from lead_research import _filter_email
        assert _filter_email("user@domain.com") is False

    def test_filters_placeholder_bruker_at_domene(self):
        from lead_research import _filter_email
        assert _filter_email("bruker@domene.no") is False

    def test_filters_noreply(self):
        from lead_research import _filter_email
        assert _filter_email("noreply@restaurant.no") is False

    def test_accepts_business_email(self):
        from lead_research import _filter_email
        assert _filter_email("post@restaurant.no") is True

    def test_accepts_kontakt_email(self):
        from lead_research import _filter_email
        assert _filter_email("kontakt@mat.no") is True

    def test_accepts_info_email(self):
        from lead_research import _filter_email
        assert _filter_email("info@example-restaurant.no") is True


class TestExtractEmailFromHtml:
    def test_extracts_mailto_first(self):
        from lead_research import _extract_email_from_html
        html = '<a href="mailto:post@myplace.no">Kontakt oss</a>'
        assert _extract_email_from_html(html) == "post@myplace.no"

    def test_prefers_business_prefix_over_first(self):
        from lead_research import _extract_email_from_html
        html = "john.doe@restaurant.no og booking@restaurant.no"
        result = _extract_email_from_html(html)
        assert result == "booking@restaurant.no"

    def test_returns_none_when_no_emails(self):
        from lead_research import _extract_email_from_html
        assert _extract_email_from_html("ingen epost her") is None

    def test_filters_placeholder_from_text(self):
        from lead_research import _extract_email_from_html
        html = "Ring oss eller skriv til user@domain.com"
        assert _extract_email_from_html(html) is None


class TestParsePlaceDetails:
    def _make_details(self, **overrides: Any) -> dict:
        base: dict[str, Any] = {
            "id": "ChIJabc123",
            "displayName": {"text": "Restaurant Oslo"},
            "formattedAddress": "Storgata 1, 0155 Oslo, Norway",
            "internationalPhoneNumber": "+47 22 33 44 55",
            "websiteUri": "https://restaurantoslo.no",
            "primaryType": "restaurant",
            "types": ["restaurant", "food", "point_of_interest"],
            "rating": 4.2,
            "userRatingCount": 312,
            "priceLevel": "PRICE_LEVEL_MODERATE",
        }
        base.update(overrides)
        return base

    def test_parses_name(self):
        from lead_research import _parse_place_details
        r = _parse_place_details(self._make_details())
        assert r["name"] == "Restaurant Oslo"

    def test_parses_address(self):
        from lead_research import _parse_place_details
        r = _parse_place_details(self._make_details())
        assert r["address"] == "Storgata 1, 0155 Oslo, Norway"

    def test_parses_phone(self):
        from lead_research import _parse_place_details
        r = _parse_place_details(self._make_details())
        assert r["phone"] == "+47 22 33 44 55"

    def test_maps_price_level_moderate(self):
        from lead_research import _parse_place_details
        r = _parse_place_details(self._make_details(priceLevel="PRICE_LEVEL_MODERATE"))
        assert r["price_level"] == "moderate"

    def test_maps_price_level_inexpensive(self):
        from lead_research import _parse_place_details
        r = _parse_place_details(self._make_details(priceLevel="PRICE_LEVEL_INEXPENSIVE"))
        assert r["price_level"] == "budget"

    def test_maps_price_level_expensive(self):
        from lead_research import _parse_place_details
        r = _parse_place_details(self._make_details(priceLevel="PRICE_LEVEL_EXPENSIVE"))
        assert r["price_level"] == "premium"

    def test_maps_price_level_very_expensive(self):
        from lead_research import _parse_place_details
        r = _parse_place_details(self._make_details(priceLevel="PRICE_LEVEL_VERY_EXPENSIVE"))
        assert r["price_level"] == "fine_dining"

    def test_maps_primary_type_restaurant(self):
        from lead_research import _parse_place_details
        r = _parse_place_details(self._make_details(primaryType="restaurant"))
        assert r["primary_type"] == "restaurant"

    def test_maps_primary_type_cafe(self):
        from lead_research import _parse_place_details
        r = _parse_place_details(self._make_details(primaryType="cafe"))
        assert r["primary_type"] == "kafé"

    def test_maps_primary_type_unknown_passthrough(self):
        from lead_research import _parse_place_details
        r = _parse_place_details(self._make_details(primaryType="custom_type"))
        assert r["primary_type"] == "custom_type"

    def test_rating_is_float(self):
        from lead_research import _parse_place_details
        r = _parse_place_details(self._make_details(rating=4.2))
        assert isinstance(r["rating"], float)
        assert r["rating"] == 4.2

    def test_reviews_is_int(self):
        from lead_research import _parse_place_details
        r = _parse_place_details(self._make_details(userRatingCount=312))
        assert isinstance(r["reviews"], int)
        assert r["reviews"] == 312

    def test_missing_rating_is_none(self):
        from lead_research import _parse_place_details
        details = self._make_details()
        del details["rating"]
        r = _parse_place_details(details)
        assert r["rating"] is None

    def test_email_initialized_empty(self):
        from lead_research import _parse_place_details
        r = _parse_place_details(self._make_details())
        assert r["email"] == ""


# ─── Integration test for main /hospitality-search endpoint ───────────────────

@pytest.mark.asyncio
async def test_hospitality_search_endpoint_calls_pipeline():
    """Verify /hospitality-search wires to search_hospitality_businesses."""
    from fastapi.testclient import TestClient
    import os

    # Stub the pipeline to avoid real API calls
    mock_result = {
        "city": "Oslo",
        "results": [
            {
                "name": "Test Restaurant",
                "address": "Storgata 1, Oslo",
                "phone": "+47 22 11 33 44",
                "email": "post@test.no",
                "website": "https://test.no",
                "primary_type": "restaurant",
                "price_level": "moderate",
                "rating": 4.1,
                "reviews": 120,
            }
        ],
        "total": 1,
        "estimated_cost_usd": 0.022,
    }

    with patch("main.search_hospitality_businesses", new=AsyncMock(return_value=mock_result)):
        # Disable auth for this test
        with patch.dict(os.environ, {"SCRAPLING_AUTH_TOKEN": ""}, clear=False):
            from main import app
            client = TestClient(app)
            response = client.post(
                "/hospitality-search",
                json={"city": "Oslo", "types": ["restaurant"], "limit": 5},
            )

    assert response.status_code == 200
    data = response.json()
    assert data["city"] == "Oslo"
    assert data["total"] == 1
    assert len(data["results"]) == 1
    assert data["results"][0]["name"] == "Test Restaurant"
    assert data["results"][0]["price_level"] == "moderate"


@pytest.mark.asyncio
async def test_hospitality_search_rejects_empty_city():
    from fastapi.testclient import TestClient
    import os

    with patch.dict(os.environ, {"SCRAPLING_AUTH_TOKEN": ""}, clear=False):
        from main import app
        client = TestClient(app)
        response = client.post(
            "/hospitality-search",
            json={"city": "x", "types": ["restaurant"], "limit": 5},
        )

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_hospitality_search_rejects_limit_over_60():
    from fastapi.testclient import TestClient
    import os

    with patch.dict(os.environ, {"SCRAPLING_AUTH_TOKEN": ""}, clear=False):
        from main import app
        client = TestClient(app)
        response = client.post(
            "/hospitality-search",
            json={"city": "Oslo", "types": ["restaurant"], "limit": 99},
        )

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_hospitality_search_returns_503_when_no_api_key():
    """When GOOGLE_PLACES_API_KEY is not set, pipeline returns error dict."""
    from fastapi.testclient import TestClient
    import os

    error_result = {
        "results": [],
        "total": 0,
        "estimated_cost_usd": 0.0,
        "city": "Bergen",
        "error": "GOOGLE_PLACES_API_KEY not configured on the server.",
    }

    with patch("main.search_hospitality_businesses", new=AsyncMock(return_value=error_result)):
        with patch.dict(os.environ, {"SCRAPLING_AUTH_TOKEN": ""}, clear=False):
            from main import app
            client = TestClient(app)
            response = client.post(
                "/hospitality-search",
                json={"city": "Bergen", "types": ["bar"], "limit": 10},
            )

    assert response.status_code == 503
    assert "GOOGLE_PLACES_API_KEY" in response.json()["detail"]
