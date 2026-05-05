---
title: "Flow — dev-adr-0249-base-consolidation"
mission_id: dev-adr-0249-base-consolidation
phase: 1
---

# Flow

All 7 events bound to `packages/telemetry/src/registry.ts`. No new events.
Space-convention names per ADR-0175. PR-open (stage 6) is an action within the
terminal step — its outcome is captured in the `journey completed` payload
(`pr_opened: true`), not as a separate `step_reached` row.

| step_id | actor | event | payload_keys | next_step_id |
|---------|-------|-------|--------------|--------------|
| step-0-start | agent | journey run_started | mission_id, journey_version_id | step-1-read-infra |
| step-1-read-infra | agent | journey step_reached | mission_id, step_id, label | step-2-read-template |
| step-2-read-template | agent | journey step_reached | mission_id, step_id, label | step-3-compose-draft |
| step-3-compose-draft | agent | journey step_reached | mission_id, step_id, label | step-4-write-adr |
| step-4-write-adr | agent | journey step_reached | mission_id, step_id, label, adr_path | step-5-update-log |
| step-5-update-log | agent | journey step_reached | mission_id, step_id, label | step-7-complete |
| step-7-complete | agent | journey completed | mission_id, adr, pr_opened | — |
