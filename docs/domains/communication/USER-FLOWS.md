---
title: "Communication Domain — User Flows"
status: done
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: communication
tags: [domain, communication, user-flows, journeys]
---

# Communication Domain — User Flows

> This file is a **flow index**. It references journey files in `docs/journeys/`; it does NOT duplicate them.
> Flow status: `shipped` = code confirmed in codebase; `partial` = partially built; `gap` = no code yet.

---

## Flow index

| ID | Flow | Role | Status | Journey file |
|---|---|---|---|---|
| C1 | Employee opens Komm and reads department channel | Employee | shipped | no dedicated journey file |
| C2 | Employee reads today's session channel | Employee | shipped | no dedicated journey file |
| C3 | Employee sends a message in a channel | Employee | shipped | no dedicated journey file |
| C4 | Manager posts an announcement to department | Manager | shipped | no dedicated journey file |
| C5 | Manager sends targeted note to specific shifts | Manager | shipped | [JOURNEY-dagslinjen-quickadd-manager-target-note-fanout](../../journeys/JOURNEY-dagslinjen-quickadd-manager-target-note-fanout.md) |
| C6 | Employee receives targeted note | Employee | shipped | sibling of C5 |
| C7 | Manager starts a voice/PTT call in a channel | Manager | shipped | no dedicated journey file |
| C8 | Employee joins an incoming call | Employee | shipped | no dedicated journey file |
| C9 | Admin creates a custom channel | Admin | shipped | no dedicated journey file |
| C10 | Admin enables helpdesk on a channel | Admin | partial | no dedicated journey file |
| C11 | Employee opens a help desk query | Employee | partial | no dedicated journey file |
| C12 | Representative picks up a help desk query | Representative | partial | no dedicated journey file |
| C13 | AI (Botsson) participates in a channel via mention | Employee | gap | no code — `channel_ai_policy` unwired |
| C14 | Shift briefing delivered to session channel (C2 intelligence) | System | gap | no code — C2 not built |
| C15 | Handoff summary delivered to session channel | System | gap | no code — C2 not built |
| C16 | KPI deviation alert delivered to channel | System | gap | no code — C1→C2→Event Engine not built |

---

## Key flow notes

### C5 — Targeted note fanout

- **Where:** Day-session surface (`/dashboard/komm/oversikt` or quickadd popover in Dagslinjen)
- **How:** Manager creates `session_note` with `session_note_type='targeted'`, `audience JSONB`, and optional `notify_at`.
- **Schema anchor:** `session_note.audience` + `notify_at` + `delivered_at` (`20260616100501_session_note_targeted_fanout.sql`)
- **Cron:** `note_fanout_scheduler` cron fires at `notify_at`, resolves audience to profile_ids, sends notifications.
- **ADRs:** ADR-0331 (audience model), ADR-0332 (cadence), ADR-0333 (cross-dept C4 gate).
- **Seam note:** `session_note` is owned by the day-session domain; the fanout logic crosses into communication's notification territory. Communication domain owns the downstream notification dispatch; day-session owns the note row itself.

### C10–C12 — Helpdesk flows

- **Schema state:** `channel.helpdesk_enabled` flag (ADR-0165) + `channel_member_role='representative'`. Helpdesk ticket is an `engine_state` (ADR-0161). Phase 1 migrations shipped (`20260515130000`–`20260518240200`).
- **UI state:** `HelpDesk.tsx` component exists in `_components/`; `desks/` route exists. Routing and escalation logic partial.
- **Capability state:** `helpdesk_query` capability not yet implemented (ADR-0162 design accepted only).
- **Journeys:** No dedicated journey files yet. Treat C10–C12 as gaps requiring journey documentation before feature completion.

### C13 — Botsson in-channel participation

- **Blocked by:** `channel_ai_policy` half-wired (L-0086). Policy rows exist + seeds exist. Agent-router does NOT read the table. `isAiAllowedInChannel()` in `communication/policy.ts` exists as Layer 3 check, but Layer 0 (agent-router dispatch) doesn't consult per-channel AI policy.
- **When built:** Will require agent-router update to query `channel_ai_policy` before allowing Botsson to respond in a channel.

### C14–C16 — C2 intelligence delivery

- **Blocked by:** C2 Interaction Control Plane not built + `channel_event` projection trigger not implemented.
- **Current state:** `channel_event` table has zero rows in development. No Event Engine process writes briefings/handoffs/KPI alerts to channels.
- **AI tools exist:** `compose_shift_briefing`, `compile_day_brief`, `compile_preclose` are in the `communication` capability, but no Event Engine process invokes them on schedule.

---

## Linked journeys in other domains

These journeys exist in sibling domains but touch communication surfaces:

| Journey | Primary domain | Communication seam |
|---|---|---|
| [JOURNEY-dagslinjen-quickadd-manager-target-note-fanout](../../journeys/JOURNEY-dagslinjen-quickadd-manager-target-note-fanout.md) | day-session | targeted note → communication fanout |
| Botsson onboarding channel messages | botsson (future) | uses channel_message infrastructure |
