---
title: Workspace Intelligence Implementation Plan
status: draft
created: 2026-03-19
updated: 2026-03-19
module: join-wizard
tags: [workspace-intelligence, enrich, generate, scrapling, brreg, serper]
---

# Workspace Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic AI content generation in join wizard Step 3 with a structured enrich + generate pipeline that produces high-quality, usable company copy from three data sources (BRREG, website scrape, web search).

**Architecture:** Two new Scrapling (Python) endpoints (`/enrich` and `/generate`) orchestrated by a Next.js API route (`/api/workspace-intelligence`). Data accumulates in a `WorkspaceIntelligence` JSON structure with source tracking to avoid re-fetching. Frontend uses a new `useWorkspaceIntelligence` hook with a "Skriv på nytt" button for iterative re-enrichment.

**Tech Stack:** Python (FastAPI, aiohttp, Pydantic), TypeScript (Next.js API route, React hook), Serper API, BRREG API, OpenRouter (Claude 3.5 Sonnet)

**Spec:** `docs/superpowers/specs/2026-03-19-workspace-intelligence-design.md`

---

## File Map

### New Files

| File                                                       | Responsibility                                                   |
| ---------------------------------------------------------- | ---------------------------------------------------------------- |
| `services/scrapling/intelligence.py`                       | WorkspaceIntelligence model + enrich logic + generate logic      |
| `services/scrapling/tests/test_intelligence.py`            | Tests for enrich, generate, merge, gap detection, query building |
| `apps/web/src/app/api/workspace-intelligence/route.ts`     | Next.js orchestrator route                                       |
| `apps/web/src/app/join/_hooks/useWorkspaceIntelligence.ts` | React hook for intelligence state + API calls                    |

### Modified Files

| File                                                   | Change                                                                  |
| ------------------------------------------------------ | ----------------------------------------------------------------------- |
| `services/scrapling/main.py`                           | Import and mount `/enrich` + `/generate` endpoints from intelligence.py |
| `infra/docker-compose.yml:130-132`                     | Add `SERPER_API_KEY` to scrapling environment                           |
| `apps/web/src/app/api/scrape/brreg/route.ts:78-100`    | Add `foundingDate` to mapEntity + mapCandidate                          |
| `apps/web/src/app/join/_hooks/useScrapedData.ts:20-27` | Add `foundingDate` to BrregData interface                               |
| `apps/web/src/app/join/_hooks/useSignupWizard.tsx`     | Add intelligence to WizardState, remove AI content refs                 |
| `apps/web/src/app/join/_components/Step3About.tsx`     | Use new hook, add "Skriv på nytt" button                                |
| `apps/web/src/app/join/_components/SignupWizard.tsx`   | Update STEP_MESSAGES if needed, remove old AI status refs               |

### Deleted Files (Task 9)

| File                                             | Reason                                  |
| ------------------------------------------------ | --------------------------------------- |
| `apps/web/src/app/join/_hooks/useAiContent.ts`   | Replaced by useWorkspaceIntelligence    |
| `apps/web/src/app/api/generate-content/route.ts` | Replaced by /api/workspace-intelligence |

---

## Task 1: BRREG Founding Date Extraction

Quick win. Add `stiftelsesdato` to BRREG API responses.

**Files:**

- Modify: `apps/web/src/app/api/scrape/brreg/route.ts:78-100`
- Modify: `apps/web/src/app/join/_hooks/useScrapedData.ts:20-27`

- [ ] **Step 1: Add `foundingDate` to `mapEntity()`**

In `apps/web/src/app/api/scrape/brreg/route.ts`, update `mapEntity`:

```typescript
function mapEntity(e: Record<string, unknown>) {
  const addr = e.forretningsadresse as Record<string, unknown> | undefined;
  return {
    orgNumber: e.organisasjonsnummer as string,
    name: e.navn as string,
    street: ((addr?.adresse as string[]) ?? [])[0] || "",
    postalCode: (addr?.postnummer as string) || "",
    city: (addr?.poststed as string) || "",
    foundingDate: (e.stiftelsesdato as string) || null,
  };
}
```

- [ ] **Step 2: Add `foundingDate` to `mapCandidate()`**

Same file, update `mapCandidate`:

```typescript
function mapCandidate(e: Record<string, unknown>) {
  const addr = e.forretningsadresse as Record<string, unknown> | undefined;
  const nace = e.naeringskode1 as { beskrivelse?: string } | undefined;
  return {
    orgNumber: e.organisasjonsnummer as string,
    name: e.navn as string,
    street: ((addr?.adresse as string[]) ?? [])[0] || "",
    postalCode: (addr?.postnummer as string) || "",
    city: (addr?.poststed as string) || "",
    industry: nace?.beskrivelse || "",
    foundingDate: (e.stiftelsesdato as string) || null,
  };
}
```

- [ ] **Step 3: Update `BrregData` interface in `useScrapedData.ts`**

In `apps/web/src/app/join/_hooks/useScrapedData.ts`:

```typescript
export interface BrregData {
  orgNumber: string;
  name: string;
  street: string;
  postalCode: string;
  city: string;
  industry?: string;
  foundingDate?: string;
}
```

- [ ] **Step 4: Verify BRREG response includes founding date**

Open browser or curl:

```bash
curl -s "https://data.brreg.no/enhetsregisteret/api/enheter/920692692" | python3 -m json.tool | grep -i stiftelse
```

Expected: `"stiftelsesdato": "YYYY-MM-DD"` present in response.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/scrape/brreg/route.ts apps/web/src/app/join/_hooks/useScrapedData.ts
git commit -m "feat(join): extract BRREG founding date (stiftelsesdato)"
```

---

## Task 2: Infrastructure — SERPER_API_KEY for Scrapling

**Files:**

- Modify: `infra/docker-compose.yml:130-132`

- [ ] **Step 1: Add SERPER_API_KEY to scrapling service environment**

In `infra/docker-compose.yml`, under the scrapling service `environment` section:

```yaml
scrapling:
  build:
    context: ../services/scrapling
    dockerfile: Dockerfile
  environment:
    - PORT=8000
    - SCRAPLING_AUTH_TOKEN=${SCRAPLING_AUTH_TOKEN}
    - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
    - SERPER_API_KEY=${SERPER_API_KEY}
```

- [ ] **Step 2: Commit**

```bash
git add infra/docker-compose.yml
git commit -m "infra(scrapling): add SERPER_API_KEY to docker environment"
```

---

## Task 3: WorkspaceIntelligence Pydantic Model + Merge Logic

The core data model and merge utilities. Tested in isolation before building endpoints.

**Files:**

- Create: `services/scrapling/intelligence.py`
- Create: `services/scrapling/tests/test_intelligence.py`

- [ ] **Step 0: Update conftest.py to include scrapling root in sys.path + add pytest-asyncio**

In `services/scrapling/tests/conftest.py`, add the scrapling root directory to sys.path:

```python
# Add scrapling root to path so intelligence.py can be imported
_scrapling_root = str(Path(__file__).parent.parent)
if _scrapling_root not in sys.path:
    sys.path.insert(0, _scrapling_root)
```

Also verify `pytest-asyncio` is in requirements. If not, add to `services/scrapling/requirements.txt`:

```
pytest-asyncio>=0.23.0
```

- [ ] **Step 1: Write failing tests for the model and merge logic**

Create `services/scrapling/tests/test_intelligence.py`:

```python
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
    assert result.company_name == "Test"  # preserved


def test_merge_partial_does_not_overwrite_existing_scalars():
    from intelligence import WorkspaceIntelligence, merge_partial
    intel = WorkspaceIntelligence(city="Oslo")
    partial = {"city": "Bergen"}
    result = merge_partial(intel, partial)
    assert result.city == "Oslo"  # first value wins


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
    assert ctx == ""  # no data, no context lines


def test_years_in_business_computed():
    from intelligence import compute_years_in_business
    years = compute_years_in_business("2004-06-15")
    expected = datetime.now().year - 2004
    assert years == expected


def test_years_in_business_none():
    from intelligence import compute_years_in_business
    assert compute_years_in_business(None) is None
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd services/scrapling && python -m pytest tests/test_intelligence.py -v
```

Expected: ImportError — `intelligence` module does not exist yet.

- [ ] **Step 3: Implement the model and utility functions**

Create `services/scrapling/intelligence.py`:

```python
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
from datetime import datetime
from typing import Optional

import aiohttp
from fastapi import Depends, HTTPException
from pydantic import BaseModel

logger = logging.getLogger("scrapling.intelligence")


# ── Data Model ─────────────────────────────────────────────────────────────

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


# ── Merge Logic ────────────────────────────────────────────────────────────

def merge_partial(intel: WorkspaceIntelligence, partial: dict) -> WorkspaceIntelligence:
    """Merge a partial enrichment result into the intelligence model.

    List fields are merged and deduplicated. Dict fields are deep-merged.
    Scalar fields are only set if currently None (first source wins).
    """
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


# ── Gap Detection ──────────────────────────────────────────────────────────

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


# ── Query Management ───────────────────────────────────────────────────────

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


# ── Context Builder ────────────────────────────────────────────────────────

def build_context(intel: WorkspaceIntelligence) -> str:
    """Build a curated text block from intelligence for the LLM prompt.

    Not a raw JSON dump — a human-readable summary of known facts.
    """
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


# ── Helpers ────────────────────────────────────────────────────────────────

def compute_years_in_business(founding_date: Optional[str]) -> Optional[int]:
    """Compute years since founding. Returns None if no date."""
    if not founding_date:
        return None
    try:
        year = datetime.fromisoformat(founding_date).year
        return datetime.now().year - year
    except (ValueError, TypeError):
        return None
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd services/scrapling && python -m pytest tests/test_intelligence.py -v
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add services/scrapling/intelligence.py services/scrapling/tests/test_intelligence.py
git commit -m "feat(scrapling): WorkspaceIntelligence model with merge, gaps, and context builder"
```

---

## Task 4: Enrich Endpoint — BRREG + Scrape + Web Search

The data-fetching pipeline. Three sources, parallel execution for BRREG + scrape.

**Files:**

- Modify: `services/scrapling/intelligence.py` (add enrich logic)
- Modify: `services/scrapling/tests/test_intelligence.py` (add enrich tests)
- Modify: `services/scrapling/main.py` (mount endpoint)

- [ ] **Step 1: Write tests for enrich source functions**

Add to `services/scrapling/tests/test_intelligence.py`:

```python
import pytest
from unittest.mock import AsyncMock, patch, MagicMock


@pytest.mark.asyncio
async def test_enrich_from_brreg_by_org_number():
    from intelligence import enrich_from_brreg
    mock_response = {
        "organisasjonsnummer": "920692692",
        "navn": "SOLSIDEN AS",
        "stiftelsesdato": "2004-06-15",
        "forretningsadresse": {
            "adresse": ["Havnegata 12"],
            "postnummer": "7010",
            "poststed": "TRONDHEIM"
        },
        "naeringskode1": {"beskrivelse": "Drift av restauranter og kafeer"}
    }
    with patch("intelligence.aiohttp.ClientSession") as mock_session_cls:
        mock_resp = AsyncMock()
        mock_resp.status = 200
        mock_resp.json = AsyncMock(return_value=mock_response)
        mock_resp.__aenter__ = AsyncMock(return_value=mock_resp)
        mock_resp.__aexit__ = AsyncMock(return_value=False)

        mock_session = AsyncMock()
        mock_session.get = MagicMock(return_value=mock_resp)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)
        mock_session_cls.return_value = mock_session

        partial = await enrich_from_brreg(org_number="920692692", company_name="Solsiden", city="Trondheim")

    assert partial["founding_date"] == "2004-06-15"
    assert partial["industry"] == "Drift av restauranter og kafeer"
    assert partial["address"] == "Havnegata 12"
    assert "brreg" in partial["sources"]


@pytest.mark.asyncio
async def test_enrich_from_web_search():
    from intelligence import enrich_from_web_search, WorkspaceIntelligence
    mock_serper_response = {
        "organic": [
            {"title": "Solsiden Restaurant", "link": "https://solsiden.no", "snippet": "Trondheims beste sjomat", "position": 1},
            {"title": "Solsiden - TripAdvisor", "link": "https://tripadvisor.com/solsiden", "snippet": "Bra mat", "position": 2, "rating": 4.5, "ratingCount": 200},
        ],
        "knowledgeGraph": {"rating": 4.6, "ratingCount": 350},
        "news": []
    }
    intel = WorkspaceIntelligence()

    with patch("intelligence.aiohttp.ClientSession") as mock_session_cls:
        mock_resp = AsyncMock()
        mock_resp.status = 200
        mock_resp.json = AsyncMock(return_value=mock_serper_response)
        mock_resp.__aenter__ = AsyncMock(return_value=mock_resp)
        mock_resp.__aexit__ = AsyncMock(return_value=False)

        mock_session = AsyncMock()
        mock_session.post = MagicMock(return_value=mock_resp)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)
        mock_session_cls.return_value = mock_session

        partial = await enrich_from_web_search(
            intel=intel,
            company_name="Solsiden",
            city="Trondheim",
            serper_api_key="test-key"
        )

    assert partial["google_rating"] == 4.6
    assert partial["google_review_count"] == 350
    assert len(partial["web_mentions"]) > 0
    assert "web_search" in partial["sources"]
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd services/scrapling && python -m pytest tests/test_intelligence.py::test_enrich_from_brreg_by_org_number -v
```

Expected: ImportError — `enrich_from_brreg` not defined.

- [ ] **Step 3: Implement enrich source functions**

Add to `services/scrapling/intelligence.py`:

```python
import asyncio
import os

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


async def enrich_from_brreg(
    org_number: Optional[str], company_name: str, city: Optional[str]
) -> dict:
    """Fetch company data from BRREG. Returns a partial dict for merge."""
    now = datetime.utcnow().isoformat() + "Z"
    partial: dict = {"sources": {"brreg": {"fetched_at": now}}}

    try:
        timeout = aiohttp.ClientTimeout(total=10)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            if org_number and len(org_number.replace(" ", "")) >= 9:
                clean = org_number.replace(" ", "")
                url = f"{BRREG_BASE}/enheter/{clean}"
                async with session.get(url) as resp:
                    if resp.status != 200:
                        return partial
                    data = await resp.json()
            else:
                params = {"navn": company_name, "size": "5"}
                async with session.get(f"{BRREG_BASE}/enheter", params=params) as resp:
                    if resp.status != 200:
                        return partial
                    result = await resp.json()
                    entities = result.get("_embedded", {}).get("enheter", [])
                    if not entities:
                        return partial
                    # Pick best match by city
                    data = entities[0]
                    if city:
                        city_upper = city.upper()
                        for e in entities:
                            addr = e.get("forretningsadresse", {})
                            if (addr.get("poststed") or "").upper() == city_upper:
                                data = e
                                break

        # Extract fields
        addr = data.get("forretningsadresse", {})
        nace = data.get("naeringskode1", {})
        founding = data.get("stiftelsesdato")

        if founding:
            partial["founding_date"] = founding
            partial["years_in_business"] = compute_years_in_business(founding)
        if addr.get("adresse"):
            partial["address"] = addr["adresse"][0] if isinstance(addr["adresse"], list) else str(addr["adresse"])
        if addr.get("poststed"):
            partial["city"] = addr["poststed"].title()
        if nace.get("beskrivelse"):
            partial["industry"] = nace["beskrivelse"]
        if data.get("organisasjonsnummer"):
            partial["org_number"] = str(data["organisasjonsnummer"])

    except Exception as e:
        logger.warning(f"[enrich] BRREG failed: {e}")

    return partial


def _scrape_website_sync(website_url: str) -> dict:
    """Synchronous website scrape. Runs in a thread via asyncio.to_thread().

    Reuses the existing Scrapling fetch logic from main.py.
    The scrapling library's Fetcher.get() is blocking I/O — it must NOT
    run on the async event loop directly.
    """
    now = datetime.utcnow().isoformat() + "Z"
    urls_scraped = []
    partial: dict = {}

    try:
        from main import fetch_with_fallback, clean_url
        import urllib.parse

        target_url = clean_url(website_url)
        page = fetch_with_fallback(website_url)
        urls_scraped.append(target_url)

        # Meta description
        description = page.css("meta[name='description']::attr(content)").get("")
        if description:
            partial["website_description"] = description.strip()

        # Page text for keyword extraction
        raw_text_nodes = page.css("p::text, h1::text, h2::text, h3::text, li::text, span::text, div::text").getall()
        clean_text = " ".join([t.strip() for t in raw_text_nodes if t.strip()])
        lower_text = clean_text.lower()

        # Email
        email = None
        for a in page.css("a"):
            href = a.attrib.get("href", "")
            if href.startswith("mailto:"):
                email = href.replace("mailto:", "").split("?")[0].strip()
                break
        if not email:
            email_match = re.search(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", clean_text)
            if email_match:
                email = email_match.group(0)
        if email:
            partial["email"] = email

        # Phone
        phone = None
        for a in page.css("a"):
            href = a.attrib.get("href", "")
            if href.startswith("tel:"):
                phone = href.replace("tel:", "").replace("%20", " ").strip()
                break
        if not phone:
            phone_match = re.search(r"(?:\+47\s?)?(\d{2}\s?\d{2}\s?\d{2}\s?\d{2})", clean_text)
            if phone_match:
                phone = phone_match.group(0).strip()
        if phone:
            partial["phone"] = phone

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

        # Social links
        social_domains = {"facebook.com": "facebook", "instagram.com": "instagram", "linkedin.com": "linkedin", "tiktok.com": "tiktok"}
        social = {}
        for a in page.css("a"):
            href = a.attrib.get("href", "")
            for domain, platform in social_domains.items():
                if domain in href.lower():
                    social[platform] = urllib.parse.urljoin(target_url, href)
        if social:
            partial["social_links"] = social

        # Reservation URL
        booking_domains = ["resdiary", "sevenrooms", "bookatable", "formitable", "dinnerbooking", "book"]
        for a in page.css("a"):
            href = a.attrib.get("href", "")
            text = (a.text or "").strip().lower()
            if any(b in href.lower() for b in booking_domains) or "bestill bord" in text or "bordbestilling" in text:
                partial["reservation_url"] = urllib.parse.urljoin(target_url, href)
                break

        # Menus
        menus = []
        menu_kw = ["meny", "menu", "mat", "drikke", "vin", "wine", "food"]
        for a in page.css("a"):
            href = a.attrib.get("href", "")
            text = (a.text or "").strip()
            text_lower = text.lower()
            if any(m in text_lower or m in href.lower() for m in menu_kw) or href.lower().endswith(".pdf"):
                display = text[:27] + "..." if len(text) > 30 else (text or "Meny / PDF")
                full = urllib.parse.urljoin(target_url, href)
                if full not in [m["href"] for m in menus]:
                    menus.append({"text": display, "href": full})
        if menus:
            partial["menus"] = menus

        # Scrape /om-oss or /about page for about_text
        about_links = []
        for a in page.css("a"):
            text = (a.text or "").strip().lower()
            href = a.attrib.get("href", "")
            if href and ("om oss" in text or "about" in text or "om-" in href.lower() or "about-" in href.lower()):
                about_links.append(urllib.parse.urljoin(target_url, href))
        if about_links:
            try:
                about_page = fetch_with_fallback(about_links[0])
                urls_scraped.append(about_links[0])
                about_nodes = about_page.css("p::text, span::text, div::text").getall()
                about_text = " ".join([t.strip() for t in about_nodes if t.strip()])
                if about_text:
                    partial["website_about_text"] = about_text[:2000]
            except Exception:
                pass

        # Derive concept_clues from page text
        clues = []
        for keyword in CONCEPT_KEYWORDS:
            if keyword in lower_text:
                clues.append(keyword)
        if clues:
            partial["concept_clues"] = clues[:10]

        # Derive cuisine_types from common patterns
        cuisine_map = {
            "sjomat": "sjomat", "seafood": "sjomat", "fisk": "sjomat",
            "pizza": "pizza", "pasta": "italiensk", "italiensk": "italiensk",
            "sushi": "japansk", "ramen": "japansk", "wok": "asiatisk",
            "burger": "burger", "taco": "meksikansk", "indisk": "indisk",
            "thai": "thai", "nordisk": "nordisk", "norsk": "norsk",
        }
        cuisines = set()
        for keyword, cuisine in cuisine_map.items():
            if keyword in lower_text:
                cuisines.add(cuisine)
        if cuisines:
            partial["cuisine_types"] = list(cuisines)[:5]

    except Exception as e:
        logger.warning(f"[enrich] Scrape failed: {e}")

    partial["sources"] = {"scrape": {"fetched_at": now, "urls_scraped": urls_scraped}}
    partial["website_url"] = website_url
    return partial


async def enrich_from_scrape(website_url: str) -> dict:
    """Async wrapper — runs the blocking scrape in a thread pool."""
    return await asyncio.to_thread(_scrape_website_sync, website_url)


async def enrich_from_web_search(
    intel: WorkspaceIntelligence,
    company_name: str,
    city: Optional[str],
    serper_api_key: Optional[str] = None,
    force_new_queries: bool = False,
) -> dict:
    """Search Google via Serper for company mentions. Returns a partial dict."""
    api_key = serper_api_key or SERPER_API_KEY
    if not api_key:
        logger.warning("[enrich] SERPER_API_KEY not configured, skipping web search")
        return {}

    now = datetime.utcnow().isoformat() + "Z"
    ws = intel.sources.get("web_search", {})
    used_queries = set(ws.get("queries_used", []))
    all_candidates = build_query_candidates(company_name, city)

    # Pick unused queries (max 2 per call to limit API usage)
    new_queries = [q for q in all_candidates if q not in used_queries][:2]
    if not new_queries and force_new_queries:
        # All standard queries used — try a variation
        new_queries = [f"{company_name} {city or ''} opplevelse".strip()]
    if not new_queries:
        return {}

    partial: dict = {}
    all_organic = []
    all_news = []
    all_snippets = []
    urls_scraped = list(ws.get("urls_scraped", []))

    try:
        timeout = aiohttp.ClientTimeout(total=10)
        headers = {"X-API-KEY": api_key, "Content-Type": "application/json"}

        async with aiohttp.ClientSession(timeout=timeout) as session:
            for query in new_queries:
                # Organic search
                try:
                    async with session.post(
                        "https://google.serper.dev/search",
                        headers=headers,
                        json={"q": query, "gl": "no", "hl": "no", "num": 10},
                    ) as resp:
                        if resp.status == 200:
                            data = await resp.json()
                            organic = data.get("organic", [])
                            all_organic.extend(organic)
                            all_snippets.extend([r.get("snippet", "") for r in organic])
                            urls_scraped.extend([r.get("link", "") for r in organic[:3]])

                            kg = data.get("knowledgeGraph")
                            if kg:
                                if kg.get("rating"):
                                    partial["google_rating"] = kg["rating"]
                                if kg.get("ratingCount"):
                                    partial["google_review_count"] = kg["ratingCount"]
                except Exception as e:
                    logger.warning(f"[enrich] Serper search failed for '{query}': {e}")

                # News search (first query only)
                if query == new_queries[0]:
                    try:
                        async with session.post(
                            "https://google.serper.dev/news",
                            headers=headers,
                            json={"q": query, "gl": "no", "hl": "no", "num": 5},
                        ) as resp:
                            if resp.status == 200:
                                data = await resp.json()
                                news = data.get("news", [])
                                all_news.extend(news)
                                all_snippets.extend([n.get("snippet", "") for n in news])
                    except Exception as e:
                        logger.warning(f"[enrich] Serper news failed: {e}")

        # Extract external ratings
        ratings = []
        seen_sources = set()
        for r in all_organic:
            if not r.get("rating"):
                continue
            link = r.get("link", "")
            for domain, source in RATING_SOURCES.items():
                if domain in link and source not in seen_sources:
                    seen_sources.add(source)
                    ratings.append({
                        "source": source,
                        "rating": r["rating"],
                        "review_count": r.get("ratingCount"),
                        "price_range": r.get("priceRange"),
                        "url": link,
                    })
        if ratings:
            partial["external_ratings"] = ratings

        # News articles
        articles = [{"title": n.get("title", ""), "url": n.get("link", ""), "snippet": n.get("snippet", "")} for n in all_news[:5]]
        if articles:
            partial["news_articles"] = articles

        # Web mentions (top snippets)
        mentions = [s for s in all_snippets if s][:5]
        if mentions:
            partial["web_mentions"] = mentions

        # Seasonal patterns
        seasonal_kw = ["sommermeny", "julebord", "paske", "uteservering", "sesong", "sommersesong", "vintersesong", "17. mai", "nyttar"]
        joined = " ".join(all_snippets).lower()
        patterns = [k for k in seasonal_kw if k in joined]
        if patterns:
            partial["seasonal_patterns"] = patterns

        # Concept clues from web mentions
        web_lower = joined
        clues = []
        for keyword in CONCEPT_KEYWORDS:
            if keyword in web_lower:
                clues.append(keyword)
        if clues:
            partial["concept_clues"] = clues[:10]

        # Price range from KG
        for r in all_organic:
            if r.get("priceRange"):
                partial["price_range"] = r["priceRange"]
                break

    except Exception as e:
        logger.warning(f"[enrich] Web search failed: {e}")

    # Update source tracking — merge with existing queries
    all_used = list(used_queries | set(new_queries))
    partial["sources"] = {"web_search": {
        "fetched_at": now,
        "queries_used": all_used,
        "urls_scraped": list(set(urls_scraped)),
    }}

    return partial


# ── Enrich Endpoint Models ─────────────────────────────────────────────────

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
    """Main enrich orchestrator. Runs sources in parallel where possible."""
    intel = req.intelligence or WorkspaceIntelligence()

    # Seed identity fields from request if not already set
    if not intel.company_name and req.company_name:
        intel = intel.model_copy(update={"company_name": req.company_name})
    if not intel.city and req.city:
        intel = intel.model_copy(update={"city": req.city})
    if not intel.website_url and req.website_url:
        intel = intel.model_copy(update={"website_url": req.website_url})

    sources_added: list[str] = []

    # Phase 1 + 2: BRREG + Scrape in parallel
    parallel_tasks: list[tuple[str, asyncio.Task]] = []
    if "brreg" not in intel.sources:
        parallel_tasks.append(("brreg", asyncio.create_task(
            enrich_from_brreg(req.org_number, req.company_name, req.city)
        )))
    if "scrape" not in intel.sources and req.website_url:
        parallel_tasks.append(("scrape", asyncio.create_task(
            enrich_from_scrape(req.website_url)
        )))

    for name, task in parallel_tasks:
        try:
            partial = await task
            if partial:
                intel = merge_partial(intel, partial)
                sources_added.append(name)
        except Exception as e:
            logger.warning(f"[enrich] {name} failed: {e}")

    # Phase 3: Web search (if missing or has unused queries or forced)
    run_web_search = (
        "web_search" not in intel.sources
        or has_unused_queries(intel, req.company_name, req.city)
        or req.force_new_queries
    )
    if run_web_search:
        try:
            partial = await enrich_from_web_search(
                intel=intel,
                company_name=req.company_name,
                city=req.city,
                force_new_queries=req.force_new_queries,
            )
            if partial:
                intel = merge_partial(intel, partial)
                sources_added.append("web_search")
        except Exception as e:
            logger.warning(f"[enrich] web_search failed: {e}")

    gaps = compute_gaps(intel)
    return EnrichResponse(intelligence=intel, sources_added=sources_added, gaps_remaining=gaps)
```

- [ ] **Step 4: Run enrich tests**

```bash
cd services/scrapling && python -m pytest tests/test_intelligence.py -v
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add services/scrapling/intelligence.py services/scrapling/tests/test_intelligence.py
git commit -m "feat(scrapling): enrich endpoint — BRREG + scrape + web search pipeline"
```

---

## Task 5: Generate Endpoint — LLM Copywriting

**Files:**

- Modify: `services/scrapling/intelligence.py` (add generate logic)
- Modify: `services/scrapling/tests/test_intelligence.py` (add generate tests)

- [ ] **Step 1: Write test for generate**

Add to `services/scrapling/tests/test_intelligence.py`:

```python
@pytest.mark.asyncio
async def test_handle_generate_calls_openrouter():
    from intelligence import handle_generate, GenerateRequest, WorkspaceIntelligence
    intel = WorkspaceIntelligence(
        company_name="Solsiden",
        city="Trondheim",
        founding_date="2004-06-15",
        years_in_business=22,
        concept_clues=["sjomat", "uteservering"],
    )
    mock_ai_response = {
        "choices": [{"message": {"content": json.dumps({
            "about_us": "Solsiden ligger pa havna i Trondheim.",
            "our_history": "Siden 2004 har vi servert fersk sjomat.",
            "our_concept": "Fersk sjomat fra Trondelagskysten."
        })}}]
    }

    with patch("intelligence.aiohttp.ClientSession") as mock_session_cls:
        mock_resp = AsyncMock()
        mock_resp.status = 200
        mock_resp.json = AsyncMock(return_value=mock_ai_response)
        mock_resp.__aenter__ = AsyncMock(return_value=mock_resp)
        mock_resp.__aexit__ = AsyncMock(return_value=False)

        mock_session = AsyncMock()
        mock_session.post = MagicMock(return_value=mock_resp)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)
        mock_session_cls.return_value = mock_session

        req = GenerateRequest(intelligence=intel)
        result = await handle_generate(req)

    assert result.about_us == "Solsiden ligger pa havna i Trondheim."
    assert result.our_history == "Siden 2004 har vi servert fersk sjomat."
    assert result.our_concept == "Fersk sjomat fra Trondelagskysten."


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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd services/scrapling && python -m pytest tests/test_intelligence.py::test_handle_generate_calls_openrouter -v
```

Expected: ImportError — `handle_generate` not defined.

- [ ] **Step 3: Implement generate logic**

Add to `services/scrapling/intelligence.py`:

````python
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")


class GenerateRequest(BaseModel):
    intelligence: WorkspaceIntelligence


class GenerateResponse(BaseModel):
    about_us: str
    our_history: str
    our_concept: str


def build_generate_prompt(intel: WorkspaceIntelligence) -> str:
    """Build the full LLM prompt from intelligence data."""
    context = build_context(intel)
    name = intel.company_name or "bedriften"

    return f"""Du skal skrive tre korte tekster for bedriften "{name}".
Disse tekstene skal kunne brukes direkte pa Google Business, Facebook og Instagram.

FAKTA OM BEDRIFTEN:
{context}

REGLER:
- Hver tekst: maks 300 tegn, 2-3 setninger. Skal fungere pa Google Business (750 tegn), Facebook (255 tegn) og Instagram bio (150 tegn) — hold det kort nok for alle tre.
- Skriv som eieren ville sagt det til naboen. Jordnaert, ekte, rett pa sak.
- ALDRI finn opp fakta som ikke star i konteksten over.
- Ingen superlativ: ikke "unike", "enestaaende", "lidenskapelige", "fantastiske".
- Hvis stiftelsesar finnes, bruk det naturlig ("Siden 2004...").
- Hvis du ikke har nok data for en seksjon, skriv det du kan og hold det kort.
- De tre tekstene skal ikke gjenta hverandre — hver tekst har sitt eget fokus.

TEKSTENE:
1. "Om oss" — Hvem er dere? Hva gjor dere? Hvor holder dere til?
2. "Var historie" — Nar startet dere? Hva har skjedd siden? Eventuelle milaepaeler.
3. "Vart konsept" — Hva gjor dere spesielt? Matfilosofi, stemning, malgruppe.

Returner KUN et JSON-objekt:
{{"about_us": "...", "our_history": "...", "our_concept": "..."}}"""


def _extract_json(text: str) -> str:
    """Extract JSON from LLM response, handling markdown code blocks."""
    code_block = re.search(r'```(?:json)?\s*\n?([\s\S]*?)\n?```', text)
    if code_block and code_block.group(1):
        return code_block.group(1).strip()
    obj_match = re.search(r'\{[\s\S]*\}', text)
    if obj_match and obj_match.group(0):
        return obj_match.group(0).strip()
    return text.strip()


async def handle_generate(req: GenerateRequest) -> GenerateResponse:
    """Generate company copy from intelligence data via LLM."""
    api_key = OPENROUTER_API_KEY
    if not api_key:
        raise HTTPException(status_code=503, detail="OPENROUTER_API_KEY not configured")

    prompt = build_generate_prompt(req.intelligence)

    try:
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

        json_str = _extract_json(raw)
        parsed = json.loads(json_str)

        return GenerateResponse(
            about_us=parsed.get("about_us", ""),
            our_history=parsed.get("our_history", ""),
            our_concept=parsed.get("our_concept", ""),
        )

    except (aiohttp.ClientError, json.JSONDecodeError) as e:
        logger.error(f"[generate] Failed: {e}")
        raise HTTPException(status_code=502, detail="AI generation failed")
````

- [ ] **Step 4: Run all tests**

```bash
cd services/scrapling && python -m pytest tests/test_intelligence.py -v
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add services/scrapling/intelligence.py services/scrapling/tests/test_intelligence.py
git commit -m "feat(scrapling): generate endpoint — LLM copywriting with structured context"
```

---

## Task 6: Mount Endpoints in Scrapling main.py

**Files:**

- Modify: `services/scrapling/main.py`

- [ ] **Step 1: Import and mount the endpoints**

At the top of `services/scrapling/main.py`, add import:

```python
from intelligence import (
    EnrichRequest, EnrichResponse, handle_enrich,
    GenerateRequest, GenerateResponse, handle_generate,
)
```

Before the `/health` endpoint, add the two route handlers:

```python
@app.post("/enrich", response_model=EnrichResponse, dependencies=[Depends(verify_auth)])
async def enrich_endpoint(req: EnrichRequest):
    return await handle_enrich(req)


@app.post("/generate", response_model=GenerateResponse, dependencies=[Depends(verify_auth)])
async def generate_endpoint(req: GenerateRequest):
    return await handle_generate(req)
```

- [ ] **Step 2: Verify Scrapling starts without errors**

```bash
cd services/scrapling && python -c "from main import app; print('OK')"
```

Expected: `OK` printed without import errors.

- [ ] **Step 3: Commit**

```bash
git add services/scrapling/main.py
git commit -m "feat(scrapling): mount /enrich and /generate endpoints"
```

---

## Task 7: Next.js Orchestrator Route

**Files:**

- Create: `apps/web/src/app/api/workspace-intelligence/route.ts`

- [ ] **Step 1: Create the orchestrator route**

Create `apps/web/src/app/api/workspace-intelligence/route.ts`:

```typescript
/**
 * POST /api/workspace-intelligence
 *
 * Orchestrator for the enrich + generate pipeline.
 * Proxies to Scrapling's /enrich and /generate endpoints.
 *
 * Actions:
 *   "enrich"              — enrich intelligence only
 *   "generate"            — generate copy from existing intelligence
 *   "enrich_and_generate" — enrich then generate (most common)
 */

import { env } from "@/env";
import { NextResponse } from "next/server";
import { z } from "zod";

const SCRAPLING_URL = env.SCRAPLING_SERVICE_URL ?? "https://scrape.smartout.ai";

const RequestSchema = z.object({
  action: z.enum(["enrich", "generate", "enrich_and_generate"]),
  intelligence: z.record(z.unknown()).nullable(),
  company_name: z.string().min(1).optional(),
  city: z.string().optional(),
  website_url: z.string().optional(),
  org_number: z.string().optional(),
  force_new_queries: z.boolean().optional(),
});

function scraplingHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (env.SCRAPLING_AUTH_TOKEN) {
    headers["Authorization"] = `Bearer ${env.SCRAPLING_AUTH_TOKEN}`;
  }
  return headers;
}

export async function POST(request: Request) {
  let body: z.infer<typeof RequestSchema>;
  try {
    const raw: unknown = await request.json();
    body = RequestSchema.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Require company_name for enrich actions
  if (body.action !== "generate" && !body.company_name) {
    return NextResponse.json({ error: "company_name required for enrich" }, { status: 400 });
  }

  let intelligence = body.intelligence;
  let sourcesAdded: string[] = [];
  let gaps: string[] = [];

  // Step 1: Enrich
  if (body.action === "enrich" || body.action === "enrich_and_generate") {
    try {
      const enrichRes = await fetch(`${SCRAPLING_URL}/enrich`, {
        method: "POST",
        headers: scraplingHeaders(),
        body: JSON.stringify({
          intelligence,
          company_name: body.company_name,
          city: body.city,
          website_url: body.website_url,
          org_number: body.org_number,
          force_new_queries: body.force_new_queries ?? false,
        }),
        signal: AbortSignal.timeout(45_000),
      });

      if (!enrichRes.ok) {
        const errorText = await enrichRes.text().catch(() => "Unknown error");
        console.error("[workspace-intelligence] Enrich failed:", enrichRes.status, errorText);
        return NextResponse.json({ error: "Enrichment failed" }, { status: enrichRes.status });
      }

      const enrichData = await enrichRes.json();
      intelligence = enrichData.intelligence;
      sourcesAdded = enrichData.sources_added;
      gaps = enrichData.gaps_remaining;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[workspace-intelligence] Enrich error:", message);
      return NextResponse.json({ error: "Enrichment failed" }, { status: 500 });
    }
  }

  // Step 2: Generate
  let content = null;
  if (body.action === "generate" || body.action === "enrich_and_generate") {
    if (!intelligence) {
      return NextResponse.json({ error: "No intelligence data for generation" }, { status: 400 });
    }

    try {
      const genRes = await fetch(`${SCRAPLING_URL}/generate`, {
        method: "POST",
        headers: scraplingHeaders(),
        body: JSON.stringify({ intelligence }),
        signal: AbortSignal.timeout(35_000),
      });

      if (!genRes.ok) {
        const errorText = await genRes.text().catch(() => "Unknown error");
        console.error("[workspace-intelligence] Generate failed:", genRes.status, errorText);
        // Return intelligence even if generate fails
        return NextResponse.json(
          {
            intelligence,
            content: null,
            sources_added: sourcesAdded,
            gaps_remaining: gaps,
            error: "Content generation failed",
          },
          { status: 200 },
        );
      }

      content = await genRes.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[workspace-intelligence] Generate error:", message);
      return NextResponse.json(
        {
          intelligence,
          content: null,
          sources_added: sourcesAdded,
          gaps_remaining: gaps,
          error: "Content generation failed",
        },
        { status: 200 },
      );
    }
  }

  return NextResponse.json({
    intelligence,
    content,
    sources_added: sourcesAdded,
    gaps_remaining: gaps,
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm turbo typecheck --filter=web 2>&1 | tail -20
```

Expected: No type errors (or only pre-existing ones unrelated to this file).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/workspace-intelligence/route.ts
git commit -m "feat(join): workspace intelligence orchestrator route"
```

---

## Task 8: Frontend — useWorkspaceIntelligence Hook + Step 3 Update

**Files:**

- Create: `apps/web/src/app/join/_hooks/useWorkspaceIntelligence.ts`
- Modify: `apps/web/src/app/join/_hooks/useSignupWizard.tsx`
- Modify: `apps/web/src/app/join/_components/Step3About.tsx`

- [ ] **Step 1: Create the useWorkspaceIntelligence hook**

Create `apps/web/src/app/join/_hooks/useWorkspaceIntelligence.ts`:

```typescript
"use client";

import { useCallback, useRef, useState } from "react";
import { useSignupWizard } from "./useSignupWizard";

export type IntelligenceStatus = "idle" | "enriching" | "generating" | "done" | "failed";

export interface WorkspaceIntelligenceContent {
  about_us: string;
  our_history: string;
  our_concept: string;
}

interface WorkspaceIntelligence {
  company_name?: string | null;
  founding_date?: string | null;
  [key: string]: unknown;
}

export function useWorkspaceIntelligence() {
  const { state, scrapedData, brregData } = useSignupWizard();
  const [intelligence, setIntelligence] = useState<WorkspaceIntelligence | null>(null);
  const [content, setContent] = useState<WorkspaceIntelligenceContent | null>(null);
  const [status, setStatus] = useState<IntelligenceStatus>("idle");
  const [gapsRemaining, setGapsRemaining] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const buildInitialIntelligence = useCallback((): WorkspaceIntelligence | null => {
    const sources: Record<string, unknown> = {};
    const result: Record<string, unknown> = {
      company_name: state.step1.companyName ?? null,
      city: state.step1.city ?? null,
      website_url: state.step1.websiteUrl ?? null,
      org_number: state.step2?.orgNumber ?? null,
    };

    if (brregData) {
      result.founding_date = brregData.foundingDate ?? null;
      result.address = brregData.street ?? null;
      result.industry = brregData.industry ?? null;
      sources.brreg = { fetched_at: new Date().toISOString() };
    }

    if (scrapedData) {
      result.website_description = scrapedData.description ?? null;
      result.website_about_text = scrapedData.summary ?? null;
      result.email = scrapedData.email ?? null;
      result.phone = scrapedData.phone ?? null;
      result.logo_url = scrapedData.logoUrl ?? null;
      result.social_links = scrapedData.socialLinks ?? {};
      sources.scrape = {
        fetched_at: new Date().toISOString(),
        urls_scraped: [state.step1.websiteUrl].filter(Boolean),
      };
    }

    if (Object.keys(sources).length > 0) {
      result.sources = sources;
    }

    return result as WorkspaceIntelligence;
  }, [state.step1, state.step2, brregData, scrapedData]);

  const callApi = useCallback(
    async (forceNewQueries: boolean) => {
      // Cancel any in-flight request
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const currentIntel = intelligence ?? buildInitialIntelligence();

      setStatus("enriching");
      setContent(null);

      try {
        const res = await fetch("/api/workspace-intelligence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "enrich_and_generate",
            intelligence: currentIntel,
            company_name: state.step1.companyName,
            city: state.step1.city,
            website_url: state.step1.websiteUrl,
            org_number: state.step2?.orgNumber,
            force_new_queries: forceNewQueries,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          setStatus("failed");
          return;
        }

        const data = await res.json();

        if (data.intelligence) {
          setIntelligence(data.intelligence);
        }

        if (data.content?.about_us || data.content?.our_history || data.content?.our_concept) {
          setContent({
            about_us: data.content.about_us ?? "",
            our_history: data.content.our_history ?? "",
            our_concept: data.content.our_concept ?? "",
          });
          setStatus("done");
        } else if (data.error) {
          setStatus("failed");
        } else {
          setStatus("done");
        }

        setGapsRemaining(data.gaps_remaining ?? []);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setStatus("failed");
      }
    },
    [intelligence, buildInitialIntelligence, state.step1, state.step2],
  );

  const enrichAndGenerate = useCallback(() => callApi(false), [callApi]);
  const rewrite = useCallback(() => callApi(true), [callApi]);

  return { intelligence, content, status, gapsRemaining, enrichAndGenerate, rewrite };
}
```

- [ ] **Step 2: Update WizardProvider — remove old AI content**

In `apps/web/src/app/join/_hooks/useSignupWizard.tsx`, make these exact changes:

**a) Remove imports (line 14):**
Delete: `import { useAiContent, type AiContent, type AiStatus } from "./useAiContent";`

**b) Remove from WizardContextValue interface (lines 69-70):**
Delete these two lines:

```typescript
aiContent: AiContent | null;
aiStatus: AiStatus;
```

Note: `brregData` is already exposed in the context (line 64) — no change needed there.

**c) Remove the `useAiContent` hook call (line 103):**
Delete: `const { aiContent, aiStatus, generateContent } = useAiContent();`

**d) Remove `aiTriggeredRef` (line 104):**
Delete: `const aiTriggeredRef = useRef(false);`

**e) Remove the auto-trigger effect (lines 171-190):**
Delete the entire `useEffect` block that auto-triggers AI content generation:

```typescript
  // Auto-trigger AI content generation when entering Step 3
  useEffect(() => {
    if (aiTriggeredRef.current) return;
    // ... entire block ...
  }, [...]);
```

**f) Remove from context value object (near line 268-269):**
Delete: `aiContent,` and `aiStatus,`

- [ ] **Step 3: Update Step3About.tsx — use new hook, add "Skriv på nytt"**

Replace `apps/web/src/app/join/_components/Step3About.tsx`:

```typescript
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useSignupWizard } from "../_hooks/useSignupWizard";
import { useWorkspaceIntelligence } from "../_hooks/useWorkspaceIntelligence";
import { useTypewriterSequence } from "../_hooks/useTypewriter";
import { step3Schema } from "../_lib/validation";
import { AiBadge } from "./AiBadge";

export function Step3About() {
  const { state, updateStep, nextStep, prevStep } = useSignupWizard();
  const { content, status, enrichAndGenerate, rewrite } = useWorkspaceIntelligence();

  const [aboutUs, setAboutUs] = useState(state.step3.aboutUs ?? "");
  const [ourHistory, setOurHistory] = useState(state.step3.ourHistory ?? "");
  const [ourConcept, setOurConcept] = useState(state.step3.ourConcept ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [userEdited, setUserEdited] = useState<Record<string, boolean>>({});

  // Auto-trigger on mount (first time entering Step 3)
  const hasTriggered = useRef(false);
  useEffect(() => {
    if (!hasTriggered.current && status === "idle") {
      hasTriggered.current = true;
      enrichAndGenerate();
    }
  }, [status, enrichAndGenerate]);

  // Build typewriter fields from content
  const hasApplied = useRef(false);
  const typewriterFields = useMemo(() => {
    if (!content || hasApplied.current) return [];
    const fields: Array<{ key: string; value: string }> = [];
    if (content.about_us) fields.push({ key: "aboutUs", value: content.about_us });
    if (content.our_history) fields.push({ key: "ourHistory", value: content.our_history });
    if (content.our_concept) fields.push({ key: "ourConcept", value: content.our_concept });
    return fields;
  }, [content]);

  const shouldType = typewriterFields.length > 0 && !hasApplied.current;
  const {
    values: typedValues,
    activeIndex,
    allDone,
  } = useTypewriterSequence(typewriterFields, shouldType, {
    initialDelay: 200,
    speed: 12,
    gap: 300,
  });

  // Sync typewriter output to state
  useEffect(() => {
    if (!shouldType) return;
    if (typedValues.aboutUs && !userEdited.aboutUs) setAboutUs(typedValues.aboutUs);
    if (typedValues.ourHistory && !userEdited.ourHistory) setOurHistory(typedValues.ourHistory);
    if (typedValues.ourConcept && !userEdited.ourConcept) setOurConcept(typedValues.ourConcept);
  }, [typedValues, shouldType, userEdited]);

  // Mark done
  useEffect(() => {
    if (allDone && shouldType) hasApplied.current = true;
  }, [allDone, shouldType]);

  // Reset typewriter when new content arrives (from "Skriv på nytt")
  useEffect(() => {
    if (content && hasApplied.current) {
      hasApplied.current = false;
      setUserEdited({});
    }
  }, [content]);

  const markEdited = (field: string) => {
    setUserEdited((prev) => ({ ...prev, [field]: true }));
  };

  const handleRewrite = () => {
    hasApplied.current = false;
    setUserEdited({});
    rewrite();
  };

  const handleNext = () => {
    const result = step3Schema.safeParse({
      aboutUs,
      ourHistory: ourHistory || undefined,
      ourConcept,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as string;
        fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    updateStep("step3", result.data);
    nextStep();
  };

  const typingField =
    activeIndex >= 0 && activeIndex < typewriterFields.length
      ? typewriterFields[activeIndex]!.key
      : null;

  const isLoading = status === "enriching" || status === "generating";

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div>
        <h2 className="text-foreground text-2xl font-bold">Fortell om bedriften</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Dette brukes til opplaering og onboarding av ansatte.
        </p>
        {isLoading && (
          <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
            <Loader2 className="h-3 w-3 animate-spin" />
            {status === "enriching" ? "Henter informasjon..." : "Skriver utkast..."}
          </p>
        )}
        {allDone && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-orange-500">
            <Sparkles className="h-3 w-3" />
            Utkast fylt ut — rediger fritt
          </p>
        )}
        {status === "failed" && (
          <p className="text-muted-foreground mt-2 text-xs">
            Kunne ikke generere utkast. Fyll inn manuelt.
          </p>
        )}
      </div>

      <div className="space-y-4">
        <TypewriterTextarea
          label="Om oss"
          id="aboutUs"
          rows={3}
          placeholder="Beskriv bedriften din..."
          value={aboutUs}
          typing={typingField === "aboutUs"}
          autoFilled={allDone && !userEdited.aboutUs && !!content?.about_us}
          onChange={(val) => {
            setAboutUs(val);
            markEdited("aboutUs");
            setErrors((prev) => ({ ...prev, aboutUs: "" }));
          }}
          onClearAi={() => {
            setAboutUs("");
            markEdited("aboutUs");
          }}
          error={errors.aboutUs}
        />

        <TypewriterTextarea
          label="Vår historie"
          labelSuffix="(valgfritt)"
          id="ourHistory"
          rows={2}
          placeholder="Fortell historien bak bedriften..."
          value={ourHistory}
          typing={typingField === "ourHistory"}
          autoFilled={allDone && !userEdited.ourHistory && !!content?.our_history}
          onChange={(val) => {
            setOurHistory(val);
            markEdited("ourHistory");
          }}
          onClearAi={() => {
            setOurHistory("");
            markEdited("ourHistory");
          }}
        />

        <TypewriterTextarea
          label="Vårt konsept"
          id="ourConcept"
          rows={3}
          placeholder="Hva gjor dere unike?"
          value={ourConcept}
          typing={typingField === "ourConcept"}
          autoFilled={allDone && !userEdited.ourConcept && !!content?.our_concept}
          onChange={(val) => {
            setOurConcept(val);
            markEdited("ourConcept");
            setErrors((prev) => ({ ...prev, ourConcept: "" }));
          }}
          onClearAi={() => {
            setOurConcept("");
            markEdited("ourConcept");
          }}
          error={errors.ourConcept}
        />
      </div>

      {/* "Skriv på nytt" button — always visible */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleRewrite}
        disabled={isLoading}
        className="w-full border-orange-200 text-orange-600 hover:bg-orange-50"
      >
        <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
        Skriv på nytt
      </Button>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={prevStep} className="flex-1">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Tilbake
        </Button>
        <Button
          type="button"
          onClick={handleNext}
          className="flex-1 bg-orange-500 text-white hover:bg-orange-600"
        >
          Neste
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/* -- Typewriter textarea wrapper -- */

function TypewriterTextarea({
  label,
  labelSuffix,
  id,
  rows,
  placeholder,
  value,
  typing,
  autoFilled,
  onChange,
  onClearAi,
  error,
}: {
  label: string;
  labelSuffix?: string;
  id: string;
  rows: number;
  placeholder: string;
  value: string;
  typing: boolean;
  autoFilled: boolean;
  onChange: (val: string) => void;
  onClearAi: () => void;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Label htmlFor={id}>
            {label}
            {labelSuffix && <span className="text-muted-foreground ml-1">{labelSuffix}</span>}
          </Label>
          {typing && (
            <span className="flex animate-pulse items-center gap-0.5 text-[10px] text-orange-500">
              <Sparkles className="h-2.5 w-2.5" />
            </span>
          )}
        </div>
        {autoFilled && !typing && <AiBadge onClear={onClearAi} />}
      </div>
      <Textarea
        id={id}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
      />
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
pnpm turbo typecheck --filter=web
```

Expected: No new type errors from the changed files.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/join/_hooks/useWorkspaceIntelligence.ts \
       apps/web/src/app/join/_hooks/useSignupWizard.tsx \
       apps/web/src/app/join/_components/Step3About.tsx
git commit -m "feat(join): useWorkspaceIntelligence hook + Step 3 rewrite with 'Skriv på nytt'"
```

---

## Task 9: Cleanup — Remove Old Code

**Files:**

- Delete: `apps/web/src/app/join/_hooks/useAiContent.ts`
- Delete: `apps/web/src/app/api/generate-content/route.ts`
- Modify: `apps/web/src/app/join/_components/SignupWizard.tsx` (remove old AI status refs if any)

- [ ] **Step 1: Delete useAiContent hook**

```bash
git rm apps/web/src/app/join/_hooks/useAiContent.ts
```

- [ ] **Step 2: Delete old generate-content route**

```bash
git rm apps/web/src/app/api/generate-content/route.ts
```

- [ ] **Step 2b: Remove old `/generate-content` endpoint from Scrapling main.py**

In `services/scrapling/main.py`, delete the old generate-content code (lines ~540-628):

- `GenerateContentRequest` class
- `GenerateContentResponse` class
- `_build_content_prompt()` function
- `_extract_json()` function (now lives in `intelligence.py`)
- `@app.post("/generate-content", ...)` endpoint

These are replaced by `/enrich` + `/generate` from `intelligence.py`.

- [ ] **Step 3: Verify no remaining imports of deleted files**

```bash
cd /home/sxtnl/dev/smartout.ai && grep -r "useAiContent\|generate-content" apps/web/src/ --include="*.ts" --include="*.tsx"
```

Expected: No matches (or only this plan file if grep catches docs).

- [ ] **Step 4: Run typecheck to confirm nothing is broken**

```bash
pnpm turbo typecheck --filter=web
```

Expected: No new type errors.

- [ ] **Step 5: Commit**

```bash
git add -A apps/web/src/app/join/_hooks/useAiContent.ts \
          apps/web/src/app/api/generate-content/route.ts
git commit -m "refactor(join): remove old useAiContent hook and /api/generate-content route"
```

---

## Task 10: Integration Test — End-to-End Verification

**No new files.** Manual verification that the full pipeline works.

- [ ] **Step 1: Start Scrapling service**

```bash
cd services/scrapling && python main.py
```

Verify: `/health` returns 200.

- [ ] **Step 2: Test /enrich endpoint directly**

```bash
curl -X POST http://localhost:8000/enrich \
  -H "Content-Type: application/json" \
  -d '{"company_name": "Solsiden", "city": "Trondheim", "org_number": "920692692"}'
```

Expected: JSON response with `intelligence.founding_date` set, `sources.brreg` populated, `gaps_remaining` includes "web_search".

- [ ] **Step 3: Test /generate endpoint directly**

```bash
curl -X POST http://localhost:8000/generate \
  -H "Content-Type: application/json" \
  -d '{"intelligence": {"company_name": "Solsiden", "city": "Trondheim", "founding_date": "2004-06-15", "years_in_business": 22, "industry": "Drift av restauranter og kafeer", "concept_clues": ["sjomat", "uteservering"]}}'
```

Expected: JSON with `about_us`, `our_history`, `our_concept` — each under 300 characters, no invented facts.

- [ ] **Step 4: Test full wizard flow in browser**

1. Go to `http://localhost:3060/join`
2. Fill Step 1 (email, company name, industry, city, website)
3. Fill Step 2 (name, address, org number)
4. Advance to Step 3
5. Verify: Loading indicator shows, then typewriter animation fills all three fields
6. Click "Skriv på nytt" — verify new text appears
7. Edit a field manually, click "Skriv på nytt" — verify edited field is overwritten with new AI text

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A && git commit -m "fix(join): integration fixes for workspace intelligence pipeline"
```
