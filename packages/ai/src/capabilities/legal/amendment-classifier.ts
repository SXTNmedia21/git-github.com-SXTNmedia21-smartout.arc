// packages/ai/src/capabilities/legal/amendment-classifier.ts
//
// Aml. §14-6 amendment classifier — pure function, zero I/O.
//
// What: classifyAmendment(prev, next, workspaceCtx) → AmendmentClassification.
//       Replaces the inline TARIFF_REVISION/UNION_CHANGE heuristic in
//       packages/ai/src/capabilities/payroll/tariff-tools.ts change_workspace_tariff.
//
// Why:  ADR-0252 §F and ADR-0236 require a single Lovsen-owned rule matrix for
//       all tariff/contract amendments. The previous inline heuristic in
//       change_workspace_tariff only distinguished union-change vs same-union;
//       it could not flag rate-floor drops, tariff→non-bound transitions, or
//       lønn-floor reductions (>15%) — all classes Aml. §15-7 + §14-6 treat as
//       ENDRINGSOPPSIGELSE (endring sidestilt med oppsigelse). Without
//       classifier coverage these would silently ship as UP and bypass
//       employee signering required by Aml. §14-6 + §15-3.
//
// Rule matrix (full citations in test names + reason strings):
//
//   Aml. §14-6        — 16 mandatory elements (a–p). Material changes to load-
//                       bearing elements (b lønn, c stilling, d arbeidstid)
//                       require ENDRINGSOPPSIGELSE per §15-7 + §15-3 notice.
//   Aml. §15-3        — notice period (1–6 months by tenure + age).
//   Aml. §15-7        — saklig grunn for oppsigelse; ENDRINGSOPPSIGELSE
//                       analogy applies to material reductions in vilkår.
//   Riksavtalen §4    — tariff-revision exception. New Riksavtalen version
//                       with rate updates on the SAME union binding = UP
//                       (not MATERIAL), explicit §14-6 carve-out per
//                       Riksavtalen mellom NHO Reiseliv og Fellesforbundet.
//                       Improves the ansatt's position → no signering required.
//
// Classifier outputs (3 values per spec contract):
//   UP                — no signering, autonomous engine apply, varsel only
//   MATERIAL          — admin commit + amendment row, no employee signering
//                       (covers improvements, neutral relabels, MATERIAL
//                       changes that don't reduce ansatt's position)
//   ENDRINGSOPPSIGELSE — blocked at cascade layer (AMENDMENT_BLOCKED §14-6(m));
//                       requires employee signering with §15-3 notice period
//
// Channel: this is a PURE function — no channel guard, no DB, no emit.
//          Callers (change_workspace_tariff, future amendment-handler) own
//          their own channel + gate + emit per ADR-0356 delegation pattern.
//
// L-0176: body written first. Docstring describes implemented body.
// ADR-0173: legal capability owns this rule matrix. Payroll calls it.

// ── Input shapes ────────────────────────────────────────────────────────────

/**
 * Snapshot of binding/contract state BEFORE the change.
 * Fields are optional — caller may not have all signals for every call site.
 * Classifier degrades gracefully (returns MATERIAL with explicit reason when
 * insufficient signal for UP vs ENDRINGSOPPSIGELSE).
 */
export type AmendmentPrevState = {
  /** Tariff union the workspace was bound to. 'non-bound' = no tariff. */
  union_id?: "taro-79" | "taro-226" | "non-bound" | string | null;
  /** Riksavtalen / overenskomst version e.g. '2024-2026'. */
  law_version?: string | null;
  /** Workspace was tariff-bound (union_id !== 'non-bound' && !== null). */
  is_tariff_bound?: boolean;
  /** Minimum hourly rate floor enforced at the time of prev state (ore/hour). */
  hourly_rate_floor_ore?: number | null;
  /** Monthly salary at prev state (ore). For lønn-floor MATERIAL checks. */
  monthly_salary_ore?: number | null;
  /** Stilling / job_title at prev state. */
  position_title?: string | null;
  /** Agreed weekly hours at prev state. */
  agreed_weekly_hours?: number | null;
};

/**
 * Snapshot of binding/contract state AFTER the change.
 * Same shape as AmendmentPrevState — classifier compares field-by-field.
 */
export type AmendmentNextState = AmendmentPrevState;

/**
 * Workspace-level context: industry, regulatory framework, special-scheme flags.
 * Currently used for the Riksavtalen tariff-revision carve-out (§14-6 exception).
 */
export type AmendmentWorkspaceCtx = {
  /** workspace_id — informational, not used for routing (caller resolves auth). */
  workspace_id?: string;
  /** True if this is a Riksavtalen version update (e.g. 2024 → 2025-mellomoppgjor). */
  is_tariff_revision_event?: boolean;
};

// ── Output shape ────────────────────────────────────────────────────────────

export type AmendmentClassifier = "UP" | "MATERIAL" | "ENDRINGSOPPSIGELSE";

export type AmendmentClassification = {
  classifier: AmendmentClassifier;
  /** Norwegian, paragraf-cited explanation. */
  reason: string;
  /** Aml./Riksavtalen paragraf references applied. */
  aml_refs: string[];
  /** True for ENDRINGSOPPSIGELSE (Aml. §14-6(m) + §15-3 signering). */
  requires_resigning: boolean;
  /** Aml. §15-3 notice period for ENDRINGSOPPSIGELSE; null otherwise. */
  notice_period_days: number | null;
};

// ── Constants ───────────────────────────────────────────────────────────────

/**
 * Lønn-reduction threshold for ENDRINGSOPPSIGELSE classification.
 * 15% chosen per Lovsen LEGAL-FRAMEWORK.md §5 table:
 *   ≥20%         = ENDRINGSOPPSIGELSE (HØY confidence)
 *   5–19%        = MEDIUM gråsone (advokat-anbefalt; classifier picks ENDRINGSOPPSIGELSE
 *                  at ≥15% as conservative default — Pontus §7.10 standard policy)
 *   <5%          = MATERIAL (ADMIN-class reduction, dokumentér)
 * 15% threshold = conservative middle of gråsonen.
 */
const LONN_REDUCTION_ENDRINGSOPPSIGELSE_THRESHOLD = 0.15;

/**
 * Default Aml. §15-3 notice period for ENDRINGSOPPSIGELSE.
 * §15-3 første ledd: hovedregel 1 måned (30 dager) hvis ikke annet er avtalt.
 * Caller may compute a more precise value from tenure + age and override.
 */
const DEFAULT_NOTICE_PERIOD_DAYS_AML_15_3 = 30;

// ── Helpers ─────────────────────────────────────────────────────────────────

function unionsEqual(
  prev: AmendmentPrevState["union_id"],
  next: AmendmentNextState["union_id"],
): boolean {
  return (prev ?? null) === (next ?? null);
}

function isTariffBound(state: AmendmentPrevState): boolean {
  if (typeof state.is_tariff_bound === "boolean") return state.is_tariff_bound;
  const uid = state.union_id ?? null;
  return uid !== null && uid !== "non-bound";
}

/**
 * Compute relative reduction in lønn (monthly_salary_ore or hourly_rate_floor_ore).
 * Returns a positive number when next < prev (reduction). 0 if no reduction or
 * insufficient data. Hourly floor takes precedence when both present (covers
 * tariff-bound workspaces where floor is the load-bearing signal).
 */
function lonnReductionPct(prev: AmendmentPrevState, next: AmendmentNextState): number {
  // Prefer hourly_rate_floor_ore for tariff-bound comparisons.
  const prevFloor = prev.hourly_rate_floor_ore ?? null;
  const nextFloor = next.hourly_rate_floor_ore ?? null;
  if (prevFloor !== null && nextFloor !== null && prevFloor > 0) {
    const delta = (prevFloor - nextFloor) / prevFloor;
    if (delta > 0) return delta;
  }
  // Fall back to monthly_salary_ore comparison.
  const prevMonthly = prev.monthly_salary_ore ?? null;
  const nextMonthly = next.monthly_salary_ore ?? null;
  if (prevMonthly !== null && nextMonthly !== null && prevMonthly > 0) {
    const delta = (prevMonthly - nextMonthly) / prevMonthly;
    if (delta > 0) return delta;
  }
  return 0;
}

function stillingChanged(prev: AmendmentPrevState, next: AmendmentNextState): boolean {
  const p = prev.position_title ?? null;
  const n = next.position_title ?? null;
  if (p === null || n === null) return false;
  return p.trim() !== n.trim();
}

function arbeidstidChanged(prev: AmendmentPrevState, next: AmendmentNextState): boolean {
  const p = prev.agreed_weekly_hours ?? null;
  const n = next.agreed_weekly_hours ?? null;
  if (p === null || n === null) return false;
  return p !== n;
}

// ── Main classifier ─────────────────────────────────────────────────────────

/**
 * Classify a contract / tariff-binding amendment per Aml. §14-6 + Riksavtalen §4.
 *
 * Decision order (highest-precedence rule wins, returns immediately):
 *   1.  No-op (prev === next on all observed fields)              → UP
 *   2.  Stilling (c) or arbeidstid (d) change                     → ENDRINGSOPPSIGELSE
 *   3.  Lønn reduction ≥15% (Aml. §15-7 analog)                   → ENDRINGSOPPSIGELSE
 *   4.  Tariff-bound → non-bound transition (loss of vilkår-floor) → ENDRINGSOPPSIGELSE
 *   4b. Not-bound → tariff-bound (improvement)                    → MATERIAL
 *   5.  Different union, significant rate-floor delta             → ENDRINGSOPPSIGELSE
 *   6.  Different union, comparable position (no reduction)       → MATERIAL
 *   7.  Same union, new law_version (Riksavtalen revision)        → UP
 *   8.  Small lønn-reduksjon < 15%                                → MATERIAL
 *   9.  Fallback (no observable §14-6 vilkår change)              → UP
 *
 * This is the SINGLE Lovsen-owned rule matrix. All capability tools that
 * mutate Aml. §14-6 fields MUST call this — no parallel heuristics.
 */
export function classifyAmendment(
  prev: AmendmentPrevState,
  next: AmendmentNextState,
  workspaceCtx: AmendmentWorkspaceCtx = {},
): AmendmentClassification {
  // ── Rule 1: no-op ──────────────────────────────────────────────────────────
  // Same union, same law_version, no stilling/arbeidstid/lønn change.
  if (
    unionsEqual(prev.union_id, next.union_id) &&
    (prev.law_version ?? null) === (next.law_version ?? null) &&
    !stillingChanged(prev, next) &&
    !arbeidstidChanged(prev, next) &&
    lonnReductionPct(prev, next) === 0
  ) {
    return {
      classifier: "UP",
      reason:
        "Ingen endring i vesentlige Aml. §14-6 vilkår (samme union, samme lov-versjon, ingen lønn/stilling/arbeidstid endring).",
      aml_refs: ["Aml. §14-6"],
      requires_resigning: false,
      notice_period_days: null,
    };
  }

  // ── Rule 2: stilling (c) or arbeidstid (d) change ─────────────────────────
  // Aml. §14-6 første ledd bokstav c (stilling) og d (arbeidstid) er load-
  // bearing vilkår. Endring her er sidestilt med oppsigelse per §15-7 analog.
  if (stillingChanged(prev, next)) {
    return {
      classifier: "ENDRINGSOPPSIGELSE",
      reason: `Endring av stilling (Aml. §14-6 bokstav c) fra '${prev.position_title ?? ""}' til '${next.position_title ?? ""}' er sidestilt med oppsigelse per Aml. §15-7. Krever ny signering og §15-3 oppsigelsesfrist.`,
      aml_refs: ["Aml. §14-6 bokstav c", "Aml. §15-7", "Aml. §15-3"],
      requires_resigning: true,
      notice_period_days: DEFAULT_NOTICE_PERIOD_DAYS_AML_15_3,
    };
  }
  if (arbeidstidChanged(prev, next)) {
    return {
      classifier: "ENDRINGSOPPSIGELSE",
      reason: `Endring av avtalt arbeidstid (Aml. §14-6 bokstav d) fra ${prev.agreed_weekly_hours ?? "?"} til ${next.agreed_weekly_hours ?? "?"} t/uke er sidestilt med oppsigelse per Aml. §15-7. Krever ny signering og §15-3 oppsigelsesfrist.`,
      aml_refs: ["Aml. §14-6 bokstav d", "Aml. §15-7", "Aml. §15-3"],
      requires_resigning: true,
      notice_period_days: DEFAULT_NOTICE_PERIOD_DAYS_AML_15_3,
    };
  }

  // ── Rule 3: lønn-reduksjon ≥15% ────────────────────────────────────────────
  const lonnDelta = lonnReductionPct(prev, next);
  if (lonnDelta >= LONN_REDUCTION_ENDRINGSOPPSIGELSE_THRESHOLD) {
    return {
      classifier: "ENDRINGSOPPSIGELSE",
      reason: `Reduksjon i lønn på ${(lonnDelta * 100).toFixed(1)}% (Aml. §14-6 bokstav b) overskrider 15%-terskelen. Sidestilt med oppsigelse per Aml. §15-7. Krever ny signering og §15-3 oppsigelsesfrist.`,
      aml_refs: ["Aml. §14-6 bokstav b", "Aml. §15-7", "Aml. §15-3"],
      requires_resigning: true,
      notice_period_days: DEFAULT_NOTICE_PERIOD_DAYS_AML_15_3,
    };
  }

  // ── Rule 4: tariff-bound → non-bound transition ───────────────────────────
  // Tap av tariff-floor = vesentlig reduksjon av vilkår. Aml. §14-6 bokstav m
  // (tariff-info) endres, §15-7 analog. MUST fire BEFORE Rule 6 (different
  // union → MATERIAL) since both prev.union_id !== next.union_id apply here.
  if (isTariffBound(prev) && !isTariffBound(next)) {
    return {
      classifier: "ENDRINGSOPPSIGELSE",
      reason: `Overgang fra tariff-bundet (${prev.union_id ?? "?"}) til ikke-tariff-bundet medfører tap av tariffens minstevilkår (Aml. §14-6 bokstav m). Sidestilt med oppsigelse per Aml. §15-7. Krever ny signering og §15-3 oppsigelsesfrist.`,
      aml_refs: ["Aml. §14-6 bokstav m", "Aml. §15-7", "Aml. §15-3"],
      requires_resigning: true,
      notice_period_days: DEFAULT_NOTICE_PERIOD_DAYS_AML_15_3,
    };
  }

  // ── Rule 4b: not-bound → tariff-bound transition (improvement) ────────────
  // MUST fire BEFORE Rule 5 (different union switch). Adding tariff-floor =
  // improvement of vilkår, not reduction. MATERIAL (admin-commit + varsel),
  // ingen signering.
  if (!isTariffBound(prev) && isTariffBound(next)) {
    return {
      classifier: "MATERIAL",
      reason: `Forbedring: overgang fra ikke-tariff-bundet til tariff-bundet (${next.union_id ?? "?"}). MATERIAL per Aml. §14-6 bokstav m — krever admin-commit og varsel, ikke ny signering (forbedring av vilkår).`,
      aml_refs: ["Aml. §14-6 bokstav m"],
      requires_resigning: false,
      notice_period_days: null,
    };
  }

  // ── Rule 5: different union, significant rate-floor delta ─────────────────
  // Bytte mellom tariff-avtaler med >5% lavere floor = vesentlig reduksjon.
  // Brukes når en workspace bytter union og rate-floor faller (negativ delta).
  if (!unionsEqual(prev.union_id, next.union_id)) {
    if (lonnDelta > 0.05) {
      return {
        classifier: "ENDRINGSOPPSIGELSE",
        reason: `Bytte av union (${prev.union_id ?? "?"} → ${next.union_id ?? "?"}) med ${(lonnDelta * 100).toFixed(1)}% reduksjon i rate-floor (Aml. §14-6 bokstav b + m). Sidestilt med oppsigelse per Aml. §15-7. Krever ny signering.`,
        aml_refs: ["Aml. §14-6 bokstav b", "Aml. §14-6 bokstav m", "Aml. §15-7", "Aml. §15-3"],
        requires_resigning: true,
        notice_period_days: DEFAULT_NOTICE_PERIOD_DAYS_AML_15_3,
      };
    }
    // ── Rule 6: different union, comparable position ────────────────────────
    return {
      classifier: "MATERIAL",
      reason: `Bytte av union (${prev.union_id ?? "?"} → ${next.union_id ?? "?"}) uten signifikant reduksjon i lønn-floor. MATERIAL endring per Aml. §14-6 bokstav m — krever admin-commit og varsel til ansatt, ikke ny signering.`,
      aml_refs: ["Aml. §14-6 bokstav m"],
      requires_resigning: false,
      notice_period_days: null,
    };
  }

  // ── Rule 7: same union, new law_version (Riksavtalen revisjon) ────────────
  // Riksavtalen §4 carve-out: indeksregulering / mellomoppgjør på SAMME union-
  // binding er forbedring eller justering ansatt har implisitt avtalt via
  // tariffmedlemskap. Aml. §14-6 krever ikke ny signering for slike revisjoner.
  if (
    unionsEqual(prev.union_id, next.union_id) &&
    (prev.law_version ?? null) !== (next.law_version ?? null) &&
    isTariffBound(next)
  ) {
    return {
      classifier: "UP",
      reason: `Riksavtalen-revisjon på samme union (${prev.law_version ?? "?"} → ${next.law_version ?? "?"}). Eksplisitt §14-6 carve-out — tariff-revisjon krever ikke ny signering (Riksavtalen §4 + ADR-0252 §F).`,
      aml_refs: ["Aml. §14-6", "Riksavtalen §4"],
      requires_resigning: false,
      notice_period_days: null,
    };
  }

  // ── Rule 8: same union, same law_version — fallback ──────────────────────
  // Reaches here if observed fields are all equal (caught by Rule 1) OR if
  // lønnDelta < 15% but > 0 (small reduction). Conservative: MATERIAL with
  // explicit reason. Caller decides whether to surface in change_proposal.
  if (lonnDelta > 0) {
    return {
      classifier: "MATERIAL",
      reason: `Mindre lønn-justering (${(lonnDelta * 100).toFixed(1)}% reduksjon, under 15%-terskel for ENDRINGSOPPSIGELSE). MATERIAL per Aml. §14-6 bokstav b — admin-commit med dokumentert grunnlag, varsel til ansatt anbefales.`,
      aml_refs: ["Aml. §14-6 bokstav b"],
      requires_resigning: false,
      notice_period_days: null,
    };
  }

  // ── Rule 10: ultimate fallback ────────────────────────────────────────────
  // Reached when prev/next differ in unobserved fields (e.g. tariff_revision
  // workspace ctx flag, derivation_snapshot_id changes). Default to UP — the
  // tariff-revision event flag (workspaceCtx.is_tariff_revision_event) is the
  // explicit signal Lovsen trusts. If neither stilling/arbeidstid/lønn nor
  // union nor law_version changed materially, no §14-6 vilkår was touched.
  if (workspaceCtx.is_tariff_revision_event) {
    return {
      classifier: "UP",
      reason:
        "Tariff-revisjons-event uten endring i §14-6 vilkår. UP per Riksavtalen §4 + ADR-0252 §F.",
      aml_refs: ["Aml. §14-6", "Riksavtalen §4"],
      requires_resigning: false,
      notice_period_days: null,
    };
  }
  return {
    classifier: "UP",
    reason:
      "Ingen vesentlig endring i Aml. §14-6 vilkår observert (fallback). Klassifisert som UP — admin-commit ikke krevd.",
    aml_refs: ["Aml. §14-6"],
    requires_resigning: false,
    notice_period_days: null,
  };
}
