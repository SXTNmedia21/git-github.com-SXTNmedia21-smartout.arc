---
title: "Design — Journey Package Skills System"
status: done
updated: 2026-03-06
created: 2026-03-06
module: meta
tags: [design, skills, journey-package, roadmap, journey, mission, deep-spec]
---

# Design — Journey Package Skills System

## Problem

Smartout's journey packages require 9 coordinated artifacts per user workflow. Without structured tooling, developers produce inconsistent artifacts with missing cross-references, varying depth, and undocumented gaps. The journey package compiler (`docs/engines/system-inteligence/07-journey-package-compiler.md`) defines WHAT each package must contain, but not HOW to produce it.

## Solution

A system of Claude Code skills that guide artifact creation through the full journey package pipeline. Each skill reads engine docs, DB schema, and prior artifacts to assess confidence, then either auto-generates (high confidence), asks targeted questions (medium), or runs a structured wizard (low).

## The 9-Skill System

Each skill maps to one artifact in the canonical journey package:

| #   | Skill             | Artifact           | Status  | Input                             | Output                                            |
| --- | ----------------- | ------------------ | ------- | --------------------------------- | ------------------------------------------------- |
| 1   | `/roadmap`        | Roadmap            | Done    | User intent + registry            | `docs/Roadmaps/{slug}/Roadmap.md`                 |
| 2   | `/journey`        | Journey Deep Spec  | Done    | Roadmap + DB schema + engine docs | `docs/Roadmaps/{slug}/Journey.md`                 |
| 3   | `/mission`        | Mission + Seed SQL | Done    | Journey deep spec                 | `docs/Roadmaps/{slug}/Mission.md` + migration SQL |
| 4   | `/license`        | License            | Planned | Roadmap + Journey                 | `docs/Roadmaps/{slug}/License.md`                 |
| 5   | `/user-test`      | User Test          | Planned | Journey                           | `docs/Roadmaps/{slug}/UserTest.md`                |
| 6   | `/knowledge-test` | Knowledge Test     | Planned | Journey + Mission                 | `docs/Roadmaps/{slug}/KnowledgeTest.md`           |
| 7   | `/function-test`  | Function Test      | Planned | Journey + data ops                | `docs/Roadmaps/{slug}/FunctionTest.md`            |
| 8   | `/journey-test`   | E2E Test Script    | Exists  | Journey deep spec                 | Playwright test file                              |
| 9   | `/api-contract`   | API Contract       | Planned | Journey + data ops                | `docs/Roadmaps/{slug}/APIContract.md`             |

Supporting skills (not package artifacts):

| Skill                  | Purpose                           | Status |
| ---------------------- | --------------------------------- | ------ |
| `/mission-training`    | Iterate on existing missions      | Done   |
| `/journey-manual-test` | Manual test cases from journey    | Exists |
| `/agent-scoring`       | Score agent performance per stage | Exists |

## Dependency Chain

```
/roadmap
  └── /journey
        ├── /mission
        │     └── /mission-training (iterate)
        ├── /license
        ├── /journey-test
        ├── /journey-manual-test
        ├── /user-test
        ├── /knowledge-test
        ├── /function-test
        └── /api-contract
```

**Corrected from initial design:** The original brainstorm had `/mission` depending on `/license`. Engine architect review identified this as wrong -- missions are independent of policy gates. The mission needs the journey (what happens), not the license (what's allowed).

## Confidence-Driven Behavior

All skills share a common confidence model:

| Confidence | Behavior                                                    | Threshold                              |
| ---------- | ----------------------------------------------------------- | -------------------------------------- |
| HIGH       | Auto-generate complete draft for review                     | Skill-specific (typically 4-5 signals) |
| MEDIUM     | Generate skeleton with `[TBD]` gaps, ask targeted questions | 2-3 signals                            |
| LOW        | Walk through step by step via wizard                        | 0-1 signals                            |

Signals that boost confidence:

- Similar artifact exists (can use as template)
- DB tables for this domain exist and are documented
- Module doc covers this workflow
- User provided detailed description
- Playwright recording provided (journey skill only)

## Knowledge Gates

Every skill has mandatory knowledge gates -- facts that MUST be known before generating output. If a gate fails, the skill asks the user.

**Roadmap gates (9):** Journey ID, module, actor, platform, business intent, scope, success criteria, related journeys, priority.

**Journey gates (6 journey-level + 10 per-step at P0):** Trigger, preconditions, related journeys, step count, niche multipliers, AI Council notes. Per step: action, UI, screen states, data ops, events, notifications, gamification, compliance, errors, test assertions.

**Mission gates (6):** Journey steps, stage mapping, tools needed, timing thresholds, failure signals, Guardian watches.

## Priority Tiers (Depth Levels)

The `/journey` skill supports three depth tiers:

| Tier        | Dimensions per step                           | Use when               |
| ----------- | --------------------------------------------- | ---------------------- |
| P0 Full     | All 10                                        | Critical path journeys |
| P1 Medium   | 6 (action, ui, data, events, errors, expects) | Important journeys     |
| P2 Skeleton | 3 (action, data, expects)                     | Future/nice-to-have    |

Default: match the priority from the Roadmap. User can override.

## Format Decision: Deep Spec as Canonical

The journey artifact uses "Deep Spec" format -- TypeScript-flavored markdown tables with 10 dimensions per step. This was chosen over:

- **Pure TypeScript interfaces** -- too rigid, hard to read for non-developers
- **Natural language** -- too vague, not machine-parseable
- **YAML/JSON** -- too noisy for human review

Deep Spec balances readability with precision. The gold standard is J-019 (Punch Into Shift) in `docs/modules/journey/SMARTOUT_JOURNEY_DEEP_SPEC.md`.

## Cross-Linking Strategy

### Package Identity Block

Every artifact in a package starts with the same identity block:

```
- Package ID: JP-R{NNN}-{SLUG}
- Roadmap ID: R-{NNN}
- Journey ID: J-{NNN}
- Mission ID: M-{NNN}
- License ID: L-{NNN}
```

### Relative Links

Artifacts within a package link to each other with relative paths:

- `[Roadmap](./Roadmap.md)`
- `[Journey](./Journey.md)`
- `[Mission](./Mission.md)`

### Engine Doc References

Skills read engine docs as input but don't link to them in output (engine docs are implementation details, not user-facing). The skill itself contains the reference paths.

## Engine Architect Risk Assessment

Risks identified during brainstorming and mitigations applied:

| Risk                                     | Severity | Mitigation                                                                       |
| ---------------------------------------- | -------- | -------------------------------------------------------------------------------- |
| Skills diverge from actual DB schema     | High     | Skills read `DATABASE.md` + `database.types.ts` before generating                |
| Norwegian labels get English fallbacks   | Medium   | Skills enforce Norwegian for all user-facing text. Common mistake section warns. |
| Journey steps map 1:1 to mission stages  | Medium   | `/mission` skill has explicit triage: UI-only steps don't become stages          |
| Guardian integration forgotten           | Medium   | `/mission` skill has mandatory Guardian section + wiring checklist               |
| Package Identity drift between artifacts | Low      | Same identity block template shared across all skills                            |
| Skills become stale as schema evolves    | Low      | Skills reference live docs, not hardcoded schemas                                |

## Validation Results

### /roadmap validated on J-001 Admin Onboarding

- All 9 knowledge gates filled from registry + module docs
- Package Identity matches existing artifacts
- Success criteria measurable
- Related journeys correctly cross-referenced

### /journey validated on J-016 Check My Schedule (P2 Skeleton)

- 3 steps, 3 dimensions each (action, data, expects)
- Data operations reference real tables (`schedule_shift`, `profile`)
- RLS policies specified
- Norwegian labels used

### /journey validated on J-019 Punch Into Shift (P0 Full)

- All 10 dimensions present per step
- 5 steps matching gold standard structure
- Gamification calculations present
- Notification templates present
- Error scenarios covered
- Event envelope compliance verified
- Test assertions per step

## File Inventory

Skills:

- `.claude/skills/roadmap.md` -- Journey package foundation
- `.claude/skills/journey.md` -- Deep spec builder
- `.claude/skills/mission.md` -- Agent execution builder
- `.claude/skills/mission-training.md` -- Mission iteration
- `.claude/skills/journey-test.md` -- E2E test generator
- `.claude/skills/journey-manual-test.md` -- Manual test case generator
- `.claude/skills/agent-scoring-SKILL.md` -- Agent performance scoring

Validated packages:

- `docs/Roadmaps/Admin onboarding/` -- J-001, Roadmap + Journey + Mission + License
- `docs/Roadmaps/check-my-schedule/` -- J-016, Roadmap + Journey (P2)
- `docs/Roadmaps/punch-into-shift/` -- J-019, Roadmap + Journey (P0)

Design docs:

- `docs/plans/2026-03-06-mission-skill-design.md` -- /mission skill design
- `docs/plans/2026-03-06-journey-package-skills-design.md` -- This file
- `docs/plans/2026-03-06-journey-package-skills.md` -- Implementation plan
