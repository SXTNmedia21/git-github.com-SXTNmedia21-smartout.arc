---
title: "Journey — Lovsen amendment-classifier validates paragraph binding"
feature: sma-328-aml-14-15-trekk-consent
journey: lovsen-validates-paragraph-binding
status: draft
verified_at: null
e2e_test: null
created: 2026-05-12
updated: 2026-05-12
module: payroll
tags: [journey, payroll, compliance, lovsen]
---

# Journey: Lovsen validates paragraph binding on submit

**Role:** system (Lovsen capability)

**Precondition:**
- Override-submit accepted by BFF (Journey 1 completed up to step 6)
- Lovsen capability deployed + `amendment-classifier` tool registered

## Happy Path

1. BFF emits `payroll.deduction_consent_referenced` event with `{ consent_signature_id, override_id, workspace_id, paragraph: "Aml. §14-15 1.ledd" }`
2. Lovsen capability subscribes → invokes `amendment-classifier` tool
3. Tool reads `confirmation_signature` + linked policy doc → validates paragraf-binding (consent-text references §14-15 OR explicit deduction policy)
4. Returns `{ compliant: true | false, paragraph_match: true, signed_at_valid: true, evidence_uri: "..." }`
5. `activity_trail` logged with `event = "compliance.validated"`, `data.paragraph_ref = "Aml. §14-15 1.ledd"`, `data.lovsen_verdict = "compliant"`
6. If non-compliant → emit `compliance.amendment_required` for governance follow-up (no rollback — override stays, but flagged)

**Postcondition:**
- Activity trail has lovsen verdict
- Non-compliant cases surface in governance dashboard

## Error Paths

- **Lovsen-MCP unreachable** → log `compliance.validation_deferred` + retry via heartbeat; do not block override
- **Policy doc missing** → `compliant: false` with reason `policy_doc_missing`

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes (path in `e2e_test:` frontmatter)
- [ ] Manually tested end-to-end
