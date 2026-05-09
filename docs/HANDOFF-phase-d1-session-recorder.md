---
title: "HANDOFF — Phase D1: Session Recorder + Platform Admin Intervention"
status: done
type: handoff
created: 2026-04-22
updated: 2026-05-09
module: MODULE_BOTSSON
tags: [botsson, session-recorder, platform-admin, guardian, whisper, handoff, phase-d1]
decisions: [ADR-0184, ADR-0185]
learnings: []
---

# HANDOFF — Phase D1: Session Recorder + Platform Admin Intervention

## What Was Built

Phase D1 landed full session observability for Mr. Botsson: every turn is recorded, redacted,
and stored. Platform admin can view sessions, flag turns, inject whispers, force-stop sessions,
and break-glass-reveal PII for urgent compliance or safety needs.

### Deliverables

| Artifact | Path | Status |
|---|---|---|
| `session-recorder.ts` | `services/stage-engine/src/core/session-recorder.ts` | 🟢 |
| `agent_session_recording` table + migration | `supabase/migrations/...` | 🟢 |
| `agent_session_envelope` table (PII vault) | `supabase/migrations/...` | 🟢 |
| `agent_session_whisper` table | `supabase/migrations/...` | 🟢 |
| `POST /api/botsson/recorder/flag` | `apps/web/src/app/api/botsson/recorder/flag/route.ts` | 🟢 |
| `POST /api/botsson/recorder/whisper` | `apps/web/src/app/api/botsson/recorder/whisper/route.ts` | 🟢 |
| `GET /api/botsson/recorder/sessions/[id]` | `apps/web/src/app/api/botsson/recorder/sessions/[id]/route.ts` | 🟢 |
| `GET /api/botsson/recorder/break-glass/[envelope_id]` | `apps/web/src/app/api/botsson/recorder/break-glass/[envelope_id]/route.ts` | 🟢 |
| `POST /api/botsson/recorder/force-stop` | `apps/web/src/app/api/botsson/recorder/force-stop/route.ts` | 🟢 |
| `useRecorderSessions` hook | `apps/web/src/app/platform-admin/guardian/_hooks/useRecorderSessions.ts` | 🟢 |
| Hook points in 6 core modules | prompt-builder, agent-router, authority, guardian-evaluator, memory-manager, tool-exec | 🟢 |
| C4 authority seed | `supabase/migrations/...` | 🟢 |
| Design spec | `docs/superpowers/specs/2026-04-22-session-recorder-platform-admin-design.md` | 🟢 |

### How It Works

The recorder is a **fire-and-forget ring buffer + async flush**. It hooks into 6 core modules:

| Hook point | Event recorded |
|---|---|
| `prompt-builder` | `prompt_built` — full prompt + injected whispers |
| `agent-router` | classifier I/O + `llm_request` + `llm_response` |
| `authority` | `authority_load` — which tools/channels authorized |
| `guardian-evaluator` | `guardian_eval` — verdict + score |
| `memory-manager` | `memory_read` + `memory_write` |
| tool exec | per-tool invocation + result |

**Key design rule:** recorder failure NEVER blocks Emma (ADR-0184 Q8b). Errors are logged, not propagated.

### Data Model

| Table | Purpose | Retention |
|---|---|---|
| `agent_session_recording` | One row per turn. JSONB `content_redacted` + `meta`. `turn_kind`, `phase`, `attention_score`, `is_flagged`. | 90d (redacted) / 365d (flagged) / permanent (metadata) |
| `agent_session_envelope` | pgcrypto-encrypted raw values for break-glass PII reveal. TTL 30d via pg_cron. | 30d |
| `agent_session_whisper` | Admin-injected context for next turn. `content`, `is_consumed`, `admin_profile_id`. | Until consumed |

### BFF Endpoints

| Endpoint | Purpose | Auth |
|---|---|---|
| `POST /recorder/flag` | Flag a turn — extends retention 90d → 365d | admin JWT |
| `POST /recorder/whisper` | Inject text to next turn via `<admin_note>` tag | C4-gated: `recorder.whisper` |
| `GET /recorder/sessions/[id]` | Dump all turns for a session | admin JWT + godmode |
| `GET /recorder/break-glass/[envelope_id]` | Decrypt PII — 5s UI window + audit trail | godmode + `recorder.pii_reveal='confirm'` |
| `POST /recorder/force-stop` | Emergency interrupt — injects "begin fresh" whisper | C4-gated: `recorder.force_stop` |

### Whisper Pattern

`POST /recorder/whisper` injects text as `agent_session_whisper` row. On next turn,
`prompt-builder.ts` reads unconsumed whispers and wraps them in `<admin_note>` tag in the
system prompt. The whisper is marked consumed after injection.

**Design note:** ADR-0185's `session_lane.status='interrupted'` framing is aspirational —
`SessionLane` is an in-memory promise queue, not a table. The whisper-pipe matches the ADR's
operational intent 1:1 without the status column.

## Decisions Made

- **ADR-0184**: Session Recorder architecture — ring buffer, hook points, retention policy,
  RLS structure. Recorder failure does not block agent.
- **ADR-0185**: Platform Admin Intervention — whisper pipe, force-stop, break-glass PII reveal,
  C4-authority seed pattern. Trust gate: whispers are NEVER user-facing.
- C4-authority seed uses `NULL workspace_id` — deviation documented in ADR-0185. This is
  intentional (platform-level seed, applies across workspaces).

## Pending (Phase 2)

At time of Phase D1 closure:
- `SessionList` component wired in platform-admin guardian UI.
- `TurnTimeline` + `AdminActionDrawer` **pending composition** in Phase 2 (UI components exist
  but not mounted in final layout).

## Known Issues / Debt

- `TurnTimeline` + `AdminActionDrawer` composition in platform-admin guardian UI — Phase 2 scope.
- `decrypt_envelope` RPC break-glass: 5s UI window is a UI-side concern, not enforced server-side.
  A determined admin could replay the API outside the window. Future: add server-side TTL on the
  decrypt RPC itself.
- Godmode WS wildcard (see HANDOFF-phase-a6-pg-notify-bus.md) affects guardian feed —
  recorder feed is correct via RLS.

## Next Steps

1. Compose `TurnTimeline` + `AdminActionDrawer` into platform-admin/guardian layout (Phase 2).
2. Recorder failure injection for E2E testing (ADR-0184 Q8b assertion surface).
3. `agent_session_envelope` pg_cron TTL job — verify active in local + production.
