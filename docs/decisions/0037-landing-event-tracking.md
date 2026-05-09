---
title: "Landing Page Event Tracking"
id: ADR-0037
status: accepted
layer: decision
created: 2026-03-01
updated: 2026-04-10
---

# ADR-0037: Landing Page Event Tracking

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
  - Initial MVP `event_type` values were `page_view`, `voice_session_started`, `cta_click` (see addendum for current runtime taxonomy)
  - The `landing_event` table has no RLS — service role only (never expose to browser)
  - The `/api/track` route in the landing app is the public write gateway

## Addendum (2026-04-10): Platform Admin -> PostHog Bridge (Phase 1)

This addendum clarifies operational ownership and bridge-link behavior approved for Phase 1.

- **Expanded taxonomy (runtime):** `landing_event.event_type` is no longer limited to three values in practice. Current `/api/track` schema accepts:
  - `page_view`
  - `voice_session_started`
  - `cta_click`
  - `click`
  - `scroll_depth`
  - `session_heartbeat`
  - `session_end`
  - `form_started`
  - `waitlist_submitted`
  - `waitlist_failed`
- **Operational source-of-truth:** Supabase landing tables (`landing_event`, `landing_session`, `landing_visitor`) remain the authoritative data source for Platform Admin views and KPI cards.
- **PostHog role in Phase 1:** PostHog is an auxiliary investigative layer used for handoff, search, and replay context from Platform Admin links. It does not replace Supabase operational queries.
- **Minimum ID contract for bridge links:**
  - `session_id` from `landing_session` / `landing_event` is always passed into PostHog links (`q`, `session_id`) as the primary replay/search key.
  - `visitor_id` is treated as the expected `distinct_id` mapping and is passed as `distinct_id` when available.
  - If `visitor_id` is missing, links still open with `session_id` context only.
  - If `NEXT_PUBLIC_POSTHOG_PROJECT_ID` is missing, links fall back to PostHog UI root with query context preserved for manual lookup.

## Implementation

| Component      | File                                                         |
| -------------- | ------------------------------------------------------------ |
| DB table       | `supabase/migrations/20260301400000_landing_event_table.sql` |
| Write gateway  | `apps/landing/src/app/api/track/route.ts`                    |
| Client hooks   | `apps/landing/src/hooks/useTracking.ts`                      |
| Voice tracking | `apps/landing/src/app/api/wizard/start/route.ts`             |
| Admin page     | `apps/web/src/app/platform-admin/landing/page.tsx`           |
