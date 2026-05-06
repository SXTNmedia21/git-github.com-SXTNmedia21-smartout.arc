---
title: "Slice 05 — Mobile Surface ADR/Contract Audit"
status: done
created: 2026-05-06
updated: 2026-05-06
module: mobile
tags: [audit, adr-0132, adr-0133, adr-0134, adr-0135, adr-0238, mobile]
---

# Slice 05 — Mobile Surface ADR/Contract Audit

**Auditor:** slice-05-mobile-surface  
**Date:** 2026-05-06  
**ADRs covered:** 0127–0136, 0158, 0193, 0238  
**Trap:** L-0083 (`actor_id: "anonymous"` corruption)

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 1 |
| HIGH     | 3 |
| MEDIUM   | 4 |
| LOW      | 1 |

---

## CRITICAL

### C1 — ContentCreator: direct Supabase write + no emit + no getProfileContext
**File:** `apps/mobile/src/components/spokesperson/ContentCreator.tsx:133`  
**ADR:** 0134, 0133  
**Status:** stable code (not in active sub-sortie)

`handleSubmit` does a direct `supabase.schema("websites").from("website_spokesperson").update(...)` with no `emit()`, no `getProfileContext()`, and no BFF routing. The comment ("for now we emit a lightweight event directly") was written when there was no emit at all — the function ends with `onSubmitted()` and no telemetry fires. Three violations in one call site: no emit (ADR-0134), no identity resolution (ADR-0134 Invariant 2), and a direct Supabase write that bypasses any gate_action or authority check. The content submission is also an "Execute/Witness" verb (employee submitting content per D6 task), which is within mobile scope per ADR-0133, so the surface boundary is fine — but the implementation is not.

---

## HIGH

### H1 — Six caller-supplied-ID mutation hooks missing getProfileContext (ADR-0134 unclosed)
**Files:**
- `apps/mobile/src/hooks/mutations/use-checklist.ts:48,103`
- `apps/mobile/src/hooks/mutations/use-create-task.ts:49`
- `apps/mobile/src/hooks/mutations/use-create-day-info.ts:49`
- `apps/mobile/src/hooks/mutations/use-log-haccp.ts:56`
- `apps/mobile/src/hooks/mutations/use-submit-handoff.ts:44`
- `apps/mobile/src/hooks/mutations/use-report-deviation.ts:66`

**ADR:** 0134  
**Status:** stable (not in active sub-sortie)

All six hooks use `nonEmpty(payload.workspaceId, ...)` / `nonEmpty(payload.reported_by, ...)` rather than resolving via `getProfileContext()`. The `nonEmpty()` call does prevent the empty-string L-0083 corruption, so this is not the same class as the baseline `?? "anonymous"` bug. However, ADR-0134 R1 mandates that identity MUST be resolved from `getProfileContext()` BEFORE emit — the baseline (2026-05-02) already identified this as a finding. The concern is that callers can supply any string (including a different profile's ID or an arbitrary value) and it will pass `nonEmpty()` — the mutation hook never independently verifies that the supplied ID matches the authenticated session. This is forgeable attribution, same class as ADR-0151/L-0177.

**Delta vs 2026-05-02:** Six sites identified in baseline. Still open. `use-send-channel-message` (which was also in the list) still uses `nonEmpty(senderProfileId, ...)` without `getProfileContext()`.

### H2 — Legacy Botsson chat uses `chat_message` direct insert (ADR-0132 R5 deprecated path)

[Corrected by S5a 2026-05-06: original line numbers for useShiftChat.ts were reads not writes — see correction note below]

**Files:**
- `apps/mobile/src/hooks/queries/use-botsson-chat.ts:393`
- `apps/mobile/src/hooks/shift-clock/useShiftChat.ts:238` (real write — see correction below)

**ADR:** 0132  
**Status:** `use-botsson-chat.ts` is in-progress (campaign/mobile, BFF-path partially wired); `useShiftChat.ts` not in active sub-sortie

`use-botsson-chat.ts` routes user turns via the web BFF (`/api/emma/chat`, correct per ADR-0132) but then inserts assistant turns back directly into `chat_message` table (line 393). The comment acknowledges this as "dual persistence acknowledged debt per Council 2026-04-17 — collapsing to a single store is Phase B." `useShiftChat.ts` has a direct write at line `:238` via `enqueue("send_message")` which writes to `channel_message` (NOT `chat_message`) with no BFF routing and caller-supplied `senderProfileId` without `getProfileContext()` cross-check.

**Correction (S5a 2026-05-06):** The original audit listed `useShiftChat.ts:65,159` as direct `chat_message` inserts. S4 verification showed those lines are reads — `:65` is a SELECT query, `:159` is a Realtime subscription. The real write is at `:238` `enqueue("send_message")`, which writes to `channel_message` (a different table from `chat_message`). This is an H1-class forgeable-attribution finding for `channel_message` with caller-supplied `senderProfileId`, tracked under M4 sub-sortie on `campaign/mobile`.

ADR-0132 R5 set a week-6 deadline ("must be removed by week 6"). That deadline has passed. The in-progress campaign sub-sorties are moving this forward, so this is downgraded to HIGH (not CRITICAL) but remains open.

### H3 — BotssonSheet and BotssonProvider comments reference Ultravox (ADR-0135)
**Files:**
- `apps/mobile/src/components/ai/BotssonSheet.tsx:8,54,128`
- `apps/mobile/src/providers/botsson-provider.tsx:7,42,112,147,242`

**ADR:** 0135  
**Status:** `feat/mobile-shift-system-polish` DIRTY — may be in-flight

The implementation is correctly LiveKit (C1.b path uses `useBotssonVoiceSession` → LiveKit). However, multiple comments describe "Ultravox WebRTC" as the voice provider and `voiceSessionRef` is explicitly labelled "legacy Ultravox path." Line 242 retains a dead Ultravox code path (`voiceSessionRef.current?.leave()` / `session.muteMic()`) that is never reached on native but can be reached on web bundle. On web, `startVoiceSession()` calls `voice.start()` (LiveKit) but `endSession()` and `openWithIntent()` also call `voiceSessionRef.current?.leave()` — a ref that is never populated via the LiveKit path, so these are harmless dead code, but the Ultravox interface type (`VoiceSession`) is retained and the comments actively mislead about the active provider.

**Delta vs 2026-05-02:** Not in 2026-05-02 baseline. New finding from this slice.

---

## MEDIUM

### M1 — `haccp_log` action in sync worker uses direct Supabase insert (not BFF)
**File:** `apps/mobile/src/lib/sync/action-map.ts:76`  
**ADR:** 0132  
**Status:** stable

`haccp_log: (p) => assertOk(supabase.from("haccp_log").insert(p as never))` — direct insert, no BFF. HACCP logging is an Execute/Witness verb (food safety, per D6) which is in-scope for mobile (ADR-0133). The action passes through Zod schema validation (schemas.ts requires `workspace_id: uuid, profile_id: uuid`) so attribution is validated, but the action bypasses the C4 authority gate and any server-side emit. `use-log-haccp.ts` does emit client-side (with `nonEmpty` on caller-supplied payload IDs — H1 applies). This is lower severity because HACCP is clearly offline-first compliance data and the direct insert is intentional design, but there is no gate_action guard. Flag as MEDIUM pending confirmation that `haccp_log` is explicitly excluded from C4 authority in the engine_authority_config.

### M2 — `use-recon-wizard.ts:376` partial `getProfileContext` — only `profileId`, no `workspaceId`
**File:** `apps/mobile/src/hooks/mutations/use-recon-wizard.ts:376`  
**ADR:** 0134  
**Status:** `feat/mobile-shift-system-polish` DIRTY — may be in-flight

Line 376 calls `const { profileId } = await getProfileContext()` for a session-lookup query, destructuring only `profileId`. The function is `fetchSessionForLeaderCheck` (a read, not a write), so no emit is triggered here. No ADR-0134 violation for this specific call (it is a data read). However, the recon wizard's emit calls (lines 142, 242, 287) use `getProfileContext()` correctly with both fields. Low-risk for telemetry, included for completeness.

### M3 — Tab layout retains orphaned folders with `href: null` (ADR-0133 drift)
**File:** `apps/mobile/app/(app)/_layout.tsx:85–91`  
**ADR:** 0133  
**Status:** `feat/mobile-mobile-restore-4tab-plan` in-progress

`digest`, `(komm)`, `(queue)`, `journey`, and `(home)` folders exist with `href: null` in Tabs config — they are unreachable but not deleted. This is exactly the "4tab drift" captured in memory (2026-05-03). The comment on line 8 says "(home), digest, (komm)" were removed from config. The active sub-sortie `feat/mobile-mobile-restore-4tab-plan` is addressing this. **Downgraded to MEDIUM (in-progress).**

Current layout is now 5-tab per ADR-0268 (Kalender · Vakter · FAB · Chat · Min Tid), not the 6-tab drift noted in the 2026-05-03 memory. Partial fix landed.

### M4 — `use-send-channel-message` direct `supabase.from("channel_message").insert` without BFF
**File:** `apps/mobile/src/hooks/mutations/use-send-channel-message.ts:72`  
**ADR:** 0132 R4  
**Status:** `feat/mobile-addsheet-server-action-migration` in-progress

ADR-0132 R4 explicitly allows direct Supabase data reads per ADR-0029 but is silent on writes. Channel message sending is user-generated content (not AI/capability traffic), so it may fall under the R4 exemption. However, the write includes no authority gate and the caller supplies `senderProfileId` without `getProfileContext()` cross-check (H1 class). Flagged MEDIUM as it is borderline on the BFF routing rule.

---

## LOW

### L1 — `use-recon-wizard` `getProfileContext` call on line 376 creates `any`-schema cross-type bridge
**File:** `apps/mobile/src/lib/sync/action-map.ts`  
**ADR:** general code quality  
**Status:** stable

The `fromOtherSchema` helper casts to `as never` for cross-schema access (timesheet, payroll). This is the documented pattern for the non-public schemas given Supabase's typed client limitation. Risk is contained by the function's single-purpose scope. The comment explains the invariant. Included for completeness.

---

## Delta vs 2026-05-02 Baseline

| Baseline finding | Status 2026-05-06 |
|-----------------|-------------------|
| `ShiftTimelineContainer.tsx:46` `actorId = profile?.profile_id ?? "anonymous"` | **CLOSED** — file now uses `getProfileContext()` correctly throughout |
| 11 offline sync action types emit zero | **PARTIALLY CLOSED** — `break_start`, `break_end`, `create_task` (via BFF) now emit. `haccp_log`, `punch_in/out` sync via hook emit. `confirm_shift`, `submit_handoff`, `complete_task`, `confirm_hours`, `request_absence`, `cancel_absence`, `shift_note_add` still emit zero in action-map (action-map handles the write; client-side hooks do the emit). Pattern is intentional (server-side write = hook emit, not action-map emit), but `sign_checklist` / `complete_checkpoint` action-map has no emit even in the hook — MEDIUM gap. |
| 6 mutation sites caller-supplied workspace_id no cross-check | **OPEN** — H1 above. Still 6+ sites. `nonEmpty()` prevents empty-string corruption (L-0083 closed) but forgeable attribution gap remains. |
| `use-swap.ts` empty `workspace_id: ""` | **CLOSED** — now routes via BFF; `getProfileContext()` called before emit |
| `use-punch.ts:141-142` `workspace_id: null` | **CLOSED** — punchOut now calls `getProfileContext()` at line 100 |
| `use-create-shift.ts:69` `actor_id: ""` | **CLOSED** — mobile shift-create removed; BFF delegation implemented |

**L-0083 (`"anonymous"` corruption):** Fully closed. No `?? "anonymous"` patterns found in `apps/mobile/src`.

---

## In-Progress (Active Sub-Sorties)

| Sub-sortie | Files affected | Audit impact |
|---|---|---|
| `feat/mobile-mobile-restore-4tab-plan` | `app/(app)/_layout.tsx` | M3 — tab drift fix in flight |
| `feat/mobile-shift-system-polish` (DIRTY) | Possibly `botsson-provider.tsx`, `BotssonSheet.tsx` | H3 Ultravox comments may be addressed |
| `feat/mobile-addsheet-server-action-migration` | `use-send-channel-message.ts` | M4 may be addressed |
| `feat/mobile-addsheet-task-bff-wrap` | Task-related BFF wiring | M1 scope overlap possible |
| `feat/pwa-telemetry-build` | Telemetry build | ADR-0134 assertion enforcement |

H1 (caller-supplied-ID telemetry forgery) is NOT covered by any active sub-sortie. C1 (ContentCreator) is NOT covered. H2 (chat_message legacy) is partially covered by campaign/mobile but not by any named sub-sortie.

---

## Top 3 Findings for Immediate Action

1. **C1** — `ContentCreator.tsx:133`: direct write, no emit, no identity check. One file, isolated mutation. Fix: route via BFF or at minimum call `getProfileContext()` and `emit()`.
2. **H1** — Six caller-supplied-ID hooks: forgeable attribution. Pattern fix: `getProfileContext()` replace for all 6 + update callers to not pass IDs. Blocked on no active sub-sortie owning this.
3. **H2** — `chat_message` direct insert in `use-botsson-chat.ts:393` + `useShiftChat.ts`: week-6 deadline missed. Needs explicit sortie or sub-sortie assignment in campaign/mobile.
