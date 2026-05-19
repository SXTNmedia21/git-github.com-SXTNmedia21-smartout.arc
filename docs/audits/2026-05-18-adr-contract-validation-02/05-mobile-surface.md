---
title: "Slice 05 — Mobile Surface Audit"
status: done
updated: 2026-05-18
created: 2026-05-18
module: mobile
tags: [audit, mobile, ADR-0132, ADR-0133, ADR-0134, ADR-0135, ADR-0136, ADR-0238]
---

# Slice 05 — Mobile Surface Audit

**Date:** 2026-05-18  
**ADRs:** 0127–0136, 0158, 0238  
**Trap:** L-0083 (actor_id "anonymous" corruption)  
**Scope:** `apps/mobile/src/**`

---

## Summary

**PASS** with two tracked gaps. No violations on the critical ADR-0134 telemetry contract or ADR-0133 surface boundary. Push-topic W1.3 work (today's campaign) is correctly wired.

---

## Findings by ADR

### ADR-0133 — Surface boundary (web composes, mobile executes)

**PASS.** No schedule drag-drop editor, year-wheel, onboarding wizard, contract authoring, governance editor, or billing UIs found on mobile. Every shift-related query hook is explicitly annotated read-only (e.g. `use-shift-session.ts:8`, `use-day-line-items.ts:12`). `useCreateShift` routes through BFF POST `/api/mobile/shifts` (ADR-0270); shift-create is a manager-only Approve verb, consistent with ADR-0133.

**GAP-MOB-01 (tracked, not blocking):** `apps/mobile/src/components/spokesperson/AiWritingPanel.tsx` + `ContentCreator.tsx` are content-authoring UIs. The spokesperson surface is mobile-native per product intent (employees create their own social content on device), not a D1–D5 cascade-authoring surface. This is not an ADR-0133 violation, but the spokesperson module has no ADR documenting the authoring-on-mobile exception. Recommend adding a note to the spokesperson ADR or creating one.

---

### ADR-0134 — Mobile Telemetry Contract

**PASS.** All checked mutation hooks call `getProfileContext()` before `emit()` and the helper throws on missing/empty identity. Verified across:
- `use-punch.ts` — `getProfileContext()` called at top of `punchIn`/`punchOut`; `punchOut` also has explicit null guard on `shift_id` citing ADR-0134 / L-0083.
- `use-confirm-hours.ts`, `use-mark-read.ts`, `use-resolve-ticket.ts`, `use-availability.ts`, `use-recon-wizard.ts`, `use-day-line-items.ts` — all call `getProfileContext()` before `emit()`.
- `profile-context.ts` — both null and empty-string guards present (trim check added per ADR-0134 Invariant 2).
- `lib/sync/schemas.ts` — Zod validation at `enqueue()` call site; offline queue payloads validated pre-write.
- No `?? ""` empty-string fallback on `workspace_id` / `actor_id` / `profile_id` found anywhere in production code.

**L-0083 trap check:** No `"anonymous"` literal found in any emit call-site or identity resolution path.

---

### ADR-0132 — AI routing via BFF (thin client)

**PASS.** `lib/web-api.ts` documents the BFF contract centrally. All AI/capability calls route through:
- `getEmmaChatUrl()` → `/api/emma/chat`
- `getEmmaVoiceTranscriptUrl()` → `/api/emma/voice/transcript`
- Shift-swap, availability, booking, task-create, shift-create — all documented as BFF-delegated, with workspace_id derived server-side (ADR-0151 cited).

No direct `supabase.functions.invoke()` calls to capability-owning Edge Functions found on the production path. One commented-out line in `AiWritingPanel.tsx:80` is clearly a TODO/stub with the real call pending.

**GAP-MOB-02 (documented, self-aware):** `use-create-shift.ts:24–26` — BFF route `apps/web/src/app/api/mobile/shifts/route.ts` does not yet exist (Phase 3a deliverable). The code points to the right URL but the backend stub is absent. This is a known tracked gap, not a new finding.

---

### ADR-0135 — LiveKit voice (not Ultravox)

**PASS.** `use-botsson-voice-session.ts` uses `livekit-client` + `@livekit/react-native`. Token minted via `getLiveKitToken(supabase, { purpose: 'ai_voice' })`. TTS via `expo-speech`, ASR via LiveKit Whisper pipeline. `useVoiceTranscripts` posts to `/api/emma/voice/transcript` BFF.

`botsson-provider.tsx` retains a `voiceSessionRef` for a "legacy Ultravox path — keep for the web bundle" (lines 147, 242). This is a compatibility shim for the web PWA bundle, not a native path. The native `startVoiceSession()` path calls `voice.start()` → `performStart()` → LiveKit only. **No ADR-0135 violation.** The Ultravox comment in the docstring (line 7) is stale — the voice path was migrated. Low-risk but worth a follow-up docstring cleanup.

---

### ADR-0136 — Camera evidence

**PASS (surface present, properly gated).** `platform/image-picker.web.ts` returns `canceled: true` for all web calls. Native camera usage found in `ContentCreator.tsx` and `MessageInput.tsx`. No evidence-capture flow found that bypasses permission gating.

---

### ADR-0238 — Dual-surface AI chat (BotssonShell / DomainChat)

**PASS (not applicable on mobile).** No `DomainChatOwnership` components exist in mobile — the ADR-0238 pattern is a web-only concern. Mobile has a single `BotssonSheet` + `BotssonProvider`; no competing domain-chat surfaces.

---

### W1.3 Push-topic (today's campaign work)

**PASS.** `push.ts:subscribeShiftSessionTopic` and `unsubscribeShiftSessionTopic` both call `getProfileContext()` (ADR-0134 fail-fast) before writing `active_push_topic` to profile and emitting `shift_session.clocked_in` / `clocked_out`. Inner try/catch on the Supabase column update follows L-0177 warn-don't-throw pattern. `use-punch.ts` wires both calls at clock-in/out. Correctly annotated `ADR-0367 §M4`.

---

## Gaps Summary

| ID | Severity | ADR | Description |
|----|----------|-----|-------------|
| GAP-MOB-01 | INFO | ADR-0133 | Spokesperson content-authoring on mobile has no ADR exception doc |
| GAP-MOB-02 | INFO | ADR-0132 | BFF route `/api/mobile/shifts` not yet built (Phase 3a) |
| — | COSMETIC | ADR-0135 | Stale "Ultravox" docstring in `botsson-provider.tsx` line 7 |

No CRITICAL or HIGH findings. Surface is compliant on all checked boundaries.
