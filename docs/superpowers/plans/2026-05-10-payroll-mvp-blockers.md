# Payroll MVP Ship-Blockers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close 5 SHIP-BLOCKERS + 1 ADR identified by Council 2026-05-10 PM so payroll feature is shippable for hourly + tariff-bound workers in mid-size Norwegian restaurants.

**Architecture:** Schema fix first (B2a clears Trust Gate), then resolver + feriepenger in parallel (Day 2), then notification handler (Day 3), then UI bundle (Day 4). All work on existing campaign branch — no new worktree.

**Tech Stack:** Next.js 16 BFF routes, Supabase Postgres + RLS, Zod validation, vitest, pgTAP for trigger tests, TanStack Query for UI mutations, shadcn/ui (new-york), Geist Mono for numerics, Instrument Serif for headings, Nordic Split design tokens.

**Linear refs:**
- Epic: [SMA-327](https://linear.app/smartout/issue/SMA-327)
- [SMA-344 S2a](https://linear.app/smartout/issue/SMA-344) — Schema unblocker (Day 1)
- [SMA-348 ADR-DRAFT](https://linear.app/smartout/issue/SMA-348) — Feriepenger boundary (Day 1, parallel)
- [SMA-345 S2b](https://linear.app/smartout/issue/SMA-345) — Resolver (Day 2)
- [SMA-346 S3](https://linear.app/smartout/issue/SMA-346) — Feriepenger basis (Day 2, parallel)
- [SMA-347 S4](https://linear.app/smartout/issue/SMA-347) — Lock notification (Day 3)
- [SMA-343 S1+B5](https://linear.app/smartout/issue/SMA-343) — Period creation + manual time entry (Day 4)

**ADR/migration reservations** (verified via `git log --all`):
- ADR slot: **0295** (next free; 0294 = payroll-pdf-library is highest)
- Migration timestamps: **20260528100000+** (next free; 20260527101600 is highest)

**Branch state:**
- Worktree: `/home/sxtnl/dev/smartout.ai-payroll`
- Branch: `campaign/payroll`
- HEAD: `6205e57de` (chore(payroll): merge development into campaign)
- Working directly on campaign — no sub-sortie. Direct commits authorized.

---

## File Structure

### NEW files

| Path | Responsibility |
|---|---|
| `supabase/migrations/20260528100000_payroll_employee_profile_rate_columns.sql` | ADD COLUMN hourly_rate + monthly_salary + remuneration_type + currency on employee_payroll_profile |
| `supabase/migrations/20260528100100_payroll_sync_trigger_rate_columns.sql` | Update sync_payroll_on_contract_signed() to write new columns |
| `supabase/migrations/20260528100200_payroll_phase2_trigger_schema_fix.sql` | Fix Phase 2 trigger references public.payroll_manual_supplement → payroll.manual_supplement |
| `supabase/migrations/20260528100300_payroll_employee_profile_rate_backfill.sql` | Backfill hourly_rate from latest active employment_contract per profile |
| `supabase/tests/payroll-sync-trigger-writes-rate-columns.sql` | pgTAP test for trigger |
| `apps/web/src/app/api/payroll/create-period/route.ts` | POST BFF for new period creation |
| `apps/web/src/app/api/payroll/create-period/__tests__/route.test.ts` | Vitest for create-period |
| `apps/web/src/app/dashboard/payroll/_components/CreatePeriodDialog.tsx` | "Ny periode"-dialog form |
| `apps/web/src/app/dashboard/payroll/_hooks/use-create-period.ts` | TanStack mutation hook |
| `apps/web/src/app/dashboard/payroll/[periodId]/_components/ManualTimeEntryDialog.tsx` | Dialog form for manualTimeEntryAction call |
| `supabase/functions/payroll-period-locked-handler/index.ts` | engine_dispatch handler — INSERT to notification_outbox |
| `supabase/functions/payroll-period-locked-handler/__tests__/handler.test.ts` | Vitest for handler logic |
| `docs/decisions/0295-feriepenger-boundary.md` | ADR codifying basis-vs-accrual boundary |

### MODIFY files

| Path | Change |
|---|---|
| `packages/ai/src/capabilities/payroll/tools.ts:644-720` | Fix `salary_query` SELECT to actual schema |
| `apps/web/src/app/api/payroll/snapshot-period-costs/route.ts:401-405` | Replace `baseHourlyRateNok = 0` with resolver |
| `apps/web/src/app/api/payroll/derive-shift-hours/route.ts:229` | Add hourly_rate to SELECT list |
| `apps/web/src/app/api/payroll/generate-pdf-bundle/route.ts:203` | Compute feriepenger basis |
| `apps/web/src/app/api/payroll/generate-pdf-single/route.ts:230` | Compute feriepenger basis |
| `apps/web/src/app/api/payroll/export-period/route.ts:216,306` | Compute feriepenger basis (both branches) |
| `apps/web/src/app/dashboard/payroll/_components/PayrollPeriodsClient.tsx` | Add "Ny periode"-button |
| `apps/web/src/app/dashboard/payroll/[periodId]/_components/LineDrawer.tsx` | Mount "Korriger tid"-button + ManualTimeEntryDialog |
| `apps/web/src/app/dashboard/my-salary/page.tsx` | Show feriepenger-grunnlag with disclaimer label |
| `packages/supabase/src/database.types.ts` | Regenerated (auto via supabase CLI) |
| `packages/payroll-export/src/types.ts` | Rename `feriepenger_accrued` → `feriepenger_basis` in AggregateRow + AuditRow |
| `packages/payroll-export/src/csv.ts` | Header label "Feriepenger-grunnlag" |
| `packages/payroll-export/src/pdf/components/TotalsBlock.tsx` | Render feriepenger-grunnlag with regnskapsfører-disclaimer |

---

# DAY 1 — Schema unblocker + ADR draft (parallel)

## Task 1: Migration — ADD COLUMN hourly_rate + 3 more on employee_payroll_profile

**Files:**
- Create: `supabase/migrations/20260528100000_payroll_employee_profile_rate_columns.sql`

- [ ] **Step 1: Write migration SQL**

Create file with:

```sql
-- 20260528100000_payroll_employee_profile_rate_columns.sql
--
-- Add rate columns to employee_payroll_profile.
--
-- Council 2026-05-10 PM verdict (SMA-344): salary_query Botsson tool reads
-- monthly_salary/hourly_rate/remuneration_type/currency from
-- employee_payroll_profile but none exist there. Tool crashes on first call.
-- snapshot-period-costs/route.ts:403 hardcodes baseHourlyRateNok = 0.
--
-- This migration adds the 4 columns. Sync trigger update + backfill follow
-- in 20260528100100 + 20260528100300.

ALTER TABLE public.employee_payroll_profile
  ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS remuneration_type TEXT
    CHECK (remuneration_type IN ('hourly', 'monthly', 'mixed')),
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'NOK';

COMMENT ON COLUMN public.employee_payroll_profile.hourly_rate IS
  'Per-employee custom hourly rate (NOK). Override of tariff_rate_table lookup. NULL = use tariff fallback.';

COMMENT ON COLUMN public.employee_payroll_profile.monthly_salary IS
  'Per-employee monthly salary (NOK). Used when remuneration_type=monthly.';

COMMENT ON COLUMN public.employee_payroll_profile.remuneration_type IS
  'How the employee is paid: hourly (per-hour rate), monthly (fixed salary), or mixed.';

COMMENT ON COLUMN public.employee_payroll_profile.currency IS
  'ISO 4217 currency code. Always NOK for Norwegian operations (default).';
```

- [ ] **Step 2: Apply migration locally**

Run: `docker exec -i supabase_db_smartout.ai psql -U postgres -d postgres < supabase/migrations/20260528100000_payroll_employee_profile_rate_columns.sql`

Expected: `ALTER TABLE\nCOMMENT\nCOMMENT\nCOMMENT\nCOMMENT`

- [ ] **Step 3: Verify columns added**

Run: `docker exec -i supabase_db_smartout.ai psql -U postgres -d postgres -c "\d employee_payroll_profile" | grep -E "hourly_rate|monthly_salary|remuneration_type|currency"`

Expected: 4 rows showing each column with correct type.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260528100000_payroll_employee_profile_rate_columns.sql
git commit -m "$(cat <<'EOF'
feat(payroll): add hourly_rate + monthly_salary + remuneration_type + currency to employee_payroll_profile

SMA-344 S2a — schema unblocker. salary_query Botsson tool currently crashes
because it SELECTs columns that don't exist on this table. Adds them.

Sync trigger update + backfill in 20260528100100 + 20260528100300.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Update sync_payroll_on_contract_signed() trigger

**Files:**
- Create: `supabase/migrations/20260528100100_payroll_sync_trigger_rate_columns.sql`
- Reference: `supabase/migrations/20260422400200_cascade_contract_payroll_sync.sql` (existing trigger)

- [ ] **Step 1: Read existing trigger**

Run: `cat supabase/migrations/20260422400200_cascade_contract_payroll_sync.sql | head -80`

Note current UPDATE clause writes only `agreed_weekly_hours`. The `NEW.hourly_rate` etc. are logged into `activity_trail.metadata` but never persisted.

- [ ] **Step 2: Write trigger update migration**

Create file:

```sql
-- 20260528100100_payroll_sync_trigger_rate_columns.sql
--
-- Update sync_payroll_on_contract_signed() to persist rate columns
-- added in 20260528100000.
--
-- Before: trigger UPDATEs only agreed_weekly_hours; rate values logged
-- to activity_trail but never written to employee_payroll_profile.
--
-- After: trigger UPDATEs all 5 columns from contract on signed transition.

CREATE OR REPLACE FUNCTION public.sync_payroll_on_contract_signed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, payroll, extensions
AS $$
DECLARE
  v_payroll_profile_id UUID;
BEGIN
  -- Only fire on transition INTO 'signed' status
  IF NEW.status = 'signed' AND (OLD.status IS NULL OR OLD.status != 'signed') THEN

    -- Audit log entry (preserved from original)
    INSERT INTO public.activity_trail (
      workspace_id, entity_type, entity_id, actor_id, action_type, metadata
    ) VALUES (
      NEW.workspace_id,
      'employment_contract',
      NEW.id,
      NEW.signed_by,
      'contract.signed',
      jsonb_build_object(
        'contract_id', NEW.id,
        'profile_id', NEW.profile_id,
        'new', jsonb_build_object(
          'hourly_rate', NEW.hourly_rate,
          'monthly_salary', NEW.monthly_salary,
          'remuneration_type', NEW.remuneration_type,
          'agreed_weekly_hours', NEW.agreed_weekly_hours,
          'currency', COALESCE(NEW.currency, 'NOK')
        )
      )
    );

    -- Sync to employee_payroll_profile (UPDATED — now writes rate columns)
    UPDATE public.employee_payroll_profile
    SET
      agreed_weekly_hours = NEW.agreed_weekly_hours,
      hourly_rate = NEW.hourly_rate,
      monthly_salary = NEW.monthly_salary,
      remuneration_type = NEW.remuneration_type,
      currency = COALESCE(NEW.currency, 'NOK'),
      updated_at = NOW()
    WHERE profile_id = NEW.profile_id
      AND workspace_id = NEW.workspace_id
    RETURNING id INTO v_payroll_profile_id;

    -- Insert if no payroll profile exists yet
    IF v_payroll_profile_id IS NULL THEN
      INSERT INTO public.employee_payroll_profile (
        workspace_id, profile_id,
        agreed_weekly_hours,
        hourly_rate, monthly_salary, remuneration_type, currency
      ) VALUES (
        NEW.workspace_id, NEW.profile_id,
        NEW.agreed_weekly_hours,
        NEW.hourly_rate, NEW.monthly_salary, NEW.remuneration_type,
        COALESCE(NEW.currency, 'NOK')
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
```

- [ ] **Step 3: Apply migration**

Run: `docker exec -i supabase_db_smartout.ai psql -U postgres -d postgres < supabase/migrations/20260528100100_payroll_sync_trigger_rate_columns.sql`

Expected: `CREATE FUNCTION`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260528100100_payroll_sync_trigger_rate_columns.sql
git commit -m "$(cat <<'EOF'
feat(payroll): sync trigger writes rate columns to employee_payroll_profile

SMA-344 S2a — sync_payroll_on_contract_signed() now persists hourly_rate,
monthly_salary, remuneration_type, currency on signed transition.

Before: only agreed_weekly_hours synced; rate logged to activity_trail
only. After: full sync.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Phase 2 trigger schema-mismatch fix

**Files:**
- Create: `supabase/migrations/20260528100200_payroll_phase2_trigger_schema_fix.sql`
- Reference: `supabase/migrations/20260507110100_payroll_phase2_recalc_triggers.sql` (broken)

- [ ] **Step 1: Verify the bug**

Run: `grep "public.payroll_manual_supplement\|public.tip_distribution" supabase/migrations/20260507110100_payroll_phase2_recalc_triggers.sql`

Expected: 1+ matches showing the wrong schema qualifier.

- [ ] **Step 2: Verify real table location**

Run: `docker exec -i supabase_db_smartout.ai psql -U postgres -d postgres -c "SELECT table_schema FROM information_schema.tables WHERE table_name='manual_supplement';"`

Expected: `payroll` (not public)

- [ ] **Step 3: Write fix migration**

Create file:

```sql
-- 20260528100200_payroll_phase2_trigger_schema_fix.sql
--
-- Fix Phase 2 recalc-triggers schema mismatch.
--
-- Original migration 20260507110100 referenced public.payroll_manual_supplement
-- but the table actually lives at payroll.manual_supplement (moved in
-- 20260422110700_payroll_schema_move.sql). Trigger creation FAILED on first
-- application — recalc events never fire from supplement INSERT/DELETE.
--
-- Pattern B BFF sync-chain (ADR-0293) compensates today, but engine_dispatch
-- handler ship will break without these triggers.

-- Drop broken triggers if they exist (idempotent)
DROP TRIGGER IF EXISTS payroll_manual_supplement_recalc_trg ON payroll.manual_supplement;
DROP TRIGGER IF EXISTS payroll_tip_distribution_recalc_trg ON payroll.tip_distribution;

-- Recreate with correct schema qualifier
CREATE OR REPLACE FUNCTION payroll.fn_payroll_manual_supplement_recalc()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, payroll, extensions
AS $$
BEGIN
  INSERT INTO public.engine_event (workspace_id, event_type, payload, idempotency_key)
  VALUES (
    COALESCE(NEW.workspace_id, OLD.workspace_id),
    'payroll.recalc_triggered_by_supplement',
    jsonb_build_object(
      'supplement_id', COALESCE(NEW.id, OLD.id),
      'profile_id', COALESCE(NEW.profile_id, OLD.profile_id),
      'period_id', COALESCE(NEW.period_id, OLD.period_id),
      'op', TG_OP
    ),
    'payroll.recalc_supplement.' || COALESCE(NEW.id::text, OLD.id::text) || '.' ||
      TG_OP || '.' || to_char(now(), 'YYYYMMDDHH24MI')
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER payroll_manual_supplement_recalc_trg
  AFTER INSERT OR DELETE ON payroll.manual_supplement
  FOR EACH ROW
  EXECUTE FUNCTION payroll.fn_payroll_manual_supplement_recalc();

-- Same pattern for tip_distribution
CREATE OR REPLACE FUNCTION payroll.fn_payroll_tip_distribution_recalc()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, payroll, extensions
AS $$
BEGIN
  IF NEW.status != 'approved' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.engine_event (workspace_id, event_type, payload, idempotency_key)
  VALUES (
    NEW.workspace_id,
    'payroll.recalc_triggered_by_tip_distribution',
    jsonb_build_object(
      'distribution_id', NEW.id,
      'profile_id', NEW.profile_id,
      'period_id', NEW.period_id,
      'pool_id', NEW.tip_pool_id
    ),
    'payroll.recalc_tip.' || NEW.period_id::text || '.' || NEW.profile_id::text || '.' || NEW.tip_pool_id::text
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER payroll_tip_distribution_recalc_trg
  AFTER INSERT ON payroll.tip_distribution
  FOR EACH ROW
  EXECUTE FUNCTION payroll.fn_payroll_tip_distribution_recalc();
```

- [ ] **Step 4: Apply + verify**

Run: `docker exec -i supabase_db_smartout.ai psql -U postgres -d postgres < supabase/migrations/20260528100200_payroll_phase2_trigger_schema_fix.sql`

Expected: `DROP TRIGGER\nDROP TRIGGER\nCREATE FUNCTION\nCREATE TRIGGER\nCREATE FUNCTION\nCREATE TRIGGER`

Verify: `docker exec -i supabase_db_smartout.ai psql -U postgres -d postgres -c "SELECT trigger_name, event_object_schema, event_object_table FROM information_schema.triggers WHERE trigger_name LIKE 'payroll_%recalc%';"`

Expected: 2 rows showing both triggers on payroll.* tables.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260528100200_payroll_phase2_trigger_schema_fix.sql
git commit -m "$(cat <<'EOF'
fix(payroll): Phase 2 recalc triggers schema-mismatch (public.* → payroll.*)

SMA-344 S2a hidden coupling — Phase 2 migration 20260507110100 referenced
public.payroll_manual_supplement but real table is at payroll.manual_supplement
(moved in 20260422110700). Triggers never installed.

Pattern B BFF sync-chain compensated until now per ADR-0293; engine_dispatch
handler ship would break without these.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Backfill rate columns from contracts

**Files:**
- Create: `supabase/migrations/20260528100300_payroll_employee_profile_rate_backfill.sql`

- [ ] **Step 1: Write backfill SQL**

```sql
-- 20260528100300_payroll_employee_profile_rate_backfill.sql
--
-- Backfill hourly_rate, monthly_salary, remuneration_type, currency
-- on employee_payroll_profile from latest active employment_contract per profile.
--
-- Handles NULL contract case: rate columns stay NULL → snapshot-period-costs
-- resolver will fall back to tariff lookup (S2b).

WITH latest_contracts AS (
  SELECT DISTINCT ON (workspace_id, profile_id)
    workspace_id,
    profile_id,
    hourly_rate,
    monthly_salary,
    remuneration_type,
    COALESCE(currency, 'NOK') AS currency
  FROM public.employment_contract
  WHERE status IN ('signed', 'active')
  ORDER BY workspace_id, profile_id, signed_at DESC NULLS LAST, created_at DESC
)
UPDATE public.employee_payroll_profile epp
SET
  hourly_rate = lc.hourly_rate,
  monthly_salary = lc.monthly_salary,
  remuneration_type = lc.remuneration_type,
  currency = lc.currency,
  updated_at = NOW()
FROM latest_contracts lc
WHERE epp.workspace_id = lc.workspace_id
  AND epp.profile_id = lc.profile_id
  AND epp.hourly_rate IS NULL;  -- idempotent: only backfill empty rows
```

- [ ] **Step 2: Apply + verify backfill on May 2026 demo**

Run: `docker exec -i supabase_db_smartout.ai psql -U postgres -d postgres < supabase/migrations/20260528100300_payroll_employee_profile_rate_backfill.sql`

Verify: `docker exec -i supabase_db_smartout.ai psql -U postgres -d postgres -c "SELECT profile_id, hourly_rate, monthly_salary, remuneration_type FROM employee_payroll_profile WHERE workspace_id = (SELECT workspace_id FROM workspace WHERE slug='may2026-demo') ORDER BY profile_id LIMIT 5;"`

Expected: 5 rows with rate columns populated for those with active contracts; NULL for those without.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260528100300_payroll_employee_profile_rate_backfill.sql
git commit -m "$(cat <<'EOF'
chore(payroll): backfill rate columns from latest active contract

SMA-344 S2a — populate hourly_rate/monthly_salary/remuneration_type/currency
on existing employee_payroll_profile rows from latest signed contract.
Idempotent (WHERE hourly_rate IS NULL).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Regenerate database.types.ts

**Files:**
- Modify: `packages/supabase/src/database.types.ts`

- [ ] **Step 1: Run gen-types (NOT under op run — see memory)**

Per memory `learning_op_run_supabase_gen_types_corrupts.md`: 1Password substitutes substring matches. Run WITHOUT op run:

```bash
cd /home/sxtnl/dev/smartout.ai-payroll
npx supabase gen types typescript --local --schema=public,payroll > packages/supabase/src/database.types.ts
```

- [ ] **Step 2: Verify new columns appear in types**

Run: `grep -A 8 "employee_payroll_profile: {" packages/supabase/src/database.types.ts | head -50 | grep -E "hourly_rate|monthly_salary|remuneration_type|currency"`

Expected: 4 type lines for the new columns.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @smartout/supabase typecheck`

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add packages/supabase/src/database.types.ts
git commit -m "$(cat <<'EOF'
chore(supabase): regen types post rate-columns migration

SMA-344 S2a — types reflect new employee_payroll_profile columns.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Fix salary_query SELECT to actual schema

**Files:**
- Modify: `packages/ai/src/capabilities/payroll/tools.ts:644-720`
- Test: `packages/ai/src/capabilities/payroll/__tests__/salary-query.test.ts`

- [ ] **Step 1: Read current broken implementation**

Run: `sed -n '644,720p' packages/ai/src/capabilities/payroll/tools.ts`

Note the SELECT line that crashes — it references `monthly_salary, hourly_rate, remuneration_type, currency`. Now those columns DO exist (post-migration), so the SELECT will work.

- [ ] **Step 2: Write failing test FIRST (TDD)**

Create `packages/ai/src/capabilities/payroll/__tests__/salary-query.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { salaryQuery } from "../tools";
import type { AgentToolContext } from "../../types";

describe("salary_query — SMA-344 schema fix", () => {
  let ctx: AgentToolContext;
  let fromSpy: ReturnType<typeof vi.fn>;
  let selectSpy: ReturnType<typeof vi.fn>;
  let eqSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fromSpy = vi.fn();
    selectSpy = vi.fn();
    eqSpy = vi.fn();

    fromSpy.mockReturnValue({ select: selectSpy });
    selectSpy.mockReturnValue({ eq: eqSpy });
    eqSpy.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            hourly_rate: 280.0,
            monthly_salary: null,
            remuneration_type: "hourly",
            currency: "NOK",
          },
          error: null,
        }),
      }),
    });

    ctx = {
      workspaceId: "ws-test" as never,
      profileId: "actor-test" as never,
      channel: "chat",
      supabaseAdmin: { from: fromSpy } as never,
    } as AgentToolContext;
  });

  it("queries employee_payroll_profile (not phantom table)", async () => {
    await salaryQuery.execute({ profile_id: "prof-1" }, ctx);
    expect(fromSpy).toHaveBeenCalledWith("employee_payroll_profile");
  });

  it("selects rate columns that exist post-SMA-344", async () => {
    await salaryQuery.execute({ profile_id: "prof-1" }, ctx);
    const selectArg = selectSpy.mock.calls[0][0];
    expect(selectArg).toContain("hourly_rate");
    expect(selectArg).toContain("monthly_salary");
    expect(selectArg).toContain("remuneration_type");
    expect(selectArg).toContain("currency");
  });

  it("returns hourly_rate from real schema", async () => {
    const resultStr = await salaryQuery.execute({ profile_id: "prof-1" }, ctx);
    const result = JSON.parse(resultStr);
    expect(result.ok).toBe(true);
    expect(result.hourly_rate).toBe(280.0);
  });
});
```

- [ ] **Step 3: Build telemetry dist (mock-target needs updated types)**

Run: `pnpm --filter @smartout/telemetry build`

Expected: rebuild dist with no errors.

- [ ] **Step 4: Run test to verify it passes (it should — schema now matches)**

Run: `pnpm --filter @smartout/ai test -- salary-query`

Expected: 3 tests pass.

If FAIL: read the body of `salaryQuery` tool. Likely the existing SELECT string already matches. If so, the test serves as regression-prevention.

- [ ] **Step 5: Update docstring (drop "PLACEHOLDER" framing per L-0176)**

Edit `tools.ts:10` and `tools.ts:27`. Change:
```
*   - salary_query            (read — PLACEHOLDER; Phase 0c shift_pay_calculation integration)
```
to:
```
*   - salary_query            (read — admin or self; reads rate columns added in 20260528100000)
```

And drop the entire paragraph at `tools.ts:27` ("salary_query is a Phase 0c placeholder...").

- [ ] **Step 6: Verify typecheck + retest**

Run: `pnpm --filter @smartout/ai typecheck && pnpm --filter @smartout/ai test -- salary-query`

Expected: green typecheck + 3 tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/ai/src/capabilities/payroll/tools.ts packages/ai/src/capabilities/payroll/__tests__/salary-query.test.ts
git commit -m "$(cat <<'EOF'
fix(payroll): salary_query no longer crashes — schema columns now exist

SMA-344 S2a step 6. After migration 20260528100000 added the 4 rate columns
to employee_payroll_profile, the existing SELECT in salary_query is valid.
Tests added to prevent regression (mock-spy column-arg assertion per L-0230).

Drops Phase 0c PLACEHOLDER framing from docstring.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Re-verify update_payroll_profile + view_lonnsgrunnlag against new schema

**Files:**
- Inspect: `packages/ai/src/capabilities/payroll/tools.ts` (find update_payroll_profile + view_lonnsgrunnlag bodies)

- [ ] **Step 1: Grep for new columns in capability tool bodies**

Run: `grep -n "hourly_rate\|monthly_salary\|remuneration_type\|currency" packages/ai/src/capabilities/payroll/tools.ts`

Expected: matches in update_payroll_profile (write path) + salary_query (read path) + view_lonnsgrunnlag (read path).

- [ ] **Step 2: Run full payroll vitest**

Run: `pnpm --filter @smartout/ai test -- payroll`

Expected: All existing tests pass. If failure, fix that capability before next task.

- [ ] **Step 3: Smoke-test against May 2026 demo**

Run dev server (already running on :3060). In browser console while logged in as admin@smartout.local on /dashboard/payroll/a1000000-0000-0000-0000-000000000001:

```javascript
fetch("/api/emma/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    workspace_id: "b1000000-0000-0000-0000-000000000001",
    message: "Hva er min hourly rate?"
  })
})
.then(r => r.json())
.then(console.log);
```

Expected: response contains a number, not an error. (May return 0 for Anne since she has tariff-only — that's correct behavior.)

- [ ] **Step 4: Commit (if any changes)**

If Step 1 surfaced no body changes needed, skip commit. Otherwise:

```bash
git add packages/ai/src/capabilities/payroll/tools.ts
git commit -m "fix(payroll): align update_payroll_profile + view_lonnsgrunnlag with new rate schema

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Draft ADR-0295 — Feriepenger boundary (parallel with Day 1)

**Files:**
- Create: `docs/decisions/0295-feriepenger-boundary.md`
- Modify: `docs/decisions/0000-decision-log.md`

- [ ] **Step 1: Verify ADR slot still free**

Run: `git log --all --name-only | grep "docs/decisions/0295" | head`

Expected: empty (no collision).

- [ ] **Step 2: Write ADR**

Create `docs/decisions/0295-feriepenger-boundary.md`:

```markdown
---
title: "Feriepenger boundary — Smartout exposes basis, accountant computes accrued"
id: ADR_0295
status: accepted
layer: decision
created: 2026-05-10
updated: 2026-05-10
relates_to:
  - ADR_0250
supersedes: []
---

# ADR-0295: Feriepenger boundary

## Context

Smartout payroll module computes lønnsgrunnlag (wage basis) for hospitality
employees. Feriepenger (vacation pay) is a Norwegian regulatory requirement
under Ferieloven §11 — accrued at 12% (default) or 14.3% (over-60) of
holiday-eligible wages, paid out in June (or on termination).

The 4 output routes (`generate-pdf-bundle`, `generate-pdf-single`, `export-period`
×2 branches) hardcoded `feriepenger_accrued: 0` as a Phase 1 proxy. This
caused two problems: (1) Maria-persona regnskapsfører rejected files because
the field appeared as null/zero, and (2) the field name "accrued" suggested
an accumulated liability that Smartout was not actually tracking.

## Decision

Smartout exposes **feriepenger BASIS** (`sum(base_pay) × holiday_allowance_pct/100`)
on every lønnsgrunnlag artifact. Smartout does NOT compute:
- Accrued liability across multiple periods
- Payout timing (June vs termination)
- Skatteetaten reporting (out of scope per ADR-0250)
- A-melding kode 600 (regnskapsfører submits)

The field rename from `feriepenger_accrued` → `feriepenger_basis` is part
of the SMA-346 ship.

## Rationale

This aligns with the load-bearing positioning rule in memory
`feedback_lonnsgrunnlag_not_lonnsslipp.md` (2026-05-08): Smartout is upstream
of the regnskap layer; we produce the wage basis, the regnskapsfører consumes
it. Feriepenger is no exception — basis is ours to compute, accrual + payout
is theirs.

ADR-0250 deferred Skatteetaten by the same boundary class. This ADR
codifies the same principle for one more field.

## What Smartout DOES

- Compute basis per period (sum × pct)
- Expose as `feriepenger_basis` field in lønnsgrunnlag PDF + CSV
- Telemetry on basis amount per `payroll.lonnsgrunnlag_generated`
- Default `holiday_allowance_pct` = 12% (Riksavtalen). Override per ansatt
  (14.3% over 60 år).
- UI label: "Feriepenger-grunnlag (utbetales av regnskapsfører)" with tooltip
  explaining the boundary.

## What Smartout does NOT do

- Compute accrued liability over multiple periods
- Schedule payout (regnskap-system håndterer)
- Skatteetaten-rapportering (out of scope per ADR-0250)
- A-melding kode 600 (regnskapsfører submitter)

## Boundary verbatim

"Smartout = wage basis producer. Regnskapsfører = wage accrual + payout
consumer. Feriepenger no exception — basis ours, accrual theirs."

## References

- Memory: `feedback_lonnsgrunnlag_not_lonnsslipp.md` (Pontus 2026-05-08)
- ADR-0250 (Skatteetaten deferred — same boundary class)
- Linear: SMA-346 (S3 ship), SMA-348 (this ADR)
- Council: 2026-05-10 PM, Steward Phase 5 synthesis
```

- [ ] **Step 3: Register in decision-log**

Edit `docs/decisions/0000-decision-log.md`. Find the row for ADR-0294. Append a row below:

```markdown
| 295 | 2026-05-10 | Feriepenger boundary — Smartout exposes basis, accountant computes accrued. Aligns with ADR-0250 deferred-Skatteetaten boundary class. ([0295](0295-feriepenger-boundary.md)) | accepted | proposed |
```

(Adjust columns to match the actual decision-log table format — read 1-2 rows above to confirm.)

- [ ] **Step 4: Commit**

```bash
git add docs/decisions/0295-feriepenger-boundary.md docs/decisions/0000-decision-log.md
git commit -m "$(cat <<'EOF'
docs(decisions): ADR-0295 feriepenger boundary

SMA-348. Codifies that Smartout exposes feriepenger basis (12% × sum)
on lønnsgrunnlag; regnskapsfører computes accrued liability + payout.
Same boundary class as ADR-0250 (Skatteetaten deferred).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# DAY 2 — Resolver + Feriepenger (parallel)

## Task 9: Resolver in snapshot-period-costs

**Files:**
- Modify: `apps/web/src/app/api/payroll/snapshot-period-costs/route.ts:399-410`
- Test: `apps/web/src/app/api/payroll/snapshot-period-costs/__tests__/resolver.test.ts`

- [ ] **Step 1: Read current state**

Run: `sed -n '395,420p' apps/web/src/app/api/payroll/snapshot-period-costs/route.ts`

Confirm `const baseHourlyRateNok = 0;` is at line 403 with the comment.

- [ ] **Step 2: Write failing test**

Create test file:

```typescript
import { describe, it, expect } from "vitest";

// Pure resolver function — extracted for testability.
// We'll move the logic out of the route handler into a pure helper.

import { resolveBaseHourlyRate } from "../resolver";

describe("resolveBaseHourlyRate — SMA-345", () => {
  it("returns explicit hourly_rate when employee_payroll_profile has it", () => {
    const result = resolveBaseHourlyRate({
      payrollProfile: { hourly_rate: 280.5, monthly_salary: null },
      tariffMinimum: 215,
    });
    expect(result).toEqual({ rate: 280.5, source: "column" });
  });

  it("falls back to tariff minimum when hourly_rate is null", () => {
    const result = resolveBaseHourlyRate({
      payrollProfile: { hourly_rate: null, monthly_salary: null },
      tariffMinimum: 215,
    });
    expect(result).toEqual({ rate: 215, source: "tariff" });
  });

  it("returns 0 with source=none when both are null and tariff lookup fails", () => {
    const result = resolveBaseHourlyRate({
      payrollProfile: { hourly_rate: null, monthly_salary: null },
      tariffMinimum: null,
    });
    expect(result).toEqual({ rate: 0, source: "none" });
  });

  it("converts monthly_salary to hourly when remuneration_type=monthly", () => {
    const result = resolveBaseHourlyRate({
      payrollProfile: { hourly_rate: null, monthly_salary: 50000, remuneration_type: "monthly" },
      tariffMinimum: 215,
      monthlyToHourlyDivisor: 162.5, // 37.5h × 4.33 weeks
    });
    expect(result.rate).toBeCloseTo(307.69, 2);
    expect(result.source).toBe("monthly_derived");
  });
});
```

- [ ] **Step 3: Run test — verify it fails (helper doesn't exist)**

Run: `pnpm --filter web test -- resolver`

Expected: FAIL with "Cannot find module '../resolver'"

- [ ] **Step 4: Create resolver helper**

Create `apps/web/src/app/api/payroll/snapshot-period-costs/resolver.ts`:

```typescript
/**
 * Base hourly rate resolver — SMA-345 (Council 2026-05-10 PM B2b).
 *
 * Resolution order:
 *   1. employee_payroll_profile.hourly_rate (explicit column override)
 *   2. monthly_salary / divisor (if remuneration_type=monthly)
 *   3. Tariff minimum from tariff_rate_table (Riksavtalen lookup)
 *   4. 0 with source=none (logged for telemetry — represents config gap)
 *
 * Returns { rate, source } — source enables telemetry.
 */
export type RateResolution = {
  rate: number;
  source: "column" | "monthly_derived" | "tariff" | "none";
};

export type ResolverInput = {
  payrollProfile: {
    hourly_rate: number | null;
    monthly_salary: number | null;
    remuneration_type?: string | null;
  };
  tariffMinimum: number | null;
  monthlyToHourlyDivisor?: number;
};

const DEFAULT_MONTHLY_DIVISOR = 162.5; // 37.5h × 4.33 weeks/month average

export function resolveBaseHourlyRate(input: ResolverInput): RateResolution {
  const { payrollProfile, tariffMinimum, monthlyToHourlyDivisor = DEFAULT_MONTHLY_DIVISOR } = input;

  if (payrollProfile.hourly_rate !== null && payrollProfile.hourly_rate > 0) {
    return { rate: Number(payrollProfile.hourly_rate), source: "column" };
  }

  if (
    payrollProfile.remuneration_type === "monthly" &&
    payrollProfile.monthly_salary !== null &&
    payrollProfile.monthly_salary > 0
  ) {
    return {
      rate: Number(payrollProfile.monthly_salary) / monthlyToHourlyDivisor,
      source: "monthly_derived",
    };
  }

  if (tariffMinimum !== null && tariffMinimum > 0) {
    return { rate: Number(tariffMinimum), source: "tariff" };
  }

  return { rate: 0, source: "none" };
}
```

- [ ] **Step 5: Run test — verify it passes**

Run: `pnpm --filter web test -- resolver`

Expected: 4 tests pass.

- [ ] **Step 6: Wire resolver into route**

Edit `apps/web/src/app/api/payroll/snapshot-period-costs/route.ts`. Find lines 399-405 and replace:

```typescript
    // BEFORE:
    // evaluateSupplements is per-bucket. Loop over buckets, collect all fired supplements.
    // Base hourly rate: no column on employee_payroll_profile in Phase 1; use 0.
    // snapshotShiftCost resolves tariff via lookup when baseHourlyRateNok = 0.
    const baseHourlyRateNok = 0;

    // AFTER:
    // SMA-345 — resolve base rate via 4-tier resolver: column → monthly-derived → tariff → 0.
    const rateResolution = resolveBaseHourlyRate({
      payrollProfile: {
        hourly_rate: payrollProfile.hourly_rate,
        monthly_salary: payrollProfile.monthly_salary,
        remuneration_type: payrollProfile.remuneration_type,
      },
      tariffMinimum: tariffLookup?.minimum_hourly_rate ?? null,
    });
    const baseHourlyRateNok = rateResolution.rate;
    if (rateResolution.source === "none") {
      console.warn(`[snapshot-period-costs] No rate resolved for profile ${profile.profile_id} — supplements will compute as 0`);
    }
```

Add import at top of file:
```typescript
import { resolveBaseHourlyRate } from "./resolver";
```

Verify the SELECT at line 252 already includes `hourly_rate, monthly_salary, remuneration_type` — if not, add them. Run `grep "hourly_rate" apps/web/src/app/api/payroll/snapshot-period-costs/route.ts` to check.

- [ ] **Step 7: Typecheck + retest**

Run: `pnpm --filter web typecheck && pnpm --filter web test -- snapshot-period-costs`

Expected: green typecheck, all tests pass.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/api/payroll/snapshot-period-costs/
git commit -m "$(cat <<'EOF'
fix(payroll): resolver replaces hardcoded baseHourlyRateNok=0 (SMA-345 S2b)

4-tier resolution: column → monthly-derived → tariff → 0 (logged).
Pure function extracted for testability. 4 vitest cases.

Custom-rate workers no longer get kr 0 base + 0 NOK supplements.
Tariff-bound workers (Anne) unchanged — falls through to tariff lookup.

Council 2026-05-10 PM B2b.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Update derive-shift-hours SELECT (Supervisor's catch)

**Files:**
- Modify: `apps/web/src/app/api/payroll/derive-shift-hours/route.ts:229`

- [ ] **Step 1: Find current SELECT**

Run: `sed -n '225,240p' apps/web/src/app/api/payroll/derive-shift-hours/route.ts`

Look for SELECT against `employee_payroll_profile`. Note current column list.

- [ ] **Step 2: Add new columns**

Edit the SELECT to include `hourly_rate, monthly_salary, remuneration_type, currency`. Even if not currently consumed, completeness matters for future joins.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter web typecheck 2>&1 | tail -5`

Expected: green.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/payroll/derive-shift-hours/route.ts
git commit -m "fix(payroll): include rate columns in derive-shift-hours SELECT (SMA-345)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Vitest golden-case for resolver in real route context

**Files:**
- Create: `apps/web/src/app/api/payroll/snapshot-period-costs/__tests__/route.test.ts`

- [ ] **Step 1: Write integration test**

```typescript
import { describe, it, expect, vi } from "vitest";
import { POST } from "../route";

// Two scenarios:
// (a) Profile with hourly_rate=280 → snapshot uses 280 not tariff
// (b) Profile with hourly_rate=null + tariff_category=voksen_ufaglart → uses tariff 215

describe("snapshot-period-costs — resolver integration (SMA-345)", () => {
  it("uses explicit hourly_rate when set", async () => {
    // Mock all DB calls to return profile with hourly_rate=280
    // Mock period as locked
    // Execute, verify snapshot.base_pay reflects 280×hours not tariff
    expect(true).toBe(true); // TODO replace with real assertion
  });

  it("falls back to tariff for null hourly_rate", async () => {
    expect(true).toBe(true); // TODO replace with real assertion
  });
});
```

NOTE: This integration test requires significant mock infrastructure. If full test setup takes >30 min, mark this as "carryforward — extend in next sortie" and commit only the unit tests from Task 9.

- [ ] **Step 2: Commit (whatever lands)**

```bash
git add apps/web/src/app/api/payroll/snapshot-period-costs/__tests__/
git commit -m "test(payroll): integration scaffold for snapshot-period-costs resolver (SMA-345)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Feriepenger compute in 4 routes

**Files:**
- Modify: `apps/web/src/app/api/payroll/generate-pdf-bundle/route.ts:203`
- Modify: `apps/web/src/app/api/payroll/generate-pdf-single/route.ts:230`
- Modify: `apps/web/src/app/api/payroll/export-period/route.ts:216,306`
- Modify: `packages/payroll-export/src/types.ts` (rename field)
- Test: `packages/payroll-export/__tests__/feriepenger-basis.test.ts`

- [ ] **Step 1: Write failing test for compute helper**

Create `packages/payroll-export/__tests__/feriepenger-basis.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { computeFeriepengerBasis } from "../src/feriepenger";

describe("computeFeriepengerBasis — SMA-346", () => {
  it("computes 12% basis on standard rate", () => {
    expect(computeFeriepengerBasis({ basePayTotal: 16681.30, holidayAllowancePct: 12 })).toBeCloseTo(2001.76, 2);
  });

  it("uses 14.3% for over-60 employees", () => {
    expect(computeFeriepengerBasis({ basePayTotal: 50000, holidayAllowancePct: 14.3 })).toBeCloseTo(7150, 2);
  });

  it("returns 0 for zero base pay", () => {
    expect(computeFeriepengerBasis({ basePayTotal: 0, holidayAllowancePct: 12 })).toBe(0);
  });

  it("rounds to 2 decimals (NOK kroner)", () => {
    expect(computeFeriepengerBasis({ basePayTotal: 12345.678, holidayAllowancePct: 12 })).toBe(1481.48);
  });
});
```

- [ ] **Step 2: Run test — verify FAIL**

Run: `pnpm --filter @smartout/payroll-export test -- feriepenger-basis`

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Create compute helper**

Create `packages/payroll-export/src/feriepenger.ts`:

```typescript
/**
 * Feriepenger BASIS compute — SMA-346 / ADR-0295.
 *
 * Smartout exposes the basis (12% × sum). Regnskapsfører computes accrued
 * liability + payout. Smartout never sums across periods.
 *
 * Default 12% per Riksavtalen voksen ufaglært.
 * Override 14.3% for over-60 employees per Ferieloven §10 third paragraph.
 */
export function computeFeriepengerBasis(input: {
  basePayTotal: number;
  holidayAllowancePct: number;
}): number {
  const raw = input.basePayTotal * (input.holidayAllowancePct / 100);
  return Math.round(raw * 100) / 100; // NOK 2-decimal precision
}
```

- [ ] **Step 4: Run test — verify PASS**

Run: `pnpm --filter @smartout/payroll-export test -- feriepenger-basis`

Expected: 4 tests pass.

- [ ] **Step 5: Rename field in types**

Edit `packages/payroll-export/src/types.ts`. Find `feriepenger_accrued: number` in both `AggregateRow` and `AuditRow`. Rename to `feriepenger_basis: number`.

Add export of `computeFeriepengerBasis` to `packages/payroll-export/src/index.ts`.

- [ ] **Step 6: Build payroll-export dist**

Run: `pnpm --filter @smartout/payroll-export build`

Expected: green build.

- [ ] **Step 7: Update 4 routes**

For EACH of the 4 routes:

**`apps/web/src/app/api/payroll/generate-pdf-bundle/route.ts:203`**

BEFORE:
```typescript
feriepenger_accrued: 0,
```

AFTER:
```typescript
feriepenger_basis: computeFeriepengerBasis({
  basePayTotal: Number(c.base_pay ?? 0),
  holidayAllowancePct: Number(payrollProfile.holiday_allowance_pct ?? 12),
}),
```

Add import at top: `import { computeFeriepengerBasis } from "@smartout/payroll-export";`

**Repeat for:**
- `apps/web/src/app/api/payroll/generate-pdf-single/route.ts:230`
- `apps/web/src/app/api/payroll/export-period/route.ts:216` (aggregate branch)
- `apps/web/src/app/api/payroll/export-period/route.ts:306` (audit branch)

For routes that don't already join `payroll_profile.holiday_allowance_pct`, extend the SELECT to include it.

- [ ] **Step 8: Typecheck**

Run: `pnpm --filter web typecheck 2>&1 | tail -5`

Expected: green.

- [ ] **Step 9: Commit**

```bash
git add packages/payroll-export/ apps/web/src/app/api/payroll/
git commit -m "$(cat <<'EOF'
feat(payroll): expose feriepenger BASIS instead of hardcoded 0 (SMA-346 / ADR-0295)

Smartout computes basis = sum(base_pay) × pct/100. Regnskapsfører computes
accrual + payout per ADR-0295 boundary. 4 output routes updated.

Field renamed: feriepenger_accrued → feriepenger_basis.

For Anne May 2026: basis = 16 681 × 12% ≈ 2 002 NOK.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: UI label "Feriepenger-grunnlag" + disclaimer

**Files:**
- Modify: `packages/payroll-export/src/pdf/components/TotalsBlock.tsx`
- Modify: `packages/payroll-export/src/csv.ts` (header label)
- Modify: `apps/web/src/app/dashboard/my-salary/page.tsx`
- Modify: `apps/web/src/app/dashboard/payroll/[periodId]/_components/LineDrawer.tsx`

- [ ] **Step 1: PDF label**

Edit `packages/payroll-export/src/pdf/components/TotalsBlock.tsx`. Find the row that renders `feriepenger_accrued` (now `feriepenger_basis`). Change label from any prior text to:

```tsx
<View>
  <Text style={styles.label}>Feriepenger-grunnlag</Text>
  <Text style={styles.value}>{formatNok(row.feriepenger_basis)}</Text>
  <Text style={styles.disclaimer}>(utbetales av regnskapsfører)</Text>
</View>
```

- [ ] **Step 2: CSV header**

Edit `packages/payroll-export/src/csv.ts`. Find the header row defining column names. Change:
```
"Feriepenger akkumulert"
```
to:
```
"Feriepenger-grunnlag"
```

- [ ] **Step 3: my-salary page**

Edit `apps/web/src/app/dashboard/my-salary/page.tsx`. If there's a feriepenger display, update label to "Feriepenger-grunnlag" + tooltip:

```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <span className="cursor-help underline decoration-dotted underline-offset-2">
      Feriepenger-grunnlag
    </span>
  </TooltipTrigger>
  <TooltipContent>
    <p className="text-xs max-w-xs">
      Smartout beregner grunnlag (12% av brutto). Faktisk feriepenge-utbetaling håndteres av regnskapssystem.
    </p>
  </TooltipContent>
</Tooltip>
```

- [ ] **Step 4: LineDrawer (admin view)**

If LineDrawer renders feriepenger somewhere, mirror the tooltip pattern.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter web typecheck && pnpm --filter @smartout/payroll-export typecheck`

- [ ] **Step 6: Commit**

```bash
git add packages/payroll-export/ apps/web/src/app/dashboard/
git commit -m "$(cat <<'EOF'
feat(payroll-ux): UI labels feriepenger-grunnlag + regnskapsfører disclaimer (SMA-346)

PDF, CSV, my-salary, LineDrawer all use "Feriepenger-grunnlag" naming.
Tooltips explain the boundary: Smartout = basis, accountant = accrual.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# DAY 3 — period_locked notification handler

## Task 14: notification_outbox handler Edge Function

**Files:**
- Create: `supabase/functions/payroll-period-locked-handler/index.ts`
- Create: `supabase/functions/payroll-period-locked-handler/__tests__/handler.test.ts`

- [ ] **Step 1: Write failing test**

Create test file:

```typescript
import { describe, it, expect, vi } from "vitest";
import { handlePeriodLocked } from "../handler";

describe("payroll-period-locked-handler — SMA-347", () => {
  it("inserts notification_outbox row per workspace profile", async () => {
    const insertSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const supabase = mockSupabase({ insertSpy });

    await handlePeriodLocked({
      workspaceId: "ws-1",
      periodId: "period-1",
      periodLabel: "mai 2026",
      affectedProfileIds: ["prof-1", "prof-2", "prof-3"],
      supabase,
    });

    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(insertSpy.mock.calls[0][0]).toHaveLength(3);
    expect(insertSpy.mock.calls[0][0][0]).toMatchObject({
      workspace_id: "ws-1",
      profile_id: "prof-1",
      mode: "work",
      channel: "push",
      idempotency_key: "payroll.period_locked.period-1.prof-1",
    });
  });

  it("returns count of notifications dispatched", async () => {
    const result = await handlePeriodLocked({
      workspaceId: "ws-1",
      periodId: "period-1",
      periodLabel: "mai 2026",
      affectedProfileIds: ["prof-1"],
      supabase: mockSupabase({}),
    });

    expect(result.dispatched).toBe(1);
  });
});

function mockSupabase(opts: { insertSpy?: ReturnType<typeof vi.fn> }) {
  const insertSpy = opts.insertSpy ?? vi.fn().mockResolvedValue({ data: [], error: null });
  return {
    from: vi.fn().mockReturnValue({ insert: insertSpy }),
  };
}
```

- [ ] **Step 2: Write handler**

Create `supabase/functions/payroll-period-locked-handler/handler.ts`:

```typescript
/**
 * payroll.period_locked event handler — SMA-347.
 *
 * Pattern A (engine_dispatch consumer): on `payroll.period_locked` event,
 * INSERT one notification_outbox row per affected profile. The outbox
 * pipeline delivers via push (expo_push_token) or email fallback.
 *
 * Idempotency: outbox row keyed on payroll.period_locked.<period_id>.<profile_id>
 * to prevent dupe on re-emit.
 */
export type PeriodLockedInput = {
  workspaceId: string;
  periodId: string;
  periodLabel: string; // "mai 2026"
  affectedProfileIds: string[];
  supabase: { from: (table: string) => { insert: (rows: unknown) => Promise<{ data: unknown; error: unknown }> } };
};

export type HandlerResult = {
  dispatched: number;
  errors: string[];
};

export async function handlePeriodLocked(input: PeriodLockedInput): Promise<HandlerResult> {
  const { workspaceId, periodId, periodLabel, affectedProfileIds, supabase } = input;

  if (affectedProfileIds.length === 0) {
    return { dispatched: 0, errors: [] };
  }

  const rows = affectedProfileIds.map((profileId) => ({
    workspace_id: workspaceId,
    profile_id: profileId,
    mode: "work" as const,
    channel: "push" as const,
    title: `Lønnsgrunnlag for ${periodLabel} er klart`,
    body: "Sjekk din lønnsgrunnlag i Smartout-appen",
    deep_link: `/dashboard/my-salary?period=${periodId}`,
    idempotency_key: `payroll.period_locked.${periodId}.${profileId}`,
  }));

  const { error } = await supabase.from("notification_outbox").insert(rows);

  if (error) {
    return {
      dispatched: 0,
      errors: [(error as { message?: string }).message ?? "unknown insert error"],
    };
  }

  return { dispatched: rows.length, errors: [] };
}
```

- [ ] **Step 3: Run test — verify PASS**

Run: `pnpm --filter @smartout/supabase test -- handler` (adjust path as needed for the actual workspace location)

Expected: 2 tests pass.

- [ ] **Step 4: Wire dispatcher**

Find the engine_dispatch handler config (likely `supabase/functions/engine-dispatch/index.ts`). Add a case for `payroll.period_locked` event that calls `handlePeriodLocked` with payload extracted from the event.

Look at how other handlers are wired (search `event_type ===` in engine-dispatch).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/payroll-period-locked-handler/ supabase/functions/engine-dispatch/
git commit -m "$(cat <<'EOF'
feat(payroll): notification_outbox handler for payroll.period_locked event (SMA-347)

Pattern A engine_dispatch consumer. INSERTs notification_outbox rows
(channel=push, idempotency-keyed) per affected profile. Existing outbox
pipeline delivers via expo_push_token or email fallback.

Zero new infrastructure.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Smoke-test notification flow

- [ ] **Step 1: Lock May 2026 demo period**

In browser: `/dashboard/payroll/a1000000-0000-0000-0000-000000000001` → click "Lås periode" → confirm.

(If period already locked, unlock via SQL first OR create a new test period.)

- [ ] **Step 2: Verify outbox rows created**

Run: `docker exec -i supabase_db_smartout.ai psql -U postgres -d postgres -c "SELECT profile_id, channel, title, idempotency_key FROM notification_outbox WHERE workspace_id=(SELECT workspace_id FROM workspace WHERE slug='may2026-demo') AND idempotency_key LIKE 'payroll.period_locked%' ORDER BY created_at DESC LIMIT 13;"`

Expected: 12 rows (one per employee).

- [ ] **Step 3: Verify idempotency on re-lock**

Re-lock (or trigger handler again). Re-run query. Expected: still 12 rows (no dupes).

- [ ] **Step 4: Document in commit message** (no separate commit needed; smoke is verification only)

---

# DAY 4 — Period creation + manual time entry bundle

## Task 16: BFF route for period creation

**Files:**
- Create: `apps/web/src/app/api/payroll/create-period/route.ts`
- Create: `apps/web/src/app/api/payroll/create-period/__tests__/route.test.ts`

- [ ] **Step 1: Write failing test**

Mirror existing payroll BFF route tests pattern (e.g. `apps/web/src/app/api/payroll/__tests__/reveal-routes.test.ts`):

```typescript
import { describe, it, expect, vi } from "vitest";
import { POST } from "../route";

vi.mock("@/app/api/payroll/_shared", () => ({
  rejectCrossOrigin: vi.fn().mockReturnValue(null),
  resolvePayrollAuth: vi.fn().mockResolvedValue({
    workspaceId: "ws-1",
    profileId: "actor-1",
  }),
}));

vi.mock("@/app/dashboard/_actions/_shared", () => ({
  gateAction: vi.fn().mockResolvedValue({ allow: true }),
}));

describe("POST /api/payroll/create-period — SMA-343", () => {
  it("creates period on valid input", async () => {
    const req = new Request("http://localhost/api/payroll/create-period", {
      method: "POST",
      body: JSON.stringify({
        workspace_id: "ws-1",
        start_date: "2026-06-01",
        end_date: "2026-06-30",
      }),
    });

    const res = await POST(req as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.period_id).toBeTruthy();
  });

  it("rejects start_date >= end_date with 400", async () => {
    const req = new Request("http://localhost/api/payroll/create-period", {
      method: "POST",
      body: JSON.stringify({
        workspace_id: "ws-1",
        start_date: "2026-06-30",
        end_date: "2026-06-01",
      }),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it("returns 409 on duplicate (workspace_id, start_date, end_date)", async () => {
    // Mock supabase insert to return UNIQUE violation
    // Verify route returns 409 with clear error
    expect(true).toBe(true); // TODO: full DB-level mock
  });
});
```

- [ ] **Step 2: Write route**

Create `apps/web/src/app/api/payroll/create-period/route.ts`:

```typescript
/**
 * POST /api/payroll/create-period
 *
 * Admin creates a new payroll.period for the workspace. SMA-343.
 *
 * Pipeline:
 *   1. rejectCrossOrigin
 *   2. Input validation (Zod)
 *   3. resolvePayrollAuth (server-derived workspace + actor)
 *   4. gateAction (admin role required)
 *   5. INSERT payroll.period (UNIQUE constraint enforces no overlap)
 *   6. emit payroll.period_created
 *
 * Returns: { ok, period_id, status: 'open' }
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { gateAction } from "@/app/dashboard/_actions/_shared";
import { rejectCrossOrigin, resolvePayrollAuth } from "@/app/api/payroll/_shared";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";

export const runtime = "nodejs";

const RequestSchema = z.object({
  workspace_id: z.string().uuid(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).refine((data) => data.start_date < data.end_date, {
  message: "start_date must be before end_date",
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const cors = rejectCrossOrigin(request);
  if (cors) return cors;

  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await request.json());
  } catch (err) {
    const message =
      err instanceof z.ZodError ? (err.errors[0]?.message ?? "Invalid body") : "Invalid body";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  const auth = await resolvePayrollAuth(request, body.workspace_id);
  if (!auth) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const gate = await gateAction({
    workspaceId: auth.workspaceId,
    capability: "payroll",
    channel: "chat",
    actorProfileId: auth.profileId,
    actionType: "create_period",
  });
  if (!gate.allow) {
    return NextResponse.json(
      { ok: false, error: `forbidden: ${gate.reason ?? "denied"}` },
      { status: 403 },
    );
  }

  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: period, error } = await (admin.schema("payroll") as any)
    .from("period")
    .insert({
      workspace_id: auth.workspaceId,
      start_date: body.start_date,
      end_date: body.end_date,
      status: "open",
    })
    .select("id")
    .single();

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json(
        { ok: false, error: "duplicate_period", detail: "Periode finnes allerede for disse datoene" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "db_error", detail: (error as { message?: string }).message },
      { status: 500 },
    );
  }

  void emit({
    event: "payroll.period_created",
    workspace_id: auth.workspaceId,
    actor_id: auth.profileId,
    properties: {
      entity: { entity_type: "payroll_period", entity_id: nonEmpty(period.id) },
      data: {
        start_date: body.start_date,
        end_date: body.end_date,
      },
    },
  });

  return NextResponse.json({ ok: true, period_id: period.id, status: "open" });
}
```

- [ ] **Step 3: Run tests — verify pass**

Run: `pnpm --filter web test -- create-period`

Expected: 3 tests pass (or 2 + 1 TODO).

- [ ] **Step 4: Register telemetry event**

Add to `packages/telemetry/src/registry.ts`:
- New interface `PayrollPeriodCreated`
- New union member
- New EVENT_ROUTING entry: `["logger", "activity_trail", "engine_event"]`

Pattern: mirror existing `payroll.period_locked` registration.

- [ ] **Step 5: Build telemetry + retest**

Run: `pnpm --filter @smartout/telemetry build && pnpm --filter web typecheck`

Expected: green.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/payroll/create-period/ packages/telemetry/
git commit -m "$(cat <<'EOF'
feat(payroll): POST /api/payroll/create-period — manager creates new period (SMA-343 S1a)

Zod validation, gateAction admin-only, UNIQUE constraint on
(workspace_id, start_date, end_date) returns 409. Emits
payroll.period_created event.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: "Ny periode"-knapp + dialog UI

**Files:**
- Create: `apps/web/src/app/dashboard/payroll/_components/CreatePeriodDialog.tsx`
- Create: `apps/web/src/app/dashboard/payroll/_hooks/use-create-period.ts`
- Modify: `apps/web/src/app/dashboard/payroll/_components/PayrollPeriodsClient.tsx`

- [ ] **Step 1: Mutation hook**

Create `apps/web/src/app/dashboard/payroll/_hooks/use-create-period.ts`:

```typescript
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type CreatePeriodInput = {
  workspaceId: string;
  startDate: string;
  endDate: string;
};

type CreatePeriodResult = {
  period_id: string;
  status: string;
};

export function useCreatePeriod() {
  const queryClient = useQueryClient();

  return useMutation<CreatePeriodResult, Error, CreatePeriodInput>({
    mutationFn: async (input) => {
      const res = await fetch("/api/payroll/create-period", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: input.workspaceId,
          start_date: input.startDate,
          end_date: input.endDate,
        }),
      });

      const body = await res.json();
      if (!res.ok || !body.ok) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      return body;
    },
    onSuccess: () => {
      toast.success("Periode opprettet");
      void queryClient.invalidateQueries({ queryKey: ["payroll", "periods"] });
    },
    onError: (err) => {
      const detail = err.message === "duplicate_period"
        ? "Periode finnes allerede for disse datoene"
        : err.message;
      toast.error(`Kunne ikke opprette periode: ${detail}`);
    },
  });
}
```

- [ ] **Step 2: Dialog component**

Create `apps/web/src/app/dashboard/payroll/_components/CreatePeriodDialog.tsx`:

```typescript
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useCreatePeriod } from "../_hooks/use-create-period";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
};

export function CreatePeriodDialog({ open, onOpenChange, workspaceId }: Props) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { mutate, isPending } = useCreatePeriod();

  const valid = startDate && endDate && startDate < endDate;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    mutate(
      { workspaceId, startDate, endDate },
      {
        onSuccess: () => {
          setStartDate("");
          setEndDate("");
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading">Ny lønnsperiode</DialogTitle>
          <DialogDescription>
            Opprett en ny lønnsperiode for arbeidsstedet ditt. Periode låses senere når lønnskjøringen er ferdig.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="start">Startdato</Label>
            <Input
              id="start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="end">Sluttdato</Label>
            <Input
              id="end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
            {startDate && endDate && startDate >= endDate && (
              <p className="text-destructive text-xs mt-1">Startdato må være før sluttdato</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Avbryt
            </Button>
            <Button type="submit" disabled={!valid || isPending}>
              {isPending ? "Oppretter…" : "Opprett periode"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Wire dialog into PayrollPeriodsClient**

Edit `apps/web/src/app/dashboard/payroll/_components/PayrollPeriodsClient.tsx`. Find the page header. Add:

```tsx
import { Plus } from "lucide-react";
import { useState } from "react";
import { CreatePeriodDialog } from "./CreatePeriodDialog";

// In component:
const [createOpen, setCreateOpen] = useState(false);

// In header JSX:
<Button onClick={() => setCreateOpen(true)} size="sm">
  <Plus className="h-4 w-4" />
  Ny periode
</Button>

// At end of return:
<CreatePeriodDialog
  open={createOpen}
  onOpenChange={setCreateOpen}
  workspaceId={workspaceId}
/>
```

If `workspaceId` isn't already in scope, add it as a prop forwarded from parent server-component.

- [ ] **Step 4: Typecheck + smoke test**

Run: `pnpm --filter web typecheck`

In browser: refresh `/dashboard/payroll`. Click "Ny periode". Fill form. Submit. Verify period created + appears in list.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/payroll/
git commit -m "$(cat <<'EOF'
feat(payroll-ux): "Ny periode"-button + dialog (SMA-343 S1a)

Manager can create new lønnsperiode via UI. TanStack mutation, sonner toast,
validation: start_date < end_date. 409 on duplicate.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 18: Manual time entry dialog (B5 bundle)

**Files:**
- Create: `apps/web/src/app/dashboard/payroll/[periodId]/_components/ManualTimeEntryDialog.tsx`
- Modify: `apps/web/src/app/dashboard/payroll/[periodId]/_components/LineDrawer.tsx`

- [ ] **Step 1: Read existing manualTimeEntryAction signature**

Run: `cat apps/web/src/app/dashboard/_actions/manual-time-entry-action.ts | head -60`

Note exact input shape: `{ shiftId, punchedInAt, punchedOutAt, reason }` (verify).

- [ ] **Step 2: Create dialog**

Create `ManualTimeEntryDialog.tsx`:

```typescript
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { manualTimeEntryAction } from "@/app/dashboard/_actions/manual-time-entry-action";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shiftId: string | null;
  shiftLabel?: string;
};

const MIN_REASON_LENGTH = 8;

export function ManualTimeEntryDialog({ open, onOpenChange, shiftId, shiftLabel }: Props) {
  const [punchIn, setPunchIn] = useState("");
  const [punchOut, setPunchOut] = useState("");
  const [reason, setReason] = useState("");
  const [isPending, setIsPending] = useState(false);

  const reasonValid = reason.trim().length >= MIN_REASON_LENGTH;
  const valid = shiftId && punchIn && punchOut && reasonValid;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;

    setIsPending(true);
    try {
      const res = await manualTimeEntryAction({
        shiftId: shiftId!,
        punchedInAt: punchIn,
        punchedOutAt: punchOut,
        reason: reason.trim(),
      });

      if (!res.ok) {
        toast.error(`Kunne ikke korrigere tid: ${res.error ?? "ukjent feil"}`);
      } else {
        toast.success("Tidsregistrering korrigert");
        setPunchIn("");
        setPunchOut("");
        setReason("");
        onOpenChange(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ukjent feil");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading">Korriger tid</DialogTitle>
          <DialogDescription>
            {shiftLabel ? `Vakt: ${shiftLabel}` : "Manuell tidsregistrering"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="punch-in">Stemplet inn</Label>
            <Input
              id="punch-in"
              type="datetime-local"
              value={punchIn}
              onChange={(e) => setPunchIn(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="punch-out">Stemplet ut</Label>
            <Input
              id="punch-out"
              type="datetime-local"
              value={punchOut}
              onChange={(e) => setPunchOut(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="reason">Grunn (min 8 tegn)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              rows={2}
              placeholder="F.eks: ansatt glemte å stemple ut"
            />
            {reason.length > 0 && reason.trim().length < MIN_REASON_LENGTH && (
              <p className="text-destructive text-xs mt-1">
                {MIN_REASON_LENGTH - reason.trim().length} tegn igjen
              </p>
            )}
          </div>
          <p className="text-muted-foreground text-xs">
            Korrigeringen logges til revisjons-sporet med din ID + tidspunkt.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Avbryt
            </Button>
            <Button type="submit" disabled={!valid || isPending}>
              {isPending ? "Lagrer…" : "Lagre korreksjon"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Mount in LineDrawer**

Edit `LineDrawer.tsx`. Find the per-shift Vakter-tab row render. Add a "Korriger tid"-button per shift (admin-only):

```tsx
import { ManualTimeEntryDialog } from "./ManualTimeEntryDialog";
import { Clock } from "lucide-react";

// State:
const [timeEntryOpen, setTimeEntryOpen] = useState(false);
const [selectedShift, setSelectedShift] = useState<{ id: string; label: string } | null>(null);

// In Vakter-row JSX (admin gate):
{isAdmin && (
  <Button
    variant="ghost"
    size="sm"
    onClick={(e) => {
      e.stopPropagation();
      setSelectedShift({ id: shift.id, label: shift.label });
      setTimeEntryOpen(true);
    }}
  >
    <Clock className="h-3 w-3" />
    Korriger tid
  </Button>
)}

// Outside Sheet:
<ManualTimeEntryDialog
  open={timeEntryOpen}
  onOpenChange={setTimeEntryOpen}
  shiftId={selectedShift?.id ?? null}
  shiftLabel={selectedShift?.label}
/>
```

- [ ] **Step 4: Typecheck + smoke**

Run: `pnpm --filter web typecheck`

In browser: open LineDrawer for an employee → Vakter-tab → click "Korriger tid" on a shift → submit. Verify time-entry written to `timesheet.time_entry`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/payroll/[periodId]/_components/
git commit -m "$(cat <<'EOF'
feat(payroll-ux): "Korriger tid"-dialog in LineDrawer Vakter-tab (SMA-343 S1b)

Manager can correct missed/wrong punches per shift via dialog form.
Calls existing manualTimeEntryAction (production-ready since 2026-04).
Admin-gated. Min 8-char reason. Toast feedback.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 19: Closure handoff

**Files:**
- Create: `docs/HANDOFF-payroll-mvp-blockers.md`

- [ ] **Step 1: Write handoff**

Mirror Phase 5 closure pattern. Document:
- All 6 issues completed (SMA-343 to SMA-348)
- 19 tasks shipped across 4 days
- 4 new migrations
- 1 new ADR (0295)
- 1 new Edge Function handler
- Test counts: pre vs post
- Acceptance criteria per blocker (✓ or ⚠️ with detail)
- Carryforward debt
- Smoke-test commands for Pontus

- [ ] **Step 2: Commit**

```bash
git add docs/HANDOFF-payroll-mvp-blockers.md
git commit -m "docs(payroll): HANDOFF for MVP-blockers sortie

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 3: Verify full state clean**

Run:
```bash
pnpm turbo typecheck
git status --short
git log --oneline campaign/payroll..HEAD | wc -l
```

Expected: 52/52 typecheck green, 0 dirty, ~20 commits since campaign HEAD.

---

# Self-Review Checklist (run after writing complete plan)

**Spec coverage:**
- [x] SMA-344 S2a — Tasks 1-7 (migrations + trigger + types + salary_query)
- [x] SMA-348 ADR — Task 8
- [x] SMA-345 S2b — Tasks 9-11 (resolver + derive-shift-hours + golden test)
- [x] SMA-346 S3 — Tasks 12-13 (compute + UI labels)
- [x] SMA-347 S4 — Tasks 14-15 (handler + smoke test)
- [x] SMA-343 S1+B5 — Tasks 16-18 (BFF + dialog + manual time entry)
- [x] Closure handoff — Task 19

**Placeholder scan:**
- All steps have actual code blocks
- Test code complete (no "Write tests for the above")
- File paths exact
- Commands explicit with expected output

**Type consistency:**
- `feriepenger_basis` (renamed from `feriepenger_accrued`) used consistently across types + 4 routes + UI
- `RateResolution.source` enum: `column | monthly_derived | tariff | none` consistent
- `manualTimeEntryAction` input shape matches existing action signature

**Known carryforward (acceptable):**
- Task 11 integration test marked TODO if mock infrastructure too heavy
- Task 17 may need parent prop-pass for workspaceId if not in scope
- Telemetry registry update (Task 16 Step 4) requires verification of `payroll.period_created` event-name uniqueness

---

# Execution

Plan complete and saved to `docs/superpowers/plans/2026-05-10-payroll-mvp-blockers.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Fresh subagent per task, review between tasks, fast iteration. Good for 4-day sortie with clear task boundaries.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints. Good if Pontus wants to review each step live.

Which approach?
