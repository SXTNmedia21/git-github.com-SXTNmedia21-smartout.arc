---
title: "User Journeys — Journey Package Skills"
status: done
updated: 2026-04-10
created: 2026-04-10
module: meta
tags: [journeys, skills, roadmap, journey, mission]
---

# User Journeys — Journey Package Skills

This feature provides three Claude Code skills (`/roadmap`, `/journey`, `/mission`) that form a pipeline for producing journey package artifacts. The user is a developer (or AI agent) working in Claude Code.

---

## Journey: Developer Creates a Roadmap

**Precondition:** Developer has a user workflow idea but no journey package artifacts yet.

1. Developer types `/roadmap` (or "new roadmap", "start journey package") in Claude Code -> Skill triggers, reads engine docs and existing roadmaps for context -> Developer sees confidence assessment (HIGH/MEDIUM/LOW)
2. If HIGH confidence: Skill auto-drafts Roadmap.md -> Developer reviews draft -> Developer sees complete Roadmap.md in `docs/Roadmaps/{slug}/Roadmap.md`
3. If MEDIUM confidence: Skill asks 3-5 targeted questions -> Developer answers -> Skill generates Roadmap.md -> Developer sees complete Roadmap.md
4. If LOW confidence: Skill runs structured wizard (actor, platform, scope, success criteria) -> Developer answers each prompt -> Skill generates Roadmap.md -> Developer sees complete Roadmap.md
5. Skill runs knowledge gate check -> If all gates pass, artifact is written to disk -> Developer sees file path confirmation and next step hint ("Run /journey next")

**Postcondition:** `docs/Roadmaps/{slug}/Roadmap.md` exists with Package Identity, Actor, Platform, Scope, Success Criteria, and Related Journeys sections.

**Error paths:**

- Knowledge gate fails (missing info) -> Skill asks specific follow-up questions before generating
- Similar roadmap already exists -> Skill warns and asks to confirm or reuse existing
- Developer provides contradictory scope -> Skill flags conflict and asks for clarification

---

## Journey: Developer Creates a Journey Deep Spec

**Precondition:** `docs/Roadmaps/{slug}/Roadmap.md` exists for this journey package.

1. Developer types `/journey` (or "build journey", "journey for X") in Claude Code -> Skill checks for Roadmap.md prerequisite
2. If Roadmap.md missing -> Skill responds "Run /roadmap first" -> Flow stops
3. Skill reads Roadmap.md + all input sources (MODULE docs, DATABASE.md, engine docs, existing journeys) -> Skill assesses confidence
4. If HIGH confidence: Skill auto-generates Journey.md in Deep Spec format -> Developer reviews
5. If MEDIUM/LOW confidence: Skill asks targeted questions about steps, events, DB writes -> Developer answers -> Skill generates Journey.md
6. Skill writes `docs/Roadmaps/{slug}/Journey.md` with TypeScript-flavored markdown tables (every button, event, notification, DB write, screen state) -> Developer sees file path and next step hint ("Run /mission next")

**Postcondition:** `docs/Roadmaps/{slug}/Journey.md` exists in Deep Spec format with all user steps, system actions, events, and data writes fully specified.

**Error paths:**

- No Roadmap.md found -> Skill blocks and instructs to run `/roadmap` first
- Referenced DB tables don't exist -> Skill flags gaps and suggests migration or alternative
- Conflicting journey steps -> Skill asks developer to resolve ambiguity

---

## Journey: Developer Creates a Mission Definition

**Precondition:** `docs/Roadmaps/{slug}/Journey.md` and `docs/Roadmaps/{slug}/Roadmap.md` both exist.

1. Developer types `/mission` (or "build mission", "mission for X") in Claude Code -> Skill checks for Journey.md and Roadmap.md prerequisites
2. If Journey.md missing -> Skill responds "Run /journey first" -> Flow stops
3. Skill runs triage gate: Does this journey need an AI mission? -> If pure UI journey (no agent involvement) -> Skill creates stub Mission.md with `status: not-applicable` -> Flow ends
4. Skill reads Journey.md + Roadmap.md + engine docs + Guardian docs + DB schema -> Skill maps journey steps to mission stages (not 1:1; UI-only steps merge)
5. Skill generates Mission.md with: stage definitions, system_prompt per stage, tools, timing thresholds, observability contract (results + trackability + triggerability), Guardian integration table
6. Skill generates seed SQL for `engine_missions` and `engine_stages` tables, including `journey_id` and `journey_step_id` linkage
7. Skill writes both files to `docs/Roadmaps/{slug}/Mission.md` and `docs/Roadmaps/{slug}/mission-seed.sql` -> Developer sees file paths and verification hint

**Postcondition:** Mission.md exists with stage definitions, observability contract, and Guardian integration. Seed SQL ready for insertion. Agent-added stages (greeting/wrapup) have NULL journey_step_id.

**Error paths:**

- No Journey.md found -> Skill blocks and instructs to run `/journey` first
- No Roadmap.md found -> Skill blocks and instructs to run `/roadmap` first
- Triage determines no mission needed -> Stub Mission.md with not-applicable status created (not an error, expected for system journeys)
- Guardian event types don't match schema -> Skill flags mismatch and suggests correction
- Missing journey_step_id on stages -> Skill warns that Guardian evaluator will skip those stages

---

## Journey: Developer Runs Full Pipeline (Roadmap -> Journey -> Mission)

**Precondition:** Developer has a new user workflow to specify end-to-end.

1. Developer runs `/roadmap` for workflow X -> Roadmap.md created (see Journey 1 above)
2. Developer runs `/journey` for workflow X -> Journey.md created in Deep Spec format (see Journey 2 above)
3. Developer runs `/mission` for workflow X -> Mission.md + seed SQL created (see Journey 3 above)
4. Developer reviews all three artifacts for consistency -> Each artifact cross-references the others

**Postcondition:** Complete journey package with Roadmap.md, Journey.md, Mission.md, and mission-seed.sql in `docs/Roadmaps/{slug}/`.

**Error paths:**

- Developer skips a step -> Downstream skill blocks with prerequisite error
- Artifacts drift out of sync -> Developer must re-run downstream skills after upstream changes
