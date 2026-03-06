---
title: Restaurant Engine Relevance Map
id: ENGINE_RELEVANCE_MAP_RESTAURANT
version: "0.1"
status: draft
layer: mapping
created: 2026-03-06
updated: 2026-03-06
owner: platform
tags:
  - relevance
  - mapping
  - restaurant
---

# Restaurant Engine Relevance Map

## Purpose

Show where each artifact in this package is used and who depends on it.

## Artifact -> Consumer Map

- `00-engine-core.md`  
  Consumers: platform architecture, engine designers, tool bridge implementers.

- `01-ai-council/*`  
  Consumers: UX design, copywriting, A/B and manual testing, onboarding flows.

- `02-default-policies/*`  
  Consumers: governance layer, workflow builders, compliance testing.

- `03-templates/*`  
  Consumers: onboarding setup, journey design, stage-engine mission design.

- `04-research/*`  
  Consumers: product planning, prioritization, KPI model design.

- `05-testing/*`  
  Consumers: QA agents, platform admins, release gating.

- `07-company-handbook/*`
  Consumers: company owners, managers, onboarding leads, quality/compliance leads.

- `08-role-capability-profiles/*`
  Consumers: training owners, onboarding owners, readiness and assignment logic.

- `09-environment-profile/*`
  Consumers: journey designers, QA/test scenario design, operational template tuning.

- `10-niche-profiles/*`
  Consumers: setup personalization, training prioritization, journey/test weighting logic.

## External Source Alignment

- Journey behavior references: `docs/journeys/`
- Persona and workforce references: `docs/research/`
- Event architecture references: `docs/agents/framework/`
- Seed implementation references: `supabase/templates/restaurant/`
- Handbook structure references: `07-company-handbook/README.md`
- Restaurant handbook template: `07-company-handbook/restaurant-company-handbook-template.md`
- Role capability profile structure: `08-role-capability-profiles/README.md`
- Restaurant role capability baseline: `08-role-capability-profiles/restaurant-role-capability-baseline.md`
- Environment profile structure: `09-environment-profile/README.md`
- Restaurant environment baseline: `09-environment-profile/restaurant-environment-baseline.md`
- Niche profile layer: `10-niche-profiles/README.md`
- Niche skeleton: `10-niche-profiles/niche-layer-skeleton.md`
- Restaurant niche taxonomy: `10-niche-profiles/restaurant-niche-taxonomy.md`
- Restaurant niche template: `10-niche-profiles/restaurant-niche-profile-template.md`
- Niche example: `10-niche-profiles/restaurant-niche-italian-premium-service.md`

## Ownership Guidance

- Platform team owns system layer consistency.
- Industry package owner owns concept-layer integrity.
- QA/release owners own test profile execution quality.

## Maturity Markers

This package is "engine-ready" when:

1. all mandatory docs exist,
2. journey templates are mapped to test profiles,
3. policy catalog is linked to verification pathways,
4. company handbook template is linked to engine artifacts,
5. role capability baseline exists for core roles,
6. environment baseline exists for operational context,
7. at least one concrete niche profile exists,
8. and references to implementation assets are complete.
