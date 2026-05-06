---
title: JOURNEY — Audit Sortie 4, Mobile Remediation
status: draft
created: 2026-05-06
updated: 2026-05-06
module: mobile
tags: [audit, mobile, adr-0132, adr-0134, journey]
sortie: feat/audit-sortie-4-mobile-remediation
---

# User Journeys: Audit Sortie 4 — Mobile Remediation

Mobile end-user journeys impacted by this sortie. Fixes ensure attribution accuracy + architectural compliance with ADR-0132 (web BFF) + ADR-0134 (server-derived IDs).

---

## Journey: Employee logs HACCP entry on mobile

**Precondition:** Employee on shift, mobile app open. HACCP form filled with temp reading + observation note.

1. Employee submits form → `useLogHaccp` mutation fires → `getProfileContext()` resolves workspace_id + profile_id from auth state → DB write to `haccp_log` includes resolved IDs (NOT caller-supplied) → `emit({ event: "haccp logged", workspace_id, actor_id, entity_id })` → activity_trail row → engine_event row → Employee sees confirmation toast.

**Postcondition:** HACCP entry stored with verified attribution. Audit trail records who logged what when.

**Error paths:**
- `getProfileContext()` throws (auth not resolved, profile inactive) → mutation aborts before DB call → user sees "ikke pålogget" or equivalent.
- Caller payload includes `workspace_id` that doesn't match resolved context → mutation throws explicit mismatch error → operator alerted to bug.
- DB write fails → emit doesn't fire → user sees error.

**Pre-fix gap:** caller-supplied workspace_id passed to emit() without cross-check. Forgeable attribution — malicious or buggy code path could log under wrong workspace.

---

## Journey: Employee creates handoff for next shift

**Precondition:** Employee ending shift, has handoff notes for next person.

1. Employee submits handoff → `useSubmitHandoff` mutation fires → getProfileContext() resolves IDs → handoff row inserted → emit("handoff submitted") → activity_trail → next-shift employee sees handoff on shift-start.

**Postcondition:** Handoff persisted with verified author.

**Error paths:** as F2-F7 pattern.

---

## Journey: Employee chats with Mr. Botsson on mobile

**Precondition:** Employee opens Botsson chat on mobile. Asks question.

1. Employee types message → `useBotssonChat.sendMessage` fires → POST to `/api/emma/chat` BFF → BFF resolves auth + workspace + profile (server-derived per ADR-0151) → BFF forwards to stage-engine → stage-engine writes user message + AI response to `chat_message` table → response streams back to mobile → Employee sees AI reply.

**Postcondition:** Conversation in chat_message. Stage-engine is the SOLE writer. Mobile is thin client.

**Error paths:**
- BFF unreachable → mobile shows "kunne ikke nå Botsson" → no chat_message row.
- Stage-engine error → BFF returns 500 → mobile retries or surfaces error.

**Pre-fix gap:** mobile inserted directly to chat_message at line 393 — bypassed BFF + stage-engine. Two writers = race condition + ADR-0132 R5 violation.

---

## Journey: Employee chats during shift via shift-chat surface

**Precondition:** Employee in shift-clock view. Chat with manager or AI mid-shift.

1. Same flow as Botsson chat journey but via `useShiftChat` hook → BFF resolves shift context → stage-engine writes message with shift_id correlation → manager sees in dashboard.

**Pre-fix gap:** `useShiftChat:65` and `:159` inserted to chat_message directly. Same architectural breach as F8.

---

## Journey: Employee captures content (e.g. photo of dish, video of routine)

**Precondition:** Employee uses ContentCreator to capture media for training/documentation.

1. Employee captures media → `ContentCreator` component → ??? — INTENT UNCLEAR. Two possible architectures:

   **A. Authoring** (employee creates content for org consumption):
   - Per ADR-0133 ("web composes, mobile executes"), this should NOT exist on mobile. Mobile owns approve/execute/witness, NOT author/compose/plan.
   - Action: investigate use, likely move to web OR justify exception with ADR.

   **B. Witnessing** (employee records evidence of completed task):
   - Mobile-native superpower per ADR-0136 (camera evidence). Acceptable on mobile.
   - Refactor: `getProfileContext()` for actor_id, BFF for write, emit() on success.

**Pre-fix gap:** direct supabase.from() write at line 133. No emit. No getProfileContext. Bypasses BFF entirely. Worst-of-all-three violation. CRITICAL because data corruption possible (caller-supplied IDs).

---

## Journey: Operator reviews mobile mutations in activity_trail

**Precondition:** Operator (manager / admin) opens activity-trail dashboard. Filters for mobile-originated mutations.

1. Operator filters by source=mobile + workspace_id → activity_trail rows display → each row has actor_id, entity_id, event name, timestamp → Operator clicks event for full payload → audit complete.

**Pre-fix gap:** mobile mutations with caller-supplied IDs would show forgeable actor_id / workspace_id. Pre-fix audit confirmed L-0083 corruption pattern across 6 hooks. Post-fix: every mobile mutation has server-derived attribution.

**Postcondition:** Audit trail trustworthy for all mobile mutations.
