/**
 * field-classification.ts — Contract field classification constants (ADR-0243).
 *
 * Single source of truth for which employment_contract columns are MATERIAL,
 * ADMIN, DERIVED, or SYSTEM. The amendment-handler reads this const to
 * determine whether a field change triggers an amendment flow.
 *
 * ADR-0001 §felt-klassifisering defines the four classes:
 *   MATERIAL  — triggers contract amendment + possible employee re-signature (Aml. §14-6)
 *   ADMIN     — administrative update, employer signature sufficient
 *   DERIVED   — computed from other fields, never triggers amendment
 *   SYSTEM    — internal metadata, never triggers amendment
 *
 * Constructive dismissal risk (Aml. §15-7):
 *   is_constructive_dismissal_risk = true when position_title changes AND
 *   (tariff_id changes OR agreed_weekly_hours reduces ≥20% OR monthly_salary reduces ≥20%).
 */

// ── Branded type for column keys ──────────────────────────────────────────────

export type ColumnKey = string & { readonly __brand: "ColumnKey" };

export function columnKey(s: string): ColumnKey {
  return s as ColumnKey;
}

// ── Classification enum ───────────────────────────────────────────────────────

export type FieldClassification = "material" | "admin" | "derived" | "system";

export interface FieldClassificationEntry {
  /** The DB column name on employment_contract */
  column: ColumnKey;
  classification: FieldClassification;
  /** True when this field change requires a new employee signature on the amendment */
  requires_employee_signature: boolean;
  /** True when this field change may constitute a constructive dismissal (Aml. §15-7) */
  constructive_dismissal_candidate: boolean;
  /** Human-readable description for the amendment document */
  label_nb: string;
}

// ── The canonical classification map ─────────────────────────────────────────
// Cross-reference: ADR-0001 §felt-klassifisering, ARCHITECTURE §3.3.

export const FIELD_CLASSIFICATION: Readonly<Record<string, FieldClassificationEntry>> = {
  // ─── MATERIAL: §14-6 core terms — require amendment + employee signature ───

  position_title: {
    column: columnKey("position_title"),
    classification: "material",
    requires_employee_signature: true,
    constructive_dismissal_candidate: true,
    label_nb: "Stillingstittel",
  },
  employment_form: {
    column: columnKey("employment_form"),
    classification: "material",
    requires_employee_signature: true,
    constructive_dismissal_candidate: true,
    label_nb: "Ansettelsesform",
  },
  agreed_weekly_hours: {
    column: columnKey("agreed_weekly_hours"),
    classification: "material",
    requires_employee_signature: true,
    constructive_dismissal_candidate: true,
    label_nb: "Avtalt ukentlig arbeidstid",
  },
  monthly_salary: {
    column: columnKey("monthly_salary"),
    classification: "material",
    requires_employee_signature: true,
    constructive_dismissal_candidate: true,
    label_nb: "Månedlig bruttolønn",
  },
  hourly_rate: {
    column: columnKey("hourly_rate"),
    classification: "material",
    requires_employee_signature: true,
    constructive_dismissal_candidate: true,
    label_nb: "Timesats",
  },
  start_date: {
    column: columnKey("start_date"),
    classification: "material",
    requires_employee_signature: true,
    constructive_dismissal_candidate: false,
    label_nb: "Startdato",
  },
  tariff_id: {
    column: columnKey("tariff_id"),
    classification: "material",
    requires_employee_signature: true,
    constructive_dismissal_candidate: true,
    label_nb: "Tariffavtale",
  },
  working_hours_scheme: {
    column: columnKey("working_hours_scheme"),
    classification: "material",
    requires_employee_signature: true,
    constructive_dismissal_candidate: false,
    label_nb: "Arbeidstidsordning",
  },
  workplace_location_id: {
    column: columnKey("workplace_location_id"),
    classification: "material",
    requires_employee_signature: true,
    constructive_dismissal_candidate: false,
    label_nb: "Arbeidssted",
  },
  remuneration_type: {
    column: columnKey("remuneration_type"),
    classification: "material",
    requires_employee_signature: true,
    constructive_dismissal_candidate: false,
    label_nb: "Lønnssystem",
  },
  end_date: {
    column: columnKey("end_date"),
    classification: "material",
    requires_employee_signature: true,
    constructive_dismissal_candidate: false,
    label_nb: "Sluttdato (for tidsbegrensede kontrakter)",
  },
  department_id: {
    column: columnKey("department_id"),
    classification: "material",
    requires_employee_signature: false,
    constructive_dismissal_candidate: false,
    label_nb: "Avdeling",
  },

  // ─── ADMIN: employer-side updates, employer signature sufficient ──────────

  notice_period_months: {
    column: columnKey("notice_period_months"),
    classification: "admin",
    requires_employee_signature: false,
    constructive_dismissal_candidate: false,
    label_nb: "Oppsigelsestid",
  },
  overtime_agreement_type: {
    column: columnKey("overtime_agreement_type"),
    classification: "admin",
    requires_employee_signature: false,
    constructive_dismissal_candidate: false,
    label_nb: "Overtidsavtale",
  },
  holiday_allowance_pct: {
    column: columnKey("holiday_allowance_pct"),
    classification: "admin",
    requires_employee_signature: false,
    constructive_dismissal_candidate: false,
    label_nb: "Feriepengeprosent",
  },
  probation_end_date: {
    column: columnKey("probation_end_date"),
    classification: "admin",
    requires_employee_signature: false,
    constructive_dismissal_candidate: false,
    label_nb: "Prøvetid utløp",
  },
  minimum_guaranteed_amount: {
    column: columnKey("minimum_guaranteed_amount"),
    classification: "admin",
    requires_employee_signature: false,
    constructive_dismissal_candidate: false,
    label_nb: "Minstegodtgjørelse",
  },

  // ─── DERIVED: computed from other fields, never triggers amendment ────────

  framework_snapshot: {
    column: columnKey("framework_snapshot"),
    classification: "derived",
    requires_employee_signature: false,
    constructive_dismissal_candidate: false,
    label_nb: "Tariff-snapshot (avledet)",
  },
  monthly_overtime_cap_hours: {
    column: columnKey("monthly_overtime_cap_hours"),
    classification: "derived",
    requires_employee_signature: false,
    constructive_dismissal_candidate: false,
    label_nb: "Månedlig overtidstak (avledet)",
  },

  // ─── SYSTEM: internal metadata ────────────────────────────────────────────

  status: {
    column: columnKey("status"),
    classification: "system",
    requires_employee_signature: false,
    constructive_dismissal_candidate: false,
    label_nb: "Kontraktstatus (system)",
  },
  signing_contract_id: {
    column: columnKey("signing_contract_id"),
    classification: "system",
    requires_employee_signature: false,
    constructive_dismissal_candidate: false,
    label_nb: "DocuSeal kontrakt-ID (system)",
  },
  superseded_by_contract_id: {
    column: columnKey("superseded_by_contract_id"),
    classification: "system",
    requires_employee_signature: false,
    constructive_dismissal_candidate: false,
    label_nb: "Erstattet av kontrakt-ID (system)",
  },
  sync_status: {
    column: columnKey("sync_status"),
    classification: "system",
    requires_employee_signature: false,
    constructive_dismissal_candidate: false,
    label_nb: "Synkroniseringsstatus (system)",
  },
  tripletex_employee_id: {
    column: columnKey("tripletex_employee_id"),
    classification: "system",
    requires_employee_signature: false,
    constructive_dismissal_candidate: false,
    label_nb: "Tripletex ansatt-ID (system)",
  },
};

// ── Helper: get classification for a column ───────────────────────────────────

export function getFieldClassification(column: string): FieldClassificationEntry | null {
  return FIELD_CLASSIFICATION[column] ?? null;
}
