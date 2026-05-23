---
title: "Communication Domain — Roadmap"
status: in_progress
mirror: aspirational
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: communication
tags: [domain, communication, roadmap, C2, helpdesk, mobile]
---

# Communication Domain — Roadmap

> All items here are **forward plans or design intent**, not verified built state.
> Verified built state lives in ARCHITECTURE.md and DATA-MODEL.md.
> Gaps between roadmap and code are listed in GAPS-AND-DEBT.md.

---

## Governing specs + plans

| Spec / Plan | Status | Reconciliation |
|---|---|---|
| `docs/superpowers/specs/2026-03-22-channel-communications-design.md` | Partially delivered | Phase 1 (messaging + policies) shipped. Phase 2 (voice/video) shipped. Phase 3 (C2 intelligence delivery) not built. See GAPS §G1–G2. |
| `docs/superpowers/specs/2026-04-20-progressive-channel-design.md` | Partially delivered | `helpdesk_enabled` flag + ADR-0165 mechanics shipped. `helpdesk_query` capability not implemented. SLA breach handler seeded. |
| `docs/superpowers/specs/2026-05-11-sendmessage-adr-0287-retrofit.md` | Delivered | `send_message` tool gated via `callGateAction()` (ADR-0287 compliance). |
| `docs/superpowers/specs/2026-05-18-announcement-kind-tier-link-design.md` | V1 REJECTED (council 2026-05-18) | V2 must implement ADR-0369 (RPC-body fan-out) + ADR-0370 (extend `communication` capability) + ADR-0371 (preserve `{title, body}` schema). No V2 spec filed yet. |

---

## Phase roadmap

### Phase A — Foundation (DONE)
- Channel types (department/team/session/custom/direct/news/skill)
- channel_message with 10 types + 16 enums
- RLS + indexes
- Auto-create triggers (department/team/session channels)
- Supabase Realtime subscriptions
- Basic chat UI (ChatClient, MessageTimeline, MessageInput)
- Voice/video via LiveKit (channel_call_session, channel_call_participant, call_log)
- Targeted note fanout (session_note.audience + cron, ADR-0331/0332/0333)

### Phase B — Helpdesk (PARTIAL)
- `channel.helpdesk_enabled` flag + `responsible_profile_id` (ADR-0165)
- `channel_member_role = 'representative'`
- Helpdesk ticket = `engine_state` with `engine_process(type='helpdesk_query')` (ADR-0161)
- SLA breach handler process seed (ADR-0234/0235)
- `desks/` route + `HelpDesk.tsx` component
- **MISSING:** `helpdesk_query` capability implementation (ADR-0162)
- **MISSING:** Escalation routing UI
- **MISSING:** Dedicated journey files for C10–C12

### Phase C — C2 Intelligence Integration (NOT STARTED)
Blocked by C2 Interaction Control Plane (cascade-level, not this domain).

Planned when C2 ships:
- `channel_event` projection trigger from `engine_event` (ADR-0160)
- Event Engine process for shift briefing delivery (`brief` message type)
- Event Engine process for end-of-session handoff (`handoff` message type)
- Event Engine process for KPI deviation alerts (from C1 reconciliation)
- Wire `channel_ai_policy.auto_shift_prep` + `auto_summarize` to Event Engine scheduling

### Phase D — channel_ai_policy wiring (NOT STARTED)
- Agent-router reads `channel_ai_policy.text_participation` before allowing Botsson to respond
- `mention_only` mode: only respond when @botsson mentioned
- `proactive` mode: allowed to inject context-aware messages
- `auto_summarize`: daily digest message posted at channel level
- Wire `channel_ai_policy.auto_reminders` to task reminder delivery

### Phase E — Mobile parity (NOT STARTED — per ADR-0087 §6 + CLAUDE.md)
- Extract all Komm hooks to `packages/` (currently all in `apps/web/src/app/dashboard/komm/_hooks/`)
- React Native chat UI in `apps/mobile/`
- Mobile voice/PTT surface (LiveKit mobile, ADR-0135)
- Offline message queue with sync-on-reconnect

### Phase F — Announcement V2 (PENDING V2 SPEC)
- ADR-0369: `publish_announcement_atomic` RPC with fan-out in RPC body
- ADR-0370: kind/tier/linked_entity_type/linked_entity_id parameters in `communication.publish_announcement`
- ADR-0371: preserve `{title, body}` schema (no collapse to `{content}`)
- Audience picker integration (JSONB audience model, ADR-0331)
- Read-confirmation UX for `requires_read_confirmation` announcements

### Phase G — Helpdesk capability + full escalation (BLOCKED on Phase B completion)
- `helpdesk_query` capability implementation (ADR-0162)
- 5-touchpoint registration: CapabilityName union + registry + intent-classifier + index.ts + authority seed
- Escalation routing with `engine_delayed_trigger` for SLA (ADR-0234/0235)
- Representative dashboard: queue view, SLA timers
- Video call inside desk thread

### Phase H — Quiet hours + rate limiting (NOT STARTED)
- Quiet hours enforcement (SMARTOUT_MODULE_9 §7 design, not yet in schema)
- Rate limiting per user per hour
- Morning digest compilation
- These belong to the **notifications** domain when it is defined — communication creates the messages; delivery scheduling is the future notifications domain's responsibility

---

## Deferred / aspirational
- `channel_integration` external webhooks — table exists, zero providers configured
- `channel_retention_policy` enforcement — table exists, no background enforcement process
- Search: `pg_trgm` full-text search across channel_message within workspace
- Voice call recording playback (recording_policy = auto → stored in Supabase Storage)
- Read-only broadcast channels for external stakeholders
