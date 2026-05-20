---
title: "Handoff — task-i1-role-compliance-a (ADR-0379a)"
status: done
updated: 2026-05-21
created: 2026-05-21
module: task-manager
tags: [handoff, task-manager, hospitality-intelligence, i1, role-compliance, adr-0379a]
---

# Handoff — task-i1-role-compliance-a (ADR-0379a)

> Branch: `feat/daily-operation-task-i1-role-compliance-a` → campaign/daily-operation. Implements the **additive half** of ADR-0379 (council-split). Zero behavior change.

## What was built & why

The task system's setup-track needs role→mandatory-protocol knowledge to live in Hospitality Intelligence (I1), not be hand-authored per workspace. Council found the spine **already existed as an orphan** (`profession_training`, `20260421100300`) and rejected the original parallel-build (`policy_scope='role'` + `protocol.is_mandatory`). This sortie revives the orphan, feeds it from I1, and exposes it — additively, with **zero behavior change** (no readiness/gate/trigger edits — those are 0379b).

**Delivered (RA1–RA3):**
- **RA1** Read-path indexes on `profession_training` (`(workspace_id, profession_id)`, `(profession_id, protocol_id)`). Migration `20260621000100`.
- **RA2a** Role-capability baseline upgraded prose → slug matrix (5 roles; 21/21 protocol slugs resolve to real `governance.sql`/`mattilsynet.sql` protocol names). `docs/engines/.../08-role-capability-profiles/restaurant-role-capability-baseline.md`.
- **RA2b** `RoleCapabilityProfile` type + optional `IndustryPackage.roleCapabilityProfiles`; `hospitalityPackage` populated. `defaultPackage`/`retail` unaffected (optional field).
- **RA2c** `fn_seed_profession_training` SECURITY DEFINER RPC (idempotent, workspace-scoped, best-effort) + `bootstrap-cascade` Step 11 `profession_seed` (hospitality-gated). Migration `20260621000200`.
- **RA3** `governance.list_mandatory_protocols_for_role` read-only tool (`profession.slug==roleSlug` → `profession_training(is_required)` → `protocol`). 4 unit tests.

## Decisions (registered in ADR-0379 §Council Outcome)
- Revive `profession_training` spine; **dropped** `policy_scope='role'` + `protocol.is_mandatory` (use `profession_training.is_required`).
- Bootstrap-only seeding; no `loadIndustryPackage` K1a runtime read (loader stays tariff-only).
- Reader is read-only, `chat`-only channel (capability ceiling carries `check_readiness` PII; voice = separate ADR).
- Join key contract: `profession.slug == roleCapabilityProfile.roleSlug` (A4 seed ⇄ A5 reader).

## Learnings
- **schema-orphan-rebuild:** grep for an existing spine before proposing a new table — `profession_training` was a complete, unused role→protocol map.
- **authority-seed-inert** (sibling L-0083): seeding `engine_authority_config` without rewiring the consumer gate is a no-op (this is why 0379b must rewire `evaluateReadinessGate`, not just seed a row).
- **commitlint:** uppercase tokens in the subject ("I1") trip `subject-case` (reported confusingly as `scope-case`). Use lowercase ("i1").

## Verification
- Guardrail audit: `git status` diff contains **zero** readiness/gate/trigger/season/policy_scope/profile_position files → zero behavior change confirmed.
- Typecheck: `@smartout/types` + `@smartout/ai` clean (0 errors).
- Tests: 4/4 governance reader unit tests pass.
- Seed: verified on Supabase Local — 5 `profession` rows; with matching protocol present, `profession_training` populated (`is_required=true`); 0 dupes on idempotent re-run; bare workspace → 0 trainings (correct best-effort).
- Both journeys `status: verified`.

## Known issues / debt
1. **Inlined profiles drift (RA2c):** Deno EF can't import `@smartout/ai` (ADR-0084) → `HOSPITALITY_ROLE_CAPABILITY_PROFILES` is duplicated inline in `bootstrap-cascade/index.ts` with a sync-obligation comment. If `hospitalityPackage.roleCapabilityProfiles` changes, update the EF copy. Consider a drift-guard test.
2. **Hospitality gate (RA2c):** Step 11 gates on active `workspace_framework_binding` rather than `industry_type` literal — correct for the hospitality-only vertical; revisit if more verticals ship.
3. **servitor protocol gap:** `servitor` maps 3 protocols; baseline prose implied a "service-safety/communication" training with no matching protocol. Documented in the matrix; add `Servicestandard-protokoll` to `governance.sql` in a content sortie.
4. **Seed inert on bare workspaces today:** live onboarding doesn't seed governance protocols yet, so `profession_training` mappings only populate once protocols exist (showcase seed, or **0379b** which installs the governance template as RPC). The `profession` rows + reader + spine are in place regardless.
5. **Reader voice channel** deferred (PII ceiling) — separate ADR if voice access wanted.

## Next steps
- **ADR-0379b** (load-bearing, council-gated): `profile_position`-INSERT auto-assign trigger + ELSE guard; install `governance.sql` as RPC + `governance_seed`; rewire `evaluateReadinessGate` → `gate_action` + backfill authority. This lights up the full role-mandatory-compliance gating.
- Promote ADR-0379a from `docs/modules/task-manager/ADR-DRAFT-...` to `docs/decisions/` (reserve number vs all branches) at acceptance.
- Optional: automated bootstrap-seed E2E; servitor protocol authoring.
