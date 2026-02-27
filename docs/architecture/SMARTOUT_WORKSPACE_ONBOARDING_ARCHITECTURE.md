# Smartout — Workspace Onboarding Architecture

> **Version:** 3.1 | February 2026
> **Supersedes:** SMARTOUT_MODULE_1_ONBOARDING.md Section 2 + previous v3.0 draft
> **Scope:** Admin workspace setup — from URL to active first Season
> **Status:** Architecture spec — ready for implementation

---

## 1. Philosophy: Your First Mission

The old onboarding was a form. The v3.0 draft was a confirmation pipeline. This version goes further:

**The onboarding IS building your first Season.**

The admin doesn't "set up Smartout and then create a season later." The onboarding _is_ the process of creating the first Season. By the time they're done, they haven't just configured a workspace — they've prepared their battlefield and are ready to press PLAY.

### The Narrative Arc

```
ACT 1: WHO ARE YOU?       (Identity — automated, just confirm)
ACT 2: WHO DO YOU LOOK?   (Branding — prepared, just approve)
ACT 3: WHAT IS A SEASON?  (Education — teach the core concept)
ACT 4: BUILD YOUR SEASON  (The mission — departments, teams, locations, zones)
ACT 5: PRESS PLAY         (Activation — season goes live, invite employees)
```

The admin leaves onboarding understanding Smartout's core concept (Seasons), with a fully configured workspace, an active Season, a contract in their email, and a "invite your first employee" CTA.

### Core Principles

1. **Scrape first, confirm second.** Never show an empty form.
2. **Four intelligence sources.** Website, Brønnøysundregistrene, web search, and AI analysis.
3. **Industry templates as baseline.** AI adjusts the template, it doesn't replace it.
4. **Season-first structure.** Everything the admin builds is framed within "your first Season."
5. **Educate while configuring.** Each step teaches a Smartout concept _while_ the admin does real setup.
6. **Progressive commitment.** Each step saves. Resume anywhere.
7. **Contract-ready by Act 2.** Generate and send as soon as identity + branding are confirmed.

---

## 2. Four Intelligence Sources

When the admin provides a URL, four parallel processes fire:

### Source 1: Website Scraping (existing Scrapling service)

```
Input:  URL
Extracts:
  - Company name, email, phone
  - Images (logo candidates, food/interior photos)
  - Menu links, social profiles, booking system
  - Content text for AI analysis
  - Location hints (terrasse, bankett, etc.)
  - Staff/team page (if exists — indicates org structure)
  - Opening hours (shift pattern indicators)
```

### Source 2: Brønnøysundregistrene (existing integration)

```
Input:  Org number (manual or auto-discovered from website)
Returns:
  - Legal name, business address
  - Daglig leder (from roles API)
  - Employee count (antallAnsatte)
  - NACE industry code + description
  - Company type (AS, ENK, NUF)
  - Registration date
```

### Source 3: Web Search (NEW)

Once we have company name + city from Source 1 or 2, we search the web for additional intelligence:

```
Input:  "{companyName} {city} restaurant" (or hotel, café, etc.)
Searches for:
  - Google reviews / TripAdvisor → rating, review count, cuisine type
  - Media mentions → awards, press coverage, notable events
  - Competitor context → what similar businesses in the area look like
  - Seasonal patterns → "sommermeny", "julebord", event calendar
  - Job listings → indicates which positions they're hiring for
  - Social media activity → Instagram/Facebook presence, posting style
```

**Why this matters for onboarding:**

- TripAdvisor says "Italian restaurant, fine dining" → confirms concept classification
- Google reviews mention "great terrace in summer" → seasonal zone suggestion
- Found a job listing for "Sous Chef" → position confirmation
- Media says "awarded best cocktail bar 2024" → bar department should be prominent
- Seasonal patterns found → pre-configure season dates and type

**Implementation:** Edge Function that calls web search API (SerpAPI, Brave Search, or Claude with web search tool). Returns structured intelligence that feeds into the AI analysis.

### Source 4: AI Analysis (NEW — enhanced from v3.0)

Receives combined data from Sources 1-3 and produces actionable suggestions:

```
Input:
  - Scraped website content + images
  - Brreg data (employee count, NACE code, legal info)
  - Web search results (reviews, mentions, seasonal patterns)
  - Industry template library

Output:
  - Industry classification + concept refinement
  - Department suggestions (adjusted from template)
  - Position suggestions per department
  - Team suggestions (including seasonal teams)
  - Location/zone suggestions
  - Branding suggestions (slogan, descriptions)
  - Season intelligence:
      - Current time of year → season type suggestion
      - Detected seasonal patterns → pre-filled season dates
      - High/low season classification
  - Logo ranking, photo ranking
  - Reasoning (transparent — shown to admin as hints)
```

---

## 3. The Onboarding Flow

### Overview

```
LANDING PAGE
[Enter URL] ──→  /onboarding?url=...

                  ┌─────────────────────────────────────┐
                  │  ACT 1: WHO ARE YOU?                 │
                  │                                      │
                  │  Step 0: Intake (URL + auth)          │
                  │  Step 1: Intelligence (background)   │
                  │  Step 2: Confirm Identity             │
                  └──────────────┬──────────────────────┘
                                 │
                  ┌──────────────▼──────────────────────┐
                  │  ACT 2: HOW DO YOU LOOK?             │
                  │                                      │
                  │  Step 3: Confirm Branding & Outreach  │
                  │  🔄 Contract generated + sent         │
                  └──────────────┬──────────────────────┘
                                 │
                  ┌──────────────▼──────────────────────┐
                  │  ACT 3: WELCOME TO SMARTOUT          │
                  │                                      │
                  │  Step 4: Season Education             │
                  │  "A Season is how Smartout works..."  │
                  │  Interactive explainer + video         │
                  │  "Ready to build your first Season?"  │
                  └──────────────┬──────────────────────┘
                                 │
                  ┌──────────────▼──────────────────────┐
                  │  ACT 4: BUILD YOUR FIRST SEASON      │
                  │                                      │
                  │  Step 5: Season Identity              │
                  │    Name, dates, type, high/low        │
                  │  Step 6: Departments                  │
                  │    From template + AI suggestions      │
                  │  Step 7: Positions                    │
                  │    Per department, from template       │
                  │  Step 8: Teams                        │
                  │    Default + seasonal teams            │
                  │  Step 9: Locations & Zones             │
                  │    Physical structure + seasonal zones │
                  └──────────────┬──────────────────────┘
                                 │
                  ┌──────────────▼──────────────────────┐
                  │  ACT 5: PRESS PLAY                   │
                  │                                      │
                  │  Step 10: Season Battlefield Review    │
                  │    Everything you built, summarized   │
                  │    "Activate your Season"              │
                  │  → Redirect to Dashboard               │
                  │  → "Invite your first employee" CTA   │
                  └─────────────────────────────────────┘
```

---

### ACT 1: WHO ARE YOU?

#### Step 0: Intake

Same as v3.0. Accept URL, ensure auth, trigger intelligence pipeline.

**Key addition:** If user enters URL on landing page _without_ being logged in, the URL is preserved. They sign up, and the onboarding starts immediately with their URL pre-loaded. No re-entry.

#### Step 1: Intelligence Gathering (Background)

Four sources fire in parallel while admin sees a progress screen:

```
┌──────────────────────────────────────────────┐
│                                              │
│  🔍  Building your workspace...              │
│                                              │
│  ✅  Website analyzed                        │
│  ✅  Company registry searched               │
│  🔄  Searching web for additional intel...   │
│  🔄  AI preparing your setup...              │
│                                              │
│  ████████████░░░░  75%                       │
│                                              │
└──────────────────────────────────────────────┘
```

Each source completes independently. As soon as Brreg + Scrape are done, we can show Step 2 while web search + AI continue in the background (their results enhance later steps).

#### Step 2: Confirm Identity

Prepopulated card with company data from Sources 1 + 2. Same as v3.0 — legal name, org number, address, daglig leder, employee count, industry, concept, contact info.

**New:** If we found the company in web search results (Source 3), show a confidence indicator:

> "Vi fant 127 omtaler på Google (4.3★) og 89 på TripAdvisor. Klassifisert som: Fine Dining, Italiensk."

**On confirm:** Save to company + workspace. Move to Act 2.

---

### ACT 2: HOW DO YOU LOOK?

#### Step 3: Confirm Branding & Outreach

Same as v3.0 but enhanced with AI-generated content:

- **Logo:** AI-ranked from scraped images, or upload
- **Cover photo:** AI-ranked, or upload
- **Slogan:** AI-generated from website content + concept
- **Short description (≤280 chars):** For invites, app headers, employee communications
- **Extended description:** For contracts, onboarding docs, staff handbook intro
- **Communication tone:** Formal / Casual / Energetic

**Preview panel** shows how branding appears in: invite email, employee app, contract header.

**On confirm:**

- Save branding to workspace
- Upload logo + cover to Supabase Storage
- **TRIGGER:** Generate contract via DocuSeal → send to admin email
- Set `onboarding_status = 'branding_confirmed'`

**Transition message:**

> "Flott! Vi har nå all informasjonen vi trenger. En kontrakt er på vei til din e-post.
> I mellomtiden — er du klar til å planlegge din første sesong i Smartout?"
>
> [Ja, la oss gå! →]

---

### ACT 3: WELCOME TO SMARTOUT (Education)

#### Step 4: Season Education

**This is the pivot point.** The admin has confirmed who they are and how they look. Now we teach them _what Smartout actually is_ before they build anything.

**Goal:** The admin understands that a Season is the core operating model. Everything in Smartout happens within a Season.

**Format:** Interactive explainer — short, visual, not a wall of text. Could include:

##### Option A: Animated Explainer (Interactive Cards)

```
┌──────────────────────────────────────────────┐
│                                              │
│  🎯  Welcome to Smartout, {name}!            │
│                                              │
│  Everything in Smartout revolves around       │
│  one concept: THE SEASON.                    │
│                                              │
│  ┌─────────────────────────────────────┐     │
│  │                                     │     │
│  │  [Animated visual showing:]          │     │
│  │  Season as a container              │     │
│  │  → Teams inside it                  │     │
│  │  → Departments as pillars           │     │
│  │  → Tasks flowing through            │     │
│  │  → Points accumulating              │     │
│  │  → Leaderboard updating             │     │
│  │                                     │     │
│  └─────────────────────────────────────┘     │
│                                              │
│  A Season defines your operational period.   │
│  Different seasons have different needs:     │
│                                              │
│  🌞 Summer? Open the terrace, hire staff.    │
│  🎄 Christmas? Julebord team, special menus. │
│  📋 Normal? Just run your daily operations.  │
│                                              │
│  You set up the battlefield.                 │
│  Your team competes for points.              │
│  Smartout handles the rest.                  │
│                                              │
│  [Continue →]                                │
│                                              │
└──────────────────────────────────────────────┘
```

##### Option B: Short Video (30-60 seconds)

Embedded explainer video showing:

1. Season as a concept (5 seconds)
2. What goes inside a season: teams, departments, zones (10 seconds)
3. Daily operations within a season: sessions, tasks, points (15 seconds)
4. The gamification layer: leaderboard, boosters (10 seconds)
5. "Press PLAY" moment (5 seconds)
6. "Now let's build yours" (5 seconds)

##### Option C: Both

Show the video first, then the interactive cards for reinforcement. Or let the user choose: "Watch a 45-second video" or "Read the quick guide."

**After education, the seasonal context question:**

```
┌──────────────────────────────────────────────┐
│                                              │
│  📅  It's February 25, 2026.                 │
│                                              │
│  Where is {companyName} right now?           │
│                                              │
│  ┌──────────────┐  ┌──────────────┐         │
│  │  🟢 Low      │  │  🟡 Getting  │         │
│  │  Season      │  │  Ready       │         │
│  │              │  │              │         │
│  │  Quiet       │  │  Preparing   │         │
│  │  period,     │  │  for busy    │         │
│  │  normal ops  │  │  season      │         │
│  └──────────────┘  └──────────────┘         │
│                                              │
│  ┌──────────────┐  ┌──────────────┐         │
│  │  🔴 High     │  │  🔵 Just     │         │
│  │  Season      │  │  Normal      │         │
│  │              │  │              │         │
│  │  Peak busy   │  │  No seasonal │         │
│  │  period      │  │  variation   │         │
│  └──────────────┘  └──────────────┘         │
│                                              │
│  💡 "Based on your industry and location,    │
│     most restaurants in Oslo are in low       │
│     season right now, preparing for spring."  │
│     (from web search intelligence)           │
│                                              │
└──────────────────────────────────────────────┘
```

**This answer drives everything in Act 4:**

- **Low season:** Simple setup, focus on fundamentals, suggest "Vårsesong" (Spring Season)
- **Getting ready:** Setup with upcoming season dates, suggest preparing seasonal teams/zones
- **High season:** Urgent setup, suggest immediate activation, emphasize quick team creation
- **Just normal:** Default season, no seasonal complexity, straightforward

---

### ACT 4: BUILD YOUR FIRST SEASON

**The admin is now building a real Season.** Every step in this act creates real data in the database, scoped to their first Season.

#### Step 5: Season Identity

```
┌──────────────────────────────────────────────┐
│                                              │
│  🏟️  Name Your Season                        │
│                                              │
│  ┌─────────────────────────────────────┐     │
│  │  Season Name                         │     │
│  │  [Vårdrift 2026          ]           │     │
│  │  (AI-suggested based on date + type) │     │
│  └─────────────────────────────────────┘     │
│                                              │
│  Start Date: [Feb 25, 2026] (today)          │
│  End Date:   [May 31, 2026] (AI-suggested)   │
│                                              │
│  Season Type:                                │
│  ● Calendar  ○ Focus  ○ Cycle  ○ Custom      │
│                                              │
│  💡 "Since you're in low season, we suggest  │
│     running until summer starts. You'll       │
│     create a new Summer Season when the      │
│     terrasse opens."                         │
│                                              │
│  [Back]                    [Next: Avdelinger →]│
└──────────────────────────────────────────────┘
```

**On confirm:** Create season record (`status: draft`). All subsequent steps scope to this season.

#### Step 6: Departments

**Departments are permanent (never seasonal)** — but the Season framing makes it natural:

> "For your spring season, which departments will be active?"

Prepopulated from industry template + AI analysis (same logic as v3.0 — employee count thresholds, scraped keywords, web search intelligence).

```
┌──────────────────────────────────────────────┐
│                                              │
│  🏗️  Departments for {seasonName}             │
│                                              │
│  These are permanent — they'll be here for   │
│  every season. You can add seasonal teams     │
│  inside them in the next step.               │
│                                              │
│  ┌────────────────────────────┐              │
│  │ 🍳 Kjøkken                │  ✅ [Edit]   │
│  │    Your kitchen brigade    │              │
│  └────────────────────────────┘              │
│  ┌────────────────────────────┐              │
│  │ 🍽️ Service                 │  ✅ [Edit]   │
│  │    Front of house          │              │
│  └────────────────────────────┘              │
│  ┌────────────────────────────┐              │
│  │ 🍸 Bar                     │  ✅ [Edit]   │
│  │    Detected from website   │              │
│  └────────────────────────────┘              │
│                                              │
│  [+ Add Department]                          │
│                                              │
│  💡 "With 23 employees and a dedicated bar   │
│     section on your website, we recommend    │
│     three departments. If you grow past 40,  │
│     consider adding Administration."         │
│                                              │
└──────────────────────────────────────────────┘
```

**Key UX:** Each department card shows _why_ it was suggested. AI reasoning is visible, not hidden.

**On confirm:** Save departments to database.

#### Step 7: Positions

Per-department position setup. Same intelligence-driven prepopulation.

```
┌──────────────────────────────────────────────┐
│                                              │
│  👥  Positions                               │
│                                              │
│  Kjøkken                                     │
│    ✅ Sjefskokk (Head Chef)                  │
│    ✅ Sous Chef                              │
│    ✅ Kokk (Line Cook)                       │
│    ✅ Oppvaskhjelp                           │
│    ☐  Konditor — "We noticed a dessert       │
│       menu on your website"                  │
│    [+ Add Position]                          │
│                                              │
│  Service                                     │
│    ✅ Hovmester                              │
│    ✅ Servitør                               │
│    ✅ Runner                                 │
│    [+ Add Position]                          │
│                                              │
│  Bar                                         │
│    ✅ Bartender                              │
│    ✅ Barback                                │
│    ☐  Sommelier — "Award-winning cocktails   │
│       suggest a senior bar role"             │
│    [+ Add Position]                          │
│                                              │
└──────────────────────────────────────────────┘
```

**On confirm:** Save positions to database.

#### Step 8: Teams

This is where Season really starts to matter. Teams CAN be seasonal.

```
┌──────────────────────────────────────────────┐
│                                              │
│  🏆  Teams for {seasonName}                   │
│                                              │
│  PERMANENT TEAMS (every season)              │
│  ┌────────────────────────────┐              │
│  │ Kjøkken Dag                │  ✅          │
│  │ Kjøkken Kveld              │  ✅          │
│  │ Service Dag                │  ✅          │
│  │ Service Kveld              │  ✅          │
│  │ Bar Kveld                  │  ✅          │
│  └────────────────────────────┘              │
│                                              │
│  SEASONAL TEAMS (this season only)           │
│  ┌────────────────────────────┐              │
│  │ 💡 No seasonal teams needed │              │
│  │    for a low season.        │              │
│  │    When summer comes, add:  │              │
│  │    "Uteservering-teamet"    │              │
│  └────────────────────────────┘              │
│                                              │
│  [+ Add Permanent Team]                      │
│  [+ Add Seasonal Team]                       │
│                                              │
└──────────────────────────────────────────────┘
```

**The AI hint about future seasons is important** — it teaches the admin that they'll create new teams when a new Season starts. This reinforces the Season concept without being heavy-handed.

**On confirm:** Save teams to database (permanent teams have `season_id: null`, seasonal teams reference the new season).

#### Step 9: Locations & Zones

Main location from address. Zones suggested from scraping + seasonal context.

```
┌──────────────────────────────────────────────┐
│                                              │
│  📍  Locations & Zones                       │
│                                              │
│  LOCATIONS (permanent)                       │
│  ┌────────────────────────────┐              │
│  │ 📍 {companyName}           │              │
│  │    {address}               │              │
│  │    Type: Main              │              │
│  └────────────────────────────┘              │
│                                              │
│  ZONES                                       │
│  ┌────────────────────────────┐              │
│  │ Hovedsal (Main Dining)     │  Permanent   │
│  │ Capacity: [60]             │  ✅          │
│  └────────────────────────────┘              │
│  ┌────────────────────────────┐              │
│  │ Privat rom (Private Room)  │  Permanent   │
│  │ Capacity: [12]             │  ✅          │
│  └────────────────────────────┘              │
│  ┌────────────────────────────┐              │
│  │ Uteservering (Terrace)     │  Seasonal ☀️│
│  │ Capacity: [40]             │  ☐ (summer)  │
│  │ 💡 "Detected from website. │              │
│  │    Not active in spring —  │              │
│  │    add when summer starts" │              │
│  └────────────────────────────┘              │
│                                              │
│  [+ Add Location]  [+ Add Zone]              │
│                                              │
└──────────────────────────────────────────────┘
```

**On confirm:** Save locations and zones.

---

### ACT 5: PRESS PLAY

#### Step 10: Season Battlefield Review

The "Setting up the battlefield" moment. Everything the admin built, shown as a cohesive overview.

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  🏟️  Your Season is Ready                             │
│                                                      │
│  ┌─────────────────────────────────────────────┐     │
│  │  VÅRDRIFT 2026                               │     │
│  │  Feb 25 – May 31, 2026  •  Calendar Season   │     │
│  │                                               │     │
│  │  3 Departments  •  12 Positions  •  5 Teams  │     │
│  │  1 Location  •  2 Zones                      │     │
│  └─────────────────────────────────────────────┘     │
│                                                      │
│  ┌──────┐  ┌──────┐  ┌──────┐                       │
│  │🍳 Kjø│  │🍽️ Ser│  │🍸 Bar│                       │
│  │kken  │  │vice  │  │      │                       │
│  │4 pos │  │3 pos │  │2 pos │                       │
│  │2 team│  │2 team│  │1 team│                       │
│  └──────┘  └──────┘  └──────┘                       │
│                                                      │
│  📄 Contract: Sent to {email} ✅                      │
│                                                      │
│  ──────────────────────────────────────────          │
│                                                      │
│  "Your battlefield is set. Activate your season      │
│   and start inviting your team."                     │
│                                                      │
│  ┌──────────────────────────────────────────┐        │
│  │                                          │        │
│  │    ▶  ACTIVATE SEASON                    │        │
│  │                                          │        │
│  └──────────────────────────────────────────┘        │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**On "ACTIVATE SEASON":**

1. Set season `status: active`
2. Set `company.onboarding_status = 'completed'`
3. Set `onboarding_session.completed_at = now()`
4. Redirect to dashboard
5. Dashboard shows welcome overlay with CTA: "Invite your first employee"

---

## 4. The Education Layer

Throughout the onboarding, we teach Smartout concepts _at the moment they're relevant_:

| Step    | Concept Taught                                      | How                                                             |
| ------- | --------------------------------------------------- | --------------------------------------------------------------- |
| Step 4  | **Season** — the core operating model               | Animated explainer / video                                      |
| Step 5  | **Season types & lifecycle**                        | Contextual hints while naming season                            |
| Step 6  | **Departments** — permanent vs seasonal             | "Departments are your pillars. They never change."              |
| Step 7  | **Positions** — role-based assignment               | "Positions aren't tied to people — they're assigned per shift." |
| Step 8  | **Teams** — dynamic groups, season-aware            | "Teams change with seasons. New summer? New team."              |
| Step 9  | **Zones** — seasonal space management               | "Zones open and close with seasons. Terrace = summer."          |
| Step 10 | **Gamification** — points, leaderboard, battlefield | "Your team will compete for points. You've set the field."      |

**Each hint is 1-2 sentences, inline, non-blocking.** The admin can ignore them or read them. No popups, no modals, no forced reading. Just contextual intelligence.

**Video content needed (future):**

- 45-second "What is a Season?" explainer (Step 4)
- Optional: 30-second clips per concept (Department, Team, Zone, Points)
- These can be produced later — the onboarding works without them

---

## 5. Industry Template Library

Same as v3.0 (employee count thresholds, conditional departments, etc.) but now with seasonal patterns built in:

```typescript
interface IndustryTemplate {
  industry: IndustryType;

  // Department structure (by employee count)
  departments: DepartmentTemplate[];

  // NEW: Seasonal patterns
  seasonalPatterns: {
    name: string; // "Sommerdrift"
    typicalMonths: number[]; // [6, 7, 8]
    additionalTeams: TeamTemplate[];
    additionalZones: ZoneTemplate[];
    additionalPositions: PositionTemplate[];
  }[];

  // NEW: Shift patterns (for Team suggestions)
  typicalShiftPatterns: {
    name: string; // "Dag/Kveld"
    shifts: { name: string; startHour: number; endHour: number }[];
  }[];
}
```

Example restaurant template seasonal patterns:

```
Restaurant Seasonal Patterns:
  Sommerdrift (Jun-Aug):
    + Uteservering team
    + Terrasse zone
    + Grill Chef position
    + Seasonal servers

  Julebord (Nov-Dec):
    + Julebord team
    + Bankett zone
    + Julbord Kokk position
    + Extra service staff

  Påske (Mar-Apr):
    + Extended hours
    + Påske menu focus
```

---

## 6. Database Changes

### Workspace table additions

```sql
ALTER TABLE public.workspace ADD COLUMN IF NOT EXISTS
  cover_photo_url       text,
  slogan                text,
  short_description     varchar(280),
  extended_description  text,
  brand_color           varchar(7),
  communication_tone    varchar(20);
```

### Company table additions

```sql
ALTER TABLE public.company ADD COLUMN IF NOT EXISTS
  legal_name            text,
  nace_code             varchar(10),
  nace_description      text,
  daglig_leder          text,
  website               text,
  company_type          varchar(10),
  registration_date     date;
```

### Onboarding session table (resume + learning data)

```sql
CREATE TABLE public.onboarding_session (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid REFERENCES auth.users(id),
  company_id             uuid REFERENCES public.company(company_id),
  workspace_id           uuid REFERENCES public.workspace(workspace_id),
  season_id              uuid REFERENCES public.season(season_id),

  -- Progress
  current_step           integer DEFAULT 0,
  completed_steps        integer[] DEFAULT '{}',
  seasonal_context       varchar(20),        -- low | getting_ready | high | normal

  -- Intelligence sources (raw data for reference)
  source_url             text,
  scraped_data           jsonb,
  brreg_data             jsonb,
  web_search_data        jsonb,              -- NEW: web search results
  ai_analysis            jsonb,

  -- What AI suggested vs what admin confirmed (learning data)
  suggested_departments  jsonb,
  confirmed_departments  jsonb,
  suggested_positions    jsonb,
  confirmed_positions    jsonb,
  suggested_teams        jsonb,
  confirmed_teams        jsonb,
  suggested_locations    jsonb,
  confirmed_locations    jsonb,
  suggested_branding     jsonb,
  confirmed_branding     jsonb,

  -- Contract
  contract_generated_at  timestamptz,
  contract_sent_at       timestamptz,
  contract_signed_at     timestamptz,
  contract_url           text,

  -- Meta
  started_at             timestamptz DEFAULT now(),
  completed_at           timestamptz,
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now()
);
```

### Industry templates table (future — start with JSON)

```sql
-- V2: When templates become admin-customizable
CREATE TABLE public.industry_template (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  industry               text NOT NULL,
  version                text NOT NULL,
  template_data          jsonb NOT NULL,      -- Full template structure
  is_default             boolean DEFAULT false,
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now()
);
```

---

## 7. Edge Functions

### 7.1 `gather-workspace-intelligence` (replaces `extract-workspace-data`)

Orchestrates all four sources:

```
POST /functions/v1/gather-workspace-intelligence
Body: { url: string, orgNumber?: string }

1. Call Scrapling microservice → scrapedData
2. Search Brreg (by org number or by name) → brregData
3. Web search (company name + city + industry) → webSearchData
4. AI analysis (all three inputs + templates) → aiAnalysis
5. Create onboarding_session record
6. Create provisional company + workspace
7. Return combined intelligence
```

### 7.2 `confirm-onboarding-step`

Generic per-step save endpoint (same as v3.0).

### 7.3 `generate-contract`

DocuSeal integration, triggered after Step 3.

### 7.4 `analyze-workspace`

Claude API call with structured output. Receives all intelligence, produces suggestions.

### 7.5 `web-search-intelligence` (NEW)

```
POST /functions/v1/web-search-intelligence
Body: { companyName: string, city: string, industry: string }

Searches: Google reviews, TripAdvisor, media, job listings
Returns: { reviews, seasonalPatterns, pressmentions, jobListings, socialPresence }
```

---

## 8. What Changed from Module 1 Doc

| Old Module 1 Section                        | What happens to it                                                                           |
| ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Section 2: Workspace Creation               | **Replaced by this document.** The 5-step wizard becomes a 10-step Season-driven onboarding. |
| Section 3: Invitation Flow                  | **Unchanged.** Starts after onboarding completes (Step 10 → "Invite first employee").        |
| Section 4: Trainee Mode                     | **Unchanged.** Employee onboarding after they accept an invite.                              |
| Sections 5-9: Module Journeys, AI, Progress | **Unchanged.** All employee-facing onboarding.                                               |

**The clear boundary:**

- **This document:** Admin builds workspace + first Season (Steps 0-10)
- **Module 1 remainder:** Employees are invited and onboarded into the workspace

---

## 9. Implementation Priority

| Priority | What                                                 | Why                                                         |
| -------- | ---------------------------------------------------- | ----------------------------------------------------------- |
| 🔴 P0    | Steps 0-2 (Intelligence → Identity)                  | Core pipeline. Everything depends on this working.          |
| 🔴 P0    | Step 4 (Season Education) + Step 5 (Season Identity) | The conceptual breakthrough. Admin must understand Seasons. |
| 🔴 P0    | Step 6 (Departments) with industry templates         | Most impactful prepopulation. Unlocks everything.           |
| 🟡 P1    | Step 3 (Branding)                                    | Important but not blocking.                                 |
| 🟡 P1    | Steps 7-9 (Positions, Teams, Locations)              | Follow naturally from departments.                          |
| 🟡 P1    | Step 10 (Battlefield Review + Activate)              | The payoff moment.                                          |
| 🟢 P2    | Web search intelligence (Source 3)                   | Enhances quality but not required for MVP.                  |
| 🟢 P2    | Contract generation                                  | Business-critical but can be manual initially.              |
| 🟢 P2    | Video content for education                          | Text works fine. Video is polish.                           |
| 🟢 P2    | Scraper enhancements (deep mode, logo detection)     | Current scraper is functional. Enhance iteratively.         |

---

## 10. Decisions Log

| #   | Decision                  | Choice                                                   | Rationale                                                                    |
| --- | ------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | Onboarding endpoint       | Building your first Season                               | Season IS Smartout. Teaching it during setup creates understanding.          |
| 2   | Four intelligence sources | Scrape + Brreg + Web Search + AI                         | More data = better suggestions = less admin work.                            |
| 3   | Education approach        | Inline contextual hints + optional video                 | Non-blocking. Admin learns by doing, not by reading.                         |
| 4   | Seasonal context question | "Where are you right now? Low/High/Getting ready/Normal" | Drives everything: season name, dates, team suggestions, zone visibility.    |
| 5   | Department permanence     | Made explicit in UX: "Departments are your pillars"      | Prevents confusion about departments vs seasonal teams.                      |
| 6   | Season activation         | "Press PLAY" as the finale                               | Satisfying endpoint. Admin has built something real and is activating it.    |
| 7   | Web search timing         | Runs in parallel, results enhance later steps            | Don't block on web search. Scrape + Brreg are enough for Step 2.             |
| 8   | Seasonal team suggestions | Show future patterns even if not active now              | Teaches the admin how Seasons will work going forward.                       |
| 9   | Contract trigger          | After branding (Step 3), before Season setup             | We have all legal info. Don't wait for full setup.                           |
| 10  | Template storage          | JSON in codebase (V1)                                    | Simple. Version-controlled. Move to DB when customization becomes a feature. |

---

_The onboarding IS the first Season. The admin doesn't configure Smartout and then start working — they build their battlefield, press PLAY, and they're live._

---

## Appendix A: Voice Infrastructure Discovery (from V1 Revised Architecture)

> **Context:** Repo agent discovery revealed that 80% of the voice infrastructure already exists.
> **Supersedes:** SMARTOUT_V1_REVISED_ARCHITECTURE.md (retired February 26, 2026)

### What We Don't Need to Build

| Component | Status | Location |
|-----------|--------|----------|
| Voice MCP server | ✅ Production on Vercel | `mcp-servers/intervju-mcp/` |
| Journey/mission system | ✅ Working with 4 missions | `mission_definitions` + `stage_definitions` + `interview_sessions` in Supabase |
| Ultravox WebRTC client | ✅ Full implementation | `ai_layer/apps/dashboard/src/components/voice-calls/browser-call.tsx` |
| Call creation API | ✅ Working | `ai_layer/apps/dashboard/src/app/api/voice-calls/` |
| Stage prompt builder | ✅ Generic, works for any mission | `buildStagePrompt()` |
| Norwegian voice config | ✅ Configured (languageHint: "no") | Call creation payload |
| Mute/unmute/transcripts | ✅ Built into BrowserCall | Component props |
| Status indicators | ✅ Color-coded (gray→yellow→cyan→blue→magenta) | BrowserCall component |
| Tool proxy pattern | ✅ Exists for advance_stage | `/api/voice-calls/tools/` |
| Session persistence | ✅ Supabase with JSONB collected_data | `interview_sessions` table |

### What V1 Voice Work Actually Requires

1. Insert 1 mission + 7 stage definitions into Supabase
2. Write system prompts for each stage (Norwegian, restaurant context)
3. Register additional tools (create_department, etc.) alongside advance_stage
4. Build the wizard UI that syncs with BrowserCall + MCP session state
5. Wire entity-creation tools to Supabase Core tables

### Dual Input Model (Voice + UI)

Both paths write to the same Supabase tables. The wizard form and Mr. Botsson tools are two interfaces to the same data. Real-time sync via:
- Voice creates entity → Supabase Realtime subscription → UI updates
- UI creates entity → `get_wizard_state` tool → Mr. Botsson knows

### Gotcha Mitigations

| Gotcha | Solution |
|--------|----------|
| One tool per call currently | Register all 10 tools in selectedTools array. Ultravox supports multiple. |
| collected_data is flat JSONB | Use for session metadata only. Entities written to Core tables via HTTP tools. |
| No undo/go-back in MCP | Wizard UI handles back navigation independently. MCP tracks furthest stage. |
| System prompt replaced per stage | Perfect for wizard. Each stage gets fresh context with collected_data summary. |
| 5-min stage cache | Not an issue — wizard stages are static seed data. |
| 24h session expiry | Add resume flow: check for active session on login → offer to continue. |

### Revised Build Timeline (V1)

| Phase | What | Duration |
|-------|------|----------|
| 0. Database | Core tables + RLS + seed data + mission/stage inserts | 3-4 days |
| 1. Auth + Company/Workspace | Signup, login, company creation, workspace creation | 2-3 days |
| 2. Wizard API routes | 9 routes under `/api/wizard/` | 3-4 days |
| 3. Wizard UI shell | 7-step wizard with progress, forms, Realtime subscriptions | 5-7 days |
| 4. Voice integration | Import BrowserCall, wire up call creation + tools + stage transitions | 2-3 days |
| 5. Infographics | 7 SVG/React visual explanations | 3-4 days |
| 6. Dashboard | Read-only org structure view + edit mode | 2-3 days |
| 7. Polish | Completion celebration, error states, resume-from-last-step | 2-3 days |

**Total: 4-5 weeks** (down from 6-8, because voice infrastructure already exists)
