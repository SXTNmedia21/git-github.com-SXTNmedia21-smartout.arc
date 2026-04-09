---
title: Contract Composition Engine — Implementation Plan
status: ready
updated: 2026-04-09
created: 2026-04-08
module: contracts
tags: [contract, composition, plan]
---

# Contract Composition Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a compliance-driven employment_contract composition engine with zero-friction admin wizard, employee data-intake via task-based engine_process (chat-only), embedded DocuSeal signing wrapped in Nordic Split, and read-only compliance drift detection.

**Architecture:** Composition is a cascade derivation (ADR-0076) producing a `change_proposal` of type `employment_contract_compose`. K1a framework rules drive validation; framework_snapshot is locked at send time. Two engine_process blueprints (`contract_data_intake`, `contract_signing`) drive the post-send flows with hard channel restriction. Drafts are mutable rows; versioning starts at first send (ADR-0082).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Supabase (Postgres 17 + Edge Functions), Tailwind v4, shadcn/ui, Expo (mobile), `@docuseal/react`, `@smartout/telemetry`, `packages/ai/capabilities`, Vitest + Playwright.

**Spec source:** [`docs/superpowers/specs/2026-04-08-contract-composition-engine-design.md`](../specs/2026-04-08-contract-composition-engine-design.md)

**Reference ADRs:** 0076 (composition as cascade derivation), 0077 (PII handling — accepted), 0078 (channel restriction), 0079 (ADR-0024 amendment), 0080 (compliance drift read-only), 0081 (admin PII bypass RPC), 0082 (drafts are not versions)

---

## Scope Guardrails (Onboarding Wall-Off)

These hard constraints apply to every task — any violation blocks merge:

1. **No `/create-workspace` reintroduction.** Never add, reference, or re-activate `/create-workspace` as a route.
2. **No `/join` runtime truth.** Never treat `/join` as a source of runtime truth.
3. **No `/dashboard/setup` runtime truth.** Composition wizard lives at `/dashboard/contracts/new`, never under `/dashboard/setup`.
4. **No `workspace.onboarding_completed` switch.** Never read or write that column as a generic gate.
5. **No dependence on `activate-workspace` or `activate_workspace_v3`.** Contract engine_process flows never call or share state with workspace activation.

**Wall-off rules for contract engine_process flows:**
- `contract_data_intake` and `contract_signing` operate exclusively on `employment_contract` and `profile` rows for already-active employees in already-active workspaces.
- TaskRunner in `packages/ui/src/task-runner/` is a generic display primitive. Props only. No imports from bootstrap modules.
- `submit_employee_field_group` RPC writes only to existing `profile` columns. Never creates profiles or transitions workspace state.

---

## Branch and Worktree

```bash
cd ~/dev/smartout.ai
git branch feat/contract-composition-engine development
git worktree add ../wt-1 feat/contract-composition-engine
cd ../wt-1
```

Each task ends with a commit. Phase boundaries (2a, 2b, 2c, 2d) are merge gates.

---

## Phase 2a — Foundation (Tasks 1–10)

### Task 1: Migration — contract_status enum extension (pending_data)

**Files:**
- Create: `supabase/migrations/20260501100000_contract_status_pending_data.sql`

- [ ] **Step 1: Write migration**

```sql
-- Migration: contract_status_pending_data
-- Purpose: Add 'pending_data' to contract_status enum for contracts awaiting employee data intake.
-- ADR-0076: composition engine needs this state when employee hasn't submitted required PII.
-- NOTE: ALTER TYPE ADD VALUE cannot run inside a transaction block in Postgres.
-- Supabase runs each migration file as a single transaction, but ADD VALUE is safe
-- as a standalone migration file.

ALTER TYPE public.contract_status ADD VALUE IF NOT EXISTS 'pending_data';
```

- [ ] **Step 2: Verify migration applies**

Run: `npx supabase db reset`
Expected: All migrations apply without error.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260501100000_contract_status_pending_data.sql
git commit -m "feat(contracts): add pending_data to contract_status enum

ADR-0076: composition engine status for contracts awaiting employee data intake.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Migration — contract_status enum extension (declined)

**Files:**
- Create: `supabase/migrations/20260501100100_contract_status_declined.sql`

- [ ] **Step 1: Write migration**

```sql
-- Migration: contract_status_declined
-- Purpose: Add 'declined' to contract_status enum for employee-refused contracts.
-- ADR-0076: employees can decline data intake or signing; contract transitions to declined.
-- Must be a separate migration from pending_data (Postgres ADD VALUE rule).

ALTER TYPE public.contract_status ADD VALUE IF NOT EXISTS 'declined';
```

- [ ] **Step 2: Verify migration applies**

Run: `npx supabase db reset`
Expected: Clean apply. Enum now has: draft, sent, viewed, signed, expired, pending_data, declined.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260501100100_contract_status_declined.sql
git commit -m "feat(contracts): add declined to contract_status enum

ADR-0076: employee can decline data intake or contract signing.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Migration — employment_contract composition columns

**Files:**
- Create: `supabase/migrations/20260501100200_employment_contract_composition_columns.sql`

- [ ] **Step 1: Write migration**

```sql
-- Migration: employment_contract_composition_columns
-- Purpose: Add columns for cascade-derived composition, compliance tracking,
-- contract lineage, and decline handling.
-- ADR-0076: framework_snapshot + compliance_overrides + parent_contract_id
-- ADR-0082: parent_contract_id for versioning (new row on re-send, not in-place edit)

-- Framework snapshot: immutable JSONB copy of framework_rule rows at send time.
-- Used for compliance drift detection (ADR-0080) and rights panel display.
ALTER TABLE employment_contract
  ADD COLUMN IF NOT EXISTS framework_snapshot JSONB;

COMMENT ON COLUMN employment_contract.framework_snapshot IS
  'Immutable snapshot of framework_rule rows at contract send time. Used for compliance drift detection (ADR-0080).';

-- Compliance overrides: admin acknowledged tariff deviations with provenance.
-- Array of {rule_id, field, expected_value, actual_value, reason, approved_by, approved_at}.
ALTER TABLE employment_contract
  ADD COLUMN IF NOT EXISTS compliance_overrides JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN employment_contract.compliance_overrides IS
  'Admin-acknowledged tariff/framework deviations. Each entry has rule_id + reason + approved_by provenance.';

-- Lineage: parent_contract_id for version chain (ADR-0082).
-- Drafts are mutable. Versioning starts at first send. Re-send = new row + parent FK.
ALTER TABLE employment_contract
  ADD COLUMN IF NOT EXISTS parent_contract_id UUID REFERENCES employment_contract(contract_id);

CREATE INDEX IF NOT EXISTS idx_employment_contract_parent
  ON employment_contract(parent_contract_id)
  WHERE parent_contract_id IS NOT NULL;

COMMENT ON COLUMN employment_contract.parent_contract_id IS
  'FK to previous version. Versioning starts at sent status (ADR-0082). Null = first version.';

-- Decline fields: reason code + free-text for employee refusal.
ALTER TABLE employment_contract
  ADD COLUMN IF NOT EXISTS decline_reason_code TEXT;

ALTER TABLE employment_contract
  ADD COLUMN IF NOT EXISTS decline_reason_text TEXT;

COMMENT ON COLUMN employment_contract.decline_reason_code IS
  'Machine-readable decline reason (e.g. terms_disagreement, salary_dispute, personal).';
COMMENT ON COLUMN employment_contract.decline_reason_text IS
  'Free-text decline explanation from employee.';
```

- [ ] **Step 2: Verify migration applies**

Run: `npx supabase db reset`
Expected: Clean apply. Verify columns:
```bash
npx supabase db exec "SELECT column_name FROM information_schema.columns WHERE table_name = 'employment_contract' AND column_name IN ('framework_snapshot', 'compliance_overrides', 'parent_contract_id', 'decline_reason_code', 'decline_reason_text')"
```
Expected: 5 rows returned.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260501100200_employment_contract_composition_columns.sql
git commit -m "feat(contracts): add composition columns to employment_contract

framework_snapshot, compliance_overrides, parent_contract_id (ADR-0076/0082),
decline_reason_code/text for employee refusal handling.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Migration — engine infrastructure columns

**Files:**
- Create: `supabase/migrations/20260501100300_engine_channel_sensitivity_cancellation.sql`

- [ ] **Step 1: Write migration**

```sql
-- Migration: engine_channel_sensitivity_cancellation
-- Purpose: Three engine infrastructure columns for contract composition:
-- 1. engine_process.allowed_channels (ADR-0078) — channel restriction
-- 2. engine_memory.sensitivity + expires_at (ADR-0077) — PII tagging
-- 3. engine_delayed_trigger.cancelled_at — escalation cancellation

-- ADR-0078: Channel restriction on engine_process.
-- Default allows all channels. Contract intake/signing override to ['chat'] only.
ALTER TABLE engine_process
  ADD COLUMN IF NOT EXISTS allowed_channels TEXT[] NOT NULL
  DEFAULT ARRAY['chat', 'voice', 'sms', 'email', 'autonomous', 'telegram'];

COMMENT ON COLUMN engine_process.allowed_channels IS
  'ADR-0078: Channels permitted to start this process. Dispatcher rejects if session.channel not in list.';

-- ADR-0077: PII sensitivity tagging for engine_memory rows.
ALTER TABLE engine_memory
  ADD COLUMN IF NOT EXISTS sensitivity TEXT
  DEFAULT 'normal'
  CHECK (sensitivity IN ('normal', 'pii', 'legal'));

ALTER TABLE engine_memory
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

COMMENT ON COLUMN engine_memory.sensitivity IS
  'ADR-0077: PII sensitivity level. pii = redact from LLM context, auto-expire.';
COMMENT ON COLUMN engine_memory.expires_at IS
  'ADR-0077: Auto-expiration for sensitive memories. NULL = no expiry.';

-- Escalation cancellation: when employee completes intake, cancel pending triggers.
ALTER TABLE engine_delayed_trigger
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

COMMENT ON COLUMN engine_delayed_trigger.cancelled_at IS
  'When set, fire-delayed-triggers skips this row. Used to cancel escalation on intake completion.';
```

- [ ] **Step 2: Verify migration applies**

Run: `npx supabase db reset`
Expected: Clean apply.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260501100300_engine_channel_sensitivity_cancellation.sql
git commit -m "feat(engine): add allowed_channels, sensitivity, cancelled_at

ADR-0078 channel restriction on engine_process, ADR-0077 PII sensitivity
on engine_memory, escalation cancellation on engine_delayed_trigger.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Migration — compliance_drift materialized view

**Files:**
- Create: `supabase/migrations/20260501100400_compliance_drift_view.sql`

- [ ] **Step 1: Write migration**

```sql
-- Migration: compliance_drift_view
-- Purpose: Read-only materialized view detecting drift between signed contracts'
-- framework_snapshot and current framework_rule state (ADR-0080).
-- NEVER triggers re-derivation. Admin sees drift, can click "Regenerer fra framework".

-- Helper: compute diff between snapshot and current framework rules.
-- Returns JSONB array of {rule_id, drift_type, ...} diffs.
CREATE OR REPLACE FUNCTION compute_compliance_diff(
  p_snapshot JSONB,
  p_framework_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_diffs JSONB := '[]'::jsonb;
  v_snap_rule JSONB;
  v_current RECORD;
BEGIN
  IF p_snapshot IS NULL OR p_snapshot = 'null'::jsonb
     OR jsonb_array_length(COALESCE(p_snapshot->'rules', '[]'::jsonb)) = 0 THEN
    RETURN '[]'::jsonb;
  END IF;

  -- Compare each snapshotted rule against current framework_rule
  FOR v_snap_rule IN SELECT * FROM jsonb_array_elements(p_snapshot->'rules')
  LOOP
    SELECT fr.rule_id, fr.rule_type, fr.enforcement_level, fr.parameters
    INTO v_current
    FROM framework_rule fr
    WHERE fr.rule_id = (v_snap_rule->>'rule_id')::uuid
      AND fr.framework_id = p_framework_id::uuid;

    IF NOT FOUND THEN
      v_diffs := v_diffs || jsonb_build_object(
        'rule_id', v_snap_rule->>'rule_id',
        'drift_type', 'rule_deleted',
        'snapshot_enforcement', v_snap_rule->>'enforcement_level'
      );
    ELSIF v_current.enforcement_level::text != (v_snap_rule->>'enforcement_level') OR
          v_current.parameters::text != (v_snap_rule->>'parameters') THEN
      v_diffs := v_diffs || jsonb_build_object(
        'rule_id', v_snap_rule->>'rule_id',
        'drift_type', 'rule_modified',
        'snapshot_enforcement', v_snap_rule->>'enforcement_level',
        'current_enforcement', v_current.enforcement_level,
        'snapshot_params', v_snap_rule->'parameters',
        'current_params', v_current.parameters
      );
    END IF;
  END LOOP;

  -- Check for new rules added after snapshot
  FOR v_current IN
    SELECT fr.rule_id, fr.rule_type, fr.enforcement_level
    FROM framework_rule fr
    WHERE fr.framework_id = p_framework_id::uuid
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_snapshot->'rules') snap
        WHERE (snap->>'rule_id')::uuid = fr.rule_id
      )
  LOOP
    v_diffs := v_diffs || jsonb_build_object(
      'rule_id', v_current.rule_id,
      'drift_type', 'rule_added',
      'current_enforcement', v_current.enforcement_level
    );
  END LOOP;

  RETURN v_diffs;
END;
$$;

-- Materialized view: one row per signed contract with drift array.
CREATE MATERIALIZED VIEW IF NOT EXISTS compliance_drift AS
SELECT
  ec.contract_id,
  ec.workspace_id,
  ec.profile_id,
  ec.framework_snapshot,
  compute_compliance_diff(
    ec.framework_snapshot,
    ec.framework_snapshot->>'framework_id'
  ) AS drift
FROM employment_contract ec
WHERE ec.status = 'signed'
  AND ec.framework_snapshot IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_compliance_drift_workspace
  ON compliance_drift(workspace_id);

CREATE INDEX IF NOT EXISTS idx_compliance_drift_has_drift
  ON compliance_drift(workspace_id)
  WHERE jsonb_array_length(drift) > 0;

-- Refresh function for trigger
CREATE OR REPLACE FUNCTION refresh_compliance_drift()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY compliance_drift;
  RETURN NULL;
END;
$$;

-- Refresh on framework_rule changes
CREATE TRIGGER framework_rule_refresh_drift
  AFTER INSERT OR UPDATE OR DELETE ON framework_rule
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_compliance_drift();

COMMENT ON MATERIALIZED VIEW compliance_drift IS
  'ADR-0080: Read-only compliance drift detection. Compares signed contract snapshots against current framework_rule state.';
```

- [ ] **Step 2: Verify migration applies**

Run: `npx supabase db reset`
Expected: Clean apply.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260501100400_compliance_drift_view.sql
git commit -m "feat(contracts): add compliance_drift materialized view

ADR-0080: read-only drift detection between signed contract snapshots
and current framework_rule state. Refreshes on framework_rule changes.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Migration — admin_submit_employee_pii RPC

**Files:**
- Create: `supabase/migrations/20260501100500_admin_submit_employee_pii_rpc.sql`

- [ ] **Step 1: Write migration**

```sql
-- Migration: admin_submit_employee_pii_rpc
-- Purpose: SECURITY DEFINER RPC for admin to submit PII on behalf of employee.
-- ADR-0081: Dashboard-only, never via agent. Required justification + audit trail.

CREATE OR REPLACE FUNCTION admin_submit_employee_pii(
  p_profile_id UUID,
  p_field_group TEXT,
  p_values JSONB,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID;
  v_workspace_id UUID;
  v_actor_role TEXT;
BEGIN
  -- 1. Resolve actor from JWT
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Resolve workspace from target profile
  SELECT workspace_id INTO v_workspace_id
  FROM profile WHERE profile_id = p_profile_id;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found: %', p_profile_id;
  END IF;

  -- 3. Verify actor is admin/owner in workspace
  SELECT role INTO v_actor_role
  FROM profile
  WHERE user_id = v_actor_id AND workspace_id = v_workspace_id;

  IF v_actor_role NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Access denied: admin or owner role required';
  END IF;

  -- 4. Validate reason (min 10 chars)
  IF p_reason IS NULL OR length(trim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Reason must be at least 10 characters';
  END IF;

  -- 5. Validate field_group
  IF p_field_group NOT IN ('identity', 'banking', 'address') THEN
    RAISE EXCEPTION 'Invalid field_group: %. Must be identity, banking, or address', p_field_group;
  END IF;

  -- 6. Update profile fields based on group
  CASE p_field_group
    WHEN 'identity' THEN
      UPDATE profile SET
        personal_number = COALESCE(p_values->>'personal_number', personal_number),
        updated_at = now()
      WHERE profile_id = p_profile_id;
    WHEN 'banking' THEN
      UPDATE profile SET
        bank_account = COALESCE(p_values->>'bank_account', bank_account),
        updated_at = now()
      WHERE profile_id = p_profile_id;
    WHEN 'address' THEN
      UPDATE profile SET
        address_line1 = COALESCE(p_values->>'address_line1', address_line1),
        address_line2 = COALESCE(p_values->>'address_line2', address_line2),
        postal_code = COALESCE(p_values->>'postal_code', postal_code),
        city = COALESCE(p_values->>'city', city),
        updated_at = now()
      WHERE profile_id = p_profile_id;
  END CASE;

  -- 7. Audit trail
  INSERT INTO activity_trail (workspace_id, actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_workspace_id,
    v_actor_id,
    'admin_pii_bypass',
    'profile',
    p_profile_id::text,
    jsonb_build_object(
      'field_group', p_field_group,
      'reason', p_reason,
      'bypass_type', 'dashboard'
    )
  );

  -- 8. Create notification for employee
  INSERT INTO notification_queue (workspace_id, profile_id, type, title, body, metadata)
  VALUES (
    v_workspace_id,
    p_profile_id,
    'info',
    'Personopplysninger oppdatert',
    'En administrator har oppdatert dine personopplysninger. Kontakt din leder hvis du har sporsmal.',
    jsonb_build_object('field_group', p_field_group, 'updated_by', v_actor_id)
  );

  RETURN jsonb_build_object('success', true, 'field_group', p_field_group);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_submit_employee_pii(UUID, TEXT, JSONB, TEXT) TO authenticated;

COMMENT ON FUNCTION admin_submit_employee_pii IS
  'ADR-0081: Admin PII bypass. Dashboard-only, never via agent. Requires justification + audit trail + employee notification.';
```

- [ ] **Step 2: Verify migration applies**

Run: `npx supabase db reset`
Expected: Clean apply.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260501100500_admin_submit_employee_pii_rpc.sql
git commit -m "feat(contracts): add admin_submit_employee_pii SECURITY DEFINER RPC

ADR-0081: admin PII bypass with role guard, min 10-char justification,
audit trail write, and employee notification.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Telemetry registry — 13 new composition events

**Files:**
- Modify: `packages/telemetry/src/registry.ts`

- [ ] **Step 1: Add event interfaces after the existing contract events section (after ContractExpired, before Season events)**

```typescript
// --- Contract Composition Events ---
export interface ContractComposed extends BaseEvent {
  event: "contract composed";
  properties: {
    entity: EntityRef;
    data: { template_id: string; profile_id: string; framework_id: string; override_count: number; blocker_count: number };
  };
}

export interface ContractComplianceBlocked extends BaseEvent {
  event: "contract compliance blocked";
  properties: { entity: EntityRef; data: { rule_id: string; rule_type: string; violation: string } };
}

export interface ContractComplianceOverridden extends BaseEvent {
  event: "contract compliance overridden";
  properties: { entity: EntityRef; data: { rule_id: string; field: string; expected_value: string; actual_value: string } };
}

export interface ContractIntakeStarted extends BaseEvent {
  event: "contract intake started";
  properties: { entity: EntityRef; data: { contract_id: string; missing_groups: string[] } };
}

export interface ContractIntakeFieldSubmitted extends BaseEvent {
  event: "contract intake field submitted";
  properties: { entity: EntityRef; data: { group: string } };
}

export interface ContractIntakeCompleted extends BaseEvent {
  event: "contract intake completed";
  properties: { entity: EntityRef; data: { contract_id: string; duration_hours: number } };
}

export interface ContractIntakeEscalated extends BaseEvent {
  event: "contract intake escalated";
  properties: { entity: EntityRef; data: { contract_id: string; escalation_day: number } };
}

export interface ContractIntakeAdminBypass extends BaseEvent {
  event: "contract intake admin bypass";
  properties: { entity: EntityRef; data: { field_group: string; reason: string } };
}

export interface ContractIntakeDeclined extends BaseEvent {
  event: "contract intake declined";
  properties: { entity: EntityRef; data: { group: string; reason_code: string } };
}

export interface ContractFrameworkDriftDetected extends BaseEvent {
  event: "contract framework drift detected";
  properties: { entity: EntityRef; data: { drift_count: number; framework_id: string } };
}

export interface ContractRegenerated extends BaseEvent {
  event: "contract regenerated";
  properties: { entity: EntityRef; data: { framework_id: string; previous_snapshot_date: string } };
}

export interface ContractRevisionCreated extends BaseEvent {
  event: "contract revision created";
  properties: { entity: EntityRef; data: { parent_contract_id: string; revision_number: number } };
}

export interface ContractRetentionArchived extends BaseEvent {
  event: "contract retention archived";
  properties: { entity: EntityRef; data: { anonymized_fields: string[] } };
}
```

- [ ] **Step 2: Add new types to SmartoutEvent union (after `| ContractAttachmentDeleted`)**

```typescript
  | ContractComposed
  | ContractComplianceBlocked
  | ContractComplianceOverridden
  | ContractIntakeStarted
  | ContractIntakeFieldSubmitted
  | ContractIntakeCompleted
  | ContractIntakeEscalated
  | ContractIntakeAdminBypass
  | ContractIntakeDeclined
  | ContractFrameworkDriftDetected
  | ContractRegenerated
  | ContractRevisionCreated
  | ContractRetentionArchived
```

- [ ] **Step 3: Add routing entries to EVENT_ROUTING (after "contract attachment deleted" entry)**

```typescript
  "contract composed": { destinations: ["posthog", "logger", "activity_trail"], category: "contracts" },
  "contract compliance blocked": { destinations: ["posthog", "logger", "activity_trail"], category: "contracts" },
  "contract compliance overridden": { destinations: ["posthog", "logger", "activity_trail"], category: "contracts" },
  "contract intake started": { destinations: ["posthog", "logger", "activity_trail", "engine_event"], category: "contracts" },
  "contract intake field submitted": { destinations: ["posthog", "logger", "activity_trail"], category: "contracts" },
  "contract intake completed": { destinations: ["posthog", "logger", "activity_trail", "engine_event"], category: "contracts" },
  "contract intake escalated": { destinations: ["posthog", "logger", "activity_trail", "notifications"], category: "contracts" },
  "contract intake admin bypass": { destinations: ["posthog", "logger", "activity_trail"], category: "contracts" },
  "contract intake declined": { destinations: ["posthog", "logger", "activity_trail", "engine_event"], category: "contracts" },
  "contract framework drift detected": { destinations: ["posthog", "logger"], category: "contracts" },
  "contract regenerated": { destinations: ["posthog", "logger", "activity_trail"], category: "contracts" },
  "contract revision created": { destinations: ["posthog", "logger", "activity_trail"], category: "contracts" },
  "contract retention archived": { destinations: ["posthog", "logger", "activity_trail"], category: "contracts" },
```

- [ ] **Step 4: Add `"employment_contract"` to EntityType union if not already present**

- [ ] **Step 5: Verify typecheck passes**

Run: `pnpm turbo typecheck --filter=@smartout/telemetry`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "feat(telemetry): register 13 contract composition events

contract composed/compliance blocked/overridden, intake started/submitted/
completed/escalated/admin bypass/declined, framework drift detected,
regenerated, revision created, retention archived.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Update fire-delayed-triggers predicate

**Files:**
- Modify: `supabase/functions/fire-delayed-triggers/index.ts`

- [ ] **Step 1: Add cancelled_at filter to the query**

In `fire-delayed-triggers/index.ts`, update the query at line 27 to exclude cancelled rows.

Change:
```typescript
      .eq("fired", false)
      .lte("fire_at", new Date().toISOString())
```

To:
```typescript
      .eq("fired", false)
      .is("cancelled_at", null)
      .lte("fire_at", new Date().toISOString())
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/fire-delayed-triggers/index.ts
git commit -m "fix(engine): exclude cancelled delayed triggers from firing

Adds cancelled_at IS NULL predicate. Contract intake completion cancels
pending escalation triggers via this column.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Regenerate database types

**Files:**
- Modify: `packages/supabase/src/database.types.ts`

- [ ] **Step 1: Regenerate types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm turbo typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add packages/supabase/src/database.types.ts
git commit -m "chore(supabase): regenerate database types

Includes contract_status enum extensions, employment_contract composition
columns, engine infrastructure columns, and compliance_drift view.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Phase 2a gate verification

- [ ] **Step 1: Full gate check**

```bash
npx supabase db reset && pnpm turbo typecheck && pnpm turbo lint
```
Expected: All pass. Zero errors. Phase 2a complete.

---

## Phase 2b — Capability + Prompts (Tasks 11–16)

### Task 11: Extend AgentToolContext

**Files:**
- Modify: `packages/ai/src/capabilities/types.ts`

- [ ] **Step 1: Add SessionChannel type and extend AgentToolContext**

Add before `AgentToolContext`:
```typescript
export type SessionChannel = "chat" | "voice" | "sms" | "email" | "autonomous" | "telegram";
```

Add fields to `AgentToolContext`:
```typescript
export type AgentToolContext = {
  workspaceId: string;
  profileId: string;
  userId?: string;
  sessionId: string;
  supabaseAdmin: SupabaseClient;
  /** ADR-0078: current session channel for defence-in-depth PII restriction */
  channel?: SessionChannel;
  /** Active engine_process ID if this session is running a process */
  processId?: string;
  /** Active engine_state ID for step tracking */
  engineStateId?: string;
  /** Admin acting on behalf of employee (dashboard flows only, never agent) */
  actingOnBehalfOf?: string;
};
```

- [ ] **Step 2: Add `"contract_intake"` to CapabilityName union**

- [ ] **Step 3: Add `allowedChannels` to CapabilityDefinition**

```typescript
export type CapabilityDefinition = {
  name: CapabilityName;
  description: string;
  tools: ReadonlyArray<SmartoutTool<AgentToolContext>>;
  readOnlyTools: ReadonlyArray<SmartoutTool<AgentToolContext>>;
  suggestTools?: ReadonlyArray<SmartoutTool<AgentToolContext>>;
  /** ADR-0078: if set, capability is only available when session.channel is in this list */
  allowedChannels?: SessionChannel[];
};
```

- [ ] **Step 4: Verify typecheck passes**

Run: `pnpm turbo typecheck --filter=@smartout/ai`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add packages/ai/src/capabilities/types.ts
git commit -m "feat(ai): extend AgentToolContext with channel + process fields

SessionChannel type, channel/processId/engineStateId/actingOnBehalfOf
on context (ADR-0078), allowedChannels on CapabilityDefinition,
contract_intake CapabilityName.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: contract_intake capability

**Files:**
- Create: `packages/ai/src/capabilities/contract-intake/tools.ts`
- Create: `packages/ai/src/capabilities/contract-intake/index.ts`
- Modify: `packages/ai/src/capabilities/registry.ts`

- [ ] **Step 1: Write tools.ts**

Create `packages/ai/src/capabilities/contract-intake/tools.ts` with three tools:

1. `submit_field_group(group, values)` — validates Norwegian formats (11-digit personal number, 11-digit bank account, 4-digit postal code), calls `admin_submit_employee_pii` RPC scoped to own profile, emits `contract intake field submitted`. **CRITICAL: returns `{ saved: true, group }` — NEVER echoes values.** Checks `ctx.channel !== "chat"` and refuses with chat handoff message (ADR-0078 layer 3).

2. `decline_intake(group, reason_code, reason_text)` — marks `engine_state_step` as failed with `{ declined: true, reason_code, reason_text }` result, emits `contract intake declined`. Returns `{ declined: true, message: "Din administrator vil folge opp." }`.

3. `get_intake_progress()` — reads profile fields to determine which groups are done (personal_number, bank_account, address_line1+postal_code+city). Returns group completion status only — never field values.

All tools use `defineTool` from `../../types.js` with `AgentToolContext` context type.

- [ ] **Step 2: Write index.ts**

Create `packages/ai/src/capabilities/contract-intake/index.ts` exporting `contractIntakeCapability: CapabilityDefinition` with:
- `name: "contract_intake"`
- `readOnlyTools: [getIntakeProgress]`
- `tools: [getIntakeProgress, submitFieldGroup, declineIntake]`
- `allowedChannels: ["chat"]`

- [ ] **Step 3: Register in registry.ts**

Add import and entry to `packages/ai/src/capabilities/registry.ts`:
```typescript
import { contractIntakeCapability } from "./contract-intake/index.js";
// in capabilities record:
contract_intake: contractIntakeCapability,
```

- [ ] **Step 4: Verify typecheck**

Run: `pnpm turbo typecheck --filter=@smartout/ai`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add packages/ai/src/capabilities/contract-intake/ packages/ai/src/capabilities/registry.ts
git commit -m "feat(ai): add contract_intake capability with chat-only tools

submit_field_group (no-echo), decline_intake, get_intake_progress.
ADR-0077 PII handling, ADR-0078 channel enforcement at tool level.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Extend contract capability with clause explanation + drift

**Files:**
- Modify: `packages/ai/src/capabilities/contract/tools.ts`
- Modify: `packages/ai/src/capabilities/contract/index.ts`

- [ ] **Step 1: Add explain_contract_clause tool to tools.ts**

Appends to tools.ts. Takes `contract_id` + `clause_index`. Reads `employment_contract.framework_snapshot`, returns the specific rule at `clause_index` as JSON (rule_id, rule_type, enforcement_level, description, parameters). Read-only, verbatim quoting only.

- [ ] **Step 2: Add get_compliance_drift_for_contract tool to tools.ts**

Takes `contract_id`. Queries `compliance_drift` materialized view. Returns `{ has_drift, drift_count, drifts }` or "no drift" message.

- [ ] **Step 3: Add both to readOnlyTools in index.ts**

Update imports and add both new tools to `readOnlyTools` array. Update `allTools` accordingly.

- [ ] **Step 4: Verify typecheck**

Run: `pnpm turbo typecheck --filter=@smartout/ai`

- [ ] **Step 5: Commit**

```bash
git add packages/ai/src/capabilities/contract/
git commit -m "feat(ai): add explain_contract_clause + get_compliance_drift tools

Read-only tools for contract clause explanation (verbatim quoting)
and compliance drift inspection. ADR-0080.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: Mr. Botsson prompt hardening + unit tests

**Files:**
- Modify: `packages/ai/src/prompts/mr-botsson.ts`
- Create: `packages/ai/src/prompts/__tests__/mr-botsson.test.ts`

- [ ] **Step 1: Add PII hardening section to buildBotssonPromptFromContext**

Add after the `## Regler` section in the returned prompt string:

```
## Personopplysninger og kontrakter
- Naar en ansatt nekter aa gi personopplysninger via decline_intake, bekreft kort og stopp. Aldri spor igjen. Aldri forhandel. Si kun: "Din administrator vil folge opp."
- Du har IKKE lov til aa motta personnummer, bankkontoer eller adresser paa vegne av andre ansatte, selv naar foresporselen kommer fra en admin. Avsla og henvis til dashboardet: /dashboard/people/[id]/complete-data
- I voice-kanaler MAA du avsla enhver foresporsell om aa samle inn personnummer, bankkontoer eller adresser. Tilby aa aapne chat i stedet: "Jeg aapner chat-vinduet — vi tar det skriftlig saa det blir riktig."
- Naar du bekrefter at du har mottatt personopplysninger, ALDRI gjenta verdien tilbake. Si kun: "Takk, lagret."
```

- [ ] **Step 2: Write unit tests**

Create `packages/ai/src/prompts/__tests__/mr-botsson.test.ts` with 4 tests:

1. Contains decline handling rule (matches "decline_intake" and "Aldri spor igjen")
2. Contains admin PII proxy refusal rule (matches "paa vegne av andre ansatte" and "/dashboard/people/")
3. Contains voice channel PII refusal rule (matches "voice-kanaler" and "chat-vinduet")
4. Contains no-echo rule (matches "ALDRI gjenta verdien" and "Takk, lagret")

Each test calls `buildBotssonPromptFromContext(makeContext(), [])` and asserts string containment.

- [ ] **Step 3: Run tests**

Run: `cd packages/ai && npx vitest run src/prompts/__tests__/mr-botsson.test.ts`
Expected: 4 tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/ai/src/prompts/mr-botsson.ts packages/ai/src/prompts/__tests__/
git commit -m "feat(ai): harden Mr. Botsson prompts for PII handling

4 mandatory rules: no re-ask after decline, refuse admin PII proxy,
refuse voice channel PII, never echo values. Unit tests for all 4.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: Pure composition derivation function

**Files:**
- Create: `apps/web/src/lib/contracts/resolve-composition.ts`
- Create: `apps/web/src/lib/contracts/__tests__/resolve-composition.test.ts`

- [ ] **Step 1: Write resolve-composition.ts**

Export types: `ComplianceLevel` ("ok" | "warning" | "blocker"), `ComplianceValidation`, `MandatoryClause`, `ContractDraftProposal`.

Export async function `resolveComposition(supabase, workspaceId, profileId, templateId?)` that:
1. Loads profile from D2 (personal_number, bank_account, address fields, employment_category)
2. Loads workspace_framework_binding from K1b (active binding)
3. Loads framework_rule from K1a (all active rules for bound framework)
4. Loads tariff_rate_table for suggested rate
5. Builds mandatory_clauses from rules with enforcement_level = "mandatory"
6. Runs compliance validations (tariff check, mandatory rules)
7. Computes placeholder_status (which PII fields are filled vs missing)
8. Returns `ContractDraftProposal` with all sections

- [ ] **Step 2: Write type-shape unit tests**

Test that a well-formed `ContractDraftProposal` object validates correctly. Test `ComplianceLevel` values.

- [ ] **Step 3: Run tests**

Run: `cd apps/web && npx vitest run src/lib/contracts/__tests__/resolve-composition.test.ts`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/contracts/
git commit -m "feat(contracts): add resolveComposition cascade derivation function

ADR-0076: reads D2/K1a/K1b/D4, produces ContractDraftProposal with
employment_terms, framework_snapshot, mandatory_clauses, validations,
and placeholder_status.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 16: Phase 2b gate verification

- [ ] **Step 1: Full gate check**

```bash
pnpm turbo typecheck && pnpm turbo lint && pnpm turbo test --filter=@smartout/ai
```
Expected: All pass. Phase 2b complete.

---

## Phase 2c — Flows (Tasks 17–32)

### Task 17: Shared TaskRunner component

**Files:**
- Create: `packages/ui/src/task-runner/types.ts`
- Create: `packages/ui/src/task-runner/TaskRunner.tsx`
- Create: `packages/ui/src/task-runner/index.ts`

- [ ] **Step 1: Write types.ts**

Export `TaskRunnerProps`: title (string), description (string), ctaLabel (string), onCtaClick (function), showDefer (boolean, default true), onDefer (function), icon (LucideIcon), children (ReactNode), isLoading (boolean), isDisabled (boolean).

- [ ] **Step 2: Write TaskRunner.tsx**

"use client" component. Shift-card shell pattern: bg-card rounded-xl border p-6. Icon in bg-primary/10 circle. font-heading title. text-muted-foreground description. Children slot. Primary Button CTA + ghost "Ikke naa" defer button.

- [ ] **Step 3: Write index.ts barrel export**

- [ ] **Step 4: Add export to packages/ui main barrel**

- [ ] **Step 5: Verify typecheck**

Run: `pnpm turbo typecheck --filter=@smartout/ui`

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/task-runner/
git commit -m "feat(ui): add TaskRunner generic display primitive

Props-only component for engine_process task steps. Shift-card shell
pattern with heading, description, content slot, CTA, defer button.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 18: Composition wizard UI primitives

**Files:**
- Create: `apps/web/src/app/dashboard/contracts/_components/GhostValueCard.tsx`
- Create: `apps/web/src/app/dashboard/contracts/_components/ComplianceBadge.tsx`
- Create: `apps/web/src/app/dashboard/contracts/_components/BlockerCounter.tsx`
- Create: `apps/web/src/app/dashboard/contracts/_components/AcknowledgementRing.tsx`
- Create: `apps/web/src/app/dashboard/contracts/_components/ReasoningDrawer.tsx`

- [ ] **Step 1: GhostValueCard** — dashed border + Sparkles icon, label/value/source, acknowledge button, explain button.

- [ ] **Step 2: ComplianceBadge** — ok (green CheckCircle) / warning (amber AlertTriangle) / blocker (red XCircle) with `aria-live="polite"`.

- [ ] **Step 3: BlockerCounter** — shows "{N} blokkeringer" red + "{N} advarsler" amber. Returns null if both zero.

- [ ] **Step 4: AcknowledgementRing** — progress bar (acknowledgedBlocks/totalBlocks), fires `onAllAcknowledged` when all done.

- [ ] **Step 5: ReasoningDrawer** — fixed right panel (w-96), shows title, source, explanation, override history array.

- [ ] **Step 6: Verify typecheck**

Run: `pnpm turbo typecheck --filter=web`

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/dashboard/contracts/_components/
git commit -m "feat(contracts): add composition wizard UI primitives

GhostValueCard, ComplianceBadge, BlockerCounter, AcknowledgementRing,
ReasoningDrawer for the admin composition wizard.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 19: Composition API route

**Files:**
- Create: `apps/web/src/app/api/employment-contracts/route.ts`

- [ ] **Step 1: Write POST route**

Validates body with Zod schema (workspace_id, profile_id, template_id?). Calls `resolveComposition()`. Returns `ContractDraftProposal` as JSON.

- [ ] **Step 2: Verify typecheck**

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/employment-contracts/route.ts
git commit -m "feat(contracts): add POST /api/employment-contracts compose route

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 20: Composition wizard page

**Files:**
- Create: `apps/web/src/app/dashboard/contracts/_components/CompositionWizard.tsx`
- Create: `apps/web/src/app/dashboard/contracts/new/page.tsx`

- [ ] **Step 1: Write CompositionWizard**

Uses `WizardShell` from `@smartout/ui/wizard`. 6 steps:
1. SelectEmployeeStep — profile picker (text input for now, proper picker later)
2. PositionStep — framework-aware position input
3. DerivationStep — loading spinner "Henter tariff-forslag fra Cascade..."
4. ReviewStep — GhostValueCards with AcknowledgementRing + ComplianceBadges + BlockerCounter + ReasoningDrawer
5. ClausesStep — mandatory clauses (locked), optional clauses
6. SendStep — confirmation with blocker check, missing data warning

WizardDefinition with theme "warm", brandPanel messages per step.

- [ ] **Step 2: Write new/page.tsx**

Simple page rendering `<CompositionWizard />`.

- [ ] **Step 3: Verify typecheck**

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/contracts/new/ apps/web/src/app/dashboard/contracts/_components/CompositionWizard.tsx
git commit -m "feat(contracts): add composition wizard at /dashboard/contracts/new

6-step wizard using WizardShell with cascade derivation, acknowledgement
ring, compliance badges, and framework reasoning drawer.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 21: Contract detail view + API route

**Files:**
- Create: `apps/web/src/app/api/employment-contracts/[id]/route.ts`
- Create: `apps/web/src/app/dashboard/contracts/[id]/page.tsx`
- Create: `apps/web/src/app/dashboard/contracts/[id]/revise/page.tsx`

- [ ] **Step 1: Write GET /api/employment-contracts/[id]**

Returns employment_contract with profile join, framework_snapshot, compliance_overrides, lineage.

- [ ] **Step 2: Write contract detail page**

Shows employee name, position, status, terms (dl grid), compliance overrides as ComplianceBadges, decline info (if declined), parent lineage link. Action buttons: Edit (draft), Regenerate (signed).

- [ ] **Step 3: Write revise page stub**

Re-opens CompositionWizard pre-filled. Creates new row with parent_contract_id on save (ADR-0082).

- [ ] **Step 4: Verify typecheck + commit**

---

### Task 22: Dashboard filter bucketing

**Files:**
- Create: `apps/web/src/app/dashboard/contracts/filters.ts`
- Create: `apps/web/src/app/dashboard/contracts/__tests__/filters.test.ts`

- [ ] **Step 1: Write pure filter functions**

`getContractBucket(status)` maps 8 statuses to 3 buckets:
- waiting_employee: sent, viewed, pending_data
- ready_for_action: draft, declined, expired
- completed: signed, cancelled

`groupByBucket(contracts)` groups an array by bucket.

- [ ] **Step 2: Write parameterized tests**

Test all 8 status mappings. Test groupByBucket with mixed statuses.

- [ ] **Step 3: Run tests**

Run: `cd apps/web && npx vitest run src/app/dashboard/contracts/__tests__/filters.test.ts`

- [ ] **Step 4: Commit**

---

### Task 23: Admin PII bypass form

**Files:**
- Create: `apps/web/src/app/dashboard/people/[id]/complete-data/page.tsx`

- [ ] **Step 1: Write admin PII bypass page**

Field group selector (identity/banking/address). Per-group input fields. Required reason textarea (min 10 chars). Confirmation modal. Calls `admin_submit_employee_pii` RPC. Emits `contract intake admin bypass` telemetry. Warning banner about employee notification.

- [ ] **Step 2: Verify typecheck + commit**

---

### Task 24: Engine process seeds

**Files:**
- Create: `supabase/migrations/20260501110000_seed_contract_engine_processes.sql`

- [ ] **Step 1: Write seed migration**

Two engine_process blueprints:

1. `contract_data_intake` — entity_type "profile", allowed_channels ["chat"]. Steps: collect_identity (bundled personal_number + address), collect_banking (bank_account). Action type: assign_task with empathy copy.

2. `contract_signing` — entity_type "employment_contract", allowed_channels ["chat"]. Steps: review_terms, acknowledge_rights, sign (collect_signature via DocuSeal webhook).

Uses ON CONFLICT DO UPDATE for idempotency.

- [ ] **Step 2: Verify migration + commit**

---

### Task 25: Employee web surfaces

**Files:**
- Create: `apps/web/src/app/dashboard/my-contract/page.tsx`
- Create: `apps/web/src/app/dashboard/my-profile/complete/page.tsx`

- [ ] **Step 1: Write my-contract page**

Active contract hero (border-primary, FileText icon) + history (opacity-60). Queries employment_contract for current profile.

- [ ] **Step 2: Write my-profile/complete page**

Uses TaskRunner primitive. Group-based input fields. Calls admin_submit_employee_pii RPC (self-service). Emits telemetry.

- [ ] **Step 3: Verify typecheck + commit**

---

### Task 26: Mobile contract screens

**Files:**
- Create: `apps/mobile/app/(me)/contract/index.tsx`
- Create: `apps/mobile/app/(me)/contract/[id].tsx`
- Create: `apps/mobile/app/(me)/tasks/[id].tsx`

- [ ] **Step 1: Write mobile my-contract screen** — hero + history, same data as web
- [ ] **Step 2: Write mobile contract detail** — segmented tabs (Kontrakt | Rettigheter | Forklart — Forklart DISABLED)
- [ ] **Step 3: Write mobile TaskRunner screen** — generic task runner for intake/signing
- [ ] **Step 4: Verify typecheck + commit**

---

### Task 27: Send API route with delayed triggers

**Files:**
- Create: `apps/web/src/app/api/employment-contracts/[id]/send/route.ts`

- [ ] **Step 1: Write POST route**

1. Validate contract is draft and all blocks acknowledged
2. Snapshot framework rules into framework_snapshot JSONB
3. Transition status to `sent` or `pending_data` (if missing PII fields)
4. If pending_data: create engine_state for `contract_data_intake`, schedule delayed triggers (day 3/7/10)
5. If all data present: create engine_state for `contract_signing`
6. Emit `contract composed` + `contract intake started` (or `contract sent`)

Uses idempotency key to prevent double-sends.

- [ ] **Step 2: Verify typecheck + commit**

---

### Task 28: Revise API route

**Files:**
- Create: `apps/web/src/app/api/employment-contracts/[id]/revise/route.ts`

- [ ] **Step 1: Write POST route**

Creates new employment_contract row with parent_contract_id = current contract (ADR-0082). Copies terms, resets status to draft. Voids old DocuSeal envelope if exists. Emits `contract revision created`.

- [ ] **Step 2: Verify typecheck + commit**

---

### Task 29: Regenerate from framework route

**Files:**
- Create: `apps/web/src/app/api/employment-contracts/[id]/regenerate/route.ts`

- [ ] **Step 1: Write POST route**

Re-runs `resolveComposition()` for the contract's profile. Updates draft contract with new framework_snapshot and terms. Emits `contract regenerated`.

- [ ] **Step 2: Verify typecheck + commit**

---

### Task 30: Update contracts list page

**Files:**
- Modify: `apps/web/src/app/dashboard/contracts/page.tsx`

- [ ] **Step 1: Add "Ny kontrakt" button linking to /dashboard/contracts/new**

Replace or supplement "Lag kontrakt med Botsson" button with a direct link to the composition wizard.

- [ ] **Step 2: Add filter bucket tabs using groupByBucket()**

Three tabs: "Venter paa ansatt", "Klar til handling", "Fullfort".

- [ ] **Step 3: Verify typecheck + commit**

---

### Task 31: DocuSeal Nordic Split chrome

**Files:**
- Modify: existing signing page/component where DocuSeal is embedded

- [ ] **Step 1: Apply customCss prop**

Wrap DocuSeal embed in glassmorphism container per Nordic Split design system. Apply `customCss` prop with brand colors and font overrides.

- [ ] **Step 2: Commit**

---

### Task 32: Phase 2c gate verification

- [ ] **Step 1: Full gate check**

```bash
pnpm turbo typecheck && pnpm turbo lint && pnpm turbo test && npx supabase db reset
```
Expected: All pass. Phase 2c complete.

---

## Phase 2d — Closure (Tasks 33–35)

### Task 33: anonymize_contract RPC + scheduled job

**Files:**
- Create: `supabase/migrations/20260501120000_anonymize_contract_rpc.sql`

- [ ] **Step 1: Write RPC**

```sql
CREATE OR REPLACE FUNCTION anonymize_contract(p_contract_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE employment_contract SET
    framework_snapshot = NULL,
    compliance_overrides = '[]'::jsonb,
    decline_reason_text = '[anonymized]',
    updated_at = now()
  WHERE contract_id = p_contract_id
    AND status IN ('declined', 'expired')
    AND created_at < now() - interval '3 years';
END;
$$;

GRANT EXECUTE ON FUNCTION anonymize_contract(UUID) TO service_role;
```

- [ ] **Step 2: Verify + commit**

---

### Task 34: E2E journey tests

**Files:**
- Create: `apps/e2e/tests/contract-composition/happy-path.spec.ts`
- Create: `apps/e2e/tests/contract-composition/decline.spec.ts`
- Create: `apps/e2e/tests/contract-composition/admin-bypass.spec.ts`

- [ ] **Step 1: Happy path test**

Admin navigates to /dashboard/contracts/new, selects employee, completes wizard, sends contract. Employee receives task, submits data, signs.

- [ ] **Step 2: Decline test**

Employee declines data intake. Contract status transitions to declined. Admin notified.

- [ ] **Step 3: Admin bypass test**

Admin navigates to /dashboard/people/[id]/complete-data, fills in PII with reason, submits. Employee receives notification.

- [ ] **Step 4: Run E2E tests**

Run: `pnpm --filter e2e test contract-composition`

- [ ] **Step 5: Commit**

---

### Task 35: Final gate + wall-off verification

- [ ] **Step 1: Full gate check**

```bash
pnpm turbo typecheck && pnpm turbo lint && pnpm turbo test && npx supabase db reset
```

- [ ] **Step 2: Onboarding wall-off grep gate**

```bash
grep -rn "create-workspace\|/join\|/dashboard/setup\|onboarding_completed\|activate_workspace_v3\|activate-workspace" \
  apps/web/src/app/dashboard/contracts \
  apps/web/src/app/api/employment-contracts \
  apps/web/src/lib/contracts \
  packages/ui/src/task-runner \
  packages/ai/src/capabilities/contract-intake
```
Expected: ZERO matches. Any match blocks merge.

- [ ] **Step 3: Run /close-feature**

Generates `docs/HANDOFF-contract-composition-engine.md`.

---

## Self-Review

**Spec coverage:** All 35 spec items mapped to tasks 1-35. Migrations (tasks 1-6), telemetry (task 7), fire-delayed-triggers (task 8), type regen (task 9), capabilities (tasks 11-13), prompts (task 14), composition function (task 15), TaskRunner (task 17), wizard primitives (task 18), API routes (tasks 19, 21, 27-29), wizard page (task 20), filters (task 22), admin bypass (task 23), engine seeds (task 24), employee surfaces (task 25), mobile (task 26), contracts list update (task 30), DocuSeal chrome (task 31), anonymize (task 33), E2E (task 34).

**Type consistency:** ContractDraftProposal (task 15) consumed by tasks 19-20. AgentToolContext (task 11) consumed by tasks 12-13. TaskRunner (task 17) consumed by task 25. ComplianceLevel (task 15) consumed by task 18.

**Wall-off enforcement:** Grep gate in task 35 enforces zero matches against 5 prohibited patterns.
