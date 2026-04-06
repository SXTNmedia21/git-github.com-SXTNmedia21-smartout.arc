# Production Readiness Hardening — Design Spec

> **Date:** 2026-04-04
> **Status:** Draft
> **Scope:** Fix all 27 identified production issues across security, stub data, and landing bugs
> **Strategy:** Parallel subagent execution in isolated worktrees with verification gates

---

## Problem Statement

The SmartOut v3 codebase has been audited and 27 production issues were identified across three categories:

- **Security & Infrastructure (A):** Exploitable vulnerabilities, hardcoded dev URLs, missing error handling, stale types
- **Stub Data & Broken Features (B):** Mock data in production UI, non-functional features, unwired hooks
- **Landing Bugs (C):** Actual code bugs, missing error boundaries, no error tracking

All code exists and works in development. The goal is to harden what's built — no new features.

---

## Architecture: Parallel Subagent Execution

### Execution Model

```
Orchestrator (main context)
├── Phase 1: Foundation (sequential — shared dependencies)
│   └── Agent-F1: Database types regeneration + migration
│
├── Phase 2: Parallel Hardening (6 agents in isolated worktrees)
│   ├── Agent-A1: Security fixes (auth, CORS, rate limiting, open redirect)
│   ├── Agent-A2: Infrastructure fixes (localhost URLs, edge function config, error handling)
│   ├── Agent-A3: Type safety sweep (all 218 `as any` casts)
│   ├── Agent-B1: Dashboard stub data + broken features (items 1-8)
│   ├── Agent-B2: Feature flag gating for unfinished pages (items 9-11)
│   └── Agent-C1: Landing bugs + error boundaries + Sentry
│
├── Phase 3: Integration (sequential)
│   └── Merge all worktree branches, resolve conflicts
│
└── Phase 4: Verification (parallel)
    ├── Agent-V1: Full build + typecheck + lint
    ├── Agent-V2: Security audit (grep for residual issues)
    └── Agent-V3: Stub data audit (grep for residual mock data)
```

### Why This Decomposition

- **F1 must run first** — type regeneration eliminates ~60 of the 218 `as any` casts, unblocking A3
- **A1, A2, A3, B1, B2, C1 are independent** — they touch different files with no overlap
- **V1-V3 run after merge** — catch integration issues and verify nothing was missed

### Worktree Strategy

Each Phase 2 agent gets an isolated git worktree branching from `development-msi`:

- `wt-prod-a1-security` — Agent-A1
- `wt-prod-a2-infra` — Agent-A2
- `wt-prod-a3-types` — Agent-A3
- `wt-prod-b1-stubs` — Agent-B1
- `wt-prod-b2-flags` — Agent-B2
- `wt-prod-c1-landing` — Agent-C1

After all complete, orchestrator merges into a single `fix/production-hardening` branch.

---

## Phase 1: Foundation — Database Types Regeneration

### Agent-F1: Types Regeneration

**Prerequisite:** Supabase local must be running with all migrations applied.

**Tasks:**

1. Run `npx supabase db reset` to apply all 250 migrations cleanly
2. Run `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`
3. Verify the regenerated file includes tables currently missing:
   - `service_config`
   - `landing_visitor`, `landing_session`, `landing_event`, `landing_waitlist_submission`
   - `leader_pulse`
   - `workspace_doc_chunk`
   - `landing_variant`, `landing_block`
4. Run `pnpm typecheck` — capture which `as any` casts are now resolvable
5. Commit: `fix(db): regenerate database.types.ts with all current migrations`

**Exit criteria:** `database.types.ts` regenerated, typecheck passes, list of auto-resolved casts documented.

**Note:** If any tables are missing from the regenerated types, it means the migration doesn't exist yet. Document which tables are missing and flag — those casts stay until migration is written.

---

## Phase 2: Parallel Hardening

### Agent-A1: Security Fixes

**Files touched:** Auth callbacks, CORS config, rate limiting, contracts route

| Item | Fix                                                                                                                              | File                                                     |
| ---- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 18   | Validate `next` param against allowlist — reject external URLs                                                                   | `apps/landing/src/app/api/auth/callback/route.ts`        |
| 19   | Replace `*` with explicit origin allowlist from env var `ALLOWED_ORIGINS`                                                        | `supabase/functions/_shared/cors.ts`                     |
| 20   | Return `{ allowed: false }` when Redis unavailable — fail closed                                                                 | `supabase/functions/_shared/rate-limit.ts`               |
| 17   | Move company PII to env vars (`PLATFORM_COMPANY_NAME`, `PLATFORM_ORG_NUMBER`, `PLATFORM_CONTACT_EMAIL`, `PLATFORM_CONTACT_NAME`) | `apps/web/src/app/api/platform-admin/contracts/route.ts` |

**Verification:**

- `grep -r "Access-Control-Allow-Origin.*\*" supabase/functions/` returns 0 results
- `grep -rn "Pontus\|929 620 291\|pontus@smartout" apps/` returns 0 results
- Rate limit test: unset `UPSTASH_REDIS_REST_URL` env var, confirm requests are denied

---

### Agent-A2: Infrastructure Fixes

**Files touched:** Service URLs, edge function config, error handling, conditional hooks

| Item | Fix                                                                                                                                                                                                                                                                                                                                        | File(s)                                                                                                                            |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| 16   | Replace all hardcoded `localhost` with env vars (`STAGE_ENGINE_URL`, `SHIFT_MCP_URL`, `CONTRACT_SERVICE_URL`, `SCRAPLING_SERVICE_URL`, `DOCKER_HOST`). In API routes, throw if env var is missing AND `process.env.NODE_ENV === "production"`. In client hooks, read from `NEXT_PUBLIC_` equivalents. Add all new vars to `.env.template`. | 6+ files (see list below)                                                                                                          |
| 21   | Add 9 missing functions to `config.toml`                                                                                                                                                                                                                                                                                                   | `supabase/functions/config.toml`                                                                                                   |
| 22   | Wrap 6 edge functions in try/catch with proper error responses                                                                                                                                                                                                                                                                             | `cleanup-api-keys`, `contract-lifecycle`, `daily-session-replenish`, `health-check`, `session-hook-executor`, `watchdog-integrity` |
| 25   | Fix conditional hooks — extract to separate components or move hooks before conditionals                                                                                                                                                                                                                                                   | `apps/web/src/app/dashboard/website/_components/TemplatePreview.tsx`                                                               |
| —    | Fix scrape/public route returning 200 on error — change to 500 with `{ status: "failed" }`                                                                                                                                                                                                                                                 | `apps/web/src/app/api/scrape/public/route.ts:96-98`                                                                                |

**Localhost files to fix:**

```
apps/web/src/hooks/useJourneySocket.ts:28
apps/web/src/app/api/platform-admin/services/test/route.ts:8-13
apps/web/src/app/api/platform-admin/services/health/route.ts:80,87
apps/web/src/app/api/platform-admin/services/config/[slug]/restart/route.ts:31
apps/web/src/app/api/platform-admin/workspaces/lookup/route.ts:5
apps/web/src/app/api/platform-admin/workspaces/analyze-documents/route.ts:59
apps/web/src/app/platform-admin/guardian/_hooks/useGuardianSocket.ts:36
```

**Verification:**

- `grep -rn "localhost\|127\.0\.0\.1" apps/web/src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules\|\.next\|test\|spec\|mock"` returns only intentional references (hostname checks in middleware)
- All 9 functions present in `config.toml`
- `grep -rn "Serve(.*{" supabase/functions/*/index.ts | xargs -I{} grep -L "try" {}` returns 0 (all have try/catch)

---

### Agent-A3: Type Safety Sweep

**Scope:** All 218 `as any` / `as unknown as` casts across `apps/web/src/`

**Strategy (in priority order):**

1. **Auto-resolved by F1** (~60 casts) — Remove casts where regenerated types now cover the table. Search for `UntypedClient`, `as unknown as { from`, `as any).from` patterns.

2. **Website schema casts** (~40 casts) — The `websites` Postgres schema is exposed via API (`supabase/config.toml` schema list). Create a `WebsitesDatabase` type helper in `packages/supabase/src/` that types the `websites` schema tables. Replace `.schema("websites" as any)` with properly typed client.

3. **Shift clock / GPS data** (~30 casts) — Define proper types for GPS coordinates, break data, supplement calculations. Replace `as unknown as` double-casts with Zod runtime validation at the boundary, then flow typed data through.

4. **Onboarding scraped data** (~20 casts) — Define `ScrapedCompanyData` type with optional fields. Validate with Zod at ingestion point, flow typed data through hooks.

5. **Remaining casts** (~68) — For each: either add proper types, add Zod validation at boundaries, or if truly unavoidable (third-party lib gaps), add `// SAFETY: <reason>` comment explaining why the cast is safe.

**Rules:**

- Never replace `as any` with `as unknown` and call it fixed — that's the same problem
- Every boundary (API response, DB query, external data) gets Zod validation
- Internal code should need zero casts if boundaries are properly typed
- `@ts-expect-error` is acceptable ONLY with a comment explaining what's expected and a tracking issue

**Verification:**

- `grep -c "as any" apps/web/src/**/*.{ts,tsx}` < 10 (some may remain for genuine third-party gaps)
- `grep -c "as unknown as" apps/web/src/**/*.{ts,tsx}` < 10
- `pnpm typecheck` passes with 0 errors
- No new `@ts-ignore` or `@ts-nocheck` directives added

---

### Agent-B1: Dashboard Stub Data & Broken Features

**Files touched:** Close-out flow, interactive dashboard, onboarding assistant, schedule grid, season overview, people actions, bootstrap context

| Item | Fix                                                                                                                                                                                                                                                                                                                                         | File                                  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 1    | **CloseOutFlow**: Add department selector dropdown. Query `department` table for workspace departments. Set `departmentId` from selection. Show prompt if no department selected.                                                                                                                                                           | `CloseOutFlow.tsx`                    |
| 2    | **Dashboard metrics**: Wire `unsignedContracts` from `employment_contract` table (status != 'signed'), `expiringTraining` from `protocol_assignment` (expiring within 30 days), `budgetVariance` from `workspace_budget` (actual vs target). Create `useDashboardMetrics` hook.                                                             | `InteractiveDashboard.tsx` + new hook |
| 3    | **Onboarding assistant**: Remove mock data. Connect to real `engine_state` for the workspace's onboarding process. If no active onboarding session, show empty state with "Start onboarding" CTA. Fall back to empty state gracefully — never show fake hotel data.                                                                         | `assistant-ui.tsx`                    |
| 4    | **Shift editor**: Replace toast with a `ShiftDetailSheet` (shadcn Sheet). Show read-only shift details (employee, time, position, status). Include an "Edit" button that is disabled with tooltip "Redigering kommer snart" — do NOT build a full editor. The goal is to remove the stub toast and show real data, not build shift editing. | `week-grid.tsx`                       |
| 5    | **Duty leader**: Check if `duty_leader_id` column exists on `department_session`. If yes, wire the dropdown to persist via mutation. If no, create migration to add the column, then wire.                                                                                                                                                  | `OversiktTab.tsx`                     |
| 6    | **Season overview**: Remove `.slice(0, 7)`. Show full season day targets. If too many days for the UI, paginate or summarize by week with expandable detail.                                                                                                                                                                                | `SeasonOverviewTab.tsx`               |
| 7    | **Protocol reminders**: Wire to `process-notifications` edge function. Call the EF when reminder is triggered instead of just writing to `activity_trail`.                                                                                                                                                                                  | `people-actions.ts`                   |
| 8    | **Bootstrap context**: Implement the 4 TODO queries — fetch role from `company_member`, query `protocol_assignment`, check overdue status, query `user_search_history` (or remove if table doesn't exist).                                                                                                                                  | `build-bootstrap-context.ts`          |

**Verification:**

- `grep -rn "TODO\|FIXME\|hardcoded\|mock\|Mock\|stub\|Stub" apps/web/src/app/dashboard/ --include="*.ts" --include="*.tsx"` returns 0 results for the 8 fixed items
- Close-out flow renders department selector and queries succeed with a selected department
- Dashboard metrics show real numbers (may be 0 if no data, but wired to real queries)
- Onboarding assistant shows empty state when no session exists
- `pnpm typecheck` passes

---

### Agent-B2: Feature Flag Gating

**Scope:** Hide 3 unfinished pages behind feature flags

**Approach:**

1. Create a lightweight feature flag utility in `apps/web/src/lib/feature-flags.ts`:

   ```typescript
   /** Feature flags — gates for unfinished features. Remove flag + gate when feature ships. */
   export const FEATURE_FLAGS = {
     MY_CV: process.env.NEXT_PUBLIC_FF_MY_CV === "true",
     SHIFT_CLOCK_LEADER: process.env.NEXT_PUBLIC_FF_SHIFT_CLOCK_LEADER === "true",
     AI_CHAT: process.env.NEXT_PUBLIC_FF_AI_CHAT === "true",
   } as const;
   ```

2. Gate each page:
   - `/dashboard/my-cv/page.tsx` — if `!FEATURE_FLAGS.MY_CV`, `redirect("/dashboard")`
   - `/dashboard/shift-clock/page.tsx` — leader view: if `!FEATURE_FLAGS.SHIFT_CLOCK_LEADER`, show employee view only (no placeholder)
   - `/dashboard/ai/page.tsx` — chat section: if `!FEATURE_FLAGS.AI_CHAT`, don't render the "kommer snart" box at all

3. Remove sidebar/nav links for flagged-off features so users never see them

4. Add the 3 env vars to `.env.template` with `false` defaults

**Verification:**

- With flags off (default): no "under construction", "kommer snart", or "Task 11" text visible
- With flags on: pages render as before (stubs visible for dev testing)
- Navigation has no dead links
- `grep -rn "under construction\|kommer snart\|Task 11\|Implementeres i" apps/web/src/` returns results only inside flag-gated blocks

---

### Agent-C1: Landing Bugs + Error Boundaries + Sentry

| Item | Fix                                                                                                                                                                                                                                                                                                                                                     | File                                                    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 12   | Remove the 4 `ready: false` blog entries from the index page. Don't show articles that don't exist. When content is written, add them back.                                                                                                                                                                                                             | `apps/landing/src/app/blog/page.tsx`                    |
| 13   | Replace nil UUID with env var `DEMO_WORKSPACE_ID`. If not set, return 503 with "Demo unavailable".                                                                                                                                                                                                                                                      | `apps/landing/src/app/api/wizard/engine-start/route.ts` |
| 14   | Fix `revalidateTag("landing", "max")` → `revalidateTag("landing")`                                                                                                                                                                                                                                                                                      | `apps/landing/src/app/api/revalidate/route.ts:48`       |
| 15   | Delete the dead `[slug]/page.tsx` catch-all or make it redirect to `/`                                                                                                                                                                                                                                                                                  | `apps/landing/src/app/[slug]/page.tsx`                  |
| 26   | Add error boundaries: root `app/error.tsx`, `app/demo/error.tsx`, `app/docs/[slug]/error.tsx`. Add root `app/loading.tsx` with spinner.                                                                                                                                                                                                                 | New files                                               |
| 27   | Add Sentry to landing: install `@sentry/nextjs`, create `sentry.client.config.ts` + `sentry.server.config.ts`, wrap `next.config.ts` with `withSentryConfig`. Use env var `NEXT_PUBLIC_SENTRY_DSN` (same as web app). Copy Sentry config pattern from `apps/web/sentry.*.config.ts`. Add `SENTRY_AUTH_TOKEN` to `.env.template` if not already present. | `apps/landing/next.config.ts` + new files               |

**Verification:**

- `/blog` page shows only 2 articles (no "Kommer snart" badges)
- `revalidateTag` called with single argument
- `[slug]` route either deleted or redirects
- Error boundaries render friendly error UI (test by throwing in a component)
- Sentry DSN configured and `@sentry/nextjs` in landing `package.json`
- `pnpm --filter landing build` passes

---

## Phase 3: Integration Merge

**Orchestrator runs this sequentially:**

1. Create integration branch: `fix/production-hardening` from `development-msi`
2. Merge each worktree branch in order: F1 → A1 → A2 → A3 → B1 → B2 → C1
3. F1 first because A3 depends on regenerated types
4. A1-A2 before A3 because A3 may touch files A1-A2 also touch
5. B1-B2 and C1 are independent — order doesn't matter
6. Resolve any merge conflicts (expected: minimal since agents touch different files)
7. Run `pnpm typecheck && pnpm lint && pnpm build` after merge

---

## Phase 4: Verification

Three verification agents run in parallel after the integration merge:

### Agent-V1: Build Health

```bash
pnpm typecheck    # 0 errors
pnpm lint         # 0 errors (warnings OK)
pnpm build        # All 10 tasks pass
```

### Agent-V2: Security Residual Audit

```bash
# No CORS wildcard
grep -r "Allow-Origin.*\*" supabase/functions/

# No hardcoded secrets or PII
grep -rn "Pontus\|929 620\|pontus@smartout\|sk_live\|sk_test" apps/ packages/

# No unvalidated redirects
grep -rn "searchParams.get.*next\|redirect.*origin" apps/ --include="*.ts"

# No localhost in production code (excluding middleware hostname checks)
grep -rn "localhost:[0-9]" apps/web/src/ --include="*.ts" --include="*.tsx" | grep -v middleware | grep -v "// dev-only"

# All edge functions in config.toml
diff <(ls -d supabase/functions/*/| grep -v _shared | sed 's|.*/\(.*\)/|\1|' | sort) <(grep '^\[functions\.' supabase/functions/config.toml | sed 's/\[functions\.\(.*\)\]/\1/' | sort)
```

### Agent-V3: Stub Data Residual Audit

```bash
# No mock/stub data in dashboard
grep -rn "mock\|Mock\|MOCK\|stub\|Stub\|dummy\|Dummy\|Kari Nordmann\|Per Olsen\|Hotell Spåtind" apps/web/src/app/dashboard/ --include="*.ts" --include="*.tsx"

# No hardcoded zeros in metrics
grep -rn "unsignedContracts = 0\|expiringTraining = 0\|budgetVariance = .0%" apps/web/src/

# No "under construction" or "kommer snart" outside feature flag gates
grep -rn "under construction\|kommer snart\|Task 11\|Implementeres i" apps/web/src/ --include="*.tsx" | grep -v "FEATURE_FLAGS"

# No TODO/FIXME for items we fixed
grep -rn "TODO.*Remove.*cast\|TODO.*Remove.*UntypedClient\|TODO.*Replace.*department\|TODO.*wire.*hook" apps/web/src/ --include="*.ts" --include="*.tsx"

# Type safety
grep -c "as any" apps/web/src/**/*.ts apps/web/src/**/*.tsx 2>/dev/null | awk -F: '{s+=$2} END {print "Total as any:", s}'
```

**Exit criteria for each verification agent:** All checks pass. If any fail, report specific failures back to orchestrator for targeted fix.

---

## Agent Assignment Summary

| Agent | Isolation   | Depends On       | Files Touched                                     | Est. Scope |
| ----- | ----------- | ---------------- | ------------------------------------------------- | ---------- |
| F1    | Main branch | Supabase running | `database.types.ts`                               | Small      |
| A1    | Worktree    | F1               | 4 files (auth, CORS, rate limit, contracts)       | Small      |
| A2    | Worktree    | F1               | ~15 files (URLs, config.toml, 6 EFs, 1 component) | Medium     |
| A3    | Worktree    | F1               | ~80+ files (type casts across web app)            | Large      |
| B1    | Worktree    | F1               | ~10 files (dashboard components + new hooks)      | Large      |
| B2    | Worktree    | F1               | ~5 files (3 pages + feature flag util + nav)      | Small      |
| C1    | Worktree    | None             | ~10 files (landing pages + Sentry setup)          | Medium     |
| V1    | Main        | All merged       | Read-only                                         | Small      |
| V2    | Main        | All merged       | Read-only                                         | Small      |
| V3    | Main        | All merged       | Read-only                                         | Small      |

**Parallelism:** After F1 completes, A1+A2+A3+B1+B2+C1 all run simultaneously. After merge, V1+V2+V3 run simultaneously.

**Total sequential wait time:** F1 (~5 min) → Phase 2 (~longest agent, likely A3) → merge (~5 min) → V1-V3 (~3 min)

---

## Risk Mitigation

### Merge Conflicts

- A3 (type sweep) is the highest conflict risk because it touches many files
- Mitigation: A3 merges LAST in Phase 3 so it resolves against all other changes
- A3 agent should avoid reformatting or restructuring — only change cast expressions

### Database Migration

- F1 depends on Supabase local running
- Mitigation: If Supabase is down, F1 documents which tables are missing and A3 works with what's available

### Scope Creep

- B1 items (especially shift editor, onboarding assistant) could expand
- Mitigation: Each B1 fix has a clear "good enough" bar — wire to real data, show empty state if no data, don't build new features

### Type Sweep Completeness

- 218 casts is a lot — A3 may not reach 100%
- Mitigation: Verification agent V3 counts residual casts. Target: < 10 remaining. Any remaining must have `// SAFETY:` comments.
