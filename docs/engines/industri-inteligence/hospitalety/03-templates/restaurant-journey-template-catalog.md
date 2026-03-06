---
title: Restaurant Journey Template Catalog
id: ENGINE_TEMPLATE_RESTAURANT_JOURNEYS
version: "0.1"
status: draft
layer: templates
created: 2026-03-06
updated: 2026-03-06
owner: platform
tags:
  - templates
  - journeys
  - restaurant
---

# Restaurant Journey Template Catalog

## Purpose

Define the restaurant journey baseline by grouping journey templates into capability tracks.

## Track A: Onboarding and Setup Journeys

- Admin workspace setup journey template
- Onboarding mission journey template (agent-guided)
- Employee invitation and acceptance journey template
- Trainee-mode onboarding progression template

## Track B: Scheduling and Workforce Journeys

- Weekly schedule planning journey template
- Open-shift fulfillment journey template
- Shift swap and approval journey template
- Staffing gap response journey template

## Track C: Operations and Governance Journeys

- Opening workflow journey template
- Service execution journey template
- Closing and signoff journey template
- Deviation handling journey template

## Track D: Readiness and Training Journeys

- Protocol assignment completion journey template
- Knowledge test completion journey template
- Readiness promotion journey template

## Track E: Management and Insight Journeys

- Daily management review journey template
- Multi-site comparison journey template
- Weekly performance review journey template

## Existing Journey Reference Set

Current journey docs already implemented in repo should be treated as source references for this catalog:

- `docs/journeys/JOURNEY-onboarding-mission.md`
- `docs/journeys/JOURNEY-journey-testing-system.md`
- `docs/journeys/employee-invitation-accept.md`
- `docs/journeys/JOURNEY-schedule-v2.md`
- `docs/journeys/JOURNEY-schedule-ui.md`
- `docs/journeys/JOURNEY-operation.md`
- `docs/journeys/JOURNEY-dashboard-evolution.md`

## Required Template Attachments per Journey

Every journey template should include:

- actor segment(s) from AI council
- mapped policy gates
- mapped events/hooks/triggers/endpoints
- expected data contract reads/writes
- testing profile links (automated/manual/A-B/security)
