---
title: "HANDOFF — M2.1 Helpdesk Thread Continuation"
feature: m2-thread-continuation
sub_sortie: m2.1
status: complete
created: 2026-04-28
updated: 2026-04-28
module: Core
tags: [handoff, help, helpdesk, thread-continuation, m2, cascade]
plan: docs/plans/PLAN-m2-thread-continuation.md
spec: docs/superpowers/specs/2026-04-28-helpdesk-thread-continuation.md
related_adrs: [ADR-0219, ADR-0220, ADR-0221, ADR-0161, ADR-0165]
---

# M2.1 — Helpdesk Thread Continuation (Active Ticket Badge)

## Summary

Tier 0.5 surface on `/dashboard/help`: when a profile has one or more open
helpdesk threads (`engine_state.process_id = 'helpdesk_query_lifecycle'` with
status not in `('resolved', 'archived', 'cancelled')`), a single-card or
aggregate badge renders between PanicBar and BotssonChatHero. Empty state
returns null (zero DOM, zero telemetry).

**Scope vs spec:**
- Implements 4 declared journeys (employee-active, employee-no-ticket,
  admin-aggregate, manager-multi-ticket).
- "Se alle saker" link points to `/dashboard/komm` as fallback — proper
  ticket-filtered URL is deferred to M2.2 when the komm filter UI lands.
- Dedicated manager-role E2E shares admin-aggregate test (same component code
  path); split-out test deferred to M2.2.

## Audit Verdicts

### T7 — RLS / G-RO / G-RLS audit (`getActiveHelpdeskThreadsForProfile`)

`apps/web/src/app/dashboard/help/_data/queries.ts:145-278`

| Check | Verdict | Evidence |
|---|---|---|
| JWT-scoped client (no admin/service role) | PASS | `createClient()` from `@smartout/supabase/server` at line 154 — admin client used elsewhere in file but NOT in this query |
| Read-only (3 SELECTs, no mutation) | PASS | `engine_state` (line 168/186), `channel` (line 205), `channel_message` (line 239) — zero `.insert/.update/.delete/.rpc` |
| `workspace_id` from auth context (not body) | PASS | `workspaceId` arg passed by `page.tsx:60` from `getHelpProfileContext()` — derived from `auth.getUser()` + `profile.workspace_id`, never from request body |
| Employee role filter | PASS | `.filter("context->>requester_profile_id", "eq", profileId)` at line 175 — JSONB lookup avoids channel-membership RLS trap |
| Admin/manager/owner role filter | PASS | Post-fetch filter `ch.responsible_profile_id === profileId` at line 222 (channel data resolved in step 2) |
| `cache()` wrap | PASS | Line 145 wraps the entire query in `cache()` for request-scoped dedup (ADR-0115) |

**T7 verdict: PASS (6/6).**

### T7 — Badge component mutation audit

`apps/web/src/app/dashboard/help/_components/ActiveTicketBadge.tsx:1-139`
`apps/web/src/app/dashboard/help/_components/ActiveTicketBadgeLink.tsx:1-64`

| Check | Verdict | Evidence |
|---|---|---|
| No `*.opened` emit | PASS | grep `emit\(` in both files: only `help.active_ticket_badge_clicked` (Link:44) emitted client-side; view event lives in `page.tsx:71` |
| No mutation paths (insert/update/delete) | PASS | grep finds zero `supabase.*\.insert\|update\|delete\|rpc` calls in either component |
| No `gateAction` calls | PASS | No `gateAction` import or call site |
| `nonEmpty()` brand on workspaceId/actorId | PASS | `nonEmpty(workspaceId, "workspace_id")` + `nonEmpty(actorId, "actor_id")` at Link:46-47 and page:73-74 |

**Badge mutation audit: PASS (4/4).**

### Phantom-contract audit (ADR-0197 + L-0146)

| Producer | Consumer | Verdict |
|---|---|---|
| `ActiveTicketBadge` component | Rendered by `page.tsx:95-100` between PanicBar (Tier 0) and BotssonChatHero (Tier 1) | PASS |
| `help.active_ticket_badge_viewed` event (registry.ts:5624) | Emitted by `page.tsx:71`; routed to `posthog` + `activity_trail` per registry.ts:8319-8322 | PASS |
| `help.active_ticket_badge_clicked` event (registry.ts:5635) | Emitted by `ActiveTicketBadgeLink:44`; routed to `posthog` + `activity_trail` per registry.ts:8323-8326 | PASS |
| `getActiveHelpdeskThreadsForProfile` query | Called once at `page.tsx:60`; result passed to `ActiveTicketBadge.threads` prop and inspected for `length >= 1` to gate emit | PASS |

**Phantom-contract audit: PASS (4/4).**

### T11 — Full typecheck

```
Tasks:    36 successful, 36 total
Cached:    36 cached, 36 total
  Time:    765ms >>> FULL TURBO
```

**T11 verdict: PASS (0 errors, 36/36 tasks).**

### T12 — Journey verification flips

| Journey | E2E spec | Status |
|---|---|---|
| employee-active-ticket | `apps/e2e/tests/journey-help-active-ticket-employee.spec.ts` | flipped to `verified` |
| employee-no-ticket | `apps/e2e/tests/journey-help-active-ticket-empty.spec.ts` | flipped to `verified` |
| admin-aggregate | `apps/e2e/tests/journey-help-active-ticket-admin.spec.ts` | flipped to `verified` |
| manager-multi-ticket | shares admin-aggregate spec (same code path) | flipped to `verified` with `e2e_coverage_note` |

**T12 verdict: PASS (4/4 flipped).**

## Decisions made during build

1. **Three sequential SELECTs over polymorphic join** — `engine_state.entity_id`
   is polymorphic with no named FK relation, so PostgREST nested-resource syntax
   is unavailable. Three sequential selects (engine_state → channel →
   channel_message) is the canonical pattern. Documented inline at queries.ts:128-131.

2. **Subject sourced from `channel.name`** — there is no separate "thread
   subject" column on `engine_state` or `channel_message`. `channel.name`
   matches what `/dashboard/komm` surfaces as the thread title, keeping the
   badge label consistent with what the user lands on after clicking. Documented at queries.ts:269-270.

3. **Display name → first name derivation** — `profile.display_name` is the
   only name field; `firstName = display_name.split(" ")[0]`. Plan called out
   `first_name` which does not exist. Documented at queries.ts:65-67.

4. **Owner role mapped to `admin` for telemetry** — registry event schema uses
   3-value role union `(employee | admin | manager)`. Owner has admin-level
   visibility, so `owner → admin` mapping preserves analytics fidelity without
   widening the schema. Applied in `ActiveTicketBadgeLink.tsx:41` and `page.tsx:69-70`.

5. **Aggregate variant gated on `threads.length >= 2 AND role !== employee`** —
   single ticket OR employee role always renders single-card variant. Spec
   §Single-ticket variant + §Aggregate variant. Implemented at `ActiveTicketBadge.tsx:51-52`.

6. **"Se alle saker" routes to `/dashboard/komm` (fallback)** — ticket-filter
   URL on komm not yet implemented. Documented as known debt for M2.2.

## Files changed

| Commit | Task | Files |
|---|---|---|
| `8b943f06` | T2 | `packages/telemetry/src/registry.ts` (+2 events, +2 routing entries) |
| `58de2d59` | T1 | `apps/web/src/app/dashboard/help/_data/queries.ts` (+`getActiveHelpdeskThreadsForProfile`) |
| `70798556` | T3-T6 | `apps/web/src/app/dashboard/help/_components/ActiveTicketBadge.tsx` (new), `ActiveTicketBadgeLink.tsx` (new), `page.tsx` (wire + view emit) |
| `df6419c3` | T8 | `apps/e2e/tests/journey-help-active-ticket-empty.spec.ts` (new) |
| `8dc747df` | T9, T10 | `apps/e2e/tests/journey-help-active-ticket-employee.spec.ts` (new), `journey-help-active-ticket-admin.spec.ts` (new) |
| _(this commit)_ | T12, T13 | 4 journey frontmatter flips + this HANDOFF |

## Known debt

1. **"Se alle saker" → `/dashboard/komm` is a fallback URL.** Proper ticket-list
   filter (e.g. `/dashboard/komm?filter=helpdesk&status=open`) requires the
   komm filter UI which is M2.2 scope.

2. **Manager-role E2E shares admin-aggregate spec.** Both render the aggregate
   variant via the identical `threads.length >= 2 && role !== "employee"`
   branch in `ActiveTicketBadge.tsx:51-52`, so coverage is structural. A
   dedicated manager-seeded spec is deferred to M2.2; document trail in
   `JOURNEY-m2-thread-continuation-manager-multi-ticket.md` `e2e_coverage_note`.

3. **Manager/admin path performs an N=50 over-fetch then in-JS filter** —
   `engine_state` rows are pulled wide (limit 50) and trimmed after channel
   join because `responsible_profile_id` lives on `channel`, not `engine_state`.
   Acceptable at current ticket volumes; revisit if a workspace exceeds ~50
   open tickets simultaneously.

4. **`channel_message` last-message uses generous `limit(channelIds.length * 10)`
   over-fetch** because PostgREST exposes no `DISTINCT ON`. Same volumetric
   note as #3 — fine for v1.

## Next steps (M2.2 candidates)

- Komm ticket-filter URL + thread-deeplink → real "Se alle saker" target.
- Dedicated manager-role E2E spec.
- Optional: server-side last-message join via SQL view to remove the N*10
  over-fetch on the message query.
- Telemetry routing parity check for `engine_event` if these badge events are
  ever needed by the Event Engine (currently posthog + activity_trail only,
  which is correct for analytics-only events).

## Sign-off

All audits PASS. Typecheck PASS (36/36, 0 errors). 4/4 journeys flipped to
`verified` with E2E spec citations. Ready for `close-feature`.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
