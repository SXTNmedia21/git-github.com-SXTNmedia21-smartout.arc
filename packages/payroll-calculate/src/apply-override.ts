/**
 * packages/payroll-calculate/src/apply-override.ts
 *
 * WHAT: Pure data-transform for the wage_line_override applier (ADR-0292).
 *       Given an original payroll.calculation row, the existing
 *       shift_pay_calculation_event, and override parameters, this function
 *       returns the row shapes that the BFF route must INSERT/UPDATE.
 *       Zero I/O. All DB writes happen in the caller (apply-line-override route.ts).
 *
 * WHY: Extracting the data-building logic into a pure function lets us:
 *      - Unit test ADR-0292 semantics without a real DB or Next.js stack.
 *      - Re-run the override deterministically for audit replay (Principle 2).
 *      - Verify Bokføringsloven §13 compliance at test time:
 *        original row is returned UNCHANGED; new row is a separate object.
 *
 * ADR-0292 semantics enforced here:
 *   1. Original payroll.calculation row UNCHANGED — returned as-is for verification.
 *   2. New payroll.calculation row: calculation_version = old + 1, total_pay = proposed.
 *   3. New shift_pay_calculation_event: derivation_version = old + 1, NOT superseded.
 *   4. Supersession update: old event's superseded_by_event_id set to new event's id.
 *
 * Bokføringsloven §13: no UPDATE on any original row; append-only semantics.
 */

// ─── Input types (mirror the DB row shapes the route reads) ─────────────────

export type OverrideCalcRow = {
  id: string;
  workspace_id: string;
  period_id: string;
  schedule_shift_id: string;
  profile_id: string;
  employee_group_id: string | null;
  shift_type_id: string | null;
  shift_date: string;
  scheduled_start: string;
  scheduled_end: string;
  actual_start: string | null;
  actual_end: string | null;
  gross_minutes: number;
  break_minutes_paid: number;
  break_minutes_unpaid: number;
  net_working_minutes: number;
  base_rate: number;
  base_pay: number;
  total_supplements: number;
  total_deductions: number;
  total_pay: number;
  calculation_version: number;
  calculated_at: string;
  provenance: Record<string, unknown> | null;
};

export type OverrideEventRow = {
  id: string;
  workspace_id: string;
  payroll_period_id: string | null;
  shift_id: string;
  profile_id: string;
  derivation_version: number;
  shift_period_end_date: string;
  superseded_by_event_id: string | null;
};

export type OverrideParams = {
  changeProposalId: string;
  proposedAmountNok: number;
  proposedAmountCents: number;
  originalAmountCents: number;
  reason: string | null;
  category: string | null;
  appliedByProfileId: string;
  now: string; // ISO timestamp — caller provides so tests are deterministic
};

// ─── Output types (shapes ready for DB INSERT / UPDATE) ──────────────────────

/** Shape to INSERT into payroll.calculation (all fields from original, total_pay overridden) */
export type NewCalcInsert = Omit<OverrideCalcRow, "id" | "calculated_at"> & {
  total_pay: number;
  calculation_version: number;
  provenance: Record<string, unknown>;
};

/** Shape to INSERT into public.shift_pay_calculation_event */
export type NewEventInsert = {
  workspace_id: string;
  payroll_period_id: string | null;
  shift_id: string;
  profile_id: string;
  rule_type: string;
  rate_value_applied: number;
  rate_type: string;
  source_text_applied: string | null;
  quantity_value: number;
  subtotal: number;
  amount_nok: number;
  derivation_version: number;
  calculated_by: string;
  shift_period_end_date: string;
  provenance: Record<string, unknown>;
  // superseded_by_event_id is intentionally absent — new event is NOT superseded
};

/** Partial UPDATE to apply to the OLD event row: sets superseded_by_event_id */
export type SupersessionUpdate = {
  oldEventId: string;
  newEventId: string; // placeholder — caller replaces with DB-generated UUID
  superseded_at: string;
};

/** Complete output of applyOverrideTransform — all shapes the route must write */
export type OverrideTransformResult = {
  /** Verbatim copy of the original calc row — must stay UNCHANGED (Bokføringsloven §13) */
  originalCalcRow: OverrideCalcRow;
  /** Shape to INSERT as the new payroll.calculation row */
  newCalcInsert: NewCalcInsert;
  /** Shape to INSERT as the new shift_pay_calculation_event row */
  newEventInsert: NewEventInsert;
  /**
   * Supersession update to apply to the old event row.
   * null when no origEvent was found (first-time calculation — no prior event).
   */
  supersessionUpdate: SupersessionUpdate | null;
  /** The new calculation_version for the caller's reference */
  newCalcVersion: number;
  /** The new derivation_version for the event for the caller's reference */
  newEventDerivationVersion: number;
};

// ─── Pure transform ───────────────────────────────────────────────────────────

/**
 * applyOverrideTransform — pure data-builder for the wage_line_override applier.
 *
 * Given the original payroll.calculation row, the existing (most-recent,
 * non-superseded) shift_pay_calculation_event, and override parameters,
 * returns all row shapes the BFF route must INSERT / UPDATE.
 *
 * The caller is responsible for:
 *  - Assigning DB-generated UUIDs to the new rows.
 *  - Setting supersessionUpdate.newEventId to the actual inserted event UUID.
 *  - Writing the rows in order: newEventInsert first, then supersessionUpdate,
 *    then newCalcInsert (so newCalcInsert.provenance.supersession_event_id is valid).
 *
 * @param origCalc  - Original payroll.calculation row (workspace-verified by caller)
 * @param origEvent - Most-recent non-superseded shift_pay_calculation_event (or null)
 * @param params    - Override parameters (amounts, reason, actor, timestamp)
 * @returns OverrideTransformResult
 */
export function applyOverrideTransform(
  origCalc: OverrideCalcRow,
  origEvent: OverrideEventRow | null,
  params: OverrideParams,
): OverrideTransformResult {
  const newCalcVersion = (origCalc.calculation_version ?? 1) + 1;
  const newEventDerivationVersion = (origEvent?.derivation_version ?? 1) + 1;

  // ── Original row returned verbatim — caller can assert it is UNCHANGED ────
  // We do NOT mutate origCalc. Spread would also work but returning reference
  // is intentional: test asserts === equality to verify no mutation.
  const originalCalcRow: OverrideCalcRow = origCalc;

  // ── New shift_pay_calculation_event (override row, NOT superseded) ─────────
  const newEventInsert: NewEventInsert = {
    workspace_id: origCalc.workspace_id,
    payroll_period_id: origEvent?.payroll_period_id ?? origCalc.period_id,
    shift_id: origCalc.schedule_shift_id,
    profile_id: origCalc.profile_id,
    rule_type: "override",
    rate_value_applied: 1, // fixed-amount override: rate=1, quantity=1, subtotal=amount
    rate_type: "fixed_per_shift",
    source_text_applied: params.reason ?? null,
    quantity_value: 1,
    subtotal: params.proposedAmountNok,
    amount_nok: params.proposedAmountNok,
    derivation_version: newEventDerivationVersion,
    calculated_by: `manual_override:${params.appliedByProfileId}`,
    shift_period_end_date: origEvent?.shift_period_end_date ?? origCalc.shift_date,
    provenance: {
      change_proposal_id: params.changeProposalId,
      original_calculation_id: origCalc.id,
      category: params.category ?? "other",
      applied_by: params.appliedByProfileId,
    },
    // superseded_by_event_id intentionally omitted — this is the LATEST event
  };

  // ── Supersession update for the old event (if present) ───────────────────
  // The caller will replace newEventId with the actual DB-generated UUID.
  const supersessionUpdate: SupersessionUpdate | null = origEvent
    ? {
        oldEventId: origEvent.id,
        newEventId: "PLACEHOLDER_REPLACED_BY_CALLER", // caller substitutes real UUID
        superseded_at: params.now,
      }
    : null;

  // ── New payroll.calculation row (ADR-0292 §6) ────────────────────────────
  // All fields copied from original; only total_pay + calculation_version change.
  // Original row LEFT UNCHANGED (Bokføringsloven §13 — zero UPDATE).
  const newCalcInsert: NewCalcInsert = {
    workspace_id: origCalc.workspace_id,
    period_id: origCalc.period_id,
    schedule_shift_id: origCalc.schedule_shift_id,
    profile_id: origCalc.profile_id,
    employee_group_id: origCalc.employee_group_id ?? null,
    shift_type_id: origCalc.shift_type_id ?? null,
    shift_date: origCalc.shift_date,
    scheduled_start: origCalc.scheduled_start,
    scheduled_end: origCalc.scheduled_end,
    actual_start: origCalc.actual_start ?? null,
    actual_end: origCalc.actual_end ?? null,
    gross_minutes: origCalc.gross_minutes,
    break_minutes_paid: origCalc.break_minutes_paid,
    break_minutes_unpaid: origCalc.break_minutes_unpaid,
    net_working_minutes: origCalc.net_working_minutes,
    base_rate: origCalc.base_rate,
    base_pay: origCalc.base_pay,
    total_supplements: origCalc.total_supplements,
    total_deductions: origCalc.total_deductions,
    total_pay: params.proposedAmountNok, // <- only this field changes
    calculation_version: newCalcVersion,
    provenance: {
      ...(typeof origCalc.provenance === "object" && origCalc.provenance !== null
        ? (origCalc.provenance as Record<string, unknown>)
        : {}),
      derivation_version: newCalcVersion,
      override_source: "wage_line_override",
      change_proposal_id: params.changeProposalId,
      // supersession_event_id: caller sets this after INSERT resolves real UUID
    },
  };

  return {
    originalCalcRow,
    newCalcInsert,
    newEventInsert,
    supersessionUpdate,
    newCalcVersion,
    newEventDerivationVersion,
  };
}
