---
title: User Journeys — Announcement V2 (kind / tier / entity-link)
status: done
updated: 2026-05-18
created: 2026-05-18
module: announcements
tags: [announcements, journeys, kind, tier, entity-link, komm, v2]
---

# User Journeys — Announcement V2 (kind / tier / entity-link)

## Summary

V2 ships the kind/tier/entity-link extension of the announcement domain. Every published
announcement now carries an `announcement_kind` enum (workspace_news · celebration ·
urgent · information · policy_update), an `announcement_tier` enum (social · work ·
external), and an optional entity-link pair (link_type + linked_entity_id). These are stored
in the `announcement_meta` sidecar table and fan out through the `publish_announcement_atomic`
RPC. The five journeys below cover the full V2 publish/read surface from every actor:
admin web composer, manager urgent broadcast, Mr. Botsson agent two-call confirm, employee
mobile bulletin read, and the Day-Control server-action path.

---

## Journey 1: Admin composes celebration tier=social via ComposeAnnouncement modal

**Precondition:** Admin is logged in. The `ComAnnouncement` modal is open from
`/dashboard/komm/nyheter` → "Skriv ny". At least one other workspace member exists so the
audience pill shows count > 0.

1. Admin writes a title ("Team win! 🎉") and body text.
2. Admin opens the AnnouncementKindPicker → selects **celebration**.
3. System updates the kind field; tier auto-suggests **social** (Track E logic).
4. Admin confirms tier=**social** in AnnouncementTierPicker (no change needed).
5. Admin leaves entity-link empty (optional field).
6. Admin clicks **Publiser**.
7. System calls `publish_announcement_atomic` RPC with `kind='celebration'`, `tier='social'`, no link.
8. RPC inserts `channel_message` (message_type='announcement') + `announcement_meta` sidecar row atomically.
9. RPC fans out `notification_outbox` rows; trigger fires `fn_publish_announcement_notifications`.
10. System emits `announcement.published` telemetry → activity_trail + engine_event + PostHog.
11. Admin sees bulletin board refresh; the new card appears with a **TierBadge** styled in the
    social-tier colour (warm, non-urgent).
12. Recipients (employees) receive in-app notification with work-priority tier resolved to `social`.

**Postcondition:** `announcement_meta` row exists with `kind='celebration'`, `tier='social'`,
`entity_link_type=NULL`. `notification_outbox` rows fanned out. Telemetry emitted.

**Error paths:**

- RPC returns constraint violation (e.g. invalid enum value passed from picker) → server
  responds 400; composer surfaces toast "Ugyldig kunngjøringstype — prøv igjen".
- Network failure between submit and RPC response → optimistic UI shows greyed card; retry
  via `client_message_id` idempotency prevents duplicate.
- Audience count = 0 at submit → composer warns but allows submit; notification fan-out is a
  no-op; row is written with no `notification_outbox` children.

---

## Journey 2: Manager publishes external-tier urgent announcement (email channel triggered)

**Precondition:** Manager is logged in. Workspace tier mapping includes `external → ['email',
'push', 'in_app']` in `announcement_meta` channel configuration. At least one workspace member
has an email address registered.

1. Manager opens AnnounceSheet from header "Ny ▾" → Nyhet (D1 door).
2. Manager writes body: "IMPORTANT: Health inspection tomorrow 09:00. All departments on deck."
3. Manager selects **AnnouncementKindPicker** → **urgent**.
4. System auto-suggests tier=**external**; manager confirms.
5. Manager selects audience `all`.
6. Manager clicks **Publiser**.
7. System calls `publish_announcement_atomic` RPC with `kind='urgent'`, `tier='external'`.
8. RPC writes `channel_message` + `announcement_meta`; fan-out helper
   `fn_publish_announcement_notifications` inserts `notification_outbox` rows for all
   allowed channels: `email`, `push`, `in_app`.
9. SendGrid webhook consumer picks up `email` rows and dispatches transactional email.
10. System emits `announcement.published` + `announcement.external_tier_triggered` telemetry.
11. Manager sees bulletin board card with **TierBadge** styled in external-tier colour (high
    contrast, urgent accent).

**Postcondition:** All recipients notified across email + push + in_app. `announcement_meta`
persists `tier='external'`. `notification_outbox` rows contain `allowed_channels` =
`['email','push','in_app']`.

**Error paths:**

- Email channel not configured for workspace → `fn_publish_announcement_notifications` skips
  email rows; push + in_app still fire; toast warns manager "E-postkanal er ikke aktivert".
- Manager lacks `manager` role (e.g. downgraded to employee mid-session) → RPC's
  `is_manager_in_workspace` guard returns false; RPC raises exception; composer shows
  "Du har ikke tillatelse til å publisere kunngjøringer".
- `tier='external'` but workspace has not enabled external channel → channels resolved to
  `['push','in_app']`; no email; announcement still published.

---

## Journey 3: Mr. Botsson agent publishes via two-call confirm pattern with entity-link

**Precondition:** Workspace member is in a chat session with Mr. Botsson. Agent has
`publish_announcement` capability registered and intent classified. Workspace has an active
`staff_event` (e.g. `staff_event_id = <uuid>`) that the agent can link to.

1. User says: "Send en kunngjøring om julebord-arrangementet til alle ansatte."
2. Botsson's intent-router classifies intent → `communication.publish_announcement`.
3. Stage-engine calls `publish_announcement` capability tool with a **draft payload** (no
   `confirm=true`): `kind='celebration'`, `tier='social'`, `entity_link_type='staff_event'`,
   `linked_entity_id='<uuid>'`.
4. Capability tool returns a **preview** JSON to the agent: title, body, audience count,
   kind, tier, entity-link label.
5. Botsson presents the preview to the user in chat: "Her er utkastet — skal jeg sende det?"
6. User confirms: "Ja, send."
7. Stage-engine calls `publish_announcement` capability tool again with `confirm=true`.
8. Capability calls `publish_announcement_atomic` RPC with the full payload including
   `entity_link_type='staff_event'` and `linked_entity_id`.
9. RPC writes `channel_message` + `announcement_meta` (with entity-link columns populated).
10. Fan-out fires; recipients receive notification.
11. System emits `announcement.published` telemetry with `entity_link_type` in metadata.
12. Botsson replies: "Kunngjøringen er sendt til 24 ansatte."

**Postcondition:** `announcement_meta.entity_link_type = 'staff_event'`,
`announcement_meta.linked_entity_id = '<uuid>'`. Recipients see EntityLinkCTA in the
announcement card (mobile: when Track G ships). Telemetry includes entity-link metadata.

**Error paths:**

- User cancels at step 6 → no second call; draft payload discarded; Botsson confirms
  cancellation.
- `linked_entity_id` refers to a deleted or inaccessible `staff_event` → RPC enforces FK or
  RLS guard; raises exception; capability returns error; Botsson tells user "Arrangementet
  finnes ikke lenger — vil du sende uten lenke?"
- Voice channel attempted → ADR-0078 gate blocks voice-path publish; agent returns
  "Kunngjøringer kan kun sendes via chat, ikke stemme."

---

## Journey 4: Employee reads announcement on mobile bulletin with TierBadge + EntityLinkCTA

**Precondition:** Employee has received a push notification for a V2 announcement. Mobile
app is open on the komm/nyheter equivalent screen (or chat-channel fallback until dedicated
mobile bulletin ships per Track G). Announcement has `tier='work'` and
`entity_link_type='schedule_shift'`.

1. Employee taps push notification → app navigates to komm screen.
2. App fetches channel messages via `get_channel_messages` RPC (extended in M6 with
   announcement sidecar columns: `kind`, `tier`, `entity_link_type`, `linked_entity_id`).
3. Announcement card renders with:
   - **TierBadge** component (shipped in `ad5867593`) displaying `work` tier in work-tier
     colour (neutral, professional).
   - **EntityLinkCTA** button: "Vis vakt" → tapping deep-links to the referenced shift
     (Track G: pending mount; stub renders nothing until deferred mount ships).
4. Employee reads the announcement. `last_read_message_id` advances via read-receipt
   mechanic.
5. Employee can react (web) — not yet available on mobile (gap documented in surface
   coverage table in USER-FLOWS.md §6).

**Postcondition:** Read receipt emitted. Employee knows the tier context of the broadcast.
EntityLinkCTA visible once Track G mount ships.

**Error paths:**

- `linked_entity_id` references a shift the employee is not on → EntityLinkCTA still renders
  (the link is informational, not gated); deep-link opens shift detail; RLS on shift row
  determines whether employee can read the full shift.
- M6 sidecar columns absent (pre-migration environment) → `kind` and `tier` default to
  `NULL`; TierBadge renders nothing (null-safe); EntityLinkCTA hidden.
- Network failure on fetch → cached messages shown; pull-to-refresh retries fetch.

---

## Journey 5: Day-Control "Send melding" server-action path (defense-in-depth via broadcast.send + RPC communication gate)

**Precondition:** Manager is in the operating day view (`WebDayControl`, D4 door). Active
department session exists. Manager has selected "Melding" tab and picked an alert/reminder/note.

1. Manager writes a short broadcast body in the three-button flow.
2. Manager taps **Send**.
3. Web server action `send-broadcast-action.ts` is invoked (server-side).
4. Server action calls `broadcast.send` capability gate (defense-in-depth first layer:
   validates manager role, workspace membership).
5. Capability calls `publish_announcement_atomic` RPC (second layer: RLS + is_manager guard
   enforced at DB level).
6. RPC writes `channel_message` with `system_data.broadcast_type` and `system_data.session_id`
   set so the broadcast is later attributable to the active session.
7. `announcement_meta` row is written with defaults: `kind='workspace_news'`,
   `tier='work'`, no entity-link (Day-Control path does not expose kind/tier pickers in V1).
8. Fan-out fires; all session-audience members receive in_app + push notification.
9. Server action returns success; manager sees "Melding sendt" in Day-Control UI.
10. `communication.broadcast_sent` telemetry emitted (Track F secondary path — does NOT use
    `emitAnnouncementPublished` helper; scoped to broadcast event only per known debt).

**Postcondition:** `channel_message` row written. `announcement_meta` written with V2 defaults.
Two-layer gate held. Session attribution preserved via `system_data.session_id`.

**Error paths:**

- `broadcast.send` capability gate rejects (employee attempting Day-Control publish) → server
  action returns 403; UI shows "Ikke tillatelse".
- RPC rejects (is_manager_in_workspace false, e.g. role downgraded) → second defense layer
  catches; server action surfaces error toast.
- Active session not found → `session_id` resolves to NULL; announcement still publishes but
  loses session attribution; manager sees success toast (session gap is non-fatal).
- Day-Control deleted (D deleted files in git status) — these components were reverted as part
  of the UX smoke pivot (commit `dbcf03a72`). The server-action path (`send-broadcast-action.ts`)
  remains; callers that no longer exist will not trigger it until Day-Control is re-introduced.
