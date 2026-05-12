---
title: "Journey — Manager applies trekk with signed consent (happy path)"
feature: sma-328-aml-14-15-trekk-consent
journey: manager-applies-trekk-with-consent
status: draft
verified_at: null
e2e_test: null
created: 2026-05-12
updated: 2026-05-12
module: payroll
tags: [journey, payroll, compliance]
---

# Journey: Manager applies trekk with signed consent (happy path)

**Role:** manager

**Precondition:**
- Employee has a signed `confirmation_signature` row with `confirmation_type = deduction_consent` linked to a relevant policy (uniform-policy / loan-agreement / fagforening)
- Payroll period is open (not locked)
- Manager has `payroll.write` authority

## Happy Path

1. Manager opens `/dashboard/payroll/[periodId]` LineDrawer for an employee
2. Clicks "Override" on a line → `LineOverrideModal` opens
3. Selects category = `deduction` (new value) → modal reveals consent-picker dropdown
4. Dropdown shows employee's signed `deduction_consent` confirmation_signatures (most recent first, descriptive label: "Uniform-policy 2026-03-15")
5. Manager picks consent + fills amount (negative for trekk) + reason (≥8 chars)
6. Submits → `POST /api/payroll/propose-line-override` → BFF validates → INSERTs override row with `consent_signature_id` populated
7. Emits `payroll.deduction_consent_referenced` telemetry
8. Lovsen amendment-classifier logs paragraph-binding to `activity_trail.data.paragraph_ref = "Aml. §14-15 1.ledd"`
9. UI shows success toast → modal closes → line row shows pending-override badge

**Postcondition:**
- Override row stored with `category=deduction` + valid `consent_signature_id` FK
- Activity trail has paragraph-binding record
- Lovsen returns compliant verdict

## Error Paths

- **Consent missing on employee** → dropdown empty + helper text "Ansatt har ingen signerte trekk-samtykker. Send avtale via DocuSeal først."
- **Consent expired** → exclude from dropdown OR flag with strike-through + warning

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes (path in `e2e_test:` frontmatter)
- [ ] Manually tested end-to-end
