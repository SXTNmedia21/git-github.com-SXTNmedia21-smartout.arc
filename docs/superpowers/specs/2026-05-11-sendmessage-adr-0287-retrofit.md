---
title: sendMessage ADR-0287 Retrofit
status: approved
created: 2026-05-11
updated: 2026-05-11
module: MODULE_COMMUNICATION
tags: [adr-0287, gate-action, capability-tool, communication, retrofit]
---

# sendMessage ADR-0287 Retrofit

> Light spec pointer — implementation pattern proven in 11 precedent capabilities.

## What

Add `callGateAction` evaluation to `packages/ai/src/capabilities/communication/tools.ts` `sendMessage` BEFORE the `channel_message` INSERT. Brings communication capability into ADR-0287 compliance (gate_action mandatory on all mutation capability tools).

Concretely:
1. Create `packages/ai/src/capabilities/communication/gate.ts` mirroring sibling pattern (`memory/gate.ts`, `legal/gate.ts`, `contract-intake/gate.ts`, etc.).
2. Modify `sendMessage.execute()` to call `callGateAction(supabase, workspaceId, profileId, args)` before the INSERT. Fail-close on denial.
3. Preserve existing layers: ADR-0163 channel guard via `isAiAllowedInChannel`, channel-member check, telemetry emit. Gate evaluation is additive, not replacement.

## Why

ADR-0287 §Rule: "Every capability tool whose `execute()` performs a state mutation MUST call `gate_action` (directly or via `mutateWithGate()`) BEFORE the mutation."

`sendMessage` is the LAST mutation tool in communication capability without gate_action evaluation. Documented in HANDOFF of Nyheter Engagement Wave A as deferred sortie #1 — prereq for adding any future Botsson `publishAnnouncement` capability tool. Without this retrofit, building `publishAnnouncement` would either inherit the precedent debt OR force concurrent retrofit (scope creep).

## Sources of truth

- **ADR-0287:** `docs/decisions/0287-gate-action-mandatory-on-mutation-capability-tools.md` (proposed)
- **Pattern precedents:**
  - `packages/ai/src/capabilities/memory/gate.ts` + `tools.ts` — closest analog (similar single-mutation tool shape)
  - `packages/ai/src/capabilities/legal/gate.ts` + `tools.ts`
  - `packages/ai/src/capabilities/contract-intake/gate.ts` + `tools.ts`
  - `packages/ai/src/capabilities/availability/gate.ts`, `tips/gate.ts`, `payroll/gate.ts` — sibling gate.ts files
- **Existing target file:** `packages/ai/src/capabilities/communication/tools.ts:127-210` (sendMessage)
- **Wave A HANDOFF deferred sortie #1:** `docs/HANDOFF-nyheter-engagement-wave-a.md`

## Constraints

- **Single mutation tool in scope.** Verified `briefing.ts`, `compile-day-brief.ts`, `compile-preclose.ts` are read-only — zero `.insert/.update/.delete/.rpc` calls. Only `sendMessage` retrofitted.
- **No ADR amendment.** ADR-0287 specifies pattern; this sortie implements it. No new decisions.
- **Preserve all existing gates.** Membership check + ADR-0163 channel_ai_policy + emit remain in place. callGateAction is added BEFORE them as the capability-level gate.
- **Fail-closed on gate denial.** No INSERT, no emit. Return descriptive error string for agent to surface to user.
- **No CI script.** ADR-0287 §"Ship order" item 1 (`gate-action-coverage.ts` AST walker) is a SEPARATE follow-up sortie. This retrofit closes one call site; the CI script enforces all call sites going forward.

## Out of scope

- ADR-0287 CI coverage script (`scripts/gate-action-coverage.ts`) — separate sortie `feat/gate-action-coverage-ci`
- Botsson `publishAnnouncement` capability — separate sortie after this lands
- Retrofitting other capabilities (none remaining per repo grep)
- `mutateWithGate()` typed wrapper — ADR-0287 §Decision Outcome marks it OPTIONAL ("Not mandatory"); communication adopts the existing `callGateAction` pattern for minimal blast radius

## Acceptance

- `pnpm turbo typecheck` zero errors
- New `gate.ts` follows sibling pattern (callGateAction signature matches `memory/gate.ts` or `legal/gate.ts`)
- `sendMessage.execute()` calls callGateAction BEFORE the channel_message INSERT
- Unit test verifies: (a) gate granted → message sent; (b) gate denied → no INSERT + descriptive error returned
- Existing tests still pass
