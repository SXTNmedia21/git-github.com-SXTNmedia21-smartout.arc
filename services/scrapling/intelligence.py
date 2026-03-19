"""
Workspace Intelligence — structured company data model, merge logic, and content generation.

This module powers the join wizard Step 3 content pipeline:
- WorkspaceIntelligence: the core data model (all fields nullable)
- merge_partial: safe merge of enrichment results (no overwrites, list dedup)
- compute_gaps: what data is still missing
- build_context: curated text block for the LLM prompt
- build_query_candidates / has_unused_queries: web search query management
"""

import json
import re
import logging
import asyncio
import os
from datetime import datetime
from typing import Optional

from pydantic import BaseModel

# These are used by downstream modules (enrich/generate endpoints),
# imported here so intelligence.py can be extended without extra imports.
# Guarded to allow standalone use (e.g. tests without full deps installed).
try:
    import aiohttp  # noqa: F401
except ImportError:
    aiohttp = None  # type: ignore[assignment]

try:
    from fastapi import Depends, HTTPException  # noqa: F401
except ImportError:
    pass

logger = logging.getLogger("scrapling.intelligence")


class WorkspaceIntelligence(BaseModel):
    # Identity (BRREG + user input)
    company_name: Optional[str] = None
    org_number: Optional[str] = None
    founding_date: Optional[str] = None
    years_in_business: Optional[int] = None
    industry: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None

    # Web presence (scrape)
    website_url: Optional[str] = None
    website_description: Optional[str] = None
    website_about_text: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    logo_url: Optional[str] = None
    social_links: dict[str, str] = {}
    menus: list[dict] = []
    reservation_url: Optional[str] = None

    # Web intelligence (Serper)
    google_rating: Optional[float] = None
    google_review_count: Optional[int] = None
    external_ratings: list[dict] = []
    news_articles: list[dict] = []
    web_mentions: list[str] = []
    seasonal_patterns: list[str] = []

    # Derived intelligence
    cuisine_types: list[str] = []
    price_range: Optional[str] = None
    concept_clues: list[str] = []

    # Source tracking
    sources: dict = {}


def merge_partial(intel: WorkspaceIntelligence, partial: dict) -> WorkspaceIntelligence:
    """Merge a partial enrichment result into the intelligence model.
    List fields are merged and deduplicated. Dict fields are deep-merged.
    Scalar fields are only set if currently None (first source wins)."""
    update = {}
    for key, value in partial.items():
        current = getattr(intel, key, None)
        if isinstance(current, list) and isinstance(value, list):
            merged = list(dict.fromkeys(current + value))
            update[key] = merged
        elif isinstance(current, dict) and isinstance(value, dict):
            update[key] = {**current, **value}
        elif current is None and value is not None:
            update[key] = value
    return intel.model_copy(update=update)


def compute_gaps(intel: WorkspaceIntelligence) -> list[str]:
    """Return list of missing data points. Empty list = fully enriched."""
    gaps = []
    if "web_search" not in intel.sources:
        gaps.append("web_search")
    if intel.founding_date is None:
        gaps.append("no_founding_date")
    if not intel.concept_clues:
        gaps.append("no_concept_clues")
    if not intel.cuisine_types:
        gaps.append("no_cuisine_types")
    if intel.google_rating is None:
        gaps.append("no_google_rating")
    return gaps


def build_query_candidates(company_name: str, city: Optional[str]) -> list[str]:
    """All possible search queries, ordered by priority."""
    queries = [
        f"{company_name} {city or ''}".strip(),
        f"{company_name} anmeldelse",
        f"{company_name} historie apnet",
        f"{company_name} konsept mat",
    ]
    if city:
        queries.append(f"{company_name} {city} restaurant")
    return queries


def has_unused_queries(intel: WorkspaceIntelligence, company_name: str, city: Optional[str]) -> bool:
    """Check if there are search queries we haven't tried yet."""
    ws = intel.sources.get("web_search", {})
    used = set(ws.get("queries_used", []))
    candidates = build_query_candidates(company_name, city)
    return any(q not in used for q in candidates)


def build_context(intel: WorkspaceIntelligence) -> str:
    """Build a curated text block from intelligence for the LLM prompt.
    Not a raw JSON dump — a human-readable summary of known facts."""
    lines: list[str] = []
    if intel.company_name:
        lines.append(f"Navn: {intel.company_name}")
    if intel.city:
        lines.append(f"By: {intel.city}")
    if intel.founding_date:
        years = f" ({intel.years_in_business} ar)" if intel.years_in_business else ""
        lines.append(f"Stiftet: {intel.founding_date}{years}")
    if intel.industry:
        lines.append(f"Bransje: {intel.industry}")
    if intel.cuisine_types:
        lines.append(f"Kjokken: {', '.join(intel.cuisine_types)}")
    if intel.price_range:
        lines.append(f"Priskategori: {intel.price_range}")
    if intel.concept_clues:
        lines.append(f"Konseptord: {', '.join(intel.concept_clues)}")
    if intel.website_description:
        lines.append(f"Nettside-beskrivelse: {intel.website_description}")
    if intel.website_about_text:
        about = intel.website_about_text[:500]
        lines.append(f"Fra 'Om oss'-siden: {about}")
    if intel.google_rating:
        rating_str = f"Google: {intel.google_rating}/5"
        if intel.google_review_count:
            rating_str += f" ({intel.google_review_count} anmeldelser)"
        lines.append(rating_str)
    if intel.external_ratings:
        for r in intel.external_ratings[:3]:
            lines.append(f"{r.get('source', '?')}: {r.get('rating', '?')}/5")
    if intel.news_articles:
        lines.append("Nevnt i media:")
        for a in intel.news_articles[:3]:
            lines.append(f"  - {a.get('title', '')}: {a.get('snippet', '')[:100]}")
    if intel.web_mentions:
        lines.append("Fra Google-resultater:")
        for m in intel.web_mentions[:3]:
            lines.append(f"  - {m[:150]}")
    if intel.seasonal_patterns:
        lines.append(f"Sesongaktiviteter: {', '.join(intel.seasonal_patterns)}")
    return "\n".join(lines)


def compute_years_in_business(founding_date: Optional[str]) -> Optional[int]:
    """Compute years since founding. Returns None if no date."""
    if not founding_date:
        return None
    try:
        year = datetime.fromisoformat(founding_date).year
        return datetime.now().year - year
    except (ValueError, TypeError):
        return None


# ── Constants for enrichment pipeline ────────────────────────────────

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")

BRREG_BASE = "https://data.brreg.no/enhetsregisteret/api"
SERPER_API_KEY = os.environ.get("SERPER_API_KEY")

RATING_SOURCES = {
    "tripadvisor.com": "TripAdvisor", "tripadvisor.no": "TripAdvisor",
    "yelp.com": "Yelp", "thefork.com": "TheFork", "thefork.no": "TheFork",
}

CONCEPT_KEYWORDS = [
    "fine dining", "casual dining", "fast food", "bistro", "brasserie", "gastropub",
    "sjomat", "seafood", "nordisk", "nordic", "italiensk", "italian", "asiatisk", "asian",
    "lokale ravarer", "sesong", "okologisk", "organic", "street food", "take away",
    "uteservering", "terrasse", "bar", "cocktail", "vin", "wine", "craft beer",
    "familievennlig", "romantisk", "koselig", "uformell",
]


# ── Enrichment functions ─────────────────────────────────────────────

async def enrich_from_brreg(
    org_number: Optional[str] = None,
    company_name: Optional[str] = None,
    city: Optional[str] = None,
) -> dict:
    """Fetch company data from BRREG (Bronnøysundregistrene).

    If org_number is provided, does a direct lookup.
    Otherwise searches by name and picks the best city match.
    Returns a partial dict suitable for merge_partial.
    """
    if not aiohttp:
        logger.warning("aiohttp not installed — skipping BRREG enrichment")
        return {}

    partial: dict = {}
    try:
        timeout = aiohttp.ClientTimeout(total=10)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            if org_number:
                url = f"{BRREG_BASE}/enheter/{org_number}"
                async with session.get(url) as resp:
                    if resp.status != 200:
                        logger.warning(f"BRREG lookup failed: {resp.status} for {org_number}")
                        return {}
                    data = await resp.json()
            else:
                if not company_name:
                    return {}
                url = f"{BRREG_BASE}/enheter"
                params = {"navn": company_name, "size": "5"}
                async with session.get(url, params=params) as resp:
                    if resp.status != 200:
                        logger.warning(f"BRREG search failed: {resp.status}")
                        return {}
                    result = await resp.json()

                units = result.get("_embedded", {}).get("enheter", [])
                if not units:
                    return {}

                # Pick best match: prefer city match, otherwise first result
                data = units[0]
                if city:
                    city_lower = city.lower()
                    for unit in units:
                        addr = unit.get("forretningsadresse", {})
                        if addr.get("poststed", "").lower() == city_lower:
                            data = unit
                            break

        # Extract fields from BRREG response
        founding = data.get("stiftelsesdato")
        if founding:
            partial["founding_date"] = founding
            years = compute_years_in_business(founding)
            if years is not None:
                partial["years_in_business"] = years

        addr = data.get("forretningsadresse", {})
        address_parts = addr.get("adresse", [])
        poststed = addr.get("poststed", "")
        postnummer = addr.get("postnummer", "")
        if address_parts or poststed:
            full_address = ", ".join([a for a in address_parts if a])
            if postnummer or poststed:
                full_address += f", {postnummer} {poststed}".strip()
            partial["address"] = full_address.strip(", ")

        if poststed and not city:
            partial["city"] = poststed

        # NACE industry code
        nace_list = data.get("naeringskode1", {})
        if nace_list:
            desc = nace_list.get("beskrivelse", "")
            if desc:
                partial["industry"] = desc

        extracted_org = data.get("organisasjonsnummer")
        if extracted_org:
            partial["org_number"] = str(extracted_org)

        partial["sources"] = {
            "brreg": {
                "fetched_at": datetime.utcnow().isoformat() + "Z",
            }
        }

    except Exception as e:
        logger.error(f"BRREG enrichment failed: {e}")

    return partial


def _scrape_website_sync(website_url: str) -> dict:
    """Synchronous website scrape — runs in thread pool via asyncio.to_thread.

    Extracts meta description, contact info, social links, menus,
    reservation URL, about text, concept clues, and cuisine types.
    """
    from main import fetch_with_fallback, clean_url
    import urllib.parse

    partial: dict = {}
    urls_scraped: list[str] = []

    try:
        target_url = clean_url(website_url)
        page = fetch_with_fallback(website_url)
        urls_scraped.append(target_url)

        # Meta description
        description = page.css("meta[name='description']::attr(content)").get("")
        if description:
            partial["website_description"] = description.strip()

        anchor_nodes = page.css("a")

        # Email (mailto links first, then regex)
        for a in anchor_nodes:
            href = a.attrib.get("href", "")
            if href.startswith("mailto:"):
                partial["email"] = href.replace("mailto:", "").split("?")[0].strip()
                break
        if "email" not in partial:
            raw_text = " ".join(
                t.strip() for t in page.css("p::text, span::text, div::text").getall() if t.strip()
            )
            email_match = re.search(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", raw_text)
            if email_match:
                partial["email"] = email_match.group(0)

        # Phone (tel: links first, then regex)
        for a in anchor_nodes:
            href = a.attrib.get("href", "")
            if href.startswith("tel:"):
                partial["phone"] = href.replace("tel:", "").replace("%20", " ").strip()
                break
        if "phone" not in partial:
            raw_text = raw_text if "raw_text" in dir() else " ".join(
                t.strip() for t in page.css("p::text, span::text, div::text").getall() if t.strip()
            )
            phone_match = re.search(r"(?:\+47\s?)?(\d{2}\s?\d{2}\s?\d{2}\s?\d{2})", raw_text)
            if phone_match:
                partial["phone"] = phone_match.group(0).strip()

        # Logo
        logo_candidates = [
            page.css("link[rel='apple-touch-icon']::attr(href)").get(""),
            page.css("link[rel='icon'][type='image/png']::attr(href)").get(""),
            page.css("meta[property='og:image']::attr(content)").get(""),
        ]
        for candidate in logo_candidates:
            if candidate:
                partial["logo_url"] = urllib.parse.urljoin(target_url, candidate)
                break
        if "logo_url" not in partial:
            for img in page.css("img"):
                src = img.attrib.get("src", "")
                alt = img.attrib.get("alt", "")
                if "logo" in src.lower() or "logo" in alt.lower():
                    partial["logo_url"] = urllib.parse.urljoin(target_url, src)
                    break

        # Social links
        social_domains = {
            "facebook.com": "facebook", "instagram.com": "instagram",
            "linkedin.com": "linkedin", "tiktok.com": "tiktok",
        }
        social_links: dict[str, str] = {}
        for a in anchor_nodes:
            href = a.attrib.get("href", "")
            for domain, platform in social_domains.items():
                if domain in href.lower():
                    social_links[platform] = urllib.parse.urljoin(target_url, href)
        if social_links:
            partial["social_links"] = social_links

        # Menus and reservation URL
        menus: list[dict] = []
        reservation_url = None
        booking_domains = ["resdiary", "sevenrooms", "bookatable", "formitable", "dinnerbooking", "book"]
        menu_keywords = ["meny", "menu", "mat", "drikke", "vin", "wine", "food"]

        for a in anchor_nodes:
            href = a.attrib.get("href", "")
            text = (a.text or "").strip()
            if not href or href.startswith("javascript") or href.startswith("#"):
                continue
            full_href = urllib.parse.urljoin(target_url, href)
            text_lower = text.lower()

            if not reservation_url:
                if (any(b in href.lower() for b in booking_domains)
                        or "bestill bord" in text_lower
                        or "book table" in text_lower):
                    reservation_url = full_href

            if any(m in text_lower or m in href.lower() for m in menu_keywords):
                display = text[:30] if text else "Meny"
                menus.append({"href": full_href, "text": display})

        if menus:
            # Deduplicate by href
            seen = set()
            unique = []
            for m in menus:
                if m["href"] not in seen:
                    unique.append(m)
                    seen.add(m["href"])
            partial["menus"] = unique

        if reservation_url:
            partial["reservation_url"] = reservation_url

        # About page — look for /om-oss or /about links
        about_text = None
        for a in anchor_nodes:
            text = (a.text or "").strip().lower()
            href = a.attrib.get("href", "")
            if href and ("om oss" in text or "about" in text
                         or "om-" in href.lower() or "about" in href.lower()):
                about_url = urllib.parse.urljoin(target_url, href)
                try:
                    about_page = fetch_with_fallback(about_url)
                    about_nodes = about_page.css("p::text, span::text, div::text").getall()
                    about_text = " ".join(t.strip() for t in about_nodes if t.strip())[:1000]
                    urls_scraped.append(about_url)
                except Exception:
                    pass
                break

        if about_text:
            partial["website_about_text"] = about_text

        # Concept clues — scan page text for known keywords
        all_text = " ".join(
            t.strip() for t in page.css(
                "p::text, h1::text, h2::text, h3::text, li::text, span::text, div::text"
            ).getall() if t.strip()
        ).lower()

        clues = [kw for kw in CONCEPT_KEYWORDS if kw in all_text]
        if clues:
            partial["concept_clues"] = clues

        # Cuisine types — common food category keywords
        cuisine_map = {
            "norsk": "Norsk", "nordisk": "Nordisk", "skandinavisk": "Skandinavisk",
            "italiensk": "Italiensk", "italian": "Italiensk",
            "fransk": "Fransk", "french": "Fransk",
            "japansk": "Japansk", "japanese": "Japansk", "sushi": "Japansk",
            "asiatisk": "Asiatisk", "asian": "Asiatisk",
            "meksikansk": "Meksikansk", "mexican": "Meksikansk",
            "indisk": "Indisk", "indian": "Indisk",
            "sjomat": "Sjomat", "seafood": "Sjomat",
            "pizza": "Pizza", "burger": "Burger",
        }
        cuisines = []
        for keyword, label in cuisine_map.items():
            if keyword in all_text and label not in cuisines:
                cuisines.append(label)
        if cuisines:
            partial["cuisine_types"] = cuisines

        partial["sources"] = {
            "scrape": {
                "fetched_at": datetime.utcnow().isoformat() + "Z",
                "urls_scraped": urls_scraped,
            }
        }

    except Exception as e:
        logger.error(f"Website scrape failed for {website_url}: {e}")

    return partial


async def enrich_from_scrape(website_url: str) -> dict:
    """Async wrapper around the synchronous website scraper.

    Uses asyncio.to_thread because scrapling's Fetcher.get() is blocking I/O.
    """
    return await asyncio.to_thread(_scrape_website_sync, website_url)


async def enrich_from_web_search(
    intel: WorkspaceIntelligence,
    company_name: str,
    city: Optional[str] = None,
    serper_api_key: Optional[str] = None,
    force_new_queries: bool = False,
) -> dict:
    """Search the web for company info using Serper API.

    Builds queries excluding already-used ones, runs max 2 new queries.
    Extracts ratings, news, mentions, seasonal patterns, concept clues.
    """
    api_key = serper_api_key or SERPER_API_KEY
    if not api_key:
        logger.warning("No SERPER_API_KEY — skipping web search enrichment")
        return {}
    if not aiohttp:
        logger.warning("aiohttp not installed — skipping web search enrichment")
        return {}

    # Determine which queries to run
    ws = intel.sources.get("web_search", {})
    used = set(ws.get("queries_used", []))
    candidates = build_query_candidates(company_name, city)
    new_queries = [q for q in candidates if q not in used]

    if not new_queries and force_new_queries:
        # Try a variation query when all standard ones are exhausted
        variation = f"{company_name} {city or ''} nyheter {datetime.now().year}".strip()
        if variation not in used:
            new_queries = [variation]

    if not new_queries:
        logger.info("No unused queries remaining for web search")
        return {}

    # Cap at 2 queries per call
    queries_to_run = new_queries[:2]

    partial: dict = {}
    all_queries_used: list[str] = list(used)
    urls_scraped: list[str] = []

    try:
        timeout = aiohttp.ClientTimeout(total=10)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            for query in queries_to_run:
                all_queries_used.append(query)

                # Organic search
                async with session.post(
                    "https://google.serper.dev/search",
                    headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
                    json={"q": query, "gl": "no", "hl": "no", "num": 10},
                ) as resp:
                    if resp.status != 200:
                        logger.warning(f"Serper search failed: {resp.status}")
                        continue
                    data = await resp.json()

                # Knowledge graph (Google rating)
                kg = data.get("knowledgeGraph", {})
                if kg:
                    rating = kg.get("rating")
                    if rating and partial.get("google_rating") is None:
                        try:
                            partial["google_rating"] = float(rating)
                        except (ValueError, TypeError):
                            pass
                    review_count = kg.get("reviewCount") or kg.get("ratingCount")
                    if review_count and partial.get("google_review_count") is None:
                        try:
                            partial["google_review_count"] = int(str(review_count).replace(",", ""))
                        except (ValueError, TypeError):
                            pass

                # Organic results — extract mentions, ratings, concept clues
                web_mentions: list[str] = partial.get("web_mentions", [])
                external_ratings: list[dict] = partial.get("external_ratings", [])
                concept_clues: list[str] = partial.get("concept_clues", [])
                seasonal_patterns: list[str] = partial.get("seasonal_patterns", [])

                for item in data.get("organic", []):
                    snippet = item.get("snippet", "")
                    link = item.get("link", "")
                    title = item.get("title", "")

                    if snippet:
                        web_mentions.append(snippet)
                    if link:
                        urls_scraped.append(link)

                    # Check for external rating sources
                    for domain, source_name in RATING_SOURCES.items():
                        if domain in link:
                            # Try to extract rating from snippet
                            rating_match = re.search(r"(\d[.,]\d)\s*/\s*5", snippet)
                            if rating_match:
                                try:
                                    r = float(rating_match.group(1).replace(",", "."))
                                    external_ratings.append({
                                        "source": source_name, "rating": r, "url": link,
                                    })
                                except ValueError:
                                    pass

                    # Concept clues from search results
                    combined = f"{title} {snippet}".lower()
                    for kw in CONCEPT_KEYWORDS:
                        if kw in combined and kw not in concept_clues:
                            concept_clues.append(kw)

                    # Seasonal patterns
                    season_keywords = [
                        "jul", "paaske", "sommer", "vinter", "host", "var",
                        "sesong", "julebord", "uteplass", "terrasse",
                    ]
                    for sk in season_keywords:
                        if sk in combined.lower() and sk not in seasonal_patterns:
                            seasonal_patterns.append(sk)

                    # Price range hints
                    if partial.get("price_range") is None:
                        if any(w in combined for w in ["billig", "rimelig", "budget"]):
                            partial["price_range"] = "budget"
                        elif any(w in combined for w in ["eksklusiv", "luksus", "fine dining", "gourmet"]):
                            partial["price_range"] = "premium"
                        elif any(w in combined for w in ["mellomklasse", "casual", "uformell"]):
                            partial["price_range"] = "mid-range"

                if web_mentions:
                    partial["web_mentions"] = web_mentions
                if external_ratings:
                    partial["external_ratings"] = external_ratings
                if concept_clues:
                    partial["concept_clues"] = concept_clues
                if seasonal_patterns:
                    partial["seasonal_patterns"] = seasonal_patterns

                # News search (one call per orchestration, not per query)
                if "news_articles" not in partial:
                    try:
                        async with session.post(
                            "https://google.serper.dev/news",
                            headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
                            json={"q": company_name, "gl": "no", "hl": "no", "num": 5},
                        ) as news_resp:
                            if news_resp.status == 200:
                                news_data = await news_resp.json()
                                articles = []
                                for article in news_data.get("news", []):
                                    articles.append({
                                        "title": article.get("title", ""),
                                        "snippet": article.get("snippet", ""),
                                        "source": article.get("source", ""),
                                        "date": article.get("date", ""),
                                        "link": article.get("link", ""),
                                    })
                                if articles:
                                    partial["news_articles"] = articles
                    except Exception as e:
                        logger.warning(f"News search failed: {e}")

        partial["sources"] = {
            "web_search": {
                "fetched_at": datetime.utcnow().isoformat() + "Z",
                "queries_used": all_queries_used,
                "urls_scraped": urls_scraped,
            }
        }

    except Exception as e:
        logger.error(f"Web search enrichment failed: {e}")

    return partial


# ── Request/Response models + orchestrator ───────────────────────────

class EnrichRequest(BaseModel):
    intelligence: Optional[WorkspaceIntelligence] = None
    company_name: str
    city: Optional[str] = None
    website_url: Optional[str] = None
    org_number: Optional[str] = None
    force_new_queries: bool = False


class EnrichResponse(BaseModel):
    intelligence: WorkspaceIntelligence
    sources_added: list[str]
    gaps_remaining: list[str]


async def handle_enrich(req: EnrichRequest) -> EnrichResponse:
    """Orchestrate the full enrichment pipeline.

    Phase 1+2: BRREG + website scrape run in parallel.
    Phase 3: Web search runs after (uses results from earlier phases).
    """
    intel = req.intelligence or WorkspaceIntelligence()

    # Seed identity fields if not already set
    if intel.company_name is None and req.company_name:
        intel = intel.model_copy(update={"company_name": req.company_name})
    if intel.city is None and req.city:
        intel = intel.model_copy(update={"city": req.city})
    if intel.website_url is None and req.website_url:
        intel = intel.model_copy(update={"website_url": req.website_url})

    sources_added: list[str] = []

    # Phase 1+2: BRREG + scrape in parallel
    tasks = []
    task_names = []

    # Always try BRREG if we don't have it yet or have org_number
    if "brreg" not in intel.sources or req.org_number:
        tasks.append(enrich_from_brreg(req.org_number, req.company_name, req.city))
        task_names.append("brreg")

    # Scrape if we have a URL and haven't scraped yet
    effective_url = req.website_url or intel.website_url
    if effective_url and "scrape" not in intel.sources:
        tasks.append(enrich_from_scrape(effective_url))
        task_names.append("scrape")

    if tasks:
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for name, result in zip(task_names, results):
            if isinstance(result, Exception):
                logger.error(f"Phase 1/2 enrichment failed for {name}: {result}")
                continue
            if result:
                intel = merge_partial(intel, result)
                sources_added.append(name)

    # Phase 3: Web search (sequential — benefits from Phase 1+2 data)
    needs_web = (
        "web_search" not in intel.sources
        or has_unused_queries(intel, req.company_name, req.city)
        or req.force_new_queries
    )
    if needs_web:
        web_result = await enrich_from_web_search(
            intel, req.company_name, req.city,
            force_new_queries=req.force_new_queries,
        )
        if web_result:
            intel = merge_partial(intel, web_result)
            sources_added.append("web_search")

    gaps = compute_gaps(intel)

    return EnrichResponse(
        intelligence=intel,
        sources_added=sources_added,
        gaps_remaining=gaps,
    )


# ── Generate endpoint — LLM copywriting from structured intelligence ─


class GenerateRequest(BaseModel):
    intelligence: WorkspaceIntelligence


class GenerateResponse(BaseModel):
    about_us: str
    our_history: str
    our_concept: str


def build_generate_prompt(intel: WorkspaceIntelligence) -> str:
    """Build an LLM prompt that turns structured intelligence into short business copy.

    The prompt enforces tone (jordnært, ekte), length limits (300 chars),
    and factual grounding (never invent data not in context).
    """
    context = build_context(intel)
    name = intel.company_name or "bedriften"
    return f'''Du skal skrive tre korte tekster for bedriften "{name}".
Disse tekstene skal kunne brukes direkte på Google Business, Facebook og Instagram.

FAKTA OM BEDRIFTEN:
{context}

REGLER:
- Hver tekst: maks 300 tegn, 2-3 setninger. Skal fungere på Google Business (750 tegn), Facebook (255 tegn) og Instagram bio (150 tegn) — hold det kort nok for alle tre.
- Skriv som eieren ville sagt det til naboen. Jordnært, ekte, rett på sak.
- ALDRI finn opp fakta som ikke står i konteksten over.
- Ingen superlativ: ikke "unike", "enestående", "lidenskapelige", "fantastiske".
- Hvis stiftelsesår finnes, bruk det naturlig ("Siden 2004...").
- Hvis du ikke har nok data for en seksjon, skriv det du kan og hold det kort.
- De tre tekstene skal ikke gjenta hverandre — hver tekst har sitt eget fokus.

TEKSTENE:
1. "Om oss" — Hvem er dere? Hva gjør dere? Hvor holder dere til?
2. "Vår historie" — Når startet dere? Hva har skjedd siden? Eventuelle milepæler.
3. "Vårt konsept" — Hva gjør dere spesielt? Matfilosofi, stemning, målgruppe.

Returner KUN et JSON-objekt:
{{"about_us": "...", "our_history": "...", "our_concept": "..."}}'''


def _extract_json_from_llm(text: str) -> str:
    """Extract JSON from LLM response, handling markdown code blocks."""
    code_block = re.search(r'```(?:json)?\s*\n?([\s\S]*?)\n?```', text)
    if code_block and code_block.group(1):
        return code_block.group(1).strip()
    obj_match = re.search(r'\{[\s\S]*\}', text)
    if obj_match and obj_match.group(0):
        return obj_match.group(0).strip()
    return text.strip()


async def handle_generate(req: GenerateRequest) -> GenerateResponse:
    """Call OpenRouter LLM to generate business copy from structured intelligence.

    Uses the enriched WorkspaceIntelligence as context — the LLM writes
    three short texts (about_us, our_history, our_concept) grounded in real data.
    """
    api_key = OPENROUTER_API_KEY
    if not api_key:
        raise HTTPException(status_code=503, detail="OPENROUTER_API_KEY not configured")

    prompt = build_generate_prompt(req.intelligence)

    timeout = aiohttp.ClientTimeout(total=30)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
            json={
                "model": "anthropic/claude-3.5-sonnet",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.4,
                "max_tokens": 1024,
            },
        ) as resp:
            if resp.status != 200:
                error = await resp.text()
                logger.error(f"[generate] OpenRouter error: {resp.status} {error}")
                raise HTTPException(status_code=502, detail="AI generation failed")
            data = await resp.json()

    raw = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    if not raw:
        raise HTTPException(status_code=502, detail="Empty AI response")

    json_str = _extract_json_from_llm(raw)
    parsed = json.loads(json_str)

    return GenerateResponse(
        about_us=parsed.get("about_us", ""),
        our_history=parsed.get("our_history", ""),
        our_concept=parsed.get("our_concept", ""),
    )
