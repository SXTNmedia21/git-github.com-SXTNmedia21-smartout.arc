---
title: "Plan — cascade-gate-write (ADR-0091 WP2) — SHIPPED"
status: done
updated: 2026-04-20
created: 2026-04-18
closed: 2026-04-20
module: governance
tags: [plan, adr-0091, cascade_gate_write, governance, c4, shipped]
---

# Plan — cascade-gate-write (ADR-0091 WP2) — SHIPPED

> **Status update 2026-04-20 (council verdict):** This plan is closed. WP2 has shipped. This file is kept for history per L-0078 (plan-file decay pattern). Next WPs (Wave 2B/2C) are tracked in separate plans.

## Shipped artifacts (verified 2026-04-20)

- `supabase/migrations/20260512100000_cascade_gate_write.sql` — `public.cascade_gate_write()` RPC with Option B (trigger-match check, deep rule evaluation deferred to WP1)
- `supabase/migrations/20260512100200_cascade_gate_write_assert.sql` — assertion tests
- `packages/supabase/src/gate-client.ts:183` — TS wrapper invoking the RPC successfully
- Production call sites: `apps/web/src/app/dashboard/setup/_actions/season-actions.ts`, `apps/web/src/app/dashboard/people/_actions/people-actions.ts`

## Next Work (separate plans)

- **Wave 2B** (capability dual-gate) — blocked on P1-P3 prereqs per council 2026-04-18
- **Wave 2C** (schedule TanStack migration) — blocked on Q1-Q3 prereqs, /dashboard/schedule excluded per ADR-0032
- **Reconciliation ADR** — agent tools still use old `gate_action` while Server Actions use new `cascade_gate_write`; same mutation via different paths may yield different outcomes

---

## Original executive summary (superseded — kept for history)

**WP2 Status (as of 2026-04-18):** Not shipped. No `public.cascade_gate_write()` function exists in `supabase/migrations/`. The TS wrapper (`packages/supabase/src/gate-client.ts`) was added 2026-04-17, but it calls a non-existent RPC, making all `gatedInsert/Update/Delete` calls fail with `42883 function does not exist`.

**Key Blocker (as of 2026-04-18):** WP1 (`evaluate_framework_rules`) does not exist. However, WP2 can **proceed independently** by stubbing WP1 as a pass-through evaluator (returns `outcome='proposed'` for any governance-gated entity type).

---

## Findings

### 1. ADR-0091 WP1 Status: Evaluate Framework Rules

**Status:** Not shipped. No SQL function `evaluate_framework_rules()` exists.

**Decision:** WP2 **does not** require WP1 to be complete. The spec allows `cascade_gate_write` to defer deep rule evaluation — it must only guarantee the gate decision is atomic (not silently permit all). We can:
- **Option A:** Stub WP1 as `outcome = 'proposed'` for any row that matches a trigger (conservative safe-default).
- **Option B:** Call a minimal framework check: lookup `workspace_framework_binding`, scan `framework_trigger` for this `entity_type`, if found → require approval via `change_proposal`.
- **Option C:** Full evaluation using `tariff_rate_table`, `regulatory_framework`, `framework_rule` logic (scope creep; defer to WP1 proper).

**Recommendation:** Start with Option B (minimal trigger scan). It satisfies the spec's "does NOT silently permit-all" requirement without waiting for full rule logic.

---

### 2. Existing Gate Function `public.gate_action` (ADR-0099)

**Signature (9 args):**
```sql
public.gate_action(
  p_workspace_id       UUID,
  p_capability         TEXT,
  p_channel            TEXT,
  p_actor_profile_id   UUID,
  p_action_type        TEXT,
  p_engine_process_id  TEXT DEFAULT NULL,
  p_engine_state_id    UUID DEFAULT NULL,
  p_approvers_present  UUID[] DEFAULT ARRAY[]::UUID[],
  p_entity_id          UUID DEFAULT NULL
)
RETURNS JSONB
```

**Return shape:**
```json
{
  "allow": boolean,
  "downgrade_to": "suggest" | null,
  "min_role_required": TEXT,
  "channel_allowed": boolean,
  "reason": TEXT | null,
  "gate_evaluation_id": UUID,
  "four_eyes_required": boolean,
  "approvers_needed": integer,
  "approvers_present": UUID[]
}
```

**Evaluation logic:**
1. Looks up `engine_authority_config(workspace_id, capability)` → `level`, `min_role`, `requires_four_eyes`
2. Compares caller role via `_role_rank()` against `min_role` (downgrade to 'suggest' if below)
3. Checks channel against `engine_process.allowed_channels` (deny if not in list)
4. Four-eyes: if `requires_four_eyes=true` and `array_length(p_approvers_present) < 2` → deny
5. **Writes audit row to `gate_evaluation` table**
6. Returns structured outcome

**Reusability for cascade_gate_write?** **NO**. Semantically incompatible:
- `gate_action` is about **capability + authority level** (who can do X?). It has no concept of the data being written.
- `cascade_gate_write` is about **data + rules** (should this row be allowed to change?). It diffes old vs new state, evaluates framework rules, and may create a `change_proposal` to defer the write.

These are two different gates. `cascade_gate_write` may **call** `gate_action` as a pre-flight check (e.g., "is this user allowed to edit shifts at all?"), but the function is separate.

---

### 3. Framework Rule Tables — D3 Rules Landscape

**Tables exist and are seeded:**
- `regulatory_framework` — versioned framework packages (e.g., `hospitality.no.v1`). Platform-managed (K1a). Linked to workspace via `workspace_framework_binding`.
- `framework_rule` — individual evaluable rules (FK to framework). Enum `framework_rule_type`. Fields: `code`, `rule_type`, `category`, `default_outcome`, `severity`, `evaluation_config` (JSONB).
- `framework_trigger` — conditions that **initiate** rule evaluation. Enum `framework_trigger_mode`. Fields: `code`, `trigger_mode`, `source_entity_type`, `evaluation_config`, `linked_rule_ids[]`.
- `workspace_rule_override` — per-workspace rule customization (override_outcome, override_config, valid_from/until).
- `workspace_trigger_override` — per-workspace trigger customization (is_disabled, override_config).

**Trigger-to-Rules Linking:**
- `framework_trigger.linked_rule_ids[]` — which rules fire when this trigger activates
- `framework_trigger.source_entity_type` — the entity type that fires this trigger (e.g., `'schedule_shift'` for shift insert/update/delete)

**Schema binding:**
- `change_proposal.framework_trigger_id` — added in A2 migration; links the proposal to the exact trigger that fired

**Example seeding (K1a hospitality framework):**
- Triggers exist for `schedule_shift` writes (insert, update, delete)
- Rules are linked for tariff validation, contract conflict checking, etc.
- Workspace can override individual rules or disable entire triggers

**Implication for WP2:**
When `cascade_gate_write(entity_type='schedule_shift', action='create', ...)` is called, the function must:
1. Look up active framework via `workspace_framework_binding` (one per active workspace)
2. Scan `framework_trigger` for rows where `source_entity_type='schedule_shift'` and the trigger is enabled
3. For each matching trigger, evaluate its `linked_rule_ids[]` against `p_proposed_data`
4. If any rule blocks → return `{ allowed: false, outcome: 'blocked', reason }` (or create a `change_proposal` if rule allows with caveat)

---

### 4. Change Proposal Flow — Terraform-Style Saved Plan

**Table schema:**
```sql
change_proposal (
  change_proposal_id UUID PK,
  workspace_id UUID NOT NULL,
  initiated_by UUID NOT NULL (profile FK),
  trigger_type TEXT,                      -- trigger code from framework
  trigger_entity_type TEXT,               -- e.g., 'schedule_shift'
  trigger_entity_id UUID,                 -- the specific entity being proposed
  created_by_plane CASCADE_INITIATOR,     -- 'admin_manual' | ... (enum)
  status CHANGE_PROPOSAL_STATUS,          -- 'pending' | 'approved' | 'rejected' | 'applied' | 'expired'
  changes JSONB,                          -- the proposed diff
  preview JSONB,                          -- derived state after applying changes
  approval_required BOOLEAN,               -- whether this change needs approval
  approved_by UUID (profile FK),          -- who approved
  approved_at TIMESTAMPTZ,
  policy_rule_ids TEXT[],                 -- which rules triggered this proposal
  risk_score NUMERIC(3,2),
  policy_decision EVALUATION_OUTCOME,     -- 'blocked' | 'review_required' | 'approved'
  ...timestamps, conflict_count, etc.
)
```

**Who writes rows:**
- Application writes when `cascade_gate_write` returns `{ allowed: false, outcome: 'review_required' }`
- Application does NOT write on `allowed: true`; the write proceeds directly
- Application does NOT write on `blocked`; the caller receives an error

**Statuses:**
- `pending` — waiting for approval
- `approved` — approved by reviewer, eligible for application
- `rejected` — declined
- `applied` — was approved and the changes were written to the DB
- `expired` — deadline passed, no longer valid

**Routing (application-level, not DB-level):**
No database trigger writes `change_proposal` rows. The RPC returns a response shape telling the caller: "your write was blocked; here is a `proposal_id` you can use to refer to it in the UI." Application code in a Server Action or Edge Function is responsible for:
1. Catching the gate denial
2. Creating the `change_proposal` row with the proposed data
3. Surfacing the proposal to admins for review
4. On approval, calling the RPC again (or a separate apply RPC) to execute the proposed changes

**Implication for WP2:**
The RPC does **not** create the `change_proposal` row itself. Per ADR-0091, the flow is:
1. Gate returns `{ allowed: false, outcome: 'review_required', ... }`
2. Caller application code decides to create a proposal row (or discard the request)
3. Caller surfaces the proposal ID to the UI
4. Later, a reviewer approves/rejects via a separate flow

However, for transaction atomicity, if the RPC decides a proposal is needed, it could insert a skeleton row and return the ID. The spec is silent on this; recommend application-level handling for WP2's MVP.

---

### 5. Authority Config — Capability→Role Mapping

**Table:**
```sql
engine_authority_config (
  id UUID PK,
  workspace_id UUID NOT NULL,
  capability TEXT NOT NULL,
  level TEXT NOT NULL,              -- 'autonomous' | 'confirm' | 'suggest' | 'read_only' | 'disabled'
  min_role TEXT NOT NULL DEFAULT 'employee',  -- 'employee' | 'manager' | 'admin' | 'owner'
  updated_by UUID (user_identity FK),
  created_at, updated_at TIMESTAMPTZ
  UNIQUE(workspace_id, capability)
)
```

**Levels:**
- `autonomous` — allowed without restriction
- `confirm` — allowed but requires explicit user confirmation (deferred; inline UI not built)
- `suggest` — allowed but only as a suggestion for manual review; system cannot execute
- `read_only` — no write access, read-only
- `disabled` — no access at all

**min_role mapping:**
- Rank hierarchy: employee (1) < manager (2) < admin (3) < owner (4)
- If actor's role rank < min_role rank → downgrade to 'suggest'
- Implemented via `_role_rank(p_role TEXT)` SQL function (defined in `20260505110000_unified_authority_gate.sql`)

**Usage in cascade_gate_write WP2:**
- Lookup the active framework's rules
- For each rule, check if a workspace-level override exists (`workspace_rule_override`)
- Apply `min_role` check: if caller below threshold, downgrade rule outcome to 'suggest'

---

### 6. Telemetry & Audit — gate_action Precedent

**gate_action behavior:**
- Writes exactly one row to `gate_evaluation` per call (audit trail)
- Does NOT write to `activity_trail` or `engine_event`
- Caller (application code) is responsible for emitting telemetry on denial (see `packages/telemetry/src/registry.ts` comment: "ADR-0099: unified authority gate — every gate_action evaluation and every denial")

**audit_trail table:**
```sql
activity_trail (
  id BIGSERIAL PK,
  workspace_id UUID,
  actor_id UUID (profile FK),
  event TEXT,                  -- 'shift created', 'department updated'
  action_verb TEXT,            -- 'created', 'updated', 'deleted'
  category TEXT,               -- 'scheduling', 'org_structure'
  entity_type TEXT,            -- 'shift', 'department'
  entity_id UUID,
  entity_label TEXT,           -- human readable
  data JSONB,                  -- for creates/deletes: snapshot of key fields
  changes JSONB,               -- for updates: { "field": { "before": x, "after": y } }
  correlation_id UUID,         -- ties to a request chain
  source TEXT DEFAULT 'web',   -- 'web', 'mobile', 'api', 'system', 'ai'
  ip_address INET,
  created_at TIMESTAMPTZ
)
```

**Implication for WP2:**
`cascade_gate_write` should:
1. Write its own audit row to `gate_evaluation` (not `activity_trail`), capturing the gate decision
2. NOT write to `activity_trail` directly (that is the responsibility of the application code that calls the RPC, or a trigger on the mutated table)
3. If a `change_proposal` is created, the RPC may insert that row as part of its transaction

---

### 7. Existing Call Sites — None Yet

**Search results:**
- `packages/supabase/src/gate-client.ts` exists and calls `cascade_gate_write` via RPC
- No application code **calls** it yet (WP3 call-site migration is blocked on WP2)
- `packages/ai/src/capabilities/shift-lifecycle/gate.ts` exists and calls `gate_action` (ADR-0099), not `cascade_gate_write`

**Impact:** WP2 design is not constrained by existing call-site expectations; clean slate.

---

### 8. Testing Infrastructure

**Test files exist:**
- `supabase/tests/gate-action.sql` — pgTAP-style SQL tests for `gate_action` (ADR-0099). Covers default-allow, channel denial, min_role downgrade, disabled level, audit row insertion.
- `supabase/tests/integration-shift-lifecycle.sql` — end-to-end integration test for shift creation + derivation flow
- Test runner: psql, no external test framework required. Tests use `DO $$...END$$` blocks and `RAISE EXCEPTION` for assertions.

**CI:** `.github/workflows/pgtap.yml` registered for shift-lifecycle integration tests.

**Implication for WP2:**
- Write tests in `supabase/tests/cascade-gate-write.sql` following the existing pattern
- Cover: default-allow, framework trigger match, rule evaluation, min_role downgrade, change_proposal creation, audit row insertion, four-eyes (from gate_action)

---

## Minimum Viable Implementation Options

### Option A: Stub (Safest, Fast)
**Behavior:**
- Accept all 8 RPC parameters
- Check if entity_type is governance-gated (hardcoded list: `employment_contract`, `regulatory_framework`, `framework_rule`, `tariff_rate_table`, `protocol`, `schedule_shift`, ...)
- For gated entities: call minimal framework trigger scan, create `change_proposal` skeleton, return `{ allowed: false, outcome: 'proposed', proposal_id }`
- For non-gated entities: return `{ allowed: true, outcome: 'applied' }`
- Write audit row to `gate_evaluation`

**Pros:**
- Does not silently permit all (satisfies C4 invariant)
- Does not hard-deny everything (unblocks gate-client callers)
- Prevents call-site regressions while WP1 is being built
- Fast; no complex rule evaluation

**Cons:**
- Every write to a gated entity becomes a proposal (UX friction)
- Does not reflect actual business rules (all proposals are pending, never auto-approved)

**Time estimate:** 1–2 hours

---

### Option B: Smart Trigger Check (Recommended)
**Behavior:**
- Accept all 8 RPC parameters
- Lookup active framework via `workspace_framework_binding`
- If no active framework → return `{ allowed: true, outcome: 'applied' }`
- If framework exists:
  - Scan `framework_trigger` for `source_entity_type = p_entity_type` and `is_enabled = true`
  - If no matching trigger → return `{ allowed: true, outcome: 'applied' }`
  - If trigger matches:
    - For non-governance-gated entity types (e.g., 'schedule_shift' without rules) → return `{ allowed: true, outcome: 'applied' }`
    - For governance-gated types (e.g., 'tariff_rate_table') → create `change_proposal`, return `{ allowed: false, outcome: 'proposed', proposal_id }`
- Eval gate_action pre-flight: if role check fails → short-circuit to `blocked`
- Write audit row to `gate_evaluation`

**Pros:**
- Respects framework configuration (real businesses often have no active rules)
- Does not block non-gated writes (shift creation not blocked if no tariff rule)
- Safe default: when in doubt, propose for review
- Unblocks WP3 call-site migration
- Minimal dependency on WP1

**Cons:**
- Still generates proposals for every gated write (same UX friction as Option A if framework is active)
- Requires hardcoded list of governance-gated entity types (maintenance burden)

**Time estimate:** 2–3 hours

---

### Option C: Placeholder Evaluate Function (Defers to WP1)
**Behavior:**
- Create a stub function `evaluate_framework_rules(p_workspace_id, p_entity_type, p_action, p_proposed_data, p_current_data) → evaluation_outcome`
- This function returns `'blocked' | 'review_required' | 'approved'` based on placeholder logic
- `cascade_gate_write` calls this function and uses its return value
- Later, WP1 fills in the function body with real rule logic

**Pros:**
- Explicitly defers rule evaluation to WP1 (clear ownership)
- Easier to replace the stub later
- Allows WP1 to be swapped in without touching `cascade_gate_write`

**Cons:**
- Requires WP1 stub upfront (more setup)
- Introduces a function-call boundary (minor perf penalty)
- Still the same placeholder semantics as Options A/B in the short term

**Time estimate:** 2–3 hours

---

## Recommended Path: Option B (Smart Trigger Check)

1. **Create `public.cascade_gate_write()` RPC** with full signature from ADR-0091
2. **Implement role check** via `assert_gate_caller()` (role + workspace membership validation)
3. **Implement framework trigger scan** — lookup active framework, check entity_type in triggers
4. **Create governance-gated entity list** — manually maintained list of table names that require approval
5. **Implement change_proposal creation** — only when framework is active AND entity is gated
6. **Write gate_evaluation audit row** — always, regardless of outcome
7. **Call gate_action pre-flight** — if authority/capability check is needed (future enhancement)
8. **Return structured JSON** — `{ allowed: boolean, outcome: 'applied'|'proposed'|'blocked', proposal_id?: UUID, reason?: TEXT, exception_reason?: TEXT }`

**Build phase:** 3–4 hours
**Testing phase:** 2 hours (unit tests + integration test)
**Review + refinement:** 1–2 hours

**Total estimate:** 6–8 hours for a production-ready WP2 cut.

---

## Schema Extensions Needed

1. **gate_evaluation table** — already exists (ADR-0099)
2. **change_proposal table** — already exists (A1)
3. **framework_trigger table** — already exists (A2)
4. **No new migrations required** — all tables exist; only the RPC is new

---

## Risk & Mitigation

| Risk | Severity | Mitigation |
|------|----------|-----------|
| WP2 blocks WP3 call-site migration indefinitely | High | Ship Option B immediately; acceptable placeholder semantics |
| Framework trigger scan returns stale data | Medium | Add caching at RPC call time; invalidate on workspace config change |
| change_proposal creation without full rule context | Medium | Accept incomplete proposals in WP2; WP1 can augment proposal data later |
| call-site expects specific error codes | Medium | Document error convention in code comments; align with ADR-0091 spec |
| Performance: RPC evaluates triggers per write | Low | Triggers per workspace typically <10; scan + proposal insert is <1ms |

---

## Decision: Proceed with Option B

**Rationale:**
- Unblocks WP3 and gate-client integration
- Respects framework configuration without requiring full WP1 logic
- Maintains C4 invariant (does not silently permit all)
- Safe default semantics (when in doubt, propose for review)
- Minimal new code; reuses existing tables and patterns

**Next step:** Implementation session to write SQL + tests.
