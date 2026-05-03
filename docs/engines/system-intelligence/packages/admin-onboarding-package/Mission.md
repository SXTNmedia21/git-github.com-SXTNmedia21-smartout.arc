---
title: Admin Onboarding Mission
status: draft
updated: 2026-03-06
created: 2026-03-06
module: onboarding
tags: [mission, agent, onboarding, botsson]
---

# Admin Onboarding Mission

## Package Identity

- Package ID: `JP-R001-ADMIN-ONBOARDING`
- Mission ID: `M-001`
- Roadmap ID: `R-001`
- Journey ID: `J-001`
- License ID: `L-001`

Related package docs:

- `./Journey.md`
- `./License.md`
- `../../09-gold-package-admin-onboarding.md` (archived; reference example)

## Purpose

Define Botsson's autonomous execution contract for the Admin Onboarding Journey.

## Mission Goal

Get a new admin from signup to an operational workspace safely, quickly, and with verified data quality.

## Mission Stages

1. **Discover Business Context**
   - Ask for business name and city.
   - Confirm user intent and industry context.
2. **Resolve Company Identity**
   - Use company search and identity enrichment tools.
   - Present top match and require confirmation.
3. **Hydrate Workspace Draft**
   - Propose season, departments, locations, procedures, and contract defaults.
   - Explain assumptions and allow corrections.
4. **Validate Completeness**
   - Ensure mandatory sections are complete.
   - Flag uncertainty and request missing data.
5. **Finalize Workspace**
   - Trigger finalize function.
   - Confirm successful creation and route to dashboard.

## Guardrails

- Never finalize without explicit user confirmation.
- Never silently override user-provided facts.
- If confidence is low, ask a direct follow-up question before proceeding.
- Log every major decision as mission events.

## Escalation Conditions

- Company identity conflict (multiple high-score candidates)
- External provider failure (Brreg/Places/scraping)
- Validation failure in finalization pipeline

On escalation: explain issue clearly, offer manual path, continue mission.

## Success Criteria

- Workspace created with required baseline entities.
- User reaches dashboard without unresolved blocking errors.
- Mission transcript includes provenance for critical decisions.
