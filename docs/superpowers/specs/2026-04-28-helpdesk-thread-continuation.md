---
title: "Helpdesk Thread Continuation on /dashboard/help (M2.1)"
status: draft
created: 2026-04-28
updated: 2026-04-28
module: Core
campaign: core-module
milestone: M2.1
tags: [help, helpdesk, thread, continuation, campaign-core-module]
---

# Helpdesk Thread Continuation on `/dashboard/help`

> M2.1 of campaign/core-module. Read-only consumer of `channel_message` + `engine_state`. NO authoring on /help. Komm remains canonical helpdesk thread surface.

## Problem

After M1, panic-bar creates a helpdesk ticket via `engine_state` + `channel_message` (Komm). The user is then dropped back on `/dashboard/help` with no UI feedback that a ticket exists or is in progress. Returning visitors with active tickets see nothing on /help — they must navigate to `/dashboard/komm` and find their thread manually.

## Goal

Make /help aware of the user's active helpdesk threads (read-only). Surface the most recent unresolved ticket as a "Pågående sak" card above (or as part of) the chat hero. Click → routes to `/dashboard/komm/thread/<channelId>`.

## Scope

### In scope

- New `_data/queries.ts` extension: `getActiveHelpdeskThreadsForProfile(profileId, workspaceId)` — returns up to N active `engine_state` rows tied to channels where current profile is participant or responsible_profile_id.
- New `_components/ActiveTicketBadge.tsx` (Server Component) — renders "Pågående sak: <subject>" with last-message preview + relative timestamp.
- Role-aware aggregation: admin/manager (responsible_profile_id=self) sees aggregated count + most-recent preview.
- Role-aware aggregation: employee sees own thread(s) only.
- Empty state: no badge rendered (graceful absence).
- Telemetry: `help.active_ticket_badge_viewed`, `help.active_ticket_badge_clicked`. Routing: posthog + activity_trail.

### Out of scope

- Reply-from-/help (M3 scope) — clicking opens /komm, no inline reply.
- Push notifications for new replies on active tickets (Q4 scope).
- Mobile surface (ADR-0133 — mobile owns its own /help redirect).
- Auto-resolve on visit (ticket lifecycle stays in /komm).
- Modifying engine_state / channel_message (read-only consumer).

## Falsifiable Invariants

| # | Invariant | Test |
|---|-----------|------|
| **I-1** | Empty state renders no badge (zero DOM nodes for ActiveTicketBadge) | E2E |
| **I-2** | Employee sees only own threads | RLS test + E2E |
| **I-3** | Admin (`responsible_profile_id = self`) sees aggregate count | E2E |
| **I-4** | Click routes to `/dashboard/komm/thread/<channelId>` | E2E |
| **G-RO** | No mutation paths in M2.1 code (grep for emit/insert/update on `engine_state` or `channel_message` returns 0 in `dashboard/help/`) | merge-block |
| **G-RLS** | Direct query without auth.uid filter blocked by RLS | RLS spec |

## Open Questions

- Q1: Which `engine_state.process_id` values count as "active helpdesk thread"? (Likely `helpdesk_query_lifecycle` from M1 only, but may need broader filter for legacy threads.)
- Q2: Aggregation cap for admin view — show top-3 by recency or just the count? (Default: count + top-1 preview.)
- Q3: How to surface unread count? (Channel `last_read_message_id` on profile? Defer to M3 if unclear.)

## References

- ADR-0219 — `/dashboard/help` multi-tier hub (M1)
- ADR-0161/0165 — helpdesk ontology (engine_state + helpdesk_enabled)
- ADR-0133 — mobile boundary (mobile owns own /help)
- M1 HANDOFF — `docs/handoffs/HANDOFF-dashboard-help-v1.md`
- M2.1 milestone — `docs/plans/CAMPAIGN-core-module.md` §M2
