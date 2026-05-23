---
title: "Plan — task-i1-role-compliance-a"
feature: task-i1-role-compliance-a
spec: docs/superpowers/specs/2026-05-21-task-i1-role-compliance.md
status: draft
updated: 2026-05-21
created: 2026-05-21
module: task-manager
tags: [plan]
---

# Plan — task-i1-role-compliance-a

> Branch: `feat/daily-operation-task-i1-role-compliance-a` | Worktree: `~/dev/smartout.ai-daily-operation-wt-2` | Base: `campaign/daily-operation` | Module: task-manager

**Spec:** [Task Manager — Role-Mandatory Compliance + Starter Routines into Hospitality Intelligence](../superpowers/specs/2026-05-21-task-i1-role-compliance.md)
**ADR:** [ADR-DRAFT-0379 §Council Outcome](../modules/task-manager/ADR-DRAFT-0379-role-mandatory-compliance-i1.md) — build the **0379a** half only.
**Build plan:** [BUILD-PLAN §Council-revised phasing](../modules/task-manager/BUILD-PLAN-i1-role-compliance.md) — RA1–RA3.

## Journeys (the contract)

- [JOURNEY-task-i1-role-compliance-a-admin-bootstrap-seeds-role-protocols](../journeys/JOURNEY-task-i1-role-compliance-a-admin-bootstrap-seeds-role-protocols.md) — Finalizing a hospitality workspace seeds role→mandatory-protocol mappings from I1.
- [JOURNEY-task-i1-role-compliance-a-botsson-answers-role-requirements](../journeys/JOURNEY-task-i1-role-compliance-a-botsson-answers-role-requirements.md) — Manager/employee asks Botsson what a role must complete; reader returns the role's mandatory protocols.

## Goal

Revive the orphaned `profession_training` spine as the canonical role→mandatory-protocol map, seed it from Hospitality Intelligence at bootstrap, and expose it via one read tool — **additive, zero behavior change** (no trigger/gate/readiness edits — those are 0379b).

## Tasks

### RA1 — Revive `profession_training` as the spine
- [ ] Confirm `profession`, `profession_industry`, `profession_training` schema (`20260421100300_add_profession_system.sql:69-80`) — `profession_id, protocol_id, is_required, weight, workspace_id`.
- [ ] Verify RLS + that there are no consumers today (orphan). Add index for `(workspace_id, profession_id)` read path if missing.
- [ ] Do NOT add `policy_scope` values or `protocol.is_mandatory` (dropped by council).

### RA2 — I1 seeds the spine at bootstrap
- [ ] Upgrade `docs/engines/industri-inteligence/hospitalety/08-role-capability-profiles/restaurant-role-capability-baseline.md` prose → structured slug matrix (roleSlug, positionSlugs[], mandatoryProtocolSlugs[], readySignal). Slugs MUST match protocol names in `supabase/templates/restaurant/governance.sql`.
- [ ] Add `RoleCapabilityProfile` type to `packages/types/src/industry.ts`; optional `roleCapabilityProfiles?` on `IndustryPackage`.
- [ ] Populate `hospitalityPackage` (`packages/ai/src/industry/packages/hospitality.ts`); `defaultPackage` omits.
- [ ] Bootstrap seed: write `profession` + `profession_training` rows from I1 profiles when finalizing a hospitality workspace. **Bootstrap-only** — no `loadIndustryPackage` K1a runtime read. Confirm ADR-0240-clean delegation (governance-adjacent tables, not via `task` capability).

### RA3 — Reader tool
- [ ] Add `list_mandatory_protocols_for_role(roleSlug)` to the `governance` capability (read-only) — resolves role/position → `profession_training` mandatory protocols. Register intent enum + system-prompt line (ADR-0112). Read-only → default-allow acceptable (confirm).
- [ ] Mirror on voice if applicable (read-safe; ADR-0078).

### Guardrails (council conditions — do NOT cross into 0379b)
- [ ] Do NOT touch `evaluateReadinessGate`, `check_readiness` semantics, `season.get_readiness`, or the live auto-assign trigger.
- [ ] No `policy_scope` enum change, no `protocol.is_mandatory`, no `profile_position`-INSERT trigger.

## Acceptance Criteria

- [ ] Every declared journey has `status: verified` in frontmatter
- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] `profession_training` is populated on a fresh hospitality workspace finalize (verified on Supabase Local)
- [ ] `list_mandatory_protocols_for_role('bartender')` returns bartender mandatory protocols; unknown role → empty, not error
- [ ] Zero behavior change verified: readiness gate + shift publish/approve identical pre/post
- [ ] Decision log updated; ADR-0379a promoted to `docs/decisions/` (reserve number vs all branches)
- [ ] At least one E2E/integration test per journey (recommended)
