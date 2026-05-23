---
title: "Communication Domain — Overview"
status: done
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: communication
tags: [domain, communication, channels, cascade, C2, overview]
---

# Communication Domain — Overview

## What it is

Communication is the **workspace-scoped in-app messaging and coordination fabric**.
It owns persistent channels (automatically tied to the org structure), real-time messages,
voice/video calls, targeted session notes, and the helpdesk surface. Every message a human
sends to another human (or receives from the system) passes through this domain.

**Norwegian label:** Komm
**Primary route:** `/dashboard/komm`
**UI entry:** `apps/web/src/app/dashboard/komm/page.tsx` and sub-routes

---

## What it is NOT

| Surface | Owner |
|---|---|
| External delivery (push, SMS, email) | Future **notifications** domain |
| Broadcast news/announcements (Nyheter) | **Announcements** (`docs/domains/announcements/`) |
| Botsson AI ↔ human conversations / Orb voice | Future **botsson** domain |
| Session channel container creation | **day-session** domain (creates the `department_session` row that triggers channel creation) |
| Engine process routing (`session.channel` modality: voice/chat/sms) | Stage-engine / capability layer (not this domain) |

---

## Purpose

1. **Shift coordination** — department channels, team channels, and ephemeral session channels tie staff to the operational day.
2. **Targeted communication** — managers send notes to specific roles, shifts, or individuals via `session_note` fanout (ADR-0331/ADR-0332).
3. **Helpdesk** — any channel can be enabled as a helpdesk surface (`helpdesk_enabled` flag, ADR-0165); tickets are `engine_state` rows, conversations are linked channel threads (ADR-0161).
4. **Voice/video** — push-to-talk and open-mic calls via LiveKit (`@smartout/walkie-talkie` package) per per-channel audio/video policy.
5. **AI as participant** — Botsson has a profile, membership, and `channel_ai_policy` row per channel; behavior is governed by policy (currently un-wired, see GAPS).

---

## Cascade placement

Communication sits at **C2 Interaction Control Plane** in the cascade model:

| Role | Description |
|---|---|
| **Consumer** (ADR-0087) | Receives cascade-derived intelligence as `channel_message` or `channel_event` inserts from Event Engine process steps. Never queries D1–D6/C1–C4 tables directly. |
| **Thin display layer** | Routes, hooks, and components render what the Event Engine delivers. Business logic lives upstream. |
| **C2 seam** | When C2 is implemented, it will translate cascade state into context-aware content and write to `channel_event` (projected from `engine_event` per ADR-0160). Currently unimplemented. |

```
Cascade Pipeline (D1–D6, C1–C4, K1a/K1b)
    ↓ produces derived state
C2 Interaction Control Plane            ← NOT BUILT (gap)
    ↓ translates to context-aware content
Event Engine (engine_event → engine_dispatch)
    ↓ projects to
channel_event (projection)              ← NOT BUILT (gap — zero writers)
    ↓ consumed by
Komm UI (hooks → components)
```

The `planning_event` query in `use-communication-overview.ts` is a **grandfathered** direct cascade query. It must not be extended (ADR-0087 §1).

---

## Governing ADRs (canonical set)

| ADR | Title | What it governs |
|---|---|---|
| [ADR-0063](../../decisions/0063-communication-system-consolidation.md) | Komm canonical, Chat frozen | All new messaging targets Komm; Chat is frozen |
| [ADR-0078](../../decisions/0078-engine-process-channel-restriction.md) | Engine process channel restriction | 3-layer channel guard; PII tools → chat-only; Category C proposal tools |
| [ADR-0087](../../decisions/0087-communications-as-cascade-consumer.md) | Communications as cascade consumer | No new cascade queries in Komm; intelligence via Event Engine |
| [ADR-0160](../../decisions/0160-channel-event-vs-engine-event-boundary.md) | channel_event vs engine_event | channel_event is projection of engine_event; engine_event is authoritative |
| [ADR-0161](../../decisions/0161-helpdesk-ontology-ticket-as-engine-state.md) | Helpdesk ontology | Ticket = engine_state; channel = conversation thread |
| [ADR-0162](../../decisions/0162-helpdesk-query-capability-placement.md) | helpdesk_query capability placement | New isolated capability; never extend `communication` with PII tools |
| [ADR-0163](../../decisions/0163-adr-0078-amendment-pii-allowedchannels-mandatory.md) | allowedChannels mandatory for PII | Any capability handling PII must declare `allowedChannels: ['chat']` |
| [ADR-0165](../../decisions/0165-progressive-channel-discriminator.md) | Progressive channel discriminator | `helpdesk_enabled` flag is truth source; `channel_type='desk'` deprecated |
| [ADR-0282](../../decisions/0282-voice-plane-consolidation-livekit-only.md) | Voice plane: LiveKit only | LiveKit is the only WebRTC engine; Ultravox/Twilio voice deprecated |
| [ADR-0334](../../decisions/0334-ephemeral-presence-supabase-broadcast.md) | Ephemeral presence via broadcast | Typing indicator + delivered-ack via Supabase broadcast; `channel_presence` for durable status |
| [ADR-0336](../../decisions/0336-channel-admin-capability-split.md) | Channel-admin capability split | `channel_admin` is separate capability from `communication`; 3 authority tiers |
| [ADR-0369](../../decisions/0369-announcement-atomicity-rpc-body-fanout.md) | Announcement atomicity | Fan-out in RPC body, not in `AFTER INSERT` trigger |
| [ADR-0370](../../decisions/0370-capability-boundary-for-announcement-surface.md) | Capability boundary for announcements | `publish_announcement` stays in `communication` capability; `broadcast.send` gate unchanged |

---

## Key packages + surfaces

| Surface | Path |
|---|---|
| Web route root | `apps/web/src/app/dashboard/komm/` |
| Communication capability | `packages/ai/src/capabilities/communication/` |
| Channel-admin capability | `packages/ai/src/capabilities/channel-admin/` |
| Voice (LiveKit) package | `packages/walkieTalkie/` |
| Supabase migration series | `supabase/migrations/20260422300*` (15 files) + helpdesk `20260515130*` |
| E2E helpers | `apps/e2e/helpers/communication-harness.ts` |
