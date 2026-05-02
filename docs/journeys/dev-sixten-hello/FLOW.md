---
title: "Flow — dev-sixten-hello"
mission_id: dev-sixten-hello
phase: 0
---

# Flow

Single-stage smoke-test. All events bound to `packages/telemetry/src/registry.ts`.

| step_id | actor | event | payload_keys | next_step_id |
|---------|-------|-------|--------------|--------------|
| step-0-start | agent | journey run_started | mission_id, journey_version_id | step-1-write-output |
| step-1-write-output | sixten | journey step_reached | mission_id, step_id, label | step-2-complete |
| step-2-complete | sixten | journey completed | mission_id, output_path | — |

## Acceptance

`docs/journeys/dev-sixten-hello/OUTPUT.md` exists with:
- Non-empty H1 heading starting with `# Sixten`
- Exactly 3 sentences of descriptive text below the heading

Falsifiable: `grep -c "^#" docs/journeys/dev-sixten-hello/OUTPUT.md` returns `>= 1`
