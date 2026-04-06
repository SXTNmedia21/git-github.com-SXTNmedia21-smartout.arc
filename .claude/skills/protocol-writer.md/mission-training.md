---
name: mission-training
description: Use when creating, training, testing, or iterating on Stage Engine missions. Triggers on new mission design, stage instruction tuning, tool wiring verification, agent behavior testing, or mission deployment. Also use when debugging agent behavior during a mission.
---

# Mission Training

## Overview

A mission is a multi-stage guided workflow that an AI agent (like Lise) follows to accomplish a goal with a user. Training a mission means designing stages, writing instructions, wiring tools, and iterating until the agent behaves correctly under real conditions.

**Core principle:** A mission is only as good as its weakest stage instruction. One phantom tool reference, one broken advance chain, one vague instruction — and the agent derails.

## When to Use

- Designing a new mission from scratch
- Adding/removing/reordering stages in an existing mission
- Tuning stage instructions (prompt engineering for stages)
- Wiring new tools to a mission (client or server-side)
- Debugging agent behavior during a mission (stuck, looping, skipping)
- Deploying a mission to production (verification gate)

## Mission Anatomy

```
engine_missions (template)
├── id, name, description
├── mode: sequential | free | hybrid
├── system_prompt (base personality — applies to ALL stages)
├── journey_id (optional link to journey for Guardian enrichment)
└── is_active

engine_stages[] (ordered steps)
├── stage_id (unique within mission)
├── stage_order (display/chain order)
├── goal (what this stage achieves)
├── instructions (THE critical field — what the agent does)
├── success_criteria (when is this stage "done"?)
├── next_stage (chain link — NULL = terminal)
├── personality_override (tone shift for this stage)
├── creative_freedom (0 = strict script, 1 = improvise)
├── tuning_notes (coaching hints for the LLM)
└── journey_step_id (optional link to journey step)
```

## The Stage Chain

Every sequential mission forms an unbroken chain:

```
stage1 → stage2 → stage3 → ... → stageN → NULL
```

**Verification:** Query the chain and check for gaps:

```sql
SELECT stage_id, stage_order, next_stage
FROM engine_stages
WHERE mission_id = 'your-mission'
ORDER BY stage_order;
```

**Rules:**

- Every non-terminal stage MUST have a `next_stage` that exists
- Terminal stage MUST have `next_stage = NULL`
- No orphaned stages (stage exists but nothing points to it and it's not stage 1)
- `stage_order` must be monotonically increasing

## The Two-Tool Advance Pattern

When a mission drives a frontend UI (like onboarding), every non-terminal stage needs BOTH:

1. **`advanceToNextSection`** — Client tool, scrolls the frontend UI to the next section
2. **`advance`** — Engine HTTP tool, transitions the session to the next stage + rebuilds the system prompt

These are decoupled by design:

- `advanceToNextSection` runs in the browser (React state)
- `advance` runs server-side (Stage Engine API → prompt rebuild)

**The terminal stage** calls `advanceToNextSection` (to show the final UI) but does NOT call `advance` (no next stage).

**Every stage instruction must explicitly say:**

```
When done: call advanceToNextSection to scroll the UI, then call advance with a summary.
```

For the terminal stage:

```
This is the final stage — do NOT call advance. The session completes here.
```

## Tool Categories

Missions have access to two types of tools:

### Engine HTTP Tools (server-side)

Built by `buildUltravoxTools()` in `services/stage-engine/src/lib/ultravox.ts`. Available to ALL missions automatically.

| Tool                | Purpose                                | When to use in instructions     |
| ------------------- | -------------------------------------- | ------------------------------- |
| `store`             | Save collected data to engine_inbox    | Persisting structured data      |
| `fetch`             | Retrieve context, inbox, stage history | Reading back what was collected |
| `advance`           | Move to next stage + rebuild prompt    | Stage completion (non-terminal) |
| `getJourneyContext` | Get journey progress + timing          | Checking completion status      |

### Client Tools (browser-side)

Registered in `useBotsson.ts` as Ultravox `temporaryTool` with `client: {}`. Execute in React.

These are mission-specific. For onboarding:

| Tool                   | Purpose                      |
| ---------------------- | ---------------------------- |
| `updateBusiness`       | Fill business form fields    |
| `addDepartments`       | Create department entries    |
| `addLocations`         | Add physical locations       |
| `addZones`             | Add zones within a location  |
| `addProcedures`        | Toggle/add procedure entries |
| `updateSeason`         | Set season name/dates        |
| `triggerScrape`        | Start web scraping           |
| `addKeyFact`           | Show key fact in UI panel    |
| `saveMemory`           | Persist to engine_memory     |
| `advanceToNextSection` | Scroll UI to next section    |
| `getOnboardingState`   | Read current form state      |

### Phantom Tools (NEVER use)

Legacy tool names that don't exist. Stage instructions must NEVER reference these:

| Phantom       | Real replacement                 |
| ------------- | -------------------------------- |
| `navigate_to` | `advanceToNextSection`           |
| `fill_field`  | `updateBusiness` / specific tool |
| `show_panel`  | `addKeyFact` (KeyFactsPanel)     |
| `show_toast`  | (use sonner toast directly)      |

## Writing Stage Instructions

Stage instructions are the prompt fragment injected when a stage is active. They control agent behavior completely.

### Structure

```
1. Opening line (what to say/ask)
2. Data collection (which tools to call with what)
3. Confirmation (verify with user)
4. Transition (advanceToNextSection + advance)
```

### Rules

1. **One question at a time.** Never dump multiple questions.
2. **Name real tools.** Every tool mentioned must exist. No phantom tools.
3. **Be specific about parameters.** `addKeyFact("Navn", name)` not just "save the name".
4. **Include the transition.** Every non-terminal stage ends with the two-tool advance.
5. **Set boundaries.** "Max 2 sentences, then wait." "Do NOT hold monologues."
6. **Use Norwegian** for user-facing text. Technical instructions can be English.
7. **Match personality_override.** If stage has `tuning_notes: 'efficiency'`, instructions should be concise.

### Example (good)

```
Ask: "Hvor holder dere til? Har dere flere lokaler?"

For each location: call addLocations with name and type (main/outdoor/satellite).
Then ask about zones: "Har restauranten forskjellige soner?"
For each zone: call addZones(locationName, zones).
addKeyFact("Lokasjoner", list of names).

When done: call advanceToNextSection to scroll the UI,
then call advance with a summary of the locations collected.
```

### Example (bad — phantom tools, vague, no advance)

```
Ask about locations. Save the data. Navigate to next section when done.
```

## Training Workflow

### Phase 1: Design

1. Define the mission goal and user outcome
2. Break into stages — each stage has ONE clear goal
3. Write the stage chain: `stage1 → stage2 → ... → NULL`
4. For each stage, identify which tools are needed
5. Write a user manuscript (Playwright-style: USER does X → AGENT does Y → UI shows Z)

### Phase 2: Implement

1. Write the migration/seed SQL with all stages
2. Wire any new client tools in `useBotsson.ts`
3. Create frontend section components if needed
4. Update the AI mission registry (`packages/ai/src/missions/registry.ts`)
5. Update cross-layer registries (types, labels, colors, CSS)

### Phase 3: Verify

Run the feature verification template (`docs/templates/feature-verification.md`):

1. **Type safety** — `pnpm typecheck` with 0 new errors
2. **Stale references** — grep for old stage names, removed sections
3. **Cross-layer consistency** — sections = components = labels = colors = CSS vars
4. **Stage chain** — unbroken `→ NULL`, no orphans
5. **Two-tool advance** — every non-terminal stage has both tools
6. **Tool references** — no phantom tools in any stage instruction
7. **Data flow** — new state → actions → getState → context → finalize → reset

### Phase 4: Test

1. **Dry run** — Read each stage instruction aloud. Does it make sense as a conversation?
2. **Tool audit** — For each tool mentioned in instructions, verify it exists in client tools or engine tools
3. **Chain walk** — Start at stage 1, follow `next_stage` to NULL. Count must match `stage_order` max.
4. **Live test** — Run the mission with voice/chat. Note where the agent hesitates, loops, or breaks.
5. **Score** — Use the agent-scoring skill to evaluate agent performance per stage.

### Phase 5: Iterate

Common issues and fixes:

| Symptom                     | Likely cause                  | Fix                                 |
| --------------------------- | ----------------------------- | ----------------------------------- |
| Agent stuck on a stage      | Missing advance instruction   | Add explicit "call advance"         |
| Agent skips data collection | Instructions too vague        | Add specific tool calls with params |
| Agent holds monologues      | No boundary set               | Add "Max 2 sentences, then wait"    |
| Agent calls wrong tool      | Phantom tool in instructions  | Replace with real tool name         |
| UI doesn't scroll           | Missing advanceToNextSection  | Add client tool call                |
| Stage prompt doesn't update | Missing engine advance        | Add "call advance" after UI scroll  |
| Agent repeats questions     | No confirmation pattern       | Add "Confirm: Riktig?" then move on |
| Agent ignores user data     | getOnboardingState not called | Add "Call getOnboardingState first" |

## Prompt Builder Context

The Stage Engine's `buildStagePrompt()` assembles the final prompt from 13 parts:

```
1. Mission base prompt (personality)
2. personality_override (stage tone shift)
3. Emotion hint
4. Creative freedom level
5. Goal + Instructions (THE critical part)
6. Success criteria
7. Escalation instructions
8. Context (identity, workspace, custom)
9. Journey step enrichment (timing, progress)
10. Journey progress (steg X av Y)
11. Previously collected data (from prior stages)
12. After-action instructions (inline)
13. Tuning notes (coaching hints)
```

**Key insight:** Stage instructions don't exist in isolation. The LLM sees the mission personality + all context + collected data from prior stages. Write instructions assuming the agent already knows what happened before.

## Guardian Integration

The Guardian system monitors active sessions:

- Evaluates every 30 seconds + on events
- Checks if `data_writes` fields are collected
- Auto-advances if `required_confirmation` is false and criteria met
- Nudges user if confirmation required
- Fires events: `guardian.nudge_*`, `stage.auto_advanced`

**For mission training:** Link stages to journey steps (`journey_step_id`) to get:

- `min_duration_seconds` / `max_duration_seconds` per stage
- `data_writes` — fields Guardian watches for completion
- `required_confirmation` — whether to auto-advance or nudge

## SQL Template for New Stages

```sql
INSERT INTO engine_stages (
  mission_id, stage_id, stage_order, goal, instructions, success_criteria,
  personality_override, creative_freedom, tuning_notes, next_stage,
  is_required, journey_step_id, escalation_instructions
) VALUES (
  'mission-id', 'stage-id', N,
  'One-line goal',
  E'Full instructions with tool calls.\\n\\nWhen done: call advanceToNextSection, then call advance.',
  'Measurable success criterion',
  'Tone description for this stage.',
  0.4,  -- 0=strict script, 1=full improvise
  'coaching-hint',
  'next-stage-id',  -- or NULL for terminal
  true,   -- is_required: false only for optional/skippable stages
  NULL,   -- journey_step_id: UUID FK to journey_step. SET THIS for Guardian evaluation.
          -- NULL only for agent-added stages (greeting, wrapup) with no journey step.
  NULL    -- escalation_instructions: what to do if stage fails
) ON CONFLICT (mission_id, stage_id) DO UPDATE SET
  stage_order = EXCLUDED.stage_order,
  goal = EXCLUDED.goal,
  instructions = EXCLUDED.instructions,
  success_criteria = EXCLUDED.success_criteria,
  personality_override = EXCLUDED.personality_override,
  creative_freedom = EXCLUDED.creative_freedom,
  tuning_notes = EXCLUDED.tuning_notes,
  next_stage = EXCLUDED.next_stage,
  is_required = EXCLUDED.is_required,
  journey_step_id = EXCLUDED.journey_step_id,
  escalation_instructions = EXCLUDED.escalation_instructions;
```

Always use `ON CONFLICT ... DO UPDATE` for idempotency.

## Quick Verification Commands

```bash
# Stage chain integrity
grep -E "next_stage|stage_id|stage_order" path/to/mission.sql | head -30

# Phantom tool check
grep -E "navigate_to|fill_field|show_panel|show_toast" path/to/mission.sql
# Should return 0 results

# Two-tool advance check (non-terminal stages)
grep -B2 -A5 "When done:" path/to/mission.sql
# Each should mention BOTH advanceToNextSection AND advance

# Terminal stage check
grep -A3 "next_stage.*NULL" path/to/mission.sql
# Should say "do NOT call advance"

# Tool definition ↔ implementation match
echo "Definitions:" && grep -c "modelToolName" apps/web/src/app/onboarding/hooks/useBotsson.ts
echo "Implementations:" && grep -c "registerToolImplementation" apps/web/src/app/onboarding/hooks/useBotsson.ts
# Counts must match
```

## Common Mistakes

**Writing instructions for the developer, not the agent.** Instructions are injected into the LLM prompt. Write them as directions the agent follows, not as documentation.

**Forgetting the engine advance.** `advanceToNextSection` scrolls the UI but does NOT transition the Stage Engine. The agent stays on the old stage with the old prompt.

**Using phantom tools.** `navigate_to`, `fill_field`, `show_panel` don't exist. The agent will hallucinate behavior.

**Vague success criteria.** "User is happy" is not measurable. "At least 1 location created" is.

**Not testing the chain.** A broken `next_stage` reference silently fails — the session just never advances.

**Skipping personality calibration.** A warm greeting stage with `creative_freedom: 0.1` will feel robotic. Match the number to the tone.
