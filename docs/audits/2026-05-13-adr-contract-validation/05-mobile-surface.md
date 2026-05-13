---
title: "Audit 2026-05-13 — Slice 05 Mobile Surface"
slice: mobile-surface
surface: apps/mobile/**
adrs: [0127, 0128, 0129, 0130, 0131, 0132, 0133, 0134, 0135, 0136, 0158, 0238, 0298, 0300, 0302]
status: read-only
created: 2026-05-13
---

# Slice 05 — Mobile Surface

## 1. Method

- ADR re-read: 0132 (thin client / BFF), 0133 (verb boundary), 0134 (telemetry contract +
  L-0083 empty-string), 0135 (LiveKit, not Ultravox), 0238 (Botsson surface disambiguation),
  0298/0300/0302 (task ontology + RPC read-path + Kalender wire).
- Greps on `apps/mobile/` (src + app):
  - `?? ""` near `(workspace_id|profile_id|actor_id|user_id)` — L-0083.
  - `supabase.functions.invoke` — ADR-0132 (none allowed).
  - `supabase.from(...).insert|update|upsert|delete` + `supabase.rpc(...)` — direct-write surface.
  - `getProfileContext` / `nonEmpty(` — ADR-0134 fail-fast pattern.
  - `ultravox`, `livekit`, `BotssonShell`, `DomainChatOwnership` — ADR-0135 + ADR-0238.
- Spot-read 14 files: `ShiftClockView.tsx`, `use-swap.ts`, `use-swap-requests.ts`,
  `use-training-data.ts`, `use-eligible-swap-shifts.ts`, `SwapRequestSheet.tsx`,
  `profile-context.ts`, `use-recon-wizard.ts`, `use-botsson-chat.ts`,
  `use-complete-calendar-task.ts`, `use-my-tasks.ts`, `(app)/_layout.tsx`,
  `(me)/contract/complete-data.tsx`, `(auth)/verify.tsx`, `lib/sync/action-map.ts`.

## 2. Baseline Verification

| ID    | Description                                                | Status 2026-05-13                                        |
|-------|------------------------------------------------------------|----------------------------------------------------------|
| F-MO-01 | `ShiftClockView` `?? ""` workspace_id (3 sites)          | **OPEN** — see §3 F-MO-01-OPEN.                          |
| F-MO-02 | `use-training-data` `?? ""` workspace_id                 | **OPEN** — line 134 still uses `?? ""` (read-path).      |
| F-MO-03 | `use-swap-requests` `?? ""` mapping                      | **OPEN (read-path)** — line 54 still maps `?? ""`.       |

F-MO-03 status nuance: the *write* side (`use-swap.ts`) is fully compliant —
`getProfileContext()` resolves before BFF + emit, IDs are `NonEmptyString`. Only the
*read* mapping in `use-swap-requests.ts:54` and the `target_profile_id ?? ""` on the
write-payload caller `SwapRequestSheet.tsx:114` remain.

ADR-0298 Sortie 1 deliverables verified shipped:
- `(me)/tasks/[id].tsx` deleted (not present in tree).
- `(home)/create-task.tsx` not present.
- `personal/tools.ts` entity_type fix — out of slice (web/ai package).
- Mobile-side task-complete routed through `/api/mobile/tasks/[id]/complete` BFF
  (`use-complete-calendar-task.ts`, `lib/sync/action-map.ts:113`).

ADR-0300 (Sortie B) verified: `useMyTasks` calls `supabase.rpc("fn_list_my_tasks")`
with no client-supplied `workspace_id` / `profile_id` (identity resolved server-side
inside SECURITY DEFINER RPC).

ADR-0302 (Sortie 4) verified: `(app)/_layout.tsx` mounts AddSheet + BotssonSheet,
FAB wired tap=home / swipe-layer-1=AddSheet / swipe-layer-2=stacked, `onLongPress`
absent. `DetailSheet.onComplete` prop accepts async handler (lines 85, 624-629).
`/api/mobile/tasks/personal/route.ts` exists.

## 3. Findings

### CRITICAL — none new

ADR-0132 R5 (no direct `chat_message` insert from mobile) — **verified clean**. Only
read-path `.from("chat_message").select(...)` remains; no mobile-side INSERT/UPDATE on
chat_message. Direct chat_conversation/chat_participant inserts still happen in
`use-botsson-chat.ts:156-173` (conversation bootstrap, not message persistence) —
arguably tolerable under ADR-0132 R4 "raw data reads/RLS-gated metadata" but worth
revisiting if Phase B collapse is meant to cover conversation rows too.

### HIGH

- **F-MO-01-OPEN — `ShiftClockView.tsx` L-0083 violations (5 sites total).**
  - L68: `const workspaceId = profile?.workspace_id ?? ""` (feeds `useSupplements` query
    enable-gate; benign rendering, but seeds empty-string into a hook contract).
  - L240-243: `time_entry_id`/`shift_id`/`profile_id`/`workspace_id` all `?? ""` when
    building the `AfterShiftView` prop. Four identity fields fall back to empty string
    in the same render block. If `currentTimeEntry` is null at render, downstream
    components receive forged-looking blank IDs.
  - L317: `profileId={profile?.profile_id ?? ""}` passed to `<TaskFeed>` — drives
    `assigned_to` filtering, so an empty-string fallback silently shows all-or-none
    tasks instead of failing fast.
  - Fix pattern: render an error/loading state when `profile`/`currentTimeEntry` is null;
    do NOT mint empty-string IDs.

- **F-MO-02-OPEN — `use-training-data.ts:134`.** `const workspaceId = profile?.workspace_id ?? ""`
  is then passed into `useAssignedProtocols` and `useReadinessScore` from
  `@smartout/training`. If those hooks fire the query unconditionally, an empty-string
  workspace filter leaks across RLS (RLS will still reject — defence holds — but the
  `?? ""` pattern is exactly what ADR-0134 R5.2-3 forbids).

- **F-MO-03-OPEN (read side) — `use-swap-requests.ts:54`.** `workspace_id: row.workspace_id ?? ""`
  in the returned `SwapRequest`. Pure read mapping; no emit downstream — but the type
  is now `SwapRequest.workspace_id: string` with a forged-blank under failure, which
  will appear in any future code that emits on swap response (already present in
  `use-swap.ts` — that hook re-resolves via `getProfileContext()`, so no live
  poisoning today). Tighten to `string | null` and stop hiding the null.

- **F-MO-04 (new) — `SwapRequestSheet.tsx:114` `target_profile_id: selectedShift.employee_id ?? ""`.**
  The BFF payload field for swap initiation. Server-side `bffPost(getShiftSwapInitiateUrl, ...)`
  receives an empty-string `target_profile_id` if `employee_id` is null. Server should
  reject, but the mobile contract should not synthesize forged identity fields. Replace
  with an `if (!selectedShift.employee_id) return` guard before `initiateSwap(...)`.

- **F-MO-05 (new) — `use-recon-wizard.ts:222-238`.** Mobile still performs direct
  `supabase.from("daily_reconciliation").insert / .update` (and again at lines 264-285
  for `submitWizard`). Per ADR-0132 R5 + Sortie 1 doctrine ("mobile mutations route through
  BFF"), reconciliation mutations should be `/api/mobile/reconciliation/*` BFF-wrapped.
  Identity (`workspace_id`, `settled_by`) is currently being supplied client-side
  (`workspace_id: session.workspace_id` L223 — `session` is a row read from DB so not
  strictly forgeable from JWT, but `settled_by: profileId` at L280 is a body-supplied
  field that crosses ADR-0151's intent). Sortie 1 BFF-wrapped 5 handlers; reconciliation
  was apparently scoped out. Track as `feat/mobile-reconciliation-bff-wrap`.

- **F-MO-06 (new) — `(me)/contract/complete-data.tsx:86,105` mobile-direct
  `supabase.rpc("submit_own_pii", { p_workspace_id, ... })`.** PII intake fires an RPC
  with a body-supplied `p_workspace_id` from `profile?.workspace_id`. The RPC itself
  may be safely RLS/role-bound, but per ADR-0132 (and the ADR-0298 task pattern of
  "no body-supplied workspace_id from mobile"), this should route through a BFF that
  derives workspace from the JWT (ADR-0151). Risk is low — `submit_own_pii` is
  authored to be self-grant — but the pattern violates the surface contract and
  contradicts the prominent header comment claiming "ADR-0078" without proving it.

### MEDIUM

- **F-MO-07 — `(auth)/verify.tsx:318` direct `invitation` insert during onboarding.**
  Mobile inserts an `invitation` row with client-derived `company_id`, `email`,
  `phone`. Pre-auth context; ADR-0132 only formally binds post-auth mobile. Still,
  this is authoring (per ADR-0133 R2 — "workspace setup / organization configuration
  is web-only"). Edge case (the invitation is "inbound" for a search-flow), but worth
  flagging.

- **F-MO-08 — `lib/sync/action-map.ts` direct writes for `haccp_log`, `send_message`,
  `submit_handoff`, `request_absence`, `cancel_absence`, `break_start`, `break_end`,
  `shift_note_add`.** These are the offline-sync queue handlers; payloads are pre-
  vetted via `lib/sync/schemas.ts` Zod schemas, so they should not carry forged
  identity. Still, only 5 handlers were BFF-wrapped in Sortie 1 (`report_deviation`,
  `complete_task`, `confirm_shift`, `confirm_hours`, `task-create via /api/mobile/tasks`).
  ADR-0298 R3 says "every `task.*` mutation through BFF"; non-task mutations are
  out-of-scope of that ADR but in-scope of ADR-0132. Net: 8 outstanding sync-queue
  handlers that should migrate to BFF in subsequent sorties — tracked, not blocking.

- **F-MO-09 — `(app)/_layout.tsx` mounts BotssonSheet + AddSheet globally with no
  `<DomainChatOwnership>` declaration.** ADR-0238 demands that pages with an embedded
  domain chat surface declare ownership so BotssonShell suppresses. The mobile equivalent
  pattern is not implemented. Today there is only one chat surface on mobile (the FAB-
  layer-2 BotssonSheet) so no dual-surface risk exists right now. But when journey-
  authoring or any other domain chat lands on mobile, this gap becomes an active
  defect class. Track as a future-proofing item.

### LOW / Informational

- ADR-0135 voice = LiveKit verified. Zero matches for `ultravox-client` or
  `UltravoxSession` in `apps/mobile/`. `livekit-client`, `@livekit/react-native`,
  `BotssonSheet`, `use-livekit-call.ts`, `use-voice-transcripts.ts` all wired.
- `supabase.functions.invoke` — only one commented-out reference in
  `AiWritingPanel.tsx:80`. Zero live mobile-direct Edge Function calls.
- `@smartout/ai` is not imported from `apps/mobile/` (capability layer untouched —
  ADR-0132 R1 holds).
- ADR-0134 fail-fast pattern in `profile-context.ts` correctly throws on
  missing/empty IDs and returns `NonEmptyString` branded types.

## 4. Counts

| Severity  | Findings |
|-----------|----------|
| CRITICAL  | 0        |
| HIGH      | 6 (F-MO-01-OPEN, F-MO-02-OPEN, F-MO-03-OPEN, F-MO-04, F-MO-05, F-MO-06) |
| MEDIUM    | 3 (F-MO-07, F-MO-08, F-MO-09) |
| LOW       | 0        |

Baseline F-MO-01, F-MO-02, F-MO-03 — **still open** (no remediation merged since
2026-05-10 snapshot). Surface trend: write-side telemetry contract is now clean
(use-punch / use-swap / use-create-shift / use-complete-calendar-task all
`getProfileContext()`-resolved), but read-side rendering and intra-render fallback
patterns still mint empty-string identity in `ShiftClockView` + read hooks.

## 5. Top-3 Critical One-Liners

1. **F-MO-01-OPEN** — `ShiftClockView.tsx:240-243` mints empty-string `workspace_id` +
   `profile_id` + `time_entry_id` + `shift_id` in one block when `currentTimeEntry` is
   null; AfterShiftView and downstream emits receive forged-blank identity (L-0083).
2. **F-MO-05** — `use-recon-wizard.ts` performs direct
   `supabase.from("daily_reconciliation").insert/.update` with body-supplied
   `settled_by` + `workspace_id` — Sortie 1 missed this; reconciliation mutations
   need BFF wrap per ADR-0132 R5 + ADR-0151.
3. **F-MO-06** — `(me)/contract/complete-data.tsx` calls `submit_own_pii` RPC with a
   client-supplied `p_workspace_id` from mobile, violating ADR-0132 (mobile thin
   client) and ADR-0151 (server-derived identity) for PII intake — the highest-risk
   surface to leak workspace context.
