---
title: "ADR-0022: Email/Notification Service Architecture"
id: ADR_0022
status: accepted
layer: decision
created: 2026-02-28
updated: 2026-02-28
---

# ADR-0022: Email/Notification Service Architecture

**Status:** Accepted
**Date:** 2026-02-28

## Context and Problem Statement

Smartout's platform admin backoffice needs to send targeted emails to platform users — announcements to all users, reminders to specific workspace roles, and contract/payment notifications. The `packages/notifications` package exists as a stub with SendGrid and Twilio dependencies installed but zero implementation.

Without a structured architecture, ad hoc email sending from route handlers risks accidental mass sends, missing compliance requirements (suppression lists, unsubscribe links, legal footers), and no delivery accountability or audit trail.

## Decision Drivers (Why we must make a decision)

- Need to send targeted emails from platform admin (all users, by workspace, by role, by status)
- Must prevent accidental mass sends (rate limits, confirmation UI, kill switch)
- Must comply with email regulations (classification, suppression, legal footer, unsubscribe)
- Must track delivery per-recipient for accountability
- Must audit-log every send operation in `platform_audit_log`

## Considered Options

- Option 1: SendGrid via `@smartout/notifications` with job-based architecture
- Option 2: Supabase Edge Functions for email sending
- Option 3: n8n workflow-based email sending
- Option 4: Direct SendGrid API calls from route handlers

## Decision Outcome

Chosen option: "Option 1 — job-based architecture in @smartout/notifications", because it centralizes all email logic in one package with clear governance contracts, supports batch processing within SendGrid's per-call limits, and provides native TypeScript types for all callers without adding external dependencies.

## Key Design Decisions

### Job-Based Sending

Create a job record first, then process recipients in batches of 100 (SendGrid per-call limit). Jobs have lifecycle states: `queued → processing → completed | failed | cancelled`.

### Discriminated Union Audience Filter

```typescript
type AudienceFilter =
  | { type: "all_users" }
  | { type: "workspace"; workspaceId: string }
  | { type: "workspace_role"; workspaceId: string; role: ProfileRole }
  | { type: "workspace_status"; workspaceId: string; status: ProfileStatus }
  | { type: "specific_users"; userIds: string[] };
```

Using a discriminated union prevents invalid combinations and makes exhaustive switch handling possible.

### Transactional vs Broadcast Classification

Templates are auto-classified at definition time. Classification determines:

| Classification | Suppression Check | Unsubscribe Link | Legal Footer |
| -------------- | ----------------- | ---------------- | ------------ |
| transactional  | No                | No               | No           |
| broadcast      | Yes               | Required         | Required     |

### Rate Limits

| Limit                           | Value |
| ------------------------------- | ----- |
| Bulk sends per admin per hour   | 10    |
| Global bulk sends per hour      | 25    |
| Recipient soft cap (UI confirm) | 500   |
| Recipient hard cap (API reject) | 2000  |

### Database Tables Required

- `platform_communication_log` — one row per send job, status + stats
- `platform_communication_recipient_log` — one row per recipient per job (delivery status, timestamps)
- `platform_email_suppression` — bounces, unsubscribes, complaints (checked before every broadcast send)

### Sender Allowlist

Only these verified senders are permitted:

- `noreply@smartout.io`
- `support@smartout.io`
- `hei@smartout.io`

Route handlers that attempt to set a sender outside this list are rejected at the package boundary.

### Idempotency Keys

Every send job includes a caller-provided idempotency key. Duplicate keys within a 24-hour window are rejected to prevent double-sends on retry.

### Kill Switch

A `platform_settings` toggle (`email_outbound_enabled`) disables all outbound email without a deploy. Checked on every job enqueue.

### Template Storage

Templates are inline TypeScript objects (not external files or a database table). This keeps deployment simple — no template sync step, no migration required for new templates.

## Rules & Consequences enforced for Agents

- **Good, because** all email sends go through `@smartout/notifications` — no direct SendGrid calls from route handlers. A single package owns all compliance logic.
- **Good, because** every send is tracked in `platform_communication_log` with per-recipient status in `platform_communication_recipient_log`, and every send is audit-logged in `platform_audit_log`.
- **Bad, because** adding a new template requires a code change and package rebuild — no dynamic template creation from the UI.
- **Agent Impact:** Never call SendGrid directly from a route handler. Always use `@smartout/notifications`. When adding a new email template, add it to the package's template registry and classify it as `transactional` or `broadcast`. When creating new send routes in platform admin, enforce the rate limit and confirmation UI for any audience > 500 recipients.

## Implementation Notes

- Package path: `packages/notifications/`
- Main export: `@smartout/notifications` — `sendEmail()`, `createBroadcastJob()`, `getJobStatus()`
- SendGrid SDK: already installed as a stub dependency
- Twilio: reserved for SMS — separate concern, separate function, not in scope for this ADR
- Suppression list management: exposed as a platform admin UI action (add/remove/export)
