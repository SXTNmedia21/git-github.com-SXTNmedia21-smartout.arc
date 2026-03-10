---
title: "Plan — signup"
status: approved
updated: 2026-03-10
created: 2026-03-10
module: onboarding
tags: [plan, signup, wizard, scraping, ai]
---

# Signup Flow Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current `/signup` + stale `/onboarding` with a single-page wizard at `/join` that auto-fills fields from web scraping and generates AI content — a "wow" signup experience.

**Architecture:** Single-page wizard on `/join` with 6 steps + loading screen. React context manages wizard state, persisted to `signup_progress` table for resume. Scraping triggers on URL input (debounced), auto-fills fields across steps with shimmer animation. AI content generated via Next.js API route calling Claude. Loading step creates all DB records and redirects to dashboard.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, shadcn/ui, Supabase Auth + DB, Scrapling (FastAPI port 8000), OpenRouter API (Claude via OPENROUTER_API_KEY)

**Design Spec:** `docs/superpowers/specs/2026-03-10-signup-flow-design.md`

---

## Important Context for Workers

### Scrapling Service (port 8000)

The scraping service endpoint is `POST /extract` with this contract:

```
POST {SCRAPLING_SERVICE_URL}/extract
Content-Type: application/json

Request:
{
  "url": "https://restaurant.no",
  "config": {
    "include_company_info": true,
    "include_locations": true,
    "include_departments": true,
    "nace_code": "56.101"
  }
}

Response:
{
  "companyName": "Restaurant Fjorden",
  "locations": [{ "id": "1", "name": "...", "type": "Indoor", "function": "", "isComplete": false }],
  "departments": [{ "id": "1", "name": "Kjokken", "roles": ["Head Chef"], "description": "", "isComplete": false }],
  "email": "post@fjorden.no",
  "phone": "+47 22 33 44 55",
  "summary": "...",
  "description": "...",
  "logoUrl": "https://fjorden.no/logo.png",
  "images": [{ "src": "...", "alt": "..." }],
  "menus": [{ "href": "...", "text": "Meny" }],
  "socialLinks": { "facebook": "https://...", "instagram": "https://..." },
  "reservationUrl": "https://..."
}
```

Env var `SCRAPLING_SERVICE_URL` already exists in `apps/web/src/env.ts` (defaults to `http://localhost:8000`).

**Scrapling does NOT return structured address fields** (street, postal code, city). It returns `description`, `summary`, `email`, `phone`, `socialLinks`, `locations`, `departments`. Address auto-fill in step 2 is NOT possible from scraping — those fields must be filled manually. Auto-fill IS available for: phone, email, social links, and opening hours (if parseable from description).

### Existing Tables

`company` already has: `name`, `org_number`, `address_line_1`, `postal_code`, `city`, `phone`, `email`, `website`, `logo_url`, `industry`, `raw_scraped_data` (jsonb), `onboarding_status` (text). These fields do NOT need a separate `company_details` table — use `company` directly.

`company_details` is for EXTRA fields only: `about_us`, `our_history`, `our_concept`, `restaurant_type`, `cuisine_types`, `price_category`, `menu_description`, `employee_count`, `ai_generated_fields`.

### Existing RPC: `create_workspace_transaction`

**CRITICAL:** There is already a `SECURITY DEFINER` RPC at `supabase/migrations/00008_company_scraped_data.sql` that creates the full chain: company → workspace → company_member → profile → locations → departments → policies. It bypasses RLS. The signup setup action should create a NEW similar RPC (`create_signup_workspace`) rather than doing individual INSERTs, to avoid the RLS chicken-and-egg problem.

### Auth Trigger

`handle_new_user()` auto-creates `user_identity` on `auth.users` INSERT. The signup wizard does NOT need to create `user_identity` — it's already there after auth.

### AI API Key

Only `OPENROUTER_API_KEY` exists in `apps/web/src/env.ts`. Use OpenRouter API exclusively. No Anthropic direct API key is configured.

### Admin Client

`createAdminClient()` exists in `@smartout/supabase/admin`. Uses service role key, bypasses RLS. Import: `import { createAdminClient } from '@smartout/supabase/admin'`. Only use server-side.

### File Conventions

- Components: PascalCase.tsx
- Hooks: useName.ts
- Utils: camelCase.ts
- All comments in English
- TypeScript strict, no `any`
- shadcn/ui components, CSS variable classes (bg-background, text-foreground)
- Tailwind v4 (CSS-based config, no tailwind.config.ts)

### Existing Patterns to Follow

- Auth pages: see `apps/web/src/app/login/page.tsx` for design patterns
- API routes: see `apps/web/src/app/api/scrape/raw/route.ts` for scrapling proxy pattern
- Supabase client: `createClient()` from `@smartout/supabase/client` (browser) or `@smartout/supabase/server` (server)
- Design aesthetic: "Ren og varm" (Clean & Warm) — frosted glass, staggered fade-in, brand-orange CTAs

---

## File Structure

### New Files

```
apps/web/src/app/join/
  page.tsx                              -- Wizard container (server guard + client wizard)
  _components/
    SignupWizard.tsx                     -- Client component: wizard shell, step transitions, progress bar
    Step1Account.tsx                     -- Email + company name + website URL
    Step2Business.tsx                    -- Name, address, org number (auto-fill from scraping)
    Step3About.tsx                       -- About us, history, concept (AI-generated)
    Step4Hours.tsx                       -- Opening hours grid + contact + social
    Step5Menu.tsx                        -- Restaurant type, cuisine, price (optional)
    Step6Team.tsx                        -- Employee count, invite emails (optional)
    SetupLoading.tsx                     -- Loading animation + DB writes + redirect
    WizardProgress.tsx                   -- Progress bar component
    AutoFillField.tsx                    -- Input wrapper with shimmer effect for auto-filled fields
    AiBadge.tsx                         -- "Generert fra nettsiden din" badge
  _hooks/
    useSignupWizard.ts                  -- Wizard state context + step navigation + persistence
    useScrapedData.ts                   -- Poll scraping status + distribute data to steps
    useAiContent.ts                     -- Fetch AI-generated content for step 3
  _lib/
    validation.ts                       -- Zod schemas for each step
    orgNumberValidator.ts               -- Norwegian modulus 11 validation
    setupActions.ts                     -- Server action: create all DB records

apps/web/src/app/signup/
  page.tsx                              -- REWRITE: Google + Magic Link + Password auth

apps/web/src/app/api/
  scrape/company/route.ts               -- Proxy to scrapling /extract + save to company_scraped_data
  generate-content/route.ts             -- Claude API for AI text generation

supabase/migrations/
  20260310140000_signup_tables.sql       -- New tables: signup_progress, company_scraped_data,
                                           company_details, company_opening_hours, company_social_media
```

### Modified Files

```
apps/web/src/middleware.ts              -- Add /join route guard (auth required, redirect logic)
apps/web/src/app/api/auth/callback/route.ts -- Check signup_progress, redirect to /join if incomplete
```

---

## Chunk 1: Database Migration

### Task 1.1: Create migration file with all new tables

**Files:**

- Create: `supabase/migrations/20260310140000_signup_tables.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Signup progress (wizard resume)
CREATE TABLE public.signup_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  current_step integer NOT NULL DEFAULT 1,
  step_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.signup_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own signup progress"
  ON public.signup_progress FOR SELECT USING (auth.uid() = auth_id);
CREATE POLICY "Users can insert own signup progress"
  ON public.signup_progress FOR INSERT WITH CHECK (auth.uid() = auth_id);
CREATE POLICY "Users can update own signup progress"
  ON public.signup_progress FOR UPDATE USING (auth.uid() = auth_id);

CREATE TRIGGER set_signup_progress_updated_at
  BEFORE UPDATE ON public.signup_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Company scraped data
CREATE TABLE public.company_scraped_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspace(workspace_id),
  source_url text NOT NULL,
  scrape_status text NOT NULL DEFAULT 'pending'
    CHECK (scrape_status IN ('pending', 'scraping', 'success', 'partial', 'failed')),
  raw_data jsonb,
  parsed_data jsonb,
  scraped_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique index on auth_id for upsert support (one scrape job per user)
CREATE UNIQUE INDEX idx_company_scraped_data_auth_id ON public.company_scraped_data(auth_id);

ALTER TABLE public.company_scraped_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own scraped data"
  ON public.company_scraped_data FOR SELECT USING (auth.uid() = auth_id);
CREATE POLICY "Users can insert own scraped data"
  ON public.company_scraped_data FOR INSERT WITH CHECK (auth.uid() = auth_id);
CREATE POLICY "Users can update own scraped data"
  ON public.company_scraped_data FOR UPDATE USING (auth.uid() = auth_id);

CREATE TRIGGER set_company_scraped_data_updated_at
  BEFORE UPDATE ON public.company_scraped_data
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Company details (extended info beyond company table)
CREATE TABLE public.company_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  about_us text,
  our_history text,
  our_concept text,
  restaurant_type text,
  cuisine_types text[] DEFAULT '{}',
  price_category text,
  menu_description text,
  employee_count text,
  ai_generated_fields text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own workspace details"
  ON public.company_details FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "Admins can write workspace details"
  ON public.company_details FOR ALL
  USING (is_admin_in_workspace(auth.uid(), workspace_id));

CREATE TRIGGER set_company_details_updated_at
  BEFORE UPDATE ON public.company_details
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Company opening hours
CREATE TABLE public.company_opening_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_closed boolean NOT NULL DEFAULT false,
  open_time time,
  close_time time,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, day_of_week)
);

ALTER TABLE public.company_opening_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own workspace hours"
  ON public.company_opening_hours FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "Admins can write workspace hours"
  ON public.company_opening_hours FOR ALL
  USING (is_admin_in_workspace(auth.uid(), workspace_id));

CREATE TRIGGER set_company_opening_hours_updated_at
  BEFORE UPDATE ON public.company_opening_hours
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Company social media
CREATE TABLE public.company_social_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  platform text NOT NULL,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, platform)
);

ALTER TABLE public.company_social_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own workspace social media"
  ON public.company_social_media FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "Admins can write workspace social media"
  ON public.company_social_media FOR ALL
  USING (is_admin_in_workspace(auth.uid(), workspace_id));

CREATE TRIGGER set_company_social_media_updated_at
  BEFORE UPDATE ON public.company_social_media
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

- [ ] **Step 2: Run migration**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260310140000_signup_tables.sql
```

Expected: All tables created without errors.

- [ ] **Step 3: Regenerate types**

```bash
cd apps/web && npx supabase gen types typescript --local > ../../packages/supabase/src/database.types.ts
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260310140000_signup_tables.sql packages/supabase/src/database.types.ts
git commit -m "feat(db): add signup flow tables (signup_progress, company_scraped_data, company_details, opening_hours, social_media)"
```

---

## Chunk 2: Validation & Utilities

### Task 2.1: Norwegian org number validator

**Files:**

- Create: `apps/web/src/app/join/_lib/orgNumberValidator.ts`

- [ ] **Step 1: Implement modulus 11 validator**

```typescript
/**
 * Norwegian organization number validator (modulus 11).
 * Format: 9 digits. Last digit is check digit.
 * Weights: [3, 2, 7, 6, 5, 4, 3, 2] applied to first 8 digits.
 */
export function validateOrgNumber(value: string): boolean {
  const cleaned = value.replace(/\s/g, "");
  if (!/^\d{9}$/.test(cleaned)) return false;

  const digits = cleaned.split("").map(Number);
  const weights = [3, 2, 7, 6, 5, 4, 3, 2];

  const sum = weights.reduce((acc, weight, i) => acc + weight * digits[i], 0);
  const remainder = sum % 11;

  if (remainder === 1) return false; // invalid
  const checkDigit = remainder === 0 ? 0 : 11 - remainder;

  return checkDigit === digits[8];
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/join/_lib/orgNumberValidator.ts
git commit -m "feat(signup): add Norwegian org number validator (modulus 11)"
```

### Task 2.2: Zod validation schemas for each step

**Files:**

- Create: `apps/web/src/app/join/_lib/validation.ts`

- [ ] **Step 1: Write validation schemas**

```typescript
import { z } from "zod";
import { validateOrgNumber } from "./orgNumberValidator";

export const step1Schema = z.object({
  email: z.string().email(),
  companyName: z.string().min(2, "Minimum 2 tegn"),
  websiteUrl: z
    .string()
    .min(4, "Ugyldig URL")
    .transform((v) => (v.startsWith("http") ? v : `https://${v}`))
    .pipe(z.string().url("Ugyldig URL")),
});

export const step2Schema = z.object({
  firstName: z.string().min(2, "Minimum 2 tegn"),
  lastName: z.string().min(2, "Minimum 2 tegn"),
  street: z.string().min(2, "Påkrevd"),
  postalCode: z.string().regex(/^\d{4}$/, "Må være 4 siffer"),
  city: z.string().min(2, "Påkrevd"),
  orgNumber: z.string().refine(validateOrgNumber, "Ugyldig organisasjonsnummer"),
});

export const step3Schema = z.object({
  aboutUs: z.string().min(20, "Minimum 20 tegn"),
  ourHistory: z.string().optional(),
  ourConcept: z.string().min(20, "Minimum 20 tegn"),
});

export const step4Schema = z.object({
  openingHours: z
    .array(
      z.object({
        dayOfWeek: z.number().min(0).max(6),
        isClosed: z.boolean(),
        openTime: z.string().optional(),
        closeTime: z.string().optional(),
      }),
    )
    .length(7),
  phone: z.string().min(8, "Ugyldig telefonnummer"),
  instagram: z.string().url().optional().or(z.literal("")),
  facebook: z.string().url().optional().or(z.literal("")),
});

export const step5Schema = z.object({
  restaurantType: z.string().optional(),
  cuisineTypes: z.array(z.string()).optional(),
  priceCategory: z.string().optional(),
  menuDescription: z.string().optional(),
});

export const step6Schema = z.object({
  employeeCount: z.string().optional(),
  teamInvites: z.array(z.string().email()).optional(),
});

export type Step1Data = z.infer<typeof step1Schema>;
export type Step2Data = z.infer<typeof step2Schema>;
export type Step3Data = z.infer<typeof step3Schema>;
export type Step4Data = z.infer<typeof step4Schema>;
export type Step5Data = z.infer<typeof step5Schema>;
export type Step6Data = z.infer<typeof step6Schema>;
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/join/_lib/validation.ts
git commit -m "feat(signup): add Zod validation schemas for wizard steps"
```

---

## Chunk 3: API Routes

### Task 3.1: Scraping proxy API route

**Files:**

- Create: `apps/web/src/app/api/scrape/company/route.ts`
- Reference: `apps/web/src/app/api/scrape/raw/route.ts` (existing pattern)
- Reference: `apps/web/src/env.ts` for `SCRAPLING_SERVICE_URL`

- [ ] **Step 1: Write the API route**

This route does two things: (1) creates/updates a `company_scraped_data` row, (2) calls scrapling `/extract` and stores the result.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";

const SCRAPLING_URL = process.env.SCRAPLING_SERVICE_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { url } = await request.json();
  if (!url) {
    return NextResponse.json({ error: "URL required" }, { status: 400 });
  }

  // Normalize URL
  const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;

  // Upsert scraped data row (replace any previous attempt)
  const { data: scrapeRow, error: dbError } = await supabase
    .from("company_scraped_data")
    .upsert(
      {
        auth_id: user.id,
        source_url: normalizedUrl,
        scrape_status: "scraping",
        raw_data: null,
        parsed_data: null,
        scraped_at: null,
      },
      { onConflict: "auth_id" }, // Note: need unique index on auth_id
    )
    .select("id")
    .single();

  if (dbError) {
    return NextResponse.json({ error: "Failed to create scrape record" }, { status: 500 });
  }

  // Call scrapling service (fire-and-forget style but we await for this route)
  try {
    const response = await fetch(`${SCRAPLING_URL}/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: normalizedUrl,
        config: {
          include_company_info: true,
          include_locations: true,
          include_departments: true,
          nace_code: "56.101", // Default hospitality
        },
      }),
      signal: AbortSignal.timeout(30000), // 30s timeout
    });

    if (!response.ok) {
      throw new Error(`Scrapling returned ${response.status}`);
    }

    const scrapedData = await response.json();

    // Update with success
    await supabase
      .from("company_scraped_data")
      .update({
        scrape_status: "success",
        raw_data: scrapedData,
        parsed_data: scrapedData, // Scrapling already returns structured data
        scraped_at: new Date().toISOString(),
      })
      .eq("id", scrapeRow.id);

    return NextResponse.json({ status: "success", id: scrapeRow.id });
  } catch (err) {
    // Update with failure
    await supabase
      .from("company_scraped_data")
      .update({
        scrape_status: "failed",
        raw_data: { error: err instanceof Error ? err.message : "Unknown error" },
      })
      .eq("id", scrapeRow.id);

    return NextResponse.json({ status: "failed", id: scrapeRow.id });
  }
}

// GET endpoint for polling scrape status
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("company_scraped_data")
    .select("id, scrape_status, parsed_data, scraped_at")
    .eq("auth_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return NextResponse.json({ status: "not_found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
```

**Note:** The `upsert` on `auth_id` works because the migration includes `CREATE UNIQUE INDEX idx_company_scraped_data_auth_id ON public.company_scraped_data(auth_id)`.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/scrape/company/route.ts
git commit -m "feat(signup): add scraping proxy API route with polling"
```

### Task 3.2: AI content generation API route

**Files:**

- Create: `apps/web/src/app/api/generate-content/route.ts`
- Check: `apps/web/src/env.ts` for Anthropic/OpenRouter API key

- [ ] **Step 1: Check which AI API key is available**

Read `apps/web/src/env.ts` — look for `ANTHROPIC_API_KEY` or `OPENROUTER_API_KEY`. The project likely uses OpenRouter based on the env.ts file. Adapt the implementation to whichever key exists.

- [ ] **Step 2: Write the API route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyName, scrapedData } = await request.json();
  if (!companyName) {
    return NextResponse.json({ error: "Company name required" }, { status: 400 });
  }

  // Build context from scraped data
  const context = scrapedData
    ? `Bedriftsnavn: ${scrapedData.companyName || companyName}
Beskrivelse fra nettside: ${scrapedData.description || "Ikke tilgjengelig"}
Sammendrag: ${scrapedData.summary || "Ikke tilgjengelig"}
E-post: ${scrapedData.email || ""}
Telefon: ${scrapedData.phone || ""}`
    : `Bedriftsnavn: ${companyName}`;

  const prompt = `Du er copywriter for skandinaviske restauranter og serveringssteder. Skriv på norsk bokmål.

Basert på følgende informasjon om bedriften:

${context}

Generer tre korte tekster:
1. "Om oss" — 2-3 setninger. Varm, profesjonell tone. Beskriv hva stedet er.
2. "Vår historie" — 2-3 setninger. Narrativ tone. Fortell historien bak stedet.
3. "Vårt konsept" — 2-3 setninger. Beskriv matfilosofi og opplevelse.

Regler:
- Bruk vi-form
- Ikke dikt opp årstall, navn eller fakta som ikke finnes i dataene
- Kort og treffende — ikke mer enn 3 setninger per tekst
- Profesjonell men varm tone

Svar KUN i JSON-format:
{ "about_us": "...", "our_history": "...", "our_concept": "..." }`;

  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENROUTER_API_KEY not configured" }, { status: 500 });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4-20250514",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter returned ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    // Parse JSON from response (may be wrapped in markdown code block)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in AI response");
    const result: { about_us: string; our_history: string; our_concept: string } = JSON.parse(
      jsonMatch[0],
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error("AI content generation failed:", err);
    return NextResponse.json({ error: "Content generation failed" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/generate-content/route.ts
git commit -m "feat(signup): add AI content generation API route"
```

---

## Chunk 4: Wizard State Management

### Task 4.1: Signup wizard context and hook

**Files:**

- Create: `apps/web/src/app/join/_hooks/useSignupWizard.ts`

- [ ] **Step 1: Write the wizard state hook**

This hook manages:

- All step data in a single state object
- Step navigation (next, prev, goTo)
- Persistence to `signup_progress` table (debounced)
- URL sync via query param `?step=N`

```typescript
'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@smartout/supabase/client'
import type { Step1Data, Step2Data, Step3Data, Step4Data, Step5Data, Step6Data } from '../_lib/validation'

const TOTAL_STEPS = 6

export interface WizardState {
  currentStep: number
  scrapeJobId: string | null
  step1: Partial<Step1Data>
  step2: Partial<Step2Data>
  step3: Partial<Step3Data>
  step4: Partial<Step4Data>
  step5: Partial<Step5Data>
  step6: Partial<Step6Data>
}

const defaultState: WizardState = {
  currentStep: 1,
  scrapeJobId: null,
  step1: {},
  step2: {},
  step3: {},
  step4: { openingHours: Array.from({ length: 7 }, (_, i) => ({ dayOfWeek: i, isClosed: false, openTime: '', closeTime: '' })) },
  step5: {},
  step6: {},
}

interface WizardContextValue {
  state: WizardState
  updateStep: <K extends keyof WizardState>(key: K, data: WizardState[K]) => void
  nextStep: () => void
  prevStep: () => void
  goToStep: (step: number) => void
  isLoading: boolean
}

const WizardContext = createContext<WizardContextValue | null>(null)

export function WizardProvider({ children, initialState }: { children: React.ReactNode; initialState?: Partial<WizardState> }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [state, setState] = useState<WizardState>(() => ({
    ...defaultState,
    ...initialState,
    currentStep: Number(searchParams.get('step')) || initialState?.currentStep || 1,
  }))
  const [isLoading, setIsLoading] = useState(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Persist to DB (debounced 2s)
  const persistState = useCallback((newState: WizardState) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(async () => {
      const supabase = createClient()
      await supabase.from('signup_progress').upsert({
        auth_id: (await supabase.auth.getUser()).data.user?.id,
        current_step: newState.currentStep,
        step_data: newState,
      }, { onConflict: 'auth_id' })
    }, 2000)
  }, [])

  const updateStep = useCallback(<K extends keyof WizardState>(key: K, data: WizardState[K]) => {
    setState(prev => {
      const next = { ...prev, [key]: data }
      persistState(next)
      return next
    })
  }, [persistState])

  const goToStep = useCallback((step: number) => {
    if (step < 1 || step > TOTAL_STEPS + 1) return // +1 for loading step
    setState(prev => {
      const next = { ...prev, currentStep: step }
      persistState(next)
      return next
    })
    router.push(`/join?step=${step}`, { scroll: false })
  }, [router, persistState])

  const nextStep = useCallback(() => goToStep(state.currentStep + 1), [goToStep, state.currentStep])
  const prevStep = useCallback(() => goToStep(state.currentStep - 1), [goToStep, state.currentStep])

  return (
    <WizardContext.Provider value={{ state, updateStep, nextStep, prevStep, goToStep, isLoading }}>
      {children}
    </WizardContext.Provider>
  )
}

export function useSignupWizard() {
  const ctx = useContext(WizardContext)
  if (!ctx) throw new Error('useSignupWizard must be used within WizardProvider')
  return ctx
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/join/_hooks/useSignupWizard.ts
git commit -m "feat(signup): add wizard state context with persistence"
```

### Task 4.2: Scraped data polling hook

**Files:**

- Create: `apps/web/src/app/join/_hooks/useScrapedData.ts`

- [ ] **Step 1: Write the polling hook**

```typescript
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ScrapedData {
  companyName?: string;
  email?: string;
  phone?: string;
  description?: string;
  summary?: string;
  logoUrl?: string;
  socialLinks?: Record<string, string>;
  // Address fields (extracted from description/summary by scrapling)
  locations?: Array<{ name: string; type: string }>;
  departments?: Array<{ name: string; roles: string[] }>;
}

interface UseScrapedDataReturn {
  scrapedData: ScrapedData | null;
  scrapeStatus: "idle" | "scraping" | "success" | "partial" | "failed";
  triggerScrape: (url: string) => Promise<void>;
}

export function useScrapedData(): UseScrapedDataReturn {
  const [scrapedData, setScrapedData] = useState<ScrapedData | null>(null);
  const [scrapeStatus, setScrapeStatus] = useState<UseScrapedDataReturn["scrapeStatus"]>("idle");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollCountRef.current = 0;

    pollRef.current = setInterval(async () => {
      pollCountRef.current++;
      if (pollCountRef.current > 10) {
        // Stop after 10 attempts (30 seconds)
        if (pollRef.current) clearInterval(pollRef.current);
        setScrapeStatus("failed");
        return;
      }

      try {
        const res = await fetch("/api/scrape/company");
        if (!res.ok) return;

        const data = await res.json();
        if (data.scrape_status === "success" || data.scrape_status === "partial") {
          setScrapeStatus(data.scrape_status);
          setScrapedData(data.parsed_data);
          if (pollRef.current) clearInterval(pollRef.current);
        } else if (data.scrape_status === "failed") {
          setScrapeStatus("failed");
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        // Silently continue polling
      }
    }, 3000);
  }, []);

  const triggerScrape = useCallback(
    async (url: string) => {
      setScrapeStatus("scraping");
      setScrapedData(null);

      try {
        const res = await fetch("/api/scrape/company", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });

        const result = await res.json();
        if (result.status === "success") {
          // Scraping completed synchronously (fast sites)
          // Fetch the result
          const pollRes = await fetch("/api/scrape/company");
          const pollData = await pollRes.json();
          setScrapeStatus("success");
          setScrapedData(pollData.parsed_data);
        } else if (result.status === "failed") {
          setScrapeStatus("failed");
        } else {
          // Still processing, start polling
          startPolling();
        }
      } catch {
        setScrapeStatus("failed");
      }
    },
    [startPolling],
  );

  return { scrapedData, scrapeStatus, triggerScrape };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/join/_hooks/useScrapedData.ts
git commit -m "feat(signup): add scraped data polling hook"
```

### Task 4.3: AI content hook

**Files:**

- Create: `apps/web/src/app/join/_hooks/useAiContent.ts`

- [ ] **Step 1: Write the AI content hook**

```typescript
"use client";

import { useCallback, useState } from "react";

interface AiContent {
  about_us: string;
  our_history: string;
  our_concept: string;
}

interface UseAiContentReturn {
  aiContent: AiContent | null;
  aiStatus: "idle" | "generating" | "success" | "failed";
  generateContent: (companyName: string, scrapedData: unknown) => Promise<void>;
}

export function useAiContent(): UseAiContentReturn {
  const [aiContent, setAiContent] = useState<AiContent | null>(null);
  const [aiStatus, setAiStatus] = useState<UseAiContentReturn["aiStatus"]>("idle");

  const generateContent = useCallback(async (companyName: string, scrapedData: unknown) => {
    setAiStatus("generating");
    try {
      const res = await fetch("/api/generate-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, scrapedData }),
      });

      if (!res.ok) throw new Error("Generation failed");

      const data: AiContent = await res.json();
      setAiContent(data);
      setAiStatus("success");
    } catch {
      setAiStatus("failed");
    }
  }, []);

  return { aiContent, aiStatus, generateContent };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/join/_hooks/useAiContent.ts
git commit -m "feat(signup): add AI content generation hook"
```

---

## Chunk 5: Auth Page Rewrite

### Task 5.1: Rewrite /signup page

**Files:**

- Modify: `apps/web/src/app/signup/page.tsx`
- Reference: `apps/web/src/app/login/page.tsx` for design patterns

- [ ] **Step 1: Read existing signup and login pages**

Read both files to understand the current design patterns, imports, and Supabase client usage.

- [ ] **Step 2: Rewrite /signup with three auth methods**

The new signup page should have:

1. Google OAuth button (existing)
2. Magic link (new) — email input → `supabase.auth.signInWithOtp({ email })`
3. Email + password (existing)

Design: Follow the existing "Ren og varm" aesthetic from the login page. Frosted glass card, brand-orange CTA, clean layout.

After auth success → redirect to `/join` (not `/dashboard`).

Key changes:

- Add magic link tab/section
- Change all redirect targets from `/dashboard` to `/join`
- Auth callback `?next=/join`
- Show "already have account?" → `/login`

- [ ] **Step 3: Test manually**

1. Visit `http://localhost:3060/signup`
2. Verify Google button works (redirects to Google → callback → /join)
3. Verify magic link sends email
4. Verify email+password creates account and redirects to /join
5. Verify "already have account?" links to /login

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/signup/page.tsx
git commit -m "feat(signup): rewrite auth page with Google, magic link, and password"
```

### Task 5.2: Update auth callback to check signup progress

**Files:**

- Modify: `apps/web/src/app/api/auth/callback/route.ts`

- [ ] **Step 1: Read existing callback**

- [ ] **Step 2: Add signup progress check**

After exchanging code for session:

1. Check if user has a `signup_progress` row with `completed = true`
2. If yes → redirect to `next` param (default `/dashboard`)
3. If no → check if user has any profile (existing user) → `/dashboard`
4. If no profile and no completed signup → redirect to `/join`

```typescript
// After exchangeCodeForSession:
const { data: progress } = await supabase
  .from("signup_progress")
  .select("completed, current_step")
  .eq("auth_id", user.id)
  .single();

if (progress?.completed) {
  return NextResponse.redirect(new URL(next || "/dashboard", requestUrl));
}

// Check if user already has a profile (existing user logging in)
const { data: profiles } = await supabase
  .from("profile")
  .select("profile_id")
  .eq("user_id", user.id)
  .limit(1);

if (profiles && profiles.length > 0) {
  return NextResponse.redirect(new URL(next || "/dashboard", requestUrl));
}

// New user — go to wizard
const step = progress?.current_step || 1;
return NextResponse.redirect(new URL(`/join?step=${step}`, requestUrl));
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/auth/callback/route.ts
git commit -m "feat(signup): auth callback redirects new users to /join wizard"
```

---

## Chunk 6: Wizard UI Components

### Task 6.1: Wizard container page

**Files:**

- Create: `apps/web/src/app/join/page.tsx`

- [ ] **Step 1: Write the server component with auth guard**

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@smartout/supabase/server'
import { SignupWizard } from './_components/SignupWizard'

export default async function JoinPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/signup')
  }

  // Check if signup already completed
  const { data: profiles } = await supabase
    .from('profile')
    .select('profile_id')
    .eq('user_id', user.id)
    .limit(1)

  if (profiles && profiles.length > 0) {
    redirect('/dashboard')
  }

  // Load existing progress
  const { data: progress } = await supabase
    .from('signup_progress')
    .select('current_step, step_data')
    .eq('auth_id', user.id)
    .single()

  // Get user metadata for pre-fill
  const metadata = user.user_metadata || {}

  return (
    <SignupWizard
      userEmail={user.email || ''}
      initialState={progress?.step_data ? {
        ...progress.step_data,
        currentStep: progress.current_step,
        step2: {
          ...progress.step_data.step2,
          firstName: progress.step_data.step2?.firstName || metadata.given_name || metadata.first_name || '',
          lastName: progress.step_data.step2?.lastName || metadata.family_name || metadata.last_name || '',
        },
      } : {
        step2: {
          firstName: metadata.given_name || metadata.first_name || '',
          lastName: metadata.family_name || metadata.last_name || '',
        },
      }}
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/join/page.tsx
git commit -m "feat(signup): add /join page with auth guard and progress resume"
```

### Task 6.2: Wizard shell with transitions

**Files:**

- Create: `apps/web/src/app/join/_components/SignupWizard.tsx`
- Create: `apps/web/src/app/join/_components/WizardProgress.tsx`

- [ ] **Step 1: Write SignupWizard (main shell)**

Client component that:

- Wraps content in `WizardProvider`
- Renders current step with CSS transitions (slide left/right)
- Shows `WizardProgress` bar at top
- Manages scraping state (passed down via context)

Use CSS transitions or `@/components/ui/` animation patterns. Keep smooth — translateX transitions with opacity fade.

- [ ] **Step 2: Write WizardProgress**

Progress bar showing:

- Steps 1-6 as dots/circles with labels
- Filled = completed (green), Current = active (blue/brand-orange), Upcoming = gray
- Steps 5-6 labeled "Valgfritt"
- Clickable completed steps (goToStep)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/join/_components/SignupWizard.tsx apps/web/src/app/join/_components/WizardProgress.tsx
git commit -m "feat(signup): add wizard shell with step transitions and progress bar"
```

### Task 6.3: Step 1 — Account + Website

**Files:**

- Create: `apps/web/src/app/join/_components/Step1Account.tsx`

- [ ] **Step 1: Write Step1Account**

Fields:

- Email (readonly, dimmed, pre-filled from auth)
- Bedriftsnavn (required, min 2)
- Nettside URL (required, auto-prefix https://)

On URL input change (debounced 1s): call `triggerScrape(url)` from `useScrapedData`.
On "Neste": validate with `step1Schema`, update wizard state, go to step 2.

Design: Clean card layout. Input fields with labels above. "Neste" button at bottom right. Subtle scraping indicator when URL is being processed.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/join/_components/Step1Account.tsx
git commit -m "feat(signup): add step 1 (account + website + scrape trigger)"
```

### Task 6.4: AutoFillField component

**Files:**

- Create: `apps/web/src/app/join/_components/AutoFillField.tsx`

- [ ] **Step 1: Write AutoFillField**

An input wrapper that:

- Accepts all standard input props
- When value changes from external source (scraped data), plays a shimmer/highlight animation
- Shows a subtle "Auto-fylt" indicator when auto-filled
- Uses CSS `@keyframes shimmer` — a brief gold/orange highlight that fades

```css
@keyframes shimmer {
  0% {
    background-color: hsl(var(--brand) / 0.15);
  }
  100% {
    background-color: transparent;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/join/_components/AutoFillField.tsx
git commit -m "feat(signup): add AutoFillField with shimmer animation"
```

### Task 6.5: Step 2 — Business Details

**Files:**

- Create: `apps/web/src/app/join/_components/Step2Business.tsx`

- [ ] **Step 1: Write Step2Business**

Fields:

- Fornavn (pre-fill from Google SSO given_name / first_name)
- Etternavn (pre-fill from Google SSO family_name / last_name)
- Gateadresse (manual input — scraping does NOT return structured addresses)
- Postnummer (manual input, 4 digits)
- Poststed (manual input)
- Org.nummer (9 digits, modulus 11 validation)

Show scraping indicator in corner if status is 'scraping' (scraping is running for later steps).

Validation: `step2Schema` on "Neste".

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/join/_components/Step2Business.tsx
git commit -m "feat(signup): add step 2 (business details with auto-fill)"
```

### Task 6.6: AiBadge component

**Files:**

- Create: `apps/web/src/app/join/_components/AiBadge.tsx`

- [ ] **Step 1: Write AiBadge**

Small badge/pill: "Generert fra nettsiden din" with sparkle icon.
Positioned above or inside textarea.
Includes a small "Skriv pa nytt" button that clears the field.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/join/_components/AiBadge.tsx
git commit -m "feat(signup): add AI badge component"
```

### Task 6.7: Step 3 — About Us (AI-generated)

**Files:**

- Create: `apps/web/src/app/join/_components/Step3About.tsx`

- [ ] **Step 1: Write Step3About**

Fields (all textareas):

- Om oss (required, min 20, AI badge if generated)
- Var historie (optional, AI badge if generated)
- Vart konsept (required, min 20, AI badge if generated)

On mount:

1. Check scraped data status
2. If `success` → call `generateContent()` from `useAiContent`
3. If `scraping` → show "Analyserer nettsiden..." spinner, poll
4. If `failed` → show empty fields, user writes manually

When AI content arrives → fill textareas with shimmer, show AiBadge on each.
"Skriv pa nytt" on badge → clear that field, remove badge.

Track which fields were AI-generated in wizard state (`ai_generated_fields` array).

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/join/_components/Step3About.tsx
git commit -m "feat(signup): add step 3 (AI-generated about us content)"
```

### Task 6.8: Step 4 — Opening Hours + Contact

**Files:**

- Create: `apps/web/src/app/join/_components/Step4Hours.tsx`

- [ ] **Step 1: Write Step4Hours**

Opening hours grid:

- 7 rows (Mandag–Sondag)
- Each row: day label | "Stengt" checkbox | open time input | "–" | close time input
- Time inputs: type="time" or select with 30-min intervals
- Pre-fill from scraped data if available (with shimmer)

Contact fields:

- Telefon (required, pre-fill from scraping)
- Instagram URL (optional, pre-fill from scraping socialLinks)
- Facebook URL (optional, pre-fill from scraping socialLinks)

Validation: `step4Schema` on "Neste".

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/join/_components/Step4Hours.tsx
git commit -m "feat(signup): add step 4 (opening hours + contact with pre-fill)"
```

### Task 6.9: Step 5 — Menu + Offerings (optional)

**Files:**

- Create: `apps/web/src/app/join/_components/Step5Menu.tsx`

- [ ] **Step 1: Write Step5Menu**

Fields:

- Restauranttype (select: Restaurant, Kafe, Bar/Pub, Bakeri, Fast food, Fine dining, Catering, Annet)
- Kjokkentype (multi-select/checkboxes: Norsk/Nordisk, Italiensk, Asiatisk, Sjomat, Burger, Sushi, Pizza, Indisk, Meksikansk, Vegetar/Vegan, Internasjonal, Annet)
- Priskategori (select: Budsjett <200kr, Moderat 200-400kr, Premium 400-800kr, Fine dining 800+kr)
- Menybeskrivelse (textarea, optional)

Show "Hopp over" link/button. No validation required.
Pre-fill restaurant type from scraped data if available.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/join/_components/Step5Menu.tsx
git commit -m "feat(signup): add step 5 (menu + offerings, optional)"
```

### Task 6.10: Step 6 — Team (optional)

**Files:**

- Create: `apps/web/src/app/join/_components/Step6Team.tsx`

- [ ] **Step 1: Write Step6Team**

Fields:

- Antall ansatte (select: 1-5, 6-15, 16-30, 31-50, 50+)
- Inviter teammedlemmer: dynamic list of email inputs
  - "+Legg til" button adds a new email field
  - "X" button removes an email field
  - Basic email validation on each

Show "Hopp over" link/button. No required fields.
Button: "Fullfør registrering" → go to loading step (step 7).

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/join/_components/Step6Team.tsx
git commit -m "feat(signup): add step 6 (team invitations, optional)"
```

---

## Chunk 7: Setup Loading & DB Writes

### Task 7.1: Server action for setup

**Files:**

- Create: `apps/web/src/app/join/_lib/setupActions.ts`

- [ ] **Step 1: Write the server action**

This server action creates all DB records. Two-phase approach:

**Phase 1 — Core setup (admin client, bypasses RLS):**
Use `createAdminClient()` from `@smartout/supabase/admin` for the chicken-and-egg chain:

1. Update `user_identity` (first_name, last_name)
2. Create `company` (name, org_number, address, phone, email, website, industry, raw_scraped_data)
3. Create `workspace` (name, slug, company_id)
4. Create `company_member` (user_id, company_id, role: owner)
5. Create `profile` (user_id, workspace_id, company_id, role: owner, status: active, display_name)

**Phase 2 — Extended data (user client, RLS works now):**
Use `createClient()` from `@smartout/supabase/server` — user now has a profile so RLS passes: 6. Create `company_details` (workspace_id, about_us, our_history, our_concept, etc.) 7. Create `company_opening_hours` (7 rows) 8. Create `company_social_media` (instagram, facebook if provided) 9. Link `company_scraped_data` to workspace_id 10. Mark `signup_progress` as completed

**Alternative:** Create a new `SECURITY DEFINER` RPC `create_signup_workspace()` (similar to existing `create_workspace_transaction()` in migration 00008) that does phase 1 atomically. This is the preferred approach — see existing pattern in `supabase/migrations/00008_company_scraped_data.sql`.

**Slug generation:** `lower(regexp_replace(company_name, '[^a-zA-Z0-9]+', '-', 'g'))`. If slug exists, append `-2`, `-3`, etc. The existing `create_workspace_transaction` uses this exact pattern.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/join/_lib/setupActions.ts
git commit -m "feat(signup): add server action for DB setup (company, workspace, profile)"
```

### Task 7.2: Setup loading component

**Files:**

- Create: `apps/web/src/app/join/_components/SetupLoading.tsx`

- [ ] **Step 1: Write SetupLoading**

Full-screen loading component that:

1. On mount, calls the setup server action with all wizard state
2. Shows animated loading screen with rotating messages:
   - "Oppretter kontoen din..."
   - "Setter opp bedriften..."
   - "Konfigurerer arbeidsomradet..."
   - "Nesten klar..."
3. On success → `router.push('/dashboard')`
4. On error → show error message with "Prov igjen" button

Design: Centered card with a pulsing/spinning animation. Status text fades between messages (every 2-3 seconds). Brand-orange accent color. Clean, confident feel.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/join/_components/SetupLoading.tsx
git commit -m "feat(signup): add setup loading screen with animated progress"
```

### Task 7.3: Team invitation logic

**Files:**

- Modify: `apps/web/src/app/join/_lib/setupActions.ts` (add invitation sending)

- [ ] **Step 1: Add invitation creation to setup action**

After all setup is complete, if step 6 has team invites:

- For each email in `step6.teamInvites`:
  - Insert into `invitation` table (workspace_id, company_id, email, role: 'employee', status: 'pending', invited_by: profile_id)
- This is fire-and-forget — don't block the redirect on invitation emails

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/join/_lib/setupActions.ts
git commit -m "feat(signup): add team invitation creation during setup"
```

---

## Chunk 8: Routing Guards

### Task 8.1: Update middleware for /join

**Files:**

- Modify: `apps/web/src/middleware.ts`

- [ ] **Step 1: Read existing middleware**

Understand the current routing logic.

- [ ] **Step 2: Add /join route handling**

Add to the middleware:

- `/join` requires auth → if no session, redirect to `/signup`
- Users with completed signup (have profile) accessing `/join` → redirect to `/dashboard`
- The actual "has completed signup" check is done in the page component (server component), so middleware only needs to check auth

Also ensure `/signup` does NOT redirect authenticated users to dashboard — they might be new users heading to the wizard.

- [ ] **Step 3: Test routing manually**

1. Unauthenticated → `/join` → redirected to `/signup`
2. Authenticated new user → `/signup` → auth → callback → `/join`
3. Authenticated new user → `/join` → sees wizard
4. Authenticated existing user → `/join` → redirected to `/dashboard`
5. Authenticated existing user → `/login` → redirected to `/dashboard`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/middleware.ts
git commit -m "feat(signup): add /join route guard to middleware"
```

---

## Chunk 9: Integration Testing & Polish

### Task 9.1: End-to-end flow test

- [ ] **Step 1: Test full flow manually**

1. Start local Supabase: `npx supabase start`
2. Start scrapling: verify Docker container is running on port 8000
3. Start web: `pnpm --filter web dev`
4. Open `http://localhost:3060/signup`
5. Create account with email+password
6. Verify redirect to `/join?step=1`
7. Fill step 1 (company name + URL)
8. Verify scraping triggers (check network tab)
9. Go to step 2 — verify auto-fill when scraping completes
10. Go to step 3 — verify AI content generation
11. Fill steps 4-6
12. Complete setup — verify loading screen → dashboard redirect
13. Verify all DB records created correctly

- [ ] **Step 2: Fix any issues found**

- [ ] **Step 3: Test resume flow**

1. Start wizard, fill steps 1-3
2. Close browser
3. Log in again
4. Verify redirect to `/join?step=4` (or wherever stopped)
5. Verify previous data is preserved

### Task 9.2: Typecheck

- [ ] **Step 1: Run typecheck**

```bash
pnpm turbo typecheck
```

Expected: 0 errors.

- [ ] **Step 2: Fix any type errors**

- [ ] **Step 3: Run lint**

```bash
pnpm lint
```

- [ ] **Step 4: Fix any lint errors**

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(signup): polish and fix typecheck/lint issues"
```

---

## Summary

| Chunk | Tasks    | Description                                 |
| ----- | -------- | ------------------------------------------- |
| 1     | 1.1      | Database migration (5 tables + RLS)         |
| 2     | 2.1-2.2  | Validation schemas + org number validator   |
| 3     | 3.1-3.2  | API routes (scraping proxy + AI generation) |
| 4     | 4.1-4.3  | Wizard state, scraped data hook, AI hook    |
| 5     | 5.1-5.2  | Auth page rewrite + callback update         |
| 6     | 6.1-6.10 | All wizard UI components                    |
| 7     | 7.1-7.3  | Setup logic + loading screen + invitations  |
| 8     | 8.1      | Middleware routing guards                   |
| 9     | 9.1-9.2  | Integration testing + typecheck             |

**Dependencies:** Chunk 1 first (DB). Then 2-4 in parallel. Then 5-6 (needs hooks from 4). Then 7 (needs UI from 6). Then 8. Then 9 last.
