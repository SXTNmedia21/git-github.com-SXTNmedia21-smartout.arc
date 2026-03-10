---
title: "Signup Flow Design"
status: approved
updated: 2026-03-10
created: 2026-03-10
module: onboarding
tags: [signup, wizard, scraping, ai]
---

# Signup Flow Design

## Goal

Replace the current `/signup` + `/onboarding` with a single-page wizard at `/join` that feels like a journey. Scraping auto-fills fields live. AI generates content suggestions. The system works FOR the user.

## Architecture

```
/signup (auth page)
  -> Google OAuth / Magic Link / Password
  -> Auth callback -> check signup_progress
  -> Redirect to /join or /join?step=X (resume)

/join (single-page wizard, requires auth)
  -> 6 steps + loading, smooth transitions
  -> State in React context + persisted to signup_progress
  -> URL: /join?step=1..6
  -> Scraping triggers on URL input in step 1
  -> Auto-fill fields live as scraped data arrives
  -> Next.js API route generates AI text suggestions
  -> Loading step creates all DB records -> redirect /dashboard
```

## Flow

```
Landing -> "Opprett konto" -> /signup (auth)
  -> New user? -> /join (wizard)
  -> Existing user without completed signup? -> /join?step=X (resume)
  -> Existing user with completed signup? -> /dashboard
```

## Wizard Steps

### Step 1: Konto + Nettside

- Email (readonly, pre-filled from auth)
- Company name (required, min 2 chars)
- Website URL (required, valid URL)
- On URL input (debounced 1s): trigger scraping async

### Step 2: Bedriftsdetaljer

- First name (pre-fill from Google SSO given_name)
- Last name (pre-fill from Google SSO family_name)
- Street address (required, auto-fill from scraping)
- Postal code (required, 4 digits, auto-fill from scraping)
- City (required, auto-fill from scraping)
- Org number (required, 9 digits, Norwegian modulus 11 validation)

### Step 3: Om oss (AI-generated)

- About us (textarea, required, min 20 chars)
- Our history (textarea, optional)
- Our concept (textarea, required, min 20 chars)
- AI suggestions from scraped data via Next.js API route
- "Generert fra nettsiden din" badge on AI-filled fields
- "Skriv pa nytt" button to clear a field

### Step 4: Apningstider + Kontakt

- Opening hours grid (7 days, open/close time, "Stengt" checkbox)
- Phone (required)
- Instagram URL (optional)
- Facebook URL (optional)
- Pre-fill from scraped data

### Step 5: Meny + Tilbud (OPTIONAL)

- Restaurant type (select)
- Cuisine types (multi-select)
- Price category (select)
- Menu description (textarea, optional)
- "Hopp over" link visible
- Pre-fill restaurant type and cuisine from scraped data

### Step 6: Team (OPTIONAL)

- Employee count (select: 1-5, 6-15, 16-30, 31-50, 50+)
- Invite team members (dynamic email list, "+Legg til" button)
- "Hopp over" link visible

### Loading -> Dashboard

- Animated loading screen with rotating status messages
- Creates all DB records in order
- Sends team invitations async
- Redirects to /dashboard

## Database Changes

### New table: signup_progress

- Wizard resume capability
- auth_id (unique, FK to auth.users)
- current_step, step_data (jsonb)

### New table: company_scraped_data

- Scraping results storage
- auth_id (FK), workspace_id (FK, set after setup)
- source_url, scrape_status (pending/success/partial/failed)
- raw_data, parsed_data (jsonb)

### New table: company_details

- Extended company info (1:1 with workspace)
- org_number, address, phone
- about_us, our_history, our_concept
- restaurant_type, cuisine_types, price_category
- ai_generated_fields (tracks which fields were AI-generated)

### New table: company_opening_hours

- Per day per workspace
- day_of_week (0=monday), is_closed, open_time, close_time

### New table: company_social_media

- Platform + URL per workspace

## New Files

### Pages & Components

- `apps/web/src/app/join/page.tsx` — wizard container
- `apps/web/src/app/join/_components/Step1Account.tsx`
- `apps/web/src/app/join/_components/Step2Business.tsx`
- `apps/web/src/app/join/_components/Step3About.tsx`
- `apps/web/src/app/join/_components/Step4Hours.tsx`
- `apps/web/src/app/join/_components/Step5Menu.tsx`
- `apps/web/src/app/join/_components/Step6Team.tsx`
- `apps/web/src/app/join/_components/SetupLoading.tsx`
- `apps/web/src/app/join/_components/WizardProgress.tsx`

### Hooks

- `apps/web/src/app/join/_hooks/useSignupWizard.ts` — state + persistence
- `apps/web/src/app/join/_hooks/useScrapedData.ts` — polling + auto-fill

### API

- `apps/web/src/app/api/generate-content/route.ts` — Claude API for AI text
- `apps/web/src/app/api/scrape/route.ts` — proxy to scrapling service

### Migration

- `supabase/migrations/YYYYMMDDHHMMSS_signup_tables.sql`

## Scraping Flow

1. User types URL in step 1 -> debounced 1s -> POST to scrapling via API route
2. `company_scraped_data` row created with status `pending`
3. `useScrapedData` hook polls status every 3s
4. On `success` -> auto-fill fields in step 2 (address) and step 4 (hours, contact)
5. Step 3: calls `/api/generate-content` with scraped data -> AI suggestions

## UX Details

- Smooth slide transitions between steps (CSS transitions or framer-motion)
- Fields that auto-fill get a subtle shimmer/flash effect
- AI fields get "Generert fra nettsiden din" badge
- Steps 5-6 clearly marked "Valgfritt"
- Loading step: rotating status messages with progress animation
- Progress bar: filled=green, current=blue, upcoming=gray
- Click on completed step to go back and edit

## Auth Changes

- `/signup` page rewritten: Google OAuth + Magic Link + Password
- Magic link added as auth option (Supabase Auth supports this)
- Auth callback checks for existing signup_progress -> resume wizard
- `/login` stays as-is

## Routing Guards

- Authenticated without completed signup -> /join or /join?step=X
- Authenticated with completed signup -> /dashboard
- Not authenticated on /join -> /signup
