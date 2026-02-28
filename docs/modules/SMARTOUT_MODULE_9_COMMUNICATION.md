# Module 9: Kommunikasjon (Communication)

> **Smartout.io** — Functional documentation for migration
> Version 1.0 | February 2026
> **Dependencies:** Core Architecture v2 (Profile, Team, Department), Module 4 (Handoff, Day Brief, Session Notes, AI Operations), Module 12 (Communication Engine)

---

## 1. Module Overview

Communication in Smartout is the connective tissue between all other modules. It handles how information flows between people — from real-time team chat during a shift to scheduled notifications about upcoming training deadlines.

**Key insight:** Smartout is NOT building a general-purpose messaging platform. Every communication feature exists to serve operational needs: shift coordination, task updates, training reminders, HACCP alerts, handoffs, and management decisions. The system is designed to reduce noise, not create it.

### Communication Channels

| Channel                | Technology                                   | Use case                                                   | Latency          |
| ---------------------- | -------------------------------------------- | ---------------------------------------------------------- | ---------------- |
| **In-app chat**        | Supabase Realtime                            | Team coordination, quick questions, shift chat             | Real-time        |
| **Push notifications** | Expo Push (React Native), Web Push (Next.js) | Task alerts, shift reminders, training nudges              | Seconds          |
| **SMS**                | Twilio                                       | Critical alerts, employees who don't use the app regularly | Seconds          |
| **Email**              | Resend                                       | Formal communications, schedules, payslips, invite links   | Minutes          |
| **Voice**              | Twilio + Ultravox                            | AI handoff calls, emergency escalations                    | Real-time        |
| **In-app alerts**      | App UI                                       | Non-urgent notifications, status updates                   | On next app open |

### What This Module Covers

- Team chat (group + direct messages)
- Notification system (multi-channel delivery)
- Announcements (workspace/department-wide)
- Handoff delivery (from Module 4 → Communication channels)
- Escalation routing
- Quiet hours and rate limiting
- Notification preferences

### What This Module Does NOT Cover

- Handoff content creation (Module 4)
- Day Brief compilation (Module 4 AI Operations)
- AI chat assistant / Mr. Botsson (Module 12)
- Voice AI conversations (Module 12)

---

## 2. Team Chat

### 2.1 Chat Architecture

Chat in Smartout is organized around **operational groups**, not arbitrary threads:

```
Workspace: Bårdshaug Vegkro
  │
  ├── Department Channels (auto-created)
  │     ├── #kjøkken (all Kitchen profiles)
  │     ├── #sal (all Service profiles)
  │     └── #bar (all Bar profiles)
  │
  ├── Team Channels (auto-created per team)
  │     ├── #lunsj-kjøkken (Lunch Kitchen team)
  │     ├── #a-la-carte (À la Carte team)
  │     └── #event-crew (cross-departmental)
  │
  ├── Session Channels (auto-created per active session)
  │     ├── #kjøkken-24feb (Kitchen session today)
  │     ├── #sal-24feb (Service session today)
  │     └── Archived after session closes
  │
  ├── Custom Channels (admin-created)
  │     ├── #ledelse (management only)
  │     └── #sosialt (optional social channel)
  │
  └── Direct Messages
        ├── Anna ↔ Erik
        └── Manager ↔ Employee (1:1)
```

### 2.2 Data Model

```
chat_channel
  channel_id           uuid (PK)
  workspace_id         fk → workspace

  -- Identity
  name                 string ("#kjøkken", "#lunsj-kjøkken", "#kjøkken-24feb")
  channel_type         department | team | session | custom | direct

  -- Auto-linking
  department_id        fk → department | null (for department channels)
  team_id              fk → team | null (for team channels)
  session_id           fk → department_session | null (for session channels)

  -- Members (for custom and direct channels)
  -- Department/team channels derive membership from org structure
  -- Session channels derive from who's on shift

  -- Settings
  is_read_only         boolean (announcements can be read-only)
  is_archived          boolean (session channels auto-archive on session close)
  created_by           fk → profile | null (null = system-created)

  created_at           timestamp
  updated_at           timestamp


chat_channel_member
  id                   uuid (PK)
  channel_id           fk → chat_channel
  profile_id           fk → profile

  -- Role in channel
  role                 member | admin (admin can pin, moderate)

  -- Read tracking
  last_read_at         timestamp | null

  -- Notifications
  muted                boolean (per-channel mute)
  muted_until          timestamp | null (temporary mute)

  joined_at            timestamp


chat_message
  message_id           uuid (PK)
  channel_id           fk → chat_channel
  workspace_id         fk → workspace

  -- Author
  sender_id            fk → profile

  -- Content
  content              text (markdown-supported)
  message_type         text | image | file | system | brief | handoff | announcement

  -- Media
  media_urls           jsonb | null ([{type, url, filename, size_bytes}])

  -- Threading
  reply_to_id          fk → chat_message | null (thread reply)

  -- System message metadata (for briefs, handoffs, announcements)
  system_data          jsonb | null ({source_type, source_ref_id, ...})

  -- Status
  is_edited            boolean
  edited_at            timestamp | null
  is_deleted           boolean (soft delete — content replaced with "Message deleted")

  -- Pinned
  is_pinned            boolean
  pinned_by            fk → profile | null
  pinned_at            timestamp | null

  created_at           timestamp


chat_message_read
  id                   uuid (PK)
  message_id           fk → chat_message
  profile_id           fk → profile
  read_at              timestamp
```

### 2.3 Session Channels

Session channels are the operational heartbeat:

- **Auto-created** when a Department Session becomes `active`
- **Members:** Everyone with a shift in that session
- **Content:** Task updates, notes, quick coordination
- **System messages:** Day Brief posted at session start, handoff summary posted at session close
- **Auto-archived** when session is `closed` — still searchable, but no new messages

### 2.4 Read Receipts

- Per-message read tracking via `chat_message_read`
- Channel-level "last read" via `chat_channel_member.last_read_at`
- Unread count = messages in channel where `created_at > last_read_at`
- For operational channels (session, department), read receipts are optional — configurable per workspace

### 2.5 Media Handling

- Images and files uploaded to Supabase Storage under `{workspace_id}/chat/{channel_id}/`
- Supported: images (jpg, png, gif), documents (pdf), and short voice clips (m4a, opus)
- Max file size: configurable per workspace (default: 10MB)
- RLS: only channel members can access media

---

## 3. Notification System

### 3.1 Notification Architecture

Every notification in Smartout follows a pipeline:

```
Event occurs (task overdue, shift published, training due, etc.)
  │
  ├── Notification created in database
  │
  ├── Channel selection (based on priority + user preferences):
  │     CRITICAL → Push + SMS + In-app
  │     HIGH     → Push + In-app
  │     NORMAL   → Push or In-app (based on preference)
  │     LOW      → In-app only
  │
  ├── Quiet hours check:
  │     If within quiet hours AND not CRITICAL → queue for morning delivery
  │     If CRITICAL → deliver immediately regardless
  │
  ├── Rate limiting check:
  │     Max N notifications per hour per user (configurable)
  │     If exceeded → batch into digest
  │
  └── Delivery via selected channel(s)
```

### 3.2 Data Model

```
notification
  notification_id      uuid (PK)
  workspace_id         fk → workspace
  profile_id           fk → profile (recipient)

  -- Content
  title                string ("Oppgave forfalt", "Ny vakt publisert")
  body                 text ("Temperatursjekk var forfalt kl. 14:00")

  -- Categorization
  category             shift | task | training | haccp | absence | payroll | system | chat | announcement
  priority             critical | high | normal | low

  -- Source
  source_type          string (module or entity that generated this)
  source_ref_id        uuid | null (reference to the source entity)
  action_url           string | null (deep link to relevant screen)

  -- Delivery tracking
  channels_sent        jsonb ([{channel: "push", sent_at: "...", delivered: true}])

  -- User interaction
  read_at              timestamp | null
  dismissed_at         timestamp | null
  actioned_at          timestamp | null (if notification had an action and user took it)

  created_at           timestamp
```

### 3.3 Notification Categories and Triggers

| Category         | Triggers                                                                      | Default Priority                    |
| ---------------- | ----------------------------------------------------------------------------- | ----------------------------------- |
| **shift**        | Shift published, shift change, shift reminder (1h before), shift swap request | normal                              |
| **task**         | Task assigned, task overdue, task escalated, session approaching close        | high (overdue/escalated: critical)  |
| **training**     | Protocol assigned, test deadline approaching, protocol updated                | normal                              |
| **haccp**        | Temperature deviation, HACCP task overdue, certificate expiring               | critical (deviation), high (others) |
| **absence**      | Request submitted, request approved/denied, absence starting                  | normal                              |
| **payroll**      | Payslip ready, pay period closing, discrepancy detected                       | normal                              |
| **system**       | Workspace settings changed, new module activated, maintenance                 | low                                 |
| **chat**         | Direct message, @mention in channel, pinned message                           | normal (DM: high)                   |
| **announcement** | Workspace-wide or department announcement                                     | per announcement                    |

### 3.4 User Notification Preferences

Stored on `profile.notification_pref` (jsonb):

```json
{
  "push_enabled": true,
  "sms_enabled": true,
  "email_enabled": true,

  "quiet_hours": {
    "enabled": true,
    "start": "22:00",
    "end": "07:00"
  },

  "category_overrides": {
    "chat": { "push_enabled": false },
    "training": { "sms_enabled": false }
  },

  "digest_mode": false
}
```

**Critical notifications (HACCP deviations, no-show alerts, emergency escalations) ALWAYS deliver regardless of preferences.** This is non-configurable for safety compliance.

---

## 4. Announcements

### 4.1 How Announcements Work

Announcements are formal messages from management to groups of employees:

```
announcement
  announcement_id      uuid (PK)
  workspace_id         fk → workspace

  -- Author
  created_by           fk → profile

  -- Content
  title                string ("Ny meny fra mandag", "Julelunsj 20. desember")
  body                 text (markdown-supported)
  media_urls           jsonb | null

  -- Targeting
  scope                workspace | department | team
  scope_ref_id         uuid | null (department_id or team_id; null for workspace)

  -- Settings
  priority             normal | high | urgent
  requires_read_confirmation boolean (must employees acknowledge?)

  -- Scheduling
  published_at         timestamp | null (null = draft)
  expires_at           timestamp | null (auto-hide after date)

  -- Delivery
  deliver_via_chat     boolean (post to relevant channel?)
  deliver_via_push     boolean
  deliver_via_email    boolean

  is_pinned            boolean

  created_at           timestamp
  updated_at           timestamp


announcement_read
  id                   uuid (PK)
  announcement_id      fk → announcement
  profile_id           fk → profile
  read_at              timestamp
  confirmed_at         timestamp | null (if requires_read_confirmation)
```

### 4.2 Announcement with Read Confirmation

For important announcements (new allergen policy, schedule changes, safety updates):

- `requires_read_confirmation: true`
- Every targeted employee must explicitly confirm they've read it
- Manager dashboard shows: "12/15 employees have confirmed. Missing: Erik, Ole, Kari."
- AI sends reminders to non-confirmers after 24/48 hours

---

## 5. Handoff & Brief Delivery

### 5.1 How Module 4 Content Reaches Employees

Module 4 creates the content (Day Brief, Shift Brief, Handoff summaries). Module 9 handles the delivery:

| Content             | Created by                            | Delivered via                                                                    |
| ------------------- | ------------------------------------- | -------------------------------------------------------------------------------- |
| **Day Brief**       | AI Operations (Module 4)              | Session channel (as system message) + Push notification to first shift employees |
| **Shift Brief**     | AI Operations (Module 4)              | Push notification to employee at punch-in + in-app card                          |
| **Handoff Summary** | AI extraction from handoff (Module 4) | Session channel + next session's Day Brief                                       |
| **Session Notes**   | Added during session (Module 4)       | Real-time in session channel (if `visibility` allows)                            |

### 5.2 System Messages in Chat

When a Day Brief or Handoff is delivered to a channel, it appears as a `message_type: brief` or `message_type: handoff` with structured rendering:

```
┌─────────────────────────────────────┐
│ 📋 Daglig Brief — Kjøkken 24. feb  │
│                                     │
│ Vakter: 4 (Anna, Erik, Lise, Ole)  │
│ Oppgaver: 12 planlagt               │
│                                     │
│ ⚠️ Fra gårsdagens handoff:          │
│ • Ovn 2 fungerer fortsatt ikke      │
│ • Sukkerleveranse kommer kl. 08:00  │
│                                     │
│ 📌 Notater:                         │
│ • Privat event 20 pers kl. 19:00   │
│ • Mattilsynet kan komme på besøk    │
│                                     │
│ God service! 💪                     │
└─────────────────────────────────────┘
```

---

## 6. Escalation Routing

### 6.1 Escalation as Communication

Escalations (from Module 4 Runbooks) are routed through the notification system:

```
Escalation triggered (e.g., HACCP deviation unresolved)
  │
  ├── Level 1: Team leader
  │     Channel: Push + In-app
  │     Timeout: 20 minutes
  │     If no response → Level 2
  │
  ├── Level 2: Department manager
  │     Channel: Push + SMS
  │     Timeout: 20 minutes
  │     If no response → Level 3
  │
  └── Level 3: Admin / Owner
        Channel: Push + SMS + Voice call (if configured)
        No timeout — stays open until resolved
```

### 6.2 Escalation Response Tracking

Each escalation notification has an `action_url` that deep-links to the relevant task/deviation. When the recipient opens it and takes action, `actioned_at` is set on the notification. If no action within the timeout, the system auto-escalates to the next level.

---

## 7. Quiet Hours & Rate Limiting

### 7.1 Quiet Hours

- Default: 22:00–07:00 (configurable per user)
- Notifications during quiet hours are queued and delivered as a morning digest
- **Exception:** CRITICAL priority notifications are always delivered immediately
- Quiet hours respect the user's timezone (from Profile or Workspace)

### 7.2 Rate Limiting

- Default: max 20 notifications per hour per user
- If exceeded, remaining notifications are batched into a digest
- AI manages this: "You have 5 task updates" instead of 5 individual notifications
- Rate limit is configurable per workspace via `ai_operations_config`

### 7.3 Morning Digest

If notifications were queued during quiet hours or rate-limited:

```
Push notification at 07:00:
"God morgen, Anna! Du har:
 • 2 nye vakter publisert
 • 1 treningspåminnelse
 • 3 chatmeldinger
 Åpne appen for detaljer."
```

---

## 8. Communication Engine (AI)

### 8.1 What the Communication Engine Does

The Communication Engine (Mr. Botsson, Module 12) handles message intelligence:

| Function                  | What it does                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| **Channel selection**     | Given notification priority + user preferences → pick optimal channel(s)                  |
| **Message formatting**    | Adapt message tone and length for channel (SMS = short, email = formal, push = concise)   |
| **Language adaptation**   | Format message in user's `preferred_language` (Norwegian default, multi-language support) |
| **Batch intelligence**    | Group related notifications into coherent digests                                         |
| **Delivery optimization** | Track which channels actually reach each user (if someone never opens email, prefer push) |
| **Template management**   | Maintain message templates per notification category, season, and context                 |

### 8.2 Message Templates

System messages use templates with variable substitution:

```
Template: shift_published
  Push: "Ny vakt: {date} kl. {start_time}–{end_time} ({position})"
  SMS: "Smartout: Du har fått ny vakt {date} {start_time}-{end_time}. Åpne appen for detaljer."
  Email:
    Subject: "Ny vakt publisert — {date}"
    Body: "Hei {first_name}, ..."
```

Templates are configurable per workspace. AI can suggest improvements based on open/response rates.

---

## 9. Data Entities Summary

### New Tables (this module)

| Entity                  | Purpose                                                    | Key fields                                             |
| ----------------------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| **chat_channel**        | Chat rooms — auto-created for departments, teams, sessions | channel_type, auto-linked to department/team/session   |
| **chat_channel_member** | Membership and read state per channel                      | role, last_read_at, muted                              |
| **chat_message**        | Individual messages with threading and media               | content, message_type, reply_to_id, system_data        |
| **chat_message_read**   | Per-message read receipts                                  | message_id, profile_id, read_at                        |
| **notification**        | Multi-channel notification with delivery tracking          | category, priority, channels_sent, read/actioned state |
| **announcement**        | Formal management communications                           | scope, requires_read_confirmation, scheduling          |
| **announcement_read**   | Announcement read/confirmation tracking                    | read_at, confirmed_at                                  |

---

## 10. Integration Points

| Module                   | Integration                                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| **Core Architecture**    | Profile notification preferences. Team/Department membership drives channel membership.               |
| **Module 1: Onboarding** | Invite delivery (email/SMS). Trainee welcome messages. Onboarding chat support.                       |
| **Module 3: Scheduling** | Shift published → notification. Shift swap → notification. Schedule reminders.                        |
| **Module 4: Operations** | Day Brief → session channel. Handoff → session channel + next brief. Task alerts. Escalation routing. |
| **Module 5: HACCP**      | HACCP deviation alerts (CRITICAL priority). Certificate expiry reminders.                             |
| **Module 6: Training**   | Protocol assigned → notification. Deadline reminders. Test results.                                   |
| **Module 7: Absence**    | Request submitted/approved/denied notifications.                                                      |
| **Module 8: Payroll**    | Payslip ready notification. Period closing alerts.                                                    |
| **Module 12: AI**        | Communication Engine for channel selection, formatting, templates. Mr. Botsson chat integration.      |

---

## 11. Implementation Sequence

| Phase                              | Scope                                                                                 | Duration   |
| ---------------------------------- | ------------------------------------------------------------------------------------- | ---------- |
| **1. Notification infrastructure** | `notification` table. Multi-channel delivery (push + in-app). Preference handling.    | Week 1–3   |
| **2. Push notifications**          | Expo Push setup (React Native). Web Push setup (Next.js). Token management.           | Week 4–5   |
| **3. SMS & Email**                 | Twilio integration for SMS. Resend integration for email. Template system.            | Week 6–7   |
| **4. Team chat**                   | `chat_channel`, `chat_message` tables. Supabase Realtime. Department + team channels. | Week 8–10  |
| **5. Session channels**            | Auto-create on session start. System messages (briefs, handoffs). Auto-archive.       | Week 11–12 |
| **6. Announcements**               | `announcement` table. Read confirmation. Admin UI. Multi-channel delivery.            | Week 13–14 |
| **7. Escalation routing**          | Timeout-based escalation chain. Level tracking. Voice call integration (Twilio).      | Week 15–16 |
| **8. Quiet hours & rate limiting** | Queue system for delayed delivery. Digest compilation. Morning digest push.           | Week 17–18 |

---

## 12. Migration Notes

Specific considerations for migration from Bubble to Next.js/Supabase:

- **Chat via Supabase Realtime:** Use Supabase's built-in Realtime subscriptions for chat. Subscribe to `chat_message` inserts filtered by `channel_id`. No need for a separate WebSocket server.
- **Message storage:** `chat_message` will be high-volume. Partition by `workspace_id` or `created_at` month. Add composite index on `(channel_id, created_at)` for pagination.
- **Read receipts:** `chat_message_read` is very high-volume (messages × readers). Consider: only track for DMs and channels with `requires_read_confirmation`, not for large department channels.
- **Push tokens:** Store Expo Push tokens and Web Push subscriptions per device, linked to Profile. Users can have multiple devices.
- **SMS costs:** Twilio SMS costs per message. Use sparingly — only for CRITICAL/HIGH priority when push isn't available. Track delivery success to avoid sending SMS to invalid numbers.
- **Email delivery:** Resend handles deliverability. Use workspace branding (logo, colors) in email templates.
- **RLS for chat:** Users can only see messages in channels they're a member of. Channel membership derived from org structure (department/team) or explicit membership (custom/direct).
- **Session channel lifecycle:** Auto-create via Edge Function when session becomes `active`. Auto-archive when session `closed`. Archived channels are read-only but searchable.
- **Notification deduplication:** Edge Function that creates notifications should check for existing unread notifications of the same type/source to avoid spam.
- **Offline chat:** React Native queue for messages sent while offline. Sync on reconnect with conflict resolution (last-write-wins for read state, append-only for messages).
- **Search:** Consider `pg_trgm` for full-text search across chat messages and announcements within a workspace.

---

_Communication in Smartout is purpose-built for restaurant operations — every channel, notification, and message serves an operational need. Session channels auto-create and auto-archive with the daily rhythm. Day Briefs and Handoffs flow through chat as structured system messages. Escalations route through priority-based channels with timeout-based level progression. The system reduces noise (rate limiting, quiet hours, batching) while ensuring nothing critical is missed (CRITICAL priority always delivers)._
