---
title: "Plan — Contract Intake Gate Fix (Phase A1)"
status: ready
updated: 2026-04-22
created: 2026-04-22
module: ai-agent
tags: [plan, contract-intake, authority, gate-action, adr-0099, campaign-a1]
---

# Plan — Contract Intake Gate Fix

> **Campaign:** `docs/plans/CAMPAIGN-botsson-arena.md` — Phase A, item A1
> **Priority:** Critical. Live ADR-0099 violation.

## Goal

Koble eksisterende `contract_intake` mutation-tools til eksisterende `gate_action` RPC. `shift_lifecycle` gjør dette allerede via `callGateAction()`-helper i `gate.ts:41-89` — vi kopierer mønsteret. Ingen ny RPC, ingen ny struktur, kun synkronisering av `contract_intake` med resten av capabilities.

## Context

`packages/ai/src/capabilities/contract-intake/tools.ts` currently calls `userClient.rpc("submit_own_pii", ...)` directly at lines 114, 157, 206, 223 **without a preceding `gate_action` call**. This is a live violation of ADR-0099 (Unified Authority Gate). Every other capability that mutates state (`shift_lifecycle`, etc.) calls `callGateAction()` first; contract-intake is the only orphan.

Impact:
- PII writes land without authority evaluation.
- No row in `gate_evaluation` → no audit trail.
- If a workspace ever disables `contract_intake` via `engine_authority_config(level='disabled')`, the tool silently continues to mutate (default-allow bypass path since gate is never called).

This was identified in the Wave 2 gate-client council (2026-04-18) as a "D2 orphan".

## Scope

**In:**
1. Add `gate_action` call to `submitFieldGroup` and `declineIntake` in `tools.ts`.
2. On `allow=false`, return a typed tool result describing the block (per ADR-0138 discriminated union, which is in-flight — use the shape proposed in the ADR draft).
3. On `downgrade_to='suggest'`, return a tool result that asks the user to confirm before the actual mutation fires.
4. Unit tests: disabled capability blocks, read-only downgrade blocks mutation, normal allow passes through.
5. E2E: onboarding intake happy path still works on preview branch.

**Out:**
- Restructuring contract-intake to use a Server Action (that's Phase B1 dual-gate reconciliation — B1 may later consolidate this path).
- Changing the underlying `submit_own_pii` RPC (it stays; only the gating layer is added in front).

## Tasks

- [ ] Read the gate-client wrapper used by `shift_lifecycle` (`packages/ai/src/capabilities/shift-lifecycle/gate.ts:41-89`) — it's the template.
- [ ] Add `gate.ts` under `contract-intake/` with a `callGateAction()` helper that calls RPC `gate_action(workspace_id, capability='contract_intake', channel='chat', actor_profile_id, action_type, entity_id?)`.
- [ ] Modify `tools.ts:submitFieldGroup` — call gate before RPC. Honor `downgrade_to` + `allow` + `reason`.
- [ ] Modify `tools.ts:declineIntake` — same pattern.
- [ ] Add 4 unit tests: allow / deny / downgrade-to-suggest / four-eyes-required.
- [ ] Seed `engine_authority_config` with default row for `contract_intake` per workspace (if not present) — decide: add to migration or leave to runtime default-allow? Default-allow is fine per ADR-0099 §5; skip seed.
- [ ] Run preview branch smoke: onboarding flow still submits PII groups.
- [ ] Typecheck + lint pass.

## Acceptance Criteria

- [ ] `grep -n "gate_action" packages/ai/src/capabilities/contract-intake/` returns matches in `gate.ts` + `tools.ts`
- [ ] Integration test: workspace with `contract_intake` authority `level='disabled'` blocks `submitFieldGroup`, writes denial row in `gate_evaluation`
- [ ] Integration test: workspace with no config row (default-allow) still passes
- [ ] `pnpm turbo typecheck` passes
- [ ] Preview onboarding flow submits PII successfully
- [ ] HANDOFF document written with before/after file:line citations

## Risks

1. **Break onboarding flow** — default-allow preserves status quo, but a mis-wired gate call could deny by accident. Mitigation: no seed row + `allow=true` on missing config (already gate_action default per ADR-0099 §5).
2. **Four-eyes on PII** — contract-intake may be flagged `requires_four_eyes=true` in some workspaces. Make sure the tool result communicates "needs approver" clearly; don't silently return allow=false.
3. **Channel enforcement overlap** — tool-level guard at `tools.ts:31` already blocks non-chat. Gate also checks channel. Keep both (defence-in-depth) — don't remove the tool guard.

## Dependencies

- None for implementation. ADR-0138 (discriminated union for tool results) is proposed but not required — this plan uses a minimal shape compatible with the ADR draft.

## Post-Implementation

- [ ] Update `CAMPAIGN-botsson-arena.md` checklist A1 → complete
- [ ] Move plan to `docs/plans/completed/` with HANDOFF
- [ ] Log learning if anything surprising surfaced during implementation
