---
title: "Plan — sma-328-aml-14-15-trekk-consent"
feature: sma-328-aml-14-15-trekk-consent
spec: ../superpowers/specs/2026-05-12-aml-14-15-trekk-consent.md
status: draft
updated: 2026-05-12
created: 2026-05-12
module: payroll
tags: [plan, payroll, compliance, lovsen]
---

# Plan — sma-328-aml-14-15-trekk-consent

> Branch: `feat/sma-328-aml-14-15-trekk-consent` | Worktree: `/home/sxtnl/dev/smartout.ai-wt-1` | Module: payroll

**Spec:** [Aml. §14-15 1.ledd — trekk-flow consent](../superpowers/specs/2026-05-12-aml-14-15-trekk-consent.md)

## Journeys (the contract)

- [JOURNEY-sma-328-aml-14-15-trekk-consent-manager-applies-trekk-with-consent](../journeys/JOURNEY-sma-328-aml-14-15-trekk-consent-manager-applies-trekk-with-consent.md) — Manager registers deduction with signed consent reference (happy path)
- [JOURNEY-sma-328-aml-14-15-trekk-consent-manager-applies-trekk-without-consent-rejected](../journeys/JOURNEY-sma-328-aml-14-15-trekk-consent-manager-applies-trekk-without-consent-rejected.md) — BFF rejects 422 with §14-15 reference when consent missing
- [JOURNEY-sma-328-aml-14-15-trekk-consent-lovsen-validates-paragraph-binding](../journeys/JOURNEY-sma-328-aml-14-15-trekk-consent-lovsen-validates-paragraph-binding.md) — Lovsen amendment-classifier validates paragraph binding on submit

## Goal

Block trekk-overrides without a signed consent document so Smartout cannot ship Aml. §14-15 violations through manager-initiated line overrides.

## Tasks

- [ ] **T1 — Schema recon** verify `payroll_line_override` table exists OR find override storage path; locate `confirmation_signature` insert flow + `confirmation_type` enum values
- [ ] **T2 — Migration** ALTER `payroll_line_override` ADD COLUMN `consent_signature_id UUID REFERENCES public.confirmation_signature(id)`; index on lookup
- [ ] **T3 — Extend `confirmation_type` enum** add `deduction_consent` value (or seed governance template per ADR-0259)
- [ ] **T4 — Zod schema** extend `Category` enum + `signed_consent_signature_id` required-when-deduction in `apps/web/src/app/api/payroll/propose-line-override/route.ts`
- [ ] **T5 — BFF gate** 422 with `{ code: "AML_14_15_CONSENT_REQUIRED", paragraph: "Aml. §14-15 1.ledd" }` when missing
- [ ] **T6 — UI** `LineOverrideModal.tsx` — add `"deduction"` to Category enum, conditional consent-picker dropdown loaded from employee's `confirmation_signature` rows (filter by `confirmation_type=deduction_consent`)
- [ ] **T7 — Telemetry** `emit('payroll.deduction_consent_referenced', { consent_signature_id, override_id, workspace_id })` on accept
- [ ] **T8 — Lovsen-MCP integration** invoke `amendment-classifier` paragraph-binding check; log to `activity_trail.data.paragraph_ref`
- [ ] **T9 — Vitest** route test: missing consent → 422, valid consent → 200, consent owned by different profile → 403
- [ ] **T10 — Playwright** journey 1 happy path E2E (recommended)
- [ ] **T11 — Types regen** `pnpm --filter @smartout/supabase types`
- [ ] **T12 — ADR draft** `deduction_consent confirmation_type extension` if path 3a chosen
- [ ] **T13 — Handoff** decisions + learnings at `/close-feature`

## Acceptance Criteria

- [ ] Every declared journey has `status: verified` in frontmatter
- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] Decision log updated for any architectural choices
- [ ] At least one E2E test exists per journey (recommended)
- [ ] Vitest 3+ assertions on propose-line-override route (happy/missing/cross-profile)
