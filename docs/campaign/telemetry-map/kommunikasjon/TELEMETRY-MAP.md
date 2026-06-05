---
title: Telemetry Map — kommunikasjon domain
status: done
updated: 2026-05-31
created: 2026-05-31
module: redesign-wiring
tags: [telemetry, kommunikasjon, redesign]
---

# Telemetry Map — kommunikasjon

Design source: `Smartout.ai_re-designe/apps/web/pages/kommunikasjon*.jsx`
Backend hooks: `apps/web/src/app/dashboard/komm/_hooks/`
Registry: `packages/telemetry/src/registry.ts`

---

## Summary

| Stat                          | Count |
| ----------------------------- | ----- |
| Total interactive elements    | 46    |
| Mutations                     | 22    |
| Noop / nav only               | 24    |
| Events required for mutations | 22    |
| Events in registry            | 15    |
| Events missing from registry  | 7     |

---

## A. Main Page — KommunikasjonPage (kommunikasjon.jsx)

### A1. Tab navigation

| #   | Element            | Action                    | Mutation? | Event | Registry? | Hook |
| --- | ------------------ | ------------------------- | --------- | ----- | --------- | ---- |
| 1   | Tab: Oversikt      | `setTab("oversikt")`      | No (nav)  | noop  | —         | —    |
| 2   | Tab: Kunngjøringer | `setTab("kunngjoringer")` | No (nav)  | noop  | —         | —    |
| 3   | Tab: Kanaler       | `setTab("kanaler")`       | No (nav)  | noop  | —         | —    |
| 4   | Tab: Skranke       | `setTab("skranke")`       | No (nav)  | noop  | —         | —    |

### A2. Header CTA buttons

| #   | Element                                               | Action                         | Mutation?        | Event | Registry? | Hook |
| --- | ----------------------------------------------------- | ------------------------------ | ---------------- | ----- | --------- | ---- |
| 5   | "Ny kunngjøring" (header, not on kanaler/skranke tab) | Opens KoCompose modal (create) | No (opens modal) | noop  | —         | —    |
| 6   | "Ny kanal" (header, kanaler tab only)                 | Opens KoChannelModal (create)  | No (opens modal) | noop  | —         | —    |

---

## B. Oversikt tab (kommunikasjon.jsx — Oversikt component)

### B1. KPI pulse buttons

| #   | Element               | Action                                             | Mutation? | Event | Registry? | Hook |
| --- | --------------------- | -------------------------------------------------- | --------- | ----- | --------- | ---- |
| 7   | Pulse: Publisert      | `setStatusF("all"); setTab("kunngjoringer")`       | No (nav)  | noop  | —         | —    |
| 8   | Pulse: Lesegrad       | `setStatusF("all"); setTab("kunngjoringer")`       | No (nav)  | noop  | —         | —    |
| 9   | Pulse: Planlagt       | `setStatusF("scheduled"); setTab("kunngjoringer")` | No (nav)  | noop  | —         | —    |
| 10  | Pulse: Utkast         | `setStatusF("draft"); setTab("kunngjoringer")`     | No (nav)  | noop  | —         | —    |
| 11  | Pulse: Aktive kanaler | `setTab("kanaler")`                                | No (nav)  | noop  | —         | —    |

### B2. Botsson assist banner (read-reminder nudge)

| #   | Element                            | Action                                   | Mutation?           | Event                        | Registry?   | Hook                                                                |
| --- | ---------------------------------- | ---------------------------------------- | ------------------- | ---------------------------- | ----------- | ------------------------------------------------------------------- |
| 12  | "Send påminnelse" (Botsson banner) | `remind(assist.ann)` — toast, no backend | **Yes (mock only)** | `announcement.reminder_sent` | **MISSING** | **MISSING** — `notification_outbox` is 0-seeded; delivery is hollow |
| 13  | "Avvis" (dismiss Botsson banner)   | `setAssistDone(true)` — local state only | No                  | noop                         | —           | —                                                                   |

### B3. Pinned announcements panel

| #   | Element                                 | Action                               | Mutation? | Event | Registry? | Hook |
| --- | --------------------------------------- | ------------------------------------ | --------- | ----- | --------- | ---- |
| 14  | Pinned announcement row click           | `onOpen(a.id)` — opens detail drawer | No (nav)  | noop  | —         | —    |
| 15  | "Alle →" (channels panel link)          | `setTab("kanaler")`                  | No (nav)  | noop  | —         | —    |
| 16  | "Se alle →" (recent announcements link) | `setTab("kunngjoringer")`            | No (nav)  | noop  | —         | —    |

---

## C. Kunngjøringer tab (kommunikasjon.jsx — Kunngjoringer component)

### C1. Toolbar filters / search

| #   | Element                                                     | Action                       | Mutation? | Event | Registry? | Hook |
| --- | ----------------------------------------------------------- | ---------------------------- | --------- | ----- | --------- | ---- |
| 17  | Search input                                                | `setQuery(…)` — local filter | No        | noop  | —         | —    |
| 18  | Status chip filter (all/published/scheduled/draft/archived) | `setStatusF(…)`              | No        | noop  | —         | —    |
| 19  | Channel select dropdown                                     | `setChannelF(…)`             | No        | noop  | —         | —    |
| 20  | Sort select (ny/lest/mottakere)                             | `setSort(…)`                 | No        | noop  | —         | —    |

### C2. Announcement list rows (AnnRow)

| #   | Element                                    | Action                                                | Mutation?           | Event                                                 | Registry?       | Hook                                                                  |
| --- | ------------------------------------------ | ----------------------------------------------------- | ------------------- | ----------------------------------------------------- | --------------- | --------------------------------------------------------------------- |
| 21  | AnnRow click                               | `onOpen(a.id)` — opens detail drawer                  | No (nav)            | noop                                                  | —               | —                                                                     |
| 22  | Pin toggle button (in row, published only) | `onTogglePin(a)` → `togglePin(ann)` → setAnns locally | **Yes (mock only)** | `channel.message.pinned` / `channel.message.unpinned` | **IN REGISTRY** | `use-pin-message` (ADR-0415: emit co-located in capability tool body) |
| 23  | "Ny kunngjøring" (empty state CTA)         | Opens KoCompose                                       | No (opens modal)    | noop                                                  | —               | —                                                                     |

---

## D. KoCompose modal (kommunikasjon-compose.jsx)

### D1. Channel selector

| #   | Element                | Action                         | Mutation? | Event | Registry? | Hook |
| --- | ---------------------- | ------------------------------ | --------- | ----- | --------- | ---- |
| 24  | Channel option buttons | `setChannelId(…)` — form field | No        | noop  | —         | —    |

### D2. Audience picker (AudiencePicker)

| #   | Element                                                          | Action                           | Mutation? | Event | Registry? | Hook |
| --- | ---------------------------------------------------------------- | -------------------------------- | --------- | ----- | --------- | ---- |
| 25  | Audience kind tabs (all/on_duty/department/team/location/access) | `setAud({kind, …})` — form field | No        | noop  | —         | —    |
| 26  | Department/team/location/access tile toggles                     | `toggle(facet, id)` — form field | No        | noop  | —         | —    |

### D3. Options toggles

| #   | Element                     | Action                         | Mutation? | Event | Registry? | Hook |
| --- | --------------------------- | ------------------------------ | --------- | ----- | --------- | ---- |
| 27  | "Operasjonell push" toggle  | `setPriority(…)` — form field  | No        | noop  | —         | —    |
| 28  | "Fest øverst" toggle        | `setPinned(…)` — form field    | No        | noop  | —         | —    |
| 29  | "Planlegg utsending" toggle | `setScheduled(…)` — form field | No        | noop  | —         | —    |
| 30  | Scheduled datetime input    | `setWhen(…)` — form field      | No        | noop  | —         | —    |

### D4. Submit buttons

| #   | Element                       | Action                                                           | Mutation?           | Event                                                           | Registry?       | Hook                                                                                                 |
| --- | ----------------------------- | ---------------------------------------------------------------- | ------------------- | --------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------- |
| 31  | "Lagre utkast"                | `onSubmit(build("draft"), "draft")` → `upsertAnn` (mock)         | **Yes (mock only)** | `announcement.draft_saved`                                      | **MISSING**     | No hook (design uses local state; real: `use-send-announcement` with status=draft — RPC supports it) |
| 32  | "Planlegg"                    | `onSubmit(build("scheduled"), "scheduled")` → `upsertAnn` (mock) | **Yes (mock only)** | `announcement.scheduled`                                        | **MISSING**     | No hook (real: `use-send-announcement` with scheduled_at param — NOT in current hook sig)            |
| 33  | "Publiser" / "Republiser"     | `onSubmit(build("published"), "published")` → `upsertAnn` (mock) | **Yes (mutation)**  | `channel.message.sent` (via `emitAnnouncementPublished` helper) | **IN REGISTRY** | `use-send-announcement` → `publish_announcement_atomic` RPC                                          |
| 34  | Close (×) / ESC / scrim-click | `onClose()`                                                      | No                  | noop                                                            | —               | —                                                                                                    |

---

## E. KoDetail drawer (kommunikasjon-detail.jsx)

### E1. Tabs

| #   | Element                               | Action      | Mutation? | Event | Registry? | Hook |
| --- | ------------------------------------- | ----------- | --------- | ----- | --------- | ---- |
| 35  | Tab: Oversikt / Mottakere / Historikk | `setTab(…)` | No (nav)  | noop  | —         | —    |

### E2. Footer actions (canManage=true)

| #   | Element                                      | Action                                  | Mutation?           | Event                                                 | Registry?       | Hook                                                                                                                                           |
| --- | -------------------------------------------- | --------------------------------------- | ------------------- | ----------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 36  | "Rediger"                                    | Opens KoCompose in edit mode            | No (opens modal)    | noop                                                  | —               | —                                                                                                                                              |
| 37  | "Fest" / "Løsne"                             | `onTogglePin(ann)` → local state update | **Yes (mock only)** | `channel.message.pinned` / `channel.message.unpinned` | **IN REGISTRY** | `use-pin-message`                                                                                                                              |
| 38  | "Arkivér"                                    | Opens ConfirmModal for archive          | No (opens modal)    | noop                                                  | —               | —                                                                                                                                              |
| 39  | Confirm archive → "Arkivér" in ConfirmModal  | `archiveAnn(ann)` → local state         | **Yes (mock only)** | `announcement.archived`                               | **MISSING**     | No hook — `channel.archived` exists but for channels, not messages; need `announcement.archived` or use `channel.message.deleted` semantically |
| 40  | "Gjenopprett" (archived status)              | `onRepublish(ann)` → local state        | **Yes (mock only)** | `announcement.republished`                            | **MISSING**     | No hook                                                                                                                                        |
| 41  | "Påminn X som ikke har lest" (Mottakere tab) | `onRemind(ann)` → toast only            | **Yes (mock only)** | `announcement.reminder_sent`                          | **MISSING**     | **MISSING** — notification_outbox is 0-seeded; any delivery-status or reminder UI is hollow                                                    |

### E3. Comment thread

| #   | Element                                | Action                                   | Mutation?           | Event                        | Registry?   | Hook                                                                                                  |
| --- | -------------------------------------- | ---------------------------------------- | ------------------- | ---------------------------- | ----------- | ----------------------------------------------------------------------------------------------------- |
| 42  | Comment input + Send button (or Enter) | `onComment(ann.id, draft)` → local state | **Yes (mock only)** | `announcement.comment_added` | **MISSING** | No hook — design uses local state; no `use-channel-messages` write path for comments on announcements |

---

## F. Kanaler tab + KoChannelModal (kommunikasjon.jsx + kommunikasjon-compose.jsx)

### F1. Channel cards

| #   | Element                                            | Action                                                     | Mutation?           | Event                                                  | Registry?                                     | Hook                                                                    |
| --- | -------------------------------------------------- | ---------------------------------------------------------- | ------------------- | ------------------------------------------------------ | --------------------------------------------- | ----------------------------------------------------------------------- |
| 43  | "Åpne →" (channel card)                            | `onOpen(c)` → `setChannelF(c.id); setTab("kunngjoringer")` | No (nav)            | noop                                                   | —                                             | —                                                                       |
| 44  | Channel menu → Rediger                             | Opens KoChannelModal edit                                  | No (opens modal)    | noop                                                   | —                                             | —                                                                       |
| 45  | Channel menu → Arkivér / Gjenåpne                  | Opens ConfirmModal                                         | No (opens modal)    | noop                                                   | —                                             | —                                                                       |
| 46  | Confirm → "Arkivér" / "Gjenåpne" (channel confirm) | `toggleArchiveChannel(c)` → local state                    | **Yes (mock only)** | `channel.archived` (archive) / — (reopen has no event) | archive: **IN REGISTRY**; reopen: **MISSING** | `use-create-channel` doesn't cover archive; no `useArchiveChannel` hook |

### F2. KoChannelModal

| #   | Element                             | Action                                        | Mutation?           | Event                                       | Registry?                                                                     | Hook                                                           |
| --- | ----------------------------------- | --------------------------------------------- | ------------------- | ------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 47  | Channel kind selector               | `setKind(…)`                                  | No                  | noop                                        | —                                                                             | —                                                              |
| 48  | Department selector (avdeling kind) | `setDeptId(…)`                                | No                  | noop                                        | —                                                                             | —                                                              |
| 49  | "Opprett kanal" / "Lagre"           | `onSubmit(…)` → `upsertChannel` → local state | **Yes (mock only)** | `channel.created` (new) / no event for edit | create: **IN REGISTRY**; edit: **MISSING** (no `channel.updated` in registry) | `use-create-channel` covers create; no `useUpdateChannel` hook |

---

## G. Skranke tab — KoSkranke (kommunikasjon-skranke.jsx)

### G1. Sub-tabs

| #   | Element                                          | Action      | Mutation? | Event | Registry? | Hook |
| --- | ------------------------------------------------ | ----------- | --------- | ----- | --------- | ---- |
| 50  | Sub-tab: Oversikt / Kø / Analyse / Innstillinger | `setSub(…)` | No (nav)  | noop  | —         | —    |

### G2. Oversikt — pulse KPIs

| #   | Element                                                | Action                                      | Mutation? | Event | Registry? | Hook |
| --- | ------------------------------------------------------ | ------------------------------------------- | --------- | ----- | --------- | ---- |
| 51  | Pulse buttons (Åpne/Venter/Forfalt/Mine skranker/Løst) | `gotoQueue(f)` → `setStatusF; setSub("ko")` | No (nav)  | noop  | —         | —    |

### G3. Botsson assist in Skranke

| #   | Element              | Action                | Mutation? | Event | Registry? | Hook |
| --- | -------------------- | --------------------- | --------- | ----- | --------- | ---- |
| 52  | "Åpne sak" (Botsson) | `openCase(assist.id)` | No (nav)  | noop  | —         | —    |
| 53  | "Avvis" (Botsson)    | `setAssistDone(true)` | No        | noop  | —         | —    |

### G4. DeskCard actions

| #   | Element                                  | Action                                | Mutation?        | Event | Registry? | Hook |
| --- | ---------------------------------------- | ------------------------------------- | ---------------- | ----- | --------- | ---- |
| 54  | Configure button (sliders icon)          | `onConfigure(d)` → opens KoDeskModal  | No (opens modal) | noop  | —         | —    |
| 55  | "Åpne kø →" (mine desks with open cases) | `onOpenQueue()` → `gotoQueue("mine")` | No (nav)         | noop  | —         | —    |

### G5. Min kø (my queue) case rows

| #   | Element                         | Action              | Mutation? | Event | Registry? | Hook |
| --- | ------------------------------- | ------------------- | --------- | ----- | --------- | ---- |
| 56  | CaseRow click (compact)         | `onOpen(c.id)`      | No (nav)  | noop  | —         | —    |
| 57  | "Se alle →" (min kø panel link) | `gotoQueue("mine")` | No (nav)  | noop  | —         | —    |

---

## H. Kø tab — Queue (kommunikasjon-skranke.jsx)

### H1. Queue filters

| #   | Element                                           | Action          | Mutation? | Event | Registry? | Hook |
| --- | ------------------------------------------------- | --------------- | --------- | ----- | --------- | ---- |
| 58  | Queue search input                                | `setQ(…)`       | No        | noop  | —         | —    |
| 59  | Status filter chips (Åpne/Mine/Forfalt/Løst/Alle) | `setStatusF(…)` | No        | noop  | —         | —    |
| 60  | Desk select                                       | `setDeskF(…)`   | No        | noop  | —         | —    |
| 61  | Sort select (frist/prioritet)                     | `setSort(…)`    | No        | noop  | —         | —    |
| 62  | CaseRow click                                     | `onOpen(c.id)`  | No (nav)  | noop  | —         | —    |

---

## I. KoCaseDrawer (kommunikasjon-case.jsx)

### I1. Header / tabs

| #   | Element                       | Action      | Mutation? | Event | Registry? | Hook |
| --- | ----------------------------- | ----------- | --------- | ----- | --------- | ---- |
| 63  | Close (× / ESC / scrim)       | `onClose()` | No        | noop  | —         | —    |
| 64  | Tab: Samtale / Internt / Logg | `setTab(…)` | No (nav)  | noop  | —         | —    |

### I2. AI draft suggestion

| #   | Element               | Action                                                  | Mutation?            | Event                         | Registry?   | Hook                                                   |
| --- | --------------------- | ------------------------------------------------------- | -------------------- | ----------------------------- | ----------- | ------------------------------------------------------ |
| 65  | "Sett inn og rediger" | `useDraft()` → `setReply(aiDraft); onAcceptDraft(c.id)` | **Yes (local mock)** | `helpdesk.ai_draft_accepted`  | **MISSING** | No hook — local state; no AI-accept backend path wired |
| 66  | "Avvis" (AI draft)    | `onDismissDraft(c.id)` → local state                    | **Yes (local mock)** | `helpdesk.ai_draft_dismissed` | **MISSING** | No hook                                                |
| 67  | "Hvorfor?" toggle     | `setWhy(v => !v)`                                       | No                   | noop                          | —           | —                                                      |

### I3. Samtale composer

| #   | Element                                        | Action                                                  | Mutation?           | Event                    | Registry?   | Hook                                                                   |
| --- | ---------------------------------------------- | ------------------------------------------------------- | ------------------- | ------------------------ | ----------- | ---------------------------------------------------------------------- |
| 68  | Reply textarea + "Send" button (or Ctrl+Enter) | `sendReply()` → `onSendReply(c.id, body)` → local state | **Yes (mock only)** | `helpdesk.query.replied` | **MISSING** | No hook — `use-send-message` covers channel chat, not helpdesk replies |

### I4. Internt (internal notes) tab

| #   | Element                               | Action                                | Mutation?           | Event                          | Registry?   | Hook    |
| --- | ------------------------------------- | ------------------------------------- | ------------------- | ------------------------------ | ----------- | ------- |
| 69  | Internal note input + Send (or Enter) | `onAddNote(c.id, body)` → local state | **Yes (mock only)** | `helpdesk.internal_note_added` | **MISSING** | No hook |

### I5. Footer — owner controls

| #   | Element                                  | Action                                 | Mutation?           | Event                            | Registry?       | Hook                                                        |
| --- | ---------------------------------------- | -------------------------------------- | ------------------- | -------------------------------- | --------------- | ----------------------------------------------------------- |
| 70  | "Tildel" → owner pick from popover       | `onReassign(c, ownerId)` → local state | **Yes (mock only)** | `helpdesk.query.reassigned`      | **IN REGISTRY** | No wire — registry has event, but no `useReassignCase` hook |
| 71  | "Prioritet" → priority pick from popover | `onPriority(c, id)` → local state      | **Yes (mock only)** | `helpdesk.case.priority_changed` | **MISSING**     | No hook                                                     |
| 72  | "Løs sak"                                | `onResolve(c)` → local state           | **Yes (mock only)** | `helpdesk.query.resolved`        | **IN REGISTRY** | No wire — registry event exists, no `useResolveCase` hook   |
| 73  | "Gjenåpne"                               | `onReopen(c)` → local state            | **Yes (mock only)** | `helpdesk.case.reopened`         | **MISSING**     | No hook                                                     |

---

## J. Analyse tab — KoSkrankeAnalyse (kommunikasjon-skranke-views.jsx)

| #   | Element                                       | Action | Mutation? | Event | Registry? | Hook |
| --- | --------------------------------------------- | ------ | --------- | ----- | --------- | ---- |
| 74  | No interactive elements (read-only dashboard) | —      | No        | noop  | —         | —    |

---

## K. Innstillinger tab — KoSkrankeSetup (kommunikasjon-skranke-views.jsx)

| #   | Element                                     | Action                                 | Mutation?        | Event | Registry? | Hook |
| --- | ------------------------------------------- | -------------------------------------- | ---------------- | ----- | --------- | ---- |
| 75  | "Ny skranke" button                         | Opens KoDeskModal (create)             | No (opens modal) | noop  | —         | —    |
| 76  | "Konfigurer" button (existing desk)         | Opens KoDeskModal (edit)               | No (opens modal) | noop  | —         | —    |
| 77  | "Gjør til skranke" (normal channel upgrade) | Opens KoDeskModal (create with preset) | No (opens modal) | noop  | —         | —    |

---

## L. KoDeskModal (kommunikasjon-skranke-views.jsx)

### L1. Form fields

| #   | Element                                     | Action             | Mutation? | Event | Registry? | Hook |
| --- | ------------------------------------------- | ------------------ | --------- | ----- | --------- | ---- |
| 78  | Name input                                  | `setName(…)`       | No        | noop  | —         | —    |
| 79  | Slug input                                  | `setSlug(…)`       | No        | noop  | —         | —    |
| 80  | Preset selector (public/private/none)       | `setPreset(…)`     | No        | noop  | —         | —    |
| 81  | Owner toggles                               | `toggleOwner(id)`  | No        | noop  | —         | —    |
| 82  | Category toggles                            | `toggleCat(id)`    | No        | noop  | —         | —    |
| 83  | SLA first-response input                    | `setSlaFirst(…)`   | No        | noop  | —         | —    |
| 84  | SLA resolve-time input                      | `setSlaResolve(…)` | No        | noop  | —         | —    |
| 85  | AI policy selector (off/mention/autonomous) | `setAi(…)`         | No        | noop  | —         | —    |

### L2. Submit

| #   | Element                     | Action                                                | Mutation?           | Event                                                                                | Registry?                                                                | Hook                                                                                       |
| --- | --------------------------- | ----------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| 86  | "Opprett skranke" / "Lagre" | `save()` → `onSubmit(…)` → `upsertDesk` → local state | **Yes (mock only)** | create: `channel.helpdesk.enabled` / edit: `channel.helpdesk.enabled` (re-configure) | create: **IN REGISTRY**; edit re-configure: **IN REGISTRY** (same event) | `channel.helpdesk.enabled` / `channel.helpdesk.disabled` exist; no `useConfigureDesk` hook |

---

## Flags and Risk Notes

### FLAG-1: Delivery status UI is hollow (notification_outbox 0-seeded)

Elements 12 and 41 render "Send påminnelse" / "Påminn X som ikke har lest" UIs. Backend shows `notification_outbox` has zero seed rows for the kommunikasjon domain. The trigger `20260422310100` and `20260528020000` migrations exist but fire on `channel_message` inserts — not on announcement reminders. Any reminder-send action is a **hollow mutation**: the UI toasts but no backend row is written.

### FLAG-2: Helpdesk is design-only — all case mutations are mock state

Elements 68–73 (send reply, add note, reassign, set priority, resolve, reopen) are entirely local React state. There are no hooks wired to Supabase for these. The registry has `helpdesk.query.resolved` and `helpdesk.query.reassigned` events, but no client hook calls them.

### FLAG-3: channel_ai_policy exists in DB but agent-router ignores it

The `channel.ai_policy_updated` event is in the registry. The AI policy field in KoDeskModal writes to local state only. The backend `channel_ai_policy` table exists per migration but the agent-router does not read it, so any policy the user sets has no effect on Botsson behaviour.

### FLAG-4: Announcement comment thread is entirely mock

Element 42 (addComment) writes to local React state. There is no `channel_message` reply/comment flow wired for announcement comments. The comment thread in KoDetail is a design fiction.

### FLAG-5: Draft / schedule save has no dedicated event in registry

Elements 31–32 (Lagre utkast, Planlegg) need `announcement.draft_saved` and `announcement.scheduled` events. The `use-send-announcement` hook only handles publish. The RPC `publish_announcement_atomic` does not have a scheduled_at param in the current hook signature.
