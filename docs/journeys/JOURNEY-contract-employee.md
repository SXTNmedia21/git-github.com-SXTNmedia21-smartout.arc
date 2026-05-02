---
title: "Journey — Contract Employee Module (Wave 3-6 Fulfillment)"
feature: contract-employee
status: verified
updated: 2026-04-29
created: 2026-04-29
module: contracts
tags: [contract, employment, waves, verified, e2e-scaffolded]
---

# Journey: Contract Employee Module (Wave 3-6)

This journey aggregates the 5 core user flows for employment contract lifecycle, spanning Waves 3-6 of the `feat/services-contract-employee` sortie.

## Reference

Full journey specifications: `docs/architecture/contract-service/JOURNEY-contract-module.md` (5 journeys, E2E scaffolded 2026-04-29)

## Journeys Included

1. **Journey 1: Define Employment Basis** (admin role)
   - Precondition: workspace configured with tariff + regulatory framework
   - Admin creates `employment_contract` + `contract_pay_rule` + `contract_tip_rule`
   - Error paths: prøvetid validation, date ordering, PII field masking
   - Postcondition: contract in `draft` status, ready for sending

2. **Journey 2: Send Contract via 2-Step Drawer** (admin role)
   - Precondition: contract in `draft` status
   - Admin opens `ContractDispatchDrawer`, selects mal, previews PDF
   - Validates AcknowledgementRing (4/4 gates: recipient, mal, PDF viewed, docs reviewed)
   - Error paths: incomplete rings, compliance blocker (wage < tariff)
   - Postcondition: contract `sent_pending_signature`, webhook awaits

3. **Journey 3: Employee Receives and Signs** (employee role)
   - Precondition: contract `sent_pending_signature`
   - DocuSeal webhook triggers → status `active`, employee receives notification
   - Employee navigates `/dashboard/my-contract`, views details, can reveal PII
   - Error path: employee without contract sees empty-state
   - Postcondition: contract `active`, obligations generated, ready for enforcement

4. **Journey 4: Daily Enforcement** (employee role)
   - Precondition: active contract with potential overdue obligations
   - Employee attempts clock-in, `ObligationBlocker` checks obligations
   - Employee can query salary breakdown with Riksavtalen citation
   - Error path: overdue obligation blocks clock-in until resolved
   - Postcondition: clock-in allowed or obligation completion tracked

5. **Journey 5: Amendment Flow** (admin + employee roles)
   - Precondition: active contract, admin initiates amendment
   - Admin changes terms (hourly_rate, job_title, weekly_hours, etc.)
   - System classifies change: MATERIAL, ADMIN_ONLY, or constructive dismissal risk
   - If material: flag for employee re-signature via DocuSeal
   - Error paths: constructive dismissal detection (AML §15-7), admin-only changes
   - Postcondition: amendment status `accepted` / `rejected` / expired

## Status Summary

- **Database:** Phase 0a schema complete, 33 migrations, pgTAP tests passing
- **Capabilities:** `contract` + `payroll` capabilities updated with 7 new telemetry events
- **Backend:** 5 API endpoints (amend, classify, accept, decline, clock-in-check)
- **Frontend:** UI scaffolds (ContractDispatchDrawer, AmendmentSection, ObligationBlocker, ContractAmendmentDiff)
- **E2E Tests:** 5 spec files scaffolded in `apps/e2e/contract-employee/` (390 lines total), all compile, use `test.skip` pending seed helper + data-testid attributes
- **Mobile:** `ObligationBlocker` sheet variant exists; `MyContract` screen deferred (ADR-0133)
- **Trust Gate:** PASS for ADR-0151 (forgery defence), NonEmptyString brand, channel guards, RLS denorm

## Deferred Items

- Live Playwright execution (pending seed helper, data-testids, DocuSeal stub)
- Mobile `MyContract.tsx` (documented gap per ADR-0133)
- Phase 0c `legal` capability (Lovsen branding, AML compliance)
- `tariff-amendment-sweep` cron activation
- 6 ESKALÉR-flagg for arbeidsrettsadvokat review before production go-live

---

**Wave 6 completion:** E2E scaffolds + final verification. Feature ready for merge to `campaign/services` and eventual integration to `development`.
