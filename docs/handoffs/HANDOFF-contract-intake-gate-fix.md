---
title: "HANDOFF — Contract Intake Gate Fix (Phase A1)"
status: done
updated: 2026-04-23
created: 2026-04-23
module: ai-agent
tags: [handoff, contract-intake, authority, gate-action, adr-0099, adr-0196, campaign-a1]
---

# HANDOFF — Contract Intake Gate Fix (Phase A1)

> **Campaign:** `campaign/botsson-arena`
> **Branch:** `feat/botsson-arena-contract-intake-gate-fix`
> **Plan:** `docs/plans/PLAN-contract-intake-gate-fix.md`
> **SYSTEM MAP update:** `docs/architecture/BOTSSON-SYSTEM-MAP.md:208` — contract_intake 🔴 → 🟢.

## Summary

Closes the live ADR-0099 violation where `contract_intake` mutation tools wrote PII directly without calling `gate_action`. Every other capability already gates — this was the last D2 orphan. Now `submit_field_group` and `decline_intake` both call `callGateAction()` before mutating and honor `allow`, `downgrade_to`, and `requires_four_eyes` per ADR-0101.

ADR-0196 Invariant 13 (every mutation must call the gate, even at `autonomous` defaults) is now upheld for this capability.

## Before / After

### Before (pre-commit)
`packages/ai/src/capabilities/contract-intake/tools.ts` on `campaign/botsson-arena@3e2ee327`:

- **Line 69** — `userClient.rpc("submit_own_pii", { p_workspace_id, p_field_group: "identity", … })` fired directly after local validation. No authority check. No `gate_evaluation` audit row.
- **Line 83** — second `submit_own_pii` call for address fields. Same issue.
- **Line 92** — banking-group `submit_own_pii` call. Same issue.
- **Line 156** — `ctx.supabaseAdmin.rpc("decline_contract_intake", …)` with no preceding gate.
- **Line 166-173** — `engine_state_step.update({ status: "failed" })` ungated.

Impact: A workspace with `engine_authority_config(capability='contract_intake', level='disabled')` would have its PII write **silently succeed** — the RPC path was never consulted. No audit trail of authority decisions. ADR-0101 four-eyes on PII could not be enforced.

### After
`packages/ai/src/capabilities/contract-intake/` on `feat/botsson-arena-contract-intake-gate-fix`:

- **New file `gate.ts`** — thin wrapper around `gate_action` RPC. Mirrors `packages/ai/src/capabilities/shift-lifecycle/gate.ts` lines 41-89. Fail-closed on RPC errors (per Phase 1 ADR-0099 contract).
- **`tools.ts:138`** — `callGateAction(ctx.supabaseAdmin, ctx.workspaceId, ctx.profileId, { capability: "contract_intake", channel, actionType: "submit_field_group", entityId: ctx.profileId })` now precedes all three `submit_own_pii` calls. `ctx.profileId` is the entity because the data subject IS the employee.
- **`tools.ts:306`** — same pattern for `decline_intake`, action_type `"decline_intake"`.
- **Four-eyes branch** — `gate.reason === "four_eyes_required"` returns `{ allowed: false, outcome: "four_eyes_pending", approvers_needed, approvers_present, user_message }` without mutating.
- **Downgrade branch** — `gate.downgradeTo === "suggest"` returns `{ allowed: false, outcome: "confirmation_required", user_message }` without mutating. The LLM's prompt template is expected to ask the user to confirm and retry.
- **Deny branch** — any other `allow=false` returns `{ allowed: false, outcome: "blocked", reason, user_message }` without mutating.
- **Allow branch** — downstream RPCs fire as before, then the tool returns `{ allowed: true, outcome: "applied", saved/declined, group/…, complete, user_message }`. Legacy fields (`saved`, `group`, `complete`, `declined`) retained for prompt-template backward compat.

The existing ADR-0078 layer-3 channel guard at `tools.ts:103` and `tools.ts:290` is retained (defence-in-depth — `gate_action` also enforces channel, but we keep the early bail-out).

## Files Changed

```
packages/ai/src/capabilities/contract-intake/gate.ts                      (new, 97 lines)
packages/ai/src/capabilities/contract-intake/tools.ts                     (modified)
packages/ai/src/capabilities/contract-intake/__tests__/tools.test.ts      (new, 228 lines)
docs/architecture/BOTSSON-SYSTEM-MAP.md                                   (🔴 → 🟢 + note)
docs/HANDOFF-contract-intake-gate-fix.md                                  (this file)
```

No migrations. No new ADRs. No runtime inserts into `engine_authority_config` — default-allow is ADR-0099 §5-compliant, per the plan's explicit instruction to skip the seed.

## Decisions Made

1. **Per-capability `gate.ts`, not a shared helper.** Matched the existing pattern (`shift-lifecycle/gate.ts` and `journey/gate.ts` are already per-capability). Keeps test doubles local and allows contract-intake to diverge later (e.g. tighter posture for banking vs identity) without touching unrelated capabilities. Noted in-file.

2. **ADR-0138 discriminated-union shape — additive, not replacing legacy JSON keys.** ADR-0138 is still `draft` and no capability has migrated yet. The existing LLM prompt templates and tests pattern-match on `saved`, `declined`, `group`, `complete`. Ripping those out would cascade into prompt changes far outside this sortie. I added the ADR-0138 fields (`allowed`, `outcome`, `user_message`) alongside the legacy fields — future tools can key off `outcome` without breaking today's callers. When ADR-0138 is accepted and a codemod lands (Wave 2B), the legacy keys can be removed.

3. **`entityId = ctx.profileId` for both tools.** The employee is the data subject for their own PII intake — scoping four-eyes approvals per-profile means one approver's thumbs-up on employee A's banking does not auto-approve employee B. If a future workspace decides to gate by `employment_contract_id` instead, this is a one-line change.

4. **`gate_action` fires before the `supabaseUser` presence check.** A workspace with `level='disabled'` should receive `outcome: "blocked"` regardless of whether the user client happens to be attached to the request. Fail-fast on authority is cleaner than fail-fast on session plumbing.

5. **Validation precedes the gate.** Modulus-11 and regex checks run BEFORE `gate_action` so the audit trail (`gate_evaluation` rows) does not get polluted by trivially-malformed submissions. A user who fat-fingers a personnummer should get a validation message, not a gate-eval row.

6. **`declineIntake` gets its own channel guard mirror.** The original had no tool-level channel guard in decline — only submit had one. I added parity because declining is still a PII-adjacent governance event and voice channels are still forbidden (ADR-0078). Tool-level, capability `allowedChannels`, and gate-level all align now.

## Learnings

1. **Shift-lifecycle template was clean but the test doubles do not port trivially.** The shift-lifecycle test builder is very capable (supports `.update()`, `.then()` thenable chains) but overkill here. I wrote a simpler double that only returns the `rpc` calls it captures, because `submit_field_group` does not do chained table operations in the happy paths we test. If a future test needs `engine_state_step` assertions, the shift-lifecycle helper can be copied or refactored into a shared util.

2. **ADR-0138's "discriminated union with mandatory `user_message`" is good direction, but the plan's "minimal shape compatible with the ADR draft" is the right interpretation for a single-sortie fix.** Fully conforming to ADR-0138 would require prompt-template rewrites in `packages/ai/src/prompts/` which is out of scope for Phase A1. Keeping the legacy fields + adding the ADR-0138 keys lets this land without breaking prompts AND unblocks future prompt migration.

3. **Worktree hygiene — the agent worktree (`worktree-agent-a75a877b`) was sitting on an old `preview` SHA (1f5bf480), three commits behind `campaign/botsson-arena`.** That meant `docs/plans/PLAN-contract-intake-gate-fix.md` did not exist in my checkout on session start. Solved by `git checkout -B feat/botsson-arena-contract-intake-gate-fix campaign/botsson-arena` — the standard sub-sortie pattern. Worth flagging because other agent worktrees may drift the same way; a `/sync` at agent-worktree init would prevent the surprise.

4. **Node_modules in fresh agent worktrees is not pre-populated.** First `npx tsc` / `npx vitest` attempts fail with cryptic "Cannot find package" errors until `pnpm install` runs. After `pnpm install`, `pnpm turbo build --filter=@smartout/ai...` is required before vitest can resolve `@smartout/telemetry/server` and `@smartout/utils` (both point at `./dist/...` in their exports maps). Future agents running in this worktree should be reminded.

## Known Issues / Debt

- **ADR-0138 full migration still pending.** The return shape carries legacy + ADR-0138 fields. When Wave 2B rewrites prompt templates, the legacy fields can be removed from the Applied/Declined branches; the gate-outcome variants already match ADR-0138 shape.
- **ESLint warning at `tools.ts:357` (pre-existing).** The `engine_state_step.update(...)` in `declineIntake` trips `smartout/no-direct-supabase-write` (ADR-0091 WP3 migration). This warning existed on `campaign/botsson-arena` before this sortie; I did NOT introduce it and did NOT fix it — that belongs to the broader `cascade_gate_write` migration (Phase B1 dual-gate reconciliation).
- **`engine_state_step` update is ungated by `cascade_gate_write`.** The `gate_action` call at the top of `declineIntake` now blocks unauthorized declines, but the downstream `engine_state_step.update` is not itself routed through the cascade gate. Not in scope for A1 per the plan ("out: restructuring contract-intake to use a Server Action … that's Phase B1 dual-gate reconciliation").
- **Preview-environment smoke test not executed.** I did not run the onboarding happy-path against a live preview DB — Node_modules bootstrap + typecheck + unit tests consumed the available cycles and the worktree has no Supabase Local running. Verified instead via 4 unit tests that exercise all four gate outcomes. Manual smoke test recipe in the next section.

## Manual Smoke Test (for Orchestrator before merge)

1. `git checkout feat/botsson-arena-contract-intake-gate-fix`
2. `pnpm install && pnpm --filter @smartout/telemetry build && pnpm --filter @smartout/utils build`
3. `pnpm --filter @smartout/ai test -- src/capabilities/contract-intake` → expect 4 passed.
4. Boot dev stack (`/start` or the usual path). In a workspace with NO `engine_authority_config` row for `contract_intake` (default-allow), run the onboarding flow and submit a PII group via Botsson chat. Expect: success, legacy `{ saved: true, group, complete }` parsed by the prompt template.
5. Insert `engine_authority_config(workspace_id, capability='contract_intake', level='disabled')` for that workspace. Retry the PII submit. Expect: `{ allowed: false, outcome: "blocked", reason, user_message }`, no `submit_own_pii` RPC, one new row in `gate_evaluation`.
6. Revert the seed row. System returns to default-allow.

## Acceptance Criteria (per plan)

| Criterion | Status |
|---|---|
| `grep -n "gate_action" packages/ai/src/capabilities/contract-intake/` returns matches in `gate.ts` + `tools.ts` | ✅ |
| Tests: allow / deny / downgrade-to-suggest / four-eyes-required | ✅ (4 tests, all pass) |
| `pnpm turbo typecheck` passes repo-wide | ✅ |
| `pnpm --filter @smartout/ai test` passes | ✅ (31 files / 265 tests) |
| `pnpm --filter @smartout/ai lint` passes (0 errors) | ✅ (1 pre-existing warning, not introduced by this change) |
| Invariant 13 — every `.insert/.update/.delete/.rpc(mutation)` in `tools.ts` preceded by `callGateAction` | ✅ (grep-verified) |
| Preview onboarding smoke | ⚠ (deferred to Orchestrator — smoke recipe documented above) |
| HANDOFF written | ✅ (this file) |

## Next Steps

- **Orchestrator:** merge `feat/botsson-arena-contract-intake-gate-fix` into `campaign/botsson-arena` after manual smoke. Tick A1 in `docs/plans/CAMPAIGN-botsson-arena.md` line 61.
- **ADR-0138 migration (Wave 2B):** when prompt templates are rewritten to key off `outcome`, drop the legacy JSON fields in `tools.ts` lines ~266-272 (submit applied branch) and ~385-389 (decline applied branch).
- **cascade_gate_write migration (Phase B1):** replace the raw `supabaseAdmin.rpc("decline_contract_intake", ...)` and `engine_state_step.update(...)` with `gatedUpdate`/`gatedInsert` per ADR-0091. That clears the remaining ESLint warning at line 357.
