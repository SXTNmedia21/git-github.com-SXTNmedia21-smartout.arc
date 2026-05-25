---
title: "Sim findings — A4: Wednesday comms + Thursday helpdesk"
created: 2026-05-25
agent: A4
slice: Wed+Thu comms+helpdesk
status: draft
---

# Agent 4 — Comms & Helpdesk Findings (Wed + Thu)

> Persona: Norwegian hospitality comms-expert. Simulating Erik (manager) at Bella Vista bistro (18 staff, Oslo).
> All bugs are NEW — existing BUG-1/2/3/20 noted where they cascade but not re-reported.

---

## Wednesday — Announcement simulation

**Story:** Wednesday 15:00, kitchen pass starts mis-en-place for Restaurant Week. Erik opens Komm on web, navigates to `/dashboard/komm-nyheter`, and composes: "Sommermeny live i morgen — kjenn kartet." He wants to target only the **staff on shift this evening**.

---

### BUG-A4-01 — `on_duty` audience targets clocked-in staff, not scheduled staff — functional mismatch for pre-shift announcements

**Severity:** HIGH — PRODUCT

**What Erik wants:** "Send to everyone on shift Wed evening" — i.e., staff scheduled to arrive at 16:00 before they have clocked in. In a service industry context "on shift" = scheduled, not "currently punched in."

**What the code does:**

`audience_kind='on_duty'` in both the web hook and the agent capability resolves via `timesheet.time_entry WHERE punch_out IS NULL` (open time entries = currently clocked in):

- `apps/web/src/app/dashboard/komm/_hooks/use-audience-resolver.ts:46-61` — queries `time_entry.is_null(punch_out)`
- `packages/ai/src/capabilities/communication/audience-resolver.ts:59-73` — identical logic, same table

At 15:00 before the 16:00 shift starts, `punch_out IS NULL` returns 0 rows for the incoming evening crew. Erik sends to an audience of zero (or only the kitchen prep crew already in). The evening staff — the ones who need to know about the summer menu — receive nothing until they physically clock in.

**Real-world comparison:** WhatsApp group / Slack lets you target people by shift schedule regardless of whether they're physically there yet. Smartout has `schedule_shift` table with exact shift timings — the audience resolver never consults it.

**Missing kind:** `on_shift` (= `schedule_shift WHERE start_at <= NOW()+2h AND end_at >= NOW()`) as a distinct audience option, separate from `on_duty` (actively clocked in).

**Fix path:** Add `on_shift` audience kind to:
1. `AudienceKind` union — both files
2. `resolveAudience` branch in `audience-resolver.ts` (agent) — query `schedule_shift WHERE profile_id, workspace_id, status != cancelled, start_at <= :threshold`
3. `useAudienceResolver` hook (web) — same query
4. `publishAnnouncement` tool schema `audience_kind` enum description
5. `NyheterClient.tsx` audience picker UI

---

### BUG-A4-02 — `communication` capability absent from `capability_default_registry` — new workspaces get no authority seed

**Severity:** HIGH — PRODUCT (cascades for every new workspace, including Bella Vista)

**What the code does:**

`20260601100000_seed_communication_authority.sql` retroactively seeds `engine_authority_config` for `communication` on **existing** workspaces via INSERT-SELECT. But the `workspace_seed_authority_defaults_trg` trigger (which runs on `workspace INSERT`) only seeds capabilities in `capability_default_registry`. No migration has ever inserted `'communication'` into `capability_default_registry`.

Evidence:

```bash
grep -rn "'communication'" supabase/migrations/ | grep "capability_default_registry"
# → zero hits
```

The trigger function at `20260518000000_contract_authority_seed_upsert_and_bootstrap.sql:254-316` selects from `capability_default_registry`. Without a registry row, new workspaces created after the retroactive seed migration have no `communication` row in `engine_authority_config`.

The migration comment at line 33 acknowledges: *"New workspaces are covered by the workspace_seed_authority_defaults_trg AFTER INSERT trigger once communication is added to capability_default_registry (separate sortie — not in scope here)."* That sortie never shipped.

**Impact for Bella Vista:** Pontus creates the workspace Monday. The trigger fires but `capability_default_registry` has no `communication` row. Tuesday/Wednesday, `callGateAction(capability='communication')` hits the default-deny path (L-0066). `publishAnnouncement` returns `"Cannot publish announcement: authority gate denied"`. Erik cannot send any announcements or messages via agent. BUG-1 (from journey sweep) confirmed this surface breaks — this is the structural root cause for fresh workspaces.

**Fix path:** Add `capability_default_registry` insert for `'communication'` in a new migration (mirror pattern from `20260520130000_legal_capability_authority_seed.sql:73-80`).

---

### BUG-A4-03 — `publish-announcement.ts` channel lookup filters `is_archived=false` but new migration adds `is_active` as the correct field

**Severity:** MEDIUM — PRODUCT / Schema drift

**What the code does:**

`publish-announcement.ts` does NOT query the channel at all in the commit path — it calls the RPC directly. However, `tools.ts` `sendMessage` draft phase at line 219 filters `.is("is_archived", false)` to validate the channel. Meanwhile:

- `helpdesk_query/tools.ts:372` uses `.eq("is_active", true)` (for `engine_trigger`)
- `20260625130000_channel_is_active_column.sql` was added as a **new column** specifically because E2E tests filter `channel.is_active` — but the agent `sendMessage` tool still guards on the old `is_archived=false` semantics

These are now two orthogonal columns with different semantics (per migration comment: "orthogonal — a channel can be archived AND inactive"). The `sendMessage` channel validation in `tools.ts:219` only checks `is_archived=false`, which means a soft-deactivated channel (`is_active=false`) with `is_archived=false` would still pass the channel guard.

**Fix path:** Update `tools.ts:219` to also filter `.eq("is_active", true)`. Audit all other channel selects in capabilities for the same gap.

---

### GAP-A4-04 — `kind='new_menu'` exists in schema but no UI picker — Erik cannot tag the summer menu announcement correctly

**Severity:** MEDIUM — PRODUCT gap (Wave-B Track E deferred)

**What the code does:**

`publishAnnouncement` capability tool schema accepts `kind='new_menu'` (line 93 `publish-announcement.ts`). The DB has the enum value. But:

- `apps/web/src/app/dashboard/komm/_components/AnnouncementKindPicker.tsx` exists but is NOT mounted in `NyheterClient.tsx`'s compose path (per `docs/domains/announcements/GAPS-AND-DEBT.md:Wave-B-E`)
- Direct web compose path via `use-send-announcement.ts` has no `kind` field at all — defaults to DB default

**Real-world impact:** Erik publishes "Sommermeny live" but it lands as `kind='general'`, indistinguishable from a birthday notice. Maria's mobile view (`ChannelMessageBubble`) has no badge to visually prioritize the menu announcement. In a busy bistro during Restaurant Week, visual hierarchy between "menu change" and "social event" is operationally critical.

**Noted as existing debt** in `GAPS-AND-DEBT.md:Wave-B-E` — not a regression, but a confirmed functional gap for this simulation scenario.

---

### GAP-A4-05 — Mobile bulletin layout absent — Maria receives push but sees chat bubble, not card

**Severity:** MEDIUM — PRODUCT gap (Mobile gap M1)

**What Maria experiences:** Push notification arrives on her iPhone. She taps it, opens the Komm `news` channel. The announcement renders via `ChannelMessageBubble.tsx:55` as a **system chat bubble** — no card layout, no pinned strip, no reaction affordance.

**Real-world comparison:** Slack surfaces announcements in `#announcements` with a distinct card (author + content + reactions). WhatsApp groups have no distinction. Smartout mobile is currently worse than WhatsApp for this specific flow.

**Code-confirmed gap:** `docs/domains/announcements/GAPS-AND-DEBT.md:M1` + `OVERVIEW.md`. `NoShiftView.tsx` "Siste nytt" section is hardcoded placeholder.

---

### GAP-A4-06 — Home widget absent — no "latest news" surface before navigating to Komm

**Severity:** MEDIUM — PRODUCT gap

Erik publishes the announcement at 15:30. Maria's dashboard home shows nothing. She has to know to navigate to Komm → Nyheter. In a busy pre-service context this is friction a WhatsApp message removes entirely.

**Code-confirmed gap:** `docs/domains/announcements/GAPS-AND-DEBT.md:M2` — web and mobile home widget both absent. `NoShiftView.tsx` hardcodes placeholder string `"Ny sesongmeny er her!"`.

---

### BUG-A4-07 — `on_duty` audience resolver does not workspace-scope `time_entry` query — cross-workspace bleed risk

**Severity:** MEDIUM — PRODUCT / Security

**What the code does:**

`audience-resolver.ts:64-73` (agent) queries `timesheet.time_entry WHERE punch_out IS NULL LIMIT 500` with **no `workspace_id` filter**. The web hook (`use-audience-resolver.ts:51-61`) is identical.

In a multi-tenant platform where two workspaces share a Supabase project, all clocked-in employees from ANY workspace are included in the audience resolution when `kind='on_duty'` is selected.

RLS on `time_entry` may enforce workspace scope via `profile_id` → `profile.workspace_id` join, but the capability tool uses `supabaseAdmin` (service-role) which bypasses RLS. The agent `resolveAudience` comment at line 38: *"RLS is bypassed intentionally — the tool layer is responsible for enforcing authority via callGateAction before calling this."* But callGateAction does not filter audience resolution scope — it only gates the capability action.

**Fix path:** Add `.eq("workspace_id", workspaceId)` (or join via `profile`) to both `on_duty` resolver branches before the `punch_out IS NULL` filter.

---

## Thursday — Helpdesk SLA simulation

**Story:** Thursday 14:00, Sofia calls in sick. Erik marks her absent and then — worried — opens a helpdesk query to Sofia: "Ta vare på deg, når tror du du er tilbake?" SLA timer starts, manager-overdue badge expected after X hours.

---

### BUG-A4-08 — `HelpDesk.tsx` + `use-help-requests.ts` write to deprecated `help_request` table — tickets never enter `engine_state`

**Severity:** CRITICAL — PRODUCT

**What the code does:**

`apps/web/src/app/dashboard/komm/_components/HelpDesk.tsx` mounts the employee-facing quick-help dialog. It uses:

- `useCreateHelpRequest` (mutation: `supabase.from("help_request").insert(...)` — `use-help-requests.ts:49-60`)
- `useHelpRequests` (read: `supabase.from("help_request").select(...)` — `use-help-requests.ts:26-39`)

But `20260519110000_deprecate_help_request_table.sql` explicitly DEPRECATED this table: *"DO NOT WRITE"*, with a comment that new tickets use `engine_state(process_id='helpdesk_query_lifecycle')`.

**Cascade of failures for Erik's journey:**

1. Erik opens the HelpDesk dialog from Komm sidebar
2. `useCreateHelpRequest` inserts into the deprecated table — ticket is created there instead of firing `helpdesk.query.opened` event
3. No `engine_state` row is created → no SLA breach trigger (`engine_delayed_trigger`) is spawned
4. `useMinKo` (manager queue view) queries `engine_state` — returns zero results
5. No overdue badge, no queue count, no escalation path
6. Sofia never receives any message in a dedicated thread
7. `QueueSheet.tsx` queries `engine_state` for the desk queue — also returns nothing

The entire `helpdesk_query` capability flow (ADR-0161/0162/0165) is bypassed by the UI layer which never migrated off the legacy table.

**Root cause confirmation:** `use-help-requests.ts:53` writes `supabase.from("help_request")`. The correct path is `openTicket` tool → `emit('helpdesk.query.opened')` → `engine_state` spawn. The UI has no wiring to that tool.

**Note:** This cascades BUG-20 (all 4 helpdesk SLA tests fail). BUG-20 notes "engine_authority_config family" — but the UI bug is deeper: even if authority is fixed, `HelpDesk.tsx` still routes to the wrong table.

---

### BUG-A4-09 — Helpdesk `open_ticket` tool: engine_state spawn race has no workspace_id filter — could match wrong ticket on retry

**Severity:** MEDIUM — PRODUCT

**What the code does:**

After emitting `helpdesk.query.opened`, `tools.ts:186-205` polls `engine_state` up to 3 times to find the spawned ticket:

```ts
.eq("workspace_id", ctx.workspaceId)
.eq("process_id", "helpdesk_query_lifecycle")
.eq("entity_id", conversationChannelId)
.gte("started_at", emitTimestamp)
.order("started_at", { ascending: false })
.limit(1)
```

The query looks correct. However, `emitTimestamp` is set at emit-time (`const emitTimestamp = new Date().toISOString()`), and then 3 retries with 100ms gaps. Under high load or clock skew, the spawn may occur slightly BEFORE `emitTimestamp` (if the dispatcher runs synchronously and completes before the `new Date()` call after emit returns). The `.gte("started_at", emitTimestamp)` filter would then miss the just-spawned state and the tool returns the "best-effort" null response.

**Impact for Bella Vista Thursday:** Erik opens a query to Sofia. Tool returns `{ ticket_id: null, note: "Ticket is opening — id available via list_my_queue within seconds." }`. Erik sees no confirmation. He tries again, spawning a SECOND `engine_state` for the same channel. Double-ticket for a single sick-call query.

**Fix path:** Set `emitTimestamp` BEFORE the emit call (not after), or add a small pre-emit buffer: `const emitTimestamp = new Date(Date.now() - 50).toISOString()`.

---

### GAP-A4-10 — Manager-overdue badge is not realtime — SLA breach only surfaces on next page load or 15-second stale interval

**Severity:** MEDIUM — PRODUCT gap

**What the code does:**

`useMinKo` (the hook driving the "Min kø" sidebar overdue badge) has `staleTime: 15_000` — it refetches every 15 seconds. There is no Realtime subscription on `engine_state` in this hook. When the SLA breach handler fires (via `engine_delayed_trigger` → `fire-delayed-triggers` cron) and patches `engine_state.context.sla_breached_at`, Erik's browser may wait up to 15 seconds before the badge appears. Under a 1-hour SLA this is acceptable; under a 4-hour SLA it's fine. But the `MinKoSection.tsx` badge at line 108 (`data-testid="overdue-badge"`) is purely query-driven — no push.

**Real-world comparison:** Slack unread badges update immediately via WebSocket. Smartout's SLA notification arrives via push notification (via `engine_delayed_trigger` → notification outbox → Expo push), but the in-app badge relies on polling.

**Fix path:** Add Supabase Realtime subscription on `engine_state WHERE process_id='helpdesk_query_lifecycle' AND assignee_id=currentProfileId` in `useMinKo`, invalidating the TanStack Query on any UPDATE. Mirrors the pattern in `use-channel-realtime.ts`.

---

### BUG-A4-11 — ADR-0238 enforcement: `/dashboard/komm/thread/[channelId]` page declares `DomainChatOwnership` but the `DesksClient.tsx` + `QueueSheet.tsx` flow enters the thread via navigate — if Komm/Desks page doesn't declare ownership, dual-surface window exists

**Severity:** MEDIUM — PRODUCT (ADR-0238 boundary)

**What the code does:**

`chat-page-client.tsx:36` correctly mounts `<DomainChatOwnership reason="komm-chat" />`.
`TicketConversationView.tsx:103` correctly mounts `<DomainChatOwnership reason="komm-thread" />`.

However, the **desks page** (`/dashboard/komm/desks`) and the QueueSheet flow do NOT mount `DomainChatOwnership`. When Erik is on `/dashboard/komm/desks` reviewing Sofia's queue — a page with Orb active — and clicks a ticket to navigate, there is a brief window where the desks page is mounted with both the Orb **and** the QueueSheet's chat-like context visible before navigation completes.

More critically: the HelpDesk quick-dialog (`HelpDesk.tsx`) is mounted **inside** a Dialog on top of Komm pages. No `DomainChatOwnership` is declared inside this Dialog. An employee opening the help request dialog on `/dashboard/komm` (which has `DomainChatOwnership` via `chat-page-client.tsx`) is OK — but if the same dialog is opened from a non-Komm page (e.g., the dashboard home, if ever wired), the Orb is active and both surfaces compete.

Per ADR-0238: *"any page with a domain chat MUST declare ownership. Failure to declare = dual-surface confusion ships."*

**Fix path:** Mount `<DomainChatOwnership reason="komm-desks" />` in `DesksClient.tsx`. Confirm `HelpDesk.tsx` Dialog is only ever opened from Komm-scoped pages.

---

### GAP-A4-12 — C2 intelligence pipeline absent — session channel for Wednesday service never auto-briefs staff

**Severity:** HIGH — PRODUCT gap (structural, not new debt, but directly felt in simulation)

**Real-world context:** Erik finishes publishing the summer menu announcement at 15:30. In a world where Smartout fulfils its promise, the session channel for Wednesday dinner (created when the `department_session` opens at 16:00) should auto-receive:
- A shift briefing with covers, special events, allergen flags
- The new menu announcement as a system message in the session channel

**What the code does (none of this fires):**
- `compile-day-brief.ts` and `briefing.ts` tools exist in `packages/ai/src/capabilities/communication/` but no Event Engine process invokes them
- `channel_event` table has 0 rows — the C2 projection trigger never fires
- Session channel is created by trigger but auto-members only the duty leader, not the 8 scheduled staff (G7 in `docs/domains/communication/GAPS-AND-DEBT.md`)

**Confirmed code trace:** `docs/domains/communication/GAPS-AND-DEBT.md:G1` (critical) + `G2` (projection trigger missing) + `G7` (members not auto-added).

---

## Comparative UX note — Smartout vs Slack/WhatsApp for a busy 18-staff bistro

| Feature | Slack/WhatsApp | Smartout (current) | Assessment |
|---|---|---|---|
| Send to "people on tonight's shift" | WhatsApp: manual group; Slack: channel | `on_duty` = clocked-in only (BUG-A4-01) | Worse — misleading label |
| Menu-change vs social distinction | Slack: channel name; WhatsApp: none | `kind` field exists but no UI picker | Not yet better |
| Employee sees it on home screen | WhatsApp: notification; Slack: unread badge | Mobile push ✓ but home widget absent (GAP-A4-06) | On par |
| Help request → designated rep | Slack DM; WhatsApp call | HelpDesk.tsx writes deprecated table (BUG-A4-08) | Broken |
| SLA breach badge | None (Slack has no SLA) | Exists in code but depends on non-realtime polling (GAP-A4-10) | Potential edge over Slack — if it works |
| Session briefing auto-delivered | None | Designed (C2) but not built | Not yet better |

**Where Smartout can win when C2 ships:** automatic shift briefings in session channels beat anything WhatsApp or Slack offer for operations — but today the C2 gap makes Smartout's `komm` surface roughly equivalent to a WhatsApp group with extra steps.

---

## Summary table

| ID | Type | Severity | Surface | Blocks |
|---|---|---|---|---|
| BUG-A4-01 | Bug | HIGH | Audience resolver (agent + web) | "on_duty" audience = wrong for pre-shift |
| BUG-A4-02 | Bug | HIGH | `capability_default_registry` | New workspaces: publish blocked forever |
| BUG-A4-03 | Bug | MEDIUM | `tools.ts:219` + `is_active` migration | Stale channel guard semantics |
| GAP-A4-04 | Gap | MEDIUM | `AnnouncementKindPicker` not mounted | kind=new_menu unusable from web |
| GAP-A4-05 | Gap | MEDIUM | Mobile bulletin | Maria sees chat bubble, not card |
| GAP-A4-06 | Gap | MEDIUM | Home widget | No latest-news surface |
| BUG-A4-07 | Bug | MEDIUM | `resolveAudience` on_duty branch | Cross-workspace bleed (service-role) |
| BUG-A4-08 | Bug | CRITICAL | `HelpDesk.tsx` / `use-help-requests.ts` | Writes deprecated table — no engine_state |
| BUG-A4-09 | Bug | MEDIUM | `openTicket` spawn-race | emitTimestamp after emit → possible double-ticket |
| GAP-A4-10 | Gap | MEDIUM | `useMinKo` polling | SLA badge up to 15s delayed |
| BUG-A4-11 | Bug | MEDIUM | ADR-0238 | Desks page missing DomainChatOwnership |
| GAP-A4-12 | Gap | HIGH | C2 pipeline absent | No session briefing, no auto-member |

---

## Fast wins

| # | ID | Fix | Time est. | Unblocks |
|---|---|---|---|---|
| 1 | BUG-A4-08 | Rewire HelpDesk.tsx to use `open_ticket` agent path OR new Server Action calling the tool | 2–3h | Entire helpdesk+SLA surface (BUG-20) |
| 2 | BUG-A4-02 | Add `communication` to `capability_default_registry` via new migration | 15 min | New workspace publish-blocked (root cause of BUG-1 for fresh workspaces) |
| 3 | BUG-A4-07 | Add `workspace_id` filter to `on_duty` resolver (both files) | 30 min | Cross-workspace data isolation |
| 4 | BUG-A4-01 | Add `on_shift` audience kind reading `schedule_shift` | 2h | Correct pre-shift targeting |
| 5 | BUG-A4-09 | Set `emitTimestamp` before `emit()` call | 5 min | Eliminates double-ticket race |
