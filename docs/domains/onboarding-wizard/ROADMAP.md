---
title: "Onboarding Wizard — Roadmap"
status: draft
mirror: aspirational
updated: 2026-05-23
created: 2026-05-23
domain: onboarding-wizard
tags: [domain, onboarding-wizard, roadmap, blueprint]
---

# Onboarding Wizard — Roadmap

> Forward plan + design intent for successor sorties. **Aspirational** — ahead of code. What ships moves to ARCHITECTURE/DATA-MODEL and out of GAPS.

## Phases

| Phase | Goal | Falsifiable acceptance | Est. |
|---|---|---|---|
| A (current — DONE) | Wire existing gate; insert Availability + Consent steps; mobile twin; `consent_acceptance` + `employee_onboarding_state` tables | `profile.is_welcome_complete=true` set via 8-step wizard on web + mobile; `pnpm check:domains` passes | shipped 2026-05-23 |
| B | Address-on-profile cleanup | `saveAddress` writes `address_*` to `user_identity`, not `profile`. Migration removes columns from `profile` after backfill. `pnpm turbo typecheck` green. | 1–2 days |
| C | Server-side mod-11 checksum validation for `personal_number` | `submit_own_pii('identity', …)` rejects invalid checksums with typed Zod error. Unit test: 5 valid + 5 invalid examples. | ½ day |
| D | Versioned consent document catalog | `consent_acceptance.document_version` references a `consent_document` table (type, version, content_url). V1 hardcoded strings replaced by FK. Admin UI to publish new versions. | 3–5 days |
| E | Maestro mobile E2E coverage | `apps/e2e/maestro/onboarding-wizard.yaml` covers 8-step happy path + dismiss-resume. CI gate added. | 1–2 days |
| F | `next()` validation error surface improvement | WizardShell currently drops Zod validation errors silently (T20 concern). Surface step-level validation failures inline at the failing field. | 1 day |

## Governing ADRs

- **Accepted:** [ADR-0396](../../decisions/0396-identity-columns-on-user-identity.md) (identity columns belong on `user_identity`, not `profile`), [ADR-0397](../../decisions/0397-strategy-a-extend-existing-welcome-wizard.md) (Strategy A — extend in place), [ADR-0151](../../decisions/0151-workspace-id-server-derived.md) (workspace_id server-derived)
- **Referenced:** [ADR-0133](../../decisions/0133-mobile-surface-boundary.md) (mobile surface boundary), [ADR-0163](../../decisions/0163-channel-guard.md) (channel guard), [ADR-0311](../../decisions/0311-payroll-trekk-samtykke.md) (payroll consent — separate concern)

## Planned journeys

- [JOURNEY-employee-onboarding-wizard.md](../../journeys/JOURNEY-employee-onboarding-wizard.md) — all 3 flows drafted (Phase A ✅)

## Boundary watch

| Domain | Shared surface | Recommendation |
|---|---|---|
| identity | `user_identity` — wizard writes contact + emergency columns | keep (wizard is a writer; identity domain owns DDL) |
| scheduling / D2 | `employee_availability` — wizard inserts RRULE rows | keep (clear provenance discriminator `reason='onboarding-wizard'`) |
| payroll | `consent_acceptance` vs `payroll.consent_document` (ADR-0311) | keep distinct — different consent types, different audiences, different immutability contracts |
| contracts | DocuSeal signing flow | not related — wizard consent is handbook/GDPR/tariff acknowledgement, not contract signing |
