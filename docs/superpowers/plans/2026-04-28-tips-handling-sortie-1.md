# Tips Handling — Sortie 1 (`tips-data-model`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the data foundation for Tips: 5 tables + RLS + 3 enums + capability skeleton + authority seed + telemetry registry + workspace tips-enabled toggle. No UI flows. No mutations. Schema + scaffolding only.

**Architecture:** Sortie 1 is the foundation sub-sortie inside `campaign/tips-handling`. It produces a working `pnpm turbo typecheck` build with all schema/RLS/capability skeleton in place but no user flows yet. Sortie 2 (leader UI) and Sortie 3 (mobile) build on top. Migrations follow the 0a/0b/0c enum-lifecycle pattern (per L-0075). Authority seeded via CROSS JOIN VALUES form (per ADR-0176, authority-seed-parity scanner). All capability tools wrap `gate_action` (per ADR-0201). Telemetry events registered before any emit (per L-0094 phantom-emit prevention).

**Tech Stack:** Supabase Postgres + RLS · TypeScript strict · Next.js App Router · TanStack Query · Zod · Vitest · pnpm + Turborepo · ADR-0132 BFF · ADR-0151 server-derived identity · ADR-0193 NonEmptyString brand

**Spec source:** `docs/superpowers/specs/2026-04-28-tips-handling-hybrid-design.md`

**Visual companion:** `docs/superpowers/specs/2026-04-28-tips-handling-mockup.html`

**Companion ADR:** `docs/decisions/0260-cabinet-grotesk-display-font.md` (proposed; out of Sortie 1 scope)

---

## Prerequisites

The `campaign/tips-handling` worktree does not yet exist. Pontus must run `/start-campaign tips-handling` from the main repo before this plan can execute, OR Phase 0 below creates it.

---

## File Structure

### Created

```
~/dev/smartout.ai-tips-handling-wt-1/             # sub-sortie worktree (Phase 0)
├── supabase/migrations/
│   ├── 20260428100000_tips_enums.sql              # Phase 1.1
│   ├── 20260428100001_tips_policy_table.sql       # Phase 1.2
│   ├── 20260428100002_tips_role_weight_table.sql  # Phase 1.3
│   ├── 20260428100003_tips_pool_table.sql         # Phase 1.4
│   ├── 20260428100004_tips_distribution_table.sql # Phase 1.5
│   ├── 20260428100005_tips_adjustment_log_table.sql # Phase 1.6
│   ├── 20260428100006_workspace_setting_tips_enabled.sql # Phase 1.7
│   └── 20260428100007_tips_authority_seed.sql     # Phase 1.8
│
├── packages/telemetry/src/registry.ts             # Phase 2 (modify)
│
├── packages/ai/src/capabilities/tips/
│   ├── index.ts                                   # Phase 3.1
│   ├── gate.ts                                    # Phase 3.2
│   ├── tools.ts                                   # Phase 3.3
│   ├── calculate.ts                               # Phase 3.4
│   └── calculate.test.ts                          # Phase 3.4
│
├── packages/ai/src/capabilities/registry.ts       # Phase 3.5 (modify)
│
├── apps/web/src/hooks/use-tips-enabled.ts         # Phase 4.1
├── apps/web/src/app/dashboard/settings/operations/tips/
│   ├── page.tsx                                   # Phase 4.3
│   └── _actions/set-tips-enabled-action.ts        # Phase 4.4
│
├── apps/mobile/src/hooks/queries/use-tips-enabled.ts # Phase 4.2
│
└── packages/supabase/src/database.types.ts        # Phase 5 (regenerated)
```

### Files responsibility

| File | Responsibility |
|---|---|
| `*_tips_enums.sql` | Defines `tip_pool_status`, `tip_distribution_status`, `tip_algorithm` enums |
| `*_tips_policy_table.sql` | `tip_policy` table + RLS dual JWT/API-key |
| `*_tips_role_weight_table.sql` | `tip_role_weight` table (FK to policy) + RLS |
| `*_tips_pool_table.sql` | `tip_pool` table + RLS |
| `*_tips_distribution_table.sql` | `tip_distribution` table + RLS (locks UPDATE when pool approved) |
| `*_tips_adjustment_log_table.sql` | `tip_adjustment_log` INSERT-only audit + RLS |
| `*_workspace_setting_tips_enabled.sql` | Adds `tips_enabled BOOLEAN DEFAULT false` |
| `*_tips_authority_seed.sql` | CROSS JOIN VALUES seed for 4 capabilities |
| `registry.ts` | Adds 4 event entries with Zod payload schemas |
| `tips/index.ts` | Capability registration + types union |
| `tips/gate.ts` | `gate_action` helper for all 4 tools |
| `tips/tools.ts` | 4 tool definitions — Sortie 1 = skeleton with `not_implemented` returns (no DB writes; bodies in Sortie 2) |
| `tips/calculate.ts` | Pure distribution algorithm (3 methods) |
| `tips/calculate.test.ts` | Unit tests for calculate() |
| `use-tips-enabled.ts` (web) | TanStack hook reading `workspace_setting.tips_enabled` |
| `use-tips-enabled.ts` (mobile) | Mobile mirror via mobile supabase-client |
| `dashboard/settings/operations/tips/page.tsx` | Single-toggle settings page (admin) |
| `_actions/set-tips-enabled-action.ts` | Admin-gated Server Action UPDATEs flag |

---

## Phase 0 — Worktree setup + Phase 2.5 fact-check

### Task 0.1: Create campaign worktree (if not exists)

**Files:** none (worktree operation)

- [ ] **Step 1: Check campaign worktree exists**

```bash
git worktree list | grep tips-handling
```

Expected: line containing `~/dev/smartout.ai-tips-handling`. If absent, proceed to Step 2.

- [ ] **Step 2: Create campaign worktree (only if Step 1 returned nothing)**

Run from `~/dev/smartout.ai`:
```bash
~/.claude/scripts/start-campaign.sh tips-handling
```

Expected: creates `~/dev/smartout.ai-tips-handling` on `campaign/tips-handling` branch based on `development`.

- [ ] **Step 3: Sync campaign with development**

```bash
cd ~/dev/smartout.ai-tips-handling
git pull origin development
```

### Task 0.2: Create sub-sortie worktree

- [ ] **Step 1: From inside campaign worktree, start sub-sortie**

```bash
cd ~/dev/smartout.ai-tips-handling
~/.claude/scripts/new-feature.sh tips-data-model 1 tips
```

Expected: creates `~/dev/smartout.ai-tips-handling-wt-1` on `feat/tips-handling-tips-data-model`, plan file copied, journey stubs created.

- [ ] **Step 2: cd into sub-sortie worktree**

```bash
cd ~/dev/smartout.ai-tips-handling-wt-1
git status
```

Expected: clean working tree, branch `feat/tips-handling-tips-data-model`.

### Task 0.3: Phase 2.5 fact-check — schema collision

**Critical** — per L-0094 phantom emit + L-0045 schema fiction prevention. Verify nothing in this plan collides with existing schema before writing migrations.

- [ ] **Step 1: Check for tip_* enum collision**

```bash
grep -rn "CREATE TYPE tip_" supabase/migrations/ | head -20
```

Expected: zero results (no pre-existing tip-related enums).

- [ ] **Step 2: Check for tip_* table collision**

```bash
grep -rn "CREATE TABLE.*tip_" supabase/migrations/ | head -20
```

Expected: zero results.

- [ ] **Step 3: Verify workspace_setting table pattern**

```bash
grep -rn "CREATE TABLE.*workspace_setting" supabase/migrations/ | head -5
grep -rn "workspace_setting" packages/supabase/src/database.types.ts | head -10
```

Expected: `workspace_setting` table exists. If not, settings live elsewhere (e.g. `workspace.settings JSONB`) — STOP and update plan to match. Note column-add pattern.

- [ ] **Step 4: Check telemetry registry has no tip_* events**

```bash
grep -n "tip_" packages/telemetry/src/registry.ts | head -10
```

Expected: zero results. (If results appear, abort and reconcile.)

- [ ] **Step 5: Check capabilities registry**

```bash
grep -n "tips" packages/ai/src/capabilities/registry.ts
```

Expected: zero results.

- [ ] **Step 6: Verify gate_action helper exists**

```bash
grep -rn "export.*function.*gate_action\|export.*const.*gate_action\|callGateAction" packages/ai/src | head -5
```

Expected: at least one match (helper exists, ADR-0201 / ADR-0099 enforced repo-wide).

- [ ] **Step 7: Verify nonEmpty helper exists for telemetry payloads**

```bash
grep -rn "export function nonEmpty\|export const nonEmpty" packages/telemetry/src | head -3
```

Expected: at least one match (ADR-0193 NonEmptyString brand helper).

- [ ] **Step 8: Verify authority-seed-parity scanner expects CROSS JOIN VALUES form**

```bash
cat scripts/authority-seed-parity.ts 2>/dev/null | head -40
```

Expected: scanner reads migrations matching CROSS JOIN VALUES pattern. Note exact regex used so seed migration matches.

- [ ] **Step 9: Commit fact-check note**

Create `docs/journeys/JOURNEY-tips-data-model-factcheck.md` with findings:

```markdown
---
title: Phase 2.5 fact-check — tips-data-model Sortie 1
status: done
created: 2026-04-28
---

# Phase 2.5 fact-check

| Check | Result |
|---|---|
| tip_* enum collision | none |
| tip_* table collision | none |
| workspace_setting pattern | <fill in: row-per-key OR JSONB OR alternative> |
| Telemetry tip_* | none |
| Capabilities tips | none |
| gate_action helper | exists at <path:line> |
| nonEmpty helper | exists at <path:line> |
| Authority-seed-parity regex | <copy from scanner> |
```

```bash
git add docs/journeys/JOURNEY-tips-data-model-factcheck.md
git commit -m "chore(tips): Phase 2.5 fact-check — no collisions found"
```

---

## Phase 1 — Database migrations

### Task 1.1: tip_pool_status + tip_distribution_status + tip_algorithm enums

**Files:**
- Create: `supabase/migrations/20260428100000_tips_enums.sql`

- [ ] **Step 1: Write migration**

```sql
-- 20260428100000_tips_enums.sql
-- Tips campaign Sortie 1 — three new enums.

CREATE TYPE tip_pool_status AS ENUM (
  'recorded',
  'approved',
  'paid',
  'voided'
);

CREATE TYPE tip_distribution_status AS ENUM (
  'calculated',
  'approved',
  'paid'
);

CREATE TYPE tip_algorithm AS ENUM (
  'equal',
  'by_hours',
  'by_role'
);

COMMENT ON TYPE tip_pool_status IS 'Tip pool lifecycle: recorded → approved → paid (paid set by future payroll-campaign). voided = leader confirmed no tips that evening.';
COMMENT ON TYPE tip_distribution_status IS 'Per-employee distribution status. paid set by future payroll-campaign.';
COMMENT ON TYPE tip_algorithm IS 'How a pool is split: equal share, by hours worked, or weighted by role.';
```

- [ ] **Step 2: Run migration locally**

```bash
npx supabase db reset
```

Expected: all migrations including new one apply cleanly. No "type already exists" errors.

- [ ] **Step 3: Verify enums in database**

```bash
npx supabase db remote ssh --command "SELECT enumlabel FROM pg_enum WHERE enumtypid = 'tip_pool_status'::regtype ORDER BY enumsortorder;"
```

Expected output: `recorded`, `approved`, `paid`, `voided`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260428100000_tips_enums.sql
git commit -m "feat(tips): add tip_pool_status, tip_distribution_status, tip_algorithm enums"
```

### Task 1.2: tip_policy table

**Files:**
- Create: `supabase/migrations/20260428100001_tips_policy_table.sql`

- [ ] **Step 1: Write migration**

```sql
-- 20260428100001_tips_policy_table.sql
-- tip_policy: per-department, versioned via active_from/to.

CREATE TABLE tip_policy (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  department_id   UUID NOT NULL REFERENCES department(department_id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  method          tip_algorithm NOT NULL,
  active_from     DATE NOT NULL,
  active_to       DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID NOT NULL REFERENCES profile(profile_id),
  CHECK (active_to IS NULL OR active_to >= active_from)
);

CREATE INDEX idx_tip_policy_active
  ON tip_policy (department_id, active_from DESC)
  WHERE active_to IS NULL;

CREATE INDEX idx_tip_policy_workspace
  ON tip_policy (workspace_id);

ALTER TABLE tip_policy ENABLE ROW LEVEL SECURITY;

-- JWT: leader reads policies in their department(s)
CREATE POLICY tip_policy_jwt_leader_read ON tip_policy FOR SELECT
  USING (
    department_id IN (
      SELECT department_id FROM department
      WHERE workspace_id = (auth.jwt() ->> 'workspace_id')::uuid
    )
  );

-- JWT: admin inserts/updates
CREATE POLICY tip_policy_jwt_admin_write ON tip_policy FOR ALL
  USING (
    workspace_id = (auth.jwt() ->> 'workspace_id')::uuid
    AND is_admin_in_workspace((auth.jwt() ->> 'workspace_id')::uuid)
  )
  WITH CHECK (
    workspace_id = (auth.jwt() ->> 'workspace_id')::uuid
    AND is_admin_in_workspace((auth.jwt() ->> 'workspace_id')::uuid)
  );

-- API key: workspace-scoped
CREATE POLICY tip_policy_api_key ON tip_policy FOR ALL
  TO authenticated
  USING (workspace_id = current_setting('request.jwt.claim.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('request.jwt.claim.workspace_id', true)::uuid);

-- Updated_at trigger (assumes existing helper from supabase/templates/restau...)
CREATE TRIGGER set_tip_policy_updated_at
  BEFORE UPDATE ON tip_policy
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

COMMENT ON TABLE tip_policy IS 'Per-department, versioned tip distribution policy. active_to NULL = active. New policy = INSERT new row + UPDATE old row active_to atomically.';
```

- [ ] **Step 2: Verify `is_admin_in_workspace` and `trigger_set_updated_at` exist**

```bash
grep -rn "is_admin_in_workspace\|trigger_set_updated_at" supabase/migrations/ | head -3
```

Expected: at least one match each. If missing, replace with workspace-scoped patterns from existing migrations.

- [ ] **Step 3: Run db reset**

```bash
npx supabase db reset
```

Expected: clean apply, no errors.

- [ ] **Step 4: Test RLS — admin can insert**

```bash
npx supabase db remote ssh --command "SET ROLE authenticated; SELECT current_setting('request.jwt.claim.workspace_id', true);"
```

(Manual sanity check; full RLS testing in Sortie 4 E2E.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260428100001_tips_policy_table.sql
git commit -m "feat(tips): add tip_policy table with versioning + RLS dual JWT/API-key"
```

### Task 1.3: tip_role_weight table

**Files:**
- Create: `supabase/migrations/20260428100002_tips_role_weight_table.sql`

- [ ] **Step 1: Write migration**

```sql
-- 20260428100002_tips_role_weight_table.sql
-- tip_role_weight: role → weight mapping for by_role policies.

CREATE TABLE tip_role_weight (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id   UUID NOT NULL REFERENCES tip_policy(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,
  weight      NUMERIC(4,2) NOT NULL CHECK (weight >= 0 AND weight <= 10),
  UNIQUE (policy_id, role)
);

CREATE INDEX idx_tip_role_weight_policy ON tip_role_weight (policy_id);

ALTER TABLE tip_role_weight ENABLE ROW LEVEL SECURITY;

-- JWT: read via parent policy
CREATE POLICY tip_role_weight_jwt_read ON tip_role_weight FOR SELECT
  USING (
    policy_id IN (
      SELECT id FROM tip_policy
      WHERE department_id IN (
        SELECT department_id FROM department
        WHERE workspace_id = (auth.jwt() ->> 'workspace_id')::uuid
      )
    )
  );

-- JWT: admin write via parent policy
CREATE POLICY tip_role_weight_jwt_admin_write ON tip_role_weight FOR ALL
  USING (
    policy_id IN (
      SELECT id FROM tip_policy
      WHERE workspace_id = (auth.jwt() ->> 'workspace_id')::uuid
      AND is_admin_in_workspace((auth.jwt() ->> 'workspace_id')::uuid)
    )
  );

-- API key: workspace-scoped via parent policy
CREATE POLICY tip_role_weight_api_key ON tip_role_weight FOR ALL
  TO authenticated
  USING (
    policy_id IN (
      SELECT id FROM tip_policy
      WHERE workspace_id = current_setting('request.jwt.claim.workspace_id', true)::uuid
    )
  );

COMMENT ON TABLE tip_role_weight IS 'Role-weight mapping. Only relevant when tip_policy.method = by_role.';
```

- [ ] **Step 2: Run db reset**

```bash
npx supabase db reset
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260428100002_tips_role_weight_table.sql
git commit -m "feat(tips): add tip_role_weight table for by_role algorithm"
```

### Task 1.4: tip_pool table

**Files:**
- Create: `supabase/migrations/20260428100003_tips_pool_table.sql`

- [ ] **Step 1: Write migration**

```sql
-- 20260428100003_tips_pool_table.sql
-- tip_pool: one pool per department_session (kveldsgrense, not kalenderdag).

CREATE TABLE tip_pool (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id                    UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  department_session_id           UUID NOT NULL REFERENCES department_session(session_id) ON DELETE CASCADE,
  policy_id                       UUID NOT NULL REFERENCES tip_policy(id),
  amount_nok                      NUMERIC(10,2) NOT NULL CHECK (amount_nok >= 0),
  currency                        TEXT NOT NULL DEFAULT 'NOK',
  status                          tip_pool_status NOT NULL DEFAULT 'recorded',
  recorded_by                     UUID NOT NULL REFERENCES profile(profile_id),
  recorded_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by                     UUID REFERENCES profile(profile_id),
  approved_at                     TIMESTAMPTZ,
  algorithm_version_at_approval   TEXT,
  notes                           TEXT,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (department_session_id),
  CHECK (
    (status = 'approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
    OR (status != 'approved' AND approved_by IS NULL AND approved_at IS NULL)
  )
);

CREATE INDEX idx_tip_pool_session ON tip_pool (department_session_id);
CREATE INDEX idx_tip_pool_workspace_status ON tip_pool (workspace_id, status) WHERE status != 'paid';

ALTER TABLE tip_pool ENABLE ROW LEVEL SECURITY;

-- JWT: leader reads pools for sessions in their departments
CREATE POLICY tip_pool_jwt_leader_read ON tip_pool FOR SELECT
  USING (
    department_session_id IN (
      SELECT session_id FROM department_session ds
      WHERE ds.workspace_id = (auth.jwt() ->> 'workspace_id')::uuid
    )
  );

-- JWT: leader writes — locked when status=approved
CREATE POLICY tip_pool_jwt_leader_insert ON tip_pool FOR INSERT
  WITH CHECK (
    workspace_id = (auth.jwt() ->> 'workspace_id')::uuid
    AND department_session_id IN (
      SELECT session_id FROM department_session
      WHERE workspace_id = (auth.jwt() ->> 'workspace_id')::uuid
    )
  );

CREATE POLICY tip_pool_jwt_leader_update ON tip_pool FOR UPDATE
  USING (
    workspace_id = (auth.jwt() ->> 'workspace_id')::uuid
    AND status != 'approved'
  )
  WITH CHECK (
    workspace_id = (auth.jwt() ->> 'workspace_id')::uuid
  );

-- Employee read: own pool when approved
CREATE POLICY tip_pool_jwt_employee_read ON tip_pool FOR SELECT
  USING (
    status = 'approved'
    AND id IN (
      SELECT pool_id FROM tip_distribution
      WHERE profile_id IN (
        SELECT profile_id FROM profile WHERE user_id = auth.uid()
      )
    )
  );

-- API key: workspace-scoped full access
CREATE POLICY tip_pool_api_key ON tip_pool FOR ALL
  TO authenticated
  USING (workspace_id = current_setting('request.jwt.claim.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('request.jwt.claim.workspace_id', true)::uuid);

CREATE TRIGGER set_tip_pool_updated_at
  BEFORE UPDATE ON tip_pool
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

COMMENT ON TABLE tip_pool IS 'One pool per department_session. UNIQUE on session_id enforces kveldsgrense (not kalenderdag). approved → distributions locked.';
```

- [ ] **Step 2: Run db reset**

```bash
npx supabase db reset
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260428100003_tips_pool_table.sql
git commit -m "feat(tips): add tip_pool table with session_id uniqueness + RLS lifecycle locks"
```

### Task 1.5: tip_distribution table

**Files:**
- Create: `supabase/migrations/20260428100004_tips_distribution_table.sql`

- [ ] **Step 1: Write migration**

```sql
-- 20260428100004_tips_distribution_table.sql
-- tip_distribution: per-employee share. Locked once parent pool approved.

CREATE TABLE tip_distribution (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  pool_id             UUID NOT NULL REFERENCES tip_pool(id) ON DELETE CASCADE,
  profile_id          UUID NOT NULL REFERENCES profile(profile_id),
  shift_id            UUID REFERENCES schedule_shift(shift_id),
  role                TEXT NOT NULL,
  hours_worked        NUMERIC(5,2) NOT NULL CHECK (hours_worked >= 0),
  weight_applied      NUMERIC(4,2) NOT NULL CHECK (weight_applied >= 0),
  algorithm_snapshot  JSONB NOT NULL,
  calculated_amount   NUMERIC(10,2) NOT NULL CHECK (calculated_amount >= 0),
  adjusted_amount     NUMERIC(10,2) CHECK (adjusted_amount IS NULL OR adjusted_amount >= 0),
  adjustment_reason   TEXT CHECK (adjustment_reason IS NULL OR length(adjustment_reason) >= 5),
  payroll_period_id   UUID,
  paid_at             TIMESTAMPTZ,
  status              tip_distribution_status NOT NULL DEFAULT 'calculated',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pool_id, profile_id),
  CHECK ((adjusted_amount IS NULL) = (adjustment_reason IS NULL)),
  CHECK ((paid_at IS NOT NULL) = (status = 'paid'))
);

CREATE INDEX idx_tip_distribution_pool ON tip_distribution (pool_id);
CREATE INDEX idx_tip_distribution_profile ON tip_distribution (profile_id, status);
CREATE INDEX idx_tip_distribution_payroll ON tip_distribution (payroll_period_id) WHERE payroll_period_id IS NOT NULL;

ALTER TABLE tip_distribution ENABLE ROW LEVEL SECURITY;

-- JWT: leader reads via pool's session
CREATE POLICY tip_distribution_jwt_leader_read ON tip_distribution FOR SELECT
  USING (
    pool_id IN (
      SELECT id FROM tip_pool
      WHERE workspace_id = (auth.jwt() ->> 'workspace_id')::uuid
    )
  );

-- JWT: employee reads own (approved or paid only)
CREATE POLICY tip_distribution_jwt_employee_read ON tip_distribution FOR SELECT
  USING (
    profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
    AND status IN ('approved', 'paid')
  );

-- JWT: leader inserts (capability-gated; RLS as defense)
CREATE POLICY tip_distribution_jwt_leader_insert ON tip_distribution FOR INSERT
  WITH CHECK (
    workspace_id = (auth.jwt() ->> 'workspace_id')::uuid
  );

-- JWT: leader updates only when parent pool not approved
CREATE POLICY tip_distribution_jwt_leader_update ON tip_distribution FOR UPDATE
  USING (
    workspace_id = (auth.jwt() ->> 'workspace_id')::uuid
    AND pool_id IN (SELECT id FROM tip_pool WHERE status != 'approved')
  )
  WITH CHECK (
    workspace_id = (auth.jwt() ->> 'workspace_id')::uuid
  );

-- API key: workspace-scoped
CREATE POLICY tip_distribution_api_key ON tip_distribution FOR ALL
  TO authenticated
  USING (workspace_id = current_setting('request.jwt.claim.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('request.jwt.claim.workspace_id', true)::uuid);

CREATE TRIGGER set_tip_distribution_updated_at
  BEFORE UPDATE ON tip_distribution
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

COMMENT ON TABLE tip_distribution IS 'Per-employee share of a pool. RLS UPDATE locks once parent pool.status=approved. payroll_period_id + paid_at populated by future payroll-campaign.';
```

- [ ] **Step 2: Run db reset**

```bash
npx supabase db reset
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260428100004_tips_distribution_table.sql
git commit -m "feat(tips): add tip_distribution table with employee read + post-approve UPDATE lock"
```

### Task 1.6: tip_adjustment_log table

**Files:**
- Create: `supabase/migrations/20260428100005_tips_adjustment_log_table.sql`

- [ ] **Step 1: Write migration**

```sql
-- 20260428100005_tips_adjustment_log_table.sql
-- tip_adjustment_log: INSERT-only audit. Visible to affected employee.

CREATE TABLE tip_adjustment_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  distribution_id   UUID NOT NULL REFERENCES tip_distribution(id) ON DELETE CASCADE,
  changed_by        UUID NOT NULL REFERENCES profile(profile_id),
  changed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  old_amount        NUMERIC(10,2),
  new_amount        NUMERIC(10,2) NOT NULL CHECK (new_amount >= 0),
  reason            TEXT NOT NULL CHECK (length(reason) >= 5)
);

CREATE INDEX idx_tip_adjustment_log_dist ON tip_adjustment_log (distribution_id, changed_at DESC);

ALTER TABLE tip_adjustment_log ENABLE ROW LEVEL SECURITY;

-- JWT: leader reads in workspace
CREATE POLICY tip_adjustment_log_jwt_leader_read ON tip_adjustment_log FOR SELECT
  USING (workspace_id = (auth.jwt() ->> 'workspace_id')::uuid);

-- JWT: employee reads own
CREATE POLICY tip_adjustment_log_jwt_employee_read ON tip_adjustment_log FOR SELECT
  USING (
    distribution_id IN (
      SELECT id FROM tip_distribution
      WHERE profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
    )
  );

-- JWT: leader inserts (capability-gated)
CREATE POLICY tip_adjustment_log_jwt_leader_insert ON tip_adjustment_log FOR INSERT
  WITH CHECK (
    workspace_id = (auth.jwt() ->> 'workspace_id')::uuid
    AND changed_by IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
  );

-- INSERT-only: no UPDATE/DELETE policies (deny by default)

-- API key: workspace-scoped read
CREATE POLICY tip_adjustment_log_api_key_read ON tip_adjustment_log FOR SELECT
  TO authenticated
  USING (workspace_id = current_setting('request.jwt.claim.workspace_id', true)::uuid);

COMMENT ON TABLE tip_adjustment_log IS 'INSERT-only audit log of tip distribution adjustments. Employee can read own.';
```

- [ ] **Step 2: Run db reset**

```bash
npx supabase db reset
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260428100005_tips_adjustment_log_table.sql
git commit -m "feat(tips): add tip_adjustment_log INSERT-only audit table"
```

### Task 1.7: workspace_setting.tips_enabled column

**Files:**
- Create: `supabase/migrations/20260428100006_workspace_setting_tips_enabled.sql`

> **Note:** This migration assumes Phase 0 fact-check confirmed `workspace_setting` is the canonical row-per-key table. If alternative pattern (e.g., `workspace.settings JSONB`), adjust to match. Pattern guess provided.

- [ ] **Step 1: Write migration (workspace_setting row-per-key pattern)**

If `workspace_setting` is row-keyed (one column per setting):

```sql
-- 20260428100006_workspace_setting_tips_enabled.sql
ALTER TABLE workspace_setting
  ADD COLUMN IF NOT EXISTS tips_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN workspace_setting.tips_enabled IS 'Master toggle for Tips module. false (default) = Tips UI hidden everywhere.';
```

If `workspace_setting` is k/v-keyed (one row per setting), use this instead:

```sql
-- 20260428100006_workspace_setting_tips_enabled.sql
-- Insert default row for every existing workspace.
INSERT INTO workspace_setting (workspace_id, setting_key, setting_value)
SELECT workspace_id, 'tips_enabled', 'false'
FROM workspace
ON CONFLICT (workspace_id, setting_key) DO NOTHING;
```

- [ ] **Step 2: Run db reset**

```bash
npx supabase db reset
```

- [ ] **Step 3: Verify column/row exists**

```bash
npx supabase db remote ssh --command "SELECT column_name FROM information_schema.columns WHERE table_name = 'workspace_setting';"
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260428100006_workspace_setting_tips_enabled.sql
git commit -m "feat(tips): add workspace_setting.tips_enabled flag (default false, opt-in)"
```

### Task 1.8: Authority seed migration (CROSS JOIN VALUES)

**Files:**
- Create: `supabase/migrations/20260428100007_tips_authority_seed.sql`

- [ ] **Step 1: Write migration**

```sql
-- 20260428100007_tips_authority_seed.sql
-- Seed engine_authority_config rows for 4 tips capabilities.
-- CROSS JOIN VALUES form required by scripts/authority-seed-parity.ts.

INSERT INTO engine_authority_config (
  workspace_id,
  capability_key,
  default_authority,
  description,
  created_at,
  updated_at
)
SELECT
  w.workspace_id,
  t.capability_key,
  t.default_authority::authority_level,
  t.description,
  now(),
  now()
FROM workspace w
CROSS JOIN (VALUES
  ('tips.set_pot',              'suggest',     'Register tip pool amount + calculate distribution'),
  ('tips.adjust_share',         'confirm',     'Manually adjust an employee tip share with reason'),
  ('tips.approve_distribution', 'confirm',     'Lock pool and trigger approval-time side-effects'),
  ('tips.query_own_share',      'read_only',   'Employee read-only of own tip shares')
) AS t(capability_key, default_authority, description)
ON CONFLICT (workspace_id, capability_key) DO NOTHING;
```

- [ ] **Step 2: Verify scanner accepts the form**

```bash
pnpm tsx scripts/authority-seed-parity.ts 2>&1 | tail -20
```

Expected: scanner runs, no errors. If it complains about form mismatch, adjust SQL until parity.

- [ ] **Step 3: Run db reset and confirm rows seeded**

```bash
npx supabase db reset
npx supabase db remote ssh --command "SELECT capability_key, default_authority FROM engine_authority_config WHERE capability_key LIKE 'tips.%' ORDER BY capability_key;"
```

Expected output:
```
tips.adjust_share         | confirm
tips.approve_distribution | confirm
tips.query_own_share      | read_only
tips.set_pot              | suggest
```

(Times N workspaces in seed.sql.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260428100007_tips_authority_seed.sql
git commit -m "feat(tips): seed engine_authority_config for 4 tips capabilities (CROSS JOIN VALUES)"
```

---

## Phase 2 — Telemetry registry

### Task 2.1: Add 4 tips events to registry

**Files:**
- Modify: `packages/telemetry/src/registry.ts`

- [ ] **Step 1: Read current registry shape**

```bash
head -80 packages/telemetry/src/registry.ts
```

Note: existing TRIGGER_EXEMPT pattern for trigger-emitted events, exact entry-shape, Zod schema convention.

- [ ] **Step 2: Find where to insert new events**

```bash
grep -n "// === " packages/telemetry/src/registry.ts | head -10
```

Identify a good section (e.g., end of file, or under a "// === payroll/tips ===" comment-divider — add the divider if absent).

- [ ] **Step 3: Add 4 entries to the registry array**

Add at appropriate location (e.g., before the closing `]`):

```typescript
// === tips (per spec 2026-04-28-tips-handling-hybrid-design §7) ===
{
  event: "tip_pool created",
  destinations: ["posthog", "logger", "activity_trail", "engine_event"] as const,
  payloadSchema: z.object({
    pool_id: z.string().uuid(),
    department_session_id: z.string().uuid(),
    amount_nok: z.number(),
    distribution_count: z.number().int(),
    algorithm: z.enum(["equal", "by_hours", "by_role"]),
  }),
},
{
  event: "tip_distribution calculated",
  destinations: ["logger", "engine_event"] as const,
  payloadSchema: z.object({
    pool_id: z.string().uuid(),
    distribution_id: z.string().uuid(),
    profile_id: z.string().uuid(),
    calculated_amount: z.number(),
    weight_applied: z.number(),
  }),
},
{
  event: "tip_distribution adjusted",
  destinations: ["posthog", "logger", "activity_trail", "engine_event"] as const,
  payloadSchema: z.object({
    distribution_id: z.string().uuid(),
    pool_id: z.string().uuid(),
    profile_id: z.string().uuid(),
    old_amount: z.number().nullable(),
    new_amount: z.number(),
    reason: z.string().min(5),
  }),
},
{
  event: "tip_pool approved",
  destinations: ["posthog", "logger", "activity_trail", "engine_event"] as const,
  payloadSchema: z.object({
    pool_id: z.string().uuid(),
    department_session_id: z.string().uuid(),
    total_distributed: z.number(),
    distribution_count: z.number().int(),
    adjustment_count: z.number().int(),
  }),
},
```

- [ ] **Step 4: Verify via grep**

```bash
grep -n "tip_pool\|tip_distribution" packages/telemetry/src/registry.ts | head
```

Expected: all 4 events listed.

- [ ] **Step 5: Run typecheck**

```bash
pnpm turbo typecheck --filter=@smartout/telemetry
```

Expected: 0 errors.

- [ ] **Step 6: Run parity test (if exists)**

```bash
pnpm test packages/telemetry 2>&1 | tail -15
```

Expected: pass (or skip if no test).

- [ ] **Step 7: Commit**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "feat(telemetry): register 4 tips events (created/calculated/adjusted/approved)"
```

---

## Phase 3 — Capability skeleton

### Task 3.1: tips/index.ts — capability registration

**Files:**
- Create: `packages/ai/src/capabilities/tips/index.ts`

- [ ] **Step 1: Read pattern from an existing capability**

```bash
cat packages/ai/src/capabilities/availability/index.ts 2>/dev/null || cat packages/ai/src/capabilities/shift-swap/index.ts
```

Note: capability-name shape, type union, exports.

- [ ] **Step 2: Write tips/index.ts**

```typescript
// packages/ai/src/capabilities/tips/index.ts
import type { CapabilityDefinition } from "../types";
import {
  tipsSetPotTool,
  tipsAdjustShareTool,
  tipsApproveDistributionTool,
  tipsQueryOwnShareTool,
} from "./tools";

export const TIPS_CAPABILITY_KEYS = [
  "tips.set_pot",
  "tips.adjust_share",
  "tips.approve_distribution",
  "tips.query_own_share",
] as const;

export type TipsCapabilityKey = (typeof TIPS_CAPABILITY_KEYS)[number];

export const tipsCapability: CapabilityDefinition = {
  domain: "payroll", // ADR-0163 — chat-only voice policy
  capabilities: TIPS_CAPABILITY_KEYS,
  tools: [
    tipsSetPotTool,
    tipsAdjustShareTool,
    tipsApproveDistributionTool,
    tipsQueryOwnShareTool,
  ],
  allowedChannels: ["chat"], // ADR-0078 — PII-near, no voice
};

export { calculate } from "./calculate";
export type { Distribution, Policy } from "./calculate";
```

- [ ] **Step 3: Typecheck**

```bash
pnpm turbo typecheck --filter=@smartout/ai 2>&1 | tail -10
```

Expected: errors about missing tools.ts / calculate.ts (resolved in next tasks).

- [ ] **Step 4: Commit (deferred to end of Phase 3)**

(Hold commit until tools + calculate land — single coherent commit.)

### Task 3.2: tips/gate.ts — gate_action helper

**Files:**
- Create: `packages/ai/src/capabilities/tips/gate.ts`

- [ ] **Step 1: Read gate pattern from sibling**

```bash
cat packages/ai/src/capabilities/availability/gate.ts 2>/dev/null || cat packages/ai/src/capabilities/shift-swap/gate.ts
```

- [ ] **Step 2: Write tips/gate.ts**

```typescript
// packages/ai/src/capabilities/tips/gate.ts
// gate_action wrapper for all tips mutation tools (per ADR-0201).
// Fail-CLOSED on RPC error.

import type { ToolContext } from "../types";
import type { TipsCapabilityKey } from "./index";

export async function callTipsGate(
  ctx: ToolContext,
  capability: TipsCapabilityKey,
  reason: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await ctx.supabase.rpc("gate_action", {
    p_workspace_id: ctx.workspace_id,
    p_actor_id: ctx.actor_id,
    p_capability_key: capability,
    p_reason: reason,
  });

  if (error) {
    // Fail-CLOSED — never permit on RPC error
    return { ok: false, error: `gate_rpc_error:${error.code ?? "unknown"}` };
  }

  if (!data || data.outcome !== "permitted") {
    return { ok: false, error: `gate_denied:${data?.outcome ?? "unknown"}` };
  }

  return { ok: true };
}
```

- [ ] **Step 3: Typecheck (will still error on tools.ts; that's fine)**

### Task 3.3: tips/tools.ts — 4 tool definitions (skeletons)

**Files:**
- Create: `packages/ai/src/capabilities/tips/tools.ts`

> **Sortie 1 scope:** tools register and validate input but return `not_implemented` (per ADR-0196 Invariant 11 / phantom-emit prevention). Bodies land in Sortie 2. Skeleton must NOT emit `*_started` events (no DB write = no started event).

- [ ] **Step 1: Read tool-definition pattern**

```bash
head -80 packages/ai/src/capabilities/availability/tools.ts 2>/dev/null
```

- [ ] **Step 2: Write tips/tools.ts**

```typescript
// packages/ai/src/capabilities/tips/tools.ts
// Sortie 1 — skeleton tool definitions. Bodies = not_implemented.
// Per ADR-0196: must NOT emit *_started without writing the artefact.
// Sortie 2 fills in execute() bodies.

import { z } from "zod";
import type { ToolDefinition, ToolContext } from "../types";

// === tips.set_pot ===
export const tipsSetPotTool: ToolDefinition = {
  name: "tips.set_pot",
  description: "Register tip pool amount for a department session and calculate distribution.",
  schema: z.object({
    department_session_id: z.string().uuid(),
    amount_nok: z.number().min(0),
    notes: z.string().optional(),
  }),
  async execute(input, ctx: ToolContext) {
    return {
      ok: false as const,
      error: "not_implemented",
      note: "Skeleton — body lands in Sortie 2 tips-leader-flows",
    };
  },
};

// === tips.adjust_share ===
export const tipsAdjustShareTool: ToolDefinition = {
  name: "tips.adjust_share",
  description: "Adjust a single tip distribution amount with required reason.",
  schema: z.object({
    distribution_id: z.string().uuid(),
    new_amount: z.number().min(0),
    reason: z.string().min(5),
  }),
  async execute(input, ctx: ToolContext) {
    return {
      ok: false as const,
      error: "not_implemented",
      note: "Skeleton — body lands in Sortie 2 tips-leader-flows",
    };
  },
};

// === tips.approve_distribution ===
export const tipsApproveDistributionTool: ToolDefinition = {
  name: "tips.approve_distribution",
  description: "Approve a tip pool, locking distributions.",
  schema: z.object({
    pool_id: z.string().uuid(),
  }),
  async execute(input, ctx: ToolContext) {
    return {
      ok: false as const,
      error: "not_implemented",
      note: "Skeleton — body lands in Sortie 2 tips-leader-flows",
    };
  },
};

// === tips.query_own_share ===
export const tipsQueryOwnShareTool: ToolDefinition = {
  name: "tips.query_own_share",
  description: "Read own tip distributions for a date range.",
  schema: z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  async execute(input, ctx: ToolContext) {
    return {
      ok: false as const,
      error: "not_implemented",
      note: "Skeleton — body lands in Sortie 3 tips-employee-mobile",
    };
  },
};
```

- [ ] **Step 3: Typecheck**

```bash
pnpm turbo typecheck --filter=@smartout/ai 2>&1 | tail -10
```

Expected: errors only about `calculate.ts` import in `index.ts` (resolved next).

### Task 3.4: tips/calculate.ts + calculate.test.ts — pure function + unit tests (TDD)

**Files:**
- Create: `packages/ai/src/capabilities/tips/calculate.test.ts` (FIRST — TDD)
- Create: `packages/ai/src/capabilities/tips/calculate.ts`

- [ ] **Step 1: Write the failing tests FIRST**

`packages/ai/src/capabilities/tips/calculate.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { calculate, type Policy } from "./calculate";

describe("calculate", () => {
  it("returns empty array when no shifts", () => {
    expect(calculate(1000, [], { method: "equal" })).toEqual([]);
  });

  it("equal split — 4 employees, 1000 kr each gets 250", () => {
    const result = calculate(1000, [
      { profile_id: "a", role: "x", hours_worked: 4 },
      { profile_id: "b", role: "x", hours_worked: 4 },
      { profile_id: "c", role: "x", hours_worked: 4 },
      { profile_id: "d", role: "x", hours_worked: 4 },
    ], { method: "equal" });
    expect(result.length).toBe(4);
    expect(result.every(r => r.calculated_amount === 250)).toBe(true);
  });

  it("by_hours — proportional to hours", () => {
    const result = calculate(1000, [
      { profile_id: "a", role: "x", hours_worked: 8 },
      { profile_id: "b", role: "x", hours_worked: 2 },
    ], { method: "by_hours" });
    expect(result.find(r => r.profile_id === "a")?.calculated_amount).toBe(800);
    expect(result.find(r => r.profile_id === "b")?.calculated_amount).toBe(200);
  });

  it("by_role — applies role weights", () => {
    const result = calculate(1000, [
      { profile_id: "s1", role: "servitør", hours_worked: 5 },
      { profile_id: "k1", role: "kjøkken", hours_worked: 5 },
    ], { method: "by_role", weights: { servitør: 1.0, kjøkken: 0.5 } });
    // points: s1 = 5*1.0 = 5; k1 = 5*0.5 = 2.5; total = 7.5
    // s1 amount = 1000 * 5 / 7.5 = 666.6666... → 666.67
    // k1 amount = 1000 * 2.5 / 7.5 = 333.3333... → 333.33
    // remainder 0.00 (already sums to 1000.00 after rounding)
    const s1 = result.find(r => r.profile_id === "s1")!;
    const k1 = result.find(r => r.profile_id === "k1")!;
    expect(s1.calculated_amount + k1.calculated_amount).toBeCloseTo(1000, 2);
    expect(s1.calculated_amount).toBeGreaterThan(k1.calculated_amount);
  });

  it("by_role — unknown role defaults weight 1.0", () => {
    const result = calculate(1000, [
      { profile_id: "x", role: "unknown_role", hours_worked: 5 },
    ], { method: "by_role", weights: { servitør: 1.0 } });
    expect(result[0]!.calculated_amount).toBe(1000);
    expect(result[0]!.weight_applied).toBe(1.0);
  });

  it("zero total points returns empty", () => {
    const result = calculate(1000, [
      { profile_id: "a", role: "x", hours_worked: 0 },
    ], { method: "by_hours" });
    expect(result).toEqual([]);
  });

  it("rounding — sum equals input always (single ø-employee remainder)", () => {
    const result = calculate(100, [
      { profile_id: "a", role: "x", hours_worked: 1 },
      { profile_id: "b", role: "x", hours_worked: 1 },
      { profile_id: "c", role: "x", hours_worked: 1 },
    ], { method: "by_hours" });
    const sum = result.reduce((s, r) => s + r.calculated_amount, 0);
    expect(sum).toBeCloseTo(100, 2);
  });

  it("rounding — single employee gets exact amount", () => {
    const result = calculate(123.45, [
      { profile_id: "a", role: "x", hours_worked: 5 },
    ], { method: "equal" });
    expect(result[0]!.calculated_amount).toBe(123.45);
  });

  it("algorithm_snapshot is captured", () => {
    const result = calculate(100, [
      { profile_id: "a", role: "x", hours_worked: 5 },
    ], { method: "by_hours" });
    expect(result[0]!.algorithm_snapshot).toBeDefined();
    expect(result[0]!.algorithm_snapshot.method).toBe("by_hours");
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm test packages/ai/src/capabilities/tips/calculate.test.ts 2>&1 | tail -10
```

Expected: FAIL with "Cannot find module './calculate'".

- [ ] **Step 3: Write calculate.ts to make tests pass**

`packages/ai/src/capabilities/tips/calculate.ts`:

```typescript
// packages/ai/src/capabilities/tips/calculate.ts
// Pure distribution algorithm. Sum invariant: sum(amounts) === amount_nok.

export type Shift = {
  profile_id: string;
  role: string;
  hours_worked: number;
};

export type Policy =
  | { method: "equal" }
  | { method: "by_hours" }
  | { method: "by_role"; weights: Record<string, number> };

export type Distribution = {
  profile_id: string;
  role: string;
  hours_worked: number;
  weight_applied: number;
  calculated_amount: number;
  algorithm_snapshot: {
    method: "equal" | "by_hours" | "by_role";
    weights: Record<string, number> | null;
    total_points: number;
  };
};

export function calculate(
  amountNok: number,
  shifts: Shift[],
  policy: Policy,
): Distribution[] {
  if (shifts.length === 0) return [];

  const weighted = shifts.map((s) => {
    const weight =
      policy.method === "equal"
        ? 1
        : policy.method === "by_hours"
          ? 1
          : policy.weights[s.role] ?? 1.0;
    const points =
      policy.method === "equal" ? 1 : s.hours_worked * weight;
    return { ...s, weight_applied: weight, points };
  });

  const totalPoints = weighted.reduce((sum, w) => sum + w.points, 0);
  if (totalPoints === 0) return [];

  const raw = weighted.map((w) => ({
    ...w,
    calculated_amount:
      Math.round((amountNok * w.points / totalPoints) * 100) / 100,
  }));

  // Allocate rounding remainder to highest-points employee
  const allocated = raw.reduce((s, r) => s + r.calculated_amount, 0);
  const remainder = Math.round((amountNok - allocated) * 100) / 100;
  if (remainder !== 0) {
    const top = raw.reduce((a, b) => (b.points > a.points ? b : a));
    top.calculated_amount = Math.round(
      (top.calculated_amount + remainder) * 100,
    ) / 100;
  }

  const snapshot = {
    method: policy.method,
    weights: policy.method === "by_role" ? policy.weights : null,
    total_points: totalPoints,
  };

  return raw.map((r) => ({
    profile_id: r.profile_id,
    role: r.role,
    hours_worked: r.hours_worked,
    weight_applied: r.weight_applied,
    calculated_amount: r.calculated_amount,
    algorithm_snapshot: snapshot,
  }));
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm test packages/ai/src/capabilities/tips/calculate.test.ts 2>&1 | tail -15
```

Expected: PASS — 9 tests passing.

- [ ] **Step 5: Typecheck full @smartout/ai**

```bash
pnpm turbo typecheck --filter=@smartout/ai 2>&1 | tail -10
```

Expected: 0 errors.

### Task 3.5: Register tips capability in registry

**Files:**
- Modify: `packages/ai/src/capabilities/registry.ts`

- [ ] **Step 1: Read registry**

```bash
cat packages/ai/src/capabilities/registry.ts | head -40
```

- [ ] **Step 2: Add tips import + entry**

Edit the imports + capabilities array. Example pattern (adjust to match exact file shape):

```typescript
import { tipsCapability } from "./tips";

export const capabilities = [
  // … existing …
  tipsCapability,
];
```

- [ ] **Step 3: Typecheck**

```bash
pnpm turbo typecheck --filter=@smartout/ai 2>&1 | tail -10
```

Expected: 0 errors.

- [ ] **Step 4: Commit Phase 3 as one coherent commit**

```bash
git add packages/ai/src/capabilities/tips/ packages/ai/src/capabilities/registry.ts
git commit -m "feat(tips): capability skeleton — 4 tools + calculate() pure fn + 9 unit tests"
```

---

## Phase 4 — useTipsEnabled hook + settings UI

### Task 4.1: apps/web/src/hooks/use-tips-enabled.ts

**Files:**
- Create: `apps/web/src/hooks/use-tips-enabled.ts`

- [ ] **Step 1: Write hook**

```typescript
// apps/web/src/hooks/use-tips-enabled.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspaceOptional } from "@/lib/workspace-context";

/**
 * Reads workspace_setting.tips_enabled. Defaults to false.
 *
 * Per spec §22: Tips UI must hide entirely when disabled.
 */
export function useTipsEnabled(): { enabled: boolean; isLoading: boolean } {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id;

  const { data, isLoading } = useQuery({
    queryKey: ["tips-enabled", workspaceId],
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("workspace_setting")
        .select("tips_enabled")
        .eq("workspace_id", workspaceId!)
        .maybeSingle();
      return Boolean(data?.tips_enabled);
    },
  });

  return { enabled: data ?? false, isLoading };
}
```

> **Note:** If Phase 0 fact-check found the row-per-key pattern (`workspace_setting (workspace_id, setting_key, setting_value)`), adapt the query:
> ```typescript
> .select("setting_value")
> .eq("workspace_id", workspaceId!)
> .eq("setting_key", "tips_enabled")
> .maybeSingle();
> // Then: return data?.setting_value === "true";
> ```

- [ ] **Step 2: Typecheck**

```bash
pnpm turbo typecheck --filter=@smartout/web 2>&1 | tail -10
```

Expected: 0 errors (assuming `database.types.ts` regenerated in Phase 5; do that early if blocked).

### Task 4.2: apps/mobile/src/hooks/queries/use-tips-enabled.ts

**Files:**
- Create: `apps/mobile/src/hooks/queries/use-tips-enabled.ts`

- [ ] **Step 1: Write mobile hook**

```typescript
// apps/mobile/src/hooks/queries/use-tips-enabled.ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useMyProfile } from "./use-my-profile";

export function useTipsEnabled(): { enabled: boolean; isLoading: boolean } {
  const { data: profile } = useMyProfile();
  const workspaceId = profile?.workspace_id;

  const { data, isLoading } = useQuery({
    queryKey: ["tips-enabled", workspaceId],
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("workspace_setting")
        .select("tips_enabled")
        .eq("workspace_id", workspaceId!)
        .maybeSingle();
      return Boolean(data?.tips_enabled);
    },
  });

  return { enabled: data ?? false, isLoading };
}
```

(Same pattern adjustment for k/v table if applicable.)

- [ ] **Step 2: Typecheck mobile**

```bash
pnpm turbo typecheck --filter=@smartout/mobile 2>&1 | tail -10
```

### Task 4.3: Settings page

**Files:**
- Create: `apps/web/src/app/dashboard/settings/operations/tips/page.tsx`

- [ ] **Step 1: Verify settings/operations dir exists**

```bash
ls apps/web/src/app/dashboard/settings/operations/ 2>/dev/null
```

If dir absent, create as part of this task. If present, follow sibling pattern.

- [ ] **Step 2: Write page**

```tsx
// apps/web/src/app/dashboard/settings/operations/tips/page.tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useTipsEnabled } from "@/hooks/use-tips-enabled";
import { setTipsEnabledAction } from "./_actions/set-tips-enabled-action";

export default function TipsSettingsPage() {
  const { enabled, isLoading } = useTipsEnabled();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<boolean | null>(null);

  const value = optimistic ?? enabled;

  function handleToggle(next: boolean) {
    setOptimistic(next);
    startTransition(async () => {
      const res = await setTipsEnabledAction({ enabled: next });
      if (!res.ok) {
        toast.error(res.error);
        setOptimistic(null);
        return;
      }
      toast.success(next ? "Tips aktivert" : "Tips deaktivert");
    });
  }

  if (isLoading) {
    return <div className="p-6 text-muted-foreground text-sm">Laster...</div>;
  }

  return (
    <div className="max-w-2xl space-y-6 p-6">
      <header>
        <h1 className="font-heading text-2xl tracking-tight">Tips-håndtering</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Master-toggle for tips-modulen. Når deaktivert vises ingenting noe sted.
        </p>
      </header>

      <div className="bg-card border-border rounded-xl border p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-base font-semibold">Aktiver Tips</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Når aktivert: ledere kan registrere kveldens tips i Okonomi-tab og
              fordele i avstemming. Ansatte ser sin andel i Lønn-skjermen.
            </p>
            <p className="text-muted-foreground mt-2 text-sm">
              Når deaktivert: alle tips-flater skjules. Eksisterende data slettes
              ikke — re-aktivering gjør den synlig igjen.
            </p>
          </div>

          <div className="shrink-0">
            <button
              type="button"
              role="switch"
              aria-checked={value}
              disabled={pending}
              onClick={() => handleToggle(!value)}
              className={`focus-visible:ring-brand-orange relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                value ? "bg-brand-orange" : "bg-muted"
              } ${pending ? "opacity-50" : ""}`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  value ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm turbo typecheck --filter=@smartout/web 2>&1 | tail -10
```

Expected: errors about missing `_actions/set-tips-enabled-action.ts` (resolved next task).

### Task 4.4: setTipsEnabledAction Server Action

**Files:**
- Create: `apps/web/src/app/dashboard/settings/operations/tips/_actions/set-tips-enabled-action.ts`

- [ ] **Step 1: Read pattern from existing _actions sibling**

```bash
ls apps/web/src/app/dashboard/_actions/ | head
cat apps/web/src/app/dashboard/_actions/pin-day-control-context.ts 2>/dev/null | head -40
```

- [ ] **Step 2: Write action**

```typescript
// apps/web/src/app/dashboard/settings/operations/tips/_actions/set-tips-enabled-action.ts
"use server";

import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import { getProfileContext } from "@/lib/server-context";
import { emit, nonEmpty } from "@smartout/telemetry";

const InputSchema = z.object({
  enabled: z.boolean(),
});

type Result =
  | { ok: true }
  | { ok: false; error: string };

export async function setTipsEnabledAction(
  raw: unknown,
): Promise<Result> {
  const parsed = InputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const ctx = await getProfileContext();
  if (!ctx) return { ok: false, error: "unauthenticated" };
  if (!ctx.is_admin) return { ok: false, error: "admin_required" };

  const supabase = createClient();
  const { error } = await supabase
    .from("workspace_setting")
    .update({ tips_enabled: parsed.data.enabled })
    .eq("workspace_id", ctx.workspace_id);

  if (error) {
    return { ok: false, error: `db_error:${error.code}` };
  }

  emit({
    event: parsed.data.enabled ? "workspace_setting tips_enabled" : "workspace_setting tips_disabled",
    workspace_id: nonEmpty(ctx.workspace_id, "workspace_id"),
    actor_id: nonEmpty(ctx.profile_id, "actor_id"),
    properties: {
      entity: { entity_type: "workspace_setting", entity_id: ctx.workspace_id },
      data: { tips_enabled: parsed.data.enabled },
    },
  });

  return { ok: true };
}
```

> **Telemetry:** add the two events `workspace_setting tips_enabled` and `workspace_setting tips_disabled` to registry if not already present (or use a single event with a payload field). Adjust to existing convention found in fact-check.

- [ ] **Step 3: Add telemetry events for the toggle**

If existing convention prefers single event: emit `workspace_setting tips_toggled` with `{ enabled: boolean }` payload. Add to registry per Phase 2 pattern.

- [ ] **Step 4: Typecheck**

```bash
pnpm turbo typecheck --filter=@smartout/web 2>&1 | tail -10
```

Expected: 0 errors.

- [ ] **Step 5: Commit Phase 4 as one commit**

```bash
git add apps/web/src/hooks/use-tips-enabled.ts \
  apps/mobile/src/hooks/queries/use-tips-enabled.ts \
  apps/web/src/app/dashboard/settings/operations/tips/ \
  packages/telemetry/src/registry.ts
git commit -m "feat(tips): useTipsEnabled hook (web+mobile) + admin settings toggle UI"
```

---

## Phase 5 — Database types regeneration

### Task 5.1: Regenerate database.types.ts

**Files:**
- Modify: `packages/supabase/src/database.types.ts`

- [ ] **Step 1: Run regen script**

```bash
pnpm db:types-regen
```

Expected: file rewritten. New types: `tip_pool`, `tip_distribution`, `tip_policy`, `tip_role_weight`, `tip_adjustment_log`, `tip_pool_status`, `tip_distribution_status`, `tip_algorithm`. New column on `workspace_setting`: `tips_enabled`.

- [ ] **Step 2: Verify new types present**

```bash
grep -n "tip_pool\|tip_algorithm" packages/supabase/src/database.types.ts | head -20
```

Expected: multiple matches.

- [ ] **Step 3: Full repo typecheck**

```bash
pnpm turbo typecheck 2>&1 | tail -20
```

Expected: 0 errors across all packages.

- [ ] **Step 4: Commit**

```bash
git add packages/supabase/src/database.types.ts
git commit -m "chore(types): regen database.types.ts with tips schema"
```

---

## Phase 6 — Verification + handoff

### Task 6.1: Authority-seed-parity scanner pass

- [ ] **Step 1: Run scanner**

```bash
pnpm tsx scripts/authority-seed-parity.ts 2>&1 | tail -20
```

Expected: green / 0 errors.

### Task 6.2: Telemetry registry Phase 2.5 grep

- [ ] **Step 1: Verify all 4 tip events registered**

```bash
grep -c "tip_pool created\|tip_distribution calculated\|tip_distribution adjusted\|tip_pool approved" packages/telemetry/src/registry.ts
```

Expected: 4.

### Task 6.3: gate-action-coverage scanner

- [ ] **Step 1: Run AST coverage check (per ADR-0201)**

```bash
pnpm tsx scripts/gate-action-coverage.ts 2>&1 | tail -10
```

Expected: green. Sortie 1 has no mutations in tools (skeletons return not_implemented before any DB write), so scanner should not flag tips/.

### Task 6.4: phantom-emit grep gate

- [ ] **Step 1: Verify no phantom emit pattern**

```bash
grep -rn "emit.*tip_.*started" packages/ai/src/capabilities/tips/ 2>/dev/null
```

Expected: zero matches. (Sortie 1 tools don't emit; Sortie 2 will, with declared artefacts.)

### Task 6.5: Full typecheck + tests

- [ ] **Step 1: Full typecheck**

```bash
pnpm turbo typecheck
```

Expected: 0 errors.

- [ ] **Step 2: Run tips unit tests**

```bash
pnpm test packages/ai/src/capabilities/tips/ 2>&1 | tail -10
```

Expected: 9 passing.

- [ ] **Step 3: db reset clean**

```bash
npx supabase db reset 2>&1 | tail -10
```

Expected: all migrations apply, seed completes, no errors.

### Task 6.6: Write handoff

**Files:**
- Create: `docs/HANDOFF-tips-data-model.md`

- [ ] **Step 1: Write handoff**

```markdown
---
title: HANDOFF — tips-data-model (Sortie 1, campaign/tips-handling)
status: complete
created: 2026-04-28
updated: 2026-04-28
module: tips
tags: [handoff, tips, sortie-1, schema]
---

# HANDOFF — tips-data-model

## Summary

Sortie 1 of the Tips campaign. Lays the data foundation: 5 tables, 3 enums, RLS dual JWT/API-key, capability skeleton (4 tools, all not_implemented), authority seed (CROSS JOIN VALUES), 4 telemetry events, workspace_setting.tips_enabled toggle, useTipsEnabled hook (web + mobile), admin settings page + Server Action. Pure schema + scaffolding. No user flows. No DB mutations from capability tools yet.

## Decisions

- Pool granularity: `department_session_id` (kveldsgrense), enforced via UNIQUE constraint
- Algorithm naming: `equal | by_hours | by_role` (campaign vocabulary, not external spec's `flat | hours | weighted_hours`)
- Workspace toggle: single boolean column on `workspace_setting`, default false (opt-in)
- Push-notif: out of scope; deferred to payroll-campaign
- Schema-prep for payroll: `tip_distribution.payroll_period_id` + `paid_at` + `paid` enum value present; populated by future campaign

## Learnings

- `workspace_setting` table pattern: <fill in from fact-check — row-per-key OR JSONB OR alternative>
- Authority-seed-parity scanner regex: <fill in>
- gate_action helper signature: <fill in>
- `is_admin_in_workspace` function: <fill in availability or substitute pattern>

## Known issues / debt

- Settings UI uses single boolean column. If product requires per-user opt-in later, schema-extend to `tip_notification_preference` table.
- `is_admin_in_workspace` — confirm this function's exact name and signature; some workspaces use `is_workspace_admin` instead.
- 4 telemetry events registered but no emit yet (Sortie 2 will populate `tip_pool created` / `tip_distribution calculated` from `tips.set_pot`).

## Next steps

- Sortie 2 `tips-leader-flows`: Fill in 3 mutation tool bodies + BFF routes + OkonomiTab tile + SignoffTab gate + reconciliation Tips-tab + AdjustmentDialog + ApproveBar
- Sortie 3 `tips-employee-mobile`: Fill in `tips.query_own_share` body + mobile screens + AfterShiftView tile + NotificationSheet row
- Sortie 4 `tips-e2e-audit`: Playwright money-flow + audit-trail review

## Verification commands

```bash
pnpm turbo typecheck  # 0 errors
pnpm test packages/ai/src/capabilities/tips/  # 9 passing
pnpm tsx scripts/authority-seed-parity.ts  # green
npx supabase db reset  # clean
```
```

- [ ] **Step 2: Commit handoff**

```bash
git add docs/HANDOFF-tips-data-model.md
git commit -m "docs(tips): handoff for tips-data-model Sortie 1"
```

### Task 6.7: Write user journeys

**Files:**
- Create: `docs/journeys/JOURNEY-tips-data-model.md`

- [ ] **Step 1: Write journey doc**

```markdown
---
title: JOURNEY — tips-data-model (Sortie 1)
status: done
created: 2026-04-28
updated: 2026-04-28
module: tips
tags: [journey, tips, sortie-1]
---

# JOURNEY — tips-data-model

Sortie 1 is foundation-only. The single user-visible behavior is the admin toggle.

## Journey: Admin enables Tips for workspace

**Precondition:** User logged in with admin role in a workspace where `workspace_setting.tips_enabled = false` (default).

1. Admin navigates to `/dashboard/settings/operations/tips`
   → System loads `useTipsEnabled()` hook → fetches `workspace_setting.tips_enabled` (false)
   → User sees: page header "Tips-håndtering", toggle in OFF position, descriptive text
2. Admin clicks the toggle
   → `handleToggle(true)` called
   → Optimistic UI update: toggle moves to ON
   → Server Action `setTipsEnabledAction({ enabled: true })` invoked
   → Server: `getProfileContext()` resolves admin status; UPDATE `workspace_setting`
   → Server: emits `workspace_setting tips_enabled` telemetry event
   → Client: receives `{ ok: true }` → toast "Tips aktivert"
3. **Postcondition:** `workspace_setting.tips_enabled = true` for this workspace. `useTipsEnabled()` returns `enabled: true` everywhere. (Tips UI surfaces are NOT yet rendered — that lands in Sortie 2.)

**Error paths:**
- User is not admin → Server Action returns `{ ok: false, error: "admin_required" }` → toast "admin_required" + toggle reverts
- DB error → toast with error code + toggle reverts
- Unauthenticated → toast "unauthenticated" + toggle reverts

## Journey: Admin disables Tips

**Precondition:** Admin in workspace where `tips_enabled = true`. Some `tip_pool` rows may exist.

1. Admin navigates to settings page → toggle shows ON
2. Admin clicks toggle → `handleToggle(false)` → Server Action `setTipsEnabledAction({ enabled: false })`
3. Server: UPDATE flag to false → emit `workspace_setting tips_disabled`
4. Client: toast "Tips deaktivert"
5. **Postcondition:** Flag is false. Existing tip data (pools/distributions/policies/logs) is preserved untouched. UI surfaces (when wired in Sortie 2-3) hide. Re-enabling shows data again.

## Journey: Capability tool called from non-admin

**Precondition:** Sortie 1 capability tools are skeletons. Any direct invocation returns `not_implemented`.

1. Caller invokes `tips.set_pot` via stage-engine
2. Tool's `execute()` returns `{ ok: false, error: "not_implemented", note: "Skeleton — body lands in Sortie 2 tips-leader-flows" }`
3. **Postcondition:** No DB mutation. No telemetry emitted (per ADR-0196 — must not emit `*_started` without producing artefact).
```

- [ ] **Step 2: Commit**

```bash
git add docs/journeys/JOURNEY-tips-data-model.md
git commit -m "docs(tips): user journey for tips-data-model Sortie 1"
```

### Task 6.8: Close-feature gate

- [ ] **Step 1: Run close-feature script**

```bash
~/.claude/scripts/close-feature.sh 1
```

Expected: gate checks pass, branch merges to `campaign/tips-handling`, `origin/development` syncs in, sub-sortie worktree removed.

If gate fails on any required item, fix and re-run.

---

## Verification matrix (post-Sortie-1)

| Gate | Command | Expected |
|---|---|---|
| Typecheck | `pnpm turbo typecheck` | 0 errors |
| Unit tests | `pnpm test packages/ai/src/capabilities/tips/` | 9 passing |
| db reset | `npx supabase db reset` | clean apply |
| Authority parity | `pnpm tsx scripts/authority-seed-parity.ts` | green |
| Gate-action coverage | `pnpm tsx scripts/gate-action-coverage.ts` | green (no mutation in skeletons) |
| Telemetry registry | `grep -c "tip_pool\|tip_distribution" packages/telemetry/src/registry.ts` | ≥4 |
| No phantom emit | `grep -rn "emit.*tip.*started" packages/ai/src/capabilities/tips/` | 0 matches |
| Decision log | `grep ADR-0260 docs/decisions/0000-decision-log.md` | 1 line |
| Handoff present | `ls docs/HANDOFF-tips-data-model.md` | exists |
| Journey present | `ls docs/journeys/JOURNEY-tips-data-model.md` | exists |
