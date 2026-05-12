---
title: "Plan — sendmessage-adr-0287-retrofit"
feature: sendmessage-adr-0287-retrofit
spec: ../superpowers/specs/2026-05-11-sendmessage-adr-0287-retrofit.md
status: draft
updated: 2026-05-11
created: 2026-05-11
module: MODULE_COMMUNICATION
tags: [plan, adr-0287, gate-action, retrofit]
---

# Plan — sendmessage-adr-0287-retrofit

> Branch: `feat/sendmessage-adr-0287-retrofit` | Worktree: `/home/sxtnl/dev/smartout.ai-wt-2` | Module: MODULE_COMMUNICATION

**Spec:** [sendMessage ADR-0287 Retrofit](../superpowers/specs/2026-05-11-sendmessage-adr-0287-retrofit.md)
**ADR:** [ADR-0287 gate_action mandatory on all mutation capability tools](../decisions/0287-gate-action-mandatory-on-mutation-capability-tools.md)
**Pattern reference:** `packages/ai/src/capabilities/memory/gate.ts` + `tools.ts` (closest analog)

## Journeys (the contract)

- [JOURNEY-sendmessage-adr-0287-retrofit-agent-sends-message-gate-grants](../journeys/JOURNEY-sendmessage-adr-0287-retrofit-agent-sends-message-gate-grants.md) — happy path: `callGateAction` returns `granted` → channel_message INSERT proceeds → emit fires
- [JOURNEY-sendmessage-adr-0287-retrofit-agent-sends-message-gate-denies-voice](../journeys/JOURNEY-sendmessage-adr-0287-retrofit-agent-sends-message-gate-denies-voice.md) — ADR-0078 voice-channel guard: gate denies based on channel mismatch → no INSERT, no emit, descriptive error returned
- [JOURNEY-sendmessage-adr-0287-retrofit-agent-sends-message-no-authority-seed](../journeys/JOURNEY-sendmessage-adr-0287-retrofit-agent-sends-message-no-authority-seed.md) — fail-closed default-deny: workspace has no `engine_authority_config` row for `communication` capability → gate denies → no INSERT (ADR-0189 + L-0066)

## Goal

Bring `packages/ai/src/capabilities/communication/tools.ts` `sendMessage` into ADR-0287 compliance by adding `callGateAction` evaluation BEFORE the `channel_message` INSERT. Prereq for future Botsson `publishAnnouncement` capability.

## Tasks

- [ ] **Task 1 — Create `gate.ts`**
  - New file: `packages/ai/src/capabilities/communication/gate.ts`
  - Mirror sibling pattern from `memory/gate.ts` (or `legal/gate.ts` — pick the simpler one and adapt)
  - Export `callGateAction(supabase, workspaceId, profileId, args)` thunk-wrapper
  - Header docstring: ADR-0287 reference, why per-capability wrappers exist, `@authority-gate-ungated` comment for the thunk itself

- [ ] **Task 2 — Wrap `sendMessage.execute()` with gate**
  - Edit `packages/ai/src/capabilities/communication/tools.ts:127-210`
  - Add `import { callGateAction } from "./gate.js";`
  - Inside `execute()`, BEFORE the channel_message INSERT, add `callGateAction` call with args:
    - `capability: "communication"`
    - `action_type: "send_message"`
    - `channel: ctx.channel ?? "chat"` (default chat; ADR-0078 propagation)
    - `entity_type: "channel_message"`
    - `entity_id: null` (insert — row doesn't exist yet)
  - Check `gate.outcome === "granted"`; fail-close with descriptive error otherwise
  - Preserve all existing guards: channel_member check, isAiAllowedInChannel (ADR-0163), emit. Gate is ADDITIVE, before them.

- [ ] **Task 3 — Unit test**
  - New file: `packages/ai/src/capabilities/communication/__tests__/sendMessage.gate.test.ts`
  - Test cases:
    - granted → INSERT called, emit called
    - denied (mock gate result `outcome: "denied"`) → INSERT NOT called, descriptive error returned
    - awaiting_approval (four-eyes path) → INSERT NOT called, descriptive error returned
  - Use vi.mock pattern matching `apps/web/src/app/dashboard/komm/_actions/__tests__/pin-message-action.test.ts` adapted for the ai package layout

- [ ] **Task 4 — Verification**
  - `pnpm --filter @smartout/ai typecheck` zero errors
  - `pnpm --filter @smartout/ai test` all pass including new gate tests
  - `pnpm --filter @smartout/ai build` clean dist
  - HANDOFF doc with decisions + learnings

## Acceptance Criteria

- [ ] Every declared journey has `status: verified` in frontmatter
- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] Unit tests pass (granted + denied + awaiting_approval cases)
- [ ] `gate.ts` follows sibling pattern signature exactly
- [ ] sendMessage existing layers (membership, isAiAllowedInChannel, emit) all preserved
- [ ] HANDOFF written at `docs/HANDOFF-sendmessage-adr-0287-retrofit.md`

## Untouchable

- Any other capability's `tools.ts` or `gate.ts` (only communication retrofit)
- `briefing.ts`, `compile-day-brief.ts`, `compile-preclose.ts` (read-only, no mutations)
- `packages/ai/src/gate/gatedMutation.ts` core (existing infra, unchanged)
- ADR-0287 text itself
- CI script `scripts/gate-action-coverage.ts` (separate sortie)

## Sequencing

3 commits on `feat/sendmessage-adr-0287-retrofit`:
1. Task 1 — gate.ts created
2. Task 2 — sendMessage retrofit + Task 3 unit test (bundled — single commit since tests describe the retrofit behavior)
3. Task 4 — HANDOFF
