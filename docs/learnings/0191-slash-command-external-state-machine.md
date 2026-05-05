---
title: "Slash-command workflows > 10 min wall-time require an external state machine — single-shot commands cannot span human pauses"
id: L_0191
status: accepted
layer: learning
created: 2026-05-04
updated: 2026-05-04
references:
  - ../decisions/0265-enforced-deployment-pipeline.md
---

# L-0191: Slash-command workflows > 10 min wall-time require an external state machine — single-shot commands cannot span human pauses

## Why

The `/deploy` command (ADR-0271, status `pending`) automates HOP A (dev → preview) + a Telegram operator-tap + HOP B (preview → main). The full lifecycle crosses a mandatory human pause: step 12 is "wait for operator to tap a Telegram inline button to confirm the merge." This wait can range from minutes to hours.

Claude Code slash-commands execute in a single session turn. There is no native mechanism for a slash-command to pause execution, persist state, yield the session, and resume when an external event fires. If the session ends or times out before the operator taps, the entire pipeline state is lost. The next session has no way to know whether HOP A completed, what the PR number was, or whether the smoke probe passed.

This was surfaced during the 2026-05-04 council (ADR-0271 sub-specs). The deploy-conductor specialist and system-agent-coordinator both flagged it independently. The resolution is an external state machine pattern: `.deploy-state.json` records in-progress pipeline state (current step, PR number, SHA, LKG tag, timestamps), and n8n receives the Telegram webhook callback and fires a GitHub Action continuation. Claude Code reads `.deploy-state.json` at next session start to resume from the correct step.

Without this, the `/deploy` workflow at step 12 would either:
a) Block the session indefinitely waiting for Telegram input (not possible in Claude Code)
b) Time out and lose pipeline state
c) Skip the operator-tap entirely (defeating ADR-0265's audit requirement)

## How to apply

For any slash-command workflow with a wall-time > 10 minutes or a required human pause:

1. Define a state file (e.g. `.deploy-state.json` or `docs/ops/<workflow>-state.json`) with fields: `status`, `current_step`, `started_at`, `expires_at`, and any step-specific context (PR number, SHA, etc.).
2. The slash-command writes state at every step boundary before the human pause.
3. Human interaction routes through an external service (n8n webhook, GitHub Actions `workflow_dispatch`, Telegram bot) — NOT through the Claude Code session.
4. The external service advances state and signals the next action (e.g. calls `gh pr merge` after the Telegram tap).
5. At next session start: the agent reads the state file and reports any in-progress workflow requiring operator attention.

ADR-0271 sub-specs define the full schema for `/deploy`:
- State file: `.deploy-state.json` (TTL 6h, concurrency guard via lockfile)
- Tap handshake: n8n webhook at `https://n8n.smartout.ai/webhook/<uuid>` receives Telegram inline-button callback
- Rollback scope: Vercel traffic only, NOT git revert (scope-limited)
- Concurrency: lockfile prevents two concurrent `/deploy` runs

## Pattern signature

- Workflow involves a required human confirmation (approval, review, tap)
- Human confirmation is expected to take > 5 minutes
- Workflow has side effects that must be undoable if confirmation is rejected
- Session boundary between workflow initiation and workflow completion is possible

When all four: external state machine required, not optional.

## References

- `docs/plans/2026-05-04-pipeline-consolidation-v2.md` — ADR-0271 sub-specs in §Task 5.2
- `docs/council/COUNCIL-LOG.md` — 2026-05-04 entry, ADR-0271 flag
- `../decisions/0265-enforced-deployment-pipeline.md` — ADR governing the pipeline
