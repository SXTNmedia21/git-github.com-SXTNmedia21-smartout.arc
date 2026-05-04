---
title: Bubble Migration Campaign — 3 Workspaces to Supabase Local
status: in_progress
updated: 2026-05-03
created: 2026-05-03
module: bubble-migration
tags: [migration, bubble, strike-mcp, supabase-local]
---

# Bubble Migration — 3 Workspaces to Supabase Local

## Mission

Migrate Bubble.io production data for **Strøm Mat & Bar**, **Yogurt Haven**, and **Bårdshaug** into local Supabase Postgres. Acceptance = all relevant data from these 3 Bubble workspaces queryable in Supabase Local with FK integrity and RLS-respecting reads, verified by E2E per user journey.

## Pre-existing Infrastructure

`services/strike-mcp` already exists. Built 2026-04-07, integrated into monorepo 2026-04-17. Last verified 2026-04-18.

- 33 entity mappings in `services/strike-mcp/mappings/*.json`
- Mappings committed for `wrightegaarden` (Wrightegaarden Langesund AS) on 2026-04-16
- 11 MCP tools: `list_workspaces`, `inspect_workspace`, `research_entity`, `plan_migration`, `migrate_workspace`, `migrate_locations`, `preview_sql`, `bundle_migration`, `verify_target_empty` + 2 more
- Generate-only contract — never writes Supabase, only emits SQL files
- Output layout: `supabase/bubble-data/<workspace-slug>/01_*.sql ... bundled.sql`
- Operator applies `bundled.sql` manually via `psql`

## Strategy

**Reuse strike-mcp.** Do not rebuild migrator. Only delta:
1. Add 3 entries to `services/strike-mcp/src/workspace_constants.ts`
2. Per workspace: research entities (verify wrightegaarden mappings still hold), plan, migrate, bundle, apply, verify
3. E2E per user journey enabled by migrated data

## Phase Breakdown

### Phase 0 — Discovery (parallel, read-only)

| Task | Agent | Model | Output |
|------|-------|-------|--------|
| P0-A: Recon strike-mcp state + verification doc + decisions log | Explore | haiku | Findings report |
| P0-B: Find 3 Bubble workspace IDs + bookkeeper profile IDs | general-purpose | sonnet | IDs + counts per type |
| P0-C: Verify strike-mcp builds + connects | general-purpose | sonnet | Build status + env status |

### Phase 1 — Workspace constants

Add to `services/strike-mcp/src/workspace_constants.ts`:
- `strom-mat-bar`
- `yogurt-haven`
- `bardshaug`

Each: `bubbleWorkspaceId`, `bookkeeperBubbleProfileId`, `displayName`. Rebuild strike-mcp.

### Phase 2 — Per-workspace migration loop (sequential per WS)

Per workspace:
1. `list_workspaces` → confirm WS visible
2. `inspect_workspace` → record counts per type
3. `research_entity` per entity (33 entities) → check each mapping holds for new WS
4. Operator review per mapping → set `needs_review:false` where safe; **escalate to AI council where mapping diverges**
5. `plan_migration` → ordered migration steps
6. `migrate_*` per entity → emit per-entity SQL + report
7. `preview_sql` per generated file → sanity check
8. `bundle_migration` → `supabase/bubble-data/<slug>/bundled.sql`

### Phase 3 — Apply bundles to Supabase Local

Per WS:
- `psql` against Supabase Local (port 54322) with bundled.sql
- Verify counts match `.report.md` per entity
- Verify FK integrity (no orphans)
- RLS smoke (service role works, anon-without-JWT blocked)

### Phase 4 — E2E per user journey

User journeys enabled by migrated data:
1. **Admin onboarding** — log into migrated workspace → see correct member/profile count
2. **Schedule view** — manager opens schedule → sees migrated `schedule_shift` records
3. **Profile view** — open employee profile → sees `employment_contract` + payroll history
4. **Department view** — sees migrated `department` + `team` structure

protocol-writer agent dispatches Playwright E2E in `apps/e2e/` per journey. Iterate fix until all pass.

### Phase 5 — Handoff + ADRs

- `docs/HANDOFF-bubble-migration.md` (decisions, learnings, debt, next steps)
- ADRs for any mapping divergence per workspace
- Update DASHBOARD.md

## Hard Constraints

- **Never write to Bubble** (read-only via bubble-mcp + strike-mcp BubbleClient)
- **Never write to Supabase Cloud** (Local only — port 54322)
- **Service role for migration apply** (RLS bypass intentional)
- **Auth out of scope** (no `auth.users` creation; profile rows exist but not loginable). Separate sortie at cutover.
- **Idempotent at WS level** (Local can wipe + reload; map-table or fresh INSERT both OK for Local)
- **Bubble `_id` preserved as `migration_source_id`** where strike-mcp mapping does so

## Decision Forks (resolved with defaults)

| Fork | Default | Reasoning |
|------|---------|-----------|
| Migration type | Test-rehearsal (one-shot to Local) | Prod-cutover later, separate sortie |
| Iteration order | Workspace-first (Strøm full → Yogurt → Bårdshaug) | Strike-mcp's design respects FK ordering within bundled.sql |
| ID strategy | UUIDv5 derived from Bubble `_id` (strike-mcp existing pattern) | Stable, reversible, no extra map-table |
| Idempotency | Wipe + reload pr. WS on Local | Bruk-og-kast Local; strike-mcp `verify_target_empty` enforces |
| Auth | Skip (no `auth.users` rows) | Separate cutover sortie |
| Mapping ownership | Reuse wrightegaarden mappings; per-entity research-entity gate | Lower risk than blind reuse |

## Out of Scope

- D3 framework/tariff (platform-level seed, not workspace-data)
- D4 budgets/factors (Bubble likely runtime-computed)
- D6 department_session/session_hook/session_task (new in v3, not in Bubble)
- C1–C4 control planes (new in v3)
- engine_* tables (new in v3)
- Auth (`auth.users`) (separate cutover)

## Council Triggers

Escalate to AI council (`/run-council`) if:
- Any entity mapping shows fundamental shape mismatch vs wrightegaarden (not just sparse fields per Rule 1)
- D2/D6 FK ordering differs from established pattern
- E2E reveals user journey blocked by migrated-data-shape (not by code bug)
- Workspace identity bootstrap (I1) blocked by missing data

## Acceptance Criteria

- [ ] 3 workspaces in `workspace_constants.ts`
- [ ] `supabase/bubble-data/strom-mat-bar/bundled.sql` exists + applied
- [ ] `supabase/bubble-data/yogurt-haven/bundled.sql` exists + applied
- [ ] `supabase/bubble-data/bardshaug/bundled.sql` exists + applied
- [ ] Counts in Supabase Local match per-entity reports for all 3
- [ ] FK integrity verified (zero orphan rows per ws)
- [ ] RLS smoke passes (service role works, anon blocked)
- [ ] All E2E user-journey tests pass per WS
- [ ] HANDOFF written, ADRs registered, DASHBOARD updated
