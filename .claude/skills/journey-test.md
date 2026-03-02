---
name: journey-test
description: Run an automated E2E test for a Smartout journey using Playwright MCP. Use when asked to "test journey", "run journey test", "kör test för journey", or similar.
---

# Journey Test Execution

## Trigger

User says: "test journey J-XXX", "kör test", "run test for journey", or similar.

## Process

### 1. Load journey definition

Query Supabase for the journey and its steps:

- Use Supabase MCP or direct query to get journey by code (e.g. J-001)
- Get all journey_steps ordered by step_order
- Verify status is ready_test or testing. If not, inform user and ask if they want to proceed anyway.

### 2. Check preconditions

Read journey.preconditions array. For each:

- Verify via Supabase query or Playwright that precondition is met
- If not met, attempt to seed the required data
- If cannot seed, report and abort

### 3. Execute steps via Playwright MCP

For each journey_step in order:

1. Navigate to step.screen URL (relative to localhost:3050)
2. Take accessibility snapshot (browser_snapshot)
3. Execute step.action by finding matching elements in the accessibility tree
4. Verify step.expects against the resulting accessibility tree
5. Log step result (pass/fail + details)

### 4. Final assertion

Check journey.test_assertion against the final page state.

### 5. Log results

POST to /api/platform-admin/journeys/{id}/run-test with:

- result: "pass" or "fail"
- duration_ms: elapsed time
- test_type: "automated"
- error_message: description if failed
- test_output: JSON with per-step results
- auto_transition: true

Use the Supabase auth token for the request.

### 6. Report

Tell the user:

- Which steps passed/failed
- Final result
- Whether journey status was transitioned
- Accessibility snapshot of failure point if applicable

## Rules

- Always use accessibility tree (snapshot mode), not vision mode
- Use data-testid attributes when available, fall back to role+name matching
- Timeout per step: 10 seconds
- Max retries per step: 2 (for flaky elements)
- If self-healing a selector: log what changed in test_output
- Never hardcode selectors — derive them from the accessibility tree each run
