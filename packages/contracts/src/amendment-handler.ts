/**
 * amendment-handler.ts — Server-only contract amendment classifier (ADR-0243).
 *
 * Reads FIELD_CLASSIFICATION from field-classification.ts (single source of truth)
 * to classify a field change as MATERIAL, ADMIN, DERIVED, or SYSTEM.
 *
 * NOT a capability tool — this is a server-only handler invoked via
 * gate_action channel='system'. No chat surface.
 *
 * is_constructive_dismissal_risk logic (Aml. §15-7):
 *   true when the amendment changes position_title AND EITHER:
 *     - tariff_id changes, OR
 *     - agreed_weekly_hours reduces by ≥20% vs the previous value, OR
 *     - monthly_salary reduces by ≥20% vs the previous value
 *
 * ESKALÉR note (from HANDOFF): the exact thresholds (20%) are an
 * interpretation of Aml. §15-7 "vesentlig endring" — arbeidsrettsadvokat
 * review required before go-live.
 *
 * Usage:
 *   import { classifyChange, type ChangeClassification } from './amendment-handler.js';
 *   const result = classifyChange('position_title', oldValue, newValue, { position_title changed, ... });
 */

import {
  FIELD_CLASSIFICATION,
  getFieldClassification,
  type FieldClassification,
} from "./field-classification.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChangeClassification {
  column: string;
  classification: FieldClassification;
  requires_employee_signature: boolean;
  /** True when this change meets the constructive dismissal risk criteria (Aml. §15-7) */
  is_constructive_dismissal_risk: boolean;
  label_nb: string;
}

/**
 * Context for constructive dismissal risk calculation.
 * Provide old+new values for other fields in the SAME amendment batch
 * so we can evaluate compound conditions (e.g. position_title + salary reduction).
 */
export interface ConstructiveDismissalContext {
  /** All field changes in this amendment: Record<columnKey, { from, to }> */
  allChanges: Record<string, { from: unknown; to: unknown }>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Threshold for "significant" reduction (Aml. §15-7 vesentlig endring interpretation) */
const CONSTRUCTIVE_DISMISSAL_REDUCTION_THRESHOLD = 0.2; // 20%

// ── Helpers ───────────────────────────────────────────────────────────────────

function isNumericReduction(from: unknown, to: unknown, threshold: number): boolean {
  if (typeof from !== "number" || typeof to !== "number") return false;
  if (from <= 0) return false;
  const reduction = (from - to) / from;
  return reduction >= threshold;
}

function isConstructiveDismissalRisk(
  column: string,
  from: unknown,
  to: unknown,
  ctx: ConstructiveDismissalContext,
): boolean {
  // Only relevant for constructive_dismissal_candidate columns.
  const entry = getFieldClassification(column);
  if (!entry?.constructive_dismissal_candidate) return false;

  const changes = ctx.allChanges;

  // Rule: position_title changes AND (tariff_id changes OR hours/salary drop ≥20%)
  if (column === "position_title" || changes["position_title"]) {
    const positionTitleChanged = column === "position_title" || !!changes["position_title"];
    if (!positionTitleChanged) return false;

    // tariff_id change?
    const tariffChanged =
      column === "tariff_id" ||
      (changes["tariff_id"] !== undefined && changes["tariff_id"].from !== changes["tariff_id"].to);

    // agreed_weekly_hours reduction ≥20%?
    let hoursReduced = false;
    if (column === "agreed_weekly_hours") {
      hoursReduced = isNumericReduction(from, to, CONSTRUCTIVE_DISMISSAL_REDUCTION_THRESHOLD);
    } else if (changes["agreed_weekly_hours"]) {
      hoursReduced = isNumericReduction(
        changes["agreed_weekly_hours"].from,
        changes["agreed_weekly_hours"].to,
        CONSTRUCTIVE_DISMISSAL_REDUCTION_THRESHOLD,
      );
    }

    // monthly_salary reduction ≥20%?
    let salaryReduced = false;
    if (column === "monthly_salary") {
      salaryReduced = isNumericReduction(from, to, CONSTRUCTIVE_DISMISSAL_REDUCTION_THRESHOLD);
    } else if (changes["monthly_salary"]) {
      salaryReduced = isNumericReduction(
        changes["monthly_salary"].from,
        changes["monthly_salary"].to,
        CONSTRUCTIVE_DISMISSAL_REDUCTION_THRESHOLD,
      );
    }

    return tariffChanged || hoursReduced || salaryReduced;
  }

  return false;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Classify a single field change in an employment_contract amendment.
 *
 * @param column  - The DB column name being changed.
 * @param from    - The current (before) value.
 * @param to      - The new (after) value.
 * @param ctx     - All field changes in this amendment batch (for compound risk checks).
 * @returns ChangeClassification describing the amendment implications.
 */
export function classifyChange(
  column: string,
  from: unknown,
  to: unknown,
  ctx: ConstructiveDismissalContext = { allChanges: {} },
): ChangeClassification {
  const entry = getFieldClassification(column);

  // Unknown columns default to SYSTEM — safest assumption.
  if (!entry) {
    return {
      column,
      classification: "system",
      requires_employee_signature: false,
      is_constructive_dismissal_risk: false,
      label_nb: column,
    };
  }

  const isConstructiveDismissal = isConstructiveDismissalRisk(column, from, to, ctx);

  return {
    column,
    classification: entry.classification,
    requires_employee_signature: entry.requires_employee_signature,
    is_constructive_dismissal_risk: isConstructiveDismissal,
    label_nb: entry.label_nb,
  };
}

/**
 * Classify ALL changes in an amendment batch.
 * Returns a summary with the worst-case classification and aggregate risk.
 */
export interface BatchClassificationResult {
  changes: ChangeClassification[];
  /** Worst-case classification across all fields (system < derived < admin < material) */
  worst_classification: FieldClassification;
  requires_employee_signature: boolean;
  is_constructive_dismissal_risk: boolean;
  material_fields: string[];
  admin_fields: string[];
}

const CLASSIFICATION_ORDER: FieldClassification[] = ["system", "derived", "admin", "material"];

export function classifyBatch(
  changes: Record<string, { from: unknown; to: unknown }>,
): BatchClassificationResult {
  const ctx: ConstructiveDismissalContext = { allChanges: changes };

  const classified = Object.entries(changes).map(([col, { from, to }]) =>
    classifyChange(col, from, to, ctx),
  );

  const worstIdx = classified.reduce((max, c) => {
    const idx = CLASSIFICATION_ORDER.indexOf(c.classification);
    return idx > max ? idx : max;
  }, 0);

  const worstClassification = CLASSIFICATION_ORDER[worstIdx] ?? "system";
  const requiresEmployeeSignature = classified.some((c) => c.requires_employee_signature);
  const isConstructiveDismissal = classified.some((c) => c.is_constructive_dismissal_risk);
  const materialFields = classified
    .filter((c) => c.classification === "material")
    .map((c) => c.column);
  const adminFields = classified.filter((c) => c.classification === "admin").map((c) => c.column);

  return {
    changes: classified,
    worst_classification: worstClassification,
    requires_employee_signature: requiresEmployeeSignature,
    is_constructive_dismissal_risk: isConstructiveDismissal,
    material_fields: materialFields,
    admin_fields: adminFields,
  };
}
