---
title: "Helpdesk Phase 0 — Foundations (4 ADRs + Dead-Infra Wiring + Schema Sequencing)"
id: PLAN_HELPDESK_PHASE_0
status: in_progress
layer: plan
created: 2026-04-19
updated: 2026-04-20
depends_on:
  - ADR_0160
  - ADR_0161
  - ADR_0162
  - ADR_0163
---

> **Week 1 status (2026-04-20):** All 4 ADRs accepted. Task 1.1 (acceptance council) and Task 1.2 (status flip) COMPLETE.
>
> **Week 2 status (2026-04-20):** COMPLETE.
> - Task 2.1 — `channel_ai_policy` read-path wired into `send_message` tool + 10 unit tests (commit `b6aa3f51`)
> - Task 2.2 — `channel_event` projection trigger shipped (commit `21ae0ef5`, migration `20260515120000`)
> - Task 2.3 — Dead-infra deadline 2026-07-13 satisfied; logged in council_meta.md Process Improvements.
>
> Week 3 (schema sequencing drafts) is now ready to start.

# Helpdesk Phase 0 — Foundations

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. DO NOT start tasks 2.x or 3.x before all 4 ADRs are `accepted`.

**Goal:** Establish the architectural + infrastructure foundations required before the ConnectTeam-style help desk feature can begin implementation. Phase 0 output: 4 accepted ADRs, `channel_ai_policy` read-path wired, `channel_event` projection trigger in place, migration sequencing planned but not run, authority-config seed drafted.

**Tech Stack:** PostgreSQL 17 migrations, Supabase RLS, TypeScript (packages/ai, services/stage-engine), Event Engine (engine_process, engine_state, engine_trigger, engine_delayed_trigger).

**Source documents:**

- `docs/decisions/0160-channel-event-vs-engine-event-boundary.md` (proposed)
- `docs/decisions/0161-helpdesk-ontology-ticket-as-engine-state.md` (proposed)
- `docs/decisions/0162-helpdesk-query-capability-placement.md` (proposed)
- `docs/decisions/0163-adr-0078-amendment-pii-allowedchannels-mandatory.md` (proposed)
- `docs/council/COUNCIL-LOG.md` (2026-04-19 Kanaler som Help Desk session)
- `docs/learnings/0066-0071` (6 learnings from this council)

---

## Architecture Overview

Phase 0 is a three-week sequence that unblocks later phases by making the foundational decisions real (ADRs accepted), wiring the dead infrastructure (`channel_ai_policy` + `channel_event`) that helpdesk depends on, and sequencing the schema migrations so later phases land atomically.

The three-week plan:

1. **Week 1 — ADR acceptance council.** Review all 4 ADRs as a package. Goal: move from `proposed` to `accepted` via targeted council review, not reimplementation. Each ADR has blocking relations (0161 depends on 0160; 0162 depends on 0161; 0163 depends on 0162) so they ship as a set.
2. **Week 2 — Dead-infra wiring.** Close two TODOs from 2026-04-13 council: `channel_ai_policy` read-path in `communication/policy.ts:66` (agent-router consumes it), and `channel_event` projection trigger as the first concrete implementation of ADR-0160. Both land WITHOUT helpdesk-specific callers — they must work for general Komm use first.
3. **Week 3 — Schema sequencing + seed migrations.** Write (do not run) the 5-migration sequence for Phase 1. Enum ADD VALUE first (separate transaction), responsible_profile_id + check constraint second, engine_process blueprint third, authority_config seed fourth, projection trigger specialization fifth. All drafts land in `supabase/migrations/` as `.sql.draft` files until Phase 1 starts.

---

## Prerequisites

- [ ] User has approved council verdict from 2026-04-19 (DONE — this plan is the follow-through)
- [ ] 4 ADRs exist as `proposed` in `docs/decisions/` (DONE)
- [ ] 6 learnings exist in `docs/learnings/` (DONE)
- [ ] Council log entry exists in `docs/council/COUNCIL-LOG.md` (DONE)
- [ ] No blocking work in progress on `development` that touches `channel_*` tables or `packages/ai/src/capabilities/communication/`

---

## Tasks

### Week 1 — ADR Acceptance

#### Task 1.1: Run ADR-acceptance council (targeted)

**What:** Dispatch 2-reviewer degraded-mode council (steward + supervisor) to review all 4 ADRs as a package. Goal: accept as-is, accept with minor changes, or identify blocking gaps.

**Files:** Read-only — reviewers read the 4 ADR files and linked learnings. No code changes in this task.

**Acceptance:**
- Verdict APPROVE, APPROVE WITH CHANGES, or REJECT documented in new COUNCIL-LOG.md row dated next-available date.
- If APPROVE or APPROVE WITH CHANGES, proceed to 1.2 with any required changes incorporated.
- If REJECT, escalate to user — helpdesk feature is paused.

#### Task 1.2: Move ADRs to `accepted` status

**What:** Update frontmatter `status: proposed` → `status: accepted` on all 4 ADR files. Update `docs/decisions/0000-decision-log.md` Status column.

**Files:**
- `docs/decisions/0160-channel-event-vs-engine-event-boundary.md`
- `docs/decisions/0161-helpdesk-ontology-ticket-as-engine-state.md`
- `docs/decisions/0162-helpdesk-query-capability-placement.md`
- `docs/decisions/0163-adr-0078-amendment-pii-allowedchannels-mandatory.md`
- `docs/decisions/0000-decision-log.md`

**Acceptance:** `grep "status: accepted" docs/decisions/016[0-3]-*.md` returns 4 matches.

---

### Week 2 — Dead-Infra Wiring

#### Task 2.1: Implement `channel_ai_policy` read-path

**What:** Complete the TODO at `packages/ai/src/capabilities/communication/policy.ts:66`. `isAiAllowedInChannel()` currently has the structure but does not integrate with the agent-router response pipeline. Implementation:
- Ensure `getChannelAiPolicy(channelId)` returns the policy row (create default if missing).
- `isAiAllowedInChannel(channelId, mode)` returns boolean based on `text_participation` / `voice_participation` enum + `mode` input.
- Call from `services/stage-engine/src/core/agent-router.ts` at the point where a tool attempts to write a message to a channel.

**Files:**
- `packages/ai/src/capabilities/communication/policy.ts` (extend existing)
- `services/stage-engine/src/core/agent-router.ts` (new integration point)
- `packages/ai/src/capabilities/communication/__tests__/policy.test.ts` (new — unit test)

**Acceptance:**
- Unit test: channel with `text_participation='disabled'` blocks AI message insert at agent-router layer.
- Unit test: channel with `text_participation='mention_only'` allows message only when mention present.
- Integration: stage-engine log shows policy check on every agent message write.
- Dev-mode console shows policy decisions for debugging.

**Blocked-by:** 1.2 (ADR-0162 accepted — capability structure must be stable).

#### Task 2.2: Implement `channel_event` projection trigger

**What:** Write the Postgres trigger that projects relevant `engine_event` rows into `channel_event` per ADR-0160. Whitelist approach: `event_type` matches pattern `channel.*` OR `helpdesk.*` with workspace_id + channel_id in payload.

**Files:**
- `supabase/migrations/NNNN_channel_event_projection_trigger.sql` (new migration — reserve number via `git log --all` check per Phase 8 Step 0)
- `packages/supabase/src/database.types.ts` (regenerate after migration applied)

**Acceptance:**
- Migration applies cleanly on `npx supabase db reset`.
- Insert a test `engine_event(event_type='channel.test', payload={channel_id: ...})` → row appears in `channel_event` with matching `engine_event_id` FK.
- Insert `engine_event(event_type='shift.started')` → no row in `channel_event` (whitelist rejects).
- Trigger failure mode: raises NOTICE but does not block engine_event INSERT (projection is best-effort).

**Blocked-by:** 1.2 (ADR-0160 accepted).

#### Task 2.3: Verify dead-infra deadline

**What:** Post a 👀 comment in the 2026-04-13 council retrospective (if Linear ticket exists) or a note in `council_meta.md` confirming: `channel_ai_policy` + `channel_event` now have first real consumers. Deadline (2026-07-13) satisfied.

**Files:** `~/.claude/projects/.../memory/council_meta.md` — add entry to Process Improvements.

**Acceptance:** Entry dated 2026-04-19+Week2.

---

### Week 3 — Schema Sequencing (Drafts Only)

**Important:** All Week 3 migrations are written as `.sql.draft` files. They are NOT applied. Phase 1 renames and applies them. This is to catch any ordering / constraint issues in review before a single byte lands in the database.

#### Task 3.1: Draft enum extension migration

**What:** `ALTER TYPE comm_channel_type ADD VALUE 'desk'; ALTER TYPE channel_member_role ADD VALUE 'representative';`. Separate file — enum values cannot be used in same transaction as they are created.

**Files:** `supabase/migrations/NNNN_channel_desk_enums.sql.draft`

**Acceptance:** File exists. Timestamp greater than HEAD max. Contains NO INSERT / UPDATE using the new values.

#### Task 3.2: Draft channel column migration

**What:** Add `responsible_profile_id uuid` FK to profile (nullable). Add CHECK constraint: `channel_type != 'desk' OR responsible_profile_id IS NOT NULL` (deferred until migration end to allow backfill).

**Files:** `supabase/migrations/NNNN_channel_responsible_profile.sql.draft`

**Acceptance:** File exists. References `'desk'` enum value from 3.1.

#### Task 3.3: Draft engine_process blueprint

**What:** Seed `engine_process(name='helpdesk_query_lifecycle', allowed_channels=['chat'], ...)` with the 6-step blueprint from ADR-0161:
1. wait_for_event(event='helpdesk.query.opened')
2. assign_task(to=desk.responsible_profile_id)
3. send_notification
4. wait_for_event OR timeout (SLA)
5a. update_entity(status='resolved') on resolve
5b. ops_escalate + send_notification on timeout

**Files:** `supabase/migrations/NNNN_helpdesk_query_process_seed.sql.draft`

**Acceptance:** File exists. All action_types are verified to exist in `supabase/functions/engine-dispatch/index.ts` dispatcher.

#### Task 3.4: Draft authority_config seed

**What:** Seed `engine_authority_config` for `helpdesk_query` capability per ADR-0162 — `level='suggest'` for read tools, `level='confirm'` for resolve/reassign, `min_role='manager'`.

**Files:** `supabase/migrations/NNNN_helpdesk_query_authority_seed.sql.draft`

**Acceptance:** File exists. Uses template from `supabase/migrations/20260417170000_billing_query_authority_seed.sql`.

#### Task 3.5: Review all 5 drafts as a package

**What:** Dispatch supervisor (code-tracer) to review the 5 draft migrations for ordering, constraint compatibility, RLS audit, and cross-migration dependencies.

**Files:** Read-only — reviewer reads all 5 drafts + relevant existing RLS policies.

**Acceptance:** Supervisor sign-off report in `docs/plans/completed/` or `council_meta.md` Session History.

---

## Validation

- [ ] 4 ADRs status = accepted (verified via grep)
- [ ] `channel_ai_policy` read-path has unit tests + integration test passing
- [ ] `channel_event` projection trigger applies + rejects non-whitelisted events
- [ ] 5 migration drafts written as `.sql.draft` files, supervisor-approved
- [ ] No `.sql` migrations applied in Phase 0 (ONLY `.sql.draft`)
- [ ] Dead-infra deadline (2026-07-13) satisfied with real consumers

---

## Post-Implementation

- [ ] Update `docs/INDEX.md` — add Plan reference
- [ ] Move this plan to `docs/plans/completed/` at end of Phase 0
- [ ] Phase 1 kickoff document referenced in `docs/handoffs/HANDOFF-helpdesk-phase-0.md`
- [ ] Mobile ADR-0133 verb table re-checked (desk authoring = web-only, query composer/rep toggle/self-claim = mobile-ok)

---

## Risks

- **ADR rejection at Week 1 council.** If ADR-0160 (channel_event boundary) is rejected, ADR-0161-0163 cascade. Mitigation: 2-reviewer council is faster than 4-reviewer; targeted rework within the week.
- **`channel_ai_policy` integration breaks existing Komm AI flows.** If agent-router currently writes without policy check, adding one may suddenly deny writes. Mitigation: Task 2.1 must add default policy row creation for every existing channel (backfill).
- **Enum ADD VALUE transactionality.** If 3.1 and 3.2 are accidentally bundled, migration fails. Mitigation: `.sql.draft` naming enforces visual separation; 3.5 supervisor review catches this.
- **Migration number collision with parallel worktrees.** Per newly-promoted SKILL.md Phase 8 Step 0 rule. Mitigation: `git log --all` check before picking each migration timestamp.

---

## Non-Goals (Out of Scope for Phase 0)

- Applying any `.sql` migration (Phase 1).
- Writing TypeScript code for desk UI (Phase 1).
- Building the `helpdesk_query` capability tools (Phase 1).
- Any mobile code (Phase 1+).
- Call recording, broadcast, analytics (Phase 3/deleted).

---

> After writing: add to `docs/INDEX.md` under Plans. Move to `docs/plans/completed/` when Phase 0 ships.
