# CLAUDE.md — Smartout v3

> Ground truth for this repository. Verified against actual code, migrations, and configs.
> Last verified: 2026-02-28. If something contradicts this file, the CODE is right — update this doc.

---

## Project Identity

**Smartout** is an Employee Readiness System for shift-based businesses in Norway (restaurants, hotels, cafes, bars).

**Core problem:** ~75% annual turnover in the Norwegian service industry. Smartout makes employees _ready_ — trained, compliant, equipped, and informed before their first shift.

**Context:** This is a rebuild from Bubble.io. The system is already operational with live Stripe billing and DocuSign contracts. We are rebuilding on a modern stack — not prototyping.

**"Ready" means:** All assigned Policies learned, all Protocols completed — knowledge tested, procedures trained, confirmations signed.

---

## Source of Truth

1. **Code + database schema** → implementation always wins
2. **This file** → conventions, rules, verified facts
3. **docs/reference/** → detailed lookup during coding (DATABASE, ROUTES, PACKAGES, ENV_VARS)
4. **docs/modules/** → business logic per module
5. **docs/architecture/** → system design decisions
6. **docs/cross-cutting/** → concerns spanning modules (GDPR, billing, security, i18n)

> Full navigation map with all document IDs: `docs/INDEX.md`
> All docs have YAML frontmatter for machine-readable discovery.

---

## Tech Stack (Verified)

| Layer          | Technology                             | Version        | Notes                                          |
| -------------- | -------------------------------------- | -------------- | ---------------------------------------------- |
| Web Dashboard  | Next.js (App Router)                   | 16.1.6         | React 19.2.3, TypeScript                       |
| Styling        | Tailwind CSS                           | v4             | CSS-based config, OKLCH colors                 |
| UI Components  | shadcn/ui                              | new-york style | lucide icons, CSS variables                    |
| Backend        | Supabase                               | PostgreSQL 17  | Auth, Storage, Realtime, Edge Functions (Deno) |
| Telemetry      | PostHog                                | EU instance    | Browser + Node SDK, proxy rewrites             |
| Env Validation | @t3-oss/env-nextjs                     | —              | Zod schema in `apps/web/src/env.ts`            |
| Voice          | Ultravox                               | —              | Voice assistant in dashboard                   |
| Video          | Remotion                               | v4             | Root devDep, Three.js + Lottie                 |
| Automation     | n8n + Edge Functions                   | —              | n8n for complex workflows                      |
| Hosting        | Vercel (web + landing), Supabase Cloud | —              | DigitalOcean (n8n). See ADR-0020.              |
| Language       | TypeScript                             | ^5.0           | Everywhere. No exceptions.                     |
| Monorepo       | pnpm 9.15.9 + Turborepo                | —              | `op run` for 1Password secret injection        |
| Fonts          | Geist + Geist Mono                     | —              | Google Fonts via next/font                     |
| Testing        | Playwright                             | —              | E2E in `apps/e2e`                              |
| Contracts      | DocuSeal Cloud + Fastify microservice  | —              | `services/contract-service/` (ADR-0024)        |
| Rich Text      | Tiptap (ProseMirror)                   | v3.20          | Contract template editor                       |
| Agents         | Pydantic                               | —              | Python agents in `agents/`                     |

### Third-Party Integrations (Live)

| Service       | Purpose                             | Status                       |
| ------------- | ----------------------------------- | ---------------------------- |
| Stripe        | Billing, subscriptions              | Live (rebuild in progress)   |
| DocuSign      | Employment contracts, confirmations | Live (rebuild in progress)   |
| SendGrid      | Transactional email                 | Configured                   |
| Twilio        | SMS notifications                   | Configured                   |
| PostHog       | Product analytics                   | Live (EU instance)           |
| Sentry        | Error tracking                      | Configured (production only) |
| Upstash Redis | Rate limiting                       | Configured                   |
| DocuSeal      | B2B + employment contract e-signing | Live (contract microservice) |

---

## Monorepo Structure (Verified)

```
smartout_v3/
├── apps/
│   ├── web/              → Next.js dashboard (port 3050)
│   ├── landing/          → Next.js landing page (port 3055)
│   └── e2e/              → Playwright E2E tests
├── packages/
│   ├── ai/               → AI SDK agents, tools, adapters (@smartout/ai)
│   ├── design-tokens/    → OKLCH color tokens, CSS + TS exports (@smartout/design-tokens)
│   ├── eslint-config/    → Shared ESLint flat config (@smartout/eslint-config)
│   ├── notifications/    → Email + SMS sending via SendGrid/Twilio (@smartout/notifications)
│   ├── types/            → Zod schemas, builds to dist/ (@smartout/types)
│   ├── supabase/         → SSR client + database.types.ts (@smartout/supabase)
│   ├── telemetry/        → PostHog + Supabase telemetry (@smartout/telemetry)
│   ├── typescript-config/ → Shared TS configs (@smartout/typescript-config)
│   ├── ui/               → Shared UI components (@smartout/ui)
│   └── utils/            → Shared utilities (@smartout/utils)
├── supabase/
│   ├── migrations/       → 23 migrations (00001-00013 + timestamps)
│   ├── functions/        → 12 Edge Functions
│   ├── seed.sql          → Dev seed data
│   └── config.toml       → Local dev config
├── services/
│   ├── contract-service/ → Fastify contract microservice (port 3100, ADR-0024)
│   └── scrapling/        → Python FastAPI scraper (port 8000, own venv)
├── agents/               → Pydantic AI agents (Python)
├── docs/
│   ├── architecture/     → System architecture docs
│   ├── cross-cutting/    → Billing, i18n, GDPR, security
│   ├── archive/          → Superseded docs (never loaded actively)
│   ├── decisions/        → ADRs (25 accepted)
│   ├── learnings/        → Learning records
│   ├── modules/          → Module specs (17 modules)
│   ├── plans/            → Implementation plans (completed/ for done)
│   ├── reference/        → Quick-lookup: DATABASE, ROUTES, PACKAGES, ENV_VARS
│   ├── research/         → Research reports
│   ├── roadmaps/         → Project roadmaps
│   ├── "User Manual"/    → Norwegian user-facing docs (future Nextra content)
│   └── INDEX.md          → Master navigation map (all doc IDs + status)
├── apps/
│   └── docs/             → Nextra public docs site (docs.smartout.ai, port 3060)
└── CLAUDE.md             → This file
```

### Package Exports (Verified)

**@smartout/supabase** — `packages/supabase/package.json`:

```
"."           → ./src/index.ts      (barrel: types + all clients)
"./middleware" → ./src/middleware.ts  (updateSession for Next.js middleware)
"./client"    → ./src/client.ts     (createBrowserClient)
"./server"    → ./src/server.ts     (createServerClient with cookies)
"./admin"     → ./src/admin.ts      (createAdminClient — service role, platform-admin only)
```

**@smartout/types** — `packages/types/src/index.ts`:

```
exports: enums, identity, structure, governance, time
```

All types use Zod schemas with `z.infer<>` for TypeScript inference.

**@smartout/design-tokens** — `packages/design-tokens/package.json`:

```
"."           → ./src/index.ts      (OKLCH token constants)
"./tokens.css" → ./src/tokens.css   (CSS variables for all tokens)
"./native"    → ./src/native.ts     (hex conversions for React Native)
```

Single source of truth for all colors, spacing, radii, shadows.

**@smartout/eslint-config** — `packages/eslint-config/package.json`:

```
"./base"  → ./base.mjs   (TypeScript rules)
"./react" → ./react.mjs  (extends base + React rules)
"./next"  → ./next.mjs   (extends react + Next.js rules)
```

**@smartout/typescript-config** — `packages/typescript-config/package.json`:

```
"./base.json"          → base config (ES2022, strict, bundler)
"./nextjs.json"        → Next.js apps (extends base + DOM + JSX)
"./react-library.json" → React libraries (extends base + DOM + JSX)
"./library.json"       → Pure TS libraries (extends base)
```

**@smartout/ui** — Exports button, badge, card, dialog, input, label, separator, skeleton, status-badge, and cn() utility. All use design tokens via CSS variables.

**@smartout/ai** — `packages/ai/package.json` (pre-built via `tsc` → `dist/`):

```
"."                    → ./dist/index.js              (types + defineTool)
"./session-context"    → ./dist/session-context.js    (session context)
"./tools/onboarding"   → ./dist/tools/onboarding.js   (onboarding tools)
"./schemas/onboarding" → ./dist/schemas/onboarding.js  (onboarding Zod schemas)
"./agents/onboarding"  → ./dist/agents/onboarding.js   (onboarding agent)
"./agents/docs"        → ./dist/agents/docs.js         (docs agent)
"./adapters/vercel-ai" → ./dist/adapters/vercel-ai.js  (Vercel AI SDK adapter)
"./adapters/livekit"   → ./dist/adapters/livekit.js    (LiveKit voice adapter)
"./missions"           → ./dist/missions/index.js      (mission registry + Ultravox)
```

Dependencies: Vercel AI SDK (`ai`), OpenRouter provider, Supabase client, Zod.

**@smartout/telemetry** — `packages/telemetry/package.json`:

```
"."       → ./src/index.ts   (server-safe: event registry, emit(), routing)
"./react" → ./src/react.ts   (client-only: useTrack() hook — requires React)
```

Root export is server-safe (no React). API routes and server code import from `@smartout/telemetry`. Client components that need the `useTrack` hook import from `@smartout/telemetry/react`.

**@smartout/notifications** — `packages/notifications/package.json`:

```
"."            → ./src/index.ts       (sendEmail, createBroadcastJob, getJobStatus)
"./templates"  → ./src/templates.ts   (email template registry)
"./audiences"  → ./src/audiences.ts   (audience filter types + resolvers)
"./compliance" → ./src/compliance.ts  (suppression list, classification)
```

Dependencies: SendGrid (`@sendgrid/mail`), Twilio, Supabase, Zod. See ADR-0022.

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

| Entity         | Table Name       | Scope                    |
| -------------- | ---------------- | ------------------------ |
| User           | `user_identity`  | Global (no workspace_id) |
| Company        | `company`        | Global (no workspace_id) |
| Company Member | `company_member` | Global (no workspace_id) |
| Workspace      | `workspace`      | Has company_id           |
| Profile        | `profile`        | workspace_id scoped      |
| Department     | `department`     | workspace_id scoped      |
| Location       | `location`       | workspace_id scoped      |
| Team           | `team`           | workspace_id scoped      |
| Policy         | `policy`         | workspace_id scoped      |
| Protocol       | `protocol`       | workspace_id scoped      |
| Season         | `season`         | workspace_id scoped      |

### Platform Admin Tables (6 tables — no RLS, service role only)

| Table                        | Purpose                                    |
| ---------------------------- | ------------------------------------------ |
| `landing_config`             | Landing page CMS configs (JSON, versioned) |
| `landing_config_version`     | Version snapshots of published configs     |
| `platform_audit_log`         | Super-admin action audit trail             |
| `platform_impersonation_log` | Workspace impersonation session tracking   |
| `platform_metrics_daily`     | Daily aggregated KPI metrics               |
| `pricing_terms`              | Workspace pricing terms (ADR-0027)         |

Note: `user_identity.is_super_admin` (boolean, default false) gates access to all platform-admin functionality.

### Contract System Tables (6 tables — ADR-0024)

| Table               | Purpose                                     | Scope                  |
| ------------------- | ------------------------------------------- | ---------------------- |
| `contract_template` | Reusable contract templates with HTML + CSS | workspace_id scoped    |
| `contract`          | Sent contract instances with signing state  | workspace_id scoped    |
| `contract_event`    | Immutable audit trail per contract          | via contract.workspace |
| `contract_reminder` | Scheduled email/SMS reminders               | workspace_id scoped    |
| `message_template`  | Email/SMS template content (NO + EN)        | System (no RLS)        |
| `clause_library`    | Reusable legal clause snippets              | Global (authenticated) |

Note: `contract` and `contract_template` were renamed from `platform_contract_instance` and `platform_contract_template` (migration `20260228140000`). The workspace table also gained `contract_status`, `trial_started_at`, `trial_ends_at`, `active_contract_id`, and override columns.

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

- Sequential: `00001_description.sql` through `00013_description.sql`
- Timestamped: `YYYYMMDDHHMMSS_description.sql` (newer migrations)
- Regenerate types after migration: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

### Seed Data

Dev seed creates: Company (Smartout AS) → Workspace (HQ) → Location → Department → User (admin@smartout.local / password123) → CompanyMember → Profile.

Known UUIDs: `a0000000-...` (company), `b0000000-...` (workspace), `e0000000-...` (user).

### Edge Functions (12)

activate-workspace, analyze-workspace, contract-lifecycle, create-invitation, extract-workspace-data, finalize-workspace, gather-workspace-intelligence, health-check, scrape-raw-data, watchdog-integrity, watchdog-uptime, web-search-intelligence.

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
- Installed components (web): badge, button, card, dropdown-menu, input, select, separator, sheet, table, tabs, tooltip
- Add new components: `npx shadcn@latest add <component>` (from `apps/web/`)

### Dashboard Layout

**Split architecture (ADR-0021):**

- `apps/web/src/app/dashboard/layout.tsx` — **Server Component**. Reads `x-workspace-slug` header, queries workspace by slug, verifies user profile, wraps in `WorkspaceProvider` + `DashboardShell`.
- `apps/web/src/components/dashboard/DashboardShell.tsx` — **Client Component**. Contains all UI: sidebar, nav, context bar, admin/employee toggle. Gets workspace data via `useWorkspaceOptional()`.

**Key patterns:**

- `DashboardContext` providing: isAdminMode, isDark, adminView, scheduleLayout, scheduleView, activeLocation, workspaceData
- `WorkspaceProvider` + `useWorkspace()` for workspace context (from `@/lib/workspace-context`)
- Subdomain routing: `{slug}.smartout.ai` → middleware sets `x-workspace-slug` header → layout reads it
- Portal: `app.smartout.ai` → workspace selector at `/select-workspace`
- Dev fallback: `localhost:3050` works without subdomains (uses first profile's workspace)

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
/select-workspace          → Workspace selector (portal: app.smartout.ai)
/access-denied             → Access denied (invalid workspace or no profile)

Platform Admin (super-admin only):
/platform-admin            → Dashboard KPIs + metrics
/platform-admin/workspaces → Workspace list + management
/platform-admin/workspaces/new → Create workspace form (pricing, contract, subscription)
/platform-admin/workspaces/[id] → Workspace detail + actions
/platform-admin/users      → User administration
/platform-admin/billing    → Billing overview + Stripe sync
/platform-admin/content    → Landing page content CMS
/platform-admin/contracts  → Contract list + management (TanStack Table)
/platform-admin/contracts/new → Contract creation form
/platform-admin/contracts/[id] → Contract detail + actions
/platform-admin/contracts/templates → Template list
/platform-admin/contracts/templates/[id]/edit → Tiptap template editor + AI
/platform-admin/audit      → Platform audit log viewer
/platform-admin/health     → System health + edge function status

Signing (public, no auth):
/sign/[token]              → Embedded DocuSeal signing page
/sign/success              → Post-signing success
/sign/declined             → Post-decline page

API Routes:
/api/health                → Service health check (GET)
/api/telemetry             → Telemetry beacon (POST)
/api/onboarding-agent      → Onboarding AI agent (POST)
/api/contract-agent        → AI contract assistant (POST)
/api/platform-admin/...    → Platform admin CRUD endpoints (service role)
/api/platform-admin/workspaces → Create workspace + dropdown data (GET/POST)
/api/platform-admin/contracts → Contract proxy to microservice (GET/POST)
/api/platform-admin/contracts/[id]/send → Send contract for signing (POST)
/api/platform-admin/contracts/[id]/cancel → Cancel contract (POST)
/api/platform-admin/contracts/[id]/remind → Send reminder (POST)
/api/webhooks/docuseal     → DocuSeal contract webhook (POST)
```

### Landing Page Routes (apps/landing)

```
/                          → Homepage (workspace analyzer, features, CTAs)
/pricing                   → Pricing page
/om-oss                    → About us
/blog                      → Blog
/login                     → Login redirect
/signup                    → Signup redirect
/waitlist                  → Waitlist signup
/personvern                → Privacy policy (GDPR)
/vilkar                    → Terms of service

Feature Pages:
/features/shiftplanner             → Shift planning showcase
/features/punchclock-timetracking  → Time tracking + shift detail view
/features/staff-training           → Staff training showcase
/features/task-rutines             → Tasks & routines showcase
/features/haccp-complience         → HACCP compliance showcase
/features/communications           → Communication tools showcase

Concept Pages:
/concepts/seasons          → Season management concept
/concepts/lokations        → Location management concept
/concepts/procedures       → Procedure management concept
/concepts/daily-session    → Daily session concept

Documentation:
/docs                      → Docs index with sidebar
/docs/kom-i-gang           → Getting started
/docs/onboarding           → Onboarding docs
/docs/ansatte              → Employee management docs
/docs/vaktplan             → Shift planning docs
/docs/oppgaver-rutiner     → Tasks & routines docs
/docs/haccp                → HACCP docs
/docs/kommunikasjon        → Communication docs
/docs/rapporter            → Reports docs
/docs/ai-assistent         → AI assistant docs
/docs/innstillinger        → Settings docs
/docs/api                  → API docs
/docs/[slug]               → Dynamic doc page
```

### Landing Page Components

| Component         | File                                | Type   | Purpose                                     |
| ----------------- | ----------------------------------- | ------ | ------------------------------------------- |
| Navigation        | `components/navigation.tsx`         | Client | Top nav with mobile menu                    |
| Footer            | `components/footer.tsx`             | Server | Footer with legal links                     |
| WorkspaceAnalyzer | `components/workspace-analyzer.tsx` | Client | URL input → animated analysis → mock scores |
| VoiceAssistant    | `components/voice-assistant.tsx`    | Client | Voice assistant demo                        |
| NextPageBanner    | `components/next-page-banner.tsx`   | Client | Cross-page navigation banner                |

---

## Environment Variables

### Validation

Env vars are validated at build/start using `@t3-oss/env-nextjs` + Zod in `apps/web/src/env.ts`.

| Variable                        | Context | Required | Notes                                                                          |
| ------------------------------- | ------- | -------- | ------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | Client  | Yes      | Local: `http://127.0.0.1:54331`                                                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client  | Yes      | From `npx supabase status`                                                     |
| `NEXT_PUBLIC_POSTHOG_KEY`       | Client  | No       | PostHog project API key                                                        |
| `NEXT_PUBLIC_POSTHOG_HOST`      | Client  | No       | Default: `https://eu.i.posthog.com`                                            |
| `NEXT_PUBLIC_ROOT_DOMAIN`       | Client  | No       | Default: `localhost`. Set to `smartout.ai` in production for subdomain routing |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server  | No       | For admin operations only                                                      |
| `STRIPE_SECRET_KEY`             | Server  | No       | Must start with `sk_`                                                          |
| `STRIPE_WEBHOOK_SECRET`         | Server  | No       | Must start with `whsec_`                                                       |
| `SENDGRID_API_KEY`              | Server  | No       | Must start with `SG.`                                                          |
| `TWILIO_ACCOUNT_SID`            | Server  | No       | Twilio account                                                                 |
| `TWILIO_AUTH_TOKEN`             | Server  | No       | Twilio auth                                                                    |
| `JWT_SECRET`                    | Server  | No       | Min 32 chars                                                                   |
| `SESSION_SECRET`                | Server  | No       | Min 32 chars                                                                   |
| `UPSTASH_REDIS_REST_URL`        | Server  | No       | Rate limiting (production)                                                     |
| `UPSTASH_REDIS_REST_TOKEN`      | Server  | No       | Rate limiting (production)                                                     |
| `SENTRY_DSN`                    | Server  | No       | Sentry error tracking                                                          |
| `DOCUSEAL_WEBHOOK_SECRET`       | Server  | No       | DocuSeal webhook signature secret                                              |
| `CONTRACT_SERVICE_URL`          | Server  | No       | Contract microservice URL                                                      |
| `CONTRACT_SERVICE_KEY`          | Server  | No       | Contract microservice API key (min 16 chars)                                   |
| `NEXT_PUBLIC_SENTRY_DSN`        | Client  | No       | Sentry client-side tracking                                                    |

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

### Performance and Build Governance System (ADR-0019)

- Canonical architecture doc: `docs/architecture/PERFORMANCE_BUILD_GOVERNANCE.md`
- Governance policy: `docs/cross-cutting/performance-governance.md`
- PR checklist: `docs/cross-cutting/performance-checklist.md`
- Route budgets:
  - `apps/web/perf-budgets.json`
  - `apps/landing/perf-budgets.json`
- CI enforcement model:
  - Pull Requests -> warn mode (`PERF_ENFORCEMENT=warn`)
  - Push to integration branch -> fail mode (`PERF_ENFORCEMENT=fail`)
- Required commands before claiming performance-safe changes:
  - `pnpm build:health`
  - `pnpm perf:audit:web`
  - `pnpm perf:audit:landing`

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

## Modules

> **Load** relevant `docs/modules/MODULE_*.md` BEFORE implementing any module feature.
> Full list with IDs, status, and dependencies: `docs/INDEX.md`
> 17 modules total (1-15, 17-18). Each has YAML frontmatter with `depends_on` chain.

### Architecture Decisions (ADRs)

All accepted decisions in `docs/decisions/`. **Read before making changes in the same area.**

| ADR  | Subject                                                               | Area           |
| ---- | --------------------------------------------------------------------- | -------------- |
| 0001 | Turborepo + pnpm workspaces                                           | Monorepo       |
| 0002 | State-driven vs hook-driven logic boundaries                          | React          |
| 0003 | shadcn/ui integration (new-york, CSS variables)                       | UI             |
| 0004 | Unified telemetry engine (PostHog)                                    | Telemetry      |
| 0005 | Testing infrastructure — four-layer strategy                          | Testing        |
| 0006 | Environment variables, secrets & module boundaries                    | Secrets        |
| 0007 | Dashboard layout & navigation state                                   | UI             |
| 0008 | Dashboard scroll behavior                                             | UI             |
| 0009 | Tailwind CSS v4 with CSS-based configuration                          | Styling        |
| 0010 | AI SDK with OpenRouter provider                                       | AI             |
| 0011 | User table named `user_identity`                                      | Database       |
| 0012 | Subscription data on company table                                    | Database       |
| 0013 | Auto-generated database types workflow                                | Database       |
| 0014 | PostHog EU instance with reverse proxy                                | Privacy        |
| 0015 | Bubble.io rebuild strategy                                            | Strategy       |
| 0016 | Services directory for backend microservices                          | Monorepo       |
| 0017 | Enterprise Infrastructure — Shared Configs, Design System, Monitoring | Infrastructure |
| 0018 | TanStack Table and Recharts for Platform Admin                        | UI / Deps      |
| 0019 | Performance and Build Governance System                               | Performance    |
| 0020 | Vercel Hosting with Dual-Project Split                                | Hosting        |
| 0021 | Subdomain-Based Workspace Routing                                     | Routing        |
| 0022 | Email/Notification Service Architecture                               | Notifications  |
| 0023 | Global Scrollbar Standard via Design Tokens                           | UI             |
| 0024 | Contract System Architecture                                          | Contracts      |
| 0025 | Documentation Restructuring — Layered System with YAML Frontmatter    | Documentation  |
| 0026 | Template Editor Redesign with PDF Attachments                         | Contracts      |
| 0027 | Pricing Terms Table for Workspace Commercial Model                    | Pricing        |

### ADR Enforcement (MANDATORY)

**When to create an ADR:**

An ADR is REQUIRED when any of these are true:

- Adding a new package or external dependency to the monorepo
- Choosing between two or more valid technical approaches
- Changing database schema patterns (new table naming, new enum, RLS strategy)
- Adding or changing a third-party integration
- Modifying the build, test, or deploy pipeline
- Making a decision that future agents or developers need to know about

**How to create an ADR:**

1. Find the next available number in `docs/decisions/0000-decision-log.md`
2. Create `docs/decisions/NNNN-short-description.md` using `docs/decisions/template.md`
3. Add the entry to `0000-decision-log.md`
4. Update the ADR table in this CLAUDE.md file

**Do NOT skip ADRs.** Undocumented decisions cause bugs when agents assume different defaults.

---

## Enums

> **Load** `docs/reference/DATABASE.md` for the full enum reference (30 DB enums + TypeScript enums).
> All enums defined as Zod schemas in `packages/types/src/enums.ts`. Use `z.infer<typeof Schema>` for types.
> Before creating a new enum, check `packages/supabase/src/database.types.ts` for name conflicts.

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

## Documentation Protocol

This CLAUDE.md is the source of truth for codebase facts. See **Source of Truth** section above for the full hierarchy.

### Finding Documentation

1. Check `docs/INDEX.md` for the master map of all documents with IDs and status
2. Every doc has YAML frontmatter — read the `id`, `status`, `depends_on`, and `Summary` to assess relevance
3. Use `layer` field to know the doc's purpose: `reference` (lookup), `module` (business logic), `architecture` (design)

### When Reading Docs

1. Check this file first for verified ground truth
2. If a module doc contradicts this file, this file wins for structural facts
3. Module docs win for business logic and domain rules
4. Never load `docs/archive/` files — they are superseded

### When Code Changes

If you change something that contradicts this file:

1. Update this file immediately
2. Note what changed and why

### Known Discrepancies

| Doc Says                                           | Reality                                              | Status                 |
| -------------------------------------------------- | ---------------------------------------------------- | ---------------------- |
| `MODULE_13` references `stripe_subscription` table | Subscription data on `company` table                 | Doc needs update       |
| Dashboard layout uses hardcoded zinc colors        | Should use CSS variables                             | Refactor when touching |
| Root `package.json` has `tailwindcss: ^3.4.13`     | Apps use Tailwind v4 — root dep is for Remotion only | Intentional            |

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

# Run docs site dev server (port 3060)
pnpm --filter docs dev

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

# Type check all packages
pnpm typecheck

# Format code
pnpm format

# Check format without writing
pnpm format:check

# Run all checks (lint + typecheck + format)
pnpm check

# Build all
pnpm build

# Clean all build artifacts
pnpm clean
```

---

## Changelog

| Date       | Version | Change                                                                                                                                                                                                                                                                                                                   | Author |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| 2026-01-01 | 1.0.0   | Initial version (as GEMINI_CONTEXT.md)                                                                                                                                                                                                                                                                                   | Pontus |
| 2026-02-27 | 2.0.0   | Complete rewrite: verified against actual codebase. Fixed table names (user_identity), removed phantom stripe_subscription, added Tailwind v4 details, env validation, package exports, migration patterns, seed data, stale doc protocol, performance rules, dev commands, third-party integrations                     | Claude |
| 2026-02-27 | 2.1.0   | Added Linear repo scope section — maps which Linear projects belong to this repo vs. other repos                                                                                                                                                                                                                         | Claude |
| 2026-02-27 | 3.0.0   | Enterprise infrastructure: Added new packages (typescript-config, eslint-config, design-tokens, utils), new Edge Functions (health-check, watchdog-integrity, watchdog-uptime), new API routes (/api/health, /api/telemetry), Sentry + Upstash integrations, updated dev commands, ADR-0017                              | Claude |
| 2026-02-28 | 4.0.0   | Platform Admin Backoffice: Added 5 platform-admin tables (migration 00013), 9 platform-admin routes, DocuSeal webhook, ./admin export, DOCUSEAL_WEBHOOK_SECRET env var, ADR-0018, services/ directory, docs/learnings/ system, moved scrapling to services/                                                              | Claude |
| 2026-02-28 | 4.1.0   | Performance and Build Governance documentation sweep: added architecture doc (`PERFORMANCE_BUILD_GOVERNANCE.md`), expanded ADR-0019 with rollout learnings, added Learning-0007, updated roadmap references and CLAUDE governance section                                                                                | Claude |
| 2026-02-28 | 4.2.0   | Vercel deployment: Updated ADR-0020 with verified build settings (Root Dir = app dir, not `.`), pnpm 9.15.9, 17 migrations to production Supabase. Added Learnings 0008-0010 (x-forwarded-host, .vercelignore depth, Turborepo Root Directory). Fixed security middleware blocking all production requests.              | Claude |
| 2026-02-28 | 5.0.0   | Contract system: Added contract-service microservice (Fastify, port 3100), 6 contract tables, contract-lifecycle Edge Function, Tiptap editor, 20 AI contract tools, signing pages, @smartout/notifications package. Registered ADR-0021 through ADR-0024. Updated monorepo structure, routes, env vars, edge functions. | Claude |
| 2026-02-28 | 5.1.0   | Landing page: Added full landing route map (features, concepts, docs, legal pages), landing component table (WorkspaceAnalyzer, VoiceAssistant, Navigation, Footer, NextPageBanner). Added Learning-0011 (Framer Motion animation patterns).                                                                             | Claude |
| 2026-02-28 | 6.0.0   | Docs restructuring: Added Source of Truth hierarchy, docs/INDEX.md, 4 reference files (DATABASE, ROUTES, PACKAGES, ENV_VARS), YAML frontmatter on all docs, docs/archive/, Nextra scaffold at apps/docs/. Removed Key Enums section (→ DATABASE.md) and Module table (→ INDEX.md). ADR-0025.                             | Claude |
| 2026-02-28 | 6.1.0   | Create Workspace: Added `pricing_terms` table (migration 20260228220000), workspace creation API route, new workspace form page with pricing/contract/subscription cards. ADR-0027. Updated platform admin tables count, routes.                                                                                         | Claude |
