# CLAUDE.md — Smartout v3

> Ground truth. Verified against code. If code contradicts this file, CODE wins — update this doc.

---

## Project Identity

**Smartout** — Employee Readiness System for shift-based businesses in Norway.
Rebuild from Bubble.io. Live Stripe billing + DocuSign contracts. Modern stack, not a prototype.
**"Ready"** = all Policies learned, all Protocols completed.

---

## Source of Truth

1. **Code + database schema** → always wins
2. **This file** → conventions, rules, critical traps
   2.5. **docs/STATE.md** → current system state, gaps, weekly plan (updated weekly)
3. **docs/reference/** → DATABASE, ROUTES, PACKAGES, ENV_VARS
4. **docs/engines/** → Event Motor domain packaging (industry, niche, role capability, environment, handbook)
5. **docs/modules/** → business logic (23 module docs)
6. **docs/architecture/** → system design decisions
7. **docs/cross-cutting/** → GDPR, billing, security, i18n

> Master map: `docs/INDEX.md` | All docs have YAML frontmatter.

---

## Tech Stack

Next.js 16 (App Router) + React 19 + TypeScript (strict) | Tailwind v4 (CSS config, no config file) | shadcn/ui (new-york) | Supabase (PostgreSQL 17, Auth, Storage, Edge Functions) | Vercel (web + landing) | PostHog EU | pnpm 9.15 + Turborepo | Playwright E2E

Integrations: Stripe (API-only via Edge Functions), DocuSeal (contracts), SendGrid (API-only via Edge Functions/webhooks), Twilio (API-only), Sentry, Upstash Redis, Ultravox (voice), Remotion (video)

> Full details: `docs/reference/PACKAGES.md`

---

## Monorepo Structure

```
smartout_v3/
├── apps/web/          → Dashboard (port 3060)
│   ├── onboarding/     → Wizard: 10 sections + 14 UI components + WizardContext + 3 hooks (useOnboardingState, useScrollProgress, useBotsson)
├── apps/landing/      → Landing page (port 3055)
├── apps/e2e/          → Playwright tests
├── packages/          → agent-sdk, ai (+ adapters/, agents/, capabilities/, context/, engine/, generators/,
│                        journey/, missions/, prompts/, router/, schemas/, tools/), design-tokens, docs-pipeline,
│                        eslint-config, i18n, notifications, supabase, telemetry, types, typescript-config,
│                        ui, utils, walkAi, walkieTalkie
├── services/          → contract-service (Fastify, 5012), interview-mcp (anchor), scrapling (Python, 8000),
│                        shift-mcp (Hono, 5011), stage-engine (Hono, 5010)
├── infra/             → Unified Docker Compose + Caddy reverse proxy (ADR-0039)
├── supabase/          → migrations, 31 Edge Functions, seed.sql
└── docs/              → INDEX.md + reference/ modules/ architecture/ decisions/ learnings/
```

> Package exports: `docs/reference/PACKAGES.md`

---

## Database — Critical Traps

- Table is `user_identity`, NOT `user`. No `public.user` table exists.
- Subscription data on `company` table. No `stripe_subscription` table.
- `contract_status` enum already taken by `employment_contract`. Don't reuse.
- 72 enums — check `database.types.ts` before creating new ones.
- `database.types.ts` is auto-generated. Never edit manually.
- After migration: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`
- RLS on EVERY workspace-scoped table. Platform-admin tables use service role only.
- `handle_new_user()` trigger creates `user_identity` on auth.users INSERT.
- `is_godmode` on `user_identity` gates all platform-admin access. (Renamed from `is_super_admin`)
- API key tables: `platform_api_key` (SHA-256 hashes), `platform_api_key_usage` (hourly buckets), `platform_external_secret` (Vault metadata). See ADR-0028.
- Enums: `api_key_version_status` (current/previous/revoked), `api_key_type` (workspace/service).
- Vault wrappers: `get_secret()`, `upsert_secret()`, `delete_vault_secret()` — SECURITY DEFINER, service_role only.
- Schedule table: `schedule_shift` (not `shift`). Enums: `shift_status`, `day_category`. See ADR-0036.
- Season planning tables: `season_budget` (1:1 with season), `day_factor` (weekday weights), `hour_factor` (hour weights). Enum: `budget_status` (draft/active/locked). DIFFERENT from `workspace_budget` (operational per-date targets).
- Workspace semantic table: `workspace_doc_chunk` (workspace-scoped pgvector). RPC `match_workspace_docs()` must always run with workspace context.
- `engine_memory` — Persistent agent memories with pgvector embeddings. RLS: workspace isolation.
- `engine_authority_config` — Per-workspace, per-capability authority levels. UNIQUE(workspace_id, capability).
- `engine_sessions.mode` — 'mission' (structured stages) or 'agent' (free-form conversation). Agent sessions have NULL mission_id.
- Completion tracking: `knowledge_test_attempt`, `confirmation_signature`, `procedure_step_completion` — all FK to `protocol_assignment_id` + `profile_id`.
- Session infrastructure: `session_hook` (hook_type enum), `session_task` (task_status enum), `session_note` (note_type enum). All FK to `department_session`.
- `engine_state_step` — per-step tracking on engine_state instances. RLS cascades via subquery on engine_state.
- Season table has `status` enum (draft/active/archived) — NOT `is_active` boolean.
- Timestamp triggers should use `set_updated_at()` (not `moddatetime`) for migration compatibility.

> Full schema, tables, enums, RLS patterns: `docs/reference/DATABASE.md`

## Database Migrations

ALDRI kjør ALTER TABLE direkte. ALLTID lag migrasjonsfil i `supabase/migrations/` først.

Workflow:

1. Lag SQL-fil: `supabase/migrations/YYYYMMDDHHMMSS_beskrivelse.sql`
2. Kjør via docker exec: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/<fil>.sql`

Ingen unntak.

---

## UI & Styling

- **Tailwind v4** — CSS-based config in `globals.css`. NO `tailwind.config.ts`.
- Root `package.json` has Tailwind v3 — that's for Remotion only.
- Use CSS variable classes: `bg-background`, `text-foreground`, `border-border`
- NEVER hardcoded values: `bg-zinc-950`, `text-zinc-100`
- **shadcn/ui** — new-york style, lucide icons, `apps/web/components.json`
- Add components: `cd apps/web && npx shadcn@latest add <component>`
- Dashboard: Server layout + Client DashboardShell (ADR-0021)
- Subdomain routing: `{slug}.smartout.ai` → middleware sets `x-workspace-slug`

> All routes: `docs/reference/ROUTES.md`

---

## Code Conventions

**TypeScript:** strict, `type` over `interface`, no `any`, named exports, Zod schemas with `z.infer<>`

**File naming:** Components `PascalCase.tsx` | Hooks `useName.ts` | Utils `camelCase.ts` | Migrations `YYYYMMDDHHMMSS_desc.sql` | Edge Functions `kebab-case/index.ts`

**Database:** `snake_case` singular tables | `{table}_id` PKs | `created_at`+`updated_at` on every table | `is_` prefix for booleans | UUIDs for all PKs | Profile status is ENUM not boolean

**Supabase:** RLS everywhere (except platform-admin) | `auth.uid()` in policies | Helpers: `get_workspace_ids_for_user()`, `is_admin_in_workspace()` | Edge Functions: Zod validation | User ops: anon key, admin ops: service role

**React/Next.js:** App Router only | Server Components default, `"use client"` as deep as possible | shadcn/ui for all UI | CSS variables for theming | `sonner` for toasts | Fonts: Geist + Geist Mono

**Telemetry:** Every mutation emits. `emit()` from `@smartout/telemetry` drives four destinations: PostHog (analytics), Logger (stdout), activity_trail (audit), engine_event (workflow automation). No mutation without emit. No second event system.

**Performance:** `Promise.all()` for independent async ops | Direct imports (no barrel re-exports in app code) | `next/dynamic` for heavy components | Suspense boundaries for streaming | `React.cache()` for request dedup

> Full performance governance: `docs/cross-cutting/performance-governance.md`

**Code Readability — Self-Documenting First:**

Priority order:

1. Make code speak for itself — descriptive variable/function names, extract logic into
   well-named functions, named constants over magic numbers. The code should read like
   plain English wherever possible.
2. Comment the WHY and the big picture — why this approach was chosen, how pieces
   connect across files, what the overall block is trying to achieve. A comment that
   gives context or explains the larger goal is always welcome.
3. Never comment WHAT code does when the code already says it clearly.

Good: `const isEligibleForTrial = !company.has_subscription && daysSinceCreation < 14;`
Bad: `const x = !c.sub && d < 14; // check if eligible for trial`

File headers: brief explanation of what the file does and why it exists.
Function comments: purpose + why it exists + return value — but only when the name alone
doesn't capture the full picture. If the function name says it all, skip the comment.
Inline comments: use for explaining context — edge cases, business rules, cross-file
relationships, "this looks wrong but it's intentional because...", or a sentence that
helps a reader understand the bigger picture without reading three other files.

Goal: a non-developer should be able to read the codebase and follow the logic.

**Commits:** Enforced by commitlint (`@commitlint/config-conventional`) + husky.

- Format: `type(scope): subject` — e.g. `feat(schedule): add shift swap workflow`
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`
- Header max 100 characters (type + scope + subject combined)
- Body lines max 100 characters each
- Scope: `kebab-case`
- Subject: never `Start-Case`, `PascalCase`, or `UPPER_CASE`
- Always end with: `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`

---

## Data Model

> Full details: `docs/reference/DATABASE.md`

**Identity:** user_identity → company → company_member → workspace → profile
**Structure:** department (permanent) | location | team (can be seasonal)
**Governance:** policy → protocol → {procedure, routine, runbook, control_list, knowledge_test, confirmation}
**Time:** season → season_budget → {day_factor, hour_factor} (wraps operations, gamification, revenue planning)

**Key rules:** All tables have `workspace_id` (except identity layer + platform-admin). Profile has no season connection. Position is per-shift, not per-person.

**Roles:** employee → manager → admin → owner
**Statuses:** trainee → active → inactive → offboarding
**Leader:** Team attribute (`team.leader_profile_id`), NOT a role.

---

## Domain Concepts

- **Department Session** — Daily container per dept. Lifecycle: upcoming → active → pending_signoff → closed | missed
- **Session Hooks** — Time triggers firing procedures/routines at pre_open, open, scheduled, pre_close, close
- **Readiness** — Employee "ready" when all assigned Protocols completed. Score = % completed.
- **Trainee Mode** — Status flag on profile (`profile_status = 'trainee'`). Timestamps: `trainee_started`, `trainee_completed`. Sandbox write restrictions and 48h escalation are planned but NOT yet implemented.
- **Season** — Time period wrapping operations. Own leaderboard and point rules.
- **Season Budget** — Strategic revenue target per season. 1:1 with season. Contains total target, labor %, avg hourly wage, base price per guest. Day/hour factors distribute targets across weekdays and hours. Calculation engine: `apps/web/src/lib/season-calculations.ts` (pure functions, no DB deps). UI: `/dashboard/season` with 4 tabs (overview, budget, day-factors, hour-factors).
- **Event Engine** — Universal workflow runtime. `engine_process` (blueprint) → `engine_state` (live instance) → `engine_state_step` (per-step tracking). ALL workflows run through this: onboarding, training, HACCP, daily close, session hooks. New workflow = new engine_process + action_type handlers. Never create separate workflow state tables. Note: `journey` / `journey_step` / `journey_event` tables are a **metadata registry** (ADR-0031, 68 journey definitions from Bubble migration) — not workflow state tracking. Action type handlers: `wait_for_event`, `assign_task`, `send_notification` (stub), `update_entity`, `create_deviation`, `validate_settlement`, `lock_checkout`, `schedule_control` (reserved), `start_process`, `upsert_session`. Dispatch: `supabase/functions/engine-dispatch/index.ts`.
- **Veikart → Reise → Protokoll** — Conceptual mapping (not yet implemented as routes/views). Veikart = engine_process (blueprint). Reise = engine_state (employee experience). Protokoll = engine_state (leader oversight). Norwegian terms are design vocabulary, not code constructs.
- **Telemetry Registry** — All valid events and their routing destinations defined in `packages/telemetry/src/registry.ts`. This is the single source of truth for what can be emitted and where it goes.

---

## Industry Engine Layer (Mandatory)

- Canonical path for the first industry package: `docs/engines/industri-inteligence/hospitalety/`
- This engine package is the central documentation for:
  - Event-layer specialization by industry
  - AI council and personas
  - Default policy baselines
  - Template families (structure/pipeline/journey)
  - Testing profiles
  - Relevance mapping
  - Company handbook template
  - Role capability profiles
  - Environment baseline
  - Niche specialization
- When implementing or modifying event-layer, onboarding, readiness, or journey/testing behavior, consult this engine package before making changes.

---

## Modules & ADRs

> 23 module docs (modules 1-15, 17-20, 4.5, plus MODULE*0_ROADMAP, MODULE_AGENT_SDK, MODULE_BOTSSON). Load `docs/modules/MODULE*\*.md`BEFORE implementing.
54 ADRs in`docs/decisions/`. Read before making changes in the same area.
Full lists: `docs/INDEX.md`

**ADR Enforcement:** Create an ADR when adding dependencies, choosing between approaches, changing schema patterns, adding integrations, or modifying build/deploy. Template: `docs/templates/decision.md`. Register in `0000-decision-log.md`.

---

## Security — Always Enforced

Three laws. No exceptions.

1. **Never plaintext secrets** in code, config, logs, or DB columns. Vault for external secrets, SHA-256 hash for issued keys.
2. **Never bypass RLS** for convenience. API key auth uses `set_config` + `SET LOCAL ROLE authenticated`. Service role is for Vault access and platform-admin only.
3. **Never commit secrets** to Git. Not in code, comments, migrations, or seed files.

### API Key System

| Tier   | What                                    | Storage                            | Key prefix                      |
| ------ | --------------------------------------- | ---------------------------------- | ------------------------------- |
| Tier 1 | Workspace API keys                      | SHA-256 hash in `platform_api_key` | `smo_sk_live_` / `smo_sk_test_` |
| Tier 2 | External secrets (Stripe, Twilio, etc.) | Supabase Vault (pgsodium)          | Provider-specific               |
| Tier 3 | Service-to-service keys                 | SHA-256 hash in `platform_api_key` | `smo_svc_live_`                 |

- Raw key shown **once** at creation. Only hash stored. Never invent new prefixes.
- Dual-auth Edge Functions: use `_shared/auth-middleware.ts` — never roll your own.
- Edge Functions with API keys need `verify_jwt = false` in `config.toml`.
- Vault access: `get_secret()`, `upsert_secret()`, `delete_secret()` — all `SECURITY DEFINER`, `service_role` only.
- Workspace isolation via `current_setting('app.workspace_id', true)::uuid` in RLS. Always transaction-local (`set_config(..., true)` + `BEGIN`/`COMMIT`).

### Environment Variables

- Validated with `@t3-oss/env-nextjs` + Zod in `apps/web/src/env.ts`
- All secrets managed via 1Password CLI. Never `.env.local`, never hardcoded.
- Run with: `op run --env-file=.env.template -- pnpm run dev`
- `.env.template` is the single source of truth for all variables.
- Use `op://` references for secrets, plain values for non-secrets.
- Service role key: server-side and Edge Functions only, never in client code.

> Env lifecycle protocol: `docs/protocols/ENV_PROTOCOL.md`
> Full variable list: `docs/reference/ENV_VARS.md`
> Full security protocol: `docs/protocols/SECURITY.md`

### API Gateway — Mandatory Checklists

These are not guidelines. They are rules. Violations break the API contract.

**The gateway pattern:** External consumers get one API key. That key is validated by Supabase Edge Functions. Services sit behind the gate — they don't hold or validate consumer keys. Supabase is the gate.

#### When creating a NEW workspace-scoped table

Every workspace-scoped table needs BOTH auth paths. No exceptions.

1. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
2. JWT policy: `USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())))`
3. API key policy: `CREATE POLICY "api_key_read_{table}" ... USING (workspace_id = get_api_workspace_id())`
4. If write access needed via API: add `api_key_write_{table}` policy too
5. If publicly exposed: add handler in `workspace-api/handlers/`, register route, add to API registry

Skip steps 3-5 only if the table is internal-only (platform-admin, audit logs).

#### When creating a NEW Edge Function

| Pattern   | When                                    | `verify_jwt`     | Auth                                                 |
| --------- | --------------------------------------- | ---------------- | ---------------------------------------------------- |
| JWT-only  | User-facing (onboarding, workspace ops) | `true` (default) | `supabase.auth.getUser()`                            |
| Dual-auth | Public API, data endpoints              | `false`          | `resolveAuth(req)` from `_shared/auth-middleware.ts` |
| Cron-only | Scheduled tasks (cleanup, watchdog)     | `false`          | `WATCHDOG_CRON_SECRET` bearer token                  |

- NEVER roll your own auth. Use `_shared/auth-middleware.ts` for dual-auth.
- Every `verify_jwt = false` function MUST be in `supabase/functions/config.toml`.
- Every data endpoint MUST call `requireScope()` before querying.

#### Canonical Scope List (source of truth)

| Scope               | Tables                                                                       | Status  |
| ------------------- | ---------------------------------------------------------------------------- | ------- |
| `profiles:read`     | profile, department, location, team, position                                | Active  |
| `organization:read` | workspace, department, location, team                                        | Active  |
| `schedules:read`    | schedule_shift, schedule_absence                                             | Active  |
| `schedules:write`   | schedule_shift                                                               | Active  |
| `operations:read`   | department_session, deviation                                                | Active  |
| `operations:write`  | department_session (future)                                                  | Planned |
| `reports:read`      | daily_reconciliation, shift_approval, workspace_kpi_target, workspace_budget | Active  |
| `guardian:read`     | guardian_signal, guardian_log                                                | Active  |
| `events:read`       | engine_event                                                                 | Active  |
| `suppliers:read`    | supplier, supplier_order                                                     | Active  |
| `waste:read`        | waste_log                                                                    | Active  |
| `equipment:read`    | asset, asset_maintenance, asset_downtime                                     | Active  |
| `training:read`     | protocol, protocol_assignment                                                | Active  |
| `contracts:read`    | employment_contract                                                          | Active  |
| `haccp:read`        | haccp_log (future)                                                           | Planned |
| `haccp:write`       | haccp_log (future)                                                           | Planned |

To add a new scope: (1) add to this table, (2) add handler in `workspace-api/handlers/`, (3) register route in `workspace-api/index.ts`, (4) add to API registry, (5) update preset bundles in `SMARTOUT_SECRET_API_INFRASTRUCTURE.md` §2.4.

#### Service Authentication

ALL microservices (contract-service, scrapling, future services):

- MUST use managed service keys (`smo_svc_live_*`) in `platform_api_key`
- MUST validate via `validate-api-key` Edge Function or direct DB lookup
- MUST NOT use hardcoded env var keys (legacy pattern, being migrated)
- Internal services don't hold consumer keys — the web app/Edge Function is the gateway

#### Environment Enforcement

- `smo_sk_test_*` → blocked in production, allowed in local/staging
- `smo_sk_live_*` → works in all environments
- Environment is key metadata, enforced at the gateway
- No separate databases per environment (single Supabase project per env)

---

## Protocols

| Protocol      | File                              | Triggers                                     |
| ------------- | --------------------------------- | -------------------------------------------- |
| Security      | `docs/protocols/SECURITY.md`      | Secrets, auth, RLS, API keys, Edge Functions |
| Documentation | `docs/protocols/DOCUMENTATION.md` | Source of truth, doc standards, frontmatter  |
| Knowledge     | `docs/protocols/KNOWLEDGE.md`     | ADRs, learnings, templates                   |
| Environment   | `docs/protocols/ENV_PROTOCOL.md`  | New env vars, secrets, .env.template, op://  |

---

## What NOT To Do

- Never use JavaScript — TypeScript only
- Never use Pages Router — App Router only
- Never bypass RLS with service role for user-facing operations
- Never create tables without `workspace_id` (if workspace-scoped), `created_at`, `updated_at`
- Never hardcode Norwegian text — use i18n keys
- Never store secrets in code — use env vars or `op://`
- Never create `.env.local` — use `op run --env-file=.env.template`. Never commit raw secrets.
- Never reference `public.user` — it's `public.user_identity`
- Never create enums without checking `database.types.ts`
- Never edit `database.types.ts` manually — regenerate
- Never use hardcoded colors (zinc-800) — use CSS variables (bg-background)
- Never use `any` — use `unknown` + type guards
- Never create workspace-scoped tables without BOTH JWT and API key RLS policies
- Never create public API endpoints without scope guards
- Never create a TanStack Query mutation without an `emit()` call in `onSuccess`
- Never create Edge Functions outside the workspace-api gateway (for data endpoints)

---

## Documentation Protocol

1. Check this file first → reference files → module docs → architecture docs
2. This file wins for structural facts; module docs win for business logic
3. For implementation planning: read STATE.md FIRST — it has verified gaps and week-by-week tasks
4. Never load `docs/archive/` — superseded
5. If code changes contradict this file → update this file immediately

---

## Dev Commands

```bash
npx supabase start                    # Start local Supabase
npx supabase status                   # Get credentials
pnpm --filter web dev                 # Dashboard (3060)
pnpm --filter landing dev             # Landing (3055)
pnpm dev                              # All (requires 1Password)
pnpm dev:local                        # All (no 1Password)
pnpm typecheck                        # Type check all
pnpm lint                             # Lint all
pnpm build                            # Build all
pnpm check                            # lint + typecheck + format
pnpm clean                            # Clean build artifacts
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
cd apps/web && npx shadcn@latest add <component>
```

---

## Orchestrator Mode

When started via `ao start`, you are the ORCHESTRATOR. Your role is to plan, coordinate and delegate — NEVER implement.

### Rules

- You NEVER write code, edit files, or run lint/build/test commands yourself
- You analyze tasks and break them into subtasks
- You use `ao spawn smartout-ai "<task-description>"` to create worker agents
- You monitor progress with `ao status`
- You review workers' output and coordinate merges
- If you catch yourself starting to implement — STOP and spawn a worker instead

### Session Lifecycle

- At session start: read docs/SESSION.md for context from last session
- During work: log decisions and delegations to docs/SESSION.md
- At session end: update docs/SESSION.md with what was done, where we stopped, and known blockers

### Worker Instructions

When spawning a worker, always include in the task description:

- What branch to work on
- What specific files/modules to touch
- What "done" looks like (tests pass, lint clean, etc.)
- "When finished, create a PR and report back"

### You delegate to workers for:

- All code changes, fixes, and refactoring
- Running tests, lint, builds
- Creating PRs
- Investigating bugs

### You do yourself:

- Reading ao status and reviewing progress
- Deciding task priority and order
- Reviewing PRs before merge
- Breaking down complex tasks into worker-sized pieces
- Communicating with me (the human)

---

## Changelog

| Date       | Version | Change                                                                                                                                                                                                                                              | Author |
| ---------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 2026-03-17 | 9.5.0   | Domain audit: Trainee Mode status-only clarification, Veikart/Reise/Protokoll conceptual-only, Event Engine journey registry clarification, action_type handlers documented, telemetry registry reference added, emit() coverage fix (33 mutations) | Claude |
| 2026-03-17 | 9.4.0   | Audit fix: ports (3060, 5010-5012, 8000), counts (72 enums, 31 EFs, 54 ADRs, 23 modules), onboarding rewrite, added packages (agent-sdk, walkAi, walkieTalkie), organization scope, packages/ai subdirs, integration clarifications                 | Pontus |
| 2026-03-17 | 9.3.0   | Code Readability section added to Code Conventions: self-documenting first, comment WHY not WHAT, priority order for naming/comments                                                                                                                | Pontus |
| 2026-03-17 | 9.2.0   | Added commitlint rules to Code Conventions (header/body max 100 chars, types, scope kebab-case)                                                                                                                                                     | Claude |
| 2026-03-09 | 9.1.0   | ENV protocol: op run as standard, .env.template as single source of truth, removed .env.local references, added ENV_PROTOCOL.md to protocols table                                                                                                  | Pontus |
| 2026-04-13 | 9.0.0   | Module Zero: 7 new tables, 3 enums, 26 telemetry events, 13 engine handlers, employee UI (my-schedule, my-training, handbook), governance CRUD, setup wizard, season status trap                                                                    | Claude |
| 2026-03-06 | 8.1.0   | Season planning (Module 15 MVP): season_budget, day_factor, hour_factor tables, budget_status enum, calculation engine, 4 hooks, 5 UI components, /dashboard/season page                                                                            | Claude |
| 2026-03-02 | 8.0.0   | Agent architecture: engine_memory, engine_authority_config tables, agent mode in engine_sessions, ADR-0042                                                                                                                                          | Claude |
| 2026-03-01 | 7.9.0   | Onboarding wizard refactored: 15 step components, 4 drawers, progressive save, auth step, invite step                                                                                                                                               | Claude |
| 2026-03-01 | 7.8.0   | Doc audit: add infra/, stage-engine, interview-mcp, i18n, tailwind-config; fix counts                                                                                                                                                               | Claude |
| 2026-03-01 | 7.7.0   | shift-mcp service, schedule_shift table, ADR-0036, schedules scope active                                                                                                                                                                           | Claude |
| 2026-03-01 | 7.6.0   | workspace-api gateway: 7 endpoints, usage tracking, env enforcement, 15 Edge Functions                                                                                                                                                              | Claude |
| 2026-03-01 | 7.5.0   | API Gateway enforcement: mandatory checklists, scope table, service auth, env enforcement                                                                                                                                                           | Claude |
| 2026-03-01 | 7.4.0   | Inline security summary: Three Laws, API key tiers, env vars always in context                                                                                                                                                                      | Claude |
| 2026-03-01 | 7.3.0   | Protocols folder, templates folder, security protocol populated                                                                                                                                                                                     | Claude |
| 2026-02-28 | 7.2.0   | API key management: 3 tables, 2 Edge Functions, 8 API routes, UI, ADR-0028                                                                                                                                                                          | Claude |
| 2026-02-28 | 7.1.0   | Added Security section referencing SMARTOUT_SECURITY_PROTOCOL                                                                                                                                                                                       | Pontus |
| 2026-02-28 | 7.0.0   | Major trim: moved details to reference files, <280 lines                                                                                                                                                                                            | Claude |
| 2026-02-28 | 6.1.0   | Pricing terms, workspace creation, ADR-0027                                                                                                                                                                                                         | Claude |
| 2026-02-28 | 6.0.0   | Docs restructuring, INDEX.md, reference files, YAML, ADR-0025                                                                                                                                                                                       | Claude |
| 2026-02-28 | 5.0.0   | Contract system, microservice, notifications, ADR-0021-0024                                                                                                                                                                                         | Claude |
| 2026-02-27 | 2.0.0   | Complete rewrite verified against codebase                                                                                                                                                                                                          | Claude |
| 2026-01-01 | 1.0.0   | Initial version                                                                                                                                                                                                                                     | Pontus |
