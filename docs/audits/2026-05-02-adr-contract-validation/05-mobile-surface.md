---
title: Mobile Surface — ADR Contract Validation
status: done
updated: 2026-05-02
created: 2026-05-02
module: mobile
tags: [audit, adr, mobile, telemetry, voice, ADR-0127, ADR-0132, ADR-0133, ADR-0134, ADR-0135]
---

## Summary (top 5 findings)

1. **VIOLATION — ADR-0134 actor_id empty-string fallback** (`ShiftTimelineContainer.tsx:46`): `actorId = profile?.profile_id ?? "anonymous"` bypasses `getProfileContext()`. The string `"anonymous"` is non-empty so it passes `nonEmpty()` but silently corrupts `activity_trail` and `engine_event` attribution. This is the exact anti-pattern ADR-0134 bans. **Severity: HIGH.**

2. **STALE VOICE COMMENT — BotssonSheet docstring** (`BotssonSheet.tsx:8` and `:54`): Top-level JSDoc and inline comment say "Voice session powered by Ultravox WebRTC". The actual runtime path uses LiveKit (`use-botsson-voice-session.ts` + `botsson-provider.tsx:233`). Comment is stale post-ADR-0135 migration. Not a runtime violation, but creates misleading documentation that hides the real architecture. **Severity: MEDIUM (mislead risk).**

3. **ADR-0238 not applicable on mobile** — `DomainChatOwnership` / `BotssonShell` suppression is a web concept. Mobile uses `BotssonSheet` (single surface) which cannot host a competing domain chat at the same time. No violation, but the pattern is absent and cannot be verified. **Severity: N/A.**

4. **AiWritingPanel AI stub** (`AiWritingPanel.tsx:80`): The real AI call is commented out with a `TODO`. Current code uses a local stub function. Not an ADR-0132 violation (it never calls capabilities directly) — but the endpoint when eventually wired **must** go through BFF `/api/emma/*`, not direct `supabase.functions.invoke`. Risk is at future wiring point, not today. **Severity: LOW (flag for when wired).**

5. **Caller-supplied workspace_id not re-derived server-side** in several mutations (use-checklist, use-create-day-info, use-create-task, use-log-haccp, use-report-deviation, use-submit-handoff): These accept `workspace_id` as a caller parameter and emit with `nonEmpty()`, but do not call `getProfileContext()` to cross-check. They rely on the caller supplying the correct value. The BFF/RLS enforces server-side identity, so no immediate forgery risk, but this is the class of bug ADR-0134 was written to prevent. **Severity: MEDIUM.**

---

## Mutation site table

| File | Resolves workspace_id correctly? | Resolves actor_id correctly? | Uses getProfileContext? | Verdict |
|---|---|---|---|---|
| `use-availability.ts` | YES — getProfileContext | YES — getProfileContext | YES | PASS |
| `use-cancel-absence.ts` | YES — getProfileContext | YES — getProfileContext | YES | PASS |
| `use-confirm-hours.ts` | YES — getProfileContext | YES — getProfileContext | YES | PASS |
| `use-create-shift.ts` | PARTIAL — payload.workspace_id (caller-supplied, nonEmpty guarded) | YES — getProfileContext | PARTIAL | WARN — workspace_id not cross-checked |
| `use-livekit-call.ts` | YES — getProfileContext | YES — getProfileContext | YES | PASS |
| `use-punch.ts` | YES — getProfileContext | YES — getProfileContext | YES | PASS |
| `use-recon-wizard.ts` | YES — getProfileContext | YES — getProfileContext | YES | PASS |
| `use-request-absence.ts` | YES — getProfileContext | YES — getProfileContext | YES | PASS |
| `use-resolve-ticket.ts` | YES — getProfileContext | YES — getProfileContext | YES | PASS |
| `use-submit-supplement.ts` | YES — getProfileContext | YES — getProfileContext | YES | PASS |
| `use-swap.ts` | YES — getProfileContext | YES — getProfileContext | YES | PASS |
| `use-checklist.ts` | CALLER-SUPPLIED — nonEmpty guarded | CALLER-SUPPLIED — nonEmpty guarded | NO | WARN |
| `use-create-day-info.ts` | CALLER-SUPPLIED — nonEmpty guarded | CALLER-SUPPLIED — nonEmpty guarded | NO | WARN |
| `use-create-task.ts` | CALLER-SUPPLIED — nonEmpty guarded | CALLER-SUPPLIED — nonEmpty guarded | NO | WARN |
| `use-log-haccp.ts` | CALLER-SUPPLIED — nonEmpty guarded | CALLER-SUPPLIED — nonEmpty guarded | NO | WARN |
| `use-report-deviation.ts` | CALLER-SUPPLIED — nonEmpty guarded | CALLER-SUPPLIED — nonEmpty guarded | NO | WARN |
| `use-submit-handoff.ts` | CALLER-SUPPLIED — nonEmpty guarded | CALLER-SUPPLIED — nonEmpty guarded | NO | WARN |
| `use-send-channel-message.ts` | CALLER-SUPPLIED — nonEmpty guarded | CALLER-SUPPLIED — nonEmpty guarded | NO | WARN |
| `use-send-message.ts` | CALLER-SUPPLIED — nonEmpty guarded | CALLER-SUPPLIED — nonEmpty guarded | NO | WARN |
| `ShiftTimelineContainer.tsx` | NULLABLE — `profile?.workspace_id ?? null` | **INVALID** — `?? "anonymous"` fallback | NO | **FAIL — ADR-0134 violation** |

---

## Per-ADR rollup

### ADR-0127 to 0131 — Mobile Strategy (web composes, mobile executes)
**PASS** — No evidence of D1–D5 authoring UIs on mobile. Mobile screens are execution surfaces: task completion, clock-in/out, shift approval, deviation reporting, swap request, absence request, handoff submission, reconciliation wizard. All consistent with D6 + C4 execution mandate.

### ADR-0132 — Mobile AI routing (thin client; via web BFF)
**PASS with caveat** — `use-botsson-chat.ts:353` uses `getEmmaChatUrl()` which resolves to `/api/emma/chat`. `web-api.ts` documents all BFF endpoints explicitly (emma/chat, emma/voice/transcript, journey/guided/*, reconciliation/wizard-override, shift-swap/*, availability/*). No direct capability calls found. `AiWritingPanel.tsx` is stubbed and the commented-out direct edge function call is flagged with a TODO — must route through BFF when wired.

### ADR-0133 — Mobile surface boundary
**PASS** — Forbidden authoring UIs not found: no schedule drag-drop editor, no onboarding wizard, no contract authoring, no governance authoring, no organization settings, no year-wheel, no cost/billing editor. `CreateDayInfoSheet` is a lightweight manager "quick add" (note/event/alert for a shift date) — this is a D6 execution action, not a D1–D5 authoring tool.

### ADR-0134 — Mobile telemetry contract
**FAIL (1 confirmed, 5 warnings)**
- `ShiftTimelineContainer.tsx:46`: `actorId = profile?.profile_id ?? "anonymous"` — confirmed ADR-0134 violation. `"anonymous"` passes `nonEmpty()` but is a corrupt identity. Fix: use `getProfileContext()` and gate rendering on identity resolution.
- `workspaceId = profile?.workspace_id ?? null` on same line — then passed to `nonEmpty()` which will throw at runtime if null, but that's an error-path throw rather than a silent fallback. This is acceptable per spec (fail-fast preferred over silent corrupt), but the `"anonymous"` fallback on actor_id is the bug.
- 6 mutations (checklist, create-day-info, create-task, log-haccp, report-deviation, submit-handoff) accept caller-supplied IDs without cross-checking via `getProfileContext()`. RLS prevents forgery, but these are inconsistent with the ADR-0134 mandate. WARN level.
- Offline queue (`sync/schemas.ts`): Zod-validated at enqueue. All schemas require UUID-typed IDs where present. **PASS** for offline path.

### ADR-0135 — Mobile voice via LiveKit
**PASS** — `use-botsson-voice-session.ts` imports `Room, RoomEvent` from `livekit-client`, uses `@livekit/react-native` AudioSession, and tokens are minted via `getLiveKitToken` from `@smartout/walkie-talkie`. `use-voice-transcripts.ts` subscribes to `LiveKit RoomEvent.TranscriptionReceived`. `botsson-provider.tsx:233` has a clear "New voice path (C1.b) — delegate to LiveKit participant control" comment separating the LiveKit path from the legacy Ultravox handle (kept for web bundle only). No active Ultravox calls on native path.

### ADR-0136 — Camera evidence
**PASS** — `expo-image-picker` used in `ContentCreator.tsx` for evidence capture. Pattern is: camera → local URI → Supabase Storage upload → reference stored. Consistent with cascade extension model.

### ADR-0158 — Dual-platform UI primitives
**PASS** — `src/platform/` contains `.web.ts` / `.web.tsx` shims for `bottom-sheet`, `haptics`, `image-picker`, `mmkv`, `sqlite`. Native paths use platform-native packages. Pattern is consistent.

### ADR-0238 — Botsson surface disambiguation
**N/A** — `DomainChatOwnership` is a web Dashboard concept. Mobile has a single Botsson surface (`BotssonSheet`) with no competing domain chat textbox. No web `BotssonShell` mounted on mobile. No violation, but the ADR's mechanism is web-only and has no mobile equivalent defined.

---

## Forbidden authoring UI check

| UI type | Found on mobile? | Evidence |
|---|---|---|
| Schedule drag-drop editor | NO | — |
| Onboarding wizard | NO | — |
| Contract authoring | NO | — |
| Governance authoring | NO | — |
| Organization settings | NO | — |
| Year-wheel | NO | — |
| Cost/billing editor | NO | — |

All clear. `CreateDayInfoSheet` is a lightweight shift-day annotation form (note/event/alert) — within D6 execution scope.

---

## Voice surface check

| Component | Voice package used | Compliant? |
|---|---|---|
| `use-botsson-voice-session.ts` | `livekit-client` Room + `@livekit/react-native` AudioSession | YES |
| `use-voice-transcripts.ts` | `livekit-client` RoomEvent.TranscriptionReceived | YES |
| `use-livekit-call.ts` | `livekit-client` Room + `@livekit/react-native` AudioSession | YES |
| `use-call-tracks.ts` | `livekit-client` event bindings | YES |
| `botsson-provider.tsx` | LiveKit path (C1.b) active; Ultravox handle retained for web bundle only | YES |
| `BotssonSheet.tsx` docstring | Says "Ultravox WebRTC" — **stale comment** | WARN |

ADR-0135 is satisfied at the runtime level. The `BotssonSheet.tsx` docstring referencing Ultravox should be updated to reflect the LiveKit migration.

---

## Required fixes

| Priority | File | Line | Issue |
|---|---|---|---|
| HIGH | `ShiftTimelineContainer.tsx` | 46 | `actorId = profile?.profile_id ?? "anonymous"` — replace with `getProfileContext()` and gate on identity resolution |
| MEDIUM | `BotssonSheet.tsx` | 8, 54 | Stale Ultravox references in docstring and inline comment — update to LiveKit |
| LOW | `AiWritingPanel.tsx` | 80 | When AI endpoint wired, must use `getEmmaChatUrl()` (BFF), not direct `supabase.functions.invoke` |
