---
title: "Journey — F-CL-12 Pattern B recalc on agent-invoked supplement + override mutations"
feature: f-cl-12-feriepenger-recalc-pattern-b
status: draft
updated: 2026-05-16
created: 2026-05-16
module: payroll
tags: [journey, payroll, feriepenger, capability, adr-0293, pattern-b]
---

# Journey — F-CL-12 Feriepenger Recalc Pattern B

## Summary

Three agent-invoked capability tools currently mutate payroll data without recomputing feriepenger_basis per ADR-0293 Pattern B. Closing F-CL-12 wires the canonical `computeFeriepengerBasis` helper (already shipped via F-CL-13 at commit `58d40f500`) into each tool, mirroring the proven pattern. Includes F-CL-17 misattribution cleanup at `deleteManualSupplement`.

---

## Journey 1: Agent adds manual supplement → feriepenger basis recomputes

**Role:** Botsson (agent)
**Verb:** Compose (mutation via capability tool)
**Channel:** Chat (capability tool only fires from agent chat)

**Precondition:**
- Profile P has an open payroll period
- P's current period totals: brutto X, feriepenger_basis Y
- Agent has authority for `payroll.addManualSupplement`

**Happy path:**

1. Agent invokes `addManualSupplement(profile_id=P, period_id=PE, amount=A, reason="...")`
2. Tool calls `gate_action(payroll.add_supplement)` per ADR-0287 → `gateEvaluationId = G`
3. Tool executes INSERT on `payroll_supplement` row
4. Tool calls `computeFeriepengerBasis(profile_id=P, period_id=PE, gate_evaluation_id=G)` → returns new basis Y'
5. Tool updates `payroll_period_total` row (or whatever canonical totals table) with new feriepenger_basis=Y'
6. Tool emits `payroll.feriepenger_basis_computed` with `{workspace_id, period_id=PE, profile_id=P, basis_amount=Y', pct_applied, gate_evaluation_id=G, channel}`
7. Tool emits its own `payroll.manual_supplement_added` (existing telemetry)
8. Tool returns success to agent

**Postcondition:**
- `payroll_supplement` has new row
- `payroll_period_total.feriepenger_basis = Y'` for (P, PE)
- `activity_trail` has both `manual_supplement_added` + `feriepenger_basis_computed` rows correlated via gate_evaluation_id = G
- Y' ≥ Y (supplement increased basis) OR Y' = Y (supplement type doesn't accrue feriepenger)

**Error paths:**
- **Caller lacks authority** → 403, no INSERT, no recalc
- **Period locked** → CHECK constraint or gate refuses, no INSERT
- **Recalc helper throws** → INSERT rolls back via transaction wrapper (must verify single tx scope)

---

## Journey 2: Agent deletes manual supplement → recompute + F-CL-17 misattribution fix

**Role:** Botsson (agent)
**Verb:** Compose (delete via capability tool)
**Channel:** Chat

**Precondition:**
- Manual supplement S exists for profile P in period PE
- P's current feriepenger_basis = Y' (after prior add)

**Happy path:**

1. Agent invokes `deleteManualSupplement(supplement_id=S, reason="...")`
2. Tool resolves S → row with `profile_id=P_resolved`, `period_id=PE_resolved`
3. **F-CL-17 fix:** verify `P_resolved` is correctly read from the supplement row (NOT from a wrong column or NULL fallback). Audit found misattribution — likely confusing `actor_profile_id` with `target_profile_id`.
4. Tool calls gate_action → gateEvaluationId = G
5. Tool DELETEs the row
6. Tool calls `computeFeriepengerBasis(P_resolved, PE_resolved, G)` → new basis Y'' (typically Y'' < Y' since supplement removed)
7. Tool updates period totals + emits both events with correct profile_id = P_resolved

**Postcondition:**
- Supplement row removed
- Period totals reflect Y'' for P_resolved (NOT for actor_profile_id if different)
- Activity trail attributions correct

**Error paths:**
- **Wrong profile attribution (F-CL-17 regression)** → vitest catches: setup supplement for P_a, call delete as P_b (with admin role), assert recalc emits for P_a not P_b
- **Supplement not found** → 404, no recalc

---

## Journey 3: Agent overrides calculation line → recompute affected profile

**Role:** Botsson (agent)
**Verb:** Compose (line value override)
**Channel:** Chat

**Precondition:**
- Calculation line L exists for profile P, period PE
- P's current feriepenger_basis = Y

**Happy path:**

1. Agent invokes `overrideCalculationLine(line_id=L, new_value=V, reason="...")`
2. Tool reads L → row with profile_id=P, period_id=PE
3. Fail-fast if line not found (L-0177: no JWT default fallback)
4. gate_action → G
5. UPDATE line value to V
6. computeFeriepengerBasis(P, PE, G) → Y'
7. Update period totals + emit both events

**Postcondition:**
- Line updated to V
- feriepenger_basis recomputed for (P, PE)
- Override telemetry preserved

**Error paths:**
- **Line not found** → 404 fail-fast, no UPDATE
- **Cross-workspace line** → ADR-0151 forgery defence rejects
- **Period locked** → gate refuses

---

## Acceptance criteria for closure

- Per-tool table (T0) shows all 3 tools have gate/gatedMutation/emit + Pattern B recalc
- 3 vitest suites green, including F-CL-17 misattribution regression at Journey 2 step 3
- F-CL-12 + F-CL-17 marked CLOSED in `docs/audits/2026-05-13-adr-contract-validation/00-SYNTHESIS.md`
- Manual trace through one journey (e.g., add supplement via Botsson chat) emits `payroll.feriepenger_basis_computed` once with correct basis_amount

## Out of scope for these journeys

- UI surface for showing feriepenger_basis to admin (Phase 4 surface, separate)
- Mobile-side recalc display (S2 sortie)
- Period close/reopen recalc triggers (different audit finding)
