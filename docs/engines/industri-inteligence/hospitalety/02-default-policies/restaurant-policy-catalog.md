---
title: Restaurant Policy Catalog
id: ENGINE_RESTAURANT_POLICY_CATALOG
version: "0.1"
status: draft
layer: governance
created: 2026-03-06
updated: 2026-03-06
owner: platform
tags:
  - policy
  - restaurant
  - compliance
  - operations
---

# Restaurant Policy Catalog

## Purpose

Provide a concrete default policy set for the restaurant industry engine package.

## Source of Baseline

This catalog is aligned with existing template implementation assets:

- `supabase/templates/restaurant/policies.sql`
- `supabase/templates/restaurant/governance.sql`
- `supabase/templates/restaurant/mattilsynet.sql`

## A) Safety and Compliance Policies

- Temperaturovervaking og kaldkjede
- Hygiene og renhold
- Allergenhandtering og merking
- Sporbarhet og avvikshandtering
- Brannvern og evakuering

## B) Operational Standard Policies

- Apningsrutiner
- Stengerutiner
- Kassaoppgjor og verdihandtering
- Varemottak og lagring
- Skjenkekontroll og aldersgrense

## C) Workforce and HR Policies

- Arbeidsmiljo og HMS
- Onboarding progression and readiness expectations
- Shift constraints for underage workers

## D) Access and Accountability Policies

- Team-leader signoff requirements
- Required logging for critical routines
- Evidence capture policy for control lists and confirmations

## E) Incident and Exception Policies

- Deviation reporting and response SLA
- Product withdrawal and recall process
- Escalation ownership chain

## Policy-to-Execution Mapping

- Policy -> protocol
- Protocol -> procedure
- Procedure -> routine/control list/knowledge test/confirmation

This mapping is mandatory for all high-risk workflows.

## Minimal Coverage Requirement

No restaurant workspace should be considered fully activated without:

- at least one active policy per mandatory group,
- associated verification mechanism (checklist/test/confirmation),
- and a defined escalation path.
