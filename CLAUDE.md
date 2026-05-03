# CLAUDE.md — Smartout v3

> Ground truth. Verified against code. If code contradicts this file, CODE wins — update this doc.

---

## Project Identity

**Smartout** — Employee Readiness System for shift-based businesses in Norway.
Rebuild from Bubble.io. Live Stripe billing + DocuSign contracts. Modern stack, not a prototype.
**"Ready"** = all Policies learned, all Protocols completed.

---

## Source of Truth

0. **`docs/ORIENTATION.md`** → North Star cheat sheet (read this FIRST at session start) — derived from ADR-0075
1. **Code + database schema** → always wins
2. **This file** → conventions, rules, critical traps
   2.5. **Cascade Core Foundation spec** → canonical cascade architecture (`docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`)
   2.5. **docs/STATE-SUMMARY.md** → current priorities + active gaps (lightweight; full STATE.md for deep dives)
3. **docs/decisions/** → accepted ADRs (code-review reviewed, in git blame)
4. **docs/reference/** → DATABASE, ROUTES, PACKAGES, ENV_VARS
5. **docs/engines/** → Event Motor domain packaging (industry, niche, role capability, environment, handbook)
6. **docs/modules/** → business logic (23 module docs)
7. **docs/architecture/** → system design decisions
8. **docs/cross-cutting/** → GDPR, billing, security, i18n

> Master map: `docs/INDEX.md` | All docs have YAML frontmatter.

---

## Tech Stack

Next.js 16 (App Router) + React 19 + TypeScript (strict) | Tailwind v4 (CSS config, no config file) | shadcn/ui (new-york) | React Native + Expo (mobile) | Supabase (PostgreSQL 17, Auth, Storage, Edge Functions) | Vercel (web + landing) | PostHog EU | pnpm 9.15 + Turborepo | Playwright E2E

Integrations: Stripe (API-only via Edge Functions), DocuSeal (contracts), SendGrid (API-only via Edge Functions/webhooks), Twilio (API-only), Sentry, Upstash Redis, Ultravox (voice), Remotion (video)

> Full details: `docs/reference/PACKAGES.md`

---

## Monorepo Structure

```
smartout_v3/
├── apps/web/          → Dashboard (port 3060)
│   ├── onboarding/     → Wizard: 10 sections + 14 UI components + WizardContext + 3 hooks (useOnboardingState, useScrollProgress, useBotsson)
├── apps/mobile/       → Mobile app (React Native + Expo)
├── apps/landing/      → Landing page (port 3055)
├── apps/e2e/          → Playwright tests
├── packages/          → agent-sdk, ai (+ adapters/, agents/, capabilities/, context/, engine/, generators/,
│                        journey/, missions/, prompts/, router/, schemas/, tools/), design-tokens, docs-pipeline,
│                        eslint-config, i18n, notifications, supabase, telemetry, types, typescript-config,
│                        ui, utils, Botsson, walkieTalkie
├── services/          → contract-service (Fastify, 5012), interview-mcp (anchor), scrapling (Python, 8000),
│                        shift-mcp (Hono, 5011), stage-engine (Hono, 5010)
├── infra/             → Unified Docker Compose + Caddy reverse proxy (ADR-0039)
├── supabase/          → migrations, 31 Edge Functions, seed.sql
└── docs/              → INDEX.md + reference/ modules/ architecture/ decisions/ learnings/
```

> Package exports: `docs/reference/PACKAGES.md`

---

## Database

**Database rules:** See `smartout-database-guide` skill (auto-triggered on any DB work). Reference: `docs/reference/DATABASE.md`.
**Supabase environments:** Development = Supabase Local (`npx supabase start`). Production = Supabase Cloud. Never develop against production.

---

## UI & Styling

- **Design System: "Nordic Split"** — See `smartout-nordic-split` skill for all design rules.
- **Tailwind v4** — CSS-based config in `globals.css`. NO `tailwind.config.ts`.
- Root `package.json` has Tailwind v3 — that's for Remotion only.
- **shadcn/ui** — new-york style, `apps/web/components.json`
- **Fonts:** Instrument Serif (headings, `font-heading`), Geist Sans (body), Geist Mono (data)
- **Icons:** Lucide React only. No emojis in UI.
- **Subdomain routing:** `{slug}.smartout.ai` → middleware sets `x-workspace-slug`
- Dashboard: Server layout + Client DashboardShell (ADR-0021)

> All routes: `docs/reference/ROUTES.md`

---

## Code Conventions

**TypeScript:** strict, `type` over `interface`, no `any`, named exports, Zod schemas with `z.infer<>`

**File naming:** Components `PascalCase.tsx` | Hooks `useName.ts` | Utils `camelCase.ts` | Migrations `YYYYMMDDHHMMSS_desc.sql` | Edge Functions `kebab-case/index.ts`

**Database:** `snake_case` singular tables | `{table}_id` PKs | `created_at`+`updated_at` on every table | `is_` prefix for booleans | UUIDs for all PKs | Profile status is ENUM not boolean

**Supabase:** RLS everywhere (except platform-admin) | `auth.uid()` in policies | Helpers: `get_workspace_ids_for_user()`, `is_admin_in_workspace()` | Edge Functions: Zod validation | User ops: anon key, admin ops: service role

**React/Next.js:** App Router only | Server Components default, `"use client"` as deep as possible | shadcn/ui for all UI | CSS variables for theming | `sonner` for toasts | Fonts: Geist + Geist Mono

**Mobile Parity:** Every dashboard feature must be designed for mobile from the start. Data hooks, API endpoints, and business logic must support both web and mobile surfaces. Shared logic goes in `packages/` (not `apps/web/`). Mobile UI can ship in a follow-up PR, but the architecture must never be web-only. When building a new feature: (1) data layer in packages, (2) web UI in apps/web, (3) mobile UI in apps/mobile — steps 2 and 3 can be separate PRs but step 1 must enable both.

**Mobile Surface Boundary (ADR-0133):** "Web composes, mobile executes." Web owns Author/Compose/Plan verbs (D1–D5). Mobile owns Approve/Execute/Witness verbs (D6 production + C4 acceptance). NEVER build authoring UIs on mobile (schedule drag-drop editor, onboarding wizard, contract authoring, governance authoring, organization settings, year-wheel, cost/billing — all stay web-only). Mobile-native superpowers (camera evidence per ADR-0136, biometric C4 confirmation, GPS clock-in, push-driven D6 hooks) are cascade extensions, not "mobile features."

**Mobile AI Routing (ADR-0132):** Mobile is a thin client. AI/capability traffic routes through web BFF (`/api/emma/chat` → stage-engine), never direct to capabilities. Mobile voice uses LiveKit (ADR-0135), not Ultravox. Channel pinning happens server-side; mobile sends a `channel` hint, BFF enforces ADR-0078.

**Mobile Telemetry Contract (ADR-0134):** Every mobile mutation MUST resolve `workspace_id` (non-null, non-empty) and `actor_id` (non-empty) BEFORE calling `emit()`. Use `getProfileContext()` from `apps/mobile/src/lib/profile-context.ts` (the helper throws on missing/empty IDs — fail fast, no corrupt telemetry). Empty-string fallbacks are forbidden (silently corrupts `activity_trail` + `engine_event` routing). Offline queue payloads are Zod-validated at enqueue (`apps/mobile/src/lib/sync/schemas.ts`) — malformed payloads throw at the call site.

**Telemetry:** Every mutation emits. `emit()` from `@smartout/telemetry` drives four destinations: PostHog (analytics), Logger (stdout), activity_trail (audit), engine_event (workflow automation). No mutation without emit. No second event system.

**Performance:** `Promise.all()` for independent async ops | Direct imports (no barrel re-exports in app code) | `next/dynamic` for heavy components | Suspense boundaries for streaming | `React.cache()` for request dedup

> Full performance governance: `docs/cross-cutting/performance-governance.md`

**Code Readability:** Self-documenting first. (1) Descriptive names + named constants. (2) Comment WHY, not WHAT. (3) File headers: what + why. (4) Function comments only when name doesn't say it all. Goal: a non-developer should follow the logic.

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

**Identity (pre-workspace):** user_identity → company → company_member → workspace → profile

**Cascade Dimensions (workspace-scoped):**

- **D1 Envelope:** department (permanent), location, department_operating_hours, department_hours_override, planning_cycle
- **D2 Resource:** profile, employment_contract, employee_payroll_profile, schedule_absence, team (can be seasonal)
- **D3 Rules:** regulatory_framework, framework_rule, framework_trigger, tariff_rate_table, public_holiday
- **D4 Demand:** season_budget, day_factor, hour_factor, workspace_budget, planning_event
- **D5 Concept:** workspace config, niche parameters (parameterizes coefficients in D1-D4, D6)
- **D6 Production:** department_session, session_hook, session_task, schedule_shift, deviation
- **C1 Calibration:** daily_reconciliation, workspace_kpi_target, planning_factors, adjustment_factors
- **C3 Commercial:** shift_cost_snapshot
- **C4 Governance:** engine_authority_config, change_proposal
- **K1a Industry:** regulatory_framework (platform-level), tariff_rate_table (NULL workspace_id), public_holiday
- **K1b Workspace:** workspace_doc_chunk, engine_memory

**Governance (content layer):** policy → protocol → {procedure, routine, runbook, control_list, knowledge_test, confirmation}

**Key rules:** All tables have `workspace_id` (except identity layer + platform-admin + K1a platform-level). Profile has no season connection. Position is per-shift, not per-person.

**Roles:** employee → manager → admin → owner
**Statuses:** trainee → active → inactive → offboarding
**Leader:** Team attribute (`team.leader_profile_id`), NOT a role.

---

## Cascade Core Model

**Cascade model:** See `smartout-cascade-developer` skill (auto-triggered on cascade/scheduling work). Spec: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`. Canonical model: **I1 + 6D + 4C + K1a/K1b**. "Confident != Authorized" — C1 determines belief, C4 determines permission.

**Event Engine:** Universal workflow runtime. `engine_process` (blueprint) → `engine_state` (live instance) → `engine_state_step` (per-step tracking). Action type handlers: `wait_for_event`, `assign_task`, `send_notification`, `update_entity`, `create_deviation`, `validate_settlement`, `lock_checkout`, `schedule_control`, `start_process`, `upsert_session`. Dispatch: `supabase/functions/engine-dispatch/index.ts`.

**Telemetry:** Every mutation emits. `emit()` from `@smartout/telemetry`. Registry: `packages/telemetry/src/registry.ts` (single source of truth for events and routing destinations).

---

## Modules & ADRs

> 23 module docs (modules 1-15, 17-20, 4.5, plus MODULE*0_ROADMAP, MODULE_AGENT_SDK, MODULE_BOTSSON). Load `docs/modules/MODULE*\*.md`BEFORE implementing.
**163 ADRs** in`docs/decisions/`as of 2026-04-20 (latest ADR-0164; gap at 0159 — reserved slot after mid-session renumber in 2026-04-19 kanaler-som-helpdesk council). 12 still`proposed`. Read before making changes in the same area.
Full lists: `docs/INDEX.md`| Council-verified deltas + forward plan:`docs/STATE-SUMMARY.md`

**ADR Enforcement:** Create an ADR when adding dependencies, choosing between approaches, changing schema patterns, adding integrations, or modifying build/deploy. Template: `docs/templates/decision.md`. Register in `0000-decision-log.md`.

---

## Security

**Security rules:** See `secrets-protocol` skill (auto-triggered on secrets/auth work).

Three laws — no exceptions:

1. **Never plaintext secrets** in code, config, logs, or DB columns.
2. **Never bypass RLS** for convenience.
3. **Never commit secrets** to Git.

**Environment Variables:** Validated with `@t3-oss/env-nextjs` + Zod in `apps/web/src/env.ts`. All secrets via 1Password CLI. Run with: `op run --env-file=.env.template -- pnpm run dev`.

> Full details: `docs/protocols/SECURITY.md` | `docs/protocols/ENV_PROTOCOL.md` | `docs/reference/ENV_VARS.md`

## API Gateway & Edge Functions

**Edge Function rules:** See `smartout-edge-function-guide` skill (auto-triggered on Edge Function work).

---

## Protocols

| Protocol      | File                              | Triggers                                     |
| ------------- | --------------------------------- | -------------------------------------------- |
| Security      | `docs/protocols/SECURITY.md`      | Secrets, auth, RLS, API keys, Edge Functions |
| Documentation | `docs/protocols/DOCUMENTATION.md` | Source of truth, doc standards, frontmatter  |
| Knowledge     | `docs/protocols/KNOWLEDGE.md`     | ADRs, learnings, templates                   |
| Environment   | `docs/protocols/ENV_PROTOCOL.md`  | New env vars, secrets, .env.template, op://  |

## Audit & Compliance

`adr-contract-audit` skill validates the codebase against accepted ADRs + API contracts via parallel specialist agents. Run periodically + before major merges:

- `/audit` — full sweep (14 specialists, ~5 min). Output: `docs/audits/<date>-adr-contract-validation/`
- `/audit smoke` — 3 high-risk slices (~1 min). Pre-merge gate.
- `/audit pr` — diff-scoped per branch
- `/audit test <baseline>` — regression-test against git-baseline (pre-audit, post-sortie-1/2/3, current)

Skill location: `~/.claude/skills/adr-contract-audit/`. Findings are READ-ONLY rapport; remediation = separate sortie. See skill `TESTING.md` for self-test framework and `test-runs/` for run history. Latest synthesis: `docs/audits/2026-05-02-adr-contract-validation/00-SYNTHESIS.md` (87 deduplicated findings; 5 CRITICAL closed by 19 commits 2026-05-02).

---

## What NOT To Do

- Never write capability tool docstrings claiming ADR compliance before the body satisfies it — L-0176 (2026-04-29). Docstrings drift from bodies. `tools.ts:282` claimed ADR-0204 compliance while body at lines 443-481 had 3 direct writes outside `gatedMutation`. Write the body first, verify with `smartout-agent-dev` Tool Compliance Self-Check table, then write the docstring.
- Never resolve `workspace_id` (or `profile_id`, role) from a body-supplied row reference without fail-fast on row-not-found — L-0177 (2026-04-29). Silent fallback to JWT-default workspace = bug, same class as forgeable IDs (ADR-0151). Allowed: 4xx response with explicit error. Forbidden: `if (row?.workspace_id) effectiveWorkspaceId = row.workspace_id;` with no else-branch.
- Never mount BotssonShell on a page that hosts an embedded domain chat surface without declaring `<DomainChatOwnership>` — L-0178 + ADR-0238 (2026-04-29). Dual-surface UX (wizard textbox + Orb both look like AI chat) = silent misroute, no error, no redirect. ADR-0238 mandates Orb suppresses to passive mode when domain chat declares ownership.
- Never write a capability tool that performs cross-namespace writes (e.g. `journey_authoring` tool writing to `journey` / `journey_version` tables owned by `journey.publish_mission`) without delegating to the owning capability's tool — ADR-0240 (2026-04-29, was ADR-0237 pre-merge). ADR-0173 frozen-4 boundaries are load-bearing. If delegation impossible, draft new ADR before merging.
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
- Never hardcode regulatory rates — use `framework_rule` / `tariff_rate_table`
- Never reference `operating_hours` table — use `department_operating_hours`
- Never create schedule constraints outside D3 framework resolution
- Never implement control plane behavior without C4 permission gate
- Never create workspace without I1 bootstrap (no empty workspaces)
- Never mix dimension concerns across tables (D2 data in D4 table = wrong)
- Never treat cascade pipeline and Event Engine as the same thing — cascade produces, event engine consumes
- Never build dashboard features with web-only architecture — data layer and hooks must support mobile. Shared logic in `packages/`, not `apps/web/`
- Never create new database tables without brainstorming schema placement first (public vs dedicated schema)
- Never develop or test against Supabase Cloud — always use Supabase Local for development

---

## Documentation Protocol

1. Check this file first → reference files → module docs → architecture docs
2. This file wins for structural facts; module docs win for business logic
3. For implementation planning: read `docs/STATE-SUMMARY.md` for current priorities (full STATE.md is 82KB — use semantic search for specifics)
4. Never load `docs/archive/` — superseded
5. If code changes contradict this file → update this file immediately
