---
title: "Plan — Helpdesk SLA Timeout (Phase 2)"
status: draft
updated: 2026-04-28
created: 2026-04-28
module: Helpdesk
tags: [plan, helpdesk, sla, engine-delayed-trigger, fire-delayed-triggers, adr-0161, adr-0162, adr-0163, adr-0165, phase-2]
---

# Plan — Helpdesk SLA Timeout (Phase 2)

> **Campaign:** `docs/plans/CAMPAIGN-helpdesk.md` — Phase 2 (deferred from PLAN-helpdesk-phase-1.md L52)
> **Architecture:** Council 2026-04-19 (Kanaler som Help Desk) — SLA reuses `engine_delayed_trigger → fire-delayed-triggers`. Zero new time-infra.
> **Precondition:** Phase 1 schema + dispatcher live (PR #277 merged). `helpdesk_query_lifecycle` engine_process owns ticket spawn. `engine_authority_config.observer_escalation_hours=72` seeded per workspace.

## Goal

Wire the helpdesk SLA so a ticket that sits in `waiting` or `active` past its escalation threshold (default 72h, per-workspace via `engine_authority_config.observer_escalation_hours`) automatically fires an escalation event. The event is consumed by `helpdesk_query_lifecycle` which assigns a follow-up task to the workspace observer (manager). The rep + manager UI reflects the breach with a calm overdue badge — no alarm-state animations.

## Context

Phase 1 ships ticket spawn, single-spawn dispatcher contract, and `observer_escalation_hours` authority seed — but no consumer of that field. Tickets currently age silently. Council 2026-04-19 ratified `engine_delayed_trigger → fire-delayed-triggers` as the SLA primitive (it already runs cron-driven for journey-engine workloads). Phase 2 wires the trigger spawn at ticket-open and the lifecycle reaction at firing.

Key constraints (from prior councils + ADRs):
- **ADR-0161** — ticket = `engine_state`, dispatcher owns spawn (do not direct-insert from tools).
- **ADR-0163** — `allowed_channels=['chat']`. SLA notifications must NOT trigger voice paths.
- **ADR-0165** — channel-progressive flags are read-time truth. Observer resolution reads `engine_authority_config`, not channel.
- **L-0066** — default-allow combo banned. SLA path must not bypass authority.
- **Spec §1.4** — calm queue, no red/amber escalation animations. Badge unconditionally `text-muted-foreground` per Phase 1 fix.
- **Council 2026-04-28 (PR #277)** — single-spawn rule, dispatcher reacts once. Apply same idempotency to delayed_trigger consumption.

## Scope

**In (Phase 2):**
1. Migration: extend `helpdesk_query_lifecycle` blueprint with `timeout_seconds` + `timeout_action` on the open `wait_for_event` step. `timeout_action` = emit `helpdesk.query.sla_breached`.
2. Tool/dispatcher: when dispatcher spawns the `engine_state`, it also inserts an `engine_delayed_trigger` row keyed to the new state.id with `fire_at = NOW() + observer_escalation_hours * INTERVAL '1 hour'` (read from authority).
3. `fire-delayed-triggers` consumer: when row matures, emit `helpdesk.query.sla_breached` (entity_type=channel, entity_id=desk_channel_id, properties.engine_state_id, properties.workspace_id).
4. Lifecycle reaction: new step `assign_task` triggered by `helpdesk.query.sla_breached` → notifies observer (resolved from authority `min_role`/`observer_escalation_hours` row), writes `engine_state.context.sla_breached_at = NOW()`.
5. Idempotency: trigger fires once, lifecycle reacts once. Re-firing on retry must be no-op (check `context.sla_breached_at IS NOT NULL`).
6. UI badge: MinKoSection desk row + TicketHeader show "Forfalt" badge when `context.sla_breached_at` set OR `started_at + observer_escalation_hours < NOW()`. Calm tone — `text-muted-foreground` only, no animation, no color shift (per Spec §1.4).
7. Trigger cleanup: on `helpdesk.query.resolved`, mark linked `engine_delayed_trigger` row as `cancelled` so it does not fire after resolution.

**Out (Phase 3+):**
- Multi-tier SLA (T+24h soft warn, T+72h hard escalate). Phase 2 = single threshold.
- Mobile push notification on breach. Mobile thin-client surface deferred to post-ADR-0135.
- Per-channel SLA override (currently workspace-wide via authority). Future feature.
- Auto-reassign on breach. Phase 2 only notifies; reassignment is manual via TicketHeader (deferred from Phase 1).
- Analytics dashboard for SLA performance. Out of campaign scope.

## Tasks

- [ ] **T1. Council pre-design.** Spawn `/run-council` on this plan. Verify: (a) `engine_delayed_trigger` semantics, (b) `wait_for_event` timeout contract, (c) idempotency under retry/clock-skew, (d) authority-read at spawn vs fire time, (e) cancellation on resolve.
- [ ] **T2. Migration — blueprint extension.** Add migration `20260428HHMMSS_helpdesk_sla_timeout_blueprint.sql` that extends the `helpdesk_query_lifecycle` `engine_process` JSON with `timeout_seconds` + `timeout_action` on the open `wait_for_event` step. Include lifecycle reaction step for `helpdesk.query.sla_breached`.
- [ ] **T3. Dispatcher — trigger spawn.** Modify `engine-dispatch` (or the helpdesk_query_lifecycle handler) to insert `engine_delayed_trigger` row when ticket spawns. Read `observer_escalation_hours` from `engine_authority_config` at spawn time. Store `engine_state.id` in trigger context.
- [ ] **T4. fire-delayed-triggers — emit breach event.** Confirm Edge Function reads new trigger rows + emits the breach event with correct payload shape (entity_type=channel, entity_id=desk_channel_id, properties.engine_state_id).
- [ ] **T5. Lifecycle reaction — assign_task.** New blueprint step reacts to `helpdesk.query.sla_breached`, sets `context.sla_breached_at`, emits notification (chat-only per ADR-0163) to observer.
- [ ] **T6. Trigger cancellation on resolve.** When `helpdesk.query.resolved` fires, lifecycle step marks linked `engine_delayed_trigger.status='cancelled'` to prevent post-resolution firing.
- [ ] **T7. UI badges.** MinKoSection desk row + TicketHeader render "Forfalt" pill when `context.sla_breached_at` set OR computed-overdue. Use `Pill` primitive with `text-muted-foreground` (no red/amber). Add `data-testid="overdue-badge"`.
- [ ] **T8. Authority audit query.** SQL check: every `helpdesk_query` authority row has non-null `observer_escalation_hours` AND non-null observer `min_role`. If any null, document in handoff + propose default backfill.
- [ ] **T9. E2E specs.** Three Playwright tests, one per journey. Use clock-skew helper (advance fire_at to past, manually invoke fire-delayed-triggers).
- [ ] **T10. Handoff.** `docs/HANDOFF-helpdesk-sla-timeout.md` with decisions, learnings, audit outputs, next steps.

## Acceptance Criteria

- [ ] `pnpm turbo typecheck` passes 0 errors.
- [ ] `pnpm --filter @smartout/e2e test helpdesk-sla` runs 3 specs green.
- [ ] `SELECT COUNT(*) FROM engine_delayed_trigger WHERE event_name='helpdesk.query.sla_breached' AND status='pending'` returns ≥1 after opening a ticket on a workspace with `observer_escalation_hours=72`.
- [ ] Manually setting `fire_at = NOW() - INTERVAL '1 minute'` + invoking `fire-delayed-triggers` results in: (a) one `helpdesk.query.sla_breached` event in `engine_event`, (b) `engine_state.context.sla_breached_at` populated, (c) one notification to observer in `activity_trail`.
- [ ] Re-invoking `fire-delayed-triggers` after breach fires zero additional events (idempotency check).
- [ ] On `helpdesk.query.resolved`, linked `engine_delayed_trigger.status='cancelled'`. Subsequent `fire-delayed-triggers` invocation does not emit breach for the resolved ticket.
- [ ] MinKoSection renders `data-testid="overdue-badge"` for breached tickets, omitted for non-breached.
- [ ] `git grep -n "text-destructive\|text-amber\|text-red" apps/web/src/app/dashboard/komm/_components/MinKoSection.tsx apps/web/src/app/dashboard/komm/thread/` returns zero hits in changed files (Spec §1.4 calm queue).
- [ ] No new direct `engine_state.insert` or `engine_delayed_trigger.insert` from tool code — dispatcher owns both (ADR-0161 single-spawn).
- [ ] Council verdict on T1: APPROVE or APPROVE WITH CHANGES (and changes applied).
- [ ] `docs/HANDOFF-helpdesk-sla-timeout.md` exists with all 10 task outputs.

## Risks

1. **Authority read at spawn vs fire time.** If admin changes `observer_escalation_hours` between ticket-open and breach, which value wins? Decision: read at spawn (snapshot semantics). Trigger row stores resolved interval, not the authority FK. Council to ratify.
2. **Clock skew between PG and Edge Function.** `fire-delayed-triggers` polls `WHERE fire_at <= NOW()`. Different clocks could delay or pre-fire. Mitigation: rely on PG clock authoritatively; Edge Function uses `NOW()` from PG via the SELECT.
3. **Double-fire under retry.** If `fire-delayed-triggers` emits the event but crashes before marking the trigger `fired`, next poll re-emits. Mitigation: `UPDATE ... WHERE status='pending' RETURNING` in same transaction as event emit. Idempotency at lifecycle: skip if `context.sla_breached_at IS NOT NULL`.
4. **Trigger orphaned on workspace delete.** No cascade defined. Low impact (workspace deletion is rare + already async). Mitigation: document, defer FK cascade to Phase 3.
5. **UI computed-overdue drift.** If we compute "overdue" on the client from `started_at + 72h < NOW()`, a ticket can show overdue badge BEFORE the breach event fires (poll gap). Decision: prefer `context.sla_breached_at` as source-of-truth, fall back to computed only if column null AND age > threshold + grace (5 min). Council to ratify.
6. **Cancellation race on resolve.** If `fire-delayed-triggers` poll runs concurrently with resolve emit, breach event can fire AFTER resolve. Mitigation: cancellation step in lifecycle marks trigger first, then emits resolve event. fire-delayed-triggers ignores `status='cancelled'`.

## Dependencies

- **Inputs:** Phase 1 dispatcher contract (PR #277). `engine_authority_config.observer_escalation_hours` seeded. `engine_delayed_trigger` table + `fire-delayed-triggers` Edge Function operational (used by journey-engine).
- **Blocks:** Phase 3 multi-tier SLA + mobile push escalation.
- **Does not block:** Mobile thin-client surface (independent), `help_request` table data migration (independent).

## Post-Implementation

- [ ] Tick Phase 2 in `docs/plans/CAMPAIGN-helpdesk.md` Milestones (also fill in Vision/Scope which are stub).
- [ ] Append PR row to `docs/plans/CAMPAIGN-helpdesk.md §Sync Log`.
- [ ] Move this plan to `docs/plans/completed/` alongside its handoff.
- [ ] Memory: add reference for SLA pattern reuse (engine_delayed_trigger as the canonical timeout primitive).

---

> Council pre-design (T1) is the gate. Do not start T2+ before council ack.
