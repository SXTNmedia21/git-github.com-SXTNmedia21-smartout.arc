---
title: "Payroll — User Flows"
status: in_progress
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: payroll
tags: [domain, payroll, user-flows, journeys]
---

# Payroll — User Flows

> Flow index. **Links** to journeys in `docs/journeys/` (owned by journey-protocol) — does NOT duplicate them.

## Flow index

### Phase 1 — Calculation + Period Management

| # | Flow | Role | Shipped? | Journey |
|---|---|---|---|---|
| P1-1 | Manager closes (locks) a payroll period | manager | ✅ | [JOURNEY-payroll-phase-1-manager-closes-period.md](../../journeys/JOURNEY-payroll-phase-1-manager-closes-period.md) |
| P1-2 | Manager drills into an employee's profile during period review | manager | ✅ | [JOURNEY-payroll-phase-1-manager-drills-profile.md](../../journeys/JOURNEY-payroll-phase-1-manager-drills-profile.md) |
| P1-3 | Admin adjusts a time-bank balance | admin | ✅ | [JOURNEY-payroll-phase-1-admin-adjusts-time-bank.md](../../journeys/JOURNEY-payroll-phase-1-admin-adjusts-time-bank.md) |
| P1-4 | Admin configures workspace payroll policy | admin | ✅ | [JOURNEY-payroll-phase-1-admin-configures-workspace-policy.md](../../journeys/JOURNEY-payroll-phase-1-admin-configures-workspace-policy.md) |
| P1-5 | Admin sets overtime mode | admin | ✅ | [JOURNEY-payroll-phase-1-admin-sets-overtime-mode.md](../../journeys/JOURNEY-payroll-phase-1-admin-sets-overtime-mode.md) |

### Phase 2 — Manual Supplements + Line Override

| # | Flow | Role | Shipped? | Journey |
|---|---|---|---|---|
| P2-1 | Manager adds manual supplement via form | manager | ✅ | [JOURNEY-payroll-phase-2-manager-adds-manual-supplement-via-form.md](../../journeys/JOURNEY-payroll-phase-2-manager-adds-manual-supplement-via-form.md) |
| P2-2 | Manager deletes a manual supplement | manager | ✅ | [JOURNEY-payroll-phase-2-manager-deletes-manual-supplement.md](../../journeys/JOURNEY-payroll-phase-2-manager-deletes-manual-supplement.md) |
| P2-3 | Manager proposes a line override (C4 flow) | manager | ✅ | [JOURNEY-payroll-phase-2-manager-proposes-line-override.md](../../journeys/JOURNEY-payroll-phase-2-manager-proposes-line-override.md) |
| P2-4 | Admin approves a line override proposal | admin | ✅ | [JOURNEY-payroll-phase-2-admin-approves-line-override.md](../../journeys/JOURNEY-payroll-phase-2-admin-approves-line-override.md) |
| P2-5 | Tip distribution merges into payroll | system | ✅ | [JOURNEY-payroll-phase-2-tip-distribution-merges-into-payroll.md](../../journeys/JOURNEY-payroll-phase-2-tip-distribution-merges-into-payroll.md) |

### Phase 3 — CSV Export

| # | Flow | Role | Shipped? | Journey |
|---|---|---|---|---|
| P3-1 | Admin exports aggregate CSV | admin | ✅ | [JOURNEY-payroll-phase-3-admin-exports-aggregate-csv.md](../../journeys/JOURNEY-payroll-phase-3-admin-exports-aggregate-csv.md) |
| P3-2 | Admin exports audit CSV with provenance | admin | ✅ | [JOURNEY-payroll-phase-3-admin-exports-audit-csv-with-provenance.md](../../journeys/JOURNEY-payroll-phase-3-admin-exports-audit-csv-with-provenance.md) |
| P3-3 | Admin exports unmasked CSV (with audit emit) | admin | ✅ | [JOURNEY-payroll-phase-3-admin-exports-unmasked-with-audit-emit.md](../../journeys/JOURNEY-payroll-phase-3-admin-exports-unmasked-with-audit-emit.md) |
| P3-4 | System enforces locked-period-only export | system | ✅ | [JOURNEY-payroll-phase-3-export-locked-period-only.md](../../journeys/JOURNEY-payroll-phase-3-export-locked-period-only.md) |

### Phase 4 — PDF Lønnsgrunnlag

| # | Flow | Role | Shipped? | Journey |
|---|---|---|---|---|
| P4-1 | Admin generates PDF bundle (all employees) | admin | ✅ | [JOURNEY-payroll-phase-4-admin-generates-pdf-bundle.md](../../journeys/JOURNEY-payroll-phase-4-admin-generates-pdf-bundle.md) |
| P4-2 | Admin generates single employee PDF | admin | ✅ | [JOURNEY-payroll-phase-4-admin-generates-single-employee-pdf.md](../../journeys/JOURNEY-payroll-phase-4-admin-generates-single-employee-pdf.md) |
| P4-3 | Employee views own lønnsgrunnlag (mobile) | employee | ✅ | [JOURNEY-payroll-phase-4-employee-views-own-lonnsgrunnlag-mobile.md](../../journeys/JOURNEY-payroll-phase-4-employee-views-own-lonnsgrunnlag-mobile.md) |
| P4-4 | System validates PDF content matches CSV | system | ✅ | [JOURNEY-payroll-phase-4-pdf-content-matches-csv.md](../../journeys/JOURNEY-payroll-phase-4-pdf-content-matches-csv.md) |
| P4-5 | System rejects expired signed URL | system | ✅ | [JOURNEY-payroll-phase-4-signed-url-expiry-rejects.md](../../journeys/JOURNEY-payroll-phase-4-signed-url-expiry-rejects.md) |

### Phase 5 — PII Reveal

| # | Flow | Role | Shipped? | Journey |
|---|---|---|---|---|
| P5-1 | Admin enters tax card manually | admin | ✅ | [JOURNEY-payroll-phase-5-admin-enters-tax-card-manually.md](../../journeys/JOURNEY-payroll-phase-5-admin-enters-tax-card-manually.md) |
| P5-2 | Admin reveals bank account | admin | ✅ | [JOURNEY-payroll-phase-5-admin-reveals-bank-account.md](../../journeys/JOURNEY-payroll-phase-5-admin-reveals-bank-account.md) |
| P5-3 | Admin reveals personal number | admin | ✅ | [JOURNEY-payroll-phase-5-admin-reveals-personal-number.md](../../journeys/JOURNEY-payroll-phase-5-admin-reveals-personal-number.md) |
| P5-4 | System rejects cross-workspace reveal | system | ✅ | [JOURNEY-payroll-phase-5-cross-workspace-reveal-rejected.md](../../journeys/JOURNEY-payroll-phase-5-cross-workspace-reveal-rejected.md) |
| P5-5 | Employee self-reveals own PII | employee | ✅ | [JOURNEY-payroll-phase-5-employee-self-reveals-own-pii.md](../../journeys/JOURNEY-payroll-phase-5-employee-self-reveals-own-pii.md) |

### Phase 7 — Tariff Tools (7f)

| # | Flow | Role | Shipped? | Journey |
|---|---|---|---|---|
| T1 | Admin configures tariff admin page | admin | ✅ | [JOURNEY-payroll-admin-tariff-page.md](../../journeys/JOURNEY-payroll-admin-tariff-page.md) |
| T2 | System sets up workspace tariff (onboarding) | system | ✅ | [JOURNEY-payroll-onboarding-tariff-step.md](../../journeys/JOURNEY-payroll-onboarding-tariff-step.md) |
| T3 | Tariff BFF mobile read | manager | ✅ | [JOURNEY-payroll-tariff-bff.md](../../journeys/JOURNEY-payroll-tariff-bff.md) |
| T4 | Mobile tariff read | employee | ✅ | [JOURNEY-payroll-mobile-tariff-read.md](../../journeys/JOURNEY-payroll-mobile-tariff-read.md) |
| T5 | Tariff capability tools | admin | ✅ | [JOURNEY-payroll-tariff-capability-tools.md](../../journeys/JOURNEY-payroll-tariff-capability-tools.md) |
| T6 | Tariff 7g reconcile | admin | ✅ | [JOURNEY-payroll-tariff-7g-reconcile.md](../../journeys/JOURNEY-payroll-tariff-7g-reconcile.md) |
| T7 | Tariff 7h followup | admin | ✅ | [JOURNEY-payroll-tariff-7h-followup.md](../../journeys/JOURNEY-payroll-tariff-7h-followup.md) |

### Cross-cutting

| # | Flow | Role | Shipped? | Journey |
|---|---|---|---|---|
| X1 | Foundation setup (capability wiring) | system | ✅ | [JOURNEY-payroll-foundation.md](../../journeys/JOURNEY-payroll-foundation.md) |
| X2 | Payroll amendment classifier | system | ✅ | [JOURNEY-payroll-amendment-classifier.md](../../journeys/JOURNEY-payroll-amendment-classifier.md) |
| X3 | MVP blockers: custom rate payroll | admin | ✅ | [JOURNEY-mvp-blockers-custom-rate-payroll.md](../../journeys/JOURNEY-mvp-blockers-custom-rate-payroll.md) |
| X4 | Lovsen phase 7d ADR amendments | system | ✅ | [JOURNEY-payroll-lovsen-phase-7d-adr-amendments.md](../../journeys/JOURNEY-payroll-lovsen-phase-7d-adr-amendments.md) |
| X5 | Stage engine Dockerfile + payroll export | system | ✅ | [JOURNEY-stage-engine-dockerfile-payroll-export.md](../../journeys/JOURNEY-stage-engine-dockerfile-payroll-export.md) |

### Manual test cases

| Doc | Phase |
|---|---|
| [MANUAL-TEST-payroll-phase-1.md](../../journeys/MANUAL-TEST-payroll-phase-1.md) | Phase 1 visual/UX checks |

## Cross-surface notes

**Web composes, mobile reads** (ADR-0133 — Mobile Surface Boundary):
- **Web owns:** Period creation, period lock, deviation acknowledgement, manual supplement authoring, line override proposal + approval, CSV export, PDF generation, tariff admin, PII reveal, workspace policy settings.
- **Mobile owns:** Read-only payslip list, lønnsgrunnlag PDF view, time-bank balance display, supplement badge display on shifts, absence ledger view.
- **Never on mobile:** Period lock UI, supplement authoring, line override, PII reveal forms, tariff binding setup/change. These are web-only per ADR-0133.

**Authority decision points:**
- `lock_period` → `engine_authority_config` gate, `min_role=admin`, channel=`chat` only.
- `override_calculation_line` → C4 change proposal flow — `propose_line_override` (manager) → `approve_proposal` (admin). C4 gate enforced server-side.
- `view_personal_number` / `view_bank_account` → Høy PII, `min_role=admin`, `allowedChannels=['chat']` only (ADR-0242).
- `setup_workspace_tariff` / `change_workspace_tariff` → delegated to cascade capability (ADR-0356); payroll gate + cascade gate both fire.
