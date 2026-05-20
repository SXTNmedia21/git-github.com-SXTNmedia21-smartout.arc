---
title: "Slice 05 — Mobile Surface Audit"
status: done
created: 2026-05-20
updated: 2026-05-20
module: audit
tags: [audit, mobile, ADR-0132, ADR-0133, ADR-0134, ADR-0135, ADR-0136, ADR-0238, ADR-0377, ADR-0378]
---

# Slice 05 — Mobile Surface Audit

**Date:** 2026-05-20
**ADRs:** 0127–0136, 0158, 0238, 0377, 0378
**Trap:** L-0083 (actor_id "anonymous" corruption)
**Scope:** `apps/mobile/src/**`
**Baseline:** `2026-05-18-adr-contract-validation-02/05-mobile-surface.md`

**New work audited today (PR not in baseline):** `mobile-voice-runtime-wire` 12-commit series — botsson-context publish, tool RPC, text chat, UX polish, 4-state Orb. ADR-0377 (telemetry coverage gate) and ADR-0378 (LiveKit data-channel protocol) proposed.

---

## Summary

1. **HIGH MOB-01** — `mobile_call_leader` sends `leader_phone` (phone number = PII) through `botsson-tool-call` wire without server-side PII filter. ADR-0378 Rule 7 violated; voice-agent's "authority layer filtered PII" claim does not apply to client-registered tools.
2. **MEDIUM MOB-02** — `mobile_show_toast` tool implements `Alert.alert()` (modal, requires user dismiss) not a non-blocking toast. ADR-0378 §R4 says no PII on `botsson-tool-call` arguments; this also breaks voice-mode UX contract (blocking modal during speech).
3. **MEDIUM MOB-03** — ADR-0378 §Test obligations: mobile `DataReceived` handler has no unit test for the topic guard (`topic !== "botsson-tool-call"` → drop silently). Voice-agent side has this test; mobile side does not. Parity gap.
4. **LOW MOB-04** — Two independently maintained type sources for `BotssonContextInitPayload` (mobile) vs `ContextInitMessage` (voice-agent). ADR-0378 follow-up "hoist to shared `@smartout/types/livekit-protocol.ts`" not yet done. Drift risk acknowledged in ADR.
5. **INFO MOB-05** — `use-voice-transcripts.ts:258` treats BFF 403 as stale session (clear session_id) but does NOT propagate `VOICE_POLICY_DISABLED` to `onPolicyFlipped`. Self-documented at `botsson-provider.tsx:530-533` as "P6 report" gap. Not a new finding.

---

## Findings Table

| ID | Severity | File:line | ADR | Evidence |
|----|----------|-----------|-----|---------|
| MOB-01 | HIGH | `apps/mobile/src/lib/botsson-tools.ts:121-138` | ADR-0378 R7, ADR-0078 | `mobile_call_leader` registers `leader_phone` in tool params; voice-agent forwards it on `botsson-tool-call` wire. Phone = PII. Server-side PII gate (ADR-0078) does not cover client-registered mobile tools — only server-side capability tools. |
| MOB-02 | MEDIUM | `apps/mobile/src/lib/botsson-tools.ts:94-95` | ADR-0378 R4 | `mobile_show_toast` uses `Alert.alert()` — a blocking modal. Tool is exposed during voice sessions where blocking UI degrades flow. Comment acknowledges "In production, this would use a toast library." |
| MOB-03 | MEDIUM | `apps/mobile/src/hooks/use-botsson-voice-session.ts:761` | ADR-0378 §Test | `handleDataReceived` guards `topic !== "botsson-tool-call"` correctly but no unit test exercises the guard (drop on wrong topic). Voice-agent side has this test (`context.test.ts:topic guard rejects payloads on other topics`). Mobile parity missing. |
| MOB-04 | LOW | `apps/mobile/src/lib/livekit-data-publish.ts:42-47` vs `services/voice-agent/src/context.ts:100-105` | ADR-0378 §Bad | Dual type sources for `BotssonContextInitPayload` / `ContextInitMessage`. ADR-0378 explicitly marks this as a follow-up, not a rule violation. Recording for tracking. |
| MOB-05 | INFO | `apps/mobile/src/hooks/use-voice-transcripts.ts:258` | ADR-0135 | BFF 403 mid-session clears `sessionId` but does not propagate `VOICE_POLICY_DISABLED`. Self-documented as "P6 report". Not new. |

---

## Per-ADR Rollup

| ADR | Topic | Verdict | Notes |
|-----|-------|---------|-------|
| ADR-0132 | Mobile thin client via BFF | ✅ compliant | All AI/capability calls route through `/api/emma/chat` and `/api/emma/voice/transcript`. No direct capability imports on mobile. `use-emma-chat.ts` + `use-voice-transcripts.ts` wired correctly. |
| ADR-0133 | Web composes, mobile executes | ✅ compliant | No schedule editor, year-wheel, contract authoring, or governance UI on mobile. Spokesperson surface authoring exception still undocumented (GAP-MOB-01 from baseline — still tracked, not a new finding). |
| ADR-0134 | Mobile telemetry contract | ✅ compliant | All 13 new voice/chat events use `getProfileContext()` + `nonEmpty()` guards. `profile-context.ts` throws on empty/null IDs. No `?? ""` fallbacks found. L-0083 trap: no `"anonymous"` literal in emit paths. |
| ADR-0135 | Mobile voice via LiveKit | ✅ compliant | `use-botsson-voice-session.ts` uses `livekit-client` + `@livekit/react-native`. TTS via `expo-speech`. ASR via LiveKit Whisper pipeline. Ultravox docstring in `botsson-provider.tsx:8` is stale but the actual voice path is LiveKit-only (`performStart → room.connect`). |
| ADR-0136 | Camera evidence model | ✅ compliant | No changes in this campaign. Platform shim confirmed. |
| ADR-0238 | Dual-surface AI chat | ✅ compliant (n/a mobile) | Single `BotssonSheet` surface. No competing domain-chat surface. |
| ADR-0158 | Dual-platform UI strategy | ✅ no changes | No `packages/ui` modifications in this campaign. |
| ADR-0377 | Telemetry registry requires emit wiring | ✅ compliant | All 13 newly-registered events (`voice.bootstrap.*`, `mobile.voice.*`, `mobile.chat.*`) have matching `emit()` call-sites in `apps/mobile/src/`. Verified by grep. No toothless registry entries. |
| ADR-0378 | LiveKit data-channel protocol | ⚠️ partial | Topic names locked, discriminators correct, dedup implemented. **Violations:** MOB-01 (PII on `botsson-tool-call` for `mobile_call_leader`). **Gaps:** MOB-03 (missing topic-guard test on mobile DataReceived). MOB-04 (dual type sources — follow-up, acknowledged in ADR). |
| ADR-0127–0131 | Billing/invoice/Stripe ADRs | ✅ not in scope | No billing surface on mobile. |

---

## Verified Intentional

- **Stale Ultravox docstring** (`botsson-provider.tsx:8`) — "legacy Ultravox path — keep for the web bundle" comment is accurate. Web bundle compat shim path; native voice path is LiveKit-only. Not a violation; stale comment only.
- **`use-voice-transcripts.ts` 403 non-propagation** — self-documented at `botsson-provider.tsx:530-533` as "P6 report" architectural gap. `onPolicyFlipped` watches `voice.error` as fallback. Provider comment is accurate. Not a new finding.
- **`mobile_call_leader` phone in botsson-tools.ts comment** — code comment claims phone numbers are "non-sensitive contact info." This claim is INCORRECT (phone = PII under GDPR) and is flagged as MOB-01. NOT accepted as false-positive.
- **GAP-MOB-02 from baseline** (BFF route `/api/mobile/shifts` absent) — remains tracked. Not in scope of this voice-runtime campaign.

---

## In-Progress (Mid-Campaign)

No findings in active campaign files. The `mobile-voice-runtime-wire` campaign has landed (12 commits merged to `development` 2026-05-20 per prompt context). All findings above apply to code on `development` tip.

---

## Delta vs Baseline (2026-05-18)

| Baseline finding | Status |
|-----------------|--------|
| GAP-MOB-01 (ADR-0133 spokesperson authoring exception undocumented) | Unchanged — still tracked |
| GAP-MOB-02 (ADR-0132 `/api/mobile/shifts` not yet built) | Unchanged — not in this campaign |
| Stale Ultravox docstring | Unchanged — cosmetic |
| ADR-0134 PASS | Maintained — new voice events all compliant |
| ADR-0135 PASS | Maintained |

**New in this audit:** MOB-01 (HIGH), MOB-02 (MEDIUM), MOB-03 (MEDIUM), MOB-04 (LOW) — all introduced by the `mobile-voice-runtime-wire` work that landed today.
