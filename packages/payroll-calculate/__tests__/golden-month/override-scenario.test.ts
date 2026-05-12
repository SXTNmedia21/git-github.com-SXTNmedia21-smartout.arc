/**
 * __tests__/golden-month/override-scenario.test.ts
 *
 * WHAT: Engine-level test for the wage_line_override applier semantics (ADR-0292).
 *       Tests the pure applyOverrideTransform() function with golden-month fixture
 *       data, asserting the supersession chain without any DB or HTTP calls.
 *
 * WHY:  ADR-0292 defines non-negotiable semantics for the override applier
 *       (T8.1, Payroll Phase 2). Bokføringsloven §13 demands original row is
 *       UNCHANGED. ADR-0251 demands the event supersession chain is correct.
 *       This test catches regressions before any DB migration or route change.
 *
 * Option (a): applyOverrideTransform() extracted to packages/payroll-calculate/src/apply-override.ts
 *             (pure, zero I/O). Route is a thin BFF wrapper around this function.
 *             Option (b) was not used — importing Next.js route handlers requires
 *             >50 lines of mocking for auth, Supabase admin client, and telemetry.
 *
 * Assertions per ADR-0292 §§1-8:
 *   §1  Original payroll.calculation row is UNCHANGED (id, calculation_version=1, total_pay=1500)
 *   §2  New payroll.calculation row exists (calculation_version=2, total_pay=proposed_amount_nok)
 *   §3  Old shift_pay_calculation_event has superseded_by_event_id ready to be set
 *   §4  New shift_pay_calculation_event is NOT superseded
 *   §5  Provenance links back to change_proposal_id
 *   §6  Idempotency: calling transform twice produces identical shapes (no state mutation)
 *   §7  No-event path: when origEvent is null, supersessionUpdate is null (first calc)
 *   §8  Proposed amount copies correctly from cents → NOK
 *
 * Zero I/O. All fixture data loaded via JSON imports.
 */

import { describe, it, expect } from "vitest";
import { applyOverrideTransform } from "../../src/apply-override.js";
import type {
  OverrideCalcRow,
  OverrideEventRow,
  OverrideParams,
} from "../../src/apply-override.js";

// ── Fixture imports ────────────────────────────────────────────────────────
import originalCalcRaw from "./input/override-scenario/original-calc.json" with { type: "json" };
import originalEventRaw from "./input/override-scenario/original-event.json" with { type: "json" };
import changeProposalRaw from "./input/override-scenario/change-proposal.json" with { type: "json" };
import expectedRaw from "./input/override-scenario/expected-superseded-chain.json" with { type: "json" };

// ── Typed fixtures ─────────────────────────────────────────────────────────
const origCalc = originalCalcRaw as OverrideCalcRow;
const origEvent = originalEventRaw as OverrideEventRow;
const changeProposal = changeProposalRaw as {
  change_proposal_id: string;
  workspace_id: string;
  kind: string;
  status: string;
  changes: {
    calculation_id: string;
    period_id: string;
    original_amount_cents: number;
    proposed_amount_cents: number;
    reason: string;
    category: string;
  };
};
const expected = expectedRaw as typeof expectedRaw;

// ── Common override params derived from fixture ────────────────────────────
const PROPOSED_CENTS = changeProposal.changes.proposed_amount_cents; // 180000
const PROPOSED_NOK = PROPOSED_CENTS / 100; // 1800
const ORIGINAL_NOK = 1500;
const APPLIED_BY = "prof-adm-001";
const FIXED_NOW = "2026-05-01T09:00:00Z";

function buildParams(): OverrideParams {
  return {
    changeProposalId: changeProposal.change_proposal_id,
    proposedAmountNok: PROPOSED_NOK,
    proposedAmountCents: PROPOSED_CENTS,
    originalAmountCents: changeProposal.changes.original_amount_cents,
    reason: changeProposal.changes.reason,
    category: changeProposal.changes.category,
    appliedByProfileId: APPLIED_BY,
    now: FIXED_NOW,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 1: Core ADR-0292 semantics (with existing event)
// ─────────────────────────────────────────────────────────────────────────────

describe("override-scenario — ADR-0292 core semantics (origEvent present)", () => {
  const result = applyOverrideTransform(origCalc, origEvent, buildParams());

  // §1 — Original row UNCHANGED (Bokføringsloven §13)
  it("ADR-0292 §1: original payroll.calculation row returned UNCHANGED", () => {
    expect(result.originalCalcRow.id).toBe(origCalc.id);
    expect(result.originalCalcRow.calculation_version).toBe(1);
    expect(result.originalCalcRow.total_pay).toBe(ORIGINAL_NOK);
  });

  it("ADR-0292 §1: original row is the same reference object (no clone = no mutation risk)", () => {
    expect(result.originalCalcRow).toBe(origCalc);
  });

  // §2 — New payroll.calculation row
  it("ADR-0292 §2: new calc row has calculation_version = origVersion + 1", () => {
    expect(result.newCalcInsert.calculation_version).toBe(2);
    expect(result.newCalcVersion).toBe(2);
  });

  it("ADR-0292 §2: new calc row has total_pay = proposedAmountNok", () => {
    expect(result.newCalcInsert.total_pay).toBe(PROPOSED_NOK);
    expect(result.newCalcInsert.total_pay).toBe(expected.new_calc.total_pay);
  });

  it("ADR-0292 §2: new calc row copies all shift fields from original", () => {
    expect(result.newCalcInsert.workspace_id).toBe(origCalc.workspace_id);
    expect(result.newCalcInsert.period_id).toBe(origCalc.period_id);
    expect(result.newCalcInsert.schedule_shift_id).toBe(origCalc.schedule_shift_id);
    expect(result.newCalcInsert.profile_id).toBe(origCalc.profile_id);
    expect(result.newCalcInsert.shift_date).toBe(origCalc.shift_date);
    expect(result.newCalcInsert.gross_minutes).toBe(origCalc.gross_minutes);
    expect(result.newCalcInsert.net_working_minutes).toBe(origCalc.net_working_minutes);
    expect(result.newCalcInsert.base_rate).toBe(origCalc.base_rate);
    expect(result.newCalcInsert.base_pay).toBe(origCalc.base_pay);
    // Only total_pay and calculation_version differ
  });

  it("ADR-0292 §2: new calc row has NO id field (caller gets DB-generated UUID)", () => {
    expect("id" in result.newCalcInsert).toBe(false);
  });

  // §3 — Supersession link on old event
  it("ADR-0292 §3: supersessionUpdate is non-null (origEvent exists)", () => {
    expect(result.supersessionUpdate).not.toBeNull();
  });

  it("ADR-0292 §3: supersessionUpdate targets the old event id", () => {
    expect(result.supersessionUpdate!.oldEventId).toBe(origEvent.id);
  });

  it("ADR-0292 §3: supersessionUpdate.superseded_at matches params.now", () => {
    expect(result.supersessionUpdate!.superseded_at).toBe(FIXED_NOW);
  });

  // §4 — New event NOT superseded
  it("ADR-0292 §4: new event is NOT superseded (latest version)", () => {
    // superseded_by_event_id must NOT be present on the new event insert
    expect("superseded_by_event_id" in result.newEventInsert).toBe(false);
  });

  it("ADR-0292 §4: new event derivation_version = origEvent.derivation_version + 1", () => {
    expect(result.newEventInsert.derivation_version).toBe(2);
    expect(result.newEventDerivationVersion).toBe(2);
  });

  it("ADR-0292 §4: new event rule_type = 'override'", () => {
    expect(result.newEventInsert.rule_type).toBe("override");
  });

  it("ADR-0292 §4: new event rate_type = 'fixed_per_shift'", () => {
    expect(result.newEventInsert.rate_type).toBe("fixed_per_shift");
  });

  it("ADR-0292 §4: new event amount_nok matches proposed amount", () => {
    expect(result.newEventInsert.amount_nok).toBe(PROPOSED_NOK);
    expect(result.newEventInsert.subtotal).toBe(PROPOSED_NOK);
  });

  // §5 — Provenance links
  it("ADR-0292 §5: new event provenance links to change_proposal_id", () => {
    expect(result.newEventInsert.provenance.change_proposal_id).toBe(
      changeProposal.change_proposal_id,
    );
  });

  it("ADR-0292 §5: new event provenance links to original_calculation_id", () => {
    expect(result.newEventInsert.provenance.original_calculation_id).toBe(origCalc.id);
  });

  it("ADR-0292 §5: new calc provenance includes override_source", () => {
    expect(result.newCalcInsert.provenance.override_source).toBe("wage_line_override");
    expect(result.newCalcInsert.provenance.change_proposal_id).toBe(
      changeProposal.change_proposal_id,
    );
  });

  // §5 — Workspace + profile integrity
  it("new event carries correct workspace_id and profile_id", () => {
    expect(result.newEventInsert.workspace_id).toBe(origCalc.workspace_id);
    expect(result.newEventInsert.profile_id).toBe(origCalc.profile_id);
    expect(result.newEventInsert.shift_id).toBe(origCalc.schedule_shift_id);
  });

  it("new event calculated_by encodes appliedByProfileId", () => {
    expect(result.newEventInsert.calculated_by).toContain(APPLIED_BY);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 2: Idempotency (§6) — calling transform twice = same shapes
// ─────────────────────────────────────────────────────────────────────────────

describe("override-scenario — idempotency (ADR-0292 §6)", () => {
  it("calling applyOverrideTransform twice returns identical shapes (pure function, no state)", () => {
    const params = buildParams();
    const result1 = applyOverrideTransform(origCalc, origEvent, params);
    const result2 = applyOverrideTransform(origCalc, origEvent, params);

    // Structural equality on both output objects
    expect(result1.newCalcVersion).toBe(result2.newCalcVersion);
    expect(result1.newEventDerivationVersion).toBe(result2.newEventDerivationVersion);
    expect(result1.newCalcInsert.total_pay).toBe(result2.newCalcInsert.total_pay);
    expect(result1.newCalcInsert.calculation_version).toBe(
      result2.newCalcInsert.calculation_version,
    );
    expect(result1.newEventInsert.amount_nok).toBe(result2.newEventInsert.amount_nok);
    expect(result1.newEventInsert.derivation_version).toBe(
      result2.newEventInsert.derivation_version,
    );
    // Both calls return the same origCalc reference (not a clone that could diverge)
    expect(result1.originalCalcRow).toBe(result2.originalCalcRow);
  });

  it("idempotent: original calc total_pay stays 1500 across both calls", () => {
    applyOverrideTransform(origCalc, origEvent, buildParams()); // first call
    // If the function mutated origCalc this would fail
    expect(origCalc.total_pay).toBe(ORIGINAL_NOK);
    expect(origCalc.calculation_version).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 3: No-event path (§7) — first-time calculation, no prior event
// ─────────────────────────────────────────────────────────────────────────────

describe("override-scenario — no-event path (§7): origEvent is null", () => {
  const result = applyOverrideTransform(origCalc, null, buildParams());

  it("supersessionUpdate is null when no origEvent exists", () => {
    expect(result.supersessionUpdate).toBeNull();
  });

  it("new event derivation_version starts at 2 (1 + 1) when no prior event", () => {
    // derivation_version defaults to 1 when origEvent is null, then +1 → 2
    expect(result.newEventInsert.derivation_version).toBe(2);
  });

  it("new event shift_period_end_date falls back to origCalc.shift_date", () => {
    expect(result.newEventInsert.shift_period_end_date).toBe(origCalc.shift_date);
  });

  it("new event payroll_period_id falls back to origCalc.period_id", () => {
    expect(result.newEventInsert.payroll_period_id).toBe(origCalc.period_id);
  });

  it("new calc still gets calculation_version = 2 (original is 1)", () => {
    expect(result.newCalcInsert.calculation_version).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 4: Proposed amount precision (§8)
// ─────────────────────────────────────────────────────────────────────────────

describe("override-scenario — proposed amount precision (ADR-0292 §8)", () => {
  it("proposedAmountNok is correctly derived from cents (180000 → 1800)", () => {
    const params = buildParams();
    expect(params.proposedAmountNok).toBe(1800);
    expect(params.proposedAmountCents).toBe(180000);
  });

  it("new calc total_pay equals proposedAmountNok (not cents)", () => {
    const result = applyOverrideTransform(origCalc, origEvent, buildParams());
    expect(result.newCalcInsert.total_pay).toBe(1800);
    expect(result.newCalcInsert.total_pay).not.toBe(180000);
  });

  it("new event amount_nok equals proposedAmountNok", () => {
    const result = applyOverrideTransform(origCalc, origEvent, buildParams());
    expect(result.newEventInsert.amount_nok).toBe(1800);
  });

  it("override increases total_pay from 1500 to 1800 (proposed > original)", () => {
    const result = applyOverrideTransform(origCalc, origEvent, buildParams());
    expect(result.newCalcInsert.total_pay).toBeGreaterThan(result.originalCalcRow.total_pay);
    expect(result.newCalcInsert.total_pay - result.originalCalcRow.total_pay).toBe(300);
  });

  it("new calc rate_value_applied is 1 (fixed-amount override, not a rate)", () => {
    const result = applyOverrideTransform(origCalc, origEvent, buildParams());
    expect(result.newEventInsert.rate_value_applied).toBe(1);
    expect(result.newEventInsert.quantity_value).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 5: Bokføringsloven §13 — append-only invariant
// ─────────────────────────────────────────────────────────────────────────────

describe("override-scenario — Bokføringsloven §13 append-only invariant", () => {
  it("newCalcInsert has NO id field (original id must NOT be reused)", () => {
    const result = applyOverrideTransform(origCalc, origEvent, buildParams());
    expect("id" in result.newCalcInsert).toBe(false);
  });

  it("original calculation_version is 1 and remains 1 after transform", () => {
    applyOverrideTransform(origCalc, origEvent, buildParams());
    expect(origCalc.calculation_version).toBe(1);
  });

  it("new calc version is strictly greater than original (no version reuse)", () => {
    const result = applyOverrideTransform(origCalc, origEvent, buildParams());
    expect(result.newCalcInsert.calculation_version).toBeGreaterThan(origCalc.calculation_version);
  });

  it("fixture: expected.original_calc.total_pay matches ORIGINAL_NOK = 1500", () => {
    expect(expected.original_calc.total_pay).toBe(ORIGINAL_NOK);
  });

  it("fixture: expected.new_calc.total_pay matches PROPOSED_NOK = 1800", () => {
    expect(expected.new_calc.total_pay).toBe(PROPOSED_NOK);
  });
});
