---
title: Progressive Channel Cutover — End-to-End Journeys
status: done
updated: 2026-04-20
created: 2026-04-20
module: Helpdesk
tags: [helpdesk, progressive-channel, journeys]
---

# Journeys — Progressive Channel Cutover (Phase 1A.2)

Covers the four primary flows enabled by ADR-0165's `helpdesk_enabled` flag,
the PII classifier (ADR-0166), and the mobile `(komm)` execution surface
(ADR-0133). Happy path and error paths below each journey.

---

## Journey: Admin upgrades channel to public helpdesk

**Precondition:** Admin is signed in to web dashboard. A regular (non-helpdesk)
channel `#kundehjelp` exists in the workspace with at least one member that
qualifies as responsible rep (role >= manager).

1. Admin navigates to `#kundehjelp` → clicks the settings gear → modal opens.
   → System loads `ChannelSettingsModal` with tabs `Generelt`, `Medlemmer`,
   `Skranke`. → Admin sees Skranke tab available because they hold
   `is_admin_in_workspace` (RLS-narrowed per Phase 1A.1).
2. Admin selects the `Skranke` tab → picks the preset **"Offentlig skranke"**.
   → System pre-fills `privacy_mode=null` and enables the responsible-rep
   selector. → Admin sees a live preview of the channel-row badge (LifeBuoy +
   rep avatar).
3. Admin selects a rep from the dropdown → clicks `Lagre skranke-innstillinger`.
   → System invokes `enableHelpdesk` Server Action with
   `{ channel_id, privacy_mode: null, responsible_profile_id }`. → Server
   validates admin authority, flips `helpdesk_enabled=true`, sets
   `responsible_profile_id`, emits `channel.helpdesk.enabled` via `emit()`.
4. Modal closes → toast "Kanalen er nå en offentlig skranke". → Channel row
   shows LifeBuoy badge + rep avatar. → Rep sees `#kundehjelp` in their **Min
   kø** section on the Komm surface within one poll tick (<=30s).

**Postcondition:** `channel.helpdesk_enabled=true`, `responsible_profile_id` set,
NOT VALID CHECK `channel_helpdesk_requires_responsible` satisfied,
`activity_trail` + `engine_event` rows emitted, badge visible in channel list,
Min kø aggregation includes the channel.

**Error paths:**

- **Auth denied (non-admin):** RLS `channel_jwt_update` rejects the flip; Server
  Action returns `FORBIDDEN`; modal shows "Du må være arbeidsromsadmin for å
  opprette skranker." No DB change.
- **Missing rep on submit:** Server validates `responsible_profile_id IS NOT
  NULL` before the UPDATE; returns `VALIDATION_FAILED` with field-level error;
  modal keeps form state.
- **Offline/network failure:** Server Action promise rejects; TanStack Query
  retries once with exponential backoff; persistent failure shows a non-
  blocking toast "Kunne ikke lagre — prøv igjen". Flag not flipped.

---

## Journey: Admin attempts downgrade with open tickets

**Precondition:** Channel is already a helpdesk (`helpdesk_enabled=true`) and
has at least one `engine_state` row with `status IN ('waiting','active')` and
`context->>'desk_channel_id'` pointing at this channel.

1. Admin opens `ChannelSettingsModal` → Skranke tab → selects **"Åpen kanal"**
   preset. → System surfaces a confirm modal "Dette vil konvertere skranken til
   en vanlig kanal. Åpne saker må håndteres først."
2. Admin clicks `Bekreft`. → System invokes `disableHelpdesk` Server Action.
   → Server queries `engine_state` for open tickets on the channel.
3. Server finds >=1 open ticket → returns `has_open_tickets` error with count.
   → Modal shows blocking banner: "N åpne saker må løses før skranken kan
   lukkes." → The `Bekreft` button stays disabled until ticket count reaches
   zero.

**Postcondition:** No DB change. `helpdesk_enabled` stays `true`. No telemetry
emission (the guard runs before `emit()`). Admin remains on the settings modal
with the blocking message visible.

**Error paths:**

- **Race — ticket resolved mid-click:** Admin retries; second call passes the
  guard; `disableHelpdesk` succeeds; `channel.helpdesk.disabled` emits.
- **RLS block (auth downgraded mid-session):** Server Action returns
  `FORBIDDEN`; modal shows auth-expired toast and offers sign-in redirect.
- **Classifier-adjacent open tickets in private sub-channel:** Guard scans by
  `context->>'desk_channel_id'` so private sub-channel tickets also block; same
  blocking message, no distinction surfaced.

---

## Journey: Rep handles private-mode ticket with PII redaction

**Precondition:** Channel `#lonn-spor` is `helpdesk_enabled=true` with
`privacy_mode='private_per_requester'`. Rep is assigned as
`responsible_profile_id`. Requester (employee) is a channel member and signed in.

1. Requester posts a message in the public channel: "Kan dere sjekke
   skattekortet mitt? Fnr 12345678901 og konto 1234.56.78901".
   → Client sends message to channel. → Server intercepts before persist,
   invokes PII classifier on message body.
2. Classifier detects `personnummer` (confidence 0.99) + `kontonummer`
   (confidence 0.97). → System emits `helpdesk.pii.detected` with categories
   + confidence. → Public message body is rewritten to `[PII: personnummer]
   [PII: kontonummer]`. The rewritten message is what other members see.
3. System creates or reuses a private sub-channel for the requester, links via
   `engine_state.context->>'desk_channel_id'=<parent_channel_id>`. The
   **original unredacted** message is posted into the private sub-channel.
   → Responsible rep is added as member of the sub-channel.
4. Rep receives the original in the private sub-channel, replies, resolves the
   ticket via `resolveTicket` Server Action. → Server sets
   `engine_state.status='complete'` AND stamps `completed_at=now()` (L-0079).
   → Emits `helpdesk.ticket.resolved`.

**Postcondition:** Public channel shows only the redacted message. Private sub-
channel holds the full exchange. `engine_state.status='complete'` with non-null
`completed_at`. Min kø count decrements within one poll tick.

**Error paths:**

- **Classifier timeout (>500ms):** Fail-open — message posts as-is in public
  channel with no private sub-channel creation. Emits `helpdesk.pii.timeout`
  for follow-up audit. Rep sees a banner "Kunne ikke analysere melding for
  personopplysninger — verifiser manuelt." (ADR-0166 §4.)
- **Private sub-channel RLS block:** If the requester lacks membership (shouldn't
  happen, but guarded), creation rolls back; message stays in public as
  redacted; rep is notified via `helpdesk.pii.detected` + missing-subchannel
  flag.
- **resolveTicket missing `completed_at`:** Trigger-level guard on
  `engine_state` UPDATE enforces `completed_at IS NOT NULL WHEN status =
  'complete'`; attempt fails with SQL state violation; emitted as
  `helpdesk.ticket.resolve_failed`.

---

## Journey: Mobile rep views and resolves ticket from Min kø

**Precondition:** Rep is signed in to mobile app. At least one open ticket is
assigned to them (`engine_state.context->>'responsible_profile_id'` = rep's
profile or channel `responsible_profile_id` = rep). Device is online.

1. Rep opens mobile app → lands on Hjem → sees **Min kø** badge with count.
   → App hits `getMyQueue()` via web BFF (`/api/emma/me/queue` per ADR-0132);
   channel is pinned server-side. → Badge renders with LifeBuoy icon.
2. Rep taps the Min kø section → scrolls the list → taps
   `#kundehjelp`. → App navigates to `/komm/channel/[id]` (new unified comms
   surface) and loads `ConversationBody` (extracted in Wave 2a from legacy
   `(queue)` screen).
3. Rep reads the latest message → taps the message to open the action sheet →
   taps **"Løs sak"**. → App fires a Server Action call `resolveTicket({
   ticket_id })` through the BFF. → BFF enforces actor authority + channel
   pinning (ADR-0132).
4. Server sets `engine_state.status='complete'`, stamps `completed_at=now()`,
   emits `helpdesk.ticket.resolved`. → Mobile shows toast "Sak løst". Min kø
   count decrements on next pull-to-refresh or within the 30s poll tick.

**Postcondition:** `engine_state.status='complete'` with non-null
`completed_at`. Telemetry row in `engine_event`. `activity_trail` row with
`actor_id` = rep's `profile_id`. Rep's Min kø count decremented. Mobile
executed D6 (production verb) per ADR-0133 — no composition occurred.

**Error paths:**

- **Offline at resolve tap:** Mutation is enqueued via the mobile offline queue
  (`apps/mobile/src/lib/sync/`); Zod-validated at enqueue per ADR-0134; toast
  "Lagret lokalt — sendes når du er online"; replays on reconnect.
- **Authority gate rejects (rep removed as responsible mid-session):** BFF
  returns `FORBIDDEN`; mobile shows "Du er ikke lenger tilordnet denne saken";
  ticket stays `status='active'`; no telemetry emission for the attempted
  resolve beyond an audit row.
- **RLS block on read (rep lost channel membership):** Channel load returns
  empty; mobile shows empty state + refresh hint; no resolve action is
  reachable.
- **Concurrent resolve by another rep:** Second resolve sees
  `status='complete'`, Server Action returns `already_resolved`; mobile treats
  as success (idempotent from the user's POV) and decrements count.
