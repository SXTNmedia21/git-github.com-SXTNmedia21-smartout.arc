---
title: Notifications Domain — Overview
status: done
updated: 2026-05-23
created: 2026-05-23
domain: notifications
mirror: verified
last_verified: 2026-05-23
tags: [notifications, push, onesignal, outbox, pipeline, cascade-placement]
---

# Notifications — Overview

## What it is

The notifications domain is Smartout's **unified delivery infrastructure** — a single-funnel pipeline that routes every user-facing alert to the correct channel (in-app, email, SMS, or push). It answers one question: *how does the system reliably reach a person, respecting their preferences and quiet hours, across 4 delivery channels?*

It is **not** a cascade dimension. Notifications are cross-cutting service-plane infrastructure that sits below C2 Context & Interaction and is invoked by every layer of the cascade.

## Why it exists

Before this domain was built, push triggers were scattered across 6 DB triggers that called `push-dispatch` directly. There was no in-app notification surface, no quiet hours, no grouping, and the email channel was a console.log stub. The consolidation goal (ADR-0104) is a single outbox table that every layer writes to, with a single fan-out consumer.

## The one-funnel model

```
Event source (DB trigger / engine step / capability tool / cron)
        ↓
notification_outbox  INSERT
        ↓
process-notifications EF  (cron 30s in prod; INSERT trigger in dev)
   - quiet hours check (defer low-priority if DND window)
   - mode preference gate (training/work/community enabled?)
   - smart grouping (same group_key within 3 min → merge)
   - resolve title/body from event-config registry
        ↓  fans out to effectiveChannels ∩ user prefs
   ┌──────────┬──────────┬──────────┬───────────┐
 in_app     email       sms        push
 (notification  (SendGrid) (Twilio)  (push-dispatch
  table +                  priority=2  → OneSignal)
  Realtime)               only
```

Verified: `supabase/functions/process-notifications/index.ts`, function `handleRequest` + `deliverToChannels`.

## Cascade placement

Notifications do NOT live in any cascade dimension (D1–D6, C1–C4, K1a/K1b). They are orthogonal delivery infrastructure consumed by every layer:

| Layer | Relationship |
|-------|-------------|
| D6 Production | `session-task-overdue-cron` and `push-dispatch` triggers write outbox. Engine `send_notification` step writes outbox. |
| D1–D5 | Producers. Events from scheduling, cascade engine, contract lifecycle write outbox. |
| C1 Calibration | `daily_reconciliation` feedback can generate notifications. |
| C4 Governance | No direct gate on notification dispatch. System events bypass C4 by design (they are system-generated, not user-initiated mutations). AI `notify` tool (P3) will route through C4 `callGateAction`. |
| K1a/K1b | Not involved. |
| C2 Agent / Botsson | Planned P3 consumer: `notify` capability tool sends via outbox. `set_reminder` (personal capability) currently wires engine state but does NOT write outbox — the handler is absent (Gap G4). |

## Domain boundary

**Owns:**
- `notification` table + Realtime (in-app delivery)
- `notification_outbox` + outbox auto-dispatch
- `notification_preference` (user channel/mode settings + quiet hours)
- `notification_policy` + `notification_sent_log` (domain-scoped escalation + rate-limiting)
- `profile.active_push_topic` (push routing column, ADR-0367 §M4)
- Edge Functions: `process-notifications`, `push-dispatch`, `guardian-notify`
- Package: `packages/notifications/src/` (event-config, outbox helper, hooks, deep-links)
- Web UI: `apps/web/src/app/dashboard/notifications/`

**Does NOT own (links, does not re-document):**
- `channel_notification_policy` → owned by **communication** domain
- Announcement notification priority routing → owned by **communication** / announcements
- Swap notification triggers → authored by **scheduling**, dispatched by notifications
- Contract event triggers → authored by **contracts**, dispatched by notifications
- Day-line push events → authored by **day-session**, dispatched by notifications
- Period-locked notifier process → authored by **payroll** (engine process blueprint), dispatched by notifications
- SendGrid email + Twilio SMS adapter services → out-of-process; notifications integrates but does not own
- OneSignal MCP service (`mcp__onesignal__*`) → external; dev-side tooling only, zero call-sites in code

## Four channels

| Channel | Provider | Always-on? | Delivery path |
|---------|----------|-----------|---------------|
| `in_app` | `notification` table + Supabase Realtime | Yes | `process-notifications` inserts row; bell subscribes via Realtime |
| `email` | SendGrid REST API | User-controlled | `process-notifications:deliverToChannels`, gated by `pref.email_enabled` |
| `sms` | Twilio | User-controlled; off by default | `process-notifications:deliverToChannels`, gated by `pref.sms_enabled` AND `row.priority === 2` |
| `push` | OneSignal REST (ADR-0394) | User-controlled | `process-notifications` → HTTP call to `push-dispatch` EF → `sendOneSignalPush()` helper |

## Event registry

43 event keys in `packages/notifications/src/event-config.ts` (`NOTIFICATION_EVENTS` map). Each entry carries: `mode`, `default_priority` (0/1/2), `allowed_channels`, `group_key_template`, `title_template`, `body_template`, `action_url_template`, `icon_type`, `grouping_window_sec`, `admin_overridable`.

Modes: `work` (27 events), `training` (5), `community` (4) — inferred from the 43-key registry. Remaining entries are internal/engine keys.
