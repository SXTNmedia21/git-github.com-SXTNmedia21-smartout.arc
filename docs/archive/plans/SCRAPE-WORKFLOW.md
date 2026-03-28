---
title: Scrape Workflow — Company Website Intelligence
status: draft
updated: 2026-03-11
created: 2026-03-11
module: signup
tags: [scraping, onboarding, signup, ai]
---

# Scrape Workflow — Company Website Intelligence

## Purpose

When a new customer enters their website URL in the join wizard (Step 1), we scrape the site to pre-fill as much of the signup as possible. The goal: **the customer types a URL and gets a wizard that already knows their business.**

---

## Current Data Flow

```
Step1: User types URL (debounced 1s)
  → POST /api/scrape/company { url }
    → Scrapling service POST /extract { url, config }
      → Fetch HTML (with SSL fallback)
      → Extract structured data
      → Return JSON
    → Store in company_scraped_data table
  → Client polls GET /api/scrape/company every 3s (max 30s)
  → scrapedData available to all wizard steps

Step3: AI generates about_us, our_history, our_concept
  → POST /api/generate-content { companyName, scrapedData }
  → Claude Sonnet via OpenRouter
  → Pre-fills text fields
```

---

## What We Extract Today

| Field              | Source                                            | Method            | Reliability                            |
| ------------------ | ------------------------------------------------- | ----------------- | -------------------------------------- |
| **companyName**    | `<title>` tag                                     | CSS selector      | Medium — often includes tagline/slogan |
| **email**          | `mailto:` links, then regex on text               | Link scan + regex | Good                                   |
| **phone**          | `tel:` links, then Norwegian 8-digit regex        | Link scan + regex | Good for NO                            |
| **description**    | `<meta name="description">`                       | CSS selector      | Good when present                      |
| **summary**        | Meta description, fallback: first 300 chars       | Derived           | Low quality                            |
| **logoUrl**        | apple-touch-icon → og:image → favicon → img[logo] | Priority cascade  | Good                                   |
| **socialLinks**    | Links to facebook/instagram/linkedin/tiktok       | URL pattern match | Good                                   |
| **reservationUrl** | Links to resdiary/sevenrooms/bookatable etc.      | URL + text match  | Good for hospitality                   |
| **menus**          | Links with "meny/menu/mat/drikke" or .pdf         | Text + URL match  | Medium                                 |
| **images**         | All `<img>` tags (max 10, excluding icons)        | CSS selector      | Good                                   |
| **locations**      | Auto-generated from industry + keywords           | Keyword heuristic | Low — very generic                     |
| **departments**    | Auto-generated from industry + keywords           | Keyword heuristic | Low — very generic                     |

### Deep Scrape

- Finds "om oss" / "about" links and scrapes that page too
- Appends text content for richer context

---

## What We SHOULD Extract (Upgrade Plan)

### Tier 1 — Critical (directly fills wizard fields)

| Data Point                  | Where to Find                            | How to Extract                                                         | Feeds Into       |
| --------------------------- | ---------------------------------------- | ---------------------------------------------------------------------- | ---------------- |
| **Company name (clean)**    | `<title>`, og:site_name, structured data | Priority: `og:site_name` > Schema.org name > `<title>` (strip tagline) | Step 1           |
| **Org number**              | Footer, "om oss" page, Proff.no link     | Regex: `\d{3}\s?\d{3}\s?\d{3}` (9 digits)                              | Step 2           |
| **Address**                 | Footer, contact page, Schema.org         | Schema.org `PostalAddress`, or structured footer scan                  | Step 2           |
| **Opening hours**           | Footer, contact page, Schema.org, Google | Schema.org `OpeningHoursSpecification`                                 | Operations setup |
| **Menu items / categories** | /meny, /menu, PDF menus                  | Scrape menu page structure, PDF text extraction                        | Step 5 (Meny)    |
| **Team members / roles**    | /team, /om-oss, /about                   | Name + title extraction from team sections                             | Step 6 (Team)    |

### Tier 2 — Valuable (enriches AI content generation)

| Data Point                  | Where to Find                     | How to Extract                                      | Feeds Into         |
| --------------------------- | --------------------------------- | --------------------------------------------------- | ------------------ |
| **About us text**           | /om-oss, /about, /historie        | Full paragraph extraction from about page           | Step 3 (AI)        |
| **History / founding year** | About page, footer ("since 2015") | Regex year + surrounding text                       | Step 3 (AI)        |
| **Concept / unique value**  | About page, hero section          | First 2-3 paragraphs of about page                  | Step 3 (AI)        |
| **Price range**             | Menu, TripAdvisor, Google         | Menu prices, price indicators                       | AI context         |
| **Cuisine type**            | Meta, menu, headings              | Keywords: "italiensk", "nordisk", "sushi", etc.     | Industry detection |
| **Awards / certifications** | About page, footer                | Keywords: "michelin", "white guide", "bib gourmand" | AI context         |
| **Capacity / seats**        | About page, booking widgets       | Regex or structured data                            | Operations setup   |

### Tier 3 — Nice to Have (competitive intelligence)

| Data Point             | Where to Find                        | How to Extract                       | Feeds Into  |
| ---------------------- | ------------------------------------ | ------------------------------------ | ----------- |
| **Google rating**      | Google Places API (requires API key) | API call with company name + address | Dashboard   |
| **TripAdvisor rating** | TripAdvisor (blocked, needs Apify)   | Apify actor                          | Dashboard   |
| **Competitor set**     | Google Maps nearby                   | API call                             | AI context  |
| **Review themes**      | Google/TA reviews                    | NLP analysis                         | AI insights |

---

## Scrape Strategy Per Page

### 1. Homepage (always scraped)

```
Extract:
- <title>, og:site_name → company name
- meta description → summary
- Logo (priority cascade)
- Email (mailto: links)
- Phone (tel: links, then regex)
- Social links (footer/header)
- Reservation links
- Menu links
- Navigation structure → find about/team/menu/contact pages
```

### 2. About Page (/om-oss, /about, /historie)

```
Navigate: Find link with "om oss", "about", "om-" in href
Extract:
- Full paragraph text → about_us, history, concept (for AI)
- Founding year regex: "siden (\d{4})", "established (\d{4})", "grunnlagt (\d{4})"
- Team section if present
- Awards/certifications mentions
```

### 3. Contact Page (/kontakt, /contact)

```
Navigate: Find link with "kontakt", "contact"
Extract:
- Address (structured: street, postal code, city)
- Phone (backup if not found on homepage)
- Email (backup)
- Opening hours (often listed here)
- Map embed → lat/lng
- Org number (often in footer of contact page)
```

### 4. Menu Page (/meny, /menu)

```
Navigate: Find link with "meny", "menu"
Extract:
- Menu categories (h2/h3 headings)
- Item names + prices
- PDF links for download menus
- Dietary indicators (vegetar, vegan, glutenfri)
```

### 5. Team Page (/team, /ansatte, /om-oss#team)

```
Navigate: Find link with "team", "ansatte", "medarbeidere"
Extract:
- Person names + titles/roles
- Department groupings (if structured with headings)
- Profile images
```

### 6. Footer (always scanned)

```
Extract from every page:
- Org number: 9-digit pattern (xxx xxx xxx)
- Address (last resort)
- Phone/email (last resort)
- Social links (last resort)
- "Since YYYY" / founding year
- Copyright entity name
```

---

## Structured Data Sources (Priority)

These are the most reliable and should be checked FIRST:

### Schema.org / JSON-LD

```html
<script type="application/ld+json">
  {
    "@type": "Restaurant",
    "name": "Restaurant X",
    "address": { "@type": "PostalAddress", ... },
    "telephone": "+47 12 34 56 78",
    "openingHoursSpecification": [...],
    "servesCuisine": "Italian",
    "priceRange": "$$"
  }
</script>
```

**Extract:** name, address, phone, openingHours, cuisine, priceRange, image, geo coordinates

### Open Graph

```html
<meta property="og:site_name" content="Restaurant X" />
<meta property="og:description" content="..." />
<meta property="og:image" content="..." />
```

### Microdata (less common)

```html
<div itemscope itemtype="http://schema.org/Restaurant">
  <span itemprop="name">Restaurant X</span>
  ...
</div>
```

---

## Industry Detection (Improved)

Current: Keyword matching on page text + optional NACE code.

### Better approach:

1. **Schema.org @type** — most reliable:
   - `Restaurant`, `FoodEstablishment`, `BarOrPub` → hospitality
   - `Hotel`, `LodgingBusiness` → hospitality/hotel
   - `Store`, `ShoppingCenter` → retail
   - `MedicalBusiness` → health

2. **NACE code** (if provided by user or from Brønnøysund):
   - `55.x` → accommodation
   - `56.x` → food/beverage
   - `47.x` → retail
   - `62.x/63.x` → tech

3. **Keyword scoring** (fallback):
   ```
   hospitality_score += 1 for each: restaurant, meny, kjøkken, servering, chef, bord, reservasjon, mat
   retail_score += 1 for each: butikk, nettbutikk, handlekurv, produkt, frakt
   tech_score += 1 for each: software, saas, api, plattform, teknologi
   ```
   Highest score wins.

---

## External Enrichment (Future)

### Brønnøysund / Proff.no

- Input: company name or org number
- Output: legal name, org number, address, NACE code, founding date, number of employees
- Method: Proff.no scrape or Brønnøysund API

### Google Places API

- Input: company name + city
- Output: address, phone, rating, opening hours, photos, reviews
- Method: Places API (requires API key)

---

## Output Format (Target)

What the scraper should return after all improvements:

```json
{
  "companyName": "Café Oslo",
  "legalName": "Café Oslo AS",
  "orgNumber": "123 456 789",
  "industry": "hospitality",
  "industrySubtype": "restaurant_cafe",
  "naceCode": "56.101",

  "contact": {
    "email": "hei@cafeoslo.no",
    "phone": "+47 22 33 44 55",
    "address": {
      "street": "Karl Johans gate 1",
      "postalCode": "0154",
      "city": "Oslo",
      "country": "NO"
    }
  },

  "online": {
    "website": "https://cafeoslo.no",
    "logoUrl": "https://cafeoslo.no/logo.png",
    "socialLinks": {
      "instagram": "https://instagram.com/cafeoslo",
      "facebook": "https://facebook.com/cafeoslo"
    },
    "reservationUrl": "https://resdiary.com/cafeoslo",
    "menuLinks": [{ "href": "https://cafeoslo.no/meny", "text": "Meny" }]
  },

  "content": {
    "description": "Meta description text",
    "aboutText": "Full about us paragraph...",
    "historyText": "Founded in 2015...",
    "foundingYear": 2015,
    "awards": ["Bib Gourmand 2024"],
    "cuisine": ["Nordic", "Seasonal"]
  },

  "operations": {
    "openingHours": {
      "mon": { "open": "11:00", "close": "23:00" },
      "tue": { "open": "11:00", "close": "23:00" }
    },
    "capacity": 80,
    "priceRange": "$$"
  },

  "structure": {
    "locations": [
      { "name": "Bar", "type": "Indoor" },
      { "name": "Uteservering", "type": "Outdoor" }
    ],
    "departments": [
      { "name": "Kjøkken", "roles": ["Head Chef", "Sous Chef", "Line Cook"] },
      { "name": "Service", "roles": ["Hovmester", "Servitør", "Bartender"] }
    ],
    "teamMembers": [{ "name": "Ole Hansen", "role": "Kjøkkensjef", "image": "..." }]
  },

  "menu": {
    "categories": ["Forretter", "Hovedretter", "Desserter", "Drikke"],
    "items": [
      { "name": "Tartar", "category": "Forretter", "price": 189 },
      { "name": "Entrecôte", "category": "Hovedretter", "price": 389 }
    ]
  },

  "meta": {
    "scrapedAt": "2026-03-11T14:30:00Z",
    "pagesScraped": ["homepage", "about", "menu", "contact"],
    "confidence": {
      "companyName": "high",
      "address": "medium",
      "departments": "low"
    }
  }
}
```

---

## Implementation Priority

### Phase 1 — Fix what exists (now)

1. Add Schema.org/JSON-LD extraction (highest signal, lowest effort)
2. Add `og:site_name` for cleaner company names
3. Scrape contact page (address, backup phone/email)
4. Extract org number from footer/contact page
5. Add founding year regex

### Phase 2 — Multi-page intelligence

1. Navigate and scrape menu page → categories + items
2. Navigate and scrape team page → names + roles
3. Opening hours extraction (Schema.org + text patterns)
4. Footer scanning on every page

### Phase 3 — External enrichment

1. Proff.no / Brønnøysund lookup → legal name, org number, NACE, address
2. Google Places API → rating, photos, verified hours
3. Menu PDF extraction (already supported via /extract/document)

---

## Known Issues

1. **SCRAPLING_SERVICE_URL** — must be set in env. Returns 503 if missing.
2. **Scrapling container** — must be running in Docker. Check: `docker ps | grep scrapling`
3. **Default NACE code** — route.ts hardcodes `56.101` (restaurant) as fallback. Fine for MVP but should be dynamic.
4. **companyName from `<title>`** — often includes taglines ("Café Oslo — Best coffee in town"). Need to strip.
5. **No structured data extraction** — JSON-LD/Schema.org is ignored. This is the single biggest improvement.
6. **Phone regex Norwegian-only** — fine for now (Norwegian market only).
7. **Locations/departments are heuristic** — generated from keywords, not actual website data. Low value.
