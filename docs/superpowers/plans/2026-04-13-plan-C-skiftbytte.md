---
title: "Plan C — Skiftbytte"
status: draft
updated: 2026-04-13
created: 2026-04-13
module: scheduling
tags: [skiftbytte, shift-swap, event-engine, plan]
---

# Plan C — Skiftbytte Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement shift swap as an Event Engine workflow — Employee A requests, Employee B accepts, Manager approves. Uses engine_process/engine_state (no new tables per ADR-0067). SECURITY DEFINER RPCs for employee-initiated actions. D3 validation at request time.

**Architecture:** engine_process blueprint + 3 SECURITY DEFINER RPCs + validation in packages/utils + web schedule UI + agent capability. Final mutation lands on schedule_shift.employee_id.

**Tech Stack:** PostgreSQL (RPCs), Next.js, TanStack Query, shadcn/ui, @smartout/telemetry, packages/ai capabilities

**Spec:** `docs/superpowers/specs/2026-04-13-missing-features-renhold-drift-skiftbytte-design.md` § Feature 3

**IMPORTANT:** This plan touches `/dashboard/schedule/`, `packages/utils/src/swap/`, `packages/ai/src/capabilities/shift-swap/`, `packages/telemetry/`, and a new migration. Do NOT modify operations, HMS, or governance files.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `packages/i18n/locales/nb/swap.json` | Norwegian swap labels |
| Create | `packages/i18n/locales/en/swap.json` | English swap labels |
| Modify | `packages/telemetry/src/registry.ts` | Register 6 swap events |
| Modify | `packages/ai/src/capabilities/types.ts` | Add shift_swap to CapabilityName |
| Create | `packages/ai/src/capabilities/shift-swap/index.ts` | Capability definition |
| Create | `packages/ai/src/capabilities/shift-swap/tools.ts` | Agent tools |
| Modify | `packages/ai/src/capabilities/registry.ts` | Register shift_swap capability |
| Modify | `packages/ai/src/agents/botsson.ts` | Wire capabilities |
| Create | `packages/utils/src/swap/validate-swap.ts` | D3 validation logic (pure function) |
| Create | `packages/utils/src/swap/types.ts` | ShiftSwapContext Zod schema |
| Create | `supabase/migrations/YYYYMMDDHHMMSS_shift_swap_engine.sql` | engine_process seed + RPCs |
| Create | `apps/web/src/app/dashboard/schedule/_hooks/use-shift-swap.ts` | Web swap hooks |
| Create | `apps/web/src/app/dashboard/schedule/_components/SwapRequestDialog.tsx` | Swap request UI |
| Create | `apps/web/src/app/dashboard/schedule/_components/SwapApprovalSection.tsx` | Manager approval UI |

---

### Task 1: Swap Types and Validation Logic

**Files:**
- Create: `packages/utils/src/swap/types.ts`
- Create: `packages/utils/src/swap/validate-swap.ts`

- [ ] **Step 1: Create ShiftSwapContext Zod schema**

```typescript
// packages/utils/src/swap/types.ts

import { z } from "zod";

export const shiftSwapContextSchema = z.object({
  requester_profile_id: z.string().uuid(),
  target_profile_id: z.string().uuid(),
  requester_shift_id: z.string().uuid(),
  target_shift_id: z.string().uuid(),
  swap_type: z.literal("mutual_exchange"),
  reason: z.string().optional(),
  validation_result: z.object({
    eligible: z.boolean(),
    blockers: z.array(z.string()),
    warnings: z.array(z.string()),
    tariff_delta: z.number().optional(),
  }),
  status: z.enum([
    "pending_recipient",
    "pending_manager",
    "approved",
    "rejected",
    "cancelled",
    "executed",
  ]),
  rejected_by: z.string().uuid().optional(),
  rejection_reason: z.string().optional(),
  executed_at: z.string().datetime().optional(),
});

export type ShiftSwapContext = z.infer<typeof shiftSwapContextSchema>;

export type SwapValidationResult = {
  eligible: boolean;
  blockers: string[];
  warnings: string[];
  tariff_delta?: number;
};

export type ShiftForValidation = {
  schedule_shift_id: string;
  employee_id: string | null;
  shift_date: string;
  start_time: string;
  end_time: string;
  work_hours: number;
  position_id: string | null;
  status: string;
};
```

- [ ] **Step 2: Create validation logic (pure function, no React)**

```typescript
// packages/utils/src/swap/validate-swap.ts

/**
 * D3 Rules validation for shift swap eligibility.
 * Pure function — no Supabase, no React. Importable from web, mobile, and RPCs.
 * Checks: temporal lock, overlap, qualification, absence, weekly hours, rest, split shift.
 */

import type { ShiftForValidation, SwapValidationResult } from "./types";

const WEEKLY_HOURS_LIMIT = 37.5;
const REST_HOURS_MINIMUM = 11;
const SPLIT_SHIFT_GAP_HOURS = 2;
const SPLIT_SHIFT_SUPPLEMENT_KR = 28;

export function validateSwap(params: {
  requesterShift: ShiftForValidation;
  targetShift: ShiftForValidation;
  targetEmployeeShifts: ShiftForValidation[];
  requesterEmployeeShifts: ShiftForValidation[];
  targetHasAbsence: boolean;
  requesterHasAbsence: boolean;
  now: Date;
}): SwapValidationResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // 1. Temporal lock — shift must not have started or passed
  const requesterShiftStart = new Date(`${params.requesterShift.shift_date}T${params.requesterShift.start_time}`);
  const targetShiftStart = new Date(`${params.targetShift.shift_date}T${params.targetShift.start_time}`);

  if (requesterShiftStart <= params.now) {
    blockers.push("swap.blockerLocked");
  }
  if (targetShiftStart <= params.now) {
    blockers.push("swap.blockerLocked");
  }

  // 2. Overlap — does the target have a conflicting shift?
  const hasOverlap = params.targetEmployeeShifts.some((s) => {
    if (s.schedule_shift_id === params.targetShift.schedule_shift_id) return false;
    if (s.shift_date !== params.requesterShift.shift_date) return false;
    return s.start_time < params.requesterShift.end_time &&
           s.end_time > params.requesterShift.start_time;
  });
  if (hasOverlap) {
    blockers.push("swap.blockerOverlap");
  }

  // Check reverse overlap for requester too
  const requesterHasOverlap = params.requesterEmployeeShifts.some((s) => {
    if (s.schedule_shift_id === params.requesterShift.schedule_shift_id) return false;
    if (s.shift_date !== params.targetShift.shift_date) return false;
    return s.start_time < params.targetShift.end_time &&
           s.end_time > params.targetShift.start_time;
  });
  if (requesterHasOverlap) {
    blockers.push("swap.blockerOverlap");
  }

  // 3. Qualification — position must match
  if (
    params.requesterShift.position_id &&
    params.targetShift.position_id &&
    params.requesterShift.position_id !== params.targetShift.position_id
  ) {
    blockers.push("swap.blockerQualification");
  }

  // 4. Absence — check both parties
  if (params.targetHasAbsence) {
    blockers.push("swap.blockerAbsence");
  }
  if (params.requesterHasAbsence) {
    blockers.push("swap.blockerAbsence");
  }

  // 5. Weekly hours — check if swap pushes either over limit
  const targetWeekHours = params.targetEmployeeShifts
    .filter((s) => isSameISOWeek(s.shift_date, params.requesterShift.shift_date))
    .reduce((sum, s) => sum + s.work_hours, 0);
  const adjustedTargetHours = targetWeekHours - params.targetShift.work_hours + params.requesterShift.work_hours;

  if (adjustedTargetHours > WEEKLY_HOURS_LIMIT) {
    warnings.push("swap.warningHours");
  }

  // 6. 11-hour rest — check gap between shifts for target
  const targetShiftsOnSwapDate = params.targetEmployeeShifts
    .filter((s) => s.schedule_shift_id !== params.targetShift.schedule_shift_id)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  for (const adjacent of targetShiftsOnSwapDate) {
    const gapHours = calculateGapHours(
      params.requesterShift.end_time,
      adjacent.start_time,
      params.requesterShift.shift_date,
      adjacent.shift_date,
    );
    if (gapHours > 0 && gapHours < REST_HOURS_MINIMUM) {
      warnings.push("swap.warningRest");
      break;
    }
  }

  // 7. Delt dagsverk — gap > 2 hours creates split shift supplement
  let tariff_delta: number | undefined;
  for (const adjacent of targetShiftsOnSwapDate) {
    if (adjacent.shift_date !== params.requesterShift.shift_date) continue;
    const gapHours = calculateGapHours(
      params.requesterShift.end_time,
      adjacent.start_time,
      params.requesterShift.shift_date,
      adjacent.shift_date,
    );
    if (gapHours > SPLIT_SHIFT_GAP_HOURS) {
      warnings.push("swap.warningSplitShift");
      tariff_delta = SPLIT_SHIFT_SUPPLEMENT_KR;
      break;
    }
  }

  return {
    eligible: blockers.length === 0,
    blockers,
    warnings,
    tariff_delta,
  };
}

function isSameISOWeek(dateA: string, dateB: string): boolean {
  const a = new Date(dateA);
  const b = new Date(dateB);
  const getWeek = (d: Date) => {
    const onejan = new Date(d.getFullYear(), 0, 1);
    return Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
  };
  return a.getFullYear() === b.getFullYear() && getWeek(a) === getWeek(b);
}

function calculateGapHours(
  endTime: string,
  startTime: string,
  endDate: string,
  startDate: string,
): number {
  const end = new Date(`${endDate}T${endTime}`);
  const start = new Date(`${startDate}T${startTime}`);
  return (start.getTime() - end.getTime()) / 3600000;
}
```

- [ ] **Step 3: Export from packages/utils**

Check `packages/utils/src/index.ts` and add:
```typescript
export * from "./swap/types";
export * from "./swap/validate-swap";
```

- [ ] **Step 4: Run typecheck**

```bash
pnpm --filter utils typecheck
```

- [ ] **Step 5: Commit**

```bash
git add packages/utils/src/swap/
git commit -m "feat(utils): add shift swap types and D3 validation logic"
```

---

### Task 2: i18n Labels + Telemetry Events

**Files:**
- Create: `packages/i18n/locales/nb/swap.json`
- Create: `packages/i18n/locales/en/swap.json`
- Modify: `packages/telemetry/src/registry.ts`

- [ ] **Step 1: Create Norwegian swap labels**

```json
{
  "swap.requestSwap": "Foreslå bytte",
  "swap.selectColleague": "Velg kollega",
  "swap.confirmSwap": "Bekreft bytte",
  "swap.cancelSwap": "Avbryt",
  "swap.pendingRecipient": "Venter på kollega",
  "swap.accepted": "Akseptert",
  "swap.approved": "Godkjent",
  "swap.rejected": "Avvist",
  "swap.cancelled": "Kansellert",
  "swap.executed": "Gjennomført",
  "swap.blockerOverlap": "Kollega har allerede en vakt på dette tidspunktet",
  "swap.blockerQualification": "Kollega har ikke riktig stilling for denne vakten",
  "swap.blockerLocked": "Vakten har allerede startet eller passert",
  "swap.blockerAbsence": "En av partene har registrert fravær",
  "swap.warningHours": "Byttet overskriver ukentlig timetak (37,5t)",
  "swap.warningRest": "Byttet gir under 11 timers hvile",
  "swap.warningSplitShift": "Byttet skaper delt dagsverk (> 2 timer gap)",
  "swap.tariffDelta": "Kostnadsendring: {{amount}} kr",
  "swap.approve": "Godkjenn",
  "swap.reject": "Avvis",
  "swap.reason": "Begrunnelse (valgfri)",
  "swap.yourShift": "Din vakt",
  "swap.theirShift": "Deres vakt",
  "swap.pendingSwaps": "Ventende bytter",
  "swap.noSwaps": "Ingen ventende bytter",
  "swap.eligibleColleagues": "Tilgjengelige kolleger",
  "swap.noEligible": "Ingen tilgjengelige kolleger for denne vakten",
  "swap.validating": "Validerer..."
}
```

- [ ] **Step 2: Create English swap labels**

```json
{
  "swap.requestSwap": "Request swap",
  "swap.selectColleague": "Select colleague",
  "swap.confirmSwap": "Confirm swap",
  "swap.cancelSwap": "Cancel",
  "swap.pendingRecipient": "Waiting for colleague",
  "swap.accepted": "Accepted",
  "swap.approved": "Approved",
  "swap.rejected": "Rejected",
  "swap.cancelled": "Cancelled",
  "swap.executed": "Executed",
  "swap.blockerOverlap": "Colleague already has a shift at this time",
  "swap.blockerQualification": "Colleague does not have the required position",
  "swap.blockerLocked": "Shift has already started or passed",
  "swap.blockerAbsence": "One of the parties has registered absence",
  "swap.warningHours": "Swap exceeds weekly hour limit (37.5h)",
  "swap.warningRest": "Swap results in less than 11 hours rest",
  "swap.warningSplitShift": "Swap creates split shift (> 2 hour gap)",
  "swap.tariffDelta": "Cost change: {{amount}} NOK",
  "swap.approve": "Approve",
  "swap.reject": "Reject",
  "swap.reason": "Reason (optional)",
  "swap.yourShift": "Your shift",
  "swap.theirShift": "Their shift",
  "swap.pendingSwaps": "Pending swaps",
  "swap.noSwaps": "No pending swaps",
  "swap.eligibleColleagues": "Eligible colleagues",
  "swap.noEligible": "No eligible colleagues for this shift",
  "swap.validating": "Validating..."
}
```

- [ ] **Step 3: Register 6 swap telemetry events**

Add to the SmartoutEvent type union:
```typescript
| "shift swap_requested"
| "shift swap_accepted"
| "shift swap_rejected"
| "shift swap_approved"
| "shift swap_executed"
| "shift swap_cancelled"
```

Add to EVENT_ROUTING:
```typescript
  "shift swap_requested": {
    destinations: ["posthog", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "shift swap_accepted": {
    destinations: ["posthog", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "shift swap_rejected": {
    destinations: ["posthog", "activity_trail"],
    category: "scheduling",
  },
  "shift swap_approved": {
    destinations: ["posthog", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "shift swap_executed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "shift swap_cancelled": {
    destinations: ["posthog", "activity_trail"],
    category: "scheduling",
  },
```

- [ ] **Step 4: Run typecheck**

```bash
pnpm --filter telemetry typecheck && pnpm --filter i18n typecheck
```

- [ ] **Step 5: Commit**

```bash
git add packages/i18n/locales/nb/swap.json packages/i18n/locales/en/swap.json packages/telemetry/src/registry.ts
git commit -m "feat(swap): add i18n labels and register 6 telemetry events"
```

---

### Task 3: Database Migration — Engine Process + RPCs

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_shift_swap_engine.sql` (use current timestamp)

- [ ] **Step 1: Generate migration timestamp**

```bash
date -u +%Y%m%d%H%M%S
```

- [ ] **Step 2: Create the migration file**

The migration seeds the engine_process blueprint and creates 3 SECURITY DEFINER RPCs.

```sql
SET search_path TO public, extensions;

-- ============================================
-- Shift Swap via Event Engine (ADR-0067)
-- Seed engine_process blueprint + SECURITY DEFINER RPCs
-- ============================================

-- ── Engine Process Blueprint ────────────────────────────────────────────────

INSERT INTO public.engine_process (id, name, description, is_active, max_steps)
VALUES (
  'shift_swap',
  'Shift Swap',
  'Mutual shift exchange between two employees with manager approval. 3-phase: request → accept → approve.',
  true,
  6
) ON CONFLICT (id) DO NOTHING;

-- Engine steps for the shift_swap process
INSERT INTO public.engine_step (process_id, step_order, action_type, action_payload, assignee_rule) VALUES
  ('shift_swap', 1, 'wait_for_event', '{"event_type": "shift_swap.initiated"}', 'self'),
  ('shift_swap', 2, 'validate_settlement', '{"validation": "d3_swap_rules"}', 'self'),
  ('shift_swap', 3, 'wait_for_event', '{"event_type": "shift_swap.recipient_response"}', 'self'),
  ('shift_swap', 4, 'wait_for_event', '{"event_type": "shift_swap.manager_decision"}', 'manager'),
  ('shift_swap', 5, 'update_entity', '{"entity": "schedule_shift", "action": "swap_employee_ids"}', 'self'),
  ('shift_swap', 6, 'send_notification', '{"template": "shift_swap_result", "recipients": "all_parties"}', 'self')
ON CONFLICT DO NOTHING;

-- ── RPC: Initiate Shift Swap ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.initiate_shift_swap(
  p_requester_shift_id UUID,
  p_target_profile_id UUID,
  p_target_shift_id UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_requester_id UUID;
  v_workspace_id UUID;
  v_state_id UUID;
  v_requester_shift RECORD;
  v_target_shift RECORD;
BEGIN
  -- Get the requesting user
  v_requester_id := auth.uid();
  IF v_requester_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify requester owns the shift
  SELECT schedule_shift_id, employee_id, workspace_id, shift_date, start_time, end_time,
         work_hours, position_id, status, is_published
  INTO v_requester_shift
  FROM public.schedule_shift
  WHERE schedule_shift_id = p_requester_shift_id;

  IF v_requester_shift IS NULL THEN
    RAISE EXCEPTION 'Shift not found';
  END IF;

  -- Check requester owns this shift via profile
  IF NOT EXISTS (
    SELECT 1 FROM public.profile
    WHERE user_id = v_requester_id
    AND profile_id = v_requester_shift.employee_id
    AND workspace_id = v_requester_shift.workspace_id
  ) THEN
    RAISE EXCEPTION 'You do not own this shift';
  END IF;

  -- Check shift is published and not started
  IF v_requester_shift.status NOT IN ('published', 'assigned') THEN
    RAISE EXCEPTION 'Shift must be published to swap';
  END IF;
  IF v_requester_shift.shift_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Cannot swap a past shift';
  END IF;

  v_workspace_id := v_requester_shift.workspace_id;

  -- Verify target shift exists and belongs to target profile
  SELECT schedule_shift_id, employee_id, shift_date, start_time, end_time,
         work_hours, position_id, status
  INTO v_target_shift
  FROM public.schedule_shift
  WHERE schedule_shift_id = p_target_shift_id
  AND employee_id = p_target_profile_id
  AND workspace_id = v_workspace_id;

  IF v_target_shift IS NULL THEN
    RAISE EXCEPTION 'Target shift not found or does not belong to target employee';
  END IF;

  -- Create engine_state for the swap workflow
  INSERT INTO public.engine_state (
    process_id, workspace_id, entity_type, entity_id,
    status, context, started_at
  ) VALUES (
    'shift_swap', v_workspace_id, 'schedule_shift', p_requester_shift_id,
    'active',
    jsonb_build_object(
      'requester_profile_id', v_requester_shift.employee_id,
      'target_profile_id', p_target_profile_id,
      'requester_shift_id', p_requester_shift_id,
      'target_shift_id', p_target_shift_id,
      'swap_type', 'mutual_exchange',
      'reason', COALESCE(p_reason, ''),
      'status', 'pending_recipient',
      'validation_result', jsonb_build_object(
        'eligible', true,
        'blockers', '[]'::jsonb,
        'warnings', '[]'::jsonb
      )
    ),
    now()
  ) RETURNING id INTO v_state_id;

  RETURN v_state_id;
END;
$$;

-- ── RPC: Respond to Shift Swap ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.respond_to_shift_swap(
  p_swap_id UUID,
  p_accepted BOOLEAN,
  p_reason TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID;
  v_state RECORD;
  v_target_profile_id TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Fetch the swap state
  SELECT id, context, status
  INTO v_state
  FROM public.engine_state
  WHERE id = p_swap_id AND process_id = 'shift_swap';

  IF v_state IS NULL THEN
    RAISE EXCEPTION 'Swap not found';
  END IF;

  IF v_state.context->>'status' != 'pending_recipient' THEN
    RAISE EXCEPTION 'Swap is not pending recipient response';
  END IF;

  -- Verify the responding user is the target
  v_target_profile_id := v_state.context->>'target_profile_id';
  IF NOT EXISTS (
    SELECT 1 FROM public.profile
    WHERE user_id = v_user_id AND profile_id::text = v_target_profile_id
  ) THEN
    RAISE EXCEPTION 'You are not the target of this swap';
  END IF;

  IF p_accepted THEN
    UPDATE public.engine_state
    SET context = context || jsonb_build_object('status', 'pending_manager'),
        updated_at = now()
    WHERE id = p_swap_id;
  ELSE
    UPDATE public.engine_state
    SET context = context || jsonb_build_object(
          'status', 'rejected',
          'rejected_by', v_target_profile_id,
          'rejection_reason', COALESCE(p_reason, '')
        ),
        status = 'complete',
        completed_at = now(),
        updated_at = now()
    WHERE id = p_swap_id;
  END IF;
END;
$$;

-- ── RPC: Approve/Reject Shift Swap ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.approve_shift_swap(
  p_swap_id UUID,
  p_approved BOOLEAN,
  p_reason TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID;
  v_state RECORD;
  v_workspace_id UUID;
  v_requester_shift_id UUID;
  v_target_shift_id UUID;
  v_requester_profile_id UUID;
  v_target_profile_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Fetch the swap state
  SELECT id, context, workspace_id, status
  INTO v_state
  FROM public.engine_state
  WHERE id = p_swap_id AND process_id = 'shift_swap';

  IF v_state IS NULL THEN
    RAISE EXCEPTION 'Swap not found';
  END IF;

  IF v_state.context->>'status' != 'pending_manager' THEN
    RAISE EXCEPTION 'Swap is not pending manager approval';
  END IF;

  v_workspace_id := v_state.workspace_id;

  -- Verify user is admin/manager in workspace
  IF NOT is_admin_in_workspace(v_user_id, v_workspace_id) THEN
    RAISE EXCEPTION 'Only admins can approve swaps';
  END IF;

  IF NOT p_approved THEN
    -- Reject
    UPDATE public.engine_state
    SET context = context || jsonb_build_object(
          'status', 'rejected',
          'rejected_by', v_user_id::text,
          'rejection_reason', COALESCE(p_reason, '')
        ),
        status = 'complete',
        completed_at = now(),
        updated_at = now()
    WHERE id = p_swap_id;
    RETURN;
  END IF;

  -- Approve — execute the swap
  v_requester_shift_id := (v_state.context->>'requester_shift_id')::uuid;
  v_target_shift_id := (v_state.context->>'target_shift_id')::uuid;
  v_requester_profile_id := (v_state.context->>'requester_profile_id')::uuid;
  v_target_profile_id := (v_state.context->>'target_profile_id')::uuid;

  -- Re-verify shifts still exist and haven't changed
  IF NOT EXISTS (SELECT 1 FROM schedule_shift WHERE schedule_shift_id = v_requester_shift_id AND employee_id = v_requester_profile_id) THEN
    RAISE EXCEPTION 'Requester shift has changed since swap was requested';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM schedule_shift WHERE schedule_shift_id = v_target_shift_id AND employee_id = v_target_profile_id) THEN
    RAISE EXCEPTION 'Target shift has changed since swap was requested';
  END IF;

  -- Swap employee_ids
  UPDATE public.schedule_shift SET employee_id = v_target_profile_id, updated_at = now()
  WHERE schedule_shift_id = v_requester_shift_id;

  UPDATE public.schedule_shift SET employee_id = v_requester_profile_id, updated_at = now()
  WHERE schedule_shift_id = v_target_shift_id;

  -- Mark engine_state as complete
  UPDATE public.engine_state
  SET context = context || jsonb_build_object(
        'status', 'executed',
        'executed_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      ),
      status = 'complete',
      completed_at = now(),
      updated_at = now()
  WHERE id = p_swap_id;
END;
$$;

-- ── Grant execute to authenticated users ────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.initiate_shift_swap TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_shift_swap TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_shift_swap TO authenticated;
```

- [ ] **Step 3: Apply migration locally**

```bash
npx supabase db reset
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/*_shift_swap_engine.sql
git commit -m "feat(db): add shift swap engine process blueprint and SECURITY DEFINER RPCs"
```

---

### Task 4: Agent Capability

**Files:**
- Modify: `packages/ai/src/capabilities/types.ts`
- Create: `packages/ai/src/capabilities/shift-swap/index.ts`
- Create: `packages/ai/src/capabilities/shift-swap/tools.ts`
- Modify: `packages/ai/src/capabilities/registry.ts`
- Modify: `packages/ai/src/agents/botsson.ts`

- [ ] **Step 1: Add shift_swap to CapabilityName type**

In `packages/ai/src/capabilities/types.ts`, add `"shift_swap"` to the union:

```typescript
export type CapabilityName =
  | "knowledge"
  | "schedule"
  | "training"
  | "operations"
  | "profile"
  | "communication"
  | "memory"
  | "payroll"
  | "ui"
  | "guardian"
  | "contract"
  | "contract_intake"
  | "shift_swap";
```

- [ ] **Step 2: Create capability tools**

Create `packages/ai/src/capabilities/shift-swap/tools.ts` with 4 tools following the existing pattern from operations/tools.ts:
- `getSwapRequests` — read-only, queries engine_state WHERE process_id='shift_swap'
- `getSwapEligibility` — read-only, fetches shifts for a given profile and runs client-side validation
- `requestSwap` — calls `initiate_shift_swap` RPC
- `respondToSwap` — calls `respond_to_shift_swap` RPC

- [ ] **Step 3: Create capability index**

Create `packages/ai/src/capabilities/shift-swap/index.ts`:

```typescript
import type { CapabilityDefinition } from "../types.js";
import { getSwapRequests, getSwapEligibility, requestSwap, respondToSwap } from "./tools.js";
import type { SmartoutTool, AgentToolContext } from "../../tools/types.js";

const allTools = [getSwapRequests, getSwapEligibility, requestSwap, respondToSwap] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;
const readOnlyTools = [getSwapRequests, getSwapEligibility] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;
const suggestTools = [requestSwap, respondToSwap] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

export const shiftSwapCapability: CapabilityDefinition = {
  name: "shift_swap",
  description: "Request, view, and respond to shift swap requests between employees",
  tools: allTools,
  readOnlyTools,
  suggestTools,
  allowedChannels: ["chat"],
};
```

- [ ] **Step 4: Register in registry.ts**

Add import and registration in `packages/ai/src/capabilities/registry.ts`:

```typescript
import { shiftSwapCapability } from "./shift-swap/index.js";

// In capabilities object:
  shift_swap: shiftSwapCapability,
```

- [ ] **Step 5: Wire capabilities to Botsson**

In `packages/ai/src/agents/botsson.ts`, update BOTSSON_CAPABILITIES:

```typescript
import { operationsCapability } from "../capabilities/operations/index.js";
import { scheduleCapability } from "../capabilities/schedule/index.js";
import { guardianCapability } from "../capabilities/guardian/index.js";
import { shiftSwapCapability } from "../capabilities/shift-swap/index.js";

const BOTSSON_CAPABILITIES: ReadonlyArray<CapabilityDefinition> = [
  contractCapability,
  operationsCapability,
  scheduleCapability,
  guardianCapability,
  shiftSwapCapability,
];
```

- [ ] **Step 6: Run typecheck**

```bash
pnpm --filter ai typecheck
```

- [ ] **Step 7: Commit**

```bash
git add packages/ai/src/capabilities/shift-swap/ packages/ai/src/capabilities/types.ts packages/ai/src/capabilities/registry.ts packages/ai/src/agents/botsson.ts
git commit -m "feat(ai): add shift_swap capability and wire to Botsson"
```

---

### Task 5: Web Swap Hooks

**Files:**
- Create: `apps/web/src/app/dashboard/schedule/_hooks/use-shift-swap.ts`

- [ ] **Step 1: Create swap query and mutation hooks**

```typescript
"use client";

/**
 * Hooks for shift swap in the schedule view.
 * Queries engine_state for pending swaps, calls RPCs for initiate/respond/approve.
 * Telemetry emitted in onSuccess (RPCs run in PostgreSQL, cannot call emit()).
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { emit } from "@smartout/telemetry";
import type { ShiftSwapContext } from "@smartout/utils";

function swapKey(wsId: string) {
  return ["schedule", "swaps", wsId] as const;
}

export function useSwapRequests() {
  const ws = useWorkspaceOptional();
  const wsId = ws?.workspace_id;

  return useQuery({
    queryKey: swapKey(wsId ?? ""),
    enabled: !!wsId,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("engine_state")
        .select("id, context, status, started_at, updated_at")
        .eq("process_id", "shift_swap")
        .eq("workspace_id", wsId!)
        .in("status", ["active", "waiting"])
        .order("started_at", { ascending: false });

      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id as string,
        context: row.context as ShiftSwapContext,
        engineStatus: row.status as string,
        startedAt: row.started_at as string,
      }));
    },
  });
}

export function useInitiateSwap() {
  const ws = useWorkspaceOptional();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      requesterShiftId: string;
      targetProfileId: string;
      targetShiftId: string;
      reason?: string;
    }) => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("initiate_shift_swap", {
        p_requester_shift_id: params.requesterShiftId,
        p_target_profile_id: params.targetProfileId,
        p_target_shift_id: params.targetShiftId,
        p_reason: params.reason ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (swapId) => {
      emit({ event: "shift swap_requested", properties: { swap_id: swapId } });
      qc.invalidateQueries({ queryKey: swapKey(ws?.workspace_id ?? "") });
    },
  });
}

export function useRespondToSwap() {
  const ws = useWorkspaceOptional();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: { swapId: string; accepted: boolean; reason?: string }) => {
      const supabase = createClient();
      const { error } = await supabase.rpc("respond_to_shift_swap", {
        p_swap_id: params.swapId,
        p_accepted: params.accepted,
        p_reason: params.reason ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      const event = vars.accepted ? "shift swap_accepted" : "shift swap_rejected";
      emit({ event, properties: { swap_id: vars.swapId } });
      qc.invalidateQueries({ queryKey: swapKey(ws?.workspace_id ?? "") });
    },
  });
}

export function useApproveSwap() {
  const ws = useWorkspaceOptional();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: { swapId: string; approved: boolean; reason?: string }) => {
      const supabase = createClient();
      const { error } = await supabase.rpc("approve_shift_swap", {
        p_swap_id: params.swapId,
        p_approved: params.approved,
        p_reason: params.reason ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      const event = vars.approved ? "shift swap_approved" : "shift swap_rejected";
      emit({ event, properties: { swap_id: vars.swapId } });
      qc.invalidateQueries({ queryKey: swapKey(ws?.workspace_id ?? "") });
      qc.invalidateQueries({ queryKey: ["schedule"] });
    },
  });
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm --filter web typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_hooks/use-shift-swap.ts
git commit -m "feat(schedule): add shift swap query and mutation hooks"
```

---

### Task 6: Swap Request Dialog (Web)

**Files:**
- Create: `apps/web/src/app/dashboard/schedule/_components/SwapRequestDialog.tsx`

- [ ] **Step 1: Read existing schedule dialog patterns**

Read `apps/web/src/app/dashboard/schedule/_components/open-shift-dialog.tsx` to see the dialog pattern used in the schedule view.

- [ ] **Step 2: Create SwapRequestDialog**

This dialog lets an employee (or admin on behalf of) request a shift swap. It should:
- Accept `shiftId: string` and `onClose: () => void` as props
- Show "Din vakt" details (date, time, position)
- Fetch eligible colleagues (same workspace, published shifts)
- Show colleague list as profile rows (avatar, name, position, compatible shifts)
- Select a target shift → run client-side `validateSwap()` and show blockers/warnings
- Confirm button calls `useInitiateSwap()`
- Use shadcn `Dialog`, `Button`, `Badge`, `Avatar` components
- Use i18n keys from `swap.*` namespace
- Status badges use semantic color tokens: `--warning`, `--info`, `--success`, `--destructive`
- ArrowLeftRight icon (Lucide) in the dialog header

- [ ] **Step 3: Test in browser**

```bash
pnpm --filter web dev
```

Navigate to schedule view. Click swap icon on a shift. Verify dialog opens, shows colleagues, validation runs.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/SwapRequestDialog.tsx
git commit -m "feat(schedule): add shift swap request dialog"
```

---

### Task 7: Swap Approval Section (Web)

**Files:**
- Create: `apps/web/src/app/dashboard/schedule/_components/SwapApprovalSection.tsx`

- [ ] **Step 1: Create the approval section for managers**

This component renders pending swaps in the schedule view. It should:
- Use `useSwapRequests()` to fetch pending swaps
- Filter for `status === 'pending_manager'` (manager view) or `status === 'pending_recipient'` (employee view)
- Render each swap as a card with: both shifts, both employees, validation result, tariff delta
- Approve/reject buttons with optional reason input
- Empty state: ghost card + `swap.noSwaps` label
- Use semantic color tokens for the amber pending highlight

- [ ] **Step 2: Wire into schedule page**

Read `apps/web/src/app/dashboard/schedule/page.tsx` and add `SwapApprovalSection` below the week grid or as a collapsible panel. Conditionally render based on role (admin/manager sees approval, employee sees their pending requests).

- [ ] **Step 3: Add swap icon to shift cards**

Read `apps/web/src/app/dashboard/schedule/_components/week-grid-cell.tsx` to find the shift card rendering. Add an `ArrowLeftRight` icon button that opens `SwapRequestDialog`:
- Only visible on published shifts with an assigned employee
- Admins see it on all shifts; employees only on their own

- [ ] **Step 4: Test end-to-end**

1. As admin, create and publish shifts for two employees
2. As employee A, click swap icon → select employee B → confirm
3. Verify engine_state created in database
4. (If testing approve flow): as admin, see pending swap in SwapApprovalSection → approve
5. Verify shifts swapped in the grid

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/SwapApprovalSection.tsx apps/web/src/app/dashboard/schedule/_components/week-grid-cell.tsx apps/web/src/app/dashboard/schedule/page.tsx
git commit -m "feat(schedule): add swap approval section and swap icon on shift cards"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Run full typecheck**

```bash
pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 2: Run full lint**

```bash
pnpm lint
```

Expected: 0 errors (or only pre-existing warnings).

- [ ] **Step 3: Verify the complete swap flow**

1. `npx supabase db reset` (applies migration + seed)
2. `pnpm --filter web dev`
3. Create test shifts for two employees
4. Initiate swap → verify engine_state row created
5. Respond as target → verify status transitions
6. Approve as manager → verify employee_ids swapped on shifts

- [ ] **Step 4: Commit any fixes**

```bash
git add -A && git commit -m "fix(schedule): address shift swap integration issues"
```
