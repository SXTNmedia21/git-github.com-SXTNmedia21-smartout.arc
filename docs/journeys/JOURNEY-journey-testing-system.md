---
title: "User Journeys — Journey Testing System"
status: done
updated: 2026-03-03
created: 2026-03-03
module: journeys
tags: [journey, testing, playwright, automation, quality, e2e, manual-testing, voice, posthog]
---

# User Journeys — Journey Testing System

The Journey Testing System (Phase 1) provides automated E2E testing via Playwright MCP and manual guided testing via agent-directed chat. All journeys gate on two test types: **automated** (for functional correctness) and **manual** (for UX validation). Status transitions are triggered automatically when tests pass.

---

## Journey 1: Admin Triggers Automated Test Run

**Role:** Platform Admin
**Module:** Journey (Testing System)
**Trigger:** Admin clicks "Run E2E Test" in journey portal

### Precondition

- Admin has godmode enabled (`user_identity.is_godmode = true`)
- Journey exists in status `ready_test` or `testing`
- Playwright MCP server is configured in `.claude/settings.json`
- Test environment is available (localhost or CI)

### Steps

1. Admin navigates to `/platform-admin/journeys/{journey-id}`
   → System loads journey detail page with tabs: Overview, Steps, Output, E2E Test
   → Admin sees "E2E Test" tab with "Run E2E Test" button

2. Admin clicks "Run E2E Test"
   → System disables button, shows "Running..." spinner
   → Background: API triggers Claude Code agent via journey-test skill

3. Agent reads journey definition from Supabase
   → Fetches journey + all journey_steps ordered by step_order
   → Verifies preconditions exist and reads test_assertion
   → Agent confirms all required data available

4. Agent seeds test data via Supabase
   → Creates test workspace + company + test profile
   → Sets up any backend state needed for journey (e.g., schedules, protocols)
   → Verifies seed completed before proceeding

5. Agent opens browser via Playwright MCP and navigates to journey start
   → Navigates to `localhost:3050` + `journey.preconditions[0].screen` (e.g., `/onboarding`)
   → Takes accessibility snapshot
   → Verifies page loaded and matches expected initial state

6. Agent executes first journey_step
   → Reads `journey_step.action` (e.g., "Fill company name field with 'Test Co'")
   → Uses Playwright MCP to find matching element in accessibility tree
   → Performs action (type, click, select, etc.)
   → Waits for DOM settle (500ms default)
   → Takes accessibility snapshot after action

7. Agent verifies first step expectations
   → Compares resulting accessibility tree against `journey_step.expects` (e.g., "Company name field shows 'Test Co'")
   → Logs step result: pass or fail with error details
   → If fail + self-healing enabled: attempts to find alternative selector and retry
   → Proceeds to next step on pass

8. Agent repeats steps 6–7 for remaining journey_steps
   → Each step follows same execute → verify → log pattern
   → If ANY step fails and cannot self-heal: marks test as failed, captures error snapshot
   → Continues through all steps even if earlier steps failed (full coverage)

9. Agent verifies final assertion
   → Checks `journey.test_assertion` against current page state
   → Example: "User sees dashboard with empty state and 'Create Protocol' button"
   → Verifies via accessibility tree matching

10. Agent logs test run results to API
    → POST to `/api/platform-admin/journeys/{id}/run-test` with:

    ```json
    {
      "result": "pass" | "fail",
      "test_type": "automated",
      "duration_ms": 3500,
      "error_message": null or "<step 5 failed: element not found>",
      "test_output": {
        "steps": [
          {"step": 1, "result": "pass", "action_taken": "Filled name field"},
          {"step": 2, "result": "pass", "action_taken": "Selected industry dropdown"},
          {"step": 3, "result": "fail", "error": "Button 'Next' not found in accessibility tree"}
        ],
        "final_assertion": "pass",
        "total_duration_ms": 3500,
        "self_healing_applied": false
      },
      "auto_transition": true
    }
    ```

11. System updates journey status based on test result
    → If result = "pass" AND auto_transition = true:
    - If current status = `ready_test` → transition to `testing`
    - If current status = `testing` → transition to `ready_validation`
      → If result = "fail": status remains unchanged
      → Inserts journey_event with event_type = "test_run" and "status_change" (if applicable)

12. Portal UI updates with test result
    → Admin sees "Test completed: PASS" banner (green)
    → Test history shows new entry with timestamp, duration, result badge
    → Journey status updated in detail header (e.g., "testing" shown)
    → "Run E2E Test" button re-enabled for re-runs

### Postcondition

- Test run logged in `journey_test_run` table with type = "automated"
- Journey status transitioned (if test passed)
- Admin can view full test history with all results and durations
- Agent browser closed, test environment cleaned up

### Error Paths

**Error Path A: Precondition Not Met**

- Agent detects precondition missing (e.g., required table empty)
- → Reports to user: "Precondition failed: No test profile available"
- → Does not attempt test
- → Status remains `ready_test`

**Error Path B: Test Fails at Step 3**

- Action at step 3 succeeds but expectation fails
- → Agent logs step 3 result = "fail"
- → Continues through remaining steps (does not exit early)
- → Final test result = "fail"
- → POST to API with step-level error details
- → Status remains unchanged (no transition)
- → Portal shows failed step in error details

**Error Path C: Self-Healing Fixes Selector**

- Step 2 action fails: element selector changed in app
- → Agent analyzes accessibility tree semantically
- → Finds element by role + text + other attributes
- → Updates test logic and retries action
- → Action now succeeds
- → Logs in test_output: `"self_healing_applied": true, "selector_healed": "step-2-next-button"`
- → Test continues normally

**Error Path D: Flaky Timeout**

- Step 4 action times out (element takes >10s to appear)
- → Agent retries up to 2 times
- → If still times out: logs fail with "Timeout at step 4"
- → Does not block test, logs as step failure

---

## Journey 2: Admin Initiates Manual Test Walkthrough

**Role:** Platform Admin
**Module:** Journey (Testing System)
**Trigger:** Admin clicks "Start Manual Test" in journey portal

### Precondition

- Admin has godmode enabled
- Journey exists in status `ready_validation` (automated test already passed)
- journey-manual-test skill is available
- Supabase connection active for reading journey definition

### Steps

1. Admin clicks "Start Manual Test" button in E2E Test tab
   → System opens new browser tab pointing to journey start screen
   → Dashboard shows "Manual test in progress" indicator
   → Journey portal remains open for reference in original tab

2. System initiates agent-guided manual test in chat interface
   → Agent loads journey definition from Supabase (code, title, steps)
   → Agent displays journey overview in chat:

   ```
   Journey: Onboarding New Employee (ONB-001)
   Total steps: 7
   Expected outcome: Employee ready for first shift
   Preconditions: Must be platform admin, test data seeded
   ```

   → Agent waits for "Ready?" confirmation from admin

3. Admin confirms readiness
   → Responds to agent: "Ready" or "Ja" or similar
   → Agent begins step-by-step guide

4. Agent presents Step 1 of 7

   ```
   Step 1 of 7: Enter Company Details

   Navigate to: /onboarding/step-1
   Action: Fill in company name "Test Company" and select industry "Food Service"
   Expected result: Form shows both fields filled, "Next" button enabled

   Did you complete this step? (yes/no/other)
   ```

   → Admin reads instruction and navigates to the URL
   → Admin performs the action in the browser
   → Admin responds to agent confirmation request

5. Admin responds: "Yes, both fields are filled"
   → Agent records: step 1, result = "pass", note = null
   → Agent moves to Step 2

6. Agent presents Step 2 of 7

   ```
   Step 2 of 7: Select Team Assignment

   Navigate to: /onboarding/step-2
   Action: Click "Sales Team" and then click "Next"
   Expected result: Page advances to step 3, URL changes to /onboarding/step-3

   Did you see the team selected and page advanced? (yes/no/comment)
   ```

   → Admin performs actions
   → Admin confirms success

7. Agent repeats Step presentation for steps 3–6
   → Each step follows same format: navigate → act → verify → confirm
   → Agent accepts admin responses (yes/no/comment)
   → Stores each result in memory for final summary

8. Admin responds to Step 6 with an issue
   → Admin: "No, the 'Confirm' button is disabled. Industry dropdown is empty."
   → Agent records: step 6, result = "fail", note = "Industry dropdown empty after selection"
   → Agent asks: "Did you see an error message? Can you describe what you selected?"

9. Admin clarifies issue
   → Admin: "I selected 'Retail' from the dropdown but it disappeared. No error message."
   → Agent updates note with this information
   → Agent proceeds to Step 7

10. Agent presents final Step 7

    ```
    Step 7 of 7: Review and Confirm

    Navigate to: /onboarding/summary
    Action: Review all information and click "Confirm and Create Account"
    Expected result: Page shows success message, redirects to dashboard

    Did you complete this step? (yes/no/comment)
    ```

11. Admin confirms Step 7 success
    → Agent records: step 7, result = "pass", note = null

12. Agent presents test summary

    ```
    Test Complete: 6 of 7 steps passed

    Failed steps:
    - Step 6: Industry dropdown empty after selection

    Overall result: FAIL (due to step 6 failure)

    Do you want to approve this journey as "implemented" anyway? (yes/no)
    This would log the failure but mark the journey ready for release.
    ```

13. Admin responds: "No, we need to fix the dropdown issue"
    → Agent prepares to log test as failed
    → Asks: "Should I report this as a blocker for the journey?"

14. Admin confirms: "Yes, report it as blocker"
    → Agent logs test result to API with failure details

15. Agent logs manual test to API
    → POST to `/api/platform-admin/journeys/{id}/run-test` with:

    ```json
    {
      "result": "fail",
      "test_type": "manual",
      "test_output": {
        "type": "manual",
        "guided_by": "agent_chat",
        "steps": [
          { "step": 1, "result": "pass", "note": null },
          { "step": 2, "result": "pass", "note": null },
          { "step": 3, "result": "pass", "note": null },
          { "step": 4, "result": "pass", "note": null },
          { "step": 5, "result": "pass", "note": null },
          { "step": 6, "result": "fail", "note": "Industry dropdown empty after selection" },
          { "step": 7, "result": "pass", "note": null }
        ]
      },
      "auto_transition": false
    }
    ```

16. System creates journey_event for manual test run
    → Type: "test_run", metadata includes step details
    → Status remains `ready_validation` (test failed, no transition)

17. Portal displays test result
    → Manual test tab shows: "Manual test FAILED at step 6"
    → Admin can expand to see full step-by-step results
    → "Industry dropdown empty after selection" displayed as failure reason

### Postcondition

- Manual test logged in `journey_test_run` with type = "manual"
- Step-level results captured in test_output JSONB
- Journey status unchanged if test failed (remains `ready_validation`)
- Admin can use failure details to prioritize fixes
- Test run available in history for future reference

### Error Paths

**Error Path A: Admin Cannot Complete Step**

- Step 3: Admin cannot find the expected UI element
- → Admin: "I don't see the 'Continue' button anywhere"
- → Agent: "What do you see on the page? Can you describe the content?"
- → Admin explains what they see instead
- → Agent records: step 3, result = "fail", note = "UI element missing or moved"

**Error Path B: Unexpected Navigation**

- Step 2: Admin performs action but page does not advance as expected
- → Expected: Navigate to `/onboarding/step-3`
- → Actual: Page shows error message instead
- → Admin: "It says 'Error: Invalid team selection'"
- → Agent records: step 2, result = "fail", note = "Error: Invalid team selection"

**Error Path C: Admin Stops Mid-Test**

- Step 4: Admin needs to leave
- → Admin: "I need to pause this. Can we continue later?"
- → Agent: "Of course. I've saved progress. We completed 3 of 7 steps."
- → Agent logs partial test as incomplete
- → Status remains unchanged

---

## Journey 3: System Auto-Transitions Journey Status Based on Test Results

**Role:** System (Automatic)
**Module:** Journey (Testing System)
**Trigger:** Test run API endpoint receives successful result

### Precondition

- Test run API (`POST /api/platform-admin/journeys/[id]/run-test`) receives valid request
- `auto_transition = true` in request body
- Journey exists in one of: `ready_test`, `testing`, or `ready_validation`
- Test result = "pass"

### Steps

1. Agent completes automated test with all steps passing
   → POST `/api/platform-admin/journeys/{id}/run-test` with result = "pass"
   → Payload includes `test_type = "automated"` and `auto_transition = true`

2. API endpoint validates request
   → Verifies godmode authorization
   → Validates request body (Zod schema)
   → Fetches journey from Supabase

3. API inserts test run record
   → Creates journey_test_run entry with:
   - journey_id, workspace_id, result = "pass"
   - test_type = "automated", duration_ms, test_output
   - triggered_by = current user, created_at = now

4. API updates journey.last_test_result and last_test_run_at
   → Sets last_test_result = "pass"
   → Sets last_test_run_at = current timestamp

5. API evaluates status transition rules
   → Reads current journey.status
   → For automated tests, checks transition map:
   - If status = `ready_test` → next = `testing`
   - If status = `testing` → next = `ready_validation`
   - If status = `ready_validation` → no auto-transition (manual test gate)

6. API transitions journey status
   → Current status = `ready_test`
   → Transitions to: `testing`
   → UPDATE journey SET status = 'testing' WHERE journey_id = {id}

7. API creates journey_event for status change
   → Inserts journey_event with:
   - event_type = "status_change"
   - from_status = "ready_test", to_status = "testing"
   - metadata includes test_run_id
   - actor_id = current user

8. API returns success response

   ```json
   {
     "test_run": {...},
     "transitioned": true,
     "journey_status": "testing"
   }
   ```

9. Portal UI auto-updates
   → Refreshes journey detail page
   → Header now shows status = "testing"
   → Timeline shows: "Status changed: ready_test → testing (automated test passed)"

### Postcondition

- Journey advanced to `testing` status
- Admin can now initiate manual test (which requires `ready_validation`)
- Next auto-pass (manual test) will transition `testing` → `ready_validation`
- Full transition history in journey_event table
- last_test_result and last_test_run_at updated

### Error Paths

**Error Path A: Test Fails**

- Agent completes test with result = "fail"
- → API inserts test_run with result = "fail"
- → Transition evaluation finds no valid "fail" transition
- → Status remains unchanged (`ready_test`)
- → journey_event created with event_type = "test_run" (not status_change)

**Error Path B: auto_transition = false**

- Agent passes test but explicitly sets `auto_transition: false`
- → API inserts test_run with result = "pass"
- → Transition logic skipped
- → Status remains unchanged
- → Admin must manually transition via UI button

**Error Path C: Already in Final Status**

- Journey status = `active`
- → Test run succeeds
- → Transition map has no entry for `active`
- → Status remains `active` (no auto-transition to undefined state)
- → Only event_type = "test_run" created, not status_change

---

## Journey 4: Developer Reviews Test Run History and Failures

**Role:** QA/Developer
**Module:** Journey (Testing System)
**Trigger:** Developer clicks journey link or navigates to `/platform-admin/journeys`

### Precondition

- Developer has platform access (godmode not strictly required for read-only views, but API requires it)
- Journey exists and has at least 1 test run in history
- Test history API endpoint is accessible

### Steps

1. Developer navigates to `/platform-admin/journeys`
   → System lists all journeys with latest test status badges
   → Columns: Code, Title, Status, Last Test Result, Last Test Run
   → Developer sees: "ONB-001 | Onboarding | testing | FAIL | 2h ago"

2. Developer clicks journey row to open detail view
   → System loads `/platform-admin/journeys/ONB-001`
   → Shows journey overview, steps, outputs, and E2E Test tabs

3. Developer clicks E2E Test tab
   → System loads test history for this journey
   → Displays sorted by most recent (descending by created_at)
   → Test History shows last 20 runs by default:

   ```
   AUTOMATED TEST | FAIL | 5m ago | 3.2s | Error: Element not found at step 3
   AUTOMATED TEST | FAIL | 1h ago | 2.8s | Error: Timeout at step 5
   AUTOMATED TEST | PASS | 2h ago | 3.5s | All steps passed
   MANUAL TEST | PASS | 1d ago | - | 6/7 steps passed, 1 note
   ```

4. Developer clicks on failed automated test (5m ago)
   → System expands test result detail
   → Shows test_output JSON:

   ```json
   {
     "steps": [
       { "step": 1, "result": "pass", "action_taken": "Filled name" },
       { "step": 2, "result": "pass", "action_taken": "Selected team" },
       {
         "step": 3,
         "result": "fail",
         "error": "Element not found in accessibility tree",
         "expected_element": "Button[text='Next']",
         "snapshot_at_failure": "..."
       }
     ],
     "final_assertion": "not_evaluated",
     "total_duration_ms": 3200
   }
   ```

5. Developer reads error details
   → Step 3 failed: Button text changed from "Next" to "Continue"
   → Accessibility tree snapshot shows new button text
   → Developer realizes: UI was updated but test definition was not

6. Developer navigates to Steps tab
   → Reviews journey_step[2] (step 3 in 1-indexed):
   - Action: "Click button labeled 'Next'"
   - Expects: "Page navigates to /onboarding/step-4"
     → Realizes action is outdated: button is now "Continue"

7. Developer clicks "Edit Step"
   → Opens editor for journey_step[2]
   → Changes action to: "Click button labeled 'Continue'"
   → Saves change
   → System creates journey_event for step modification

8. Developer re-runs automated test
   → Clicks "Run E2E Test" button
   → System triggers agent to run test again
   → Agent uses updated step definition
   → Test passes this time

9. Developer checks test history again
   → New passing test at top of list
   → Previous failed tests still visible for audit trail

10. Developer filters test history by type
    → Option: "Show all" | "Automated only" | "Manual only"
    → Helps distinguish E2E results from manual UX validation

11. Developer exports test run history
    → Option: "Export as CSV" or "Export as JSON"
    → Useful for reporting to stakeholders
    → Shows trends: "10 automated runs in last week, 8 passed"

### Postcondition

- Developer understands why test failed (step definition mismatch)
- Step definition corrected to match current UI
- Test history provides clear audit trail
- Next test run will use corrected definition

### Error Paths

**Error Path A: Test Output Incomplete**

- Older test runs may lack detailed test_output (legacy format)
- → System displays: "Test ran but output was not captured"
- → Developer can only see: result, duration, error_message
- → Cannot drill into step-level details

**Error Path B: Element Not Found (Real Bug)**

- Step 3 fails: "Element not found"
- → Developer checks current UI: button is actually missing
- → This is a bug in the app, not a stale test
- → Developer creates Linear issue for bug fix
- → Marks journey as blocked_by this issue

**Error Path C: Flaky Test**

- Last 3 test runs: fail, pass, fail
- → Developer reviews all 3 test_outputs
- → Step 4 times out intermittently
- → Likely: slow endpoint or race condition
- → Developer investigates backend performance
- → May request extended timeout in test config

---

## Journey 5: Admin Promotes Journey from Draft to Active After Passing Tests

**Role:** Platform Admin
**Module:** Journey (Testing System)
**Trigger:** Admin clicks "Promote to Active" in journey detail

### Precondition

- Journey status = `implemented` (has passed both automated and manual tests)
- Admin has godmode enabled
- Journey has been through full test cycle:
  1. `ready_test` → `testing` (automated test passed)
  2. `testing` → `ready_validation` (automated test passed again)
  3. `ready_validation` → `implemented` (manual test passed)
- No blockers exist (or all blockers resolved)
- Documentation complete (doc_title, outcomes_success, etc. populated)

### Steps

1. Admin navigates to `/platform-admin/journeys`
   → Filters view to show journeys in status = `implemented`
   → Sees list of journeys ready for release

2. Admin clicks journey "ONB-001 | Onboarding"
   → System loads detail page
   → Header shows: Status = "implemented" with green checkmark
   → Shows test history with both automated and manual passes
   → Displays "Promote to Active" button

3. Admin reviews journey details before promotion
   → Reads: title, description, module, actor, platform
   → Verifies: all preconditions, outcomes, and test assertions populated
   → Reviews: last automated test result (pass), last manual test result (pass)
   → Checks: no blockers in blocked_by array

4. Admin clicks "Promote to Active"
   → System opens confirmation dialog:

   ```
   Promote ONB-001 to active?

   This will make the journey live and available to all workspaces.
   Last test: Automated PASS (2h ago) + Manual PASS (30m ago)
   Blockers: None

   Confirm?
   ```

5. Admin confirms promotion
   → Selects: "Yes, promote to active"
   → Optional: adds note "Released as part of Q1 content update"

6. System transitions journey status
   → UPDATE journey SET status = 'active', released_at = now()
   → Inserts journey_event:
   - event_type = "status_change"
   - from_status = "implemented", to_status = "active"
   - metadata includes promotion note

7. System publishes journey to all workspaces
   → Journey becomes visible in public journey catalogs
   → Available for linking from training protocols, routines, etc.
   → Creates journey_event with event_type = "released"

8. Portal updates confirmation
   → Shows green banner: "Journey promoted to active"
   → Status header now shows: "active" with publication icon
   → Displays: "Released at: 2026-03-03 14:30:22 UTC"

9. Admin can opt to notify team
   → Option: "Notify team about new journey"
   → Triggers email/Slack notification
   → Content: "New journey [ONB-001] is now active and ready for use"

10. Journey is now live
    → Appears in protocol assignment UI
    → Can be assigned to employees
    → Test history locked for edit (can only view)
    → New test runs still allowed for monitoring

### Postcondition

- Journey status = `active`
- Journey released_at timestamp recorded
- Full test history preserved (for audit)
- Journey available in production
- Admin can create new versions if updates needed

### Error Paths

**Error Path A: Blockers Still Exist**

- Admin clicks "Promote to Active"
- → System detects: blocked_by array contains unresolved issues
- → Shows warning: "Cannot promote: 2 blockers must be resolved first"
- → Lists blockers with links to Linear issues
- → Admin must resolve blockers before promotion possible

**Error Path B: No Test History**

- Journey created but never tested
- → Admin clicks "Promote to Active"
- → System shows warning: "This journey has never been tested. Run tests before promoting?"
- → Admin must either:
  - Cancel and run tests first
  - Or override with explicit confirmation + reason

**Error Path C: Manual Test Failed**

- Journey in `ready_validation` (automated passed, manual in progress)
- → Admin attempts promotion
- → System blocks: "Journey is not fully tested. Manual test must pass before promotion."
- → Admin must wait for manual test completion

**Error Path D: Journey Already Active**

- Admin navigates to an already-active journey
- → "Promote to Active" button is disabled (grayed out)
- → Tooltip: "Journey is already active. To make changes, create a new version."

---

## Cross-Journey Interactions

### Manual Test Can Proceed Only After Automated Pass

```
ready_test
   ↓ (automated test passes)
testing
   ↓ (automated test passes again)
ready_validation  ← Manual test only available from here
   ↓ (manual test passes)
implemented
   ↓ (promotion)
active
```

Manual test skill requires status = `ready_validation`. Attempting to run manual test from `ready_test` will be rejected with: "Automated test must pass first."

### Test History Spans Both Types

The test history tab shows BOTH automated and manual results:

```
MANUAL TEST | PASS | 30m ago | - | 7/7 steps
AUTOMATED TEST | PASS | 2h ago | 3.5s | All steps
AUTOMATED TEST | FAIL | 3h ago | 2.8s | Step 3 timeout
```

This allows admins to see full quality trail from both gates.

### Failed Automated Test Blocks Manual Test

If automated test fails, journey status stays at `testing` (or `ready_test`). Manual test cannot be initiated because journey is not in `ready_validation`. This ensures every journey is functionally correct before UX validation.

### Status Transitions Are Unidirectional (No Rollback)

Once promoted to `active`, journey cannot automatically revert to earlier statuses. If bugs found:

1. Create a new journey version (copy)
2. Fix and test the new version
3. Promote new version
4. Deprecate old version

This maintains immutability of released content.

---

## Summary

The Journey Testing System provides five core user journeys:

1. **Admin Runs Automated Test** — E2E validation via Playwright, auto-transitions on pass
2. **Admin Runs Manual Test** — Step-by-step guided walkthrough, captures UX feedback
3. **System Auto-Transitions** — Automatic status progression `ready_test` → `testing` → `ready_validation` → `implemented` → `active`
4. **Developer Reviews Failures** — Detailed step-level debugging to identify root causes
5. **Admin Promotes to Active** — Final gate before journey goes live to all workspaces

All journeys are gated by tests. No journey reaches `active` without passing both automated and manual validation.
