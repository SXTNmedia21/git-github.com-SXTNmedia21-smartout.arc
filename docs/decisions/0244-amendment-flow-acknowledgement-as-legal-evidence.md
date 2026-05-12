---
title: "Amendment Flow + AcknowledgementRing as §14-6 Legal Evidence"
id: ADR_0244
renumbered_from: ADR_0236
status: proposed
layer: decision
created: 2026-04-29
updated: 2026-04-29
---

# ADR-0244: Amendment Flow + AcknowledgementRing as §14-6 Legal Evidence

## Context and Problem Statement

`contract_amendment` table introduces a single state machine for both MATERIAL endringer (require employee re-signing) and ADMIN endringer (admin-effectuated, no consent). Original constraint `contract_amendment_accepted_requires_signatures` mandates BOTH signatures for `status='accepted'` — blocks ADMIN-class amendments per ADR-0001-contract-service §"Felt-klassifisering" (line 197: "ADMIN — admin kan endre uten consent"). Internal contradiction.

Separately, AcknowledgementRing component drives Journey 2 contract send. §14-6 acceptance is a legal-binding event under Norwegian arbeidsmiljølov. Current component lacks WCAG AAA accessibility (no `aria-live`, no per-block screen reader announcement, no focus management) — insufficient legal evidence for accessibility-compliance audit.

## Decision Drivers

- ADR-0001-contract-service §Felt-klassifisering distinguishes MATERIAL (consent) vs ADMIN (no consent) — single constraint cannot enforce both
- §14-6 contract acceptance is a legal-binding event; accessibility evidence required (WCAG AAA preferred)
- AcknowledgementRing must produce reproducible audit trail showing exactly which blocks were acknowledged when
- Frontend Designer Council finding: 6 new animated elements need `useReducedMotion` guards
- ADR-0181 tariff drift indicator must surface in TariffBadge on `/my-contract`

## Considered Options

### Amendment constraint
1. **Single state machine + `requires_employee_signature` boolean** — gate constraint on flag. ADMIN-class amendments set flag false, transition to `accepted` directly. MATERIAL-class amendments require both signatures.
2. **Two state machines** — split `contract_amendment` into `admin_amendment` + `material_amendment` tables. High duplication.
3. **Drop constraint, enforce in app layer** — accept loss of DB-level guarantee.

### AcknowledgementRing legal evidence
A. **Configurable blocks (current) + WCAG AAA hardening** — keep API, add aria-live, per-block role=checkbox + aria-checked, focus management.
B. **Hardcoded 4 blocks** — Frontend Council rejects this regression.
C. **Per-framework block config + audit emit** — blocks driven by `framework.acknowledgement_blocks` config; each toggle emits `contract.acknowledgement.block_confirmed` to activity_trail.

## Decision Outcome

Amendment constraint: **Option 1** — single state machine with `requires_employee_signature` boolean column.
AcknowledgementRing: **Option C** — per-framework configurable blocks + audit emit per acknowledgement.

### Amendment changes

1. Add column `contract_amendment.requires_employee_signature boolean NOT NULL` (computed from MATERIAL/ADMIN classification at insert).
2. Replace constraint:
   ```sql
   CONSTRAINT contract_amendment_accepted_requires_signatures CHECK (
     status != 'accepted'
     OR (
       (requires_employee_signature = true
         AND signed_by_employee_at IS NOT NULL
         AND signed_by_employer_at IS NOT NULL)
       OR
       (requires_employee_signature = false
         AND signed_by_employer_at IS NOT NULL)
     )
   )
   ```
3. amendment-handler (server-side, not capability) computes `requires_employee_signature` from TS field-classification const (per ADR-0243): `MATERIAL → true`, `ADMIN/DERIVED/SYSTEM → false`.
4. ADMIN amendments: admin signature only, employee gets notification (push/email per ARCH §5.3 step 4) but no consent gate.
5. MATERIAL amendments: require both signatures via DocuSeal re-sign flow.

### AcknowledgementRing changes

1. Configurable `blocks` array prop (preserves API). For Riksavtalen Hospitality 2024 default = `["stilling", "lønn", "kategori", "framework"]` from `framework.acknowledgement_blocks` config.
2. Each toggle emits `contract.acknowledgement.block_confirmed` event with `{contract_id, block_name, profile_id, workspace_id, timestamp}` — registered in `packages/telemetry/src/registry.ts`.
3. WCAG AAA additions:
   - `role="group"` + `aria-label="Bekreft kontrakt"` on container
   - Each block: `role="checkbox"` + `aria-checked` + `aria-describedby`
   - Progress count: `aria-live="polite"` ("2 av 4 bekreftet")
   - Send button: `aria-disabled` + `aria-describedby` pointing at unacknowledged-count
   - All animations use `useReducedMotion` guard from `motionTokens.spring`
4. Audit-log on send completion: `activity_trail` row containing full block confirmation timestamps (legal evidence trail).

### Mobile parity (per ADR-0133)

| Journey | Web | Mobile |
|---------|-----|--------|
| 5 admin amendment authoring | ✓ | ✗ (compose verb) |
| 5 employee re-sign | ✓ | ✓ (witness verb, mobile bottom sheet variant) |

ContractAmendmentDiff component (new) renders field-level diffs only (not full record). Mobile = stacked rows; web = side-by-side panes. Reuses `bg-emerald-500/10` (added) + `bg-rose-500/10` (removed) tokens — no new tokens.

### TariffBadge component (new)

Per ADR-0181 drift indicator. Three states:
- Green: synced, framework current
- Amber: pending review, last sync > 7 days
- Red: stale, last sync > 30 days

Click → opens framework `EntityDrawer`. Phase 0a ships badge with tooltip; Phase 0b adds clickable destination.

## Rules & Consequences

- **Good, because** ADMIN amendments transition correctly; legal evidence trail reproducible per §14-6 audit; WCAG AAA minimum for legal-binding interactions; framework-agnostic block config allows future tariffs without code change.
- **Bad, because** `requires_employee_signature` adds column to compute at insert (small overhead); audit emit per block toggle adds N events per send (acceptable — bounded); WCAG AAA hardening adds component complexity.
- **Agent Impact:** Build agents implementing amendment-handler MUST: (a) compute `requires_employee_signature` from TS classification const, never DB; (b) emit `contract.acknowledgement.block_confirmed` per block toggle. Frontend agents implementing AcknowledgementRing MUST: (a) WCAG AAA aria coverage; (b) `useReducedMotion` guards on all spring animations; (c) per-framework block config from `framework.acknowledgement_blocks`.

## Lovsen Amendments 2026-04-29 (Aml. §15-7 endringsoppsigelse + §14-5 bevis)

### Endringsoppsigelse-flag (Aml. §15-7 saklig grunn)

ADR-0001 amendment-flow distinguishes MATERIAL vs ADMIN — but does NOT distinguish material edits from **endringsoppsigelse** (constructive dismissal). When admin changes `job_title` + `tariff_id` + `agreed_weekly_hours` together, this is juridisk sett **oppsigelse av eksisterende stilling kombinert med tilbud om ny stilling** under Aml. §15-7, requiring **saklig grunn**.

Schema + amendment-flow without this distinction can fasilitere ulovlig endringsoppsigelse.

**Required:**

1. Add `is_constructive_dismissal_risk boolean NOT NULL DEFAULT false` column on `contract_amendment`.
2. amendment-handler computes `is_constructive_dismissal_risk = true` when amendment changes `job_title` AND (`tariff_id` OR `agreed_weekly_hours` OR `monthly_salary` reduced by ≥20%).
3. UI surfaces explicit Lovsen-warning: "Denne endringen kan utgjøre endringsoppsigelse iht. Aml. §15-7. Saklig grunn-vurdering kreves. Anbefalt: kontakt arbeidsrettsadvokat før amendment lages."
4. Admin must explicitly check `acknowledged_constructive_dismissal_risk` checkbox before amendment can be created (legal-evidence-trail).

**MEDIUM confidence (endringsoppsigelse er skjønnsbasert).** **ESKALÉR — arbeidsrettsadvokat-review for grenseverdiene.**

### PDF-preview obligatorisk før signering (Aml. §14-5 bevis-byrde)

ARCHITECTURE §5.2 sier "ansatt ser strukturerte fakta i app, ikke PDF som primær view. PDF lastes ned hvis ønsket." This is **juridisk risiko** if structured view diverges from final PDF — ansatt bekrefter noe annet enn det endelige avtaledokumentet.

**Required:**

1. PDF-preview is OBLIGATORISK before AcknowledgementRing-toggle becomes enabled.
2. AcknowledgementRing renders `disabled` state until `pdf_preview_viewed_at` timestamp set on session.
3. Audit trail entry `contract.pdf_preview_viewed` emitted with PDF hash + timestamp + profile_id.
4. PDF content MUST mirror structured-view content exactly — no divergent fields.

**MEDIUM confidence (Aml. §14-5 + Prop. 57 L 2021-2022 om digital signering).**

### `regnskapsår_slutt + 5 år` retention clarification (Bokføringsloven §13)

`contract_amendment.amendment_date + 5 år` is wrong retention basis. Correct: `5 years from end of fiscal year (regnskapsår_slutt)` covering the amendment's salary impact period.

**Required:**

1. `contract_amendment` retention computed from latest `shift_pay_calculation` linked via `contract_id` + 5 years from that fiscal-year-end.
2. Anonymisering trigger reads `EXTRACT(YEAR FROM latest_pay_calc.calculated_at) + 5` as cutoff.
3. Document in §"Compliance" of ADR-0001 §8.

**HØY confidence (Bokføringsloven §13 + Finansdepartementets veiledning).**

## References

- Council 2026-04-29 Contract Module Phase 0a
- Lovsen Hospitality Intelligence review 2026-04-29
- ADR-0181 (K1a→K1b template inheritance + drift detection)
- ADR-0182 (template vs contract lifecycle)
- ADR-0241 (schema migration — paired)
- ADR-0242 (capability split — paired)
- ADR-0243 (obligation lifecycle — paired)
- L-0174 (compose vs author verb collision), L-0181 (persona vocabulary doesn't justify agent architecture)
- WCAG 2.1 AAA criteria for legally-binding interactions
- Aml. §14-5, §14-6, §15-7 (Arbeidsmiljøloven)
- Bokføringsloven §13
- Prop. 57 L 2021-2022 om digital signering

---

> Registered in `docs/decisions/0000-decision-log.md` 2026-04-29.
