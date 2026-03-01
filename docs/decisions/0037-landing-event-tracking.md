---
title: "Landing Page Event Tracking"
id: ADR_0037
status: accepted
layer: decision
created: 2026-03-01
updated: 2026-03-01
---

# ADR-0036: Landing Page Event Tracking

## Context and Problem Statement

The public landing page and the platform admin dashboard were completely siloed. Pontus had no visibility into who was visiting the landing page, which variants were being viewed, or how many voice sessions and CTA clicks were happening. The platform admin activity feed only showed super-admin actions from `platform_audit_log`, not public visitor data.

## Decision Drivers

- Need for real-time visibility into landing page engagement from within platform admin
- `platform_audit_log` requires a non-nullable `super_admin_id` FK — structurally incompatible with anonymous visitor events
- Landing events are product/marketing analytics; audit log is security audit data — different semantics, different retention needs
- Events must not block the visitor experience if tracking fails

## Considered Options

1. **New `landing_event` table** — dedicated table for anonymous landing events
2. **Extend `platform_audit_log`** — make `super_admin_id` nullable, add landing event rows there
3. **PostHog API** — query PostHog from platform admin to display landing analytics

## Decision Outcome

Chosen option: **"New `landing_event` table"**, because:

- `platform_audit_log` schema cannot be extended without breaking its security-audit semantic and its FK constraint
- PostHog API adds external dependency, latency, and cost for a dashboard feature
- A dedicated table keeps concerns separated and enables per-event-type queries efficiently

## Rules & Consequences

- **Good, because** landing events are queryable directly from the platform admin without external API calls
- **Good, because** `platform_audit_log` remains a pure security audit log (admin actions only)
- **Good, because** tracking is fire-and-forget: failures never block the visitor
- **Bad, because** two separate tracking systems now exist (PostHog for frontend analytics, Supabase for internal admin visibility) — these are complementary, not duplicated
- **Agent Impact:**
  - When adding new landing page features that should appear in platform admin, insert rows into `landing_event` via the `/api/track` route (client) or `createAdminClient()` (server)
  - Valid `event_type` values: `page_view`, `voice_session_started`, `cta_click`
  - The `landing_event` table has no RLS — service role only (never expose to browser)
  - The `/api/track` route in the landing app is the public write gateway

## Implementation

| Component      | File                                                         |
| -------------- | ------------------------------------------------------------ |
| DB table       | `supabase/migrations/20260301400000_landing_event_table.sql` |
| Write gateway  | `apps/landing/src/app/api/track/route.ts`                    |
| Client hooks   | `apps/landing/src/hooks/useTracking.ts`                      |
| Voice tracking | `apps/landing/src/app/api/wizard/start/route.ts`             |
| Admin page     | `apps/web/src/app/platform-admin/landing/page.tsx`           |
