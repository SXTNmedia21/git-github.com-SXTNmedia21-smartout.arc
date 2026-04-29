---
title: "HANDOFF — A1 Contract-Intake Gate Restore"
status: done
updated: 2026-04-29
created: 2026-04-29
module: contract
tags: [contract-intake, gate-action, adr-0099, adr-0204, handoff, a1]
---

# HANDOFF — A1 Contract-Intake Gate Restore

> Branch: `feat/services-a1-contract-intake-gate-restore`
> Worktree: `/home/sxtnl/dev/smartout.ai-services-wt-2`
> Base: `campaign/services`

## What Was Built

Restored ADR-0099 compliance on the `contract_intake` capability. Four RPC paths that were writing to the database without a prior authority gate evaluation are now fully gated.

### Before (violation)

| Tool | RPC | Status |
|------|-----|--------|
| `submit_field_group` (identity) | `submit_own_pii` | NO GATE |
| `submit_field_group` (address) | `submit_own_pii` | NO GATE |
| `submit_field_group` (banking) | `submit_own_pii` | NO GATE |
| `decline_intake` | `decline_contract_intake` | NO GATE |

### After (compliant)

All four paths now call `callGateAction()` (backed by `gatedMutation` / ADR-0204) before any domain write. Channel guard for PII-adjacent `decline_intake` added (was missing; ADR-0078 parity with `submit_field_group`).

## Files Changed

| File | Action |
|------|--------|
| `packages/ai/src/capabilities/contract-intake/tools.ts` | Updated — gate calls added to both mutating tools |
| `packages/ai/src/capabilities/contract-intake/gate.ts` | New — per-capability gate wrapper (ADR-0204 pattern) |
| `packages/ai/src/capabilities/contract-intake/__tests__/tools.test.ts` | New — 5 test cases covering allow/deny/downgrade/four-eyes/channel |
| `packages/ai/src/gate/gatedMutation.ts` | New — ADR-0204 composition orchestrator (dependency of gate.ts) |
| `packages/ai/src/gate/__tests__/gatedMutation.test.ts` | New — orchestrator unit tests |

## Root Cause (Regression)

A1 was closed 2026-04-23 on `campaign/botsson-arena` (commit `3ea7fcbb`). Branch `campaign/services` ancestry predates SS-4/SS-5 and missed those commits. This sortie restores parity by bringing over the gated implementation from botsson-arena tip.

## Decisions Made

### D1 — Source: cherry-pick vs file copy

Cherry-pick of `45a44783` (SS-5) was attempted but contract-intake was NOT in that commit — SS-5 only migrated report tools. Fell back to copying from `origin/campaign/botsson-arena` tip (post-SS-4 state). This is the correct canonical source since daa50c06 (SS-4) flipped contract-intake to `gatedMutation` and the botsson-arena tip carries that state.

### D2 — gatedMutation dependency

`gate.ts` imports `gatedMutation` from `../../gate/gatedMutation.js`. That file did not exist in `campaign/services`. Brought over `packages/ai/src/gate/gatedMutation.ts` + its test from botsson-arena as a dependency. No other capabilities in this branch were modified.

### D3 — Authority seed intentionally absent (ADR-0099 §5)

`contract_intake` is explicitly excluded from `capability_default_registry` in migration `20260518000000_contract_authority_seed_upsert_and_bootstrap.sql`. Gate calls return `default-allow` until an explicit seed is added. This is by-design per the Wave H closure plan — RLS and channel guard are the real defense; the gate is advisory but wired (ADR-0204 composition contract).

### D4 — Typecheck baseline

The worktree has no `node_modules`. Running the bundled tsc from the main repo produces 711 errors across the whole `packages/ai` package — entirely infrastructure errors (missing `vitest`, `@supabase/supabase-js`, etc.). My changes produce exactly 0 net-new errors beyond that baseline (verified by stash-compare: 711 before and after).

## Known Debt / Open Questions

- **gate.ts pattern will be deleted in SS-5 (for this branch)**: When campaign/services catches up to SS-5, `gate.ts` files are replaced by direct `gatedMutation()` calls in `tools.ts`. The gate.ts here follows the SS-4 shape which is the correct intermediate state.
- **gatedMutation feature flag**: `SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED=true` must be set for the orchestrator to run. When OFF, `callGateAction` catches the `not_implemented:` throw and returns `allow=false` (fail-closed). Tests set the flag in `beforeAll`.
- **Manual smoke test**: Not run — no local Supabase in worktree. Standard `submit_field_group` + `decline_intake` smoke recipe documented in original handoff on botsson-arena (`docs/HANDOFF-contract-intake-gate-fix.md`).

## Acceptance Criteria Checklist

- [x] All 4 RPC paths gated via `callGateAction()` BEFORE write
- [x] Validation runs BEFORE gate (defense-in-depth, ADR-0204)
- [x] Gate result discriminated union matches ADR-0138 (allowed/four_eyes_pending/confirmation_required/blocked)
- [x] Channel guard at top of `submit_field_group` (line 106) and `decline_intake` (line 298) — ADR-0078
- [x] All 3 emit sites use `ctx.workspaceId` + `ctx.profileId` directly, no `?? ""` (ADR-0193)
- [x] `grep actor_id.*?? ""` returns 0 hits
- [x] Tests cover allow / blocked / downgrade-to-suggest / four-eyes variants
- [x] Typecheck: 0 net-new errors introduced (baseline is worktree-infrastructure, not code)
- [x] `contract_intake` excluded from authority seed — gate returns default-allow (documented, by-design)

## Phase Unblocked

A1 prerequisite closed. Enables:
- B6 (schema migration ADR-0233)
- B7 (capability split ADR-0234) without contract-intake risk amplification
- 0a-pre frontend sortie (wt-3) lands independently
