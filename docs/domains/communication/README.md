---
title: "Communication Domain — README"
status: done
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: communication
tags: [domain, communication, channels, messaging, voice, helpdesk]
---

# Communication Domain

> **Scope:** In-app messaging, channels, voice/video calls, targeted notes, and helpdesk.
> Human↔human and system→human. Everything from channel creation to message delivery within the workspace.

---

## Build state badge

| Layer | State |
|---|---|
| Schema (channel, message, voice, helpdesk) | ✅ shipped (migrations 20260422300000 series + helpdesk 20260515) |
| Web UI — Komm shell + chat + desks + nyheter | 🟡 partial (chat + announcements live; helpdesk UI partial; voice live; AI policy not wired) |
| AI capabilities (communication + channel-admin + helpdesk-query) | 🟡 partial (communication tools shipped; helpdesk-query design accepted, impl TBD) |
| Mobile parity | 🔴 gap (hooks in apps/web, not packages/) |
| C2 / Event Engine integration | 🔴 gap (channel_event table dead; channel_ai_policy zero consumers) |

---

## Reading order

| # | File | Holds |
|---|---|---|
| 1 | **README.md** (this) | Entry point, build state, agent guardrails |
| 2 | [OVERVIEW.md](./OVERVIEW.md) | What + why, cascade placement, governing ADRs |
| 3 | [ARCHITECTURE.md](./ARCHITECTURE.md) | L1–L5 code map: routes → hooks → capability → DB |
| 4 | [DATA-MODEL.md](./DATA-MODEL.md) | All tables, enums (verified), RLS, triggers |
| 5 | [USER-FLOWS.md](./USER-FLOWS.md) | Flow index + links to journey files |
| 6 | [ROADMAP.md](./ROADMAP.md) | Forward plan, governing specs, aspirational items |
| 7 | [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md) | Verified delta: built vs planned, overlap edges |
| 8 | [E2E-COVERAGE.md](./E2E-COVERAGE.md) | Test matrix — what is actually covered |

---

## Agent Guardrails

**Critical traps — read before touching any communication code:**

1. **"channel" has four meanings** (L-0069, `docs/learnings/0069-channel-term-has-four-meanings.md`):
   - `comm_channel_type` value (department/team/session/…)
   - `channel.id` — the room FK used in every child table
   - `engine_event.channel` / `session.channel` — the transport modality (voice/chat/sms)
   - LiveKit room — the WebRTC session
   Never conflate them. The word "channel" alone is ambiguous — always qualify.

2. **Never add cascade queries to Komm hooks** (ADR-0087). The `planning_event` query in
   `use-communication-overview.ts` is grandfathered; do NOT extend it to D1–D6/C1–C4 tables.
   Intelligence arrives as `channel_message` inserts from the Event Engine.

3. **Two legacy messaging systems exist** (ADR-0063): Chat (frozen) and Komm (canonical).
   All new work targets Komm (`channel`, `channel_message`, `channel_member`).
   Never add features to Chat tables/hooks/components.

4. **`channel_event` is not `engine_event`** (ADR-0160). `engine_event` is authoritative;
   `channel_event` is a projection. Komm reads `channel_event`; cascade reads `engine_event`.
   Both tables currently have zero writers for this flow — it is a gap, not a misuse.

5. **PII capabilities must declare `allowedChannels: ['chat']`** (ADR-0078, ADR-0163).
   The `communication` capability is permissive (`['chat','voice','sms','email']`).
   Helpdesk and any tool handling personnummer/bankkonto must be isolated in their own capability.

6. **Helpdesk ticket is an `engine_state`, NOT a channel_type** (ADR-0161, ADR-0165).
   Truth source for helpdesk is `channel.helpdesk_enabled` flag (progressive discriminator).
   The `channel_type='desk'` enum value is deprecated — read paths use the flag only.

7. **`channel_ai_policy` is half-wired** (L-0086). Table exists, seeds exist, but the agent-router
   pipeline does NOT read it to govern Botsson's per-channel participation. Any code that claims
   "policy enforced" without a verified agent-router code path is aspirational.

8. **Announcements are owned by the Announcements domain** (`docs/domains/announcements/`).
   They are a `channel_message` subtype with `message_type='announcement'` in a `news` channel.
   Communication domain owns the channel/message infrastructure; the Announcements domain owns
   the business logic, composers, `announcement_meta` sidecar, `publish_announcement_atomic` RPC, and UI for the Nyheter surface.

---

## Absorbed sources

| Source | Absorbed | Status |
|---|---|---|
| `docs/modules/MODULE_COMMUNICATION.md` | 2026-05-23 | archived (see frontmatter) |
| `docs/architecture/modules/SMARTOUT_MODULE_9_COMMUNICATION.md` | 2026-05-23 | archived (see frontmatter) |

---

## Overlap edges summary

| Adjacent domain | Shared surface | Resolution |
|---|---|---|
| announcements (`docs/domains/announcements/`) | `channel_message` with `message_type='announcement'` in `news` channel; M5 trigger guard | **keep** — communication owns channel/message infra + schema; announcements owns Nyheter composers, UI, `announcement_meta` sidecar, and `publish_announcement_atomic` RPC. Seam: `message_type='announcement'` discriminator + trigger guard. |
| notifications (future) | Delivery of messages to push/SMS/email | **keep** — communication CREATES the channel_message; notifications DELIVERS externally. `channel_notification_policy` is the seam table. |
| day-session | `session_id` FK on `channel` — session channel auto-created per `department_session` | **keep** — day-session creates container; communication owns the channel runtime. |
| botsson / AI | `channel_ai_policy`, AI member participation, `channel_type='ai'` | **keep** — communication owns the channel schema + policy rows; botsson domain will own the runtime behavior when built. Current state: policy tables dead (gap). |
