# Task: Map Existing System Mechanics for Cascade Architecture

> **Type:** Claude Code deep-dive — read everything, report everything
> **Created:** 2026-03-20
> **Context:** We have an ADR draft (`docs/decisions/ADR-DRAFT-core-hierarchy-cascade.md`) that proposes a new `department_schedule` table, cascade Edge Functions, and structural changes to existing tables. Before we build, we need to understand every existing mechanic that we'll wire into.
> **Read first:** `CLAUDE.md` → `docs/STATE.md` → `docs/decisions/ADR-DRAFT-core-hierarchy-cascade.md`

---

## YOUR MISSION

We're about to redesign how operating hours flow through the entire system. The ADR draft proposes changes to ~8 existing tables and creation of ~3 new components. Before we write a single migration, we need a complete map of every mechanic already in place that we'll either reuse, extend, or replace.

**You are not building anything. You are mapping the machine.**

---

## PART 1: The Push Notification Pattern

The system already has cascade behavior for shifts via `dispatch_push_notification`. We want to reuse this exact pattern for operating hours cascade.

### Q1: Read the full push dispatch system

```
Read: supabase/migrations/ — find the migration that creates dispatch_push_notification() and all trg_push_* triggers.

Report:
1. The complete dispatch_push_notification() function signature and body
2. Every trigger that calls it (shift_published, shift_updated, task_assigned, deviation_reported, chat_message, join_request)
3. For each trigger: what table, what condition, what payload
4. How does the Edge Function push-dispatch work? Read supabase/functions/push-dispatch/ if it exists
5. What's the auth pattern? (bearer token via current_setting)

This is the TEMPLATE for cascade notifications. We need to know it perfectly.
```

---

## PART 2: The Engine Dispatch System

The engine-dispatch Edge Function is the workflow brain. The cascade will emit events through it.

### Q2: Read engine-dispatch completely

```
Read: supabase/functions/engine-dispatch/index.ts — the ENTIRE file.

Report:
1. Every action_type handler that exists (list them all with what they do)
2. The upsert_session handler specifically — full code
3. How does it receive events? (HTTP? Supabase trigger? Both?)
4. How does it match triggers? (engine_trigger table lookup logic)
5. How does it create engine_state instances?
6. What's the error handling pattern?
7. How big is this file? (line count)
```

### Q3: The emit() → engine-dispatch flow

```
Read: packages/telemetry/src/providers/engine-event.ts
Read: packages/telemetry/src/emit.ts
Read: packages/telemetry/src/registry.ts

Report:
1. How does a frontend action become an engine_event?
2. The complete flow: UI mutation → emit() → provider → Edge Function → engine_event table → trigger match
3. What events are registered? (full list from registry.ts)
4. Which events route to engine_event destination?
5. How does the client relay work? (/api/engine-dispatch or /api/telemetry?)
```

---

## PART 3: Session Generation — The Current Flow

### Q4: How department_session gets created today

```
STATE.md says: "engine-dispatch has upsert_session handler that creates department_sessions from shift events"

Read the upsert_session handler code (from Q2).
Then search for EVERY place that references department_session:

1. What creates a department_session row? (handler? trigger? manual?)
2. What fields are set at creation time?
3. Is there a nightly job or cron that pre-generates sessions?
4. What triggers the session status transitions? (upcoming→active→pending_signoff→closed)
5. Is there any code that reads operating_hours when creating a session?
6. grep for "department_session" across the entire codebase — every file that touches it
```

### Q5: How session_hooks fire

```
Read: supabase/migrations/20260412100300_session_infrastructure.sql — full file

Then search for how hooks are activated:
1. Is there a cron/scheduled function that checks "is it time for this hook to fire"?
2. Does fire-delayed-triggers handle hook firing? Read that Edge Function.
3. Are hooks seeded per department? Search for INSERT INTO session_hook.
4. How does a hook become a session_task? What's the materialization code?
5. Does the session_hook_dispatcher engine process actually run? Or is it just seeded?
```

### Q6: The fire-delayed-triggers Edge Function

```
Read: supabase/functions/fire-delayed-triggers/index.ts — full file

This is the timer system. Report:
1. What does it check?
2. How often is it called? (cron schedule?)
3. Does it handle session hooks, or only engine_delayed_trigger?
4. Could this be extended to fire session hooks at calculated times?
```

---

## PART 4: The Schedule System Mechanics

### Q7: How shifts are created from templates

```
Read: apps/web/src/app/dashboard/schedule/_hooks/use-templates.ts — full file

Report:
1. Every exported function/hook
2. How does "load template" work? (what's the mutation?)
3. Does it create schedule_shift rows from schedule_template_shift rows?
4. What data gets copied from template to shift?
5. Is template loading a one-shot copy or an ongoing link?
```

### Q8: How shifts are published

```
Search for the shift publish mechanism:
1. What sets is_published = true on schedule_shift?
2. What events fire on publish? (emit() calls?)
3. Does publishing trigger session creation?
4. Does publishing trigger any cascade?
5. Read the trg_push_shift_published trigger — what exactly fires?
```

### Q9: The schedule page view system

```
Read: apps/web/src/app/dashboard/schedule/page.tsx

Report:
1. What view modes exist? (tabs, toggle, URL params?)
2. How does view switching work?
3. What data does each view load?
4. Is there a "template" or "roster" or "vaktlista" view? If not, where would it plug in?
5. What components render the schedule grid?
```

### Q10: The employee roster system

```
Read: apps/web/src/app/dashboard/schedule/_hooks/use-employee-roster.ts — full file

Report:
1. What's the roster table schema? (from the migration)
2. What CRUD operations exist?
3. What does useAutoFillShifts do? (full logic)
4. Is there any UI component that uses these hooks? Or are they orphaned?
5. How does roster relate to template shifts?
```

---

## PART 5: The Governance → Operations Chain

### Q11: Policy → Protocol → Procedure — the actual scoping

```
Read migration 00003 (governance tables) for the complete schemas of:
- policy (especially policy_scope + scope_ref_id)
- protocol
- procedure
- routine

Then answer:
1. When a Policy has scope='department' and scope_ref_id=<kitchen_id>, how does code FIND all procedures for that department?
2. Is there a query anywhere that resolves "procedures for department X"?
3. Read apps/web/src/app/dashboard/governance/ — how does the GovernanceOverview display scoped procedures?
4. Is Policy scope actually USED for operational routing? Or only for training/readiness?
```

### Q12: Session hook → procedure connection

```
session_hook has linked_procedure_id and linked_routine_id.

Search for:
1. Where are session_hooks configured? (UI component? Seed data? Both?)
2. When a hook fires, how does it create a session_task from the linked procedure?
3. Does the session_task get procedure steps? Or just the procedure as a whole?
4. Is this chain actually working end-to-end? Or broken at some point?
```

---

## PART 6: The Activity Trail & Audit Pattern

### Q13: How activity_trail works

```
Read: packages/telemetry/src/providers/activity-trail.ts
Read: migration 00005 (activity_trail table)

Report:
1. What's the activity_trail schema?
2. What data gets logged per event?
3. Does it capture before/after state? Or just the event?
4. Is it used by any UI component? (audit log view?)
5. For cascade: can we extend it to log "before: close_time=22:00, after: close_time=18:00"?
```

---

## PART 7: The Season System

### Q14: How seasons affect the system today

```
Search for every query that filters by season_id:
1. Which tables actually have season_id columns?
2. Which frontend hooks pass season as a filter?
3. Is there an "active season" concept in the UI? How is it determined?
4. Read apps/web/src/app/dashboard/season/ — what does the season UI do?
5. How would department_schedule (with season_id FK) plug into the existing season flow?
```

### Q15: The season budget → hour factor → staffing chain

```
Read: supabase/migrations/20260306100000 — season_budget, day_factor, hour_factor tables

These tables need operating hours to calculate staffing needs.
1. Does any code currently read operating hours to compute staffing?
2. Is there a calculation engine (Edge Function or utility) that combines budget + hours + factors?
3. Read apps/web/src/app/dashboard/season/ — does the budget UI reference operating hours?
4. Read packages or lib for season-calculations.ts or similar
```

---

## PART 8: The Onboarding → Structure Creation Flow

### Q16: What happens during workspace setup

```
Read: apps/web/src/components/dashboard/WorkspaceSetupWizard.tsx (or wherever the wizard lives)
Also read: supabase/functions/finalize-workspace/ or finalize-onboarding/ (whichever exists)

Report:
1. What steps does the wizard have?
2. Which steps create departments? locations? teams? positions?
3. Are operating hours set during the wizard? If so, WHERE are they stored?
4. Is there a step that links departments to locations?
5. What RPC or Edge Function persists the wizard state to the database?
```

### Q17: Industry intelligence → structure suggestion

```
Read: apps/web/src/lib/industry/packages/hospitality.ts
Read: apps/web/src/lib/industry/use-industry-package.ts

Report:
1. What does the hospitality package suggest for departments, locations, positions?
2. Does it suggest operating hours? (the investigation found hardcoded hours)
3. How is industry detection triggered? (NACE code? manual selection?)
4. Is the package ADVISORY (just suggests) or IMPERATIVE (creates things)?
5. Could we extend it to suggest department_schedule records?
```

---

## PART 9: Existing Realtime Subscriptions

### Q18: What tables have Realtime enabled?

```
Search for Realtime subscriptions in the frontend:
1. grep -r "supabase.*channel\|\.on('postgres_changes'" in apps/web/
2. Which tables are subscribed to?
3. How are changes handled in the UI? (optimistic update? refetch? merge?)

For cascade: when department_schedule changes, should the schedule view auto-update via Realtime?
Report: which schedule-related tables already have Realtime, and how?
```

---

## DELIVERABLE

```markdown
# Mechanics Map: Cascade Architecture Foundation

## Date: [date]

## 1. Push Notification Pattern

[dispatch_push_notification signature, every trigger, auth pattern]
[Assessment: can we reuse this for cascade notifications? What needs to change?]

## 2. Engine Dispatch System

[Every action handler, event flow, trigger matching]
[Assessment: what new handlers do we need for cascade?]

## 3. Session Generation Flow

[How sessions are created, what triggers status transitions, where time comes from]
[Assessment: where does department_schedule plug in?]

## 4. Hook Firing Mechanics

[How hooks calculate fire time, how they create tasks, what's working vs broken]
[Assessment: what needs to change for hooks to use planned_open/planned_close?]

## 5. Schedule Template → Shift Flow

[How templates become shifts, what data transfers, publish mechanics]
[Assessment: what changes for anchored shifts (is_opening/is_closing)?]

## 6. Governance → Operations Chain

[Policy scoping, procedure resolution, hook→procedure→task materialization]
[Assessment: is the chain working? What's broken?]

## 7. Activity Trail

[Schema, what's logged, before/after capability]
[Assessment: can it support cascade audit logging?]

## 8. Season Integration Points

[What uses season_id today, active season resolution, budget calculations]
[Assessment: how does department_schedule with season_id fit?]

## 9. Onboarding Flow

[Wizard steps, entity creation order, industry intelligence integration]
[Assessment: where does department_schedule setup fit in the wizard?]

## 10. Realtime Subscriptions

[What tables, what handlers, schedule-specific subscriptions]
[Assessment: should department_schedule changes trigger Realtime updates?]

## 11. CRITICAL: Chain Breaks

[Ordered list of where existing chains are broken or incomplete]
[For each break: what exists on each side, what's missing in the middle]

## 12. CRITICAL: Reusable Patterns

[Patterns that already work and should be replicated for cascade:

- Push notification dispatch pattern
- Engine event emit pattern
- Realtime subscription pattern
- RLS policy pattern (JWT + API key dual auth)]
```

**Rules:**

- Read actual code. Every function, every handler, every trigger.
- Report line counts for large files so we know the scope.
- When you find a pattern, show the actual code (abbreviated if long, but real).
- When you find a break in a chain, describe exactly what's on each side.
- Don't propose solutions — just map what exists. The ADR draft already has the design.
