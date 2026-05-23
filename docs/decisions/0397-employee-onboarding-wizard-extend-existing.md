---
title: "ADR-0397: Employee onboarding wizard — extend existing WelcomeWizard (Strategy A)"
status: accepted
date: 2026-05-23
deciders: pontus + council 2026-05-23
tags: [adr, wizard, onboarding, mobile, web]
---

# ADR-0397: Employee onboarding wizard — extend existing WelcomeWizard (Strategy A)

## Context

A 6-step web WelcomeWizard already exists at
`apps/web/src/components/welcome-wizard/`, with 6 Server Actions + a
gate stub (`WelcomeWizardGate.tsx:20-22`) that returns `null`. The
brainstorm produced a spec that ignored the existing implementation and
proposed a parallel surface.

Council R1 (2026-05-23) rejected the spec. Strategy choice between:
- A. Extend existing wizard in place.
- B. Replace with new implementation.
- C. Ship parallel surface, hot-swap later.

## Decision

**Strategy A: extend in place.**

- TOTAL_STEPS: 6 → 8. New AvailabilityStep (5) and ConsentStep (6)
  inserted between PersonalNumber and Optional.
- Wire the gate stub to return `<WelcomeWizard userEmail={userEmail} />`.
- Add a mobile twin (RN shell + 8 RN step components) that uses the
  same Zod + the same Server Actions via a thin BFF wrapper.
- Reuse the existing `profile welcome_wizard_*` telemetry namespace
  (preserves `engine_event` destination).
- All new identity fields land on `user_identity` (per ADR-0396).
- `@smartout/ui/wizard/state` deep-import discipline for mobile (ESLint
  rule blocks the barrel).

## Why not B (replace)

- Throws away 6 working Server Actions + a tested wizard.
- Risk of silent engine_event consumer break on
  `profile welcome_wizard_completed`.
- Migration story for any in-flight invites mid-onboarding.

## Why not C (parallel)

- Two wizards racing on `is_welcome_complete` is the worst possible
  outcome. Diverging telemetry, diverging audit trails.

## Consequences

- The existing `welcome-wizard/` directory becomes the canonical
  surface for employee onboarding on both web and mobile.
- Mobile `complete-data.tsx` gets a deprecation banner pointing to the
  wizard (single surface of truth per L-0178).
- Future wizard work (any new domain) follows the same shape: extend
  existing wizard if one exists; replacement requires explicit ADR.

## References

- Spec: `docs/superpowers/specs/2026-05-23-employee-onboarding-wizard-design.md`
- Council log: `docs/council/COUNCIL-LOG.md#2026-05-23`
- ADR-0396 (identity-on-user_identity)
- ADR-0133 (mobile thin client — reframing in spec §D3)
- L-0178 (dual-surface ownership)
