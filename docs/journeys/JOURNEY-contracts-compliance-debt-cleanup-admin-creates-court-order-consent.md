---
title: "Admin creates court order consent"
feature: contracts-compliance-debt-cleanup
status: verified
created: 2026-05-14
updated: 2026-05-14
module: payroll
tags: [contracts, payroll, consent, court-order, aml-14-15]
---

# Journey: Admin Creates Court Order Consent

Closes the consent-loop debt from T2 SMA-328. Admin can persist a `payroll.consent_document` row for utleggstrekk fra namsmann (court-order-based trekk) without DocuSeal signing flow.

## Preconditions

- Workspace exists with at least one admin profile and one employee profile.
- Employee profile belongs to the same workspace as the admin (JWT-derived).
- Track C migration `20260616100300` has been applied (`engine_authority_config` row for `capability='contract'` exists — used as authority reference; payroll capability uses default-allow until separate seed lands).

## Happy Path

1. **User**: Admin opens payroll period for employee. Court order arrives from namsmann (e.g. utleggstrekk-saksnummer `UTL-2026-12345`).
2. **User**: Admin uploads court order PDF, captures `signedAt` (date court order issued) + `signedDocumentUrl`.
3. **User**: Admin submits form, triggering POST `/api/payroll/consent-documents` with body:
   ```json
   {
     "employeeProfileId": "<uuid>",
     "consentType": "court_order",
     "courtOrderReference": "UTL-2026-12345",
     "signedAt": "2026-05-14T10:00:00Z",
     "signedDocumentUrl": "https://storage.smartout.ai/court-orders/<uuid>.pdf"
   }
   ```
4. **System**: Route handler validates body via Zod schema. Rejects malformed body with 400.
5. **System**: `resolvePayrollAuth(request)` resolves `workspaceId` + `actorProfileId` from JWT cookie (ADR-0151 — server-derived, never from body).
6. **System**: `gateAction('payroll', 'create_consent_document', ...)` evaluates C4 authority. Default-allow until workspace-specific seed lands. Deny → 403 `gate_denied`.
7. **System**: Validates `employeeProfileId` belongs to JWT workspace (L-0177 fail-fast). Not in workspace → 404 explicit.
8. **System**: INSERT `payroll.consent_document` with `consent_type='court_order'`, `docuseal_submission_id IS NULL`, `paragraph_ref='Aml. §14-15 tredje ledd nr. 1-6'`, `status='active'`.
9. **System**: Emits telemetry event `payroll.consent_document.created` with properties `{consent_document_id, employee_profile_id, consent_type, court_order_reference, actor_role}`. Destinations: posthog + activity_trail + logger + engine_event.
10. **User**: Receives 201 response with `consentDocumentId`.
11. **User**: Later, manager opens LineOverrideModal, picks category `deduction`, selects the new consent from picker (GET `/api/payroll/deduction-consents` returns it).
12. **User**: Manager submits trekk — POST `/api/payroll/propose-line-override` succeeds with `consent_document_id` linked to `change_proposal`.

## Postcondition

- `payroll.consent_document` row exists with `consent_type='court_order'`, no DocuSeal signature attached.
- Activity trail audit row created.
- Telemetry event fired to PostHog + activity_trail + engine_event.

## Error Paths

| Code | Cause | Response |
|------|-------|----------|
| 400 | Zod validation fail (missing `courtOrderReference`, invalid UUID, etc.) | `{ ok: false, error: <zod issue> }` |
| 401 | No JWT cookie / Bearer token | `{ ok: false, error: "unauthorized" }` |
| 403 | gateAction denied (capability/role/workspace policy) | `{ ok: false, error: "gate_denied", reason }` |
| 404 | `employeeProfileId` not in JWT workspace **OR** `consentType !== 'court_order'` (with code `consent_type_requires_docuseal`) | `{ ok: false, error: "...", code }` |
| 500 | DB insert failure | `{ ok: false, error: "internal" }` |

## Out-of-Scope (deferred)

- DocuSeal-mediated consent types (`loan_agreement`, `uniform_policy`, `union_dues`, `other_voluntary`) → separate sortie with envelope creation + signing UX + webhook completion branch.
- §14-6 bokstaver g/h/k/q field-mapping gap (T1 debt) → separate sortie with design decision (add columns vs mark `tracked: false`).

## Tests

- pgTAP: `supabase/tests/payroll_consent_document_{rls,fk,deviation}.sql`
- Playwright E2E: `apps/e2e/tests/contracts-compliance-debt/journey-{court-order-create,non-court-order-rejected,court-order-then-trekk}.spec.ts`
