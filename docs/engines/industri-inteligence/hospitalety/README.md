---
title: Industry Intelligence Engine
id: ENGINE_INDUSTRY_INTELLIGENCE
version: "0.1"
status: draft
layer: architecture
created: 2026-03-06
updated: 2026-03-06
owner: platform
tags:
  - engine
  - industry
  - ai-council
  - templates
  - policies
---

# Industry Intelligence Engine

This folder defines how Smartout should model one industry as a complete engine package.

The goal is to avoid mixing assumptions between industries and keep implementation, testing, and communication aligned to one backbone at a time.

## Folder Map

- `00-engine-core.md`  
  Core architecture contract for an industry engine.
- `01-ai-council/README.md`  
  Seven-persona council standard and how to use it.
- `01-ai-council/restaurant-council.md`  
  Restaurant baseline council used as the first active industry.
- `02-default-policies/README.md`  
  Policy baseline required before journeys and tests.
- `03-templates/README.md`  
  Template taxonomy and composition rules.
- `03-templates/business-structure-template.md`  
  Business structure template contract.
- `03-templates/task-pipeline-template.md`  
  Task and operational pipeline template contract.
- `03-templates/journey-template.md`  
  Journey template contract composed from architecture blocks.
- `04-research/README.md`  
  Research pack standard for this industry package.
- `04-research/restaurant-research-pack.md`  
  Consolidated restaurant research: workflows, summaries, proven knowledge, tactics, success factors, KPIs.
- `02-default-policies/restaurant-policy-catalog.md`  
  Concrete restaurant policy baseline mapped to template assets.
- `03-templates/restaurant-business-structure-template.md`  
  Concrete business structure instance for restaurant onboarding/bootstrap.
- `03-templates/restaurant-task-pipelines-template.md`  
  Concrete operational pipeline set with trigger and verification structure.
- `03-templates/restaurant-journey-template-catalog.md`  
  Journey catalog aligned to existing journey docs and testing requirements.
- `05-testing/README.md`  
  Testing layer for this industry package.
- `05-testing/restaurant-testing-profiles.md`  
  Persona-aware automated/manual/A-B/security test profiles.
- `06-relevance-map/restaurant-relevance-map.md`  
  Map of where each artifact is used in system delivery.
- `07-company-handbook/README.md`  
  Company handbook structure for industry packages.
- `07-company-handbook/restaurant-company-handbook-template.md`  
  Restaurant-specific company handbook template.
- `08-role-capability-profiles/README.md`  
  Minimal role capability profile structure for industry packages.
- `08-role-capability-profiles/restaurant-role-capability-baseline.md`  
  Restaurant baseline role capability profiles.
- `09-environment-profile/README.md`  
  Minimal environment profile structure.
- `09-environment-profile/restaurant-environment-baseline.md`  
  Restaurant environment baseline.
- `10-niche-profiles/README.md`  
  Niche layer entrypoint and purpose.
- `10-niche-profiles/niche-layer-skeleton.md`  
  Core niche skeleton and explanation document.
- `10-niche-profiles/restaurant-niche-taxonomy.md`  
  Restaurant niche classification tags.
- `10-niche-profiles/restaurant-niche-profile-template.md`  
  Reusable template for restaurant niche definitions.
- `10-niche-profiles/restaurant-niche-italian-premium-service.md`  
  First concrete restaurant niche profile.

## How to Use

1. Start in `00-engine-core.md` to set boundaries between system layer and industry layer.
2. Define or update the seven personas in `01-ai-council/`.
3. Validate that default policy coverage exists in `02-default-policies/`.
4. Build journeys by composing templates from `03-templates/`.
5. Use the resulting templates as the base for E2E, manual, A/B, and security testing.
6. Use `06-relevance-map/` to understand where each artifact applies and who owns it.
7. Use `07-company-handbook/` to create human-facing operational handbooks per industry.
8. Use `08-role-capability-profiles/` to define role knowledge/skills/training readiness.
9. Use `09-environment-profile/` to ground templates and testing in real operating context.
10. Use `10-niche-profiles/` to specialize industry baseline into business-specific focus weights.

## Current Scope

- Industry-0: **Restaurant**.
- This package now includes both contracts and concrete restaurant baseline content.
- Supabase seed/template assets remain the implementation source for seeded data; this package references them rather than duplicating SQL payloads.
