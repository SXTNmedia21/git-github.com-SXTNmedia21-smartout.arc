---
title: Phase 2.5 fact-check — tips-data-model Sortie 1
status: done
created: 2026-04-28
updated: 2026-04-28
module: tips-handling
tags: [tips, data-model, fact-check, phase-2.5]
---

# Phase 2.5 fact-check

## Results

| Check | Result |
|---|---|
| tip_* enum collision | NONE FOUND |
| tip_* table collision | NONE FOUND |
| workspace_setting pattern | COLUMN-PER-SETTING: each flag is its own column (payroll_workspace_settings model) |
| Workspace_setting columns (if column-per-setting) | `id` (UUID PK), `workspace_id` (FK), `default_worked_hours_salary_code`, `default_monthly_salary_code`, `period_type` (enum: monthly/biweekly/weekly), `period_start_day` (1-28), `shift_grouping` (enum: department/wage/wage_type), `employer_social_security_pct`, `vacation_pay_pct`, `pension_pct`, `created_at`, `updated_at` |
| Telemetry tip_* | NONE FOUND |
| Capabilities tips | NONE FOUND |
| gate_action helper | `packages/ai/src/capabilities/memory/gate.ts:61` with signature: `async function callGateAction(supabaseAdmin: SupabaseClient, workspaceId: string, actorProfileId: string, args: GateActionArgs): Promise<GateActionResult>` |
| nonEmpty helper | `packages/telemetry/src/non-empty-string.ts:13` with signature: `export function nonEmpty(s: string \| null \| undefined, field: string): NonEmptyString` |
| Authority-seed-parity regex | Pattern location: `scripts/authority-seed-parity.ts:1-55` (head shows ungated marker pattern). Regex marker: `@authority-gate-ungated` for dynamic/non-literal capability arguments |

## Critical implications for plan

### workspace_setting migration approach

**VERDICT: Use COLUMN-PER-SETTING pattern**

The existing `payroll_workspace_settings` table (created 2026-04-22) is COLUMN-PER-SETTING. Tippping feature must follow the same pattern: one row per workspace with individual columns for each setting (e.g., `tips_payout_enabled`, `tips_default_distribution_method`, `tips_markup_pct`). This achieves:

- 1:1 with workspace (single SELECT query)
- Type safety (individual boolean/numeric columns vs JSONB)
- Parity with payroll precedent in the codebase
- RLS applied consistently at workspace level

**Action for Task 1.7:** When creating tips workspace settings, use `CREATE TABLE tips_workspace_settings` (or `tips_settings` if shortening) with columns per flag, following the payroll migration structure at line 17-30 of `20260422110100_payroll_config_tables.sql`.

### gate.ts call signature

**RPC name:** `gate_action` (Supabase RPC via `gatedMutation()` adapter)

**TS wrapper:** `callGateAction(supabaseAdmin, workspaceId, actorProfileId, args)`

**Args shape:**
```typescript
{
  capability: string;
  channel: SessionChannel;
  actionType: string;
  approversPresent?: string[];
  entityId?: string;
}
```

**Return shape:**
```typescript
{
  allow: boolean;
  reason: string | null;
  channelAllowed: boolean;
  downgradeTo: string | null;
  minRoleRequired: string | null;
  requiresFourEyes: boolean;
  approversNeeded: number;
  approversPresent: string[];
  gateEvaluationId: string | null;
}
```

Every capability-scoped `gate.ts` is currently a thin wrapper around this shared signature (memory, journey, shift-lifecycle, contract-intake, season, availability, shift-swap). Tips should create `packages/ai/src/capabilities/tips/gate.ts` following this pattern.

### nonEmpty helper usage

**Signature:** `nonEmpty(s: string | null | undefined, field: string): NonEmptyString`

**Location:** `packages/telemetry/src/non-empty-string.ts`

**Behavior:**
- Throws in dev/test if string is null, undefined, or empty
- Returns sentinel `"__EMIT_DROPPED__"` in production (with console.warn)
- Branded type ensures compiler catches empty-string fallbacks

**For tips telemetry:** Validate `workspace_id` and `actor_id` with `nonEmpty()` before every `emit()` call, per ADR-0134 + ADR-0193.

### Authority-seed-parity scanner

**Pattern:** The script (at `scripts/authority-seed-parity.ts`) searches for:
1. Direct literal capability strings in `callGateAction()` calls
2. SQL migrations that `INSERT INTO engine_authority_config`
3. Mismatches between code call sites and seeded rows
4. Dynamic capabilities must be marked with `@authority-gate-ungated` comment

**For tips:** Any capability like `tips.set_workspace_settings` or `tips.collect_payment` that lands in code MUST have a matching seed row in the migration (typically in Task 1.5 or 1.6). The parity script will fail the PR if a new capability literal is found without a seed.

## Plan adjustments needed

1. **Task 1.3 (Enum 0a/0b/0c)** — If creating new enum (e.g. `tips_payout_type`), verify no collision with existing tip_* names. ✓ CLEAR
2. **Task 1.4 (Capability skeletons)** — Create `packages/ai/src/capabilities/tips/gate.ts` before registering capabilities. Follow memory/journey pattern.
3. **Task 1.5 (Authority seed migration)** — Use 0a/0b/0c pattern for any enums. Seed migration must have matching rows for every capability created.
4. **Task 1.7 (Workspace settings migration)** — Use COLUMN-PER-SETTING, not ROW-PER-KEY. Pattern: `payroll_workspace_settings` in `20260422110100_payroll_config_tables.sql:17-30`.
5. **Task 1.8 (Telemetry registry)** — Add `tips.*` events (e.g. `tips.payment_collected`, `tips.distribution_finalized`) with full payload schemas BEFORE code merges. Authority-seed-parity CI gate will verify.
6. **Task 2.x (Tools)** — Every tool that mutates MUST call `callGateAction()` before the first `.insert()`, `.update()`, or `.delete()`. Pattern in `packages/ai/src/capabilities/shift-lifecycle/tools.ts` or `journey/tools.ts`.

## No blockers found

- No pre-existing tip_* naming collisions ✓
- gate_action and nonEmpty helpers exist with expected signatures ✓
- workspace_setting pattern is clear (column-per-setting) ✓
- Authority-seed-parity script is live and CI-wired ✓

Proceed to Phase 1 implementation.
