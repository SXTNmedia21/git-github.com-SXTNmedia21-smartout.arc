---
title: Audit Slice 05 — Mobile Surface
status: done
updated: 2026-05-10
created: 2026-05-10
module: mobile
tags: [audit, mobile, ADR-0132, ADR-0133, ADR-0134, ADR-0135, telemetry, livekit]
---

# Audit Slice 05 — Mobile Surface

**Repo:** campaign/botsson-arena  
**Date:** 2026-05-10  
**ADR cluster:** 0127–0136, 0158, 0238  
**Surface:** `apps/mobile/**`  
**Trap:** L-0083 actor_id "anonymous" corruption — empty-string fallbacks forbidden (ADR-0134)

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH     | 2 |
| MEDIUM   | 3 |
| LOW      | 2 |
| INFO     | 1 |

---

## Findings

### F-MO-01 — HIGH — Empty-string workspace_id fallback in ShiftClockView (ADR-0134)

**File:** `apps/mobile/src/components/shift-clock/ShiftClockView.tsx:68`

```typescript
const workspaceId = profile?.workspace_id ?? "";
```

This value is passed directly into `useSupplements(shiftId, workspaceId)` (line 73). ADR-0134 Invariant 2 explicitly forbids empty-string fallbacks: "Empty-string fallbacks are forbidden (silently corrupts `activity_trail` + `engine_event` routing)."

While `useSupplements` is a query hook (not an emit site), the empty-string workspace_id can be forwarded into downstream data-fetch calls, and — if the same value were later passed to a mutation — would produce corrupt telemetry silently. The profile query is async; a race window exists where this component renders before profile loads.

**Additional instance at line 243:** `workspace_id: currentTimeEntry?.workspace_id ?? ""` — this is passed as a prop into `AfterShiftView.timeEntry`, which the downstream `useConfirmHours` / `useSubmitHandoff` may read. Those hooks do call `getProfileContext()` independently, but the prop chain is confusing and may accumulate additional consumers.

**Also:** `apps/mobile/src/components/shift-clock/ShiftClockView.tsx:317` — `profileId: profile?.profile_id ?? ""` passed to `<TaskFeed>`.

**Recommendation:** Guard with early-return or skeleton when `profile` is null. Replace `?? ""` with `?? null` and gate downstream hooks on non-null.

---

### F-MO-02 — HIGH — Empty-string workspace_id in use-training-data (ADR-0134)

**File:** `apps/mobile/src/hooks/queries/use-training-data.ts:134`

```typescript
const workspaceId = profile?.workspace_id ?? "";
```

Passed into `useAssignedProtocols` and `useReadinessScore` (lines 141–151). Both hooks receive this value as their `workspaceId` parameter. When profile is loading, an empty-string workspace_id is passed, potentially triggering queries with `workspace_id = ""` against Supabase (which would return 0 rows silently or trigger RLS mismatch). Not a direct emit() corruption, but violates the spirit of ADR-0134 Invariant 2.

**Recommendation:** Use `?? null` and guard `enabled: !!workspaceId`.

---

### F-MO-03 — MEDIUM — Empty-string workspace_id in use-swap-requests (ADR-0134)

**File:** `apps/mobile/src/hooks/queries/use-swap-requests.ts:54`

```typescript
workspace_id: row.workspace_id ?? "",
```

This maps a `null` database column to `""` on the SwapRequest object returned to callers. If a caller passes `swapRequest.workspace_id` to a mutation's emit(), the empty string would corrupt telemetry. The `use-swap.ts` mutation uses `getProfileContext()` independently for its emit (correct), but the mapped object is the return type of `useSwapRequests()` — it may be consumed by other callers who trust this field.

**Recommendation:** Map to `row.workspace_id ?? null` and let callers handle null explicitly.

---

### F-MO-04 — MEDIUM — useShiftChat still writes to deprecated `chat_message` table (ADR-0132)

**File:** `apps/mobile/src/hooks/shift-clock/useShiftChat.ts:238–247`

```typescript
await enqueue("send_message", {
  id: messageId,
  conversation_id: conversationId,
  ...
});
```

**File:** `apps/mobile/src/lib/sync/action-map.ts:102`

```typescript
send_message: (p) => assertOk(supabase.from("channel_message").insert(p as never)),
```

`useShiftChat` passes `conversation_id` (the deprecated `chat_message` schema column) into the `send_message` sync action. The schemas.ts comment (line 69–71) explicitly documents this: _"Some legacy callers (useShiftChat.ts) pass `conversation_id` instead of `channel_id` — those target the DEPRECATED chat_message system per ADR-0132 and will fail at sync."_

This hook is not currently called by any component in the codebase (no import found in `src/components/` or `app/`), so it is dead code for now. However, the deprecated write path remains live in `action-map.ts`, and if `useShiftChat` were imported again it would silently target the wrong table at sync time.

**Recommendation:** Mark `useShiftChat` as `@deprecated` in its header, or remove if confirmed dead. Add a `console.error` guard in the `send_message` action handler that checks for `conversation_id` and throws to surface legacy callers immediately.

---

### F-MO-05 — MEDIUM — BotssonSheet transcript panel does not wire C1.b voice state (ADR-0135)

**File:** `apps/mobile/src/components/ai/BotssonSheet.tsx:54–55, 128`

The BotssonSheet uses `status` (coarse: idle/connecting/active/error) but not `voiceStatus` (fine-grained: listening/thinking/speaking) or `lastVoiceResponse`. The transcript is local state (`useState<TranscriptEntry[]>([])`) that is never populated — the comment at line 54 reads: _"Transcript is local state for now — Ultravox WebRTC integration will populate it."_

The C1.b voice session hook (`useBotssonVoiceSession`) exposes `lastResponse` and the provider (`BotssonProvider`) exposes `lastVoiceResponse` — but `BotssonSheet` does not consume them. Voice responses are spoken via TTS (Expo Speech) but never rendered in the transcript panel.

Additionally, the file header (lines 7–8) still references Ultravox WebRTC. Botsson voice on mobile was migrated to LiveKit per ADR-0135; the comment is stale and could mislead future developers.

**Recommendation:** Wire `voiceStatus` and `lastVoiceResponse` from `useBotsson()` into the transcript panel. Update the file header. This is a UX gap (voice works but transcript is blank) and a docs-rot issue (stale Ultravox reference).

---

### F-MO-06 — LOW — botsson_channel_id resolved via unsafe cast on profile type (ADR-0135)

**File:** `apps/mobile/src/providers/botsson-provider.tsx:172–174`

```typescript
const botssonChannelId: string | null =
  (profile as { botsson_channel_id?: string | null } | null | undefined)?.botsson_channel_id ??
  null;
```

`botsson_channel_id` does exist in `database.types.ts` (verified at `packages/supabase/src/database.types.ts:14595`), but `useMyProfile` returns `ProfileWithJoins` which is typed as `ProfileRow & { workspace: ...; department: ... }`. The `ProfileRow` type includes `botsson_channel_id: string | null`. The `as` cast is therefore unnecessary — the field should be accessible directly from `profile?.botsson_channel_id`.

The cast is not wrong (it works at runtime) but it bypasses TypeScript's type narrowing, making future schema changes invisible. If `botsson_channel_id` is renamed or removed from the DB schema, the regenerated types will silently not surface the drift.

**Recommendation:** Remove the cast. Use `profile?.botsson_channel_id ?? null` directly. `ProfileRow` already includes the column.

---

### F-MO-07 — LOW — ConversationScreen getLiveKitToken called without `purpose` field

**File:** `apps/mobile/src/components/chat/ConversationScreen.tsx:90–93`

```typescript
const tokenResult = await getLiveKitToken(supabase, {
  channelId,
  workspaceId,
});
```

The `useBotssonVoiceSession` calls `getLiveKitToken` with `purpose: "ai_voice"` (line 481 of `use-botsson-voice-session.ts`), which routes to the C1 edge-function path that enforces `channel_ai_policy.voice_participation`. The `ConversationScreen` call omits `purpose`, which will route to the default token path — likely `purpose: "call"`. This is appropriate for group calls (not AI voice), but it is worth noting that if the C1 policy gate is ever required for all voice sessions, this call site would need updating.

Not a current violation, but a point of architectural asymmetry worth tracking.

**Recommendation:** Add an explicit `purpose: "call"` parameter to make the intent legible and future-proof against token-endpoint changes.

---

### F-MO-08 — INFO — Phase E context-publisher: correct BFF routing, no emit, ADR-0132/0134 satisfied

**Files:**  
- `apps/mobile/src/hooks/use-botsson-context-publisher.ts`  
- `apps/mobile/src/hooks/use-botsson-voice-session.ts`

**Verified commits:** `e6e0f8709` (context publisher), `94bcf5140` (voice session), `bb5d720bd` (bearer auth lift per `87a780f01` merge).

All three ADR requirements for Phase E Botsson mobile are satisfied:

1. **ADR-0132 (thin client):** Context publisher calls `/api/botsson/voice/session-context` on the BFF using Bearer auth. No direct capability invocation. The BFF URL is derived from `getWebApiUrl()` which throws in production if `EXPO_PUBLIC_WEB_API_URL` is unset.

2. **ADR-0134 (telemetry):** The context publisher explicitly documents "Publisher is read-only — no emit() from this side (ADR-0134)." `useVoiceTranscripts` correctly resolves `getProfileContext()` before emitting `voice.session_started` / `voice.session_ended`. The `nonEmpty()` guard is applied on both `workspace_id` and `actor_id` (lines 314–315 of `use-voice-transcripts.ts`). Telemetry failure is swallowed (catch block) so voice UX is never broken by missing context.

3. **ADR-0135 (LiveKit):** Token is minted via `getLiveKitToken(supabase, { channelId, workspaceId, purpose: "ai_voice" })` — the `ai_voice` purpose routes to the C1 edge function that enforces `channel_ai_policy.voice_participation`. `listen_only` policy is respected (mic is not published). Krisp NC is loaded conditionally on non-web platform (lines 56–64).

No findings on Phase E specifically.

---

## ADR-0133 Surface Boundary Check (mobile authoring UIs)

Verified per ADR-0133 ("Web composes, mobile executes"):

| Forbidden authoring UI | Present on mobile? | Notes |
|------------------------|-------------------|-------|
| Schedule drag-drop editor | No | |
| Onboarding wizard | No | |
| Contract authoring | No | Contract view exists (`(me)/contract/`) but is read-only employee view |
| Governance authoring | No | |
| Year-wheel | No | |
| Cost/billing | No | |

**Note:** `apps/mobile/app/(app)/(shifts)/create.tsx` (Ny vakt / Create Shift screen) exists. This is a manager action (creating a shift for an employee), NOT the forbidden "schedule drag-drop editor" authoring UI. It routes through the web BFF (`POST /api/mobile/shifts`) per ADR-0270. The distinction is:
- Forbidden: full drag-drop schedule authoring, bulk editing, publishing workflows
- Allowed: simple shift-create form for urgent/manual additions, gated by manager role

This is within the "Approve/Execute/Witness" verb category (D6 production). Not a violation.

---

## Known FPs Skipped

None declared for this slice in the task brief.

---

## Files Inspected

- `apps/mobile/src/lib/profile-context.ts`
- `apps/mobile/src/hooks/use-botsson-context-publisher.ts`
- `apps/mobile/src/hooks/use-botsson-voice-session.ts`
- `apps/mobile/src/hooks/use-voice-transcripts.ts`
- `apps/mobile/src/providers/botsson-provider.tsx`
- `apps/mobile/src/providers/botsson-channel.ts`
- `apps/mobile/src/hooks/queries/use-botsson-chat.ts`
- `apps/mobile/src/lib/web-api.ts`
- `apps/mobile/src/lib/sync/schemas.ts`
- `apps/mobile/src/lib/sync/queue.ts`
- `apps/mobile/src/lib/sync/action-map.ts`
- `apps/mobile/src/components/ai/BotssonSheet.tsx`
- `apps/mobile/src/components/shift-clock/ShiftClockView.tsx`
- `apps/mobile/src/hooks/mutations/use-availability.ts`
- `apps/mobile/src/hooks/mutations/use-checklist.ts`
- `apps/mobile/src/hooks/mutations/use-create-shift.ts`
- `apps/mobile/src/hooks/mutations/use-log-haccp.ts`
- `apps/mobile/src/hooks/mutations/use-punch.ts`
- `apps/mobile/src/hooks/mutations/use-report-deviation.ts`
- `apps/mobile/src/hooks/mutations/use-request-absence.ts`
- `apps/mobile/src/hooks/mutations/use-resolve-ticket.ts`
- `apps/mobile/src/hooks/mutations/use-send-channel-message.ts`
- `apps/mobile/src/hooks/mutations/use-send-message.ts`
- `apps/mobile/src/hooks/mutations/use-swap.ts`
- `apps/mobile/src/hooks/mutations/use-recon-wizard.ts`
- `apps/mobile/src/hooks/queries/use-my-profile.ts`
- `apps/mobile/src/hooks/queries/use-swap-requests.ts`
- `apps/mobile/src/hooks/queries/use-training-data.ts`
- `apps/mobile/src/hooks/shift-clock/useShiftChat.ts`
- `apps/mobile/app/(app)/_layout.tsx`
- `apps/mobile/app/(app)/(shifts)/create.tsx`
- `apps/mobile/src/components/chat/ConversationScreen.tsx`
