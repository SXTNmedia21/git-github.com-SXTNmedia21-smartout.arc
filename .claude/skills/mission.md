---
name: mission
description: Use when building a mission definition for a Smartout journey package. Triggers on "build mission", "mission for X", "define agent behavior", "create mission stages", or after completing a /journey. Requires a Journey artifact to exist first.
---

# Mission — Agent Execution Builder

## Overview

Create the Mission artifact — the agent execution contract for a journey. Defines what the agent does, decides, and tracks at every stage. Produces both a design document (Mission.md) and executable seed SQL for the Stage Engine.

**Core principle:** A mission without observability is a black box. Every mission ships with timing thresholds, failure signals, and trackability built in.

## When to Use

- After `/journey` has been completed for this journey package
- When defining agent behavior for a user workflow
- When upgrading an existing natural-language mission to full spec
- NOT for missions without a Journey (run `/journey` first)
- NOT for iterating on existing missions (use `/mission-training` instead)

## Prerequisite Check

Before anything else:

1. Check that `docs/Roadmaps/{slug}/Journey.md` exists. If not: "Run `/journey` first."
2. Check that `docs/Roadmaps/{slug}/Roadmap.md` exists. If not: "Run `/roadmap` first."
3. Read both to get: Package Identity, Actor, Platform, Steps, Tools, Events, Success Criteria.

## Input Sources

Read ALL of these before generating:

| Source | Path | What you get |
|--------|------|-------------|
| Roadmap | `docs/Roadmaps/{slug}/Roadmap.md` | Scope, actor, intent, success criteria |
| Journey | `docs/Roadmaps/{slug}/Journey.md` | Steps, UI elements, data ops, events, errors |
| Mission Training Skill | `.claude/skills/mission-training.md` | Stage anatomy, tool categories, chain rules, SQL template |
| Stage Engine Trainer | `docs/reference/STAGE_ENGINE_TRAINER_GUIDE.md` | Architecture, prompt builder, authority, posture |
| Existing Missions | `supabase/migrations/*seed*mission*.sql` | Pattern reference for seed SQL |
| DB Schema | `packages/supabase/src/database.types.ts` | engine_missions, engine_stages columns |

## Confidence Assessment

| Signal | Score |
|--------|-------|
| Journey deep spec exists with full steps | +3 |
| Similar mission seed SQL exists (e.g., onboarding-interview) | +2 |
| Tools for this domain already exist in codebase | +1 |
| Module doc covers this workflow | +1 |
| Total 5+ = HIGH, 3-4 = MEDIUM, 0-2 = LOW | |

**HIGH:** Generate complete Mission.md + seed SQL draft for review.
**MEDIUM:** Generate skeleton with gaps marked `[TBD]`, ask about tool availability.
**LOW:** Walk through stage by stage: "What should the agent do here? What tools does it need?"

## Knowledge Gates

ALL must be known before generating. If any is missing, ask.

### Mission-Level Gates

| # | Gate | Source | Question if missing |
|---|------|--------|-------------------|
| 1 | Mission ID | Package Identity | "What M-NNN ID for this mission?" |
| 2 | Mission mode | Journey flow type | "Sequential, free, or hybrid?" |
| 3 | Agent personality | Roadmap/Journey actor | "What tone? (warm/direct/formal/casual)" |
| 4 | Available tools | Codebase grep | "Which client + engine tools exist for this domain?" |
| 5 | Stage count | Journey steps | "How many stages? (map from journey steps)" |
| 6 | Session duration target | Business context | "Expected min/max session time?" |
| 7 | Trigger condition | Roadmap event motor | "What starts this mission?" |

### Per-Stage Gates

| # | Gate | Key fields | Question if missing |
|---|------|-----------|-------------------|
| 1 | **Goal** | One-line objective | "What does the agent accomplish here?" |
| 2 | **Instructions** | Full prompt text with tool calls | "What does the agent say and do?" |
| 3 | **Tools** | List of client + engine tools used | "Which tools does this stage call?" |
| 4 | **Success criteria** | Measurable completion condition | "How do we know this stage is done?" |
| 5 | **Timing** | min/max seconds | "How long should this stage take?" |
| 6 | **Data writes** | Fields Guardian watches | "What data must be collected?" |
| 7 | **Failure signals** | What indicates trouble | "What goes wrong here?" |
| 8 | **Transition** | next_stage or NULL | "What comes after?" |

## Stage Mapping Rules

### Journey Steps to Mission Stages

Not every journey step becomes a mission stage. Apply these rules:

| Journey step type | Mission stage? | Why |
|------------------|:-:|-----|
| User action (tap, navigate) | No | UI-only, no agent involvement |
| System auto (background process) | No | No agent decision needed |
| Agent-guided data collection | Yes | Agent asks, collects, stores |
| Agent-guided decision | Yes | Agent evaluates and recommends |
| Confirmation/validation | Merge with prior | Don't create a stage just to confirm |
| Multi-step form with agent | Yes | Agent guides through form sections |

**Guideline:** Fewer stages = better. Merge where the agent's goal doesn't change. A 12-step journey might become a 5-stage mission.

### Tool Wiring

For each stage, identify tools from two categories:

**Engine HTTP Tools** (available to ALL missions automatically):
- `store` — Save data to engine_inbox
- `fetch` — Read context, inbox, history
- `advance` — Move to next stage + rebuild prompt
- `getJourneyContext` — Check journey progress

**Client Tools** (registered per-mission in frontend):
- Check `apps/web/src/` for existing tool registrations
- If a tool doesn't exist yet, mark it `[NEW — needs implementation]`
- Every client tool must have a `modelToolName` + `registerToolImplementation`

### The Chain

Every sequential mission must have an unbroken chain:

```
stage1.next_stage → stage2.next_stage → ... → stageN.next_stage = NULL
```

Verify: no orphans, no gaps, terminal stage has `next_stage = NULL`.

### The Two-Tool Advance Pattern

For missions that drive a frontend UI, every non-terminal stage needs BOTH:
1. `advanceToNextSection` — scrolls the UI (client tool)
2. `advance` — transitions the engine (HTTP tool)

Terminal stage: calls `advanceToNextSection` but NOT `advance`.

## Three Pillars

### Results

Every mission defines:

```yaml
results:
  session_success: "{measurable definition of mission completion}"
  stage_success:   "{per-stage: what data/state constitutes 'done'}"
  quality_score:   "{what makes a GOOD completion vs just completion}"
```

### Trackability

Every mission defines observability signals:

```yaml
trackability:
  timing:
    session_target_seconds: [min, max]
    per_stage:
      stage-id: [min_seconds, max_seconds]
  failure_signals:
    - signal: "abandon"
      detection: "session closed before terminal stage"
      severity: warning
    - signal: "rage_quit"
      detection: "session closed within 30s of starting, or rapid repeated closes"
      severity: critical
    - signal: "stuck"
      detection: "same stage active for > max_seconds"
      severity: warning
    - signal: "loop"
      detection: "stage revisited > 2 times"
      severity: warning
    - signal: "timeout"
      detection: "session exceeds session_target_seconds max"
      severity: info
  guardian_watches:
    per_stage:
      stage-id:
        data_writes: ["field1", "field2"]
        required_confirmation: true|false
        auto_advance: true|false
```

### Triggerability

Every mission defines how to start and test:

```yaml
triggerability:
  trigger: "{what starts this mission — route, event, user action}"
  test_invocation: "{how to start it in dev — curl command or UI path}"
  mission_training_link: "Use /mission-training to iterate on stages"
```

## Output: Mission.md

Save to `docs/Roadmaps/{slug}/Mission.md`. Use this format:

````markdown
---
title: "Mission: {Title}"
status: draft
updated: {YYYY-MM-DD}
created: {YYYY-MM-DD}
module: {module}
tags: [mission, agent, {module}, {actor}]
---

# Mission: M-{NNN} — {Title}

## Package Identity

- Package ID: `JP-R{NNN}-{SLUG}`
- Mission ID: `M-{NNN}`
- Roadmap ID: `R-{NNN}`
- Journey ID: `J-{NNN}`
- License ID: `L-{NNN}` (TBD)

Related package docs:

- [Roadmap](./Roadmap.md)
- [Journey](./Journey.md)
- [License](./License.md) (pending)

## Mission Goal

{1-2 sentences: what the agent accomplishes for the user}

## Configuration

| Field | Value |
|-------|-------|
| Mission ID (DB) | `{kebab-case-id}` |
| Mode | {sequential/free/hybrid} |
| Agent | {agent name — e.g., Lise, Mr. Botsson} |
| Personality | {tone description} |
| Channel | {voice/chat/both} |
| Session target | {min}–{max} seconds |

## Stage Chain

```
{stage1} → {stage2} → ... → {stageN} → NULL
```

## Stages

### Stage 1: {stage_id} — {Goal}

| Field | Value |
|-------|-------|
| Order | 1 |
| Goal | {one-line} |
| Creative freedom | {0.0–1.0} |
| Personality override | {tone for this stage} |
| Next stage | {stage_id or NULL} |

**Instructions:**

```
{Full instruction text — what the agent says, which tools to call, transition pattern}
```

**Success criteria:** {measurable}

**Tools used:**
| Tool | Type | Purpose |
|------|------|---------|
| {name} | client/engine | {what it does in this stage} |

**Observability:**
| Signal | Threshold | Severity |
|--------|-----------|:--------:|
| timing | {min}–{max}s | warning |
| data_writes | {fields} | — |
| stuck | > {max}s | warning |

---

{Repeat for each stage}

## Guardrails

- {Rule the agent must never break}
- {Rule the agent must never break}

## Escalation Conditions

| Condition | Agent behavior |
|-----------|---------------|
| {what goes wrong} | {what agent does} |

## Observability Contract

### Results

- **Session success:** {definition}
- **Quality score:** {what separates good from just-done}

### Failure Signals

| Signal | Detection | Severity | Action |
|--------|-----------|:--------:|--------|
| abandon | Session closed before terminal | warning | Log + notify |
| rage_quit | Closed within 30s or 3+ rapid closes | critical | Log + flag for review |
| stuck | Same stage > {max}s | warning | Guardian nudge |
| loop | Stage revisited > 2x | warning | Guardian intervene |
| timeout | Session > {max}s total | info | Log |

### Trigger

- **Start condition:** {what starts this mission}
- **Dev test:** `{curl command or UI path to trigger}`

## Seed SQL Reference

Migration file: `supabase/migrations/{timestamp}_seed_{mission-id}_mission.sql`
````

## Output: Seed SQL

Generate an idempotent migration file. Pattern from `/mission-training`:

```sql
SET search_path TO public, extensions;

-- {timestamp}_seed_{mission-id}_mission.sql
-- Seeds {mission-name} mission into engine_missions + engine_stages.

INSERT INTO engine_missions (id, name, description, mode, workspace_id, is_active, system_prompt)
VALUES (
  '{mission-id}',
  '{Mission Display Name}',
  '{Description}',
  '{sequential|free|hybrid}',
  NULL,  -- NULL = global template
  true,
  E'{system_prompt with \\n for newlines}'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  mode = EXCLUDED.mode,
  is_active = EXCLUDED.is_active,
  system_prompt = EXCLUDED.system_prompt,
  updated_at = now();

INSERT INTO engine_stages (
  mission_id, stage_id, stage_order, goal, instructions, success_criteria,
  personality_override, creative_freedom, tuning_notes, next_stage
) VALUES
('{mission-id}', '{stage-1-id}', 1,
 '{goal}',
 E'{instructions with tool calls}',
 '{success_criteria}',
 '{personality_override or NULL}',
 {creative_freedom},
 '{tuning_notes or NULL}',
 '{next-stage-id}'),

-- ... more stages ...

('{mission-id}', '{terminal-stage-id}', N,
 '{goal}',
 E'{instructions — do NOT call advance}',
 '{success_criteria}',
 '{personality_override or NULL}',
 {creative_freedom},
 '{tuning_notes or NULL}',
 NULL)  -- terminal
ON CONFLICT (mission_id, stage_id) DO UPDATE SET
  stage_order = EXCLUDED.stage_order,
  goal = EXCLUDED.goal,
  instructions = EXCLUDED.instructions,
  success_criteria = EXCLUDED.success_criteria,
  personality_override = EXCLUDED.personality_override,
  creative_freedom = EXCLUDED.creative_freedom,
  tuning_notes = EXCLUDED.tuning_notes,
  next_stage = EXCLUDED.next_stage;
```

## Verification Checklist

After generating, verify:

1. **Chain integrity** — Every `next_stage` points to an existing stage. Terminal has NULL.
2. **No phantom tools** — Every tool in instructions exists in client tools or engine tools.
3. **Two-tool advance** — Non-terminal stages with UI have both `advanceToNextSection` + `advance`.
4. **Terminal stage** — Says "do NOT call advance".
5. **Observability** — Every stage has timing thresholds and data_writes.
6. **Failure signals** — At least: abandon, rage_quit, stuck, timeout.
7. **Idempotent SQL** — Uses `ON CONFLICT ... DO UPDATE`.
8. **Norwegian instructions** — User-facing text in Norwegian, technical in English.

## After Generation

1. Save Mission.md to `docs/Roadmaps/{slug}/Mission.md`
2. Save seed SQL to `supabase/migrations/{timestamp}_seed_{mission-id}_mission.sql`
3. Tell the user:
   - "Mission defined with {N} stages. Mission.md + seed SQL saved."
   - "Observability: {N} failure signals, timing on all stages."
   - "Next: apply migration (`npx supabase migration up`), then `/mission-training` to test and iterate."
4. If any tools are marked `[NEW — needs implementation]`, list them prominently.

## Common Mistakes

- **Generating without Journey** — Always check prerequisite. The Journey defines WHAT happens; the Mission defines HOW the agent does it.
- **1:1 step-to-stage mapping** — Not every journey step needs an agent stage. Merge UI-only steps.
- **Vague instructions** — "Help the user" is not an instruction. Name specific tools with specific params.
- **Missing observability** — A mission without timing thresholds and failure signals is a black box.
- **Forgetting the advance pattern** — `advanceToNextSection` (UI) + `advance` (engine) are separate. Both needed.
- **Not checking tool existence** — Grep the codebase. If the tool doesn't exist, flag it.
- **Skipping guardrails** — Every mission needs explicit "never do X" rules.
- **English instructions for user-facing text** — Norwegian default. Always.
