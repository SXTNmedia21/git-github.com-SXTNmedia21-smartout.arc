---
title: Module — Communication
status: archived
updated: 2026-05-23
created: 2026-04-13
module: communication
tags: [module, communication, channels, voice, ai]
superseded_by: docs/domains/communication/
---

> **ARCHIVED 2026-05-23** — Absorbed into `docs/domains/communication/`. This file is superseded; do not edit.
> Single source of truth: `docs/domains/communication/`



# Module — Communication (Komm)

## 1. Overview

The Communications module ("Komm") provides workspace-scoped messaging, voice calls, and news delivery for shift-based businesses. It is the primary real-time collaboration surface in Smartout, serving three audiences:

1. **Shift workers** — receive briefings, ask questions, coordinate with teammates during sessions
2. **Managers** — broadcast announcements, monitor help requests, conduct handoff briefings
3. **System / AI** — deliver proactive intelligence (shift prep, KPI alerts, summaries) into channels

Komm is a **thin display layer**. Per ADR-0087, it does not own domain logic or query cascade dimensions directly. Intelligence arrives via the Event Engine and C2 Interaction Control Plane, materialized as `channel_message` or `channel_event` inserts.

**Route:** `/dashboard/komm`
**UI entry point:** `apps/web/src/app/dashboard/komm/_components/KommShell.tsx`
**Database migration:** `supabase/migrations/20260422300000_channel_communications.sql`

---

## 2. Cascade Dimension Dependencies

Komm consumes cascade-derived data but never queries dimension tables directly (except one grandfathered case noted below).

| Dimension | What Komm Receives | Delivery Mechanism |
|-----------|--------------------|--------------------|
| **D1 Envelope** (departments, locations) | Department channels auto-created on department INSERT. Channel scoped to department context. | Trigger: `auto_create_department_channel()` |
| **D2 Resource** (profiles, teams) | Team channels auto-created on team INSERT. Channel membership synced when `profile.department_id` changes. Readiness context for briefings. | Triggers: `auto_create_team_channel()`, `sync_profile_department_channel()` |
| **D4 Demand** (seasons, planning events) | Planning events displayed in communication overview. | Grandfathered direct query in `use-communication-overview.ts` (ADR-0087 §1: must not be extended) |
| **D6 Production** (sessions, shifts) | Session channels auto-created on `department_session` INSERT. Shift briefings and handoff summaries delivered as messages. | Trigger: `auto_create_session_channel()`. Briefings via Event Engine process steps. |
| **C1 Calibration** (KPI deviations) | KPI deviation alerts delivered as `announcement` or `reminder` messages into relevant channels. | FUTURE: Event Engine process triggered by C1 reconciliation. |
| **C2 Interaction** (context synthesis) | Intelligence-driven proactive messages: shift prep, contextual tips, deviation explanations. | FUTURE: C2 translates cascade state into context-aware content, Event Engine delivers to `channel_event` / `channel_message`. Not yet implemented. |

---

## 3. Channel Types

Defined as `comm_channel_type` enum:

| Type | Scope | Auto-Created? | Description |
|------|-------|---------------|-------------|
| `department` | Department | Yes (on department INSERT) | One per department. All department members auto-joined. |
| `team` | Team | Yes (on team INSERT) | One per team. Team members auto-joined. |
| `session` | Department session | Yes (on department_session INSERT) | Ephemeral channel for a single operational day. Duty leader auto-added. Archived when session closes. |
| `custom` | Workspace | No (user-created) | Freeform channels created by managers/admins. |
| `direct` | Two profiles | No (on first DM) | 1:1 private messaging. Identified by `direct_pair_hash`. |
| `news` | Workspace | No (admin-created) | Read-only broadcast channels for announcements and company news. |
| `skill` | Workspace | No (system-created) | Channels associated with specific competence areas for knowledge sharing. |

### Structural FKs on `channel`

- `department_id` — links department channels to their department
- `team_id` — links team channels to their team
- `session_id` — links session channels to their `department_session`
- `direct_pair_hash` — deterministic hash for direct message pair uniqueness

### Uniqueness Constraints

- One active (non-archived) channel per department: `idx_channel_one_per_department`
- One active channel per team: `idx_channel_one_per_team`
- One active channel per session: `idx_channel_one_per_session`
- One direct channel per pair: `idx_channel_direct_pair`

---

## 4. Message Types

Defined as `channel_message_type` enum:

| Type | Origin | Description |
|------|--------|-------------|
| `text` | human / ai | Standard text message |
| `image` | human | Image attachment with optional caption |
| `file` | human | File attachment (PDF, document, etc.) |
| `voice_clip` | human | Recorded audio clip (PTT or standalone) |
| `system` | system | Membership changes, channel events, lifecycle updates |
| `brief` | ai / system | Shift briefing — structured pre-shift intelligence summary |
| `handoff` | ai / system | End-of-session handoff — what happened, what to watch |
| `announcement` | human / system | Pinnable broadcast from managers or system alerts |
| `reminder` | system / ai | Time-triggered or event-triggered reminder |
| `summary` | ai | Auto-generated channel summary (daily digest, session recap) |

### Message Metadata

- `origin_type` — who produced the message: `human`, `ai`, `system`, `webhook`, `scheduler`, `workflow`
- `delivery_mode` — how to surface: `timeline` (normal), `silent` (no notification), `notification_only`
- `visibility_scope` — who can see: `all_members`, `admins`, `targeted_members`
- `system_data` — JSONB payload for structured content (briefing data, KPI values, etc.)

---

## 5. AI Integration

### 5.1 Botsson Participation

Botsson (the workspace AI assistant) participates in channels as a `channel_member` with `is_ai = true`. Its behavior per channel is governed by `channel_ai_policy`:

| Policy Field | Type | Description |
|--------------|------|-------------|
| `text_participation` | `channel_ai_text_mode` | `disabled` / `mention_only` / `proactive` |
| `voice_participation` | `channel_ai_voice_mode` | `disabled` / `listen_only` / `interactive` |
| `auto_summarize` | boolean | Generate daily/session summaries |
| `auto_shift_prep` | boolean | Compose shift briefing before session opens |
| `auto_reminders` | boolean | Send time-triggered task reminders |
| `personality_override` | JSONB | Custom tone/persona for this channel |

### 5.2 Communication Capability Tools

Per ADR-0087 §5, AI tools that compose intelligence live in `packages/ai/src/capabilities/`, not in Komm hooks:

- `compose_shift_briefing` — reads D2+D6+K1b+D3 to produce a structured `brief` message
- `compose_handoff_summary` — reads session metrics + deviation log for end-of-session handoff
- `compose_kpi_alert` — translates C1 reconciliation data into human-readable alert

These tools are invoked by Event Engine process steps, not by UI code.

### 5.3 Channel Events

The `channel_event` table stores immutable machine/system/AI events:

- `event_type` — free-text event classifier (e.g., `shift.briefing.composed`, `kpi.deviation.alert`)
- `source` — origin system identifier
- `payload` — JSONB event data
- `correlation_id` / `causation_id` — event chain tracing
- `idempotency_key` — prevents duplicate event processing

Messages can reference their originating event via `channel_message.event_id`.

---

## 6. Voice

### 6.1 LiveKit Integration

Voice calls use LiveKit (via `@smartout/walkie-talkie` package) for WebRTC-based real-time audio/video.

**Connection flow:**
1. Client requests a LiveKit token via `getLiveKitToken(supabase, { channelId, workspaceId })`
2. Token is minted by a Supabase Edge Function with the user's identity
3. Client connects to LiveKit server and joins the channel room
4. Participants are tracked via Supabase Realtime signaling

### 6.2 Audio Policies

Per-channel `channel_audio_policy` enum:

| Policy | Behavior |
|--------|----------|
| `disabled` | No voice features |
| `ptt` | Push-to-talk only — mic activates on button hold |
| `open_mic` | Always-on microphone (conference mode) |
| `listen_only` | Can hear but not speak (broadcast listening) |

### 6.3 Video and Recording Policies

- `channel_video_policy`: `disabled` / `optional` / `default_on` / `required`
- `channel_recording_policy`: `off` / `optional` / `auto`
- `channel_ai_voice_policy`: `disabled` / `listen_only` / `interactive` (Botsson voice participation)

### 6.4 Call Sessions

Hooks manage the full call lifecycle:

| Hook | Purpose |
|------|---------|
| `use-start-call` | Initiate a call in a channel |
| `use-call-signaling` | Listen for incoming call invitations |
| `use-call-realtime` | Track active participants via Realtime |
| `use-call-invite` | Accept/reject incoming call invitations |
| `use-mute-participant` | Admin mute control for participants |
| `use-push-to-talk` | PTT button state management |
| `use-call-history` | Query past call sessions |

---

## 7. Architecture Contract (ADR-0087)

Communications is a **consumer**, not a domain owner. The architecture contract defines clear boundaries:

### Rules

1. **No new cascade queries in Komm hooks.** The `planning_event` query in `use-communication-overview.ts` is grandfathered but must not be extended to other dimension tables (D1-D6, C1-C4).

2. **C2 outputs arrive as data inserts.** Intelligence from the cascade pipeline is delivered as `channel_message` or `channel_event` rows, inserted by Event Engine process steps — never by UI code.

3. **Proactive messaging = Event Engine processes.** Shift briefings, handoff summaries, and KPI alerts are triggered by the calendar guardian or cascade state changes, not by Komm.

4. **`channel_ai_policy` governs Botsson behavior.** Enforced in the agent-router pipeline, not in Komm components.

5. **Briefing composition is an AI tool.** `compose_shift_briefing` reads D2+D6+K1b+D3 in `packages/ai/src/capabilities/`, not in a Komm hook.

### Data Flow

```
Cascade Pipeline (D1-D6, C1-C4, K1a/K1b)
    |  produces derived state
    v
C2 Interaction Control Plane
    |  translates to context-aware explanations
    v
Event Engine (engine_event -> engine_dispatch)
    |  delivers via process steps
    v
channel_event / channel_message
    |  consumed by
    v
Komm UI (hooks -> components)
```

---

## 8. Current Gaps

### 8.1 Dead Tables

- **`channel_ai_policy`** — table exists with full schema but has zero consumers. No UI to configure, no agent-router integration reads it. Must be wired into Botsson's per-channel behavior.
- **`channel_event`** — table exists with indexes and FK from `channel_message.event_id`, but no Event Engine process writes to it. Zero rows in development.

### 8.2 Missing C2 Implementation

The C2 Interaction Control Plane is defined in the cascade spec and referenced in ADR-0087, but has no implementation. Until C2 is built:
- No proactive shift briefings
- No KPI deviation alerts in channels
- No context-aware handoff summaries
- Komm functions as a generic chat system without cascade intelligence

### 8.3 Session Channel Lifecycle

- Session channels are auto-created but have no auto-archive trigger when `department_session.status` transitions to `closed`.
- No auto-population of session channel members from the session's scheduled shifts.
- `channel_retention_policy` exists but is not enforced by any background process.

### 8.4 Other Gaps

- News feed (`NewsFeed.tsx`) is basic — no scheduling, no targeting by role/department.
- Help desk (`HelpDesk.tsx`) exists as a component but has no routing or escalation logic.
- `channel_integration` table supports external webhooks but has no configured providers.
- Mobile parity: all hooks are in `apps/web/`, not shared `packages/`. Must be extracted per ADR-0087.

---

## 9. User Journeys

### 9.1 Shift Worker

**Precondition:** Profile is active, assigned to a department, has an upcoming shift.

1. Worker opens Komm -> sees Overview tab with today's session status and any announcements
2. Worker navigates to Kanaler -> sees department channel, team channel, and today's session channel
3. Worker opens session channel -> reads the shift briefing (FUTURE: `brief` message from C2)
4. Worker has a question -> types a message mentioning @Botsson -> receives AI-assisted answer (requires `channel_ai_policy.text_participation = 'mention_only'`)
5. Worker needs manager help -> sends message in department channel or uses help desk
6. Worker's shift ends -> reads handoff message in session channel (FUTURE: `handoff` from C2)

**Error paths:**
- No session channel exists (session not yet created) -> worker sees department and team channels only
- Botsson is disabled in channel -> mention gets no response, worker must ask a human

### 9.2 Manager

**Precondition:** Profile has `role = 'manager'` or higher, assigned to a department.

1. Manager opens Komm -> Overview shows unread counts, active help requests, today's session status
2. Manager opens session channel -> reviews briefing, checks staffing alerts
3. Manager posts an announcement in department channel -> message type `announcement`, pinnable
4. Manager receives a help request notification -> opens the channel, responds
5. Manager starts a voice call in session channel -> PTT or open mic depending on `audio_policy`
6. Session ends -> manager reviews handoff summary, adds signoff notes

**Error paths:**
- Voice call fails to connect -> toast error with retry action
- Channel has no members (empty team) -> channel exists but is effectively unused

### 9.3 Admin

**Precondition:** Profile has `role = 'admin'` or `'owner'`.

1. Admin creates a custom channel -> sets name, description, selects members
2. Admin creates a news channel -> `is_read_only = true`, posts company-wide announcements
3. Admin configures channel AI policy (FUTURE) -> enables Botsson with `proactive` text mode and `auto_summarize`
4. Admin reviews channel analytics in Overview (FUTURE) -> message volume, response times, help request resolution
5. Admin archives an old session channel -> `is_archived = true`, still searchable per retention policy

**Error paths:**
- Admin tries to create duplicate department channel -> blocked by unique index
- Admin archives active session channel -> should be prevented (session still open)
