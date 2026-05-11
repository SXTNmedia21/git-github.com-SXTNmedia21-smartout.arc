---
title: HANDOFF — sendMessage ADR-0287 Retrofit
feature: sendmessage-adr-0287-retrofit
status: ready-for-close
created: 2026-05-11
updated: 2026-05-11
module: MODULE_COMMUNICATION
tags: [handoff, adr-0287, gate-action, retrofit]
---

# HANDOFF — sendMessage ADR-0287 Retrofit

## Summary

`packages/ai/src/capabilities/communication/tools.ts` `sendMessage` now calls `callGateAction` BEFORE the `channel_message` INSERT. Brings communication capability into ADR-0287 compliance (gate_action mandatory on all mutation capability tools). Closes Wave A HANDOFF deferred sortie #1. Prereq for any future Botsson `publishAnnouncement` capability tool.

## What was built

3 commits on `feat/sendmessage-adr-0287-retrofit`:

```
3dc9a4c26 feat(communication): retrofit sendMessage with callGateAction per ADR-0287
495803d72 docs(sendmessage-adr-0287-retrofit): declare plan + 3 journeys
7982b75a1 docs(specs): sendmessage-adr-0287-retrofit spec stub
```

### Files added

- `packages/ai/src/capabilities/communication/gate.ts` — per-capability `callGateAction(supabase, workspaceId, profileId, args)` wrapper. Mirrors `legal/gate.ts` pattern (direct `supabase.rpc("gate_action", ...)` call). 91 lines. Marked `@authority-gate-ungated` in body so static analysis recognizes the thunk wrapper.
- `packages/ai/src/capabilities/communication/__tests__/sendMessage.gate.test.ts` — 3 test cases covering granted / channel-denied (voice) / missing-seed default-deny.

### Files modified

- `packages/ai/src/capabilities/communication/tools.ts` — `sendMessage.execute()` gains 26-line gate call at line 147, BEFORE the existing channel_member membership check. Fails-closed on `gate.allow !== true` or `gate.channelAllowed === false`. Voice-channel denial returns user-friendly Norwegian copy matching `use-komm-tools.ts:215-221` pattern.

## Decisions made

1. **Mirror `legal/gate.ts` not `memory/gate.ts`.** Memory delegates to `gatedMutation()` orchestrator. Legal calls `supabase.rpc("gate_action", ...)` directly. Communication adopts the direct-call pattern because (a) `sendMessage` doesn't need four-eyes orchestration today, (b) simpler review surface, (c) matches L-0066 fail-closed semantics without extra wrapper layer.
2. **Gate is ADDITIVE to existing layers.** ADR-0163 `isAiAllowedInChannel` (Layer 2) + channel_member membership check (Layer 3) are PRESERVED below the gate. ADR-0287 governs capability-level authority; ADR-0163 governs channel-policy; RLS governs row-level membership. Three orthogonal controls.
3. **Real gate return shape `{ allow: boolean, channelAllowed: boolean }`.** Plan assumed `{ outcome: "granted" | "denied", reason?, channel_denied? }` (closer to gatedMutation). Sibling capabilities' actual `callGateAction` returns boolean fields. Subagent adapted code + tests to match real shape. Three journeys still cover same semantic states.
4. **`ctx.channel ?? "chat"` default.** ADR-0078 voice-channel-guard semantics — when channel context not provided, assume chat (least-privileged write surface). NEVER default to voice (PII-prone broadcast).
5. **Voice-deny copy matches existing pattern.** When gate denies via `channelAllowed: false` OR `reason === "channel-restricted"`, returns Norwegian copy: `"Cannot send messages over voice channel. Switch to chat to send a message."` (mirrors `use-komm-tools.ts:215-221`). Consistent UX across voice-deny paths.

## Learnings

- **Sibling pattern is per-capability `gate.ts`, NOT shared.** Each capability (memory, legal, contract-intake, payroll, tips, availability, communication, governance, journey-authoring, onboarding, shift-lifecycle, mission, personal) has its own `gate.ts` exporting `callGateAction`. The shared `packages/ai/src/gate/gatedMutation.ts` orchestrator is INDIRECTLY used by some (memory) and BYPASSED by others (legal). Pattern allows per-capability action_type defaults + type narrowing without forcing every capability through the heavier orchestrator.
- **Fresh worktrees need dist build chain BEFORE @smartout/ai typecheck.** Stop-hook scoped typecheck fails on `@smartout/ai` until `@smartout/utils + @smartout/journey-ir + @smartout/types + @smartout/telemetry` dists exist. Confirmed pattern from prior memory `learning_stage_engine_subpath_imports.md` (2026-05-06). Ran `pnpm --filter @smartout/utils --filter @smartout/journey-ir --filter @smartout/types --filter @smartout/telemetry build` after `pnpm install --frozen-lockfile`.
- **`callGateAction` thunk-wrapper marker.** Body comment `// @authority-gate-ungated — thunk-wrapper. All callers of callGateAction()...` is REQUIRED so the future ADR-0287 CI script (`gate-action-coverage.ts`) recognizes the wrapper as the gate, not a bypass. Without the comment, the wrapper's body shows `supabase.rpc("gate_action", ...)` with no upstream gate call — AST walker would flag it.

## Known issues / debt

- **ADR-0287 CI script `gate-action-coverage.ts` not yet built.** ADR-0287 §"Ship order" item 1 mandates an AST walker that fails CI on missing gate_action calls. Without it, the retrofit relies on review discipline. Separate sortie `feat/gate-action-coverage-ci` should build the script + promote ADR-0287 from `proposed` → `accepted` simultaneously.
- **Pre-existing `registry-uniqueness.test.ts` 2/N failures.** Discovered during T4 test verification; pre-existing on `feat` branch's base (development). Out of scope.
- **No live integration test.** Unit tests mock supabase + callGateAction + emit. Live test would require seeded `engine_authority_config` row + dispatched agent invocation. Manual smoke (optional) is the closest live verification.

## Next steps (deferred sorties)

1. **`feat/gate-action-coverage-ci`** — Build the AST walker per ADR-0287 §"Ship order" item 1. Promote ADR-0287 to `accepted`. CI gate prevents future capability tools from skipping callGateAction.
2. **`feat/botsson-publishannouncement-capability`** — Now unblocked. Adds capability tool that wraps the Wave A `useSendAnnouncement` flow for agent-initiated announcement publishing. Per ADR-0173 frozen-4 boundaries + ADR-0287 + ADR-0163 — needs Council on tool authority shape (suggest vs. confirm, voice restriction, target_profile_ids exposure to agent).
3. **`feat/communication-gate-shape-typed`** — Optional ergonomic improvement: export `GateOutcome` type from `gate.ts` so call sites get typed `gate.allow` + `gate.channelAllowed` instead of inferring from runtime. Low priority polish.

## Verification results

| Gate | Outcome |
|---|---|
| `pnpm --filter @smartout/ai typecheck` | 0 errors |
| `pnpm --filter @smartout/ai exec vitest run src/capabilities/communication/__tests__/sendMessage.gate.test.ts` | 3/3 pass — granted + channel-denied + missing-seed |
| `pnpm --filter @smartout/ai build` | clean dist (after upstream deps built) |
| Manual smoke | Pontus pre-close |

## Close-feature command

```bash
cd /home/sxtnl/dev/smartout.ai-wt-2
~/.claude/scripts/close-feature.sh 2
```

All 3 journeys remain `status: draft` until Pontus runs manual smoke + flips them to `verified`. Code path verified by unit tests; manual smoke verifies the live agent path against seeded workspace.
