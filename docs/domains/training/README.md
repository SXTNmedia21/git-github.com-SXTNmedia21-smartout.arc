---
title: Training Domain — README
status: done
updated: 2026-05-23
created: 2026-05-23
domain: training
tags: [training, competence, readiness, protocol_assignment, knowledge_test, profession]
mirror: verified
last_verified: 2026-05-23
---

# Training Domain

> Entry point. Read this first — then follow the reading order below.

## Build state

🟡 **Partial** — Core engine shipped (assign → complete → score). Mobile read-only. Admin competence matrix live. AI quiz, CV builder, spaced-repetition, and gamification deferred.

| Layer | Status |
|---|---|
| Schema foundation (migrations) | ✅ shipped |
| `packages/training/` shared hooks + types | ✅ shipped |
| Web: `my-training` employee view | ✅ shipped |
| Web: `people/training` admin readiness matrix | ✅ shipped |
| Web: `hms/training` — HMS-flavored subset | ✅ shipped (training-engine; HMS-domain edge — see Guardrails) |
| Mobile: `use-training-data` hook | ✅ shipped |
| Mobile: training screen UI | 🟡 partial (hook wired; full procedure stepper + test UI deferred) |
| Capability tools (3 tools) | ✅ shipped |
| `ops-learn` EF | ✅ shipped (ops pattern-learning, NOT training-domain) |
| Profession-training bootstrap | ✅ shipped (ADR-0387a) |
| AI-adaptive training (Botsson nudges) | 🔴 aspirational |
| CV builder | 🔴 aspirational |
| Spaced repetition scheduling | 🔴 aspirational |
| Gamification integration | 🔴 aspirational |

## Reading order

1. **OVERVIEW.md** — what + why; cascade placement
2. **ARCHITECTURE.md** — L1–L5 code map with anchors
3. **DATA-MODEL.md** — tables, enums, RLS, telemetry
4. **USER-FLOWS.md** — flow index + journey links
5. **GAPS-AND-DEBT.md** — deviations, gaps, overlap edges
6. **ROADMAP.md** — forward plan + ADR references
7. **E2E-COVERAGE.md** — test matrix

## Agent Guardrails

**The single most important boundary in this domain:**

> Training-domain owns the **INSTANCE layer**: assignment, completion proof, and readiness scoring. `procedure-engine` owns the **SPEC layer**: `policy`, `protocol`, `procedure`, `knowledge_test`, `confirmation`. These are separate ownership domains sharing a seam at `protocol_id`.

Specific traps:

1. **Training ≠ procedure-engine.** `protocol_assignment`, `knowledge_test_attempt`, `confirmation_signature`, `procedure_step_completion` are the training-domain's execution proof tables. `knowledge_test`, `confirmation`, `protocol`, `procedure` — the _specs_ — are procedure-engine's tables. Training READS specs; procedure-engine OWNS them. Never write to `protocol`, `procedure`, `knowledge_test`, or `confirmation` from training code.

2. **HMS-training is a training-engine edge.** `/dashboard/hms/training/page.tsx` renders `<CompetenceMatrix>` or `<ProtocolList>` — both are training-engine components. HMS-domain (future) will author WHAT must be trained for HMS compliance; training-domain RUNS the engine. Do not claim `/dashboard/hms/training` ownership — log as edge.

3. **`profession_training` is NOT training-domain.** It is K1a/K1b knowledge seeded at I1 bootstrap, classified as procedure-engine per `docs/domains/procedure-engine/GAPS-AND-DEBT.md:104-106`. Training reads profession-training data; it does not own it.

4. **ADR-0253 lærling is contracts-side.** The `employment_category` constraint migration (`20260503110000`) lives in the contracts migration group. Training reads `is_apprentice` intent via contract; it does not own the contract or category values.

5. **`ops-learn` EF is NOT training-domain.** It learns operational patterns (task duration, staffing, deviation correlation) from `session_task`, `department_session`. It does not read `protocol_assignment` or `knowledge_test_attempt`. Classification: shared ops-intelligence infra.

6. **Trainee status is a `profile.status` attribute** (`profile_status` enum value `'trainee'`). It is NOT a training-domain attribute. Core-structure owns `profile`. Training reads status to gate assignment logic.

7. **`auto_assign_protocols_to_new_employee` trigger** fires on profile INSERT. It is DDL-owned in training-schema-foundation but its logic reads `policy.policy_scope` and `team_member` (procedure-engine + core-structure tables). It is the seam where training-domain initiates based on org-structure events.
