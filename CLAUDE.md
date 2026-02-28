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
3. **docs/reference/** → DATABASE, ROUTES, PACKAGES, ENV_VARS
4. **docs/modules/** → business logic (17 modules)
5. **docs/architecture/** → system design decisions
6. **docs/cross-cutting/** → GDPR, billing, security, i18n

> Master map: `docs/INDEX.md` | All docs have YAML frontmatter.

---

## Tech Stack

Next.js 16 (App Router) + React 19 + TypeScript (strict) | Tailwind v4 (CSS config, no config file) | shadcn/ui (new-york) | Supabase (PostgreSQL 17, Auth, Storage, Edge Functions) | Vercel (web + landing) | PostHog EU | pnpm 9.15 + Turborepo | Playwright E2E

Integrations: Stripe (billing), DocuSign/DocuSeal (contracts), SendGrid (email), Twilio (SMS), Sentry, Upstash Redis, Ultravox (voice), Remotion (video)

> Full details: `docs/reference/PACKAGES.md`

---

## Monorepo Structure

```
smartout_v3/
├── apps/web/          → Dashboard (port 3050)
├── apps/landing/      → Landing page (port 3055)
├── apps/docs/         → Nextra docs site (port 3060)
├── apps/e2e/          → Playwright tests
├── packages/          → ai, design-tokens, eslint-config, notifications,
│                        supabase, telemetry, types, typescript-config, ui, utils
├── services/          → contract-service (Fastify, port 3100), scrapling (Python)
├── supabase/          → migrations, 12 Edge Functions, seed.sql
├── agents/            → Pydantic AI agents (Python)
└── docs/              → INDEX.md + reference/ modules/ architecture/ decisions/ learnings/
```

> Package exports: `docs/reference/PACKAGES.md`

---

## Database — Critical Traps

- Table is `user_identity`, NOT `user`. No `public.user` table exists.
- Subscription data on `company` table. No `stripe_subscription` table.
- `contract_status` enum already taken by `employment_contract`. Don't reuse.
- 30+ enums — check `database.types.ts` before creating new ones.
- `database.types.ts` is auto-generated. Never edit manually.
- After migration: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`
- RLS on EVERY workspace-scoped table. Platform-admin tables use service role only.
- `handle_new_user()` trigger creates `user_identity` on auth.users INSERT.
- `is_super_admin` on `user_identity` gates all platform-admin access.

> Full schema, tables, enums, RLS patterns: `docs/reference/DATABASE.md`

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

**Performance:** `Promise.all()` for independent async ops | Direct imports (no barrel re-exports in app code) | `next/dynamic` for heavy components | Suspense boundaries for streaming | `React.cache()` for request dedup

> Full performance governance: `docs/cross-cutting/performance-governance.md`

---

## Data Model

> Full details: `docs/reference/DATABASE.md`

**Identity:** user_identity → company → company_member → workspace → profile
**Structure:** department (permanent) | location | team (can be seasonal)
**Governance:** policy → protocol → {procedure, routine, runbook, control_list, knowledge_test, confirmation}
**Time:** season (wraps operations, gamification container)

**Key rules:** All tables have `workspace_id` (except identity layer + platform-admin). Profile has no season connection. Position is per-shift, not per-person.

**Roles:** employee → manager → admin → owner
**Statuses:** trainee → active → inactive → offboarding
**Leader:** Team attribute (`team.leader_profile_id`), NOT a role.

---

## Domain Concepts

- **Department Session** — Daily container per dept. Lifecycle: upcoming → active → pending_signoff → closed | missed
- **Session Hooks** — Time triggers firing procedures/routines at pre_open, open, scheduled, pre_close, close
- **Readiness** — Employee "ready" when all assigned Protocols completed. Score = % completed.
- **Trainee Mode** — Sandbox. Real UI, no live impact. 48h escalation.
- **Season** — Time period wrapping operations. Own leaderboard and point rules.

---

## Modules & ADRs

> 17 modules (1-15, 17-18). Load `docs/modules/MODULE_*.md` BEFORE implementing.
> 27 ADRs in `docs/decisions/`. Read before making changes in the same area.
> Full lists: `docs/INDEX.md`

**ADR Enforcement:** Create an ADR when adding dependencies, choosing between approaches, changing schema patterns, adding integrations, or modifying build/deploy. Template: `docs/decisions/template.md`. Register in `0000-decision-log.md`.

---

## Environment Variables

Validated with `@t3-oss/env-nextjs` + Zod in `apps/web/src/env.ts`.
1Password: `op run --env-file=.env.template`. Never commit `.env.local`.

> Full variable list: `docs/reference/ENV_VARS.md`

---

## Security

All work involving secrets, API keys, authentication, or authorization
MUST follow `SMARTOUT_SECURITY_PROTOCOL.md`. Read it before touching:

- Edge Functions with auth logic
- Vault or secret storage
- RLS policies
- API key creation, rotation, or validation
- Frontend key management UI

Three laws (memorize these):

1. Never plaintext secrets in code, config, logs, or DB columns.
2. Never bypass RLS for convenience.
3. Never commit secrets to Git.

---

## What NOT To Do

- Never use JavaScript — TypeScript only
- Never use Pages Router — App Router only
- Never bypass RLS with service role for user-facing operations
- Never create tables without `workspace_id` (if workspace-scoped), `created_at`, `updated_at`
- Never hardcode Norwegian text — use i18n keys
- Never store secrets in code — use env vars or `op://`
- Never reference `public.user` — it's `public.user_identity`
- Never create enums without checking `database.types.ts`
- Never edit `database.types.ts` manually — regenerate
- Never use hardcoded colors (zinc-800) — use CSS variables (bg-background)
- Never use `any` — use `unknown` + type guards
- Never commit `.env.local` or raw secrets

---

## Documentation Protocol

1. Check this file first → reference files → module docs → architecture docs
2. This file wins for structural facts; module docs win for business logic
3. Never load `docs/archive/` — superseded
4. If code changes contradict this file → update this file immediately

---

## Dev Commands

```bash
npx supabase start                    # Start local Supabase
npx supabase status                   # Get credentials
pnpm --filter web dev                 # Dashboard (3050)
pnpm --filter landing dev             # Landing (3055)
pnpm --filter docs dev                # Docs (3060)
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

## Changelog

| Date       | Version | Change                                                        | Author |
| ---------- | ------- | ------------------------------------------------------------- | ------ |
| 2026-02-28 | 7.1.0   | Added Security section referencing SMARTOUT_SECURITY_PROTOCOL | Pontus |
| 2026-02-28 | 7.0.0   | Major trim: moved details to reference files, <280 lines      | Claude |
| 2026-02-28 | 6.1.0   | Pricing terms, workspace creation, ADR-0027                   | Claude |
| 2026-02-28 | 6.0.0   | Docs restructuring, INDEX.md, reference files, YAML, ADR-0025 | Claude |
| 2026-02-28 | 5.0.0   | Contract system, microservice, notifications, ADR-0021-0024   | Claude |
| 2026-02-27 | 2.0.0   | Complete rewrite verified against codebase                    | Claude |
| 2026-01-01 | 1.0.0   | Initial version                                               | Pontus |
