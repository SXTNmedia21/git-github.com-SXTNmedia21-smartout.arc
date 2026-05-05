"""lead_research.py — Google Places v1 hospitality search pipeline.

Searches for hospitality businesses in a Norwegian city using Google Places
Text Search API (v1), fetches per-place details, and scrapes email from
each result's website.

Endpoint: POST /hospitality-search  (registered in main.py)

Pipeline:
  1. POST places:searchText — 1 API call ($0.005), returns up to 60 place IDs
  2. GET places/{id}        — N calls ($0.017 each) with fieldmask for rich data
  3. Email scrape           — per result's websiteUri (best-effort, no extra cost)

Google Places API v1 docs:
  https://developers.google.com/maps/documentation/places/web-service/text-search
  https://developers.google.com/maps/documentation/places/web-service/place-details

Authentication: GOOGLE_PLACES_API_KEY env var (server-side only, never exposed).

GDPR note: This endpoint aggregates PUBLICLY LISTED business data from Google
(business name, address, phone, website). It is NOT processing personal data
under GDPR Art 6 as long as the output is used for B2B prospect research only.
The BFF capability layer enforces this via toolAuthPattern="direct_admin".
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
from typing import Optional

import aiohttp

logger = logging.getLogger("scrapling.lead_research")

GOOGLE_PLACES_API_KEY = os.environ.get("GOOGLE_PLACES_API_KEY")

PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
PLACES_DETAILS_URL = "https://places.googleapis.com/v1/places/{}"

# Field mask for Text Search (returns place IDs for the batch)
SEARCH_FIELD_MASK = "places.id,places.displayName,places.formattedAddress"

# Field mask for Place Details (fetched per place)
DETAILS_FIELD_MASK = (
    "id,displayName,formattedAddress,internationalPhoneNumber,"
    "websiteUri,primaryType,types,rating,userRatingCount,priceLevel,editorialSummary"
)

PRICE_MAP = {
    "PRICE_LEVEL_FREE": "gratis",
    "PRICE_LEVEL_INEXPENSIVE": "budget",
    "PRICE_LEVEL_MODERATE": "moderate",
    "PRICE_LEVEL_EXPENSIVE": "premium",
    "PRICE_LEVEL_VERY_EXPENSIVE": "fine_dining",
}

# Google Places types that map to hospitality.
# Used to filter out non-hospitality types from the results.
HOSPITALITY_TYPES = {
    "restaurant",
    "bar",
    "cafe",
    "bakery",
    "pub",
    "night_club",
    "food_court",
    "seafood_restaurant",
    "fine_dining_restaurant",
    "fast_food_restaurant",
    "pizza_restaurant",
    "sushi_restaurant",
    "steak_house",
    "coffee_shop",
    "wine_bar",
    "cocktail_bar",
    "juice_bar",
    "ice_cream_shop",
    "sandwich_shop",
    "hamburger_restaurant",
    "ramen_restaurant",
    "vegetarian_restaurant",
    "vegan_restaurant",
    "buffet_restaurant",
    "brunch_restaurant",
    "breakfast_restaurant",
}

# Human-readable label from API types[] list → simplified form
TYPE_LABEL_MAP = {
    "restaurant": "restaurant",
    "bar": "bar",
    "cafe": "kafé",
    "bakery": "bakeri",
    "pub": "bar",
    "night_club": "nattklubb",
    "food_court": "matkjøpesenter",
    "seafood_restaurant": "sjømat",
    "fine_dining_restaurant": "fine dining",
    "fast_food_restaurant": "hurtigmat",
    "pizza_restaurant": "pizza",
    "sushi_restaurant": "sushi",
    "steak_house": "steak",
    "coffee_shop": "kafé",
    "wine_bar": "vinbar",
    "cocktail_bar": "cocktailbar",
    "hamburger_restaurant": "burger",
    "ramen_restaurant": "ramen",
    "vegetarian_restaurant": "vegetar",
    "vegan_restaurant": "vegansk",
}

# Email placeholder patterns that should be filtered out
EMAIL_PLACEHOLDER_PATTERNS = [
    r"^user@domain\.",
    r"^bruker@domene\.",
    r"^example@",
    r"^din\.epost@",
    r"@example\.",
    r"@test\.",
    r"noreply@",
    r"no-reply@",
    r"donotreply@",
]

# Business email prefixes ordered by preference
PREFERRED_EMAIL_PREFIXES = [
    "post", "kontakt", "info", "booking", "hello",
    "hei", "reservation", "reservasjon", "bestilling",
    "service", "support", "firmapost",
]


def _filter_email(email: str) -> bool:
    """Return True if email passes GDPR placeholder + personal-account filters."""
    email_lower = email.lower()
    for pattern in EMAIL_PLACEHOLDER_PATTERNS:
        if re.search(pattern, email_lower):
            return False
    return True


def _extract_email_from_html(html_str: str) -> Optional[str]:
    """Extract business email from raw HTML. Prefers business prefixes."""
    # Find all mailto: links first — most reliable
    mailto_matches = re.findall(
        r'mailto:([a-zA-Z0-9_.+%-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)',
        html_str,
        re.IGNORECASE,
    )
    # Then find bare emails in visible text
    bare_matches = re.findall(
        r'\b([a-zA-Z0-9_.+%-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)\b',
        html_str,
        re.IGNORECASE,
    )

    all_candidates = mailto_matches + bare_matches

    # Filter out placeholders
    valid = [e for e in all_candidates if _filter_email(e)]
    if not valid:
        return None

    # Prefer business prefixes
    for prefix in PREFERRED_EMAIL_PREFIXES:
        for e in valid:
            local = e.split("@")[0].lower()
            if local == prefix or local.startswith(prefix + ".") or local.startswith(prefix + "+"):
                return e

    return valid[0]


async def _scrape_email(session: aiohttp.ClientSession, url: str) -> str:
    """Best-effort email extraction from a website. Returns "" on any failure."""
    if not url:
        return ""
    # Ensure https prefix
    target = url if url.startswith("http") else f"https://{url}"
    try:
        async with session.get(
            target,
            timeout=aiohttp.ClientTimeout(total=8),
            allow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; SmartoutBot/1.0)"},
        ) as resp:
            if resp.status != 200:
                return ""
            # Limit to 500KB to avoid large pages
            content = await resp.read()
            html = content[:500_000].decode("utf-8", errors="replace")
            return _extract_email_from_html(html) or ""
    except Exception as e:
        logger.debug(f"[lead_research] Email scrape failed for {url}: {e}")
        return ""


async def _places_search(
    session: aiohttp.ClientSession,
    text_query: str,
    max_results: int,
) -> list[str]:
    """Call places:searchText and return a list of place IDs."""
    if not GOOGLE_PLACES_API_KEY:
        logger.warning("[lead_research] GOOGLE_PLACES_API_KEY not set — cannot search")
        return []

    payload = {
        "textQuery": text_query,
        "maxResultCount": min(max_results, 20),  # API max per page is 20
        "languageCode": "no",
        "regionCode": "NO",
    }
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": SEARCH_FIELD_MASK,
    }

    all_ids: list[str] = []
    next_page_token: Optional[str] = None

    # Paginate to collect up to max_results (API max 60 = 3 pages × 20)
    remaining = max_results
    while remaining > 0:
        if next_page_token:
            payload["pageToken"] = next_page_token
            payload["maxResultCount"] = min(remaining, 20)

        try:
            async with session.post(
                PLACES_SEARCH_URL,
                json=payload,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=15),
            ) as resp:
                if resp.status == 429:
                    logger.warning("[lead_research] Google Places quota exceeded (429)")
                    break
                if resp.status != 200:
                    body = await resp.text()
                    logger.error(f"[lead_research] Places search {resp.status}: {body[:200]}")
                    break
                data = await resp.json()
        except Exception as e:
            logger.error(f"[lead_research] Places search failed: {e}")
            break

        places = data.get("places", [])
        for p in places:
            place_id = p.get("id")
            if place_id:
                all_ids.append(place_id)

        next_page_token = data.get("nextPageToken")
        remaining -= len(places)

        # No more pages
        if not next_page_token or not places:
            break

    return all_ids[:max_results]


async def _places_details(
    session: aiohttp.ClientSession,
    place_id: str,
) -> Optional[dict]:
    """Fetch rich details for a single place ID."""
    if not GOOGLE_PLACES_API_KEY:
        return None

    url = PLACES_DETAILS_URL.format(place_id)
    headers = {
        "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": DETAILS_FIELD_MASK,
    }
    try:
        async with session.get(
            url,
            headers=headers,
            timeout=aiohttp.ClientTimeout(total=10),
        ) as resp:
            if resp.status == 429:
                logger.warning(f"[lead_research] Places details quota exceeded (429) for {place_id}")
                return None
            if resp.status != 200:
                logger.warning(f"[lead_research] Places details {resp.status} for {place_id}")
                return None
            return await resp.json()
    except Exception as e:
        logger.error(f"[lead_research] Places details failed for {place_id}: {e}")
        return None


def _parse_place_details(details: dict) -> dict:
    """Parse a Place Details response into our canonical shape."""
    name = (details.get("displayName") or {}).get("text", "")
    address = details.get("formattedAddress", "")
    phone = details.get("internationalPhoneNumber", "")
    website = details.get("websiteUri", "")
    primary_type = details.get("primaryType", "")
    rating = details.get("rating")
    reviews = details.get("userRatingCount")
    price_level_raw = details.get("priceLevel", "")
    price_level = PRICE_MAP.get(price_level_raw)

    return {
        "name": name,
        "address": address,
        "phone": phone,
        "email": "",  # filled by email scrape
        "website": website,
        "primary_type": TYPE_LABEL_MAP.get(primary_type, primary_type),
        "price_level": price_level,
        "rating": float(rating) if rating is not None else None,
        "reviews": int(reviews) if reviews is not None else None,
    }


async def search_hospitality_businesses(
    city: str,
    types: list[str],
    limit: int,
) -> dict:
    """Main pipeline: search → details → email scrape.

    Returns:
      {
        "results": [...],
        "total": N,
        "estimated_cost_usd": float,
        "city": str,
      }
    """
    if not GOOGLE_PLACES_API_KEY:
        return {
            "results": [],
            "total": 0,
            "estimated_cost_usd": 0.0,
            "city": city,
            "error": "GOOGLE_PLACES_API_KEY not configured on the server.",
        }

    # Build Google Places query for the types requested
    # Map our capability types to Norwegian place type names Google recognises
    type_query_map = {
        "restaurant": "restaurant",
        "bar": "bar",
        "cafe": "kafé OR cafe",
        "bakery": "bakeri",
        "pub": "pub",
        "nightlife": "nattklubb OR utested",
        "food_court": "matkjøpesenter",
        "seafood_restaurant": "sjømatrestaurant",
        "fine_dining_restaurant": "fine dining restaurant",
    }
    type_labels = [type_query_map.get(t, t) for t in (types or ["restaurant"])]
    # Build a single text query: "restaurant OR bar i Oslo"
    type_phrase = " OR ".join(type_labels) if len(type_labels) > 1 else type_labels[0]
    text_query = f"{type_phrase} i {city}"

    logger.info(
        f"[lead_research] search_hospitality_businesses city={city} "
        f"types={types} limit={limit} query='{text_query}'"
    )

    async with aiohttp.ClientSession() as session:
        # Phase 1: get place IDs
        place_ids = await _places_search(session, text_query, limit)

        if not place_ids:
            return {"results": [], "total": 0, "estimated_cost_usd": 0.0, "city": city}

        # Phase 2: fetch details for each place (concurrently, max 5 at a time)
        sem = asyncio.Semaphore(5)

        async def fetch_with_sem(pid: str) -> Optional[dict]:
            async with sem:
                return await _places_details(session, pid)

        details_list = await asyncio.gather(*[fetch_with_sem(pid) for pid in place_ids])

        # Phase 3: parse + email scrape (concurrently)
        parsed_places: list[dict] = []
        for d in details_list:
            if d is None:
                continue
            parsed = _parse_place_details(d)
            parsed_places.append(parsed)

        async def scrape_with_sem(place: dict) -> dict:
            async with sem:
                if place.get("website"):
                    place["email"] = await _scrape_email(session, place["website"])
                return place

        enriched = await asyncio.gather(*[scrape_with_sem(p) for p in parsed_places])

    results = [r for r in enriched if r.get("name")]

    # Cost estimate: $0.005 search + ($0.017 × N details) + $0 email scrape
    search_cost = 0.005
    details_cost = 0.017 * len(place_ids)
    estimated_cost = search_cost + details_cost

    logger.info(
        f"[lead_research] Done city={city} results={len(results)} "
        f"estimated_cost_usd={estimated_cost:.4f}"
    )

    return {
        "results": results,
        "total": len(results),
        "estimated_cost_usd": round(estimated_cost, 4),
        "city": city,
    }
