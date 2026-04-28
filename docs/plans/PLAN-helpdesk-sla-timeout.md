---
title: "Plan — Helpdesk SLA Timeout (Phase 2)"
status: ready
updated: 2026-04-28
created: 2026-04-28
module: Helpdesk
tags: [plan, helpdesk, sla, engine-delayed-trigger, fire-delayed-triggers, adr-0161, adr-0162, adr-0163, adr-0165, adr-0226, adr-0227, phase-2]
---

# Plan — Helpdesk SLA Timeout (Phase 2)

> **Campaign:** `docs/plans/CAMPAIGN-helpdesk.md` — Phase 2 (deferred from PLAN-helpdesk-phase-1.md L52)
> **Architecture:** Council 2026-04-19 (Kanaler som Help Desk) — SLA reuses `engine_delayed_trigger → fire-delayed-triggers`. Zero new time-infra.
> **Council 2026-04-28 verdict:** APPROVE WITH CHANGES. All required edits incorporated below. ADR-0226 + ADR-0227 ratify the design.
> **Precondition:** Phase 1 dispatcher contract live (PR #277 merged). `engine_authority_config.observer_escalation_hours` seeded at 72h per workspace.

## Goal

Wire the helpdesk SLA so a ticket that sits in `waiting` past `observer_escalation_hours` (default 72h, snapshot at spawn) automatically fires a `helpdesk.query.sla_breached` event. The event is consumed by `helpdesk_query_lifecycle` step 3, which writes `context.sla_breached_at` and emits a chat-only `send_notification` to the resolved observer (per ADR-0226 proxy chain). Rep + manager UI reflects the breach with a calm "Forfalt" badge — no animations.

## Context

Phase 1 ships ticket spawn, single-spawn dispatcher contract, and `observer_escalation_hours` authority seed — but no consumer of that field. Tickets currently age silently. Council 2026-04-19 ratified `engine_delayed_trigger → fire-delayed-triggers` as the SLA primitive (already used by journey-engine).

Council 2026-04-28 (Steward + Engine Architect + Code Architect) ratified **Approach A** per ADR-0227 — pre-canned `engine_event` + seeded `engine_trigger` reuses the indirect-dispatch model. Zero schema migration on `engine_delayed_trigger`. One small dispatcher addition (`update_context` action_type).

Observer resolution proxies through `channel.responsible_profile_id` → `team.leader_profile_id` → broadcast (ADR-0226 documents the underlying gap; ADR-0227 codifies the chain).

Key constraints (from prior councils + ADRs):
- **ADR-0161** — ticket = `engine_state`, dispatcher owns spawn (do not direct-insert from tools).
- **ADR-0163** — `allowed_channels=['chat']`. SLA notifications must NOT trigger voice paths.
- **ADR-0165** — channel-progressive flags are read-time truth. Observer resolution reads `engine_authority_config`.
- **ADR-0226** — escalation hierarchy gap acknowledged. Phase 2 uses proxy resolution + `helpdesk.sla.no_observer_resolved` telemetry as safety net.
- **ADR-0227** — Approach A SLA model (this plan implements it).
- **L-0066** — default-allow combo banned. SLA path must not bypass authority.
- **Spec §1.4** — calm queue, no red/amber escalation animations. Badge unconditionally `text-muted-foreground`.

## Schema vocabulary (Council-corrected)

`engine_delayed_trigger` schema (verified by Steward against `20260304100000_engine_process_tables.sql`):
- `id UUID`, `trigger_id UUID FK → engine_trigger`, `event_id UUID FK → engine_event`, `workspace_id UUID`
- `fire_at TIMESTAMPTZ`, `fired BOOLEAN DEFAULT false`, `cancelled_at TIMESTAMPTZ NULL`
- Index: `idx_engine_delayed_trigger_fire ON (fire_at) WHERE fired = false`
- **NO `status` enum.** All earlier plan references to `status='pending'/'fired'/'cancelled'` rewritten below.

## Scope

**In (Phase 2):**
1. **Telemetry registration.** Add `helpdesk.query.sla_breached` (engine_event + activity_trail) and `helpdesk.sla.no_observer_resolved` (logger + activity_trail, severity=warn) to `packages/telemetry/src/registry.ts`.
2. **Migration `20260428120000_helpdesk_sla_blueprint.sql`.** Extend `helpdesk_query_lifecycle` blueprint with steps 3 (`wait_for_event` matching singular `event = 'helpdesk.query.sla_breached'`) and 4 (`update_context` setting `engine_state.context.sla_breached_at = NOW()` + `send_notification` to resolved observer).
3. **Migration `20260428130000_helpdesk_sla_trigger_seed.sql`.** Insert one `engine_trigger` row per workspace with `event_type='helpdesk.query.sla_breached'`, `process_id='helpdesk_query_lifecycle'`, `is_active=true`, `delay_seconds=0`. Idempotent via `ON CONFLICT DO NOTHING`.
4. **Dispatcher addition.** `supabase/functions/engine-dispatch/index.ts` adds `update_context` action_type — patches `engine_state.context` for the current state (different from `update_entity` which targets `state.entity_id`). Add to `GATED_MUTATION_TYPES`.
5. **`openTicket` tool patch.** After dispatcher spawn returns `state.id`, read `engine_authority_config.observer_escalation_hours`. Insert pre-canned `engine_event` (event_type=`helpdesk.query.sla_breached`, payload carries `engine_state_id` + `desk_channel_id` + `entity_type='channel'` + matching `entity_id` from the original `helpdesk.query.opened` event). Insert `engine_delayed_trigger` row with `fire_at = NOW() + observer_escalation_hours * INTERVAL '1 hour'`. Snapshot semantics — admin changes mid-flight do not affect this ticket.
6. **`resolveTicket` tool patch.** On resolve, look up the breach `engine_event` for the ticket (via `payload->>'engine_state_id'`) and mark linked `engine_delayed_trigger.cancelled_at = NOW()`. Cancellation precedes the resolve emit so concurrent fire-poll skips.
7. **Observer resolver.** New helper `resolve_observer(workspace_id, rep_profile_id, min_role)` in `packages/ai/src/capabilities/helpdesk_query/`. Implements ADR-0226 proxy chain: rep's team leader → broadcast (role >= min_role) → emit `helpdesk.sla.no_observer_resolved` telemetry + return null.
8. **UI badges.** Extend `useMinKo` to derive `has_breach` + `oldest_breached_at` from `context.sla_breached_at` server-side. `MinKoSection` row + `TicketHeader` render `Pill tone="muted" data-testid="overdue-badge"` (text "Forfalt") with breach-timestamp `title` attribute. No client-side computed-overdue. No color shift.

**Out (Phase 3+):**
- Multi-tier SLA (T+24h soft, T+72h hard). Phase 2 = single threshold.
- Mobile push on breach. Mobile thin-client deferred post-ADR-0135.
- Auto-reassign on breach. Phase 2 only notifies; reassign is Phase 3.
- First-class escalation hierarchy (per ADR-0226). Phase 3 candidate.
- Per-channel SLA override. Currently workspace-wide via authority.
- `delay_event` generalized action_type. Defer until 2nd consumer (per ADR-0227).
- `fire-delayed-triggers` crash-safety hardening. Documented as known debt.

## Tasks

- [x] **T1. Council pre-design.** APPROVE WITH CHANGES. ADR-0226 + ADR-0227 written and accepted. All 8 plan edits applied.
- [ ] **T2. Telemetry registration + Migration (blueprint).** Add the 2 events to `packages/telemetry/src/registry.ts`. Author migration `20260428120000_helpdesk_sla_blueprint.sql` extending blueprint with steps 3+4.
- [ ] **T3. Migration (trigger seed).** Author migration `20260428130000_helpdesk_sla_trigger_seed.sql` seeding workspace-scoped `engine_trigger` rows. Idempotent.
- [ ] **T4. Dispatcher `update_context` action_type.** Patch `engine-dispatch/index.ts` switch + `GATED_MUTATION_TYPES`. Tests: existing engine-dispatch tests + add one for context-only patch.
- [ ] **T5. `openTicket` tool patch.** Read authority, insert pre-canned event + delayed_trigger. Use `entity_type` matching original `helpdesk.query.opened` (verify shape via Steward's open question). Use untyped `.from("engine_delayed_trigger")` until types regenerated.
- [ ] **T6. `resolveTicket` tool patch + observer resolver.** Cancellation precedes resolve emit. Helper `resolve_observer()` written + unit-tested.
- [ ] **T7. fire-delayed-triggers verify.** No code change required. Acceptance test: invoke locally with a past `fire_at`, assert single dispatch + correct payload reaches engine-dispatch.
- [ ] **T8. UI patches.** `useMinKo` extended to derive `has_breach` + `oldest_breached_at`. `MinKoSection` + `TicketHeader` render Pill. `data-testid="overdue-badge"` for E2E.
- [ ] **T9. Authority audit query.** SQL: every `helpdesk_query` authority row has non-null `observer_escalation_hours` AND non-null observer `min_role`. Document in handoff if any null + propose backfill.
- [ ] **T10. E2E specs.** Three Playwright tests, one per journey. Use clock-skew helper (manually set `fire_at` past + invoke `fire-delayed-triggers`).
- [ ] **T11. Handoff.** `docs/HANDOFF-helpdesk-sla-timeout.md` with decisions, learnings (incl. fire-delayed-triggers crash-safety debt), audit outputs, next steps.

## Acceptance Criteria

- [ ] `pnpm turbo typecheck` passes 0 errors.
- [ ] `pnpm --filter @smartout/e2e test helpdesk-sla` runs 3 specs green.
- [ ] `SELECT COUNT(*) FROM engine_delayed_trigger d JOIN engine_event e ON d.event_id = e.id WHERE e.event_type='helpdesk.query.sla_breached' AND d.fired = false AND d.cancelled_at IS NULL` returns ≥1 after opening a ticket on a workspace with `observer_escalation_hours=72`.
- [ ] Manually setting `fire_at = NOW() - INTERVAL '1 minute'` + invoking `fire-delayed-triggers` results in: (a) one `helpdesk.query.sla_breached` event re-dispatched to engine-dispatch, (b) `engine_state.context.sla_breached_at` populated, (c) one notification entry in `notification_outbox` with `allowed_channels` excluding `voice`, (d) row marked `fired=true`.
- [ ] Re-invoking `fire-delayed-triggers` after breach fires zero additional events for that ticket (idempotency via lifecycle `context.sla_breached_at IS NOT NULL` guard).
- [ ] On `helpdesk.query.resolved`, linked `engine_delayed_trigger.cancelled_at IS NOT NULL`. Subsequent `fire-delayed-triggers` invocation does not emit breach for the resolved ticket.
- [ ] MinKoSection renders `data-testid="overdue-badge"` for breached tickets, omitted for non-breached.
- [ ] `git grep -nE "text-destructive|text-amber|text-red" apps/web/src/app/dashboard/komm/_components/MinKoSection.tsx apps/web/src/app/dashboard/komm/thread/` returns zero hits in changed files (Spec §1.4 calm queue).
- [ ] No new direct `engine_state.insert` from tool code (ADR-0161 single-spawn upheld). `engine_delayed_trigger.insert` is permitted in tools because dispatcher does not own the SLA spawn — Approach A delegates to the tool by design (documented in ADR-0227).
- [ ] Telemetry registry contains both `helpdesk.query.sla_breached` and `helpdesk.sla.no_observer_resolved` with correct destination routing.
- [ ] Observer resolver helper covered by unit tests for all three paths (team-leader hit, broadcast fallback, no-observer telemetry).
- [ ] `docs/HANDOFF-helpdesk-sla-timeout.md` exists with all 11 task outputs.

## Risks

1. **Crash-safety debt in fire-delayed-triggers.** Function marks `fired=true` BEFORE dispatch in non-transactional roundtrip. Crash between mark and dispatch loses event. Mitigation: lifecycle `context.sla_breached_at IS NOT NULL` guard ensures no double-action if event re-dispatched manually. Logged as known debt for Phase 3.
2. **Observer proxy resolves to nobody.** Rep has no team + workspace has no profiles `>= min_role`. Mitigation: emit `helpdesk.sla.no_observer_resolved` telemetry — high-signal warn, surfaces silent failure. Operations can add an observer manually.
3. **Cancellation race on resolve.** If `fire-delayed-triggers` poll runs concurrently with resolve, breach can fire AFTER resolve. Mitigation: resolve marks `cancelled_at` BEFORE emitting resolve event. fire-delayed-triggers filters `cancelled_at IS NULL`. If breach already in-flight, lifecycle reaction sees `engine_state.status='complete'` and no-ops via dispatcher's existing waiting-state-only resume guard.
4. **`engine_delayed_trigger` not in `database.types.ts`.** Untyped `.from()` is the existing pattern (used by engine-dispatch). Phase 2 follows the same. Add interface inline in tools.ts. Logged in handoff as "regenerate types when next migration touches the table."
5. **Authority changes mid-flight.** Snapshot at spawn (ADR-0227). Admin lowering `observer_escalation_hours` does NOT shorten in-flight tickets. Document in admin UI when Phase 3 surfaces it.
6. **Entity_type/entity_id mismatch.** Pre-canned breach event payload must mirror the original `helpdesk.query.opened` shape so dispatcher's waiting-state resume guard accepts. T5 explicitly verifies via reading the existing `openTicket` emit shape.

## Dependencies

- **Inputs:** Phase 1 dispatcher contract (PR #277). `engine_authority_config.observer_escalation_hours` seeded. `engine_delayed_trigger` table + `fire-delayed-triggers` Edge Function operational. ADR-0226 + ADR-0227 accepted.
- **Blocks:** Phase 3 multi-tier SLA + mobile push escalation + first-class escalation hierarchy.
- **Does not block:** Mobile thin-client surface (independent), `help_request` table data migration (independent), Phase 3 escalation work (independent track).

## Subagent dispatch (per CLAUDE.md rules)

| Task | Subagent | Model |
| ---- | -------- | ----- |
| T2 | botsson-harness-builder | sonnet |
| T3 | botsson-harness-builder | sonnet |
| T4 | system-agent-coordinator | opus |
| T5 | botsson-harness-builder | sonnet |
| T6 | botsson-harness-builder | sonnet |
| T7 | system-agent-coordinator | opus (verification only, no code) |
| T8 | frontend-designer | sonnet |
| T9 | botsson-harness-builder | sonnet |
| T10 | protocol-writer | sonnet |
| T11 | docs-tutor | sonnet |

T4 + T7 are opus because they touch dispatcher contract — judgment-heavy, low-throughput. Everything else is sonnet build-throughput.

## Post-Implementation

- [ ] Tick Phase 2 in `docs/plans/CAMPAIGN-helpdesk.md` Milestones. Fill in Vision/Scope (currently stub).
- [ ] Append PR row to `docs/plans/CAMPAIGN-helpdesk.md §Sync Log`.
- [ ] Move this plan to `docs/plans/completed/` alongside its handoff.
- [ ] Memory: add reference for SLA pattern reuse (engine_delayed_trigger as canonical timeout primitive) and observer-resolution proxy chain.

---

> Council pre-design (T1) closed APPROVE WITH CHANGES. ADR-0226 + ADR-0227 accepted. Build sequence T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10 → T11.
