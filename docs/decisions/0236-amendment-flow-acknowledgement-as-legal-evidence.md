---
title: "Amendment Flow + AcknowledgementRing as §14-6 Legal Evidence"
id: ADR_0236
status: proposed
layer: decision
created: 2026-04-29
updated: 2026-04-29
---

# ADR-0236: Amendment Flow + AcknowledgementRing as §14-6 Legal Evidence

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
3. amendment-handler (server-side, not capability) computes `requires_employee_signature` from TS field-classification const (per ADR-0235): `MATERIAL → true`, `ADMIN/DERIVED/SYSTEM → false`.
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

## References

- Council 2026-04-29 Contract Module Phase 0a
- ADR-0181 (K1a→K1b template inheritance + drift detection)
- ADR-0182 (template vs contract lifecycle)
- ADR-0233 (schema migration — paired)
- ADR-0234 (capability split — paired)
- ADR-0235 (obligation lifecycle — paired)
- L-0174 (compose vs author verb collision)
- WCAG 2.1 AAA criteria for legally-binding interactions
- §14-6 Arbeidsmiljøloven

---

> Registered in `docs/decisions/0000-decision-log.md` 2026-04-29.
