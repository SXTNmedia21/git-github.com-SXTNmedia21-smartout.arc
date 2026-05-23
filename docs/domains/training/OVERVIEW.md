---
title: Training Domain — Overview
status: done
updated: 2026-05-23
created: 2026-05-23
domain: training
tags: [training, competence, readiness, cascade, D2, D3, protocol_assignment]
mirror: verified
last_verified: 2026-05-23
---

# Training Domain — Overview

## What it is

Training is the **instance engine** on top of the governance/procedure-engine spec layer. It answers one question: _is this employee ready?_

"Ready" is the core product metric of Smartout:

```
Readiness Score = (completed protocol_assignments / total assigned) × 100%
100% = READY — all Policies learned, all Protocols completed
```

An employee is assigned Protocols automatically when they join a Team or Department (via `auto_assign_protocols_to_new_employee` trigger). They then complete each Protocol by:
1. Reading through `procedure_step` content (including `training_content` + `media_urls`)
2. Passing `knowledge_test` quizzes (`knowledge_test_attempt`)
3. Signing `confirmation` documents (`confirmation_signature`)

Each completion is an **immutable proof record**. When all components of a Protocol are done, the `protocol_assignment.status → completed`. When all assignments are complete, the employee is at 100% readiness.

## What it is NOT

- **Not a course/LMS system.** No separate "course" or "module" entity. Training content IS the operational procedure — same steps, dual context (training vs. operations mode).
- **Not the spec layer.** `protocol`, `policy`, `knowledge_test`, `confirmation`, `procedure` — these are procedure-engine's tables. Training reads them; it does not own them.
- **Not gamification.** Points for training completion are aspirational (MODULE_6 §10). No `points_event` table built.
- **Not compliance documentation.** Compliance is a _byproduct_ of actual competence. Training captures the proof; it doesn't generate compliance reports separately.

## Cascade placement

| Dimension | Role |
|---|---|
| **D2 Resource** | Primary — training defines profile readiness, which determines schedulable capacity |
| **D3 Rules & Constraints** | Secondary — training requirements (policy scope) constrain who can work what position |
| **K1a Industry Knowledge** | Consumes — `profession_training` maps industry roles to mandatory protocols (ADR-0387a) |

The training-domain sits at the junction of D2 (who is ready) and D3 (what is required). Readiness scores feed back into the D2 resource profile and surface in the scheduling domain.

## The three training systems (from MODULE_6)

| System | What it teaches | Owned by |
|---|---|---|
| Trainee Mode | Smartout the software | onboarding (future domain) |
| Module Journeys | Per-module UI features | onboarding (future domain) |
| **Protocol Training** | The actual job — procedures, safety, compliance | **training-domain** |

Only Protocol Training lives in this domain.

## Assignment cascade

```
Profile joins Team/Department
  → auto_assign_protocols_to_new_employee() trigger
  → Reads: policy.policy_scope + team_member + department_id + location_id
  → Inserts: protocol_assignment rows (status = not_started)
  → Scope cascade:
      workspace-wide Policies  → everyone
      Department Policies      → dept members
      Team Policies            → team members
      Location Policies        → location members
```

Position-based assignment (`assigned_via = 'position'`) is defined in the enum but the trigger has no position branch — this is a known gap (G25 in procedure-engine GAPS).

## Profession-training bootstrap

At workspace I1 bootstrap (Step 11, hospitality niche only), `fn_seed_profession_training` seeds `profession` rows and links them to mandatory protocols via `profession_training`. This is an I1/K1a surface — `profession_training` is classified as procedure-engine-owned (ADR-0387a). Training reads these mappings via `governance.list_mandatory_protocols_for_role` capability tool; it does not write to `profession_training`.

## Readiness as product north-star

Every feature in Smartout ultimately points back to readiness. The competence matrix shows managers which employees are ready for which positions. The scheduling domain reads readiness to flag unsafe assignments. Botsson uses readiness gaps to prioritize training nudges. The billing domain uses signed-contract status (not readiness) as a separate gate.
