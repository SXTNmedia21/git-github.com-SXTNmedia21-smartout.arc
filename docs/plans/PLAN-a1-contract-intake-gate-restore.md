---
title: "Plan — A1 Contract-Intake Gate Restore"
id: PLAN_A1_CONTRACT_INTAKE_GATE_RESTORE
status: draft
layer: plan
created: 2026-04-29
updated: 2026-04-29
module: contract
tags: [contract-intake, gate-action, adr-0099, adr-0204, security, regression]
depends_on:
  - ADR_0099
  - ADR_0204
  - LEARNING_0094
---

# Plan — A1 Contract-Intake Gate Restore

> Branch: `feat/services-a1-contract-intake-gate-restore` | Worktree: `/home/sxtnl/dev/smartout.ai-services-wt-2` | Base: `campaign/services` | Module: contract | Started: 2026-04-29
>
> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

## Goal

Restore A1 gating on contract-intake mutation paths. Council 2026-04-29 audit found A1 (per `BOTSSON-SYSTEM-MAP`) was closed 2026-04-23 on `campaign/botsson-arena` (commit `3ea7fcbb`) but `campaign/services` ancestry predates SS-4/SS-5 — gate code missing. Current `campaign/services` (and this sortie) has 4 ungated RPC paths.

## Context

Verified A1 closure timeline on `campaign/botsson-arena`:

- `3ea7fcbb` (2026-04-23) — added `packages/ai/src/capabilities/contract-intake/gate.ts` (105 lines); wrapped `submitFieldGroup` + `declineIntake` with `callGateAction()`
- `daa50c06` (2026-04-24) — refactored to `gatedMutation()` orchestrator (ADR-0204 composition)
- `45a44783` (2026-04-24) — SS-5 migrated gate calls directly into `tools.ts`; deleted `gate.ts`

Branch `feat/services-a1-contract-intake-gate-restore` (this sortie) inherits from `campaign/services` which is at `b572a808`, missing all 3 commits.

Current ungated paths in `packages/ai/src/capabilities/contract-intake/tools.ts`:

| Tool | Line | RPC | Status |
|------|------|-----|--------|
| `submitFieldGroup` (identity) | 69 | `submit_own_pii` | 🔴 NO GATE |
| `submitFieldGroup` (address) | 83 | `submit_own_pii` | 🔴 NO GATE |
| `submitFieldGroup` (banking) | 92 | `submit_own_pii` | 🔴 NO GATE |
| `declineIntake` | 156 | `decline_contract_intake` | 🔴 NO GATE |

Authority seed status (verified): `supabase/migrations/20260518000000_contract_authority_seed_upsert_and_bootstrap.sql:237` explicitly EXCLUDES `contract_intake` from `capability_default_registry` per ADR-0099 §5 + Wave H closure plan. Default-allow is by-design — RLS + channel guard are real defense. Gate is advisory but MUST still be wired (ADR-0204 composition contract).

## Tasks

### Phase 1 — Reconnaissance

- [ ] Verify HEAD of `campaign/botsson-arena` matches expected post-SS-5 state (commit `45a44783` or descendant)
- [ ] Inspect current `tools.ts` on `campaign/botsson-arena` for canonical gated implementation
- [ ] Confirm `gatedMutation` import path + `callGateAction` signature current

### Phase 2 — Cherry-pick or rebuild

Decision: cherry-pick OR rebuild. Recommend **cherry-pick** SS-5 final form (single commit `45a44783`) since gate.ts was deleted in that commit (no merge conflict on deleted file).

- [ ] `git fetch origin campaign/botsson-arena`
- [ ] Inspect `git show 45a44783 -- packages/ai/src/capabilities/contract-intake/`
- [ ] Cherry-pick `45a44783` (or earlier 2-commit chain `3ea7fcbb` + `daa50c06` if SS-5 squashed/diverges)
- [ ] Resolve conflicts in `tools.ts` if branch diverged on unrelated edits

### Phase 3 — Verification

- [ ] All 4 RPC paths now call `callGateAction()` or `gatedMutation()` BEFORE write
- [ ] Validation runs BEFORE gate (defense-in-depth pattern preserved per ADR-0204)
- [ ] Gate result discriminated union matches ADR-0138 (allowed/applied/applied_with_exception/proposed/blocked)
- [ ] Channel guard at top of each tool (`ctx.channel !== "chat"` throws) — ADR-0078 sibling pattern
- [ ] Capability registration `index.ts` unchanged: `allowedChannels: ["chat"]`, `defaultAuthority: "read_only"`, `toolAuthPattern: "direct_admin"`

### Phase 4 — Tests

- [ ] Existing unit tests (if any) pass
- [ ] Add coverage for all 4 RPC paths if missing — 3 variants each (allowed/blocked/error)
- [ ] Add ADR-0134 compliance test pattern: 3 empty-context variants per tool (both empty / workspace empty / actor empty)
- [ ] Grep `actor_id:.*\?\? ""` over `packages/ai/src/capabilities/contract-intake/` returns 0 hits (ADR-0193)
- [ ] `pnpm turbo typecheck` passes 0 errors

### Phase 5 — Telemetry verification

- [ ] All 4 emit sites thread `nonEmpty(workspace_id)` + `nonEmpty(actor_id)` per ADR-0193
- [ ] `contract_intake.submitted` + `contract_intake.declined` events registered in `packages/telemetry/src/registry.ts` (verify, do not duplicate)
- [ ] Activity-trail provider receives non-empty IDs (ADR-0152 fail-fast)

### Phase 6 — Closure

- [ ] HANDOFF written: `docs/HANDOFF-a1-contract-intake-gate-restore.md`
- [ ] Decision log updated: note A1 regression cause + closure commit
- [ ] User journeys: minimal — `JOURNEY-a1-contract-intake-gate-restore.md` covering ansatt PII submission flow with gate enforced
- [ ] `close-feature.sh` clean

## Acceptance Criteria

- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] All 4 RPC paths gated (verified by grep + read)
- [ ] Tests cover gate-allowed + gate-blocked + missing-context variants
- [ ] No `actor_id ?? ""` patterns in contract-intake code
- [ ] Decision log updated with regression note + ADR-0204 reference
- [ ] HANDOFF written
- [ ] Branch merges cleanly to `campaign/services` (no conflict with `feat/services-contract-employee` parallel work)

## Risks / Open Questions

1. **Cherry-pick conflicts:** if `campaign/services` has touched `contract-intake/tools.ts` since `b572a808`, cherry-pick may conflict. Mitigation: rebuild from scratch using `45a44783` as reference if conflict.

2. **gate.ts vs inline:** SS-5 deleted `gate.ts`. If cherry-picking `daa50c06` (which adds `gate.ts`), need also `45a44783` (which removes it + inlines). Or skip middle commit, cherry-pick only `45a44783` if it's self-contained.

3. **Authority seed:** `contract_intake` is intentionally excluded from `capability_default_registry`. Gate calls will return `default-allow` until/unless seed added. Per ADR-0099 §5 this is acceptable. Document this in HANDOFF so future readers don't re-litigate.

4. **Parallel work conflict:** `feat/services-contract-employee` (sub-sortie wt-1) is active on schema work — does NOT touch `contract-intake/tools.ts`. Verify no cross-pollution before merge.

5. **Riksavtalen unrelated:** this sortie does NOT touch lov-content or framework_rule. Pure code-restoration.

## Phase Mapping

This sortie closes the **A1 prerequisite** flagged in Council 2026-04-29 verdict for Contract Module Phase 0a. After this lands:

- B6 (schema migration ADR-0233) can proceed
- B7 (capability split ADR-0234) can proceed without contract-intake risk amplification
- 0a-pre frontend sortie (parallel sibling wt-3) lands independently

## References

- `BOTSSON-SYSTEM-MAP.md` (A1 phase tag)
- ADR-0099 (gate_action canonical rule)
- ADR-0138 (tool result contract — gate outcome variants)
- ADR-0152 (activity-trail fail-fast)
- ADR-0163 (sibling fail-closed channel)
- ADR-0193 (NonEmptyString brand for telemetry IDs)
- ADR-0204 (composition orchestrator — `gatedMutation` pattern)
- L-0094 (phantom emit recurring)
- Council 2026-04-29 Contract Module Phase 0a (verdict + A1 audit finding)
- Sibling sub-sortie wt-1 `feat/services-contract-employee` (Phase 0a backend)
- Sibling sub-sortie wt-3 `feat/services-contract-0a-pre-frontend` (Phase 0a-pre frontend)
- Source commits on `campaign/botsson-arena`: `3ea7fcbb`, `daa50c06`, `45a44783`
