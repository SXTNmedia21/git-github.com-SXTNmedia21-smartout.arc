---
title: "Plan — phase-7d-followup-migration"
status: in_progress
updated: 2026-05-17
created: 2026-05-17
module: payroll
tags: [plan, payroll, lovsen, phase-7d, migration, schema, workspace_union_binding, tariff_snapshot]
---

# Plan — phase-7d-followup-migration

> Branch: `feat/payroll-phase-7d-followup-migration` | Worktree: /home/sxtnl/dev/smartout.ai-payroll-wt-4 | Base: `campaign/payroll` | Module: payroll | Started: 2026-05-17

## Goal

Sortie 2 of 3 in Phase 7d-followup execution series. Ship migration implementing ADRs 0355 + 0353 amended + 0351 amended (all merged via Sortie 1 in commit 4474207f3). Creates new `public.workspace_union_binding` lifecycle table + `payroll.tariff_snapshot` provenance table + 2 columns on `payroll.workspace_settings` + 1 column on `public.shift_pay_calculation_event` + 3 triggers (cache sync, auto-seed, tariff-floor enforcement) + RLS + backfill for 4 live workspaces + self-test gates.

## Source of truth

- **ADR-0355** — `workspace_union_binding` table contract + cache trigger pattern (`docs/decisions/0355-workspace-union-binding-lifecycle-and-cache-trigger.md`)
- **ADR-0353 amended §A** — directs new table to `workspace_union_binding`, FK syntax correction
- **ADR-0353 amended §D** — `shift_pay_calculation_event.tariff_binding_id` column to be added in this sortie
- **ADR-0351 amended Decision Outcome** — TRIGGER (not CHECK) per L-0172; target = `public.supplement_rule`
- **ADR-0356** — delegation pattern (not directly implemented this sortie; Sortie 3 ships delegation tools)

## Migration file

Single migration file (canonical pattern per `20260525120000_workspace_framework_binding_auto_seed.sql`):

**Path:** `supabase/migrations/20260618100000_workspace_union_binding_and_tariff_floor.sql`

**Sections (Parts A-J):**
- Part A: CREATE TABLE `public.workspace_union_binding` + RLS + partial unique + APPEND-ONLY trigger
- Part B: CREATE TABLE `payroll.tariff_snapshot` + RLS
- Part C: ALTER `payroll.workspace_settings` ADD COLUMN active_union_id + active_binding_id + CHECK
- Part D: ALTER `public.shift_pay_calculation_event` ADD COLUMN tariff_binding_id (nullable)
- Part E: Cache sync trigger function + registration (L-0172)
- Part F: Auto-seed trigger function + registration (L-0172, parallel to seed_default_framework_binding)
- Part G: Tariff-floor enforcement trigger on `public.supplement_rule` (L-0172, per ADR-0351 amended)
- Part H: BOOTSTRAP-BACKFILL for 4 existing workspaces (ON CONFLICT DO NOTHING per L-0037)
- Part I: Pre-migration audit DO-block (verify zero existing supplement_rule violations BEFORE Part G fires)
- Part J: Self-test DO-block (assert all workspaces have active binding + cache populated)

## Tasks

- [ ] T1. Write migration file Parts A-J
- [ ] T2. Apply locally via `npx supabase db reset` — verify clean
- [ ] T3. Regenerate `packages/supabase/src/database.types.ts` (NO `op run` wrap per L-op-run-corrupts-gen-types)
- [ ] T4. Run golden-month test (`pnpm turbo test --filter=@smartout/payroll-calculate`) — verify determinism (cents-exact)
- [ ] T5. Update fixture `input/workspace_settings.json` only if type changes force it (keep new fields OPTIONAL)
- [ ] T6. `pnpm turbo typecheck` full pass
- [ ] T7. code-reviewer sonnet pass
- [ ] T8. Write JOURNEY + HANDOFF
- [ ] T9. close-feature.sh → merge to campaign/payroll

## Acceptance Criteria

- [ ] Migration applies clean on local Supabase
- [ ] Self-test DO-block passes (zero orphan rows)
- [ ] Cache trigger verified populating workspace_settings.active_union_id
- [ ] Tariff-floor trigger verified raising EXCEPTION on below-floor INSERT
- [ ] Golden-month test PASSES (zero kr-drift)
- [ ] Typecheck passes
- [ ] database.types.ts regenerated + committed
- [ ] All migrations follow L-0042 (timestamp + deps), L-0172 (SECURITY DEFINER + locked search_path), L-0037 (ON CONFLICT)

## Risks

- **Golden-month fixture drift: HIGH** — keep new fields OPTIONAL in WorkspaceSettings type
- **Cache trigger concurrency: MEDIUM** — same-tx row lock; explicit concurrent-write test post-migration
- **APPEND-ONLY enforcement: MEDIUM** — BEFORE UPDATE trigger blocking non-effective_to changes is unusual
- **`shift_pay_calculation_event.tariff_binding_id` audit gap: ACCEPTED** — historical NULL per ADR-0353 §D amended

## Out of scope

- Capability tool implementations (Phase 7f)
- Delegation tools (Sortie 3 per ADR-0356)
- Bridge code (Phase 7e per ADR-0350)
- 358 cert-cell re-derivation (BOOTSTRAP-BACKFILL Phase 7c follow-on)
