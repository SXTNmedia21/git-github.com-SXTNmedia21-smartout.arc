---
title: "User Journeys — Workspace Intelligence"
status: done
updated: 2026-03-21
created: 2026-03-21
module: onboarding
tags: [join-wizard, ai-content, step-3, enrich, generate]
---

# User Journeys — Workspace Intelligence

## Journey: Owner Creates Company Profile (Step 3)

**Precondition:** User has completed Step 1 (email, company name, industry, city, website) and Step 2 (name, address, org number). Website has been scraped, BRREG data has been fetched.

1. User advances from Step 2 to Step 3 → System auto-triggers enrichAndGenerate()
2. System shows "Henter informasjon..." → Calls /api/workspace-intelligence with action "enrich_and_generate"
3. Orchestrator calls Scrapling /enrich → BRREG (founding date, industry) + web search (Google mentions, ratings, news) run in parallel with scrape data already seeded
4. Scrapling /enrich returns enriched intelligence JSON → Orchestrator calls Scrapling /generate
5. Scrapling /generate builds structured context from intelligence → Sends to Claude 3.5 Sonnet → Returns three texts (about_us, our_history, our_concept), each under 300 characters
6. System receives content → Typewriter animation fills three textareas sequentially (Om oss, Vår historie, Vårt konsept)
7. User sees "Utkast fylt ut — rediger fritt" indicator with sparkle icon
8. User can edit any field freely → AiBadge shows on AI-filled fields with clear button
9. User clicks "Neste" → Advances to Step 4

**Postcondition:** Step 3 data (aboutUs, ourHistory, ourConcept) saved in wizard state. Intelligence JSON persisted in wizard state for use by later steps.

**Error paths:**

- Scrapling unreachable → Status shows "failed", user sees "Kunne ikke generere utkast. Fyll inn manuelt."
- OpenRouter API error → Same failure message, textareas empty but editable
- All Step 3 fields are optional → User can advance without any content

---

## Journey: Owner Rewrites AI Content ("Skriv på nytt")

**Precondition:** User is on Step 3. AI content has been generated at least once.

1. User clicks "Skriv på nytt" button → Button shows spinning icon
2. System calls /api/workspace-intelligence with action "enrich_and_generate" + force_new_queries: true
3. Enrich checks sources.web_search.queries_used → Builds new search queries (excludes previously used)
4. New web search results enrich the intelligence JSON → Generate produces fresh copy from richer data
5. Typewriter animation replays with new content → Previous text replaced
6. User can press "Skriv på nytt" multiple times — each press tries different search queries

**Postcondition:** New content displayed. Intelligence JSON updated with additional web search data.

**Error paths:**

- All search queries exhausted → System tries a variation query ("{company} {city} opplevelse")
- API timeout → Previous content remains, error message shown

---

## Journey: Owner Gets Pre-populated Menu Info (Step 5)

**Precondition:** User has reached Step 5. Intelligence JSON contains cuisine_types, price_range, or concept_clues from enrichment.

1. User arrives at Step 5 ("Meny") → System reads intelligence from wizard state
2. If intelligence has cuisine_types → Maps to UI checkboxes (e.g., "sjomat" → "Sjomat", "nordisk" → "Norsk/Nordisk") → Checkboxes pre-selected
3. If intelligence has price_range → Maps to price category select (e.g., "$$$" → "Premium") → Select pre-filled
4. If intelligence has concept_clues → Maps to restaurant type (e.g., "fine dining" → "Fine dining") → Select pre-filled
5. System shows "Foreslått basert på det vi fant — endre fritt" indicator
6. User can change any pre-filled value or skip the entire step

**Postcondition:** Step 5 data saved. Pre-population is best-effort — user always has full control.

**Error paths:**

- No intelligence data available → Step 5 loads with all fields empty (normal behavior)
- Intelligence has unrecognized cuisine types → No pre-fill for that field

---

## Journey: Owner Completes Signup → Lands on Dashboard

**Precondition:** User has completed Steps 1-6 of the join wizard. Account created in Supabase.

1. User clicks "Opprett konto" on Step 6 → Supabase auth.signUp() creates auth.users + user_identity
2. System advances to Step 7 (SetupLoading) → Shows rotating messages: "Oppretter bedriftsprofil...", "Konfigurerer arbeidsområde...", etc.
3. completeSignup() server action runs:
   - Provisions or reuses an onboarding workspace shell
   - Saves provisional company details, opening hours, social media, and intake intelligence
   - Keeps final workspace truth for the authenticated onboarding flow
   - Emits "wizard completed" telemetry event for the join wizard
   - Marks signup_progress.completed = true
4. System clears localStorage wizard state
5. System redirects:
   - `/onboarding?ws={workspaceId}`
6. Authenticated onboarding finalizes the workspace shell, then the user continues to `/dashboard/setup` for post-bootstrap completion work

**Postcondition:** User is authenticated, the workspace shell exists, and the flow continues through authenticated finalization instead of skipping directly to dashboard runtime surfaces.

**Error paths:**

- Email already registered → Step 6 tries signInWithPassword, if wrong password shows error
- Company/workspace creation fails → SetupLoading shows error with "Gå tilbake" button → User returns to Step 6
- Idempotency: if signup_progress.completed is already true, returns existing workspace (no duplicate creation)
