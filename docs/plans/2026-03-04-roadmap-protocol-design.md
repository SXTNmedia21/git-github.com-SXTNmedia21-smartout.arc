---
title: Roadmap Protocol Design
status: approved
updated: 2026-03-04
created: 2026-03-04
module: meta
tags: [roadmap, journey, protocol, design, architecture]
---

# Roadmap Protocol Design

> Everything in Smartout is a procedure. A Roadmap defines the procedure. A Journey is someone doing it. The Protocol is how the leader sees and controls it.

## Core Concept

A **Roadmap** is a defined procedure lasting 10-30 minutes that produces 5 deliverables. It is the single source of truth for how a specific user flow works in Smartout.

### Three Perspectives, One System

| Name         | Perspective    | What it is                                                       |
| ------------ | -------------- | ---------------------------------------------------------------- |
| **Roadmap**  | The definition | The blueprint. Well-documented, well-guided, controlled, tested. |
| **Journey**  | The employee   | "I'm on a journey" — the live instance, guided by Lise.          |
| **Protocol** | The leader     | Insight, observation, control. Same data, different view.        |

### Five Deliverables

Every Roadmap produces exactly 5 outputs:

| #   | Deliverable           | Type Key        | What it is                                            |
| --- | --------------------- | --------------- | ----------------------------------------------------- |
| 1   | **Onboarding Manual** | `manual`        | Step-by-step guide the user reads and follows         |
| 2   | **Playwright Script** | `e2e`           | Automated browser test for agent-driven verification  |
| 3   | **Agent Mission**     | `mission`       | Lise guides, challenges, and certifies the employee   |
| 4   | **Certification**     | `certification` | Proof that the user completed the roadmap             |
| 5   | **API Documentation** | `api_doc`       | All endpoints, data models, and moving parts involved |

## Lifecycle

```
Roadmap (blueprint)
  │
  ├── Created by: AI wizard, admin, or docs-tutor agent
  ├── Contains: steps, hooks, requirements, expected data
  └── Generates: 5 deliverables as a package
        │
        ▼
Journey (live instance)
  │
  ├── Started by: employee assignment, self-service, or auto-trigger
  ├── start-hook fires → session created
  ├── Events: step_completed, data_saved, test_passed, whisper_sent, ...
  ├── Guardian evaluator monitors progress (30s loop)
  └── stop-hook fires → session ends (pass / fail / abandon)
        │
        ▼
Certification (proof)
  │
  ├── Issued when: all required steps completed + stop-hook passes
  ├── Contains: user, roadmap, timestamp, score, duration
  └── Visible to: employee (badge), leader (protocol view)
```

## Hooks and Events

Every Roadmap defines:

- **Start-hook** — Fires when a journey begins. Maps to: Stage Engine session creation. Example: "User opened the HACCP temperature logging page."
- **Stop-hook** — Fires when a journey ends. Maps to: session completion/expiry. Example: "All 5 temperature readings logged and signed."
- **Events** — Sequence between start and stop. Maps to: stage transitions, tool calls, data writes. Each event has a type, timestamp, and optional payload.

### Event Types

| Event                  | When                  | Data                               |
| ---------------------- | --------------------- | ---------------------------------- |
| `step_started`         | User enters a step    | step_id, screen, component         |
| `step_completed`       | User finishes a step  | step_id, duration_ms, data_written |
| `data_saved`           | System persists data  | table, fields, values              |
| `test_passed`          | Verification succeeds | assertion, result                  |
| `test_failed`          | Verification fails    | assertion, error                   |
| `whisper_sent`         | Guardian nudges user  | message, reason                    |
| `certification_issued` | All requirements met  | cert_id, score                     |

## Relationship to Existing System

### What stays the same

- Database tables: `journey`, `journey_step`, `journey_event`, `journey_test_run`, `wizard_session`
- State machine: 13 statuses from idea to active/broken
- Stage Engine integration: `engine_missions.journey_id`, `engine_stages.journey_step_id`
- Guardian evaluator: 30-second loop, whispers, auto-advance
- Wizard: AI-guided roadmap creation through 6 phases

### What changes

| Area              | Before                                    | After                                                                    |
| ----------------- | ----------------------------------------- | ------------------------------------------------------------------------ |
| Public naming     | "Journey" everywhere                      | **Roadmap** (definition), **Journey** (live), **Protocol** (leader view) |
| Output types      | `'e2e' \| 'doc' \| 'linear' \| 'botsson'` | `'manual' \| 'e2e' \| 'mission' \| 'certification' \| 'api_doc'`         |
| Output generation | One at a time, on demand                  | All 5 as a package (can still generate individually)                     |
| Certification     | Not formalized                            | Formal output with requirements, score, and badge                        |
| API docs          | Not generated                             | Auto-generated from step data_reads/data_writes                          |
| Template          | None                                      | `docs/templates/roadmap.md` — formal Roadmap Protocol                    |

### Output Type Migration

```typescript
// Before
type JourneyOutputType = "e2e" | "doc" | "linear" | "botsson";

// After
type RoadmapOutputType = "manual" | "e2e" | "mission" | "certification" | "api_doc";

// Mapping
// 'doc'     → 'manual'     (renamed, same concept)
// 'e2e'     → 'e2e'        (unchanged)
// 'botsson' → 'mission'    (renamed, expanded to full mission definition)
// 'linear'  → removed      (Linear integration is separate concern)
// new       → 'certification'
// new       → 'api_doc'
```

## Template: Roadmap Protocol

Location: `docs/templates/roadmap.md`

A Roadmap Protocol template defines:

1. **Metadata** — title, module, actor, platform, priority, estimated duration
2. **Preconditions** — what must be true before starting
3. **Steps** — ordered sequence with: title, action, screen, component, data_reads, data_writes, duration bounds, required_confirmation
4. **Start-hook** — what triggers when the journey begins
5. **Stop-hook** — what triggers when the journey ends
6. **Success criteria** — what "done" looks like
7. **Error paths** — what happens when things go wrong
8. **Deliverables checklist** — which of the 5 outputs are generated

## Implementation Notes

### Approach: Evolve (not rename)

- DB tables stay `journey_*` internally — implementation detail
- UI and templates use "Roadmap" language
- Types evolve: add new output types, deprecate old ones
- Generators in `packages/ai/src/generators/` get 2 new generators (certification, api_doc) and 2 renamed ones
- Template file becomes the canonical definition

### Generator Architecture

Each of the 5 generators takes a `JourneyWithSteps` and produces structured output:

| Generator                 | Input                               | Output                                                     |
| ------------------------- | ----------------------------------- | ---------------------------------------------------------- |
| `generateManual()`        | Journey + steps                     | Norwegian markdown guide with screenshots placeholders     |
| `generateE2ETest()`       | Journey + steps                     | Playwright test with page objects and assertions           |
| `generateMission()`       | Journey + steps                     | Stage Engine mission definition (stages, tools, prompts)   |
| `generateCertification()` | Journey + steps                     | Requirements checklist, scoring rubric, badge metadata     |
| `generateApiDoc()`        | Journey + steps (data_reads/writes) | Endpoint reference, data models, request/response examples |

### Package Generation

New function: `generateRoadmapPackage(journey: JourneyWithSteps)` — calls all 5 generators and returns the complete package. Can be triggered from:

- Journey detail page (button: "Generate Roadmap Package")
- Wizard completion (auto-generate after journey is defined)
- Docs-tutor agent (programmatic)

## Success Criteria

A Roadmap Protocol is complete when:

1. Template exists at `docs/templates/roadmap.md`
2. All 5 output types can be generated from any journey
3. The start/stop hooks are wired to Stage Engine events
4. Certification is a formal output with requirements
5. API docs are auto-generated from step metadata
6. UI uses "Roadmap" language in public-facing contexts
