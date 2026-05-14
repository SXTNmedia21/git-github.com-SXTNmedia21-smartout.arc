---
title: "§14-6 17-Bokstav Rule-Table-Driven AML Validation"
id: ADR_0310
status: proposed
layer: decision
created: 2026-05-14
updated: 2026-05-14
module: contracts
tags: [contracts, legal, aml-14-6, framework_rule, sma-306, compliance]
---

# ADR-0310 — §14-6 17-Bokstav Rule-Table-Driven AML Validation

## Context

`validate_aml_14_6` (tool in the `legal` capability, `packages/ai/src/capabilities/legal/tools.ts`)
was a Phase 0c stub returning `pass=true` unconditionally. The stub enabled the gates to be wired
before real Lovdata integration landed. SMA-306 requires the stub to be replaced with a real
rule-driven validator.

The post-July 2024 revision of Arbeidsmiljøloven §14-6 introduced bokstav m (vaktendringer §10-3
+ overtid-ordninger) and consolidated the mandatory minimum content to 17 bokstaver (a–q).

## Decision

Replace the stub with a rule-driven validator that:

1. Reads `framework_rule` rows from the platform-level `hospitality.no.default.v1` framework
   (K1a — code `hospitality.no.default.v1`, workspace-shared), filtered by `code LIKE 'aml.14_6.%'`.
2. Seeds 17 rows (bokstav a–q) via migration `20260615200000_aml_14_6_framework_rules.sql`.
3. Evaluates each rule per `evaluation_config.required` + `evaluation_config.required_when` JSONB.
4. Returns `pass=false` with `bokstaver_failed: string[]` when required fields are missing.
5. Emits `legal.aml_14_6.validated` with `validator_version: 'aml-14-6-2024-07-rule-driven-v1'`,
   `bokstaver_failed[]`, and `rule_count` fields (Q-H3 — non-breaking shape extension).

**No new table.** Reuses K1a `framework_rule` infrastructure per ADR-0181 K1a→K1b read-through.

**Bokstav mapping (post-2024):**

| Bokstav | Field | Required |
|---------|-------|---------|
| a | workspace_id / identity | true |
| b | location_id | true |
| c | position_title | true |
| d | start_date | true |
| e | end_date | required_when: employment_form='temporary' |
| f | trial_period_months | required_when: trial_period_active=true |
| g | holiday_allowance_pct | true |
| h | notice_period_months | true |
| i | monthly_salary OR hourly_rate | true |
| j | agreed_weekly_hours | true |
| k | break_rule_id | true |
| l | working_hours_scheme | required_when: has_special_scheme=true |
| m | schedule_change_terms | required_when: industry=hospitality, schedule_type=rotation |
| n | tariff_framework | required_when: has_tariff=true |
| o | hire_in_workspace_id | required_when: employment_form=temp_agency |
| p | competency_dev_terms | false (valgfri per lovtekst) |
| q | otp_terms | true (OTP obligatorisk) |

**Bokstav m** (vaktendringer §10-3) — new post-2024, Pontus Phase 6 approved auto-required for
hospitality+rotation workspaces. Platform conservative default.

**Bokstav p** (kompetanseutvikling) — optional per lovtekst (Lovsen Phase 3 verdict).

## Rationale

- No hardcoded paragraphs in TypeScript — rule set is database-driven and updatable without code deploy.
- Workspace-specific overrides via `framework_id` match reserved for future scope (SMA-309 deferred).
- K1a platform-level rules apply to ALL employers — no workspace binding required for base validation.
- `required_when` JSONB makes context-sensitive rules explicit and auditable.
- `validator_version` field enables consumers to gate on rule-driven vs stub results (Q-H3).

## Consequences

- Validator requires local Supabase running with `20260615200000` migration applied.
- `required_when` for `has_special_scheme`, `has_tariff`, `industry`, `schedule_type` are
  conservative approximations — full evaluation requires workspace context columns not yet in schema.
- Unit tests must mock 17 `framework_rule` rows; integration tests require migrations applied.
- Shape change to `legal.aml_14_6.validated` is non-breaking (adds fields, keeps existing ones).

## References

- ADR-0244: Aml. §14-5 bevisbyrde — strict/advisory contract
- ADR-0181: K1a→K1b inheritance
- L-0176: write body first, docstring after invariant
- L-0177: fail-fast on row.workspace_id mismatch
- SMA-306, SMA-309 (deferred workspace_framework_binding auto-seed)
