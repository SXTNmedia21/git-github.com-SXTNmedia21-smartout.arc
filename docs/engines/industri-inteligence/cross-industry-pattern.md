---
title: "Cross-Industry Department Pattern — I1 Authoring Guide"
status: draft
created: 2026-05-28
updated: 2026-05-28
module: industri-inteligence
tags: [i1, industry-package, department, archetype, guidance, adr-0429]
---

# Cross-Industry Department Pattern — I1 Authoring Guide

## Context

ADR-0429 establishes a **three-department + optional-fourth archetype** as the canonical default for new Smartout workspaces in hospitality. This document captures the pattern for future I1 industry packages.

## The Archetype

Every shift-based business groups staff along three functional axes:

1. **Front-facing** — roles that interact directly with customers/clients/patients/end-users
2. **Back-facing** — roles that enable front-facing (production, processing, infrastructure, logistics)
3. **Admin** — roles that coordinate, analyze, and manage operations

This pattern is **universal.** Each industry gives these axes its own names and default position types.

### Why it scales

Staff grouping by **task similarity + profession + regulation** is invariant across industries. Front-facing staff face the same guest-safety and service-flow regulations; back-facing staff face the same production/cleanliness/inventory regulations; admin faces the same compliance and financial regulations.

A **fourth optional department** handles industry-specific complexity — Bar in hospitality, Kasse in retail, Renhold in healthcare. It is NOT a rule; workspace admins decide in onboarding.

## Cross-Industry Defaults Table

| Industry | Front-facing dept | Back-facing dept | Admin dept | Optional 4th | Notes |
|---|---|---|---|---|---|
| **Hospitality** | FoH | BoH | Admin | Bar / Events | Guest service / Food production / Operations / Specialized bar or event staffing |
| **Retail** | Salg | Lager | Admin | Kasse / Innkjøp | Floor staff / Warehouse + Receiving / Operations / Checkout or Procurement |
| **Healthcare** | Pasientkontakt | Laboratorium | Admin | Renhold | Patient care / Lab + Testing / Operations / Cleaning + Sterilization |
| **Office** | Kundeservice | Produksjon | Admin | Salg | Customer support / Development or Manufacturing / Operations / Sales team |
| **Construction** | Felt | Verksted | Admin | Prosjekt | Site crew / Workshop + Equipment / Operations / Project management |

## Implementation Guidance

### For each new I1 package

1. **Write an ADR** documenting your industry's canonical defaults using this archetype. Example: ADR-0500 would document retail defaults — Salg / Lager / Admin.
2. **Update `packages/ai/src/industry/packages/<industry>.ts`** to seed the three default departments and granular position types under each.
3. **Surface in onboarding** (`apps/web/src/app/onboarding/OrgSetupStep.tsx`):
   - Render three default department cards with Norwegian names
   - Include the avdeling-tooltip: "En avdeling er en gruppe ansatte med lignende oppgaver, fag, og regler"
   - Offer rename inputs for each default
   - Add conditional checkboxes for any optional fourth (e.g. "Har dere en dedikert bar-avdeling?")
4. **Update position seeds** — each department gets a list of default positions (profession names) for admin awareness.
5. **Document in the industry package's module doc** — reference the ADR and explain position-assignment patterns.

### Workspace autonomy

The archetype is **recommendation-only.** Workspace admins can:
- Rename any default department
- Delete unused departments
- Add additional departments beyond the four
- Define their own positions

Smartout imposes no rigid enforcement. The defaults reduce cognitive load for new admins and ensure industry-aligned structure out of the box.

### Terminology consistency

Every industry package uses the same **canonical glossar** for database concepts and UI strings:

- `department` → avdeling
- `position` → stilling
- `profile.role` → tilgangsnivå
- `location` → område
- `zone` → sone
- `team` → lag
- `schedule_shift` → vakt

Avoid translating department **names** — use industry-canonical English abbreviations (FoH, BoH, Salg, Lager, Pasientkontakt, etc.) paired with clear Norwegian tooltips in onboarding.

## Related ADRs

- **ADR-0429** — Department Vocabulary, FoH/BoH/Admin defaults + terminology glossar for hospitality
- **ADR-0367** — Day Line Area-Anchored Runtime (cascade model that this archetype feeds)
- **ADR-0387** — Role-Mandatory Compliance (governance framework that uses department structure)
