---
title: Onboarding Redesign Specification
status: draft
updated: 2026-03-03
created: 2026-03-03
module: onboarding
tags: [onboarding, wizard, redesign, spec, design]
---

# Onboarding Redesign Specification

> **Date:** March 3, 2026
> **Status:** Draft — awaiting Pontus review
> **Scope:** Replace the current 11-step wizard with a simplified, traditional onboarding that feels like a dashboard from step one.
> **Input:** Voice notes (March 3), screenshots of current wizard, PRD_URL_SCRAPE_ONBOARDING (Feb 24), project documentation

---

## 0. What Changed (And Why)

The current onboarding is an 11-step wizard with educational screens, concept explanations, and multiple choice types (permanent vs. temporal seasons, branding setup, etc.). It looks like a separate experience from the product.

**Problems identified:**

1. **Too concept-heavy.** The "Why Seasons?" explainer card (current Step 5) teaches before the admin even knows what they need. Restaurants don't want a lecture — they want to get going.
2. **Branding step is premature.** Logo, slogan, brand color, communication tone (current Step 4) — none of this is needed to start operations. Remove entirely for now.
3. **Permanent vs. Temporal season choice is confusing.** Most first-time users don't know which one they need. The system should just create a sensible default.
4. **It doesn't feel like the product.** The wizard is a separate, isolated experience. It should feel like you're already inside Smartout's dashboard.
5. **Scraping doesn't work yet.** The URL-scrape flow (PRD from Feb 24) is the right vision but isn't functional. That needs to land before the onboarding can be truly "zero brain work."

**New direction:** Traditional onboarding, simple and fast. Teach concepts while the user configures — not in separate educational screens. Dashboard-like design from the start. Scroll-based, not modal-based.

---

## 1. The New Flow

### Overview

```
Landing page -> Sign up -> Enter URL / Org number
  -> Scrape + Brønnøysund -> Pre-fill review
  -> Create Season (simplified)
  -> Departments (confirm, don't create)
  -> Contract generation
  -> Dashboard (you're in)
```

**From 11 steps to 5 functional steps.** No educational interstitials. No branding. No permanent/temporal choice.

### Step-by-Step Breakdown

### Step 1: Sign Up

**What happens:** Standard auth. Email+password or Google/Microsoft SSO.

**After signup, system auto-creates:**

- Company (shell — populated next step)
- CompanyMember (role: owner)
- Workspace (shell)
- Profile (role: owner, status: active)
- Default Season (auto-created, name: "Standard drift")
- Stripe subscription (trial starts)

**No changes from current plan.** This is already specced in Module 1.

### Step 2: "Fortell oss om bedriften din" (Tell Us About Your Business)

**Design:** Dashboard-style card. Not a wizard modal. Fixed scroll layout.

**Two input options (tabs or toggle):**

| Option       | Input         | What happens                                                                                |
| ------------ | ------------- | ------------------------------------------------------------------------------------------- |
| **Nettside** | URL field     | Scrape homepage -> extract name, address, phone, opening hours, industry, logo, description |
| **Org.nr**   | 9-digit field | Hit data.brreg.no -> get legal name, address, industry code (NACE), business form           |

**If both are provided:** Merge. Brønnøysund data is authoritative for legal fields (name, org number, address). Scraped data fills the rest (logo, opening hours, description).

**What gets saved:**

- company.name, company.legal*name, company.org_number, company.industry, company.address*\*, company.phone, company.website, company.logo_url
- workspace.name (= company name), workspace.address\_\*, workspace.logo_url
- First location record created from the address

### Step 3: "Sett opp din forste sesong" (Set Up Your First Season)

**Design:** Single card, dashboard-style. No "Why Seasons?" explainer. The concept is taught inline through microcopy.

**Key changes from current design:**

- **No permanent/temporal choice.** Removed entirely. First season is always temporal with sensible defaults.
- **No "I understand, let's build one" button.** No educational screen. The season card IS the action.
- **Pre-filled intelligently.** AI suggests season name based on current date and industry. Dates default to current quarter.
- **Revenue + margin fields replace the removed permanent/temporal toggle.**
- **Skip is always available.** Creates a "Standard drift" season with no dates.

### Step 4: "Avdelinger" (Departments)

**Design:** Dashboard card with pre-filled suggestions. Confirm-first, not create-first.

**Key changes from current design:**

- **Pre-selected defaults.** For restaurants: Kjokken, Sal, Bar are checked by default.
- **"Use in Season" checkbox removed.** Departments are permanent structure.
- **No "Setup Teams" button.** Teams are deferred to dashboard.
- **Simpler visual.** Toggle chips instead of card-with-remove-button.

**Auto-cascade:** When departments are confirmed, the system also creates default positions per department (based on industry).

### Step 5: "Kontrakt" (Contract Template)

**Design:** Final step before dashboard. Generate a contract template based on everything we know.

### Done -> Dashboard

After Step 5, the admin lands on the workspace dashboard with a summary of what was created and next steps.

---

## 2. What Got Removed (And Where It Goes)

| Old Step         | What                                    | Decision            | Where it lives now                            |
| ---------------- | --------------------------------------- | ------------------- | --------------------------------------------- |
| Step 4 (old)     | Your Branding & Voice                   | **Removed**         | Settings -> Workspace -> Branding             |
| Step 5 (old)     | The Concept of Seasons (explainer)      | **Removed**         | Inline microcopy in Season step               |
| Step 5 (old)     | Permanent vs. Temporal toggle           | **Removed**         | Not needed                                    |
| Step 6 (old)     | "Use in Season" checkbox on departments | **Removed**         | Departments are always permanent              |
| Step 6 (old)     | "Setup Teams" flow                      | **Deferred**        | Dashboard -> Org Structure -> Teams           |
| Locations        | Location/zone setup                     | **Auto-created**    | First location from scraped address           |
| Positions        | Position definition                     | **Auto-created**    | Default positions per department per industry |
| Assets           | Asset definition                        | **Deferred**        | Dashboard -> Org Structure -> Assets          |
| Teams            | Team creation                           | **Deferred**        | Dashboard -> Org Structure -> Teams           |
| Settings         | Workspace settings                      | **Auto-configured** | Timezone auto-detected, language from browser |
| Module selection | Which modules to enable                 | **Deferred**        | Dashboard -> Settings -> Modules              |

---

## 3. Design Principles

### 3.1 Dashboard From Day One

The onboarding should look and feel like the actual Smartout dashboard. Same navigation shell (sidebar, header), same card style, same typography.

### 3.2 Confirm, Don't Create

Every step should pre-fill as much as possible. The admin's job is to review and confirm — not to type from scratch.

### 3.3 Scroll-Based, Not Step-Based

Consider a scroll-based layout where all sections are visible on one page. Each section is a card. **Alternative:** Step-based for V1, scroll-based later.

### 3.4 Teach By Doing

No separate educational screens. Every concept explained in 1-2 lines of microcopy within the card.

---

## 4. Technical Dependencies

### 4.1 URL Scraper (Critical Path)

Status: Scrapling service exists and works. gather-workspace-intelligence Edge Function exists. Needs testing and reliability improvements.

### 4.2 Brønnøysundregistrene API

Endpoint: https://data.brreg.no/enhetsregisteret/api/enheter/{orgnr}
Status: Public API, already integrated client-side in OrgVerificationStep. Moving to Edge Function.

### 4.3 Contract Generation

Pre-built template with merge fields. DocuSeal integration for e-signatures.

### 4.4 Auto-Cascade Logic

| Department   | Default Positions                 |
| ------------ | --------------------------------- |
| Kjokken      | Kokk, Sous Chef, Kjokkenassistent |
| Sal          | Servitor, Hovmester               |
| Bar          | Bartender, Barback                |
| Ledelse      | Daglig leder, Skiftleder          |
| Event        | Eventkoordinator                  |
| Housekeeping | Renholder                         |

---

## 5. Data Model Changes

### New Fields on season

- expected_revenue decimal NULL
- target_margin decimal NULL (percentage)

---

## 6. Open Questions

1. Scroll-based vs. step-based? Recommendation: step-based for V1.
2. What happens when scraping fails? Fallback to manual entry with Brreg data.
3. Mr. Botsson during onboarding? Toggle available as future enhancement.
4. Revenue/margin fields — where do they surface? Reports module eventually.
5. Contract generation scope — needed during onboarding or defer to first invite?

---

_This spec turns 11 steps of "tell us everything" into 5 steps of "we already know — just confirm."_
