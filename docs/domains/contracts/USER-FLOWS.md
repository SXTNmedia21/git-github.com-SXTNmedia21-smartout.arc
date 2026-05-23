---
title: "Contracts — User Flows"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: contracts
mirror: verified
last_verified: 2026-05-23
tags: [contracts, journeys, user-flows, handoffs]
---

# Contracts — User Flows

## Journey index

| Journey | File | Scope | Status |
|---|---|---|---|
| Contract employee (full) | `docs/journeys/JOURNEY-contract-employee.md` | Admin creates + sends employment contract | ✅ |
| Contract enhancements | `docs/journeys/JOURNEY-contract-enhancements.md` | Placeholder resolve + attachments + DocuSeal delivery | ✅ |
| Contract module | `docs/journeys/JOURNEY-contract-module.md` | Platform contract (client-side) define → send → sign | ✅ |
| Contract preview editor | `docs/journeys/JOURNEY-contract-preview-editor.md` | Admin edits resolved HTML before send | ✅ |
| Contract composition engine | `docs/journeys/JOURNEY-contract-composition-engine.md` | Composition 7-phase cascade derivation | ✅ |
| Contract binding auto-seed | `docs/journeys/JOURNEY-contract-binding-auto-seed.md` | Template binding auto-assigned on workspace create | ✅ |
| Contract signed → active cascade | `docs/journeys/JOURNEY-contract-signed-active-cascade.md` | Signed webhook → status update → cascade sync | ✅ |
| Contract system phase 2–3 | `docs/journeys/JOURNEY-contract-system-phase2-3.md` | Amendment + obligation enforcement | ✅ |
| Client contract | `docs/journeys/JOURNEY-client-contract.md` | Platform contract signing flow | ✅ |
| Contract hub fix-forward | `docs/journeys/JOURNEY-contract-hub-fix-forward.md` | Hub redesign post-compliance debt | ✅ |
| Contract bulk send | `docs/journeys/JOURNEY-contract-bulk-send.md` | Multi-employee batch send | ✅ |
| Contract employee (mobile) | `docs/journeys/JOURNEY-contract-employee-mobile.md` | Employee signs on mobile (ADR-0245) | 🟡 partial |
| GDPR: admin anonymizes expired contract | `docs/journeys/JOURNEY-sma-308-gdpr-retention-admin-anonymizes-expired-contract.md` | GDPR Art. 17 erasure RPC | ✅ |
| GDPR: declined contract clock | `docs/journeys/JOURNEY-sma-308-gdpr-retention-declined-contract-gdpr-clock.md` | Declined = GDPR clock starts | ✅ |
| Billing gate contract signed | `docs/journeys/JOURNEY-billing-gate-contract-signed.md` | ADR-0384 signed → billable workspace | ✅ |
| Lovsen foundation contract package | `docs/journeys/JOURNEY-lovsen-foundation-contract-package-builds.md` | `packages/lovsen-contract` build + CI | ✅ |
| UI shell: contracts polish (revise) | `docs/journeys/JOURNEY-ui-shell-contracts-polish-revise.md` | UI polish revise flow | ✅ |
| UI shell: contracts polish (awaiting signature) | `docs/journeys/JOURNEY-ui-shell-contracts-polish-awaiting-signature.md` | UI polish awaiting-my-signature | ✅ |
| UI shell: contracts polish (detail) | `docs/journeys/JOURNEY-ui-shell-contracts-polish-detail.md` | UI polish detail page | ✅ |
| Compliance debt (court-order consent) | `docs/journeys/JOURNEY-contracts-compliance-debt-cleanup-admin-creates-court-order-consent.md` | Admin records court-order deduction consent | ✅ |
| Onboarding step: contract | `apps/e2e/tests/journey-onboarding-step-contract.spec.ts` | Onboarding wizard contract step | ✅ |

**Total: 21 journeys documented.**

## Completed flows — HANDOFF evidence

These handoffs document completed sorties. They confirm the flow exists in code:

| Handoff | Feature proven |
|---|---|
| `docs/HANDOFF-contract-composition-engine.md` | Composition 7-phase + cascade derivation (ADR-0076) |
| `docs/HANDOFF-employee-contract.md` | Employment contract CRUD + send + sign |
| `docs/HANDOFF-contract-employee.md` | Employee-side contract view + sign |
| `docs/HANDOFF-contract-0a-pre-frontend.md` | Foundation tables + RLS |
| `docs/HANDOFF-contract-preview-editor.md` | Preview editor (Tiptap) before send |
| `docs/HANDOFF-contract-dispatch-ux-pass.md` | UX send flow polish |
| `docs/HANDOFF-contract-intake-gate-fix.md` | Engine-state filter for intake |
| `docs/HANDOFF-a1-contract-intake-gate-restore.md` | Intake gate restore after regression |
| `docs/HANDOFF-contract-signed-active-cascade.md` | Signed webhook → cascade sync |
| `docs/HANDOFF-contract-binding-auto-seed.md` | Template binding auto-seed |
| `docs/HANDOFF-contracts-polish.md` | UI polish cluster |
| `docs/HANDOFF-contracts-compliance-cluster.md` | Compliance debt cluster (GDPR, court-order) |
| `docs/HANDOFF-contracts-compliance-debt-cleanup.md` | Compliance debt cleanup |
| `docs/handoffs/HANDOFF-employee-contract-management.md` | Employee contract management hub |

**14 handoffs = 14 completed sorties.**

## Core flows (summary)

### Admin creates employment contract (happy path)

**Precondition:** Profile exists (`profile.status = 'active'`), workspace has template binding.

1. Admin opens `/dashboard/people/contracts/new` → drawer opens.
2. Composition engine (`services/contract-service/src/lib/placeholders.ts`) pulls workspace defaults + role baseline + tariff from K1a → derives draft fields.
3. Admin reviews pre-filled form, adjusts as needed.
4. Admin clicks "Send til signering" → `create_employee_contract` tool (gatedMutation) creates `employment_contract` row with `status='proposed'`.
5. `send_employee_contract` tool creates DocuSeal submission → `docuseal_submission_id` stored.
6. Employee receives email with DocuSeal signing link.
7. Employee signs → DocuSeal fires webhook → `services/contract-service/src/routes/webhooks.ts` processes.
8. `employment_contract.status = 'active'`, `signed_at` stamped.
9. `cascade_contract_payroll_sync` trigger propagates fields → `employee_payroll_profile`.
10. Billing gate (ADR-0384) reads `signed_at`; workspace becomes billable.

**Error paths:** DocuSeal webhook fails → retry via `sync.ts`. Employee declines → `status='declined'`, GDPR clock starts.

### Employee signs on mobile (partial — ADR-0245)

Mobile receives push notification → opens deep link → WebView renders DocuSeal embedded signer → signs → webhook fires. Biometric C4 confirmation planned. UI partial as of 2026-05-23.

### Contract amendment

Admin proposes amendment → `contract_amendment` row created → `employment_contract_detail` version row created → if `requires_employee_signature = true`: new DocuSeal submission → employee re-signs. If minor change: admin acknowledges only.
