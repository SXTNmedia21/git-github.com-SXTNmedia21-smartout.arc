---
title: "Plan — contract-binding-auto-seed"
status: draft
updated: 2026-05-06
created: 2026-05-06
module: contract
linear: SMA-309
tags: [plan, contract, supabase, migration, onboarding-blocker]
---

# Plan — contract-binding-auto-seed

> Branch: `feat/contract-binding-auto-seed` | Worktree: `~/dev/smartout.ai-wt-6` | Base: `development` | Module: contract | Started: 2026-05-06 | Linear: **SMA-309**

## Source of truth

- **Linear:** [SMA-309](https://linear.app/smartout/issue/SMA-309) — `[BLOCKER] Fresh workspace = 400 på første kontrakt — workspace_framework_binding ikke auto-seedet`
- **CONTRACT-PIPELINE-MAP §17** — Active gaps inventory (2026-05-06)
- **HANDOFF-employee-contract.md** — Council R1 audit YELLOW finding (2026-04-28)
- **Lovsen + Steward synthese 2026-05-06** — gap #6 + #8 ranked Urgent

## Goal

Eliminate the "fresh workspace = 400 on first contract" failure mode by auto-seeding `workspace_framework_binding` on every workspace INSERT. Existing workspaces missing binding get one-time backfill.

After this lands: every new workspace can compose + send its first contract without manual binding-INSERT step.

## Scope

In:
1. Migration: `CREATE TRIGGER trg_workspace_seed_default_binding AFTER INSERT ON workspace`
2. Trigger function `seed_default_framework_binding()` SECURITY DEFINER, search_path locked
3. Backfill: one-time INSERT for existing workspaces missing binding
4. Telemetry event: `workspace.framework_binding_auto_seeded` registered in `packages/telemetry/src/registry.ts`
5. Trigger function emits to activity_trail via insert
6. pgTAP test: workspace insert → binding row exists
7. E2E test: fresh workspace → first contract send returns 422 (missing fields, NOT 400 binding-error)

Out (separate sorties):
- ADR-0241 promotion proposed → accepted (governance, not code)
- K1a regulatory_framework seed for non-hospitality niches (separate migration when first non-hospitality customer lands)
- "Workspace binding selector UI" in onboarding — Phase 0c+, when multiple frameworks per workspace become real
- niche-aware default selection (currently hardcodes hospitality-Riksavtalen) — needs I1 niche derivation (separate Linear ticket)

## ADR / Learning compliance

- **ADR-0076** (composition cascade derivation) — preserves precondition that binding always exists
- **ADR-0241** (schema migration foundation) — adds to canonical contract migration set
- **ADR-0186** (capability authority bootstrap-trigger pattern) — mirrors `authority_seed_defaults_trg` shape
- **ADR-0193** (NonEmptyString brand) — telemetry event uses nonEmpty workspace_id
- **L-0107** (authority appearance ≠ authority presence) — defence-in-depth: trigger fires only when matching K1a row exists, fail-closed otherwise
- **L-0172** (trigger SECURITY = silent RLS bypass) — explicit SECURITY DEFINER + SET search_path

## Tasks

### Phase 1 — Migration design + write (~2 h)

- [ ] Read existing `authority_seed_defaults_trg` migration for pattern reference
- [ ] Verify `regulatory_framework` table has at least one K1a row with `code='riksavtalen_hospitality_2024'` AND `is_active=true` AND `workspace_id IS NULL`
  - If missing: Phase 1.5 — seed K1a row in same migration
- [ ] Write migration `supabase/migrations/<timestamp>_workspace_framework_binding_auto_seed.sql`:
  - Function `seed_default_framework_binding()` — `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp`
  - Trigger `AFTER INSERT ON workspace FOR EACH ROW`
  - Function logic:
    - Look up active K1a hospitality framework
    - If found: INSERT into `workspace_framework_binding (workspace_id, framework_id, is_active, bound_at)`
    - If NOT found: log warning via `RAISE NOTICE` + skip (do not fail workspace insert)
- [ ] Backfill block at end of migration:
  ```sql
  INSERT INTO workspace_framework_binding (workspace_id, framework_id, is_active, bound_at)
  SELECT w.workspace_id, rf.framework_id, true, now()
  FROM workspace w
  CROSS JOIN regulatory_framework rf
  WHERE rf.workspace_id IS NULL
    AND rf.code = 'riksavtalen_hospitality_2024'
    AND rf.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM workspace_framework_binding b
    WHERE b.workspace_id = w.workspace_id AND b.is_active = true
  )
  ON CONFLICT DO NOTHING;
  ```
- [ ] RLS check: `workspace_framework_binding` has both JWT + API key paths; trigger writes via SECURITY DEFINER bypass

### Phase 2 — Telemetry registration (~½ h)

- [ ] Add `workspace.framework_binding_auto_seeded` event to `packages/telemetry/src/registry.ts`:
  - Interface: `{ workspace_id, framework_id, framework_code, source: 'trigger' | 'backfill' }`
  - Routing: PostHog + activity_trail
- [ ] Add event interface to `SmartoutEvent` union
- [ ] Add to `EVENT_ROUTING` map

### Phase 3 — Test (~1 h)

- [ ] pgTAP test `supabase/tests/contract-binding-auto-seed.test.sql`:
  - Insert new workspace row → assert binding row created
  - Insert workspace when no K1a framework exists → assert no binding + workspace insert succeeded
  - Verify backfill: pre-create workspace without binding, run migration, assert binding now exists
- [ ] E2E `apps/e2e/contract-employee/binding-auto-seed.spec.ts`:
  - Create fresh workspace via test seed
  - POST `/api/contracts/send` with valid template + profile
  - Assert response is 422 (missing fields) NOT 400 (binding error)
  - Assert response body matches `error: "missing_employment_data"` shape (or current generic message)

### Phase 4 — Verify + commit (~½ h)

- [ ] `pnpm turbo typecheck` passes
- [ ] `pnpm test` passes (pgTAP + Vitest)
- [ ] Manual verify: create test workspace via Supabase Local UI, query `workspace_framework_binding` → row exists
- [ ] Linear comment 📌 with migration filename + backfill row count

### Phase 5 — Closure

- [ ] Write HANDOFF-contract-binding-auto-seed.md
- [ ] Run `close-feature.sh 6`

## Acceptance Criteria

- [ ] `pnpm turbo typecheck` passes (0 new errors)
- [ ] pgTAP test green (workspace insert → binding seeded; missing K1a → graceful skip; backfill works)
- [ ] E2E test green (fresh workspace → first contract send succeeds past binding check)
- [ ] Manual verify in Supabase Local: new workspace gets binding within 100ms of INSERT
- [ ] Telemetry event registered + routed correctly (verify via emit-contract test)
- [ ] HANDOFF-contract-binding-auto-seed.md complete with decisions + learnings
- [ ] Migration is idempotent (re-running migration does not fail or duplicate)
- [ ] Linear SMA-309 closed with ✅ comment + commit SHA reference

## Risks / Open Questions

1. **K1a Riksavtalen Hospitality 2024 row may not exist yet** — if missing in current DB state, trigger fires but does nothing (silent skip). Mitigation: pre-flight grep migrations for `code='riksavtalen_hospitality_2024'` insert; if absent, seed in same migration as Phase 1.5. Document seed-source.

2. **Multi-framework workspaces** — current pattern hardcodes ONE binding per workspace (since `workspace_framework_binding.is_active=true` partial unique). If a workspace ever needs multi-binding (e.g. Riksavtalen + sectoral), this trigger needs niche-aware logic. Out of scope; document in HANDOFF as future-work.

3. **Existing workspaces without binding** — backfill is idempotent via `NOT EXISTS` check + `ON CONFLICT DO NOTHING`. Verify prod doesn't have workspaces with `is_active=false` bindings that would block backfill.

4. **Race condition** — workspace INSERT happens during finalize-workspace EF; trigger fires same transaction. Should be safe — `AFTER INSERT FOR EACH ROW` runs before commit. Verify EF doesn't manually try to INSERT binding (would conflict with trigger).

5. **Niche assumption** — hardcoding hospitality-Riksavtalen is correct for current customer base (all hospitality), but creates lock-in if non-hospitality workspace lands. Trigger function should accept workspace's `industry_code` and look up matching framework — Phase 0c+ scope, not blocker for SMA-309.

## Dispatch plan

| Agent | Phase | Model | Why |
|---|---|---|---|
| `code-architect` | 1 (design verify) | opus | Plan-vs-schema verify; confirm K1a row state + RLS pattern |
| `general-purpose` (build) | 1 + 2 + 3 | sonnet | Mechanical migration write + telemetry registration + tests |
| `code-reviewer` | 4 (pre-close) | sonnet | Verify ADR-0193 brand, trigger SECURITY mode, idempotency |
| `system-steward` | 5 (closure trust-gate) | opus | Final verdict before close-feature.sh |

## References

- Linear: SMA-309
- ADRs: 0076, 0186, 0193, 0241
- Learnings: L-0107, L-0172
- HANDOFF-employee-contract.md (council R1 finding)
- CONTRACT-PIPELINE-MAP.md (`docs/architecture/contract-service/`)
- `packages/utils/src/resolve-composition.ts:230-241` — failing call site
- `packages/telemetry/src/registry.ts` — registry add target
