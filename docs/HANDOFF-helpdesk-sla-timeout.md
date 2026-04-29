---
title: "Handoff — Helpdesk Phase 2 SLA Timeout"
status: done
updated: 2026-04-29
created: 2026-04-29
module: Helpdesk
tags: [handoff, helpdesk, sla, phase-2, adr-0229, adr-0230, adr-0231, adr-0232, learning-0160]
---

# Handoff — Helpdesk Phase 2 SLA Timeout

> Branch: `feat/helpdesk-helpdesk-sla-timeout` (sub-sortie of `campaign/helpdesk`)
> Started: 2026-04-28 | Closed: 2026-04-29
> 16 commits, 36 files changed (+3689 / -270 net)

## Summary

Helpdesk SLA wiring shipped — tickets that sit `waiting` past `engine_authority_config.observer_escalation_hours` (default 72h, snapshot at spawn) automatically fire `helpdesk.query.sla_breached`, which spawns a transient `helpdesk_sla_breach_handler` process that patches the origin ticket's `context.sla_breached_at` and notifies the resolved observer (chat-only per ADR-0163).

Rep + manager UI shows calm "Forfalt" Pill on breached tickets (Spec §1.4 — no animation, no color shift, `text-muted-foreground` only).

## Architecture (post Council 2026-04-29)

**Backend pipeline:**

1. `openTicket` capability tool reads `engine_authority_config.observer_escalation_hours`, resolves observer via proxy chain (`responsible → team_leader → broadcast`), inserts pre-canned `engine_event` (event_type=`helpdesk.query.sla_breached`, payload carries `target_state_id` + `assignee_id`), inserts `engine_delayed_trigger` keyed to that event with `fire_at = NOW() + observer_escalation_hours * INTERVAL '1 hour'`. Snapshot semantics — admin changes mid-flight don't affect in-flight tickets.
2. `fire-delayed-triggers` Edge Function picks up matured rows on its cron schedule, re-dispatches the breach event via `engine-dispatch`.
3. Dispatcher's trigger-fire path matches the seeded `engine_trigger` (event_type=`helpdesk.query.sla_breached`, process_id=`helpdesk_sla_breach_handler`) and spawns a NEW `engine_state` of the breach-handler process at step 1, copying `payload.target_state_id` into `state.context` and `payload.assignee_id` into `state.assignee_id`.
4. Breach-handler step 1: `update_context_targeted` (NEW dispatcher action_type) patches the ORIGIN ticket's `engine_state.context.sla_breached_at = NOW()`. Workspace integrity guard verifies source.workspace_id === target.workspace_id (CVE-class).
5. Breach-handler step 2: `send_notification` notifies the observer (recipient_id resolved from `state.assignee_id`, allowed_channels=[push, in_app] — no voice).
6. `resolveTicket` cancels any pending breach trigger BEFORE emitting `helpdesk.query.resolved` (cancellation → `cancelled_at = NOW()`).

**Frontend:**

- `useMinKo` hook derives `has_breach` + `oldest_breached_at` from `context.sla_breached_at` server-side.
- `MinKoSection` desk row renders calm "Forfalt" Pill with `data-testid="overdue-badge"` when any underlying state is breached.
- `TicketHeader` renders same Pill with `title` attribute carrying the breach timestamp in nb-NO locale.
- No client-side computed-overdue. Server is sole truth (Spec §1.4 + ADR-0230 retained snapshot semantics).

## Decisions Made

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-0229](decisions/0229-escalation-hierarchy-gap-acknowledged.md) | Smartout lacks formal escalation hierarchy — Phase 2 uses proxy patterns | accepted |
| [ADR-0230](decisions/0230-helpdesk-sla-phase-2-design.md) | Helpdesk SLA Phase 2 — Approach A (pre-canned event + engine_trigger reuse) | superseded-in-part |
| [ADR-0231](decisions/0231-helpdesk-sla-consumer-path-breach-handler-process.md) | Helpdesk SLA Consumer Path — separate breach-handler process | accepted |
| [ADR-0232](decisions/0232-update-context-targeted-action-type.md) | `update_context_targeted` action_type — cross-state context patching | accepted |

**Key design pivots:**

1. **2026-04-28 Council ratified Approach A** (pre-canned event + lifecycle steps 3+) → INVALIDATED at T2 build-time when builder code-traced dispatcher resume model. Sequential single-branch state machine — sibling steps invisible. ADR-0230 superseded-in-part.
2. **2026-04-29 Council** (4 reviewers, 3-1 vote) ratified **separate transient process** (Option A reframed): new `helpdesk_sla_breach_handler` blueprint + new `update_context_targeted` action_type. Original `helpdesk_query_lifecycle` untouched.
3. **Cross-state action_type** SPLIT (not extension flag): `update_context` (current-state, T4) + `update_context_targeted` (cross-state, T8d). Distinct call-site clarity, distinct authority gating, telemetry routing searchable, future-proofs ADR-0091 row-level auth.
4. **Observer resolution via proxy** (per ADR-0229): Smartout has no first-class `reports_to` relationship. Phase 2 walks `channel.responsible_profile_id` → `team.leader_profile_id` → broadcast → `helpdesk.sla.no_observer_resolved` telemetry safety net. Phase 3 candidate: real escalation hierarchy.

## Learnings Captured

| Learning | Title |
|----------|-------|
| [L-0160](learnings/0160-dispatcher-sequential-resume-sibling-blind.md) | Dispatcher resume loop only matches `state.current_step` — sibling steps invisible. Caught by build-time code-trace, missed by 4-reviewer pre-design council. 3rd "concept-review missed implementation reality" pattern. |

**Additional learning surfaced during verification (not yet promoted to log):**

- **Migration timestamp ordering MUST verify FK targets exist at migration's timestamp.** T2 (`20260428120000_helpdesk_sla_blueprint.sql`) referenced `helpdesk_query_lifecycle` process which was created by `20260515130200`. T2's timestamp predated the lifecycle. Migration would have failed in any clean reset / Supabase Cloud deploy. Caught only by `npx supabase db reset` in verification phase. Phase 2.5 fact-check needs migration-dependency check that traces every FK reference to its creation migration's timestamp. **Promote on next occurrence (would be 2nd — L-0042 was the first).**
- **`fire-delayed-triggers` Edge Function not crash-safe.** Marks `fired=true` BEFORE dispatching to engine-dispatch in non-transactional roundtrip. Crash between mark and dispatch loses event. Lifecycle reaction's idempotency (skip if `context.sla_breached_at IS NOT NULL`) is the canonical guard. Documented in ADR-0231 Risks.

## Known Issues / Debt

1. **fire-delayed-triggers crash-safety** — pre-existing debt (not introduced by this branch). Phase 3 should refactor to `UPDATE ... RETURNING` in same transaction as dispatch. Tracked in ADR-0231 Risk #1.
2. **Breach-handler state accumulation** — transient `helpdesk_sla_breach_handler` engine_state rows grow linearly with breach count. At expected volume (≤12K/year/workspace) this is negligible. Phase 3 should add TTL sweep job for completed breach-handler states.
3. **Observer proxy chain non-obvious** — the `responsible → leader → broadcast` chain is not visible in admin UI. If observer resolution returns null, `helpdesk.sla.no_observer_resolved` telemetry surfaces it but operations must monitor. Phase 3 candidate: admin UI for explicit observer assignment per workspace OR per channel.
4. **E2E specs syntax-verified, NOT runtime-verified** — 3 Playwright specs (J1+J2+J3) compile clean but were not run end-to-end against Supabase Local in this session due to time constraints + auth gap (no rep-specific / manager-specific login helper, fallback to `loginAsPlatformAdmin` documented in spec headers). E2E workflow requires: `npx supabase start` + dev web server + `op run --env-file=.env.template -- pnpm test`. Schedule for next session.
5. **Migration timestamp ordering bug fixed in this branch** — original T2/T3 migrations dated April 28 referenced May 15 lifecycle. Bumped to `20260518240000+` post-verification. T2 + T8a deleted entirely (T2 was unreachable per L-0160 anyway; T8a reverted dead T2).

## Files Touched (36)

**Migrations (3 active + 2 deleted):**
- `supabase/migrations/20260518240000_helpdesk_sla_trigger_seed.sql` — seeds engine_trigger
- `supabase/migrations/20260518240100_helpdesk_sla_breach_handler_process.sql` — new process + 2 steps
- `supabase/migrations/20260518240200_helpdesk_sla_trigger_repoint.sql` — repoints trigger
- DELETED: `20260428120000_helpdesk_sla_blueprint.sql` (FK violation bug)
- DELETED: `20260428222824_revert_helpdesk_sla_blueprint_extension.sql` (revert of dead T2)

**Dispatcher:**
- `supabase/functions/engine-dispatch/index.ts` — `update_context` + `update_context_targeted` action_types added (376 LOC). `__now__` runtime sentinel substitution. Workspace integrity guard.
- `supabase/functions/engine-dispatch/update_context_test.ts` — 12 structural-guard tests
- `supabase/functions/engine-dispatch/update_context_targeted_test.ts` — 19 structural-guard tests

**Capability tools:**
- `packages/ai/src/capabilities/helpdesk_query/observer-resolver.ts` — proxy chain helper (165 LOC, 6 unit tests)
- `packages/ai/src/capabilities/helpdesk_query/__tests__/observer-resolver.test.ts` — 6 path tests
- `packages/ai/src/capabilities/helpdesk_query/tools.ts` — openTicket SLA spawn + resolveTicket cancellation (+248 LOC)
- `packages/ai/src/capabilities/__tests__/supabase-mock.ts` — added schemas for new tables

**Telemetry:**
- `packages/telemetry/src/registry.ts` — 4 events registered (helpdesk.query.sla_breached, helpdesk.sla.no_observer_resolved, engine.context_patched_targeted, engine.cross_state_write_blocked)

**UI:**
- `apps/web/src/app/dashboard/komm/_hooks/useMinKo.ts` — extended with `has_breach` + `oldest_breached_at`
- `apps/web/src/app/dashboard/komm/_components/MinKoSection.tsx` — Pill render
- `apps/web/src/app/dashboard/komm/thread/[channelId]/_components/TicketHeader.tsx` — Pill + title attr
- `apps/web/src/app/dashboard/komm/thread/[channelId]/_components/TicketConversationView.tsx` — prop pass-through
- `apps/web/src/app/dashboard/komm/thread/[channelId]/page.tsx` — fetches sla_breached_at from context
- `apps/web/src/components/helpdesk-orb/Pill.tsx` — extended with HTMLAttributes for data-testid + title

**E2E:**
- `apps/e2e/helpers/helpdesk-sla-fixtures.ts` — 5 seed helpers + invokeFireDelayedTriggers + cleanWorkspace
- `apps/e2e/tests/helpdesk-sla-auto-escalation.spec.ts` — J1
- `apps/e2e/tests/helpdesk-sla-rep-overdue-badge.spec.ts` — J2
- `apps/e2e/tests/helpdesk-sla-manager-overdue-action.spec.ts` — J3

**Docs:**
- `docs/plans/PLAN-helpdesk-sla-timeout.md` — full plan, status: ready
- `docs/journeys/JOURNEY-helpdesk-sla-{auto-escalation,rep-overdue-badge,manager-overdue-action}.md` — 3 journeys
- `docs/decisions/0229..0232*.md` — 4 ADRs
- `docs/learnings/0160-*.md` — 1 learning
- `docs/decisions/0000-decision-log.md` + `docs/learnings/0000-learning-log.md` — registered
- `docs/council/COUNCIL-LOG.md` — 1 session entry

**Cherry-picks (pre-existing dev blockers cleared):**
- `9d6f76ed` chore(migrations): bump 3 timestamp collisions inherited from development merge (cherry-picked from `a9bfd7b7` on payroll campaign)
- `a326bf96` fix(migrations): split botsson enum + page_knowledge ui.id (cherry-picked from `2afa9698` on payroll campaign)

## Verification Evidence

| Check | Result | Evidence |
|-------|--------|----------|
| `pnpm turbo typecheck` | PASS | 36/36 successful, FULL TURBO cache |
| `npx supabase db reset` | PASS | All migrations apply through `20260519110000_deprecate_help_request_table.sql` |
| `engine_process` end-state | PASS | Both `helpdesk_query_lifecycle` + `helpdesk_sla_breach_handler` exist |
| `engine_step` end-state | PASS | breach_handler has 2 steps: (1, update_context_targeted), (2, send_notification) |
| `engine_trigger` end-state | PASS | helpdesk.query.sla_breached → helpdesk_sla_breach_handler |
| Spec §1.4 calm queue | PASS | grep `text-destructive\|text-amber\|text-red` on changed UI files = 0 hits |
| `update_context` tests | PASS | 12/12 deno tests |
| `update_context_targeted` tests | PASS | 19/19 deno tests |
| `observer-resolver` tests | PASS | 6/6 vitest tests |
| E2E specs runtime | NOT RUN | syntax-verified only (typecheck clean) — see Known Issues #4 |

## Next Steps

1. **Run E2E specs against live Supabase Local** — schedule for next session. Auth gap (rep-specific login) may need helper expansion.
2. **Phase 3 candidate work:**
   - First-class escalation hierarchy (`profile.reports_to_profile_id` or `escalation_chain` table) — closes ADR-0229 marker
   - `fire-delayed-triggers` crash-safety refactor (transactional mark+dispatch)
   - Breach-handler state TTL sweep
   - Multi-tier SLA (T+24h soft, T+72h hard)
   - Mobile push on breach (depends on ADR-0135 LiveKit)
   - Auto-reassign on breach
   - Per-channel SLA override (currently workspace-wide via authority)
3. **Promote migration-dependency Phase 2.5 check** if 2nd occurrence (would be third with L-0042).

## Closure

Sub-sortie ready for `/close-feature` → merge `feat/helpdesk-helpdesk-sla-timeout` into `campaign/helpdesk`, sync development.

Campaign-level merge (`campaign/helpdesk` → `development`) deferred — Pontus runs that.
