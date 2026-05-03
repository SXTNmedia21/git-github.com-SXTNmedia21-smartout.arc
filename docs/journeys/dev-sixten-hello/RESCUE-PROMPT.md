---
title: "Rescue — dev-sixten-hello"
mission_id: dev-sixten-hello
phase: 0
---

# Rescue

If context is lost mid-mission:

1. Read `docs/journeys/dev-sixten-hello/MISSION.md` — the full stage list.
2. Read `.claude/agents/sixten.md` — persona definition.
3. Check if `docs/journeys/dev-sixten-hello/OUTPUT.md` already exists — if yes, mission may be complete.
4. If OUTPUT.md is absent, re-execute Stage 1 from scratch.

On any unrecoverable error: write `SIXTEN_MISSION_BLOCKED: <reason>` to stdout and stop.
