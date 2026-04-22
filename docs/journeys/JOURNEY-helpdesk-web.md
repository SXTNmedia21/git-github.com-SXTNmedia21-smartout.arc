---
title: Journey — Helpdesk Web (Phase 1)
status: in_progress
updated: 2026-04-20
created: 2026-04-20
module: Helpdesk
tags: [journey, helpdesk, web, phase-1, desk-admin, ticket-thread]
---

# Journey — Helpdesk Web (Phase 1)

> End-user journeys for the desks admin surface and the ticket conversation
> view on web. Phase 1 scope: manual desk CRUD, manual ticket resolve. SLA
> darkening orb, auto-assign, search field, and reassignment demotion lands
> in Phase 2.
>
> Surfaces:
> - `/dashboard/komm/desks` — admin-only desk list
> - `/dashboard/komm/thread/[channelId]` — ticket conversation view

---

## Journey: Admin creates a desk

**Precondition:** caller is `company_member.role IN ('owner','admin')` and at least one eligible rep (`profile.role IN ('manager','admin','owner')`, `is_active=true`) exists in the workspace.

1. Admin navigates to `/dashboard/komm/desks` → System resolves user → profile → workspace → company, confirms admin role, fetches desks (non-archived, `channel_type='desk'`), eligible reps, and open-ticket counts via `engine_state` grouped by `desk_channel_id` → Admin sees the desks page with "Ny skranke" button top-right.
2. Admin clicks "Ny skranke" → System opens `CreateDeskDialog` → Admin sees name field (2–40 chars, no `<` `>`), optional description (≤140 chars), responsible rep combobox.
3. Admin fills "Lønn" as name, picks a rep, clicks save → Zod validation passes → System calls `createDesk` Server Action → re-verifies admin context → checks no existing desk with case-insensitive same name in workspace → inserts `channel(type='desk', responsible_profile_id=...)` → inserts `channel_member(role='representative')` for the rep → emits `helpdesk.desk.created` → revalidates `/dashboard/komm/desks`.
4. System returns `{ ok: true, deskId }` → Client appends optimistic `DeskCard` to the top of the list with staggered spring entrance → toast "Skranken finnes allerede" is NOT shown (happy path).
5. Admin sees the new desk card with lighthouse avatar (responsibility orb ringed around the rep's avatar) and "0 åpne" open-count badge.

**Postcondition:** `channel` row exists with `channel_type='desk'`, `responsible_profile_id` set, `is_archived=false`. `channel_member` row exists with `role='representative'` for the rep. `helpdesk.desk.created` event emitted, projected to `channel_event` via the ADR-0160 trigger.

**Error paths:**
- Non-admin opens `/dashboard/komm/desks` → `redirect("/dashboard/komm")` — the admin CTA is never shown.
- Name shorter than 2 chars / contains `<` or `>` → Zod rejects at Server Action boundary → toast "Invalid input."
- Duplicate name (case-insensitive match in workspace) → `createDesk` returns `{ ok: false, error: "Skranken finnes allerede." }` → toast shown, dialog stays open.
- Picked rep is not manager/admin/owner, is inactive, or belongs to another workspace → `assertResponsibleEligible` returns error → toast shown, insert skipped.
- Auth expired mid-flow → `resolveAdminContext` returns "Not authenticated." → toast.

---

## Journey: Admin reassigns a desk's responsible rep

**Precondition:** desk exists (admin-created per previous journey). Admin is viewing `/dashboard/komm/desks`.

1. Admin clicks "Endre ansvarlig" on an existing `DeskCard` → Client opens reassign `Dialog` pre-selecting the current rep.
2. Admin picks a different rep from `ResponsibleRepCombobox` → clicks "Lagre" → Client calls `updateDeskResponsible`.
3. System re-verifies admin context → loads the desk (confirms `channel_type='desk'` and workspace match) → validates new rep eligibility → captures `previousResponsibleId` before the write.
4. System updates `channel.responsible_profile_id` → if previous rep differs from new, demotes them via `channel_member.role='member'` (prevents ghost-representative accretion per L-0080) → upserts new rep as `channel_member(role='representative')`.
5. System emits `helpdesk.desk.responsible_assigned` with `new_responsible_profile_id`, `previous_responsible_profile_id`, `was_orphan: false` → revalidates page.
6. Client receives `{ ok: true }` → updates the card's responsible slot optimistically → toast "Ansvarlig oppdatert." → dialog closes.

**Postcondition:** `channel.responsible_profile_id` points to new rep. Previous rep still a channel_member but role demoted to `member` (history preserved). Telemetry event emitted.

**Error paths:**
- Orphan desk path (desk has `responsible_profile_id=null`): click "Tildel ansvarlig" (dialog title reads orphan-CTA) → same flow, `was_orphan: true` in emission, no prior rep to demote.
- New rep not eligible → error from `assertResponsibleEligible` → toast, desk unchanged.
- Desk ID belongs to different workspace (URL-tampering) → "Desk belongs to a different workspace." → toast.
- Concurrent write race (two admins reassign at once) → last write wins; telemetry captures both but only the final state persists.

---

## Journey: Admin archives a desk

**Precondition:** desk exists, admin is on `/dashboard/komm/desks`.

1. Admin clicks the archive option on a `DeskCard` → Client calls `archiveDesk({ desk_channel_id })` → System re-verifies admin context → loads desk → updates `is_archived=true` → emits `helpdesk.desk.archived`.
2. Server returns `{ ok: true }` → Client filters the desk out of local state with exit animation (opacity 0, x+24px, 2px blur) → toast "Skranken er arkivert."

**Postcondition:** `channel.is_archived=true`. Open tickets assigned to the desk remain in `engine_state` (Phase 1 does not cascade-close). Desk no longer appears on the admin page.

**Error paths:**
- Desk not found / wrong workspace → `{ ok: false }` → toast with error → card remains.
- Archiving a desk with open tickets → **no guard in Phase 1.** Admin must resolve or reassign tickets manually. Phase 2 candidate: block archive with open-count warning.

---

## Journey: Rep (assignee) resolves a ticket

**Precondition:** `engine_state` row exists for `process_id='helpdesk_query_lifecycle'`, `status IN ('waiting','active')`, `assignee_id` = rep's `profile_id`. Ticket channel (`channel_type='query_thread'`) has at least one message.

1. Rep clicks a ticket link (from the queue sheet, a notification, or direct URL) → navigates to `/dashboard/komm/thread/[channelId]` → System resolves user → profile → workspace, loads channel (validates `channel_type='query_thread'` and workspace match), loads `engine_state`, hydrates requester + assignee profiles.
2. System checks access: `isAssignee = ticket.assignee_id === profile.profile_id` OR `isRequester` OR `isAdmin` (via `company_member`) → rep passes as assignee → `canResolve=true`.
3. Rep sees `TicketHeader` (status badge, summary, requester orb, assignee avatar) + existing `MessageTimeline` (reused from Komm) + `MessageInput` composer (also reused).
4. Rep types a reply, hits send → `MessageInput` inserts `channel_message` as normal Komm flow → timeline updates in realtime.
5. Rep clicks "Løs sak" → `ResolveTicketDialog` opens with optional resolution note field → Rep types optional note, clicks confirm → Client calls `resolveTicket` Server Action.
6. System writes `engine_state.status='complete'` AND `engine_state.completed_at=now()` (L-0079 — dispatcher-equivalent stamping) → writes resolution note into `context.resolution_note` + `context.resolved_at` → emits `helpdesk.query.resolved` → engine-dispatch advances the lifecycle state machine past step 2.
7. Client updates local `displayStatus='complete'` + `resolvedAt` → header swaps to complete-state orb → `MessageInput` is replaced by `ComposerLockedStrip` reading "Samtalen er avsluttet." → dialog closes.

**Postcondition:** Ticket terminal. `engine_state.completed_at` set (so SLA reports include it). `channel.is_read_only` remains false (Phase 1 leaves the thread readable but composer-locked via UI, not DB flag). Telemetry fired. Channel event projected to Komm UI.

**Error paths:**
- Non-involved user hits the URL → `redirect("/dashboard/komm")` — no leak of ticket existence.
- Ticket from a different workspace (URL-tampering) → `notFound()`.
- Channel is not `query_thread` (user hand-types a chat channel ID) → `redirect("/dashboard/komm")`.
- Requester views own ticket → sees header + timeline + composer (can reply) but NO "Løs sak" button (`canResolve=false`).
- Admin views ticket they're not assigned to → `canResolve=true` (admin override); still resolves cleanly.
- Resolve fails (network / Supabase error) → dialog stays open, error toast, ticket unchanged.
- Attempt to resolve an already-complete ticket → capability tool rejects; client never re-opens the dialog for complete tickets (button hidden behind `displayStatus !== 'complete'`).

---

## Journey: Admin peeks at a desk's queue without leaving the page

**Precondition:** desk has `responsible_profile_id` set and at least one open ticket.

1. Admin clicks the queue affordance on a `DeskCard` → Client opens `QueueSheet` (side sheet) with desk name, responsible rep, and open count.
2. Sheet renders the queue (fetched from `engine_state` filtered by `context.desk_channel_id`) → Admin can click a row to jump to `/dashboard/komm/thread/[channelId]`.
3. Admin closes the sheet → returns to desks list, state preserved.

**Postcondition:** No mutation. Read-only observation path.

**Error paths:**
- Desk has no responsible (orphan) → sheet does not open; admin is steered to the reassign dialog instead (see reassign journey, orphan CTA branch).

---

## Not in scope for Phase 1 (Phase 2+ candidates)

- SLA darkening orb (hue 50 → hue 40 as timeout approaches) — requires `engine_delayed_trigger` wiring.
- Auto-assign when requester opens a ticket (Phase 1 is manual: the opener tool sets `assignee_id=responsible_profile_id` from the desk at creation time).
- Search field on desks page — spec prescribes it when >10 desks; deferred.
- Archive-with-open-tickets guard.
- Ticket reassignment from the thread view — Phase 2 follows ADR-0161's reassignment process step.
- Four-eyes approval for HR/payroll desks — Phase 3, blocked on ADR-0135.
