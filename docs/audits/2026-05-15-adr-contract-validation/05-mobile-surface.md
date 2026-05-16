---
title: "Audit 2026-05-15 — Slice 05 Mobile Surface"
slice: mobile-surface
surface: apps/mobile/**
adrs: [0132, 0133, 0134, 0135, 0136, 0158, 0238, 0268]
status: read-only
created: 2026-05-15
tags: [audit, mobile, adr]
---

# Slice 05 — Mobile Surface

## 1. Summary

| Severity | Count | Delta vs 2026-05-13 |
|----------|-------|---------------------|
| CRITICAL | 0     | 0                   |
| HIGH     | 4     | -2 (F-MO-01, F-MO-04 closed)  |
| MEDIUM   | 4     | +1 (F-MO-10 new)    |
| LOW      | 0     | 0                   |

Top 3 outstanding:

1. **F-MO-05** (HIGH) — `use-recon-wizard.ts` still performs direct `supabase.from("daily_reconciliation").insert/.update` with body-supplied `settled_by` and `workspace_id` from a DB-read session row. No BFF route exists at `apps/web/src/app/api/mobile/reconciliation/`. F-MO-05 is unchanged from 2026-05-13.
2. **F-MO-06** (HIGH) — `(me)/contract/complete-data.tsx:92,111` calls `submit_own_pii` RPC with body-supplied `p_workspace_id` from `profile?.workspace_id`. No BFF route exists. Unchanged from 2026-05-13.
3. **F-MO-08** (MEDIUM) — `lib/sync/action-map.ts` still has 8 direct-write handlers (`haccp_log`, `send_message`, `submit_handoff`, `request_absence`, `cancel_absence`, `break_start`, `break_end`, `shift_note_add`) outside BFF wrap. No new BFF routes added since 2026-05-13 for these.

---

## 2. Findings Table

| ID      | ADR     | Severity | File:Line                                        | Description                                                                 | Delta              |
|---------|---------|----------|--------------------------------------------------|-----------------------------------------------------------------------------|--------------------|
| F-MO-01 | 0134    | ~~HIGH~~ | `shift-clock/ShiftClockView.tsx:238-265`         | `?? ""` empty-string ID fallback on identity fields                         | **CLOSED** — fail-fast guard added; `currentTimeEntry` null returns blank screen |
| F-MO-02 | 0134    | HIGH     | `hooks/queries/use-training-data.ts:137`         | `workspace_id ?? null` — correctly widened to null; underlying hooks gate on `!!workspaceId` | **DOWNGRADED** to LOW — null is correctly propagated, no empty-string fallback |
| F-MO-03 | 0134    | HIGH     | `hooks/queries/use-swap-requests.ts:61`          | `workspace_id: row.workspace_id ?? null` — correctly returns null           | **CLOSED** — widened to `string \| null`; no empty-string mint |
| F-MO-04 | 0134    | ~~HIGH~~ | `components/shift/SwapRequestSheet.tsx:110-126`  | `target_profile_id ?? ""` removed; guard added before `initiateSwap()`      | **CLOSED** — early return on missing `employee_id` |
| F-MO-05 | 0132, 0151 | HIGH  | `hooks/mutations/use-recon-wizard.ts:200-248`    | Direct `supabase.from("daily_reconciliation").insert/.update` online path; `settled_by: profileId` + `workspace_id: session.workspace_id` body-supplied. No BFF route. | OPEN (unchanged)   |
| F-MO-06 | 0132, 0151 | HIGH  | `app/(app)/(me)/contract/complete-data.tsx:92,111` | `supabase.rpc("submit_own_pii", { p_workspace_id: workspaceId })` — body-supplied workspace_id from profile prop, no BFF route. | OPEN (unchanged)   |
| F-MO-07 | 0133    | MEDIUM   | `app/(auth)/verify.tsx`                          | Pre-auth `invitation` insert with client-derived `company_id`. ADR-0133 applies post-auth, edge case. | OPEN (unchanged)   |
| F-MO-08 | 0132    | MEDIUM   | `lib/sync/action-map.ts:76,102,146,170,175,187,226,288` | 8 offline-queue handlers still direct-write (`haccp_log`, `send_message`, `submit_handoff`, `request_absence`, `cancel_absence`, `break_start`, `break_end`, `shift_note_add`). | OPEN (unchanged)   |
| F-MO-09 | 0238    | MEDIUM   | `app/(app)/_layout.tsx`                          | No `<DomainChatOwnership>` pattern on mobile — no dual-surface risk today but gap exists for future screens. | OPEN (unchanged)   |
| F-MO-10 | 0132, 0151 | MEDIUM | `hooks/mutations/use-send-channel-message.ts:72` and `hooks/mutations/use-send-message.ts:177,194` | Two channel-message insert hooks write `workspace_id` and `sender_id` from caller-supplied props (props sourced from `useMyProfile` JWT-backed row, so not user-forgeable but not server-derived by BFF). ADR-0132 R4 permits direct data calls — arguable border case. New finding. | NEW                |

---

## 3. Per-ADR Rollup

| ADR   | Status                                                                                          |
|-------|-------------------------------------------------------------------------------------------------|
| 0132  | Partially compliant. AI routing via BFF verified (`use-botsson-chat.ts` POSTs to `/api/emma/chat`; no `@smartout/ai` imports from mobile). Direct Supabase writes still exist in F-MO-05 (recon-wizard), F-MO-08 (sync action-map 8 handlers), F-MO-10 (channel message). BFF routes exist for: shifts, tasks, deviations, availability, swap, task-complete, shift-approve, bookings, day-info. Missing: reconciliation, PII intake, and the 8 sync-queue handlers above. |
| 0133  | Compliant on tab layout (ADR-0268 5-tab verified). `(shifts)/create.tsx` mounts shift-create UI — this is an admin/manager authoring verb on mobile. Routed through BFF (ADR-0270), which partially mitigates, but the screen itself exposes Author/Compose verb (shift-create for other employees). Existing tracked item; not escalated further without council. F-MO-07 pre-auth invitation insert is boundary case. |
| 0134  | Substantially improved. New mutation hooks (`use-create-task`, `use-checklist`, `use-create-day-info`, `use-submit-handoff`, `use-submit-supplement`, `use-cancel-absence`, `use-request-absence`) all use `getProfileContext()` before emit. F-MO-05 online path still has `settled_by: profileId` body-supplied (not getProfileContext-gated before the write, only before emit). |
| 0135  | Clean. No `ultravox-client` imports. LiveKit wired. `use-livekit-call.ts` + `use-push-to-talk.ts` present. |
| 0136  | Proposed status. No camera evidence implementation found. Schema migration (R1) not visible in mobile code. No `evidence_storage_path` field in completion entities. Acceptable — ADR is `proposed`, not `accepted`. |
| 0158  | Not directly audited (packages/ui dual-platform strategy). No violations surfaced by mobile mutation scan. |
| 0238  | Mobile equivalent of `<DomainChatOwnership>` not implemented (F-MO-09). Single chat surface today (BotssonSheet on FAB layer-2). No immediate defect. |
| 0268  | **COMPLIANT.** Layout verified: 4 visible tabs (`(calendar)`, `(shifts)`, `(chat)`, `(me)`) + center FAB. Hidden via `href: null`: `(home)`, `(komm)`, `(queue)`, `journey`. i18n keys `tabs.kalender/vakter/chat/minTid` in `constants/strings.ts`. ADR-0268 accept-checklist items 1-5 all verified. |

---

## 4. Verified Intentional / Clean

- **ADR-0132 R1 (no `@smartout/ai`)** — zero live imports. `AiWritingPanel.tsx` comment-only reference.
- **ADR-0132 R5 (no `chat_message` direct insert from mobile)** — confirmed. `use-botsson-chat.ts:354` explicitly notes "Mobile no longer inserts." Only read-path selects remain.
- **ADR-0134 fail-fast pattern** — `profile-context.ts` throws on missing IDs; returns `NonEmptyString` branded types. All 7 new mutation hooks since baseline use `getProfileContext()` before emit.
- **ADR-0268 5-tab** — fully compliant. Tab count, order, labels, i18n keys, hidden legacy suppression all verified.
- **ADR-0135 LiveKit** — zero Ultravox references. LiveKit hooks shipped.
- **ESLint rule `smartout/no-empty-string-identifier-fallback`** — in effect at `packages/eslint-config/plugins/smartout/rules/`. No `?? ""` on `workspace_id|profile_id|actor_id|entity_id` in `apps/mobile/src/**` (verified by grep; only display-string fallbacks remain).
- **`reconciliation-bff.ts` and `journey-bff.ts`** — BFF clients exist; no `@smartout/ai`; no body-supplied identity. `reconciliation-bff.ts` handles admin-override path only. The wizard save/submit path (`use-recon-wizard.ts` online path) remains direct (F-MO-05).

---

## 5. In-Progress / Tracked Items

- `feat/mobile-reconciliation-bff-wrap` — proposed in 2026-05-13 audit. No sortie created yet. F-MO-05 remains open.
- Phase 3f (ADR-0268 sub-sorties 3f.1-3f.4) in progress. `(home)` route group folders still present but suppressed via `href: null`.
- ADR-0136 (camera evidence) — `proposed` status; no implementation expected yet.

---

## 6. Delta vs 2026-05-13 Baseline

| Finding | 2026-05-13 | 2026-05-15 |
|---------|------------|------------|
| F-MO-01 ShiftClockView `?? ""` identity | HIGH OPEN | **CLOSED** — fail-fast null guard |
| F-MO-02 use-training-data `?? ""` | HIGH OPEN | **DOWNGRADED LOW** — `?? null` correctly propagated |
| F-MO-03 use-swap-requests `?? ""` | HIGH OPEN | **CLOSED** — widened to `string \| null` |
| F-MO-04 SwapRequestSheet `target_profile_id ?? ""` | HIGH OPEN | **CLOSED** — early-return guard |
| F-MO-05 recon-wizard direct write | HIGH OPEN | OPEN (no change) |
| F-MO-06 complete-data p_workspace_id | HIGH OPEN | OPEN (no change) |
| F-MO-07 verify.tsx invitation insert | MEDIUM OPEN | OPEN (no change) |
| F-MO-08 sync action-map 8 direct handlers | MEDIUM OPEN | OPEN (no change) |
| F-MO-09 DomainChatOwnership mobile gap | MEDIUM OPEN | OPEN (no change) |
| F-MO-10 channel-message workspace_id props | — | NEW MEDIUM |
| ADR-0268 tab drift (7→5) | HIGH OPEN | **CLOSED** — verified 5-tab canonical |
| 7 new mutation hooks | — | All ADR-0134 compliant (getProfileContext + emit) |

Net: 4 HIGHs closed → 2 HIGHs remaining (F-MO-05, F-MO-06). 1 new MEDIUM (F-MO-10). Total HIGH count: 6 → 2. Positive trend.
