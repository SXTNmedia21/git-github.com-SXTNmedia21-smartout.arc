# CLAUDE.md — Smartout v3

> Ground truth for this repository. Verified against actual code, migrations, and configs.
> Last verified: 2026-02-27. If something contradicts this file, the CODE is right — update this doc.

---

## Project Identity

**Smartout** is an Employee Readiness System for shift-based businesses in Norway (restaurants, hotels, cafes, bars).

**Core problem:** ~75% annual turnover in the Norwegian service industry. Smartout makes employees _ready_ — trained, compliant, equipped, and informed before their first shift.

**Context:** This is a rebuild from Bubble.io. The system is already operational with live Stripe billing and DocuSign contracts. We are rebuilding on a modern stack — not prototyping.

**"Ready" means:** All assigned Policies learned, all Protocols completed — knowledge tested, procedures trained, confirmations signed.

---

## Tech Stack (Verified)

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Web Dashboard | Next.js (App Router) | 16.1.6 | React 19.2.3, TypeScript |
| Styling | Tailwind CSS | v4 | CSS-based config, OKLCH colors |
| UI Components | shadcn/ui | new-york style | lucide icons, CSS variables |
| Backend | Supabase | PostgreSQL 17 | Auth, Storage, Realtime, Edge Functions (Deno) |
| Telemetry | PostHog | EU instance | Browser + Node SDK, proxy rewrites |
| Env Validation | @t3-oss/env-nextjs | — | Zod schema in `apps/web/src/env.ts` |
| Voice | Ultravox | — | Voice assistant in dashboard |
| Video | Remotion | v4 | Root devDep, Three.js + Lottie |
| Automation | n8n + Edge Functions | — | n8n for complex workflows |
| Hosting | Vercel (web), Supabase Cloud | — | DigitalOcean (n8n) |
| Language | TypeScript | ^5.0 | Everywhere. No exceptions. |
| Monorepo | pnpm 9.0.0 + Turborepo | — | `op run` for 1Password secret injection |
| Fonts | Geist + Geist Mono | — | Google Fonts via next/font |
| Testing | Playwright | — | E2E in `apps/e2e` |
| Agents | Pydantic | — | Python agents in `agents/` |

### Third-Party Integrations (Live)

| Service | Purpose | Status |
|---------|---------|--------|
| Stripe | Billing, subscriptions | Live (rebuild in progress) |
| DocuSign | Employment contracts, confirmations | Live (rebuild in progress) |
| SendGrid | Transactional email | Configured |
| Twilio | SMS notifications | Configured |
| PostHog | Product analytics | Live (EU instance) |

---

## Monorepo Structure (Verified)

```
smartout_v3/
├── apps/
│   ├── web/              → Next.js dashboard (port 3050)
│   ├── landing/          → Next.js landing page (port 3055)
│   ├── e2e/              → Playwright E2E tests
│   └── scrapling/        → Python scraper (has own venv)
├── packages/
│   ├── ai/               → AI SDK agents, tools, adapters (@smartout/ai)
│   ├── types/            → Zod schemas, builds to dist/ (@smartout/types)
│   ├── supabase/         → SSR client + database.types.ts (@smartout/supabase)
│   ├── ui/               → Shared UI components (@smartout/ui)
│   └── telemetry/        → PostHog + Supabase telemetry (@smartout/telemetry)
├── supabase/
│   ├── migrations/       → 14 migrations (00001-00012 + timestamps)
│   ├── functions/        → 8 Edge Functions
│   ├── seed.sql          → Dev seed data
│   └── config.toml       → Local dev config
├── agents/               → Pydantic AI agents (Python)
├── docs/
│   ├── architecture/     → System architecture docs
│   ├── cross-cutting/    → Billing, i18n, GDPR, security
│   ├── decisions/        → ADRs (7 accepted)
│   ├── modules/          → Module specs (17 modules)
│   ├── plans/            → Implementation plans
│   ├── research/         → Research reports
│   └── roadmaps/         → Project roadmaps
└── CLAUDE.md             → This file
```

### Package Exports (Verified)

**@smartout/supabase** — `packages/supabase/package.json`:
```
"."           → ./src/index.ts      (barrel: types + all clients)
"./middleware" → ./src/middleware.ts  (updateSession for Next.js middleware)
"./client"    → ./src/client.ts     (createBrowserClient)
"./server"    → ./src/server.ts     (createServerClient with cookies)
```
There is NO `./admin` export. If you need a service-role client, create one.

**@smartout/types** — `packages/types/src/index.ts`:
```
exports: enums, identity, structure, governance, time
```
All types use Zod schemas with `z.infer<>` for TypeScript inference.

**@smartout/ui** — Currently only exports `button.tsx` (shared). The web app also has `dialog.tsx` locally in `apps/web/src/components/ui/`. Add shared components to this package for cross-app reuse.

**@smartout/ai** — `packages/ai/package.json`:
```
"."                    → ./src/index.ts               (types + defineTool)
"./session-context"    → ./src/session-context.ts     (session context)
"./tools/onboarding"   → ./src/tools/onboarding.ts    (onboarding tools)
"./schemas/onboarding" → ./src/schemas/onboarding.ts  (onboarding Zod schemas)
"./agents/onboarding"  → ./src/agents/onboarding.ts   (onboarding agent)
"./adapters/vercel-ai" → ./src/adapters/vercel-ai.ts  (Vercel AI SDK adapter)
"./adapters/livekit"   → ./src/adapters/livekit.ts    (LiveKit voice adapter)
```
Dependencies: Vercel AI SDK (`ai`), OpenRouter provider, Supabase client, Zod.

**@smartout/telemetry** — PostHog (browser + node) event registry and tracking hooks.

---

## Database Ground Truth

### Table Naming

The user identity table is called `user_identity`, NOT `user`.

```sql
-- CORRECT
SELECT * FROM public.user_identity WHERE user_id = $1;

-- WRONG — this table does not exist
SELECT * FROM public.user WHERE user_id = $1;
```

### Subscription Data

Subscription data lives on the `company` table. There is NO `stripe_subscription` table.

```sql
-- CORRECT — subscription columns on company
company.subscription_plan    -- text
company.subscription_status  -- text
company.trial_ends_at        -- timestamptz
```

### Existing Enums (30 total)

Before creating a new enum, check `packages/supabase/src/database.types.ts` for conflicts.

**Known conflict:** `contract_status` is already used by `employment_contract` (migration 00012). Do NOT reuse this name for platform-level contracts.

### Core Tables (11 entities)

| Entity | Table Name | Scope |
|--------|-----------|-------|
| User | `user_identity` | Global (no workspace_id) |
| Company | `company` | Global (no workspace_id) |
| Company Member | `company_member` | Global (no workspace_id) |
| Workspace | `workspace` | Has company_id |
| Profile | `profile` | workspace_id scoped |
| Department | `department` | workspace_id scoped |
| Location | `location` | workspace_id scoped |
| Team | `team` | workspace_id scoped |
| Policy | `policy` | workspace_id scoped |
| Protocol | `protocol` | workspace_id scoped |
| Season | `season` | workspace_id scoped |

### RLS Patterns (Verified)

```sql
-- SELECT pattern
USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())))

-- INSERT/UPDATE/DELETE pattern
WITH CHECK (is_admin_in_workspace(workspace_id, auth.uid()))
```

### Auth Trigger

`handle_new_user()` trigger on `auth.users` INSERT automatically creates a `user_identity` row.

### Migration Naming

- Sequential: `00001_description.sql` through `00012_description.sql`
- Timestamped: `YYYYMMDDHHMMSS_description.sql` (newer migrations)
- Regenerate types after migration: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

### Seed Data

Dev seed creates: Company (Smartout AS) → Workspace (HQ) → Location → Department → User (admin@smartout.local / password123) → CompanyMember → Profile.

Known UUIDs: `a0000000-...` (company), `b0000000-...` (workspace), `e0000000-...` (user).

### Edge Functions (8)

activate-workspace, analyze-workspace, create-invitation, extract-workspace-data, finalize-workspace, gather-workspace-intelligence, scrape-raw-data, web-search-intelligence.

---

## UI & Styling (Verified)

### Tailwind v4

This project uses **Tailwind CSS v4** with CSS-based configuration. There is NO `tailwind.config.ts`.

Theme is defined in `apps/web/src/app/globals.css` using `@theme inline` with OKLCH color variables.

```css
/* CORRECT — use CSS variables */
className="bg-background text-foreground border-border"
className="text-muted-foreground bg-muted"
className="bg-primary text-primary-foreground"

/* WRONG — hardcoded zinc values bypass theming */
className="bg-zinc-950 text-zinc-100 border-zinc-800"
```

**Note:** The existing dashboard layout (`apps/web/src/app/dashboard/layout.tsx`) uses hardcoded zinc values. New code should use CSS variables. Refactor existing code when touching it.

### shadcn/ui

- Style: `new-york`
- Icon library: `lucide`
- Base color: `neutral`
- CSS variables: enabled
- RSC: true
- Config: `apps/web/components.json`
- Installed components (web): `dialog.tsx` only
- Add new components: `npx shadcn@latest add <component>` (from `apps/web/`)

### Dashboard Layout

`apps/web/src/app/dashboard/layout.tsx` is a `"use client"` component with:
- `DashboardContext` providing: isAdminMode, isDark, adminView, scheduleLayout, scheduleView, activeLocation, workspaceData
- Admin/Employee mode toggle
- Sidebar navigation with sections: Management, Operations, Administration, Communication
- Top context bar with workspace switcher, season indicator, voice assistant
- Hardcoded mock data (workspace name, user name) — needs real data integration

### Existing Routes

```
/                          → redirects to /dashboard
/login                     → Login page
/signup                    → Signup page
/reset-password            → Password reset
/invite/[token]            → Invitation acceptance
/onboarding                → Onboarding flow (has layout)
/scrape                    → Scraper UI (has layout)
/dashboard                 → Main dashboard
/dashboard/people          → People management
/dashboard/schedule        → Shift scheduling
/dashboard/operations      → Live operations
/dashboard/reports         → Reports & KPIs
/dashboard/governance      → Policy & protocol management
/dashboard/season          → Season management
/dashboard/organization    → Organization settings
/dashboard/chat            → Team chat
/dashboard/ai              → AI assistant (Mr. Botsson)
/dashboard/onboarding-assistant → Onboarding copilot
/dashboard/my-schedule     → Employee: my shifts
/dashboard/my-training     → Employee: my training
/dashboard/my-cv           → Employee: profile & CV
/dashboard/my-salary       → Employee: salary info
/dashboard/settings        → Settings
/dashboard/help            → Help center
```

---

## Environment Variables

### Validation

Env vars are validated at build/start using `@t3-oss/env-nextjs` + Zod in `apps/web/src/env.ts`.

| Variable | Context | Required | Notes |
|----------|---------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client | Yes | Local: `http://127.0.0.1:54331` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client | Yes | From `npx supabase status` |
| `NEXT_PUBLIC_POSTHOG_KEY` | Client | No | PostHog project API key |
| `NEXT_PUBLIC_POSTHOG_HOST` | Client | No | Default: `https://eu.i.posthog.com` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | No | For admin operations only |
| `STRIPE_SECRET_KEY` | Server | No | Must start with `sk_` |
| `STRIPE_WEBHOOK_SECRET` | Server | No | Must start with `whsec_` |
| `SENDGRID_API_KEY` | Server | No | Must start with `SG.` |
| `TWILIO_ACCOUNT_SID` | Server | No | Twilio account |
| `TWILIO_AUTH_TOKEN` | Server | No | Twilio auth |
| `JWT_SECRET` | Server | No | Min 32 chars |
| `SESSION_SECRET` | Server | No | Min 32 chars |

### 1Password Integration

Root scripts use `op run --env-file=.env.template` to inject secrets at runtime. Never commit `.env.local` — it's gitignored.

### Local Development

```bash
# Get Supabase credentials
npx supabase status

# Create .env.local in apps/web/ and apps/landing/
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54331
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<from supabase status>
```

---

## Code Conventions

### TypeScript

- Strict mode always (`strict: true`)
- Use `type` over `interface` for data shapes
- No `any`. Use `unknown` + type guards if needed.
- Prefer named exports over default exports
- Use barrel exports (`index.ts`) in packages
- All types derive from Zod schemas: `z.infer<typeof Schema>`

### File Naming

- Components: `PascalCase.tsx` (e.g., `DepartmentCard.tsx`)
- Hooks: `camelCase.ts` prefixed with `use` (e.g., `useDepartmentSessions.ts`)
- Utils/lib: `camelCase.ts` (e.g., `formatCurrency.ts`)
- Types: `camelCase.ts` (e.g., `identity.ts`, `governance.ts`)
- Pages (Next.js): `page.tsx` in route folders
- Layouts: `layout.tsx` in route folders
- Migrations (sequential): `NNNNN_description.sql`
- Migrations (timestamped): `YYYYMMDDHHMMSS_description.sql`
- Edge Functions: `kebab-case/index.ts`

### Database

- Table names: `snake_case`, singular (e.g., `department_session`)
- Column names: `snake_case`
- Primary keys: `{table}_id` (e.g., `department_id`, `profile_id`)
- Foreign keys: `{referenced_table}_id`
- Timestamps: `created_at`, `updated_at` on every table
- Booleans: `is_` prefix (e.g., `is_active`, `is_required`)
- JSONB: Use for flexible/nested data. Document the shape in comments.
- UUIDs for all primary keys
- Profile status is an ENUM (`trainee | active | inactive | offboarding`), not a boolean

### Supabase

- RLS on EVERY table (except platform-admin tables which use service role)
- Use `auth.uid()` in RLS policies
- Use helper functions: `get_workspace_ids_for_user()`, `is_admin_in_workspace()`
- Edge Functions: validate input with Zod
- User-facing operations: RLS client (anon key)
- Admin/trigger operations: service role client
- After migration: always regenerate `database.types.ts`

### React / Next.js

- App Router only (never Pages Router)
- Server Components by default, `"use client"` only when needed
- Push `"use client"` boundary as deep as possible in the component tree
- Use shadcn/ui for all UI components
- Tailwind CSS with CSS variables for theming — no CSS modules, no styled-components
- Use Supabase Realtime for live updates where documented
- Fonts: Geist + Geist Mono (loaded in root layout)
- Toast notifications: use `sonner` (installed in web app)

### Performance Rules (from Vercel React Best Practices)

**Critical:**
- Use `Promise.all()` for independent async operations — never sequential awaits
- Import directly from source — avoid barrel file re-exports in app code
- Use `next/dynamic` for heavy components (charts, editors, maps)
- Defer third-party scripts (analytics, logging) — load after hydration
- Use Suspense boundaries to stream content progressively

**High:**
- Use `React.cache()` for per-request data deduplication in Server Components
- Minimize data passed from Server to Client Components — serialize only what's needed
- Restructure components to parallelize fetches (sibling components, not parent-child)

**Medium:**
- Don't subscribe to state only used in callbacks — use refs for transient values
- Extract expensive computation into memoized child components
- Use `startTransition` for non-urgent state updates
- Use functional `setState` for stable callbacks
- Derive state during render, not in effects

### Error Handling

- Edge Functions: proper HTTP status codes with JSON error body
- Client: toast via `sonner` for user-facing errors
- Never swallow errors silently
- Log errors with context (what was being attempted, what failed)

---

## Core Data Model

### Identity Layer

- `user_identity` — One per human. Login identity. Created by `handle_new_user()` trigger.
- `company` — Legal entity. Org number. Has subscription data (plan, status, trial_ends_at).
- `company_member` — Thin bridge: User <-> Company. Role: owner | admin | member.
- `workspace` — Physical workplace. The operational unit. ALL daily work happens here.
- `profile` — Rich bridge: User <-> Workspace. Role, status (enum), department, display_name.

### Structure Layer

- `department` — What (Kitchen, Floor, Bar). Permanent. Never seasonal.
- `location` — Where (Main building, Terrace). Physical places.
- `team` — Access grouping. Can be seasonal. Has a leader (`leader_profile_id`).

### Governance Layer

- `policy` — The rule. Types: operational, haccp, hr, safety, access, payroll, custom.
- `protocol` — The enforcement mechanism. 1:1 with Policy.

### Time Layer

- `season` — When. Wraps all operations. Gamification container.

### Governance Chain

```
Policy (the rule)
  └── Protocol (the enforcement)
        ├── Procedure (learn: ordered steps)
        │     └── ProcedureStep
        ├── Routine (do: recurring operational task)
        ├── Runbook (do: multi-step operational process)
        ├── ControlList (verify: checklist after routines/runbooks)
        ├── KnowledgeTest (prove: quiz)
        └── Confirmation (acknowledge: sign-off, anti-ghosting)
```

### Extension Types

- `zone` — Extends Location. Service sections.
- `asset` — Extends Location. Equipment.
- `position` — Extends Department. Job types. Assigned per shift, NOT per profile.

### Key Rules

- ALL tables (except `user_identity`, `company`, `company_member`) have `workspace_id`
- Platform-admin tables are the exception — no `workspace_id`, no RLS, service role only
- Profile has NO direct season connection. Season filters DATA, not the person.
- Department is permanent. Team can be seasonal.
- Position is per-shift, not per-person.

---

## Role & Access Model

**Roles (ascending):** employee -> manager -> admin -> owner
**Statuses (enum):** trainee -> active -> inactive -> offboarding
**Leader:** Team attribute (`team.leader_profile_id`), NOT a role

- `trainee` = sandbox mode. Actions don't affect live data.
- `active` = full employee. Real impact.
- `inactive` = paused / on leave.
- `offboarding` = leaving the organization.

---

## Module Documentation

Full documentation lives in `docs/modules/`. **Read the corresponding doc before implementing any module.**

| # | Module | Doc File | Status |
|---|--------|----------|--------|
| 1 | Onboarding | `SMARTOUT_MODULE_1_ONBOARDING.md` | Spec'd |
| 2 | Org Structure | `SMARTOUT_MODULE_2_ORG_STRUCTURE.md` | Spec'd |
| 3 | Scheduling | `SMARTOUT_MODULE_3_SCHEDULING.md` | Spec'd |
| 4 | Operations | `SMARTOUT_MODULE_4_OPERATIONS.md` | Spec'd |
| 5 | HACCP | `SMARTOUT_MODULE_5_HACCP.md` | Spec'd |
| 6 | Training | `SMARTOUT_MODULE_6_TRAINING.md` | Spec'd |
| 7 | Absence | `SMARTOUT_MODULE_7_ABSENCE.md` | Spec'd |
| 8 | Payroll | `SMARTOUT_MODULE_8_PAYROLL.md` | Spec'd |
| 9 | Communication | `SMARTOUT_MODULE_9_COMMUNICATION.md` | Spec'd |
| 10 | Reports | `SMARTOUT_MODULE_10_REPORTS.md` | Spec'd |
| 11 | Settings | `SMARTOUT_MODULE_11_SETTINGS.md` | Spec'd |
| 12 | AI | `SMARTOUT_MODULE_12_AI.md` | Spec'd |
| 13 | Multi-tenant | `SMARTOUT_MODULE_13_MULTITENANT.md` | Spec'd |
| 14 | Production | `SMARTOUT_MODULE_14_PRODUCTION.md` | Spec'd |
| 15 | Season Planning | `SMARTOUT_MODULE_15_SEASON_PLANNING.md` | Spec'd |
| 17 | Platform Admin | `SMARTOUT_MODULE_17_PLATFORM_ADMIN.md` | Spec'd |

### Architecture Decisions (ADRs)

Accepted decisions in `docs/decisions/`:

| ADR | Subject |
|-----|---------|
| 0001 | Turborepo + pnpm workspaces |
| 0002 | State-driven vs hook-driven logic boundaries |
| 0003 | shadcn/ui integration (new-york, CSS variables) |
| 0004 | Unified telemetry engine (PostHog) |
| 0007 | Dashboard layout & navigation state |
| 0008 | Dashboard scroll behavior |

**New ADRs:** When making architectural decisions, create a new file in `docs/decisions/` following the template at `docs/decisions/template.md`.

---

## Key Enums (from packages/types/src/enums.ts)

All enums are defined as Zod schemas. Use `z.infer<typeof EnumSchema>` for types.

```typescript
// Identity
ProfileRole:       "employee" | "manager" | "admin" | "owner"
ProfileStatus:     "trainee" | "active" | "inactive" | "offboarding"
CompanyMemberRole: "owner" | "admin" | "member"
AuthProvider:      "supabase" | "google" | "microsoft"

// Localization
PreferredLanguage: "no" | "sv" | "en" | "da" | "fi"
Currency:          "NOK" | "SEK" | "DKK" | "EUR"
Country:           "NO" | "SE" | "DK" | "FI"
Industry:          "restaurant" | "hotel" | "cafe" | "bar" | "catering" | "other"

// Structure
LocationType:      "main" | "outdoor" | "kitchen" | "event" | "storage" | "other"
TeamType:          "operational" | "access" | "cross_department" | "seasonal" | "custom"

// Governance
PolicyType:        "operational" | "haccp" | "hr" | "safety" | "access" | "payroll" | "custom"
PolicyScope:       "workspace" | "department" | "team" | "location"
EnforcementStatus: "aspirational" | "enforced"
ProtocolStatus:    "draft" | "active" | "deprecated"
ProcedureType:     "standard" | "onboarding" | "safety" | "maintenance" | "custom"

// Operations
SessionStatus:     "upcoming" | "active" | "pending_signoff" | "closed" | "missed"
TaskStatus:        "pending" | "available" | "in_progress" | "completed" | "skipped" | "overdue" | "escalated"
HookType:          "pre_open" | "open" | "scheduled" | "pre_close" | "close" | "custom"

// Time
SeasonType:        "default" | "calendar" | "focus" | "cycle" | "custom"
SeasonStatus:      "draft" | "active" | "archived"
DayCategory:       "morning" | "midday" | "afternoon" | "evening" | "night" | "weekend"

// Other
InviteStatus:      "pending" | "accepted" | "expired" | "cancelled"
TriggerType:       "scheduled" | "event"
```

---

## Important Domain Concepts

### Department Session

Daily operational container per department. Auto-generated from Department Schedule. Contains all tasks, notes, and handoffs. Lifecycle: `upcoming -> active -> pending_signoff -> closed | missed`.

### Session Hooks

Time-based triggers on department sessions. Fire Procedures and Routines as session_tasks at specific moments (pre_open, open, scheduled, pre_close, close).

### Governance = Readiness

Employee is "ready" when all assigned Protocols are completed. Readiness score = % of assigned protocols completed.

### Trainee Mode

Sandbox — real UI, no live data impact. 48-hour escalation if not progressing.

### Season

Time period wrapping all operations. Like a gamification campaign. Own leaderboard, point rules, team configs.

---

## Stale Documentation Protocol

This CLAUDE.md is the source of truth for codebase facts. Module docs in `docs/modules/` describe **intended behavior** and may be ahead of implementation.

### When Reading Docs

1. Check this file first for verified ground truth
2. If a module doc contradicts this file, this file wins for structural facts
3. Module docs win for business logic and domain rules

### When Code Changes

If you change something that contradicts this file:
1. Update this file immediately
2. Note what changed and why

### Known Discrepancies

| Doc Says | Reality | Status |
|----------|---------|--------|
| `MODULE_13` references `stripe_subscription` table | Subscription data on `company` table | Doc needs update |
| Dashboard layout uses hardcoded zinc colors | Should use CSS variables | Refactor when touching |
| Root `package.json` has `tailwindcss: ^3.4.13` | Apps use Tailwind v4 — root dep is for Remotion only | Intentional |

---

## What NOT To Do

- Never use JavaScript. TypeScript only.
- Never use Pages Router. App Router only.
- Never bypass RLS with service role for user-facing operations.
- Never create workspace-scoped tables without `workspace_id`.
- Never create tables without `created_at` and `updated_at`.
- Never hardcode Norwegian text in components — use i18n keys (Norwegian is primary language).
- Never skip input validation on Edge Functions.
- Never store secrets in code — use environment variables or `op://` references.
- Never reference `public.user` — the table is `public.user_identity`.
- Never create a new enum without checking `database.types.ts` for name conflicts.
- Never edit `packages/supabase/src/database.types.ts` manually — always regenerate.
- Never use hardcoded color values (zinc-800, etc.) — use CSS variable classes (bg-background, text-foreground).
- Never use `any` — use `unknown` + type guards.
- Never commit `.env.local` or raw secret values.

---

## Dev Commands

```bash
# Start local Supabase
npx supabase start

# Get local credentials
npx supabase status

# Run dashboard dev server (port 3050)
pnpm --filter web dev

# Run landing page dev server (port 3055)
pnpm --filter landing dev

# Run all dev servers (requires 1Password CLI)
pnpm dev

# Run without 1Password
pnpm dev:local

# Regenerate database types after migration
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts

# Add shadcn component (from apps/web/)
cd apps/web && npx shadcn@latest add <component>

# Run E2E tests
pnpm --filter e2e test:e2e

# Lint all packages
pnpm lint

# Format code
pnpm format

# Build all
pnpm build
```

---

## Changelog

| Date | Version | Change | Author |
|------|---------|--------|--------|
| 2026-01-01 | 1.0.0 | Initial version (as GEMINI_CONTEXT.md) | Pontus |
| 2026-02-27 | 2.0.0 | Complete rewrite: verified against actual codebase. Fixed table names (user_identity), removed phantom stripe_subscription, added Tailwind v4 details, env validation, package exports, migration patterns, seed data, stale doc protocol, performance rules, dev commands, third-party integrations | Claude |
