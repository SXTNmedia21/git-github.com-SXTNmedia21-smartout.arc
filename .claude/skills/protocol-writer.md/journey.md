---
name: journey
description: Use when building a journey deep spec for a Smartout user workflow. Triggers on "build journey", "journey for X", "deep spec", "define journey steps", or after completing a /roadmap. Requires a Roadmap artifact to exist first.
---

# Journey — Deep Spec Builder

## Overview

Create the Journey artifact — the executable specification of a user workflow. Every button, every event, every notification, every database write, every screen state. This IS Smartout.

Produces output in Deep Spec format (TypeScript-flavored markdown tables) following the gold standard in `docs/modules/journey/SMARTOUT_JOURNEY_DEEP_SPEC.md`.

## When to Use

- After `/roadmap` has been completed for this journey package
- When defining the step-by-step user experience
- When upgrading an existing natural-language journey to deep spec format
- NOT for journeys without a Roadmap (run `/roadmap` first)

## Prerequisite Check

Before anything else:

1. Check that `docs/Roadmaps/{slug}/Roadmap.md` exists. If not: "Run `/roadmap` first."
2. Read the Roadmap to get: Package Identity, Actor, Platform, Scope, Success Criteria, Related Journeys.

## Input Sources

Read ALL of these before generating:

| Source               | Path                                                                                                               | What you get                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Roadmap              | `docs/Roadmaps/{slug}/Roadmap.md`                                                                                  | Scope, actor, intent, success criteria               |
| Journey Registry     | `docs/modules/journey/SMARTOUT_JOURNEY_REGISTRY.md`                                                                | Related journeys, cross-links, module classification |
| Deep Spec Reference  | `docs/modules/journey/SMARTOUT_JOURNEY_DEEP_SPEC.md`                                                               | TypeScript interfaces, J-019 gold standard, format   |
| DB Schema            | `docs/reference/DATABASE.md` + `packages/supabase/src/database.types.ts`                                           | Tables, RLS policies, enums, indexes                 |
| Event Envelope       | `docs/engines/system-inteligence/08-event-envelope-spec.md`                                                        | Mandatory event fields, event families               |
| AI Council           | `docs/engines/industri-inteligence/hospitalety/01-ai-council/restaurant-council.md`                                | 7 personas to validate against                       |
| Default Policies     | `docs/engines/industri-inteligence/hospitalety/02-default-policies/restaurant-policy-catalog.md`                   | Policy gates per step                                |
| Role Capabilities    | `docs/engines/industri-inteligence/hospitalety/08-role-capability-profiles/restaurant-role-capability-baseline.md` | Precondition: which roles need readiness             |
| Niche Profiles       | `docs/engines/industri-inteligence/hospitalety/10-niche-profiles/`                                                 | Focus multipliers for this journey type              |
| Journey Template     | `docs/engines/industri-inteligence/hospitalety/03-templates/journey-template.md`                                   | Mandatory building blocks                            |
| Playwright Recording | User provides (optional)                                                                                           | Routes, selectors, actions from recorded UI flow     |

## Priority Tiers

Ask the user which depth tier to use:

| Tier            | When                   | Dimensions per step                                                                        |
| --------------- | ---------------------- | ------------------------------------------------------------------------------------------ |
| **P0 Full**     | Critical path journeys | All 10: action, ui, data, events, notifications, gamification, compliance, errors, expects |
| **P1 Medium**   | Important journeys     | 6: action, ui, data, events, errors, expects                                               |
| **P2 Skeleton** | Future/nice-to-have    | 3: action, data, expects                                                                   |

Default to the priority from the Roadmap (P0 roadmap = P0 depth), but the user can override depth tier independently. Ask if unsure.

**P2 optional sections:** At P2 depth, AI Council Validation, Niche Focus, Notifications, Gamification, Compliance, and Event Envelope Summary are all optional — skip or mark `N/A`.

## Confidence Assessment

| Signal                                             | Score |
| -------------------------------------------------- | ----- |
| Playwright recording provided                      | +3    |
| Similar journey deep spec exists (e.g., J-019)     | +2    |
| DB tables for this domain exist and are documented | +1    |
| Module doc (MODULE\_\*.md) covers this workflow    | +1    |
| User described the steps in detail                 | +1    |
| Total 5+ = HIGH, 3-4 = MEDIUM, 0-2 = LOW           |       |

**HIGH:** Generate complete deep spec draft for review.
**MEDIUM:** Generate skeleton with gaps marked `[TBD]`, ask about specific gaps.
**LOW:** Walk through step by step: "What does the user do first? What do they see?"

## Knowledge Gates

### Journey-Level Gates (must be known before generating ANY steps)

| #   | Gate                                | Source                  |
| --- | ----------------------------------- | ----------------------- |
| 1   | Trigger condition                   | Roadmap or user input   |
| 2   | Preconditions (DB state)            | Roadmap + DATABASE.md   |
| 3   | Related journeys with relation type | Registry                |
| 4   | Step count estimate                 | User or similar journey |
| 5   | Niche multipliers (if applicable)   | Niche profiles          |
| 6   | AI Council validation notes         | Council personas        |

### Per-Step Gates (P0 — all 10 required)

| #   | Dimension           | Key fields                                                                                        | Gate question if missing                                              |
| --- | ------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | **Action**          | description, type (tap/swipe/form_submit/navigate/drag/long_press/scan/voice/system_auto), target | "What does the user DO in this step?"                                 |
| 2   | **UI Elements**     | testId, type, label (Norwegian), variant, visible when, disabled when                             | "What buttons/inputs/cards does the user see?"                        |
| 3   | **Screen States**   | name, condition, display, illustration, CTA                                                       | "What states can this screen be in? (loading, empty, success, error)" |
| 4   | **Data Operations** | table, operation, fields, condition, RLS policy, index                                            | "What data is read/written/deleted?"                                  |
| 5   | **Events**          | emitted (name, payload, consumers), listened to, side effects                                     | "What system events does this step fire or react to?"                 |
| 6   | **Notifications**   | template, channels, recipient, title (NO), body (NO), deep link, priority                         | "Who gets notified and how?"                                          |
| 7   | **Gamification**    | base points, season multiplier, conditional bonuses, achievements, streaks                        | "Are points awarded? Any achievements or streaks?"                    |
| 8   | **Compliance**      | audit entries (type, actor, target, data, retention), legal checks                                | "What must be logged for audit? Any legal requirements?"              |
| 9   | **Errors**          | trigger, code, user message (NO), recovery, severity, notify admin                                | "What can go wrong? How does the user recover?"                       |
| 10  | **Expects**         | description, assertions (type, selector, expected, timeout)                                       | "How do we verify this step worked?"                                  |

For P1: gates 1-5, 9, 10 required. Gates 6-8 optional.
For P2: gates 1, 4, 10 required. All others optional.

## Playwright Recording Integration

If the user provides a Playwright codegen recording:

1. Parse the recording for routes visited, elements clicked, forms filled
2. Map each recorded action to a journey step
3. Extract selectors as candidate `testId` values
4. Use routes as `screen` values
5. Fill in Action, UI Elements, and Screen States from recording
6. Mark remaining dimensions as `[TBD — enrich from engine docs]`

This gives dimensions 1-3 of each step nearly for free.

## Output Format

Use this exact structure (following J-019 gold standard):

````markdown
---
title: "Journey: {Title}"
status: draft
updated: { YYYY-MM-DD }
created: { YYYY-MM-DD }
module: { module }
tags: [journey, deep-spec, { module }, { actor }]
---

# Journey: J-{NNN} — {Title}

## Package Identity

- Package ID: `JP-R{NNN}-{SLUG}`
- Roadmap ID: `R-{NNN}`
- Journey ID: `J-{NNN}`
- Mission ID: `M-{NNN}` (TBD)
- License ID: `L-{NNN}` (TBD)

Related package docs:

- [Roadmap](./Roadmap.md)
- [Mission](./Mission.md) (pending)
- [License](./License.md) (pending)

## Classification

| Field          | Value                               |
| -------------- | ----------------------------------- |
| **ID**         | `j-{nnn}`                           |
| **Title**      | {Title}                             |
| **Slug**       | `{slug}`                            |
| **Module**     | {module}                            |
| **Actor**      | {actor}                             |
| **Platform**   | {platform}                          |
| **Priority**   | {P0/P1/P2/P3}                       |
| **Depth Tier** | {P0 Full / P1 Medium / P2 Skeleton} |
| **Tags**       | {comma-separated}                   |

## Trigger

{What starts this journey — user action, system event, time trigger}

## Preconditions

| #   | Precondition | Validation        |
| --- | ------------ | ----------------- |
| 1   | {condition}  | {DB/system check} |

## Related Journeys

| Relation | Journey         | Why      |
| -------- | --------------- | -------- |
| Requires | J-{NNN} {title} | {reason} |
| Leads to | J-{NNN} {title} | {reason} |

## AI Council Validation

| Persona                | Applicable | Notes             |
| ---------------------- | :--------: | ----------------- |
| Multi-site Manager     |  {yes/no}  | {validation note} |
| Back-office Admin      |  {yes/no}  | {note}            |
| External Consultant    |  {yes/no}  | {note}            |
| Career Professional    |  {yes/no}  | {note}            |
| Fast-food Entry Worker |  {yes/no}  | {note}            |
| Low-literacy Worker    |  {yes/no}  | {note}            |
| Sommelier/Specialist   |  {yes/no}  | {note}            |

## Niche Focus

| Niche dimension | Multiplier | Effect                        |
| --------------- | :--------: | ----------------------------- |
| {dimension}     | {0.7-1.5}  | {how it affects this journey} |

---

## STEP {N}: {Step Title}

### Action

| Field       | Value                                                                   |
| ----------- | ----------------------------------------------------------------------- |
| Description | {what user does}                                                        |
| Type        | {tap/swipe/form_submit/navigate/drag/long_press/scan/voice/system_auto} |
| Target      | {element or system}                                                     |

### UI Elements

| testId | Type   | Label (NO) | Variant   | Visible When | Disabled When |
| ------ | ------ | ---------- | --------- | :----------: | :-----------: |
| `{id}` | {type} | "{norsk}"  | {variant} | {condition}  |  {condition}  |

### Screen States

| State     | Condition | Display          |
| --------- | --------- | ---------------- |
| `{state}` | {when}    | {what user sees} |

### Data Operations

**Reads:**
| Table | Operation | Fields | Condition | RLS Policy | Index |
|-------|-----------|--------|-----------|-----------|-------|

**Writes:**
| Table | Operation | Fields | Notes |
|-------|-----------|--------|-------|

**Realtime:**
| Channel | Event | Payload | Subscribers |
|---------|-------|---------|-------------|

### Events

**Emitted:**
| Event | Payload | Consumers |
|-------|---------|-----------|

**Listened to:**
| Event | Source | Action |
|-------|--------|--------|

**Side Effects:**
| # | Description | Trigger | Type | Async |
|---|-------------|---------|------|:-----:|

### Notifications (P0 only)

| Template | Channel | Recipient | Title (NO) | Body (NO) | Deep Link | Priority | Quiet Hours | Condition |
| -------- | ------- | --------- | ---------- | --------- | --------- | :------: | :---------: | --------- |

### Gamification (P0 only)

**Points:**
| Action | Base | Season Mult. | Category | Description |
|--------|:----:|:---:|----------|-------------|

**Conditional Bonuses:**
| Condition | Bonus | Label (NO) | Description |
|-----------|:-----:|-----------|-------------|

**Achievements:**
| ID | Name (NO) | Condition | Icon | Points | One-time |
|----|----------|-----------|------|:------:|:--------:|

**Streaks:**
| Streak | Action | Milestones |
|--------|--------|------------|

### Compliance & Audit (P0 only)

**Audit Trail:**
| Type | Actor | Target | Data | Retention |
|------|-------|--------|------|-----------|

**Compliance Checks:**
| Law/Policy | Check | Action | Severity |
|-----------|-------|--------|:--------:|

### Error Scenarios

| #   | Trigger | Code | User Message (NO) | Recovery | Severity | Notify Admin |
| --- | ------- | ---- | ----------------- | -------- | :------: | :----------: |

### Test Assertions

| Type | Selector | Expected | Timeout |
| ---- | -------- | -------- | :-----: |

---

{Repeat STEP sections for each step}

---

## Event Envelope Summary

All events in this journey follow `ENGINE_SYSTEM_EVENT_ENVELOPE`:

| Event Name | Family | Source Domain | Subject Kind |
| ---------- | ------ | ------------- | ------------ |

## Technical Links

| Link Type                  | References                               |
| -------------------------- | ---------------------------------------- |
| Events used                | {list}                                   |
| Hooks invoked              | start: {}, run: {}, verify: {}, stop: {} |
| Triggers listened to       | {list}                                   |
| Endpoints touched          | {list}                                   |
| Policy gates evaluated     | {list}                                   |
| Component templates        | {list}                                   |
| Role capabilities required | {list}                                   |

## Consolidated E2E Test (P0/P1 only)

Generate a single Playwright `test.describe` block that covers the happy path through all steps:

```typescript
import { test, expect } from "@playwright/test";

test.describe("J-{NNN}: {Title}", () => {
  test("happy path", async ({ page }) => {
    // Step 1: {Step Title}
    // ... assertions from Step 1 expects ...
    // Step N: {Step Title}
    // ... assertions from Step N expects ...
  });

  // One test per error scenario (P0 only)
  test("error: {error description}", async ({ page }) => {
    // ...
  });
});
```
````

```

## After Generation

1. Save to `docs/Roadmaps/{slug}/Journey.md`
2. Tell the user:
   - "Journey deep spec saved with {N} steps at {tier} depth."
   - "Dimensions marked [TBD] need enrichment."
   - "Next: run `/mission` to define agent behavior, or `/api-contract` for endpoints."
3. If any AI Council persona has blocking concerns, flag them prominently.

## Common Mistakes

- Generating without reading the Roadmap first — always check prerequisite
- Using English for user-facing labels — all UI labels and user messages must be Norwegian
- Skipping AI Council validation — every journey must be checked against all 7 personas
- Hardcoded selectors instead of data-testid — always use `[data-testid="..."]` pattern
- Missing event envelope compliance — every event must follow canonical format
- Forgetting RLS policy in data operations — always specify which policy applies
- Not checking DATABASE.md for existing tables/enums — never invent tables that don't exist
- Norwegian characters (æ, ø, å) in labels — always use UTF-8, never transliterate to ae/oe/aa
- Table name drift — always use exact table names from DATABASE.md (e.g. `schedule_shift` not `shift`, `user_identity` not `user`)
```
