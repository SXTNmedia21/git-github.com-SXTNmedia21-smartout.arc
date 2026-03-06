---
title: Restaurant Business Structure Template
id: ENGINE_TEMPLATE_RESTAURANT_STRUCTURE
version: "0.1"
status: draft
layer: templates
created: 2026-03-06
updated: 2026-03-06
owner: platform
tags:
  - templates
  - restaurant
  - structure
---

# Restaurant Business Structure Template

## Purpose

Define the concrete default structure used when a restaurant workspace is initialized.

## Structural Backbone

### Departments

- Kjøkken
- Restaurant (sal/servering)
- Bar
- Catering
- Renhold
- Levering
- Event

### Roles and Positions

Representative role ladder includes:

- leadership roles (kitchen lead, sal lead, bar lead)
- core operators (cook, waiter, bartender, cleaner)
- support operators (assistant, runner, barback)
- specialist and event roles

### Teams

Default team cluster:

- kitchen team
- sal team
- bar team
- leadership team

### Locations and Zones

Default location model:

- main restaurant
- outdoor service
- catering base

Default zone model includes service, production, storage, support, and guest-facing areas.

## Workforce Cohort Model

Default workforce includes mixed cohorts:

- native-language adults
- non-native language workers
- underage trainees
- pensioner part-time operators
- freelancer/on-call operators

## Schedule Assumptions

- three-month rolling shift generation baseline
- cohort-aware shift constraints
- day and hour variance model
- weekend and event load handling

## Contract and Readiness Links

- employment contract baseline mapped to role category
- protocol assignment coverage by role/capability
- onboarding/readiness progression tied to assignment completion

## Implementation References

- `supabase/templates/restaurant/departments.sql`
- `supabase/templates/restaurant/locations.sql`
- `supabase/templates/restaurant/employees.sql`
- `supabase/templates/restaurant/teams.sql`
- `supabase/templates/restaurant/schedule.sql`
- `supabase/templates/restaurant/contracts.sql`
- `supabase/templates/restaurant/assignments.sql`
