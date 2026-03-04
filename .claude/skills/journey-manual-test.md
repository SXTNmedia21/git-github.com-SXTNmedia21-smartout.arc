---
name: journey-manual-test
description: Guide a manual test for a Smartout journey. Use when asked to "manuellt test", "guided test", "manual test for journey", "validera journey", or similar.
---

# Manual Journey Test Guide

## Trigger

User says: "manuellt test J-XXX", "guide me through testing", "validera journey", or similar.

## Process

### 1. Load journey definition

Query Supabase for the journey and its steps:

- Use Supabase MCP or direct query to get journey by code (e.g. J-001)
- Get all journey_steps ordered by step_order
- Verify status is ready_validation. If not, inform user (automated test should pass first).

### 2. Present overview

Show the user:

- Journey title and code
- Number of steps
- Preconditions (what must be true before starting)
- Expected outcome on success

### 3. Guide step by step

For EACH journey_step, present ONE step at a time using this format:

**Steg {N}/{total}: {step.title}**

Gå till: {step.screen}
Gör: {step.action}
Förväntat resultat: {step.expects}

Stämmer det? (ja/nej/kommentar)

WAIT for user response before proceeding to the next step.

### 4. Record results

After each step, record:

- step number
- result: "pass" or "fail"
- note: user's comment (if any)

### 5. Present summary

After all steps, show:

**Resultat: {X}/{total} steg godkända**

If any failed, list them:

- Steg {N}: {note}

Ask: "Vill du godkänna denna journey som implemented?"

### 6. Log and transition

If user approves, POST to /api/platform-admin/journeys/{id}/run-test with:

- result: "pass" (if all steps passed) or "fail"
- test_type: "manual"
- test_output: JSON with per-step results and notes
- auto_transition: true

Use the Supabase auth token for the request.

If user rejects or steps failed, POST with result: "fail" and include failure details.

## Rules

- ONE step at a time. Never dump all steps at once.
- Wait for explicit user confirmation per step.
- Use Swedish for instructions (match journey language).
- Include the URL to navigate to for each step.
- If step fails, ask for details — what did they see instead?
- The manual test checks UX, visual correctness, and business logic — things automation cannot verify.
- Only Pontus (godmode user) can approve manual tests.
