---
title: Industry Template Taxonomy
id: ENGINE_TEMPLATE_TAXONOMY
version: "0.1"
status: draft
layer: templates
created: 2026-03-06
updated: 2026-03-06
owner: platform
tags:
  - templates
  - business-structure
  - task-pipeline
  - journey
---

# Industry Template Taxonomy

## Why templates are split

Templates are split so each document solves one thing well and can be reused without forcing unrelated complexity.

## Template Families

1. **Business Structure Templates**  
   Defines organizational backbone (departments, teams, roles, locations, shifts).

2. **Task Pipeline Templates**  
   Defines repeated operational sequences (start, tasks, checks, signoff, escalation).

3. **Journey Templates**  
   Defines user-facing and agent-facing flow contracts composed from architecture components.

4. **Testing Templates** (linked per journey)  
   Defines automated, manual, A/B, and security assertions.

## Concrete Restaurant Files

- `restaurant-business-structure-template.md`
- `restaurant-task-pipelines-template.md`
- `restaurant-journey-template-catalog.md`

## Composition Rule

`Business structure template + task pipeline template + policy baseline + persona assumptions = journey template`

## Output Standard

Every template should define:

- Intent
- Preconditions
- Inputs
- Outputs
- Events/hooks/triggers touched
- Validation and policy gates
- Relevant test profile
