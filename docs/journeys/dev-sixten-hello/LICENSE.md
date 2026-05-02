---
title: "License — dev-sixten-hello"
mission_id: dev-sixten-hello
authority_profile: internal-platform-admin
phase: 0
---

# Authority License

Phase 0 Sixten smoke-test. No customer-data access. No workspace mutations.

## Allowed

- Read `.claude/agents/sixten.md` (own persona definition).
- Write `docs/journeys/dev-sixten-hello/OUTPUT.md` (own mission folder output).
- Emit the terminal signal `SIXTEN_MISSION_COMPLETE: dev-sixten-hello` to stdout.

## Denied

- Any mutation to workspace, profile, or customer data tables.
- Any capability tool invocation (no stage-engine calls).
- Any schema migration or DDL.
- Any file edit outside `docs/journeys/dev-sixten-hello/`.
- Any `git push`, `git commit`, or branch-switch operations.
- Voice channel — this mission is silent/autonomous.
- Any shell commands other than Read and Write file operations.
