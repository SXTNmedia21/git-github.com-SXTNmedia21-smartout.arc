---
title: "Dev Sixten Hello (Sixten persona smoke-test)"
mission_id: dev-sixten-hello
phase: 0
persona: sixten
created: 2026-04-30
updated: 2026-04-30
status: active
---

# Dev Sixten Hello

Smoke-test mission for the Sixten persona wake-flow.

No capability calls. No schema mutations. No workspace data mutations.
Single-stage: read the sixten agent definition and write a brief ADR intro.

## Stage 1 — Read and intro

1. Read `.claude/agents/sixten.md` to load the sixten persona definition.
2. Write `docs/journeys/dev-sixten-hello/OUTPUT.md` with:
   - A markdown H1 heading: `# Sixten — Stage Engine Integration`
   - Exactly 3 sentences describing: (a) who Sixten is, (b) how he wakes via the mission-pool dispatch path, (c) what he will do for Smartout over time.
3. Write `SIXTEN_MISSION_COMPLETE: dev-sixten-hello` as the final output line.

## Success criteria

- `docs/journeys/dev-sixten-hello/OUTPUT.md` exists.
- File contains an H1 heading starting with `# Sixten`.
- File contains exactly 3 sentences of non-empty text below the heading.
- Final output line is `SIXTEN_MISSION_COMPLETE: dev-sixten-hello`.

## Acceptance

`docs/journeys/dev-sixten-hello/OUTPUT.md` present, non-empty, H1 present, 3 sentences.
