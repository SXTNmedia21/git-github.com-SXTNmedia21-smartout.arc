---
name: journey-protocol
description: |
  Authoring pipeline for Smartout's journey-engine. Five operations that take a
  user's idea through PreJourney → Spec → Refine → Approve → Materialize, plus
  a Rescue operation for agent failure-mode context. Output of approve is a
  13-file folder at docs/journeys/<slug>/ — the "fundament" — that becomes
  source of truth for every downstream artefact (mission, e2e, dashboard, license).
  Triggers on "/journey-protocol", "create journey", "spec a journey", "refine
  journey", "approve journey", "write rescue prompt", new project Phase 0–2 with
  core journeys unauthored, or new core feature needing runtime tracking.
---

# journey-protocol

Authoring pipeline for the Smartout Journey Engine. Five operations, run in order. See `docs/engines/system-intelligence/05-protocol-pipeline.md` for the canonical pipeline contract.

## When to run this skill

Trigger on any of:

- "Let's create a journey for X" / "Add a new journey"
- "Spec out the <name> journey"
- "Refine the journey we drafted"
- "Approve the journey" / "materialize the folder"
- "Write a rescue prompt for <journey>"
- "/journey-protocol"
- New project starting (Phase 0–2 of roadmap) and core journeys not yet authored
- New core feature shipping that needs runtime tracking + dev-tests + AI guide

## When NOT to run this skill

- "Add a step to journey X" → that's an edit on existing IR, use the editor directly
- "Track this metric" → that's analytics, not a journey
- Edge cases or peripheral flows in early project phase → defer
- UI tweaks, copy changes, layout adjustments → not journey work
- "Add a 6th capability" → capability count is frozen at 4 (ADR-0173). ADR-class change.

## Five operations

| # | Op | Slash | Status transition | Op file |
|---|---|---|---|---|
| 1 | **Create** (PreJourney) | `/journey-protocol create` | `idea → wizard` | `ops/01-create.md` |
| 2 | **Spec** (SpecEther) | `/journey-protocol spec` | `wizard → defined` | `ops/02-spec.md` |
| 3 | **Refine** | `/journey-protocol refine` | `defined → ready_impl` | `ops/03-refine.md` |
| 4 | **Approve** | `/journey-protocol approve` | `ready_impl → implemented` | `ops/04-approve.md` |
| 5 | **Rescue** | `/journey-protocol rescue` | (any) | `ops/05-rescue.md` |

Run in order. Each op gates the next. **Approve** materializes the 13-file folder.

## Routing

If user says "create" or "let's start a journey for X" → load `ops/01-create.md`.
If user has a `<slug>.idea.md` and says "spec it out" → load `ops/02-spec.md`.
If user has a `<slug>.spec.yaml` and says "refine" → load `ops/03-refine.md`.
If user has a `<slug>.refined.yaml` and says "approve" → load `ops/04-approve.md`.
If user says "write rescue prompt for X" → load `ops/05-rescue.md`.

If user is unclear which op, ask one question: "Are we starting fresh (idea), filling in steps (spec), binding to code (refine), locking it (approve), or writing the agent's failure context (rescue)?"

## Core principles (apply to all ops)

1. **Core features only.** Early in a project, only journeys representing must-work flows. Push back hard on >10 journeys for MVP.
2. **Conversation, not form.** Real authoring requires pushback on scope, validation that journey is one journey not three, and confirmation. Never just dump a template.
3. **One journey at a time.** Do not batch-create. Each conversation produces one IR.
4. **Spec before code.** Output is `draft` IR. No code is written from this skill — this is planning.
5. **No TBDs.** Every required field must be locked before generating output.
6. **Capability count frozen.** Four capabilities only: `run_dev`, `run_guided`, `publish_mission`, `publish_guide`.

## References

- `references/template.md` — IR template (the YAML the skill writes)
- `references/patterns.md` — common patterns + pushback scripts
- `references/folder-layout.md` — the 13-file approved folder spec
- `references/flow-md-schema.md` — the closed-loop spine schema
- `references/rescue-prompt-format.md` — RESCUE-PROMPT.md format
- `references/examples/newsletter-signup-and-welcome.md` — canonical reference IR

## Canonical engine docs

- `docs/engines/system-intelligence/00-overview.md` — engine entry point
- `docs/engines/system-intelligence/01-prd.md` — PRD v0.2
- `docs/engines/system-intelligence/05-protocol-pipeline.md` — the pipeline this skill implements
- `docs/engines/system-intelligence/06-ir-template.md` — IR authoring template (canonical version)
- `docs/engines/system-intelligence/07-journey-package-compiler.md` — what gets generated

## What this skill does NOT do

- Does not write production code
- Does not run the four runtime capabilities
- Does not edit existing IRs (use the IR editor)
- Does not validate authority configs at runtime
- Does not start journey runs
- Does not modify `engine_authority_config` rows directly (authority seeded via migration)

This is planning + authoring. Output is one validated IR + one materialized folder.
