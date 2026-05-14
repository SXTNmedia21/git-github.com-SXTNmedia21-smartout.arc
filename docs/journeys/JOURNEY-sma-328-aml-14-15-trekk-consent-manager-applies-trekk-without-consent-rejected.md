---
title: "Journey — BFF rejects trekk without consent with §14-15 reference"
feature: sma-328-aml-14-15-trekk-consent
journey: manager-applies-trekk-without-consent-rejected
status: verified
verified_at: null
e2e_test: null
created: 2026-05-12
updated: 2026-05-14
module: payroll
tags: [journey, payroll, compliance, error-path]
---

# Journey: BFF rejects trekk without consent

**Role:** manager (attempting non-compliant action)

**Precondition:**
- Manager hits `/api/payroll/propose-line-override` directly (e.g. via API client OR UI bypass) with `category=deduction` AND missing `signed_consent_signature_id`

## Happy Path

1. Request: `POST /api/payroll/propose-line-override` with `{ category: "deduction", amount: -500, reason: "uniform damage", line_id: "...", signed_consent_signature_id: null }`
2. BFF Zod schema rejects → 422
3. Response body: `{ code: "AML_14_15_CONSENT_REQUIRED", paragraph: "Aml. §14-15 1.ledd", message: "Trekk uten signert samtykke = Aml. §14-15 brudd" }`
4. `activity_trail` logs blocked attempt with `event = "compliance.blocked"`, `data.paragraph = "Aml. §14-15"`
5. UI surfaces blocking error in modal — submit-button stays disabled until consent picked

**Postcondition:**
- No override row inserted
- Compliance-blocked event logged for audit

## Error Paths

- **Consent ID supplied but FK invalid** → 404 "Consent not found"
- **Consent supplied but belongs to different profile** → 403 "Consent does not belong to this employee"
- **Consent supplied but `confirmation_type ≠ deduction_consent`** → 422 "Wrong consent type"

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes (path in `e2e_test:` frontmatter)
- [ ] Manually tested end-to-end
