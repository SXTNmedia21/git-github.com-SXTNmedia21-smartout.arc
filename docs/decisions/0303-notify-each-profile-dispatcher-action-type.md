---
title: "notify_each_profile dispatcher action_type for fan-out notification"
id: ADR_0303
status: proposed
layer: decision
created: 2026-05-12
updated: 2026-05-12
---

# ADR-0303: `notify_each_profile` dispatcher action_type for fan-out notification

## Context and Problem Statement

`payroll.period_locked` event must fan out to N `notification_outbox` rows (one per affected profile) when a payroll period is locked. The engine-dispatch dispatcher has `send_notification` (single-recipient) and `generate_steps` (hard-wired to `protocol_assignment` source), neither of which iterates a profile array. Day-3 of `PLAN-mvp-blockers.md` (Task 14) initially proposed a standalone Edge Function — pattern rejected by ADR-0235 for the same architectural class.

## Decision Drivers

- ADR-0235 codifies that cross-process consumer reactions to engine_event flow through `engine_trigger → engine_process → engine_state → dispatcher action_type`. Direct invoke or sidecar Edge Function bypasses gating + audit + spawn lifecycle.
- ADR-0287 + ADR-0099 require `gate_action` evaluation before any mutation. Dispatcher already gates `send_notification` via `GATED_MUTATION_TYPES` set at `engine-dispatch/index.ts:644-653`.
- ADR-0236 precedent (`update_context_targeted`) added a sibling action_type rather than extending `update_context`. Same reasoning applies: extending `send_notification` to scalar OR array would create back-compat risk for ~12 existing engine_process blueprints; sibling action_type is the safe path.
- L-0066 default-allow-with-warning trap means missing authority seed silently allows mutations. Process must ride existing capability=`payroll` seed.

## Considered Options

1. **Option A — NEW `notify_each_profile` dispatcher action_type** with engine_process subscriber + engine_trigger row. Migration-only addition to subscriber pipeline, single dispatcher case added.

2. **Option B — Reuse `send_notification` + `generate_steps`** to fan out profile array dynamically. INVALID: `generate_steps` at `engine-dispatch/index.ts:1961` hard-wired to `source: "protocol_assignment"` — only enumerates procedure_step / knowledge_test / confirmation. No profile-array branch.

3. **Option C — Direct invoke from emit-site** (`tools.ts:902` calls `supabase.functions.invoke()` post-emit). ADR-0235-rejected class — bypasses dispatcher entirely, creates third mutation pathway, no engine_state lifecycle, no gate_action.

4. **Option D — Emit-site loop** (BFF route emits N `payroll.period_locked.per_profile` events). Write amplification ×N at producer side; pollutes engine_event with synthetic per-profile events; ADR-0235 explicitly chose process-pattern over emit-amplification for SLA breach.

## Decision Outcome

Chosen option: **Option A — NEW `notify_each_profile` dispatcher action_type**, because it is the only path that:
- Preserves ADR-0235 consumer-pattern (engine_event → trigger → state → dispatcher action_type)
- Inherits gate_action machinery from existing `GATED_MUTATION_TYPES` set
- Mirrors ADR-0236 sibling-action-type precedent
- Avoids write amplification at producer side
- Allows single canonical emit-site (one engine_event row per lock → one engine_state spawn → N notification_outbox rows from the fan-out handler)

### Implementation shape

Handler at `supabase/functions/engine-dispatch/index.ts` (mirrors `send_notification` + `update_context_targeted` shape):

- Reads `step.action_payload.recipient_ids: string[]` + `template, payload, workspace_id`
- Resolves `targetWorkspace = ap.workspace_id ?? state.workspace_id`
- Empty/invalid `recipient_ids` → `markStateBlocked` (NOT silent success)
- Iterates `recipient_ids` mapping to per-row `notification_outbox` shape:
  - `workspace_id, recipient_id (per-row), mode: "work", priority: 0, title: template, body: "", action_url: null, metadata: { event_key, state_id, ...payload }, allowed_channels: ["push", "in_app"]`
- Batch INSERT via single `supabase.from("notification_outbox").insert(rows)` call
- `markStateBlocked` on INSERT error; `advanceToNextStep` on success

### Required amendments (BLOCKING before Day-3 sortie ships)

**Amendment 1 — gate_action coverage:** `"notify_each_profile"` MUST be added to `GATED_MUTATION_TYPES` set at `engine-dispatch/index.ts:644-653`. Without this, dispatcher bypasses `gate_action` for the new mutation = ADR-0287 + ADR-0099 violation. CI `scripts/gate-action-coverage.ts` must catch new dispatcher cases.

**Amendment 2 — dual-emit cleanup (F-CT-01 5th occurrence):** `packages/ai/src/capabilities/payroll/tools.ts:901-918` AND `apps/web/src/app/api/payroll/lock-period/route.ts:163-180` BOTH emit `payroll.period_locked` today. Tool emit has hardcoded `profiles_count: 0, total_lines: 0`; route emit has real counts. Without cleanup, subscriber fires N×2 notifications per lock. Resolution: delete capability emit at `tools.ts:901-918`; replace `lockPeriod` tool body with BFF route invocation OR delete the tool's emit-only block and rely on Route Handler as canonical emit-site. See L-0234 for pattern.

### Authority seeding

Subscriber `engine_process` MUST declare `capability = "payroll"` to ride existing `engine_authority_config` seed at migration `20260527100100_payroll_phase1_authority_seed.sql:38`. No new authority seed migration required if this constraint holds. If subscriber declares a new capability slug (e.g. `payroll_notification`), separate seed migration required per L-0066 mitigation.

### Subscriber process blueprint (Day-3 Step 3)

New migration `<ts>_payroll_period_locked_notifier.sql`:
- `engine_process` blueprint row: slug `payroll_period_locked_notifier`, capability `payroll`, `allowed_channels: ['chat']` (process-surface guard per ADR-0163)
- `engine_step[]` rows:
  1. `wait_for_event` on `payroll.period_locked`
  2. `update_context` step to resolve `recipient_ids` from `state.context.data.period_id` via DB query on payroll.calculation distinct profile_id
  3. `notify_each_profile` step with `template: "payroll.period_locked"`, `recipient_ids` derived from prior context patch, `allowed_channels: ["push", "in_app"]` (delivery channels)
- `engine_trigger` row: `event_type='payroll.period_locked' → process_id='payroll_period_locked_notifier'`, `workspace_id=NULL` (platform-wide)

### Payload path correction

Plan code-samples reference `context.periodId` (camelCase). Real path on dispatcher-resolved state context is `state.context.data.period_id` (snake_case, nested under `data`). All migration step payloads + future handlers must use the correct path. Verified by agent-coord Layer 2 trace at `engine-dispatch/index.ts:331-344`.

### Test gating

D2 = C now (no Deno test for new action_type — matches `update_context_targeted` precedent at `:1002` shipped without companion test).

D2 = A at Phase 4 (BLOCKING) — Playwright E2E asserts:
- (a) `notification_outbox` rows exist for every affected profile after period lock
- (b) Exactly N rows, no duplicates
- (c) `engine_event` row has correct ADR-0161 entity flatten

## Consequences

**Positive:**
- ADR-0235 consumer-pattern preserved → single canonical pipeline
- ADR-0287/0099 gate coverage maintained via `GATED_MUTATION_TYPES` membership
- Zero new infrastructure (engine-dispatch already exists)
- Reusable for future "event-fans-out-to-N-notifications" capabilities
- Dual-emit cleanup retires F-CT-01 pattern from payroll surface

**Negative:**
- Adds new dispatcher action_type (small dispatcher growth — single case)
- Subscriber blueprint requires `update_context` intermediate step to resolve `recipient_ids` from DB (two-step blueprint)
- Empty `recipient_ids` becomes `markStateBlocked` (acceptable — explicit blocker is preferable to silent success)

**Risks documented separately in council verdict + L-0233/0234/0235:**
- Forgetting Amendment 1 → CVE-class gate bypass (L-0066)
- `state.context.data.period_id` path drift if blueprint uses wrong key
- Dual-emit not resolved → 2× notifications per lock

## References

- ADR-0235 — Helpdesk SLA consumer-path breach-handler process pattern
- ADR-0236 — `update_context_targeted` action_type split precedent
- ADR-0287 — gate_action mandatory on mutation capability tools
- ADR-0099 — Unified authority gate
- ADR-0161 — Entity flatten at telemetry provider
- ADR-0163 — Channel pinning fail-closed
- ADR-0186 — engine_event fanout
- L-0066 — Default-allow capability authority CVE-trap
- L-0233 — Council chair branch-verification preflight (6th L-0147)
- L-0234 — Dual-emit F-CT-01 5th occurrence
- L-0235 — Hardcoded zeros in capability emit as tell
- Council session: `docs/council/COUNCIL-LOG.md` 2026-05-12 entry
- Plan: `docs/plans/PLAN-mvp-blockers.md` Task 14 (Day 3)
