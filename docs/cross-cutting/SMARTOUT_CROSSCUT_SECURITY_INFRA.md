---
title: "Security & Infrastructure"
id: XCUT_SECURITY
version: "1.0"
status: canonical
layer: cross-cutting
created: 2026-02-24
updated: 2026-02-28
author: pontus
supersedes: []
superseded_by: null
depends_on: []
tags:
  - security
  - infrastructure
  - rls
  - audit
  - notifications
tables: []
changelog:
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

# Cross-Cutting: Security & Infrastructure

> **Smartout.io** — Cross-cutting documentation
> Version 1.0 | February 2026
> **Source:** SMARTOUT_COMPLETE_DOCUMENTATION.md, Sections 26, 28, 29, 30

---

> This document groups security, notifications infrastructure, audit trail, and error handling.

## 1. Security (Section 26)

### 1.1 Database Security

- RLS enabled on ALL tables — no exceptions
- `auth.uid()` in RLS policies
- Service role only for admin operations and triggers
- All queries parameterized (no SQL injection)
- `workspace_id` indexed on every table

### 1.2 Application Security

- Input validation with Zod on all Edge Functions
- CORS configuration per environment
- CSRF protection via Supabase Auth
- Rate limiting on API endpoints
- No secrets in code — environment variables only
- Content Security Policy headers

### 1.3 Data Encryption

- At rest: Supabase (AES-256)
- In transit: TLS 1.2+ everywhere
- Passwords: bcrypt via Supabase Auth
- Sensitive fields: encrypted at application level where needed

### 1.4 Authentication Security

- Supabase Auth with secure session management
- JWT tokens with configurable expiry
- Refresh token rotation
- Multi-factor authentication (roadmap)
- Account lockout after failed attempts

### 1.5 Infrastructure

- Vercel: automatic DDoS protection, edge network
- Supabase: managed PostgreSQL with automated backups
- DigitalOcean: firewalled n8n instance, VPC
- Environment isolation: separate Supabase projects per environment

---

## 2. Notifications & Delivery Infrastructure (Section 28)

### 2.1 Channel Stack

| Channel | Provider                               | Latency   | Use Case                          |
| ------- | -------------------------------------- | --------- | --------------------------------- |
| Push    | Expo Push (mobile), Web Push (desktop) | Seconds   | Task alerts, shift reminders      |
| SMS     | Twilio                                 | Seconds   | Critical alerts, non-app users    |
| Email   | Resend                                 | Minutes   | Formal comms, schedules, payslips |
| Voice   | Twilio + Ultravox                      | Real-time | AI handoff, emergencies           |
| In-app  | UI                                     | On open   | Non-urgent status updates         |

### 2.2 Notification Preferences

Stored on `Profile.notification_pref`:

```json
{
  "push": true,
  "sms": true,
  "email": true,
  "quiet_hours": { "start": "22:00", "end": "07:00" },
  "channel_priority": ["push", "sms", "email"]
}
```

### 2.3 Rate Limiting

- Per-user: max N notifications per hour (configurable)
- Per-channel: provider rate limits respected
- Batching: group related notifications
- De-duplication within time window

---

## 3. Audit Trail & Logging (Section 29)

### 3.1 Audit Log Structure

```
audit_log
  log_id               uuid (PK)
  workspace_id         fk → workspace
  actor_profile_id     fk → profile | null (null = system/AI)
  actor_type           user | system | ai
  action               string (e.g., "shift.created", "profile.status_changed")
  entity_type          string
  entity_id            uuid
  changes              jsonb { field: { old, new } }
  context              jsonb (session_id, IP, user_agent, etc.)
  created_at           timestamp
```

### 3.2 AI Event Log

All AI operations logged: decision, authority level, data considered, action taken.

### 3.3 Retention

- Audit logs: 7 years
- AI event logs: 90 days
- Application logs: 30 days
- Error logs: 90 days

---

## 4. Error Handling & Monitoring (Section 30)

### 4.1 Edge Function Errors

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Human-readable description",
  "details": { "field": "error detail" }
}
```

Standard HTTP codes: 400, 401, 403, 404, 409, 500.

### 4.2 Client Error Handling

- Toast notifications for user-facing errors
- Retry logic for transient failures
- Graceful degradation
- Error boundaries in React components

### 4.3 Monitoring (Roadmap)

- APM, database query performance, real-time connection health, AI quality, uptime

---

_Security is not a standalone module — it's embedded in every module via RLS, Zod validation, and the audit trail._
