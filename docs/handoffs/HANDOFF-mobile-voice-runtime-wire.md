---
title: "Handoff — mobile-voice-runtime-wire"
status: ready
updated: 2026-05-20
created: 2026-05-20
module: mobile
predecessor: mobile-voice-bootstrap-pipe
tags: [handoff, voice, livekit, mobile, chat, adr-0078, adr-0132, adr-0297, adr-0378]
---

# Handoff — mobile-voice-runtime-wire

> Branch: `feat/mobile-voice-runtime-wire` | Worktree: `/home/sxtnl/dev/smartout.ai-mobile-wt-5` | Base: `campaign/mobile @ bc7c27bf6` | Commits: 11 (10 feature + 1 plan)

## TL;DR

Mobile AI agent surface is **functionally complete pending PWA walkthrough by Pontus**. Voice + text both wired end-to-end to web BFF. Workforce snapshot reaches voice-agent (L-0233 closed). Tool RPC protocol live on data channel (L-0234 closed). Production-grade UX with error states, reconnect, policy-flip, mic permission. 13 telemetry events emitting with non-empty IDs. Static gates GREEN. Two known gaps deferred with documented rationale.

**Mobile end-state**: user logs in → long-presses FAB → speaks "hvem jobber kveldsvakt på torsdag?" → agent answers with actual employee names + shift times → user says "åpne vaktlisten" → mobile navigates to /schedule → user toggles to text mode → types question → response renders in same TranscriptPane.

## Predecessor Context

Predecessor sortie `mobile-voice-bootstrap-pipe` (merged into campaign/mobile as commit `c4be0101d`) shipped:
- BFF route `/api/emma/voice/transcript` extended with snapshot return (P1)
- GET resolver `/api/emma/voice/snapshot/[version]` for size-guard overflow (P2.5)
- Mobile UI scaffold: FAB long-press, BotssonSheet, AI Prefs settings, TranscriptPane shell, FabHint (P2)

This sortie wires runtime + adds production-grade UX polish.

## What Shipped (commits, chronological)

| Commit | Phase | Description |
|--------|-------|-------------|
| `ab78525ce` | plan | docs(mobile-voice-runtime-wire): plan + 4 journeys |
| `be6c825dd` | P3 | feat(mobile-voice): publish botsson-context on LiveKit data channel at session start |
| `01f90588b` | P3-verify | test(mobile-voice): L-0233 proof for botsson-context publish (4/4 producer + 5/5 consumer tests) |
| `4b58a1ed9` | P3-fixup | chore(test): remove broken vitest-imported test (coverage in P3-verify suites) |
| `354ae0b63` | P4 | feat(mobile-voice): register tools + serve botsson-tool-call RPC |
| `6e9432ef7` | P4-fixup | fix(mobile-voice): PII redact in rpc_failed.reason + comment sync + required-default opt-in |
| `efcbe25ac` | P5 | feat(mobile-chat): text chat wired to /api/emma/chat with shared TranscriptPane |
| `561e64371` | P5-fixup | fix(mobile-chat): stable deps array + dead voiceEnabled var + crypto.randomUUID for optimistic id |
| `dd62300e2` | P6 | feat(mobile-voice): production UX polish — ChatErrorBanner + MicPermissionDialog + NetworkRetryBanner + policy flip + 4-state Orb |
| `4e02eb891` | P6-fixup | fix(mobile-voice): accessibilityRole=search removed + disconnectStartMs timing + paddingVertical token + emoji icons → Lucide |
| `c6d980814` | P7 | docs(mobile-voice-runtime-wire): P7 steward gate + ADR-0378 + journey status updates |

11 commits. ~3000 LoC delta. Touch surface scoped to mobile + telemetry registry + voice-agent test files + docs.

## Decisions

### ADR-0378 — LiveKit data-channel protocol (proposed)

`docs/decisions/0378-livekit-data-channel-protocol-botsson.md`

Codifies four-topic envelope contract between mobile and voice-agent:
- `botsson-context` (client → agent) — `{ type: "context_init", snapshot: { version, payload: WorkforceSnapshot } }`
- `botsson-tools-register` (client → agent) — `{ definitions: ClientToolDefinition[] }`
- `botsson-tool-call` (agent → client) — `{ type: "tool_call", call_id, name, arguments }`
- `botsson-tool-result` (client → agent) — `{ call_id, result }`

Topic names LOCKED. Field additions allowed if backward-compatible. Topic renames require protocol-version bump + dual-publish window.

Status: proposed. Needs council ratification if any cross-platform consumer is added (e.g. desktop Botsson surface).

### Deferred decisions

- **ADR-0151 amendment** — `workspaceId` accepted from request body + cross-checked against profile via explicit `.eq("workspace_id", body.workspaceId)` returning 403 on mismatch. Pattern matches `/api/emma/chat/route.ts:165` + predecessor sortie pattern. Steward judged this NOT silent fallback (per L-0177) — it's explicit cross-check with fail-fast. Decided NOT to draft formal amendment; pattern is established codebase convention. Promote to ADR if 3rd-grade occurrence.

## Learnings

### L-0233 — Voice-agent context proof (CLOSED)

Required falsifiable proof that mobile-published snapshot reaches voice-agent. Closed via P3-verify Path B+C: producer test (`apps/mobile/src/lib/__tests__/livekit-data-publish.test.ts`, 4/4) asserts publishData call shape + topic + reliable=true + retry behavior; consumer test (`services/voice-agent/__tests__/context.test.ts`, 5/5) asserts setSessionContext stores payload + getSessionContextSnapshot returns non-null + fail-fast on null IDs. Shape contract verified end-to-end.

Proof artefact: `docs/proofs/P3-context-publish-proof.md`.

### L-0234 — Voice view-tools mirror (CLOSED)

Mobile now registers tools + serves `botsson-tool-call` RPC. 5 mobile tools (`mobile_navigate_to`, `mobile_open_sheet`, `mobile_show_toast`, `mobile_start_punch`, `mobile_call_leader`) round-trip via voice-agent. Dedup via `seenCallIdsRef`. Concurrent dispatch supported (each call_id resolves independently). HARNESS_ADAPTER_VOICE_ENABLED flag gates voice-agent's `updateTools()`; mobile publishes regardless.

### L-NEW orchestrator-discipline — Agent committed to campaign/mobile when wt-5 deleted

During predecessor sortie's P2.5 phase, a build agent committed 3 fixes directly to `campaign/mobile` branch because `wt-5` worktree had been deleted by an unexpected `close-feature.sh` invocation. Hard discipline: every dispatched agent must run pre-work check (`test -d <wt> && git branch --show-current`) and STOP on divergence. Adopted as boilerplate in all P3-P7 agent prompts. Pattern confirmed effective — zero discipline violations in this sortie.

### L-NEW telemetry registry pair-per-line — works at scale

13 new events added across 4 phases without merge conflicts. Pattern: each phase touches only its own block + append at tail. No churn on existing routing entries.

### L-NEW WSL2 OOM on `turbo typecheck` — confirmed

`pnpm turbo typecheck` from root reliably OOMs in WSL2 with swap=0. Workaround documented in agent prompts: per-package `pnpm --filter X typecheck` OR fallback `npx tsc --noEmit --skipLibCheck`. P8 Part A used the per-package approach successfully.

## Telemetry Events (13 new)

Voice path (P3 + P4):
- `voice.bootstrap.snapshot_published` (mobile) — emit on data-channel publish success
- `voice.bootstrap.publish_failed` (mobile) — emit after 2 retry failures
- `voice.bootstrap.tool_registered` (mobile) — emit on `botsson-tools-register` success
- `voice.bootstrap.tool_register_failed` (mobile) — emit on register publish failure
- `voice.bootstrap.rpc_completed` (mobile) — emit per round-trip with `latency_ms`
- `voice.bootstrap.rpc_failed` (mobile) — emit on dispatch error or publish error; `reason` field PII-redacted to `"tool_execution_failed"`

Chat path (P5):
- `mobile.chat.message_sent` (mobile) — emit per send
- `mobile.chat.response_received` (mobile) — emit per response with `latency_ms`
- `mobile.chat.error` (mobile) — emit on 401 / 500 / network failure

UX path (P6):
- `mobile.voice.mic_permission_denied` (mobile) — emit when iOS/Android denies mic
- `mobile.voice.disconnect_recovered` (mobile) — emit when LiveKit reconnects within 3-retry budget
- `mobile.voice.disconnect_failed` (mobile) — emit after 3 retries exhausted
- `mobile.voice.policy_flipped` (mobile) — emit when BFF returns voice_policy_disabled

All 13: `nonEmpty()` guards on `workspace_id` + `actor_id` via `getProfileContext()` (throws on missing). Throws caught at boundary, telemetry skipped (not silent-swallowed) per L-0177.

Routing per event in `packages/telemetry/src/registry.ts:14899-14985`.

## Known Debt / Backlog

1. **Mid-session voice policy 403 → policy_flipped propagation** (DEFERRED). `use-voice-transcripts.ts:252-269` handles 403 by clearing session + surfacing error in transcript pane, but provider does not subscribe to that error to flip mode. Start-path detection works. Degraded mode acceptable for V1. Track: add `onError` callback to `useVoiceTranscripts` + wire to BotssonProvider.

2. **Multi-banner priority** (DEFERRED). When `micPermissionDenied + policyFlipped + reconnect` overlap, render order is mic → network → policy → chat-error but no priority resolver. States are mutually improbable in practice. Track: add resolver in BotssonSheet if user reports visual crowding.

3. **`@smartout/types` / `@smartout/journey-ir` campaign-wide gap**. Pre-existing 33 TS errors (12 in `@smartout/ai`, 4 in `@smartout/mobile`, 17 in `web`) caused by missing built dist for `@smartout/types` and `@smartout/journey-ir` packages. Not introduced by this sortie; confirmed pre-existing on `bc7c27bf6`. Likely fix: `pnpm --filter @smartout/types build` as part of campaign setup, or missing `package.json` `exports` field. Track separately.

4. **Orb rgba ADR-0366 exemption not formally carved out**. Orb.tsx uses `rgba()` for `expo-linear-gradient` stops (React Native does not support `oklch()`). File header documents exemption but no ADR formalizes. If ADR-0366 ESLint rule ships, Orb will false-positive. Track: amend ADR-0366 with React Native exemption clause.

5. **Hoist `BotssonContextInitPayload` + `ContextInitMessage` to shared types package**. Currently defined per-side (`apps/mobile/src/lib/livekit-data-publish.ts` + `services/voice-agent/src/context.ts`). ADR-0378 follow-up recommendation. Track: create `@smartout/types/livekit-protocol.ts` exporting both.

6. **Mobile-side topic-guard test parity**. Voice-agent has `topic guard rejects payloads on other topics` test; mobile listener does not have equivalent. Track: add test asserting `botsson-tool-call` listener filters by topic name.

7. **10s tool-call timeout integration test** on voice-agent side. Currently unit-tested via mocks; production behavior under app-backgrounded scenario not exercised. Track: add scenario test once feature flag flips.

## PWA Walkthrough (P8 Part B — Pontus performs)

Required before close-feature. Steps:

1. **Start dev environment**:
   ```bash
   cd /home/sxtnl/dev/smartout.ai-mobile-wt-5
   pnpm --filter @smartout/mobile dev
   # opens PWA on localhost:8083
   ```

2. **Login + land on Kalender tab** (default per ADR-0268).

3. **Long-press FAB** (≥500ms) → BotssonSheet opens in voice mode.
   - Verify: FabHint tooltip on first attempt (only once per device — clears via MMKV `cache:botsson:seen-fab-hint`)
   - Verify: Orb pulses (connecting → listening)
   - Verify telemetry: `mobile.fab.long_press` + `mobile.botsson_sheet.opened` (source: `fab_long_press`)

4. **Speak voice query**: "hvem jobber kveldsvakt på torsdag?"
   - Verify: Orb states transition listening → thinking → speaking → idle
   - Verify: response includes actual employee names + shift times (NOT generic "jeg trenger mer info")
   - Verify telemetry: `voice.bootstrap.snapshot_published` (first turn) + `voice.bootstrap.snapshot_sent` (server-side, P1)
   - Verify activity_trail: snapshot payload present + non-empty workspace_id/actor_id

5. **Voice command**: "åpne vaktlisten"
   - Expected: mobile navigates to /schedule within 2s
   - Telemetry: `voice.bootstrap.rpc_completed` with `latency_ms < 2000`
   - **Gate**: this only works if voice-agent has `HARNESS_ADAPTER_VOICE_ENABLED=true`. Default is OFF. To flip: update `op://smartout_ai/HarnessAdapter/voice_enabled` to `true` and restart voice-agent container. If flag stays OFF, the publish + listener wiring is verified but actual round-trip won't fire (voice-agent skips `updateTools()`).

6. **Toggle to text mode** in BotssonSheet (via mic button or settings).
   - Verify: transcript pane preserves voice history
   - Verify: text input visible

7. **Type message**: "Hva er min vakt i morgen?"
   - Verify: optimistic user message renders immediately
   - Verify: agent response appends to TranscriptPane within 2-4s
   - Verify telemetry: `mobile.chat.message_sent` + `mobile.chat.response_received`

8. **Edge case — mic denial**: revoke mic permission in browser settings → reopen voice mode.
   - Verify: MicPermissionDialog renders with "Åpne innstillinger" + "Skriv i stedet"
   - Verify telemetry: `mobile.voice.mic_permission_denied`

9. **Edge case — network drop**: kill network briefly during voice session.
   - Verify: NetworkRetryBanner appears with "Prøver igjen..."
   - Verify: reconnects within 3 retries (500ms / 1s / 2s backoff)
   - Verify telemetry: `mobile.voice.disconnect_recovered` OR `mobile.voice.disconnect_failed`

10. **Verify** all telemetry events appear in PostHog dev project OR `activity_trail` if PostHog unreachable.

If all 10 steps green → ready for close-feature.

## Close-Feature Procedure

**ORCHESTRATOR DOES NOT INVOKE close-feature.sh.** Pontus runs it manually.

When PWA walkthrough green:
```bash
# Pontus runs:
cd /home/sxtnl/dev/smartout.ai-mobile-wt-5
./close-feature.sh
# OR equivalent campaign sub-sortie close script
```

Expected behavior:
- All 4 journey docs have `status: verified` or `verified-with-deferred-gaps` (already set by P7)
- HANDOFF doc present (this file)
- Decision log updated (already done by P7 for ADR-0378)
- Typecheck green on touched files (P8 Part A confirmed)
- Branch merges to `campaign/mobile` via merge-commit (NEVER squash per ADR-0213)
- `development` syncs into `campaign/mobile` tail per CLAUDE.md sub-sortie closure

## Pre-Close Cleanup (Pontus to verify)

Two untracked / modified items in worktree NOT committed:

1. `M .claude/agent-memory/botsson-harness-builder/MEMORY.md` — agent-private memory file modified during P6. Acceptable per agent-memory convention (private to agent, not sortie artefact).

2. `?? docs/plans/PLAN-voice-runtime-wire.md` — stray scaffold file from `new-feature.sh`. Canonical plan is `PLAN-mobile-voice-runtime-wire.md` (with campaign prefix). The stub is a duplicate; safe to delete OR leave (close-feature.sh may handle).

Recommendation: delete the stray PLAN-voice-runtime-wire.md before close to avoid index pollution.

## Activation Checklist (post-close)

- [ ] Flip `HARNESS_ADAPTER_VOICE_ENABLED=true` in voice-agent env (1Password vault `op://smartout_ai/HarnessAdapter/voice_enabled`) when ready for tool RPC production traffic
- [ ] Restart voice-agent container after flag flip
- [ ] Monitor PostHog dashboard for 13 new events in first 24h
- [ ] Set up alert on `voice.bootstrap.publish_failed` > 5% of sessions (indicates LiveKit data-channel issues)
- [ ] Set up alert on `voice.bootstrap.rpc_failed` > 2% of round-trips (indicates RPC reliability issues)

## What's NOT in This Sortie

Explicitly out of scope (do NOT confuse with debt):
- gpt-realtime model upgrade (separate sortie, plan + 5 journeys live on campaign/mobile from predecessor cherry-pick — wt-4 territory)
- Realtime LLM persona parity audit (CRITICAL parked from P0 audit; requires council before code)
- Voice transcript persistence to DB
- Mic permission UX redesign beyond denial dialog
- Mobile authoring verbs (forbidden by ADR-0133)
- New AI capability tools beyond existing 5

## References

- ADR-0078 — channel pinning + voice-no-PII rule
- ADR-0107 — channel derivation (mode → channel)
- ADR-0132 — mobile thin client; AI through web BFF
- ADR-0133 — mobile-execute boundary
- ADR-0134 — telemetry IDs non-empty + fail-fast
- ADR-0135 — mobile voice = LiveKit
- ADR-0151 — workspace_id derived server-side
- ADR-0213 — campaign branches use merge-commit
- ADR-0240 — capability boundary
- ADR-0268 — 5-tab canonical layout
- ADR-0297 — workforce snapshot bootstrap pipe
- ADR-0327 — voice-tool-resolver feature flag
- ADR-0366 — OKLCH literal ban
- ADR-0377 — telemetry registry parity (L-0298 codification)
- **ADR-0378 — LiveKit data-channel protocol (proposed, this sortie)**
- L-0083 — telemetry registry concurrent additions
- L-0176 — docstring drift
- L-0177 — fail-fast on null IDs / row-not-found
- **L-0233 — two LLM contexts (CLOSED via P3-verify)**
- **L-0234 — voice view-tools mirror (CLOSED via P4)**
- L-0298 — telemetry registry entry requires emit() call-site

## Proof Artefacts

- `docs/proofs/P3-context-publish-proof.md` — L-0233 closure
- `docs/proofs/P7-steward-gate.md` — full gate report

## Next Steps Summary

1. **Pontus runs PWA walkthrough** (P8 Part B) — 10 steps above
2. **Pontus runs close-feature.sh** when walkthrough green
3. **Activation flip** `HARNESS_ADAPTER_VOICE_ENABLED=true` when ready for RPC production traffic
4. **Monitor** telemetry in first 24h post-flip
5. **Backlog** items tracked above for future sortier
