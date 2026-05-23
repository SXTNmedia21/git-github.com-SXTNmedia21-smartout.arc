---
title: "Scrapling Domain — Overview"
status: done
updated: 2026-05-23
created: 2026-05-23
domain: scrapling
tags: [scrapling, research, scraping, brreg, google-places, serper, onboarding, lead-research]
mirror: verified
last_verified: 2026-05-23
---

# Overview — Scrapling

## What

Scrapling is a Python FastAPI microservice (`services/scrapling/`, port 8000) that provides structured knowledge about real-world businesses to the Smartout onboarding pipeline and the godmode Botsson persona.

It does three things:

1. **Company identification** — searches BRREG (Brønnøysundregisteret) by fuzzy name + city, confirms via org-number, returns structured Norwegian company data (official name, address, NACE codes, founding date, org-form).

2. **Company enrichment** — parallel pipeline: BRREG + website scrape + Google Places v1 + Serper web-search. Produces a `WorkspaceIntelligence` struct with concept clues, cuisine types, price category, social links, menus, reservation URL, ratings.

3. **Lead research** — scans a city via Google Places Text Search, fetches details per place, scrapes email from each website. Returns a ranked list of hospitality businesses for prospect analysis (godmode-only).

A secondary role is **document extraction** — PDF/DOCX/XLSX/CSV/image files uploaded during onboarding are passed to `POST /extract/document`, which returns structured text + image list. This feeds the onboarding wizard's "learning content pipeline" (Step 7+).

## Why

The Smartout onboarding wizard Step 3 ("Generer utkast") needs rich company data before the owner fills in any form fields. Instead of making the owner copy-paste their own "about us" text, the wizard pre-fills `about_us`, `our_history`, `our_concept`, `menu_description`, `cuisine_types`, `price_category` from verified external sources. A 5–10 second enrichment call at the right moment replaces 30 minutes of manual form-filling for every new workspace onboarding.

The godmode lead-research layer enables Botsson-assisted prospect discovery from `/platform-admin/*` surfaces — a sales/CRM function that is deliberately separated from the workspace onboarding flow.

## Cascade Placement

Scrapling is **not a cascade dimension**. It sits in the **service plane** — a cross-cutting infrastructure service that feeds the onboarding pipeline at workspace creation time (pre-I1) and supports platform-admin research at any time.

```
Service plane (Scrapling)
        │
        ├── feeds → I1 Bootstrap (workspace creation / finalize-workspace EF)
        │           via /extract (website scrape) + /brreg-search + /brreg-lookup
        │
        ├── feeds → D5 Concept parameters (cuisine_types, price_category, concept_clues)
        │           via WorkspaceIntelligence merged into workspace step 3 form
        │
        └── feeds → Platform-Admin tooling (godmode only)
                    via business_intelligence capability (ADR-0270)
```

The cascade does not reach into scrapling at runtime — scrapling produces onboarding artifacts, not operational data.

## Primary Consumer: Onboarding Wizard

The wizard's "know-the-company" pipe uses three BFF bridge tools (in `packages/ai/src/capabilities/onboarding/tools.ts`):

- `scrape_website` → calls `/extract` (structured) or `/scrape-raw` (raw)
- `search_company` → calls `/brreg-search` (fuzzy BRREG search with Places fallback)
- `identify_company` → calls `/brreg-lookup` (org-number direct lookup)

These are supplemented by the `/api/workspace-intelligence` Next.js route handler (Step 3 direct enrichment via `/enrich` + `/generate`).

## Secondary Consumer: Godmode Business Intelligence

The `business_intelligence` capability (`packages/ai/src/capabilities/business-intelligence/`) exposes 6 tools to the `direct_admin` persona (ADR-0270). This surface is **never** accessible to workspace users — only Pontus and platform-admin users.
