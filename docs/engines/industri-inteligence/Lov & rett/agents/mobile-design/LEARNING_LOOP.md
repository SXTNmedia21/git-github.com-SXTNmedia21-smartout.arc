---
title: "Mobile UI Learning Loop"
status: active
updated: 2026-04-18
created: 2026-04-18
module: ai
tags: [agent, mobile, learning-loop, telemetry, ux]
---

# Mobile UI Architect: Self-Reflection & Learning Loop

The Mobile UI Architect operates within a continuous learning loop — the same principle as the web frontend-designer, adapted for native mobile constraints and the shift-worker context.

## 1. The Architecture of the Loop

Four phases, identical in structure to the web loop:

1. **Hypothesis Formulation:** Before changing a UI component or interaction pattern, write a hypothesis in `docs/agents/mobile-design/hypotheses.md`.
2. **Implementation (Variant Tagging):** Create the new variant, tag it with a telemetry `variant` identifier for measurement.
3. **Data Ingestion:** Read metrics from `@smartout/telemetry` event streams via the engine_event table.
4. **Reflection & Solidification:** Compare data against hypothesis, log the learning, and update design directives if proven.

## 2. The Hypothesis Tracking System

The agent maintains a rolling ledger of active mobile UI experiments in `docs/agents/mobile-design/hypotheses.md`.

When proposing a UX change, log:

- **Experiment ID:** e.g., `EXP-MOB-001`
- **Trigger/Context:** What data or observation triggered this experiment?
- **Hypothesis:** "If we [change X], then [metric Y] will [improve/decrease] by [amount] because [reasoning]."
- **Variant Tag:** Machine-readable tag for telemetry filtering (e.g., `punch-fab-persistent-v1`)
- **Target Metric:** Primary metric to evaluate (e.g., `time_to_first_punch_ms`)
- **Guard Rails:** Secondary metrics that must NOT degrade (e.g., `accidental_punch_rate`)

### Mobile-Specific Experiment Categories

| Category                | Example Experiments                                               | Key Metrics                                   |
| ----------------------- | ----------------------------------------------------------------- | --------------------------------------------- |
| **Navigation**          | Bottom tab reorder, gesture shortcuts, deep link targets          | `navigation_time_ms`, `back_press_rate`       |
| **Shift Interaction**   | Punch button placement, shift card layout, handoff flow           | `time_to_punch_ms`, `handoff_completion_rate` |
| **Information Density** | Card content reduction, progressive disclosure, collapse patterns | `scroll_depth`, `time_to_find_info_ms`        |
| **Offline Experience**  | Stale data presentation, sync indicators, queue feedback          | `offline_action_count`, `sync_error_rate`     |
| **Input Efficiency**    | Keyboard type, auto-suggest, selection vs typing                  | `input_time_ms`, `validation_error_count`     |

## 3. Data Ingestion & Reflection

### Metrics Sources

Mobile telemetry flows through the same `@smartout/telemetry` pipeline as web:

```
User Action → emit() → PostHog (analytics) + engine_event (workflow) + activity_trail (audit)
```

### Primary Mobile Metrics

| Metric                         | What It Measures                        | Healthy Range     |
| ------------------------------ | --------------------------------------- | ----------------- |
| `time_to_first_interaction_ms` | App open → first tap                    | < 2000ms          |
| `time_to_punch_ms`             | App open → punch confirmed              | < 5000ms          |
| `rage_tap_count`               | Repeated taps on same target in < 500ms | 0 per session     |
| `task_completion_rate`         | Started tasks → completed               | > 85%             |
| `session_duration_ms`          | Total active session time               | Context-dependent |
| `scroll_depth`                 | % of scrollable content viewed          | Depends on intent |
| `offline_action_count`         | Actions queued while offline            | Monitor trend     |
| `gesture_abandon_rate`         | Started gesture → canceled              | < 15%             |

### Reflection Protocol

After N sessions (or 1 week), the agent executes a reflection:

1. Query engine_event for events matching the experiment's Variant Tag
2. Compare primary metric against hypothesis threshold
3. Check guard rail metrics for regression
4. Write post-mortem:
   - _Was the hypothesis correct?_
   - _Did any secondary metric suffer?_
   - _Was the sample size sufficient?_
   - _What confounding factors existed? (e.g., new feature launched simultaneously)_

## 4. Solidification (Self-Updating Directives)

If an experiment is a **clear success** (primary metric improved, guard rails held):

1. Update `INSTRUCTION.md` to mandate the new pattern
2. Update relevant component with the winning variant as default
3. Remove the experiment tag from code
4. Archive the hypothesis with `status: proven` and link to reflection

If an experiment **fails** (primary metric worsened or guard rails breached):

1. Revert the change immediately
2. Mark hypothesis as `status: disproven`
3. Add the failing pattern to a "Don't Repeat" section in the hypothesis ledger
4. Update `INSTRUCTION.md` with an anti-pattern note if broadly applicable

## 5. The "Rage-Tap" Auto-Revert (Mobile Circuit Breaker)

Mobile-specific safety mechanism. If the agent deploys a new UI variant and telemetry detects:

- **300%+ spike in `rage_tap_count`** within the first 50 sessions, OR
- **200%+ spike in `gesture_abandon_rate`** within the first 50 sessions, OR
- **50%+ drop in `task_completion_rate`** compared to baseline

Then the agent must:

1. **Immediately revert** to the previous component version
2. Log a "Failed State" reflection with full metric comparison
3. Mark the UI pattern as `blocked` — it cannot be reattempted without human approval
4. Notify via telemetry: `emit("mobile.experiment.auto_reverted", { experimentId, reason, metrics })`

## 6. Cross-Platform Learning Sync

The mobile and web agents share a design token foundation but solve different problems. Learning should flow in both directions:

- **Mobile → Web:** Touch-first patterns that improve click interactions (e.g., larger targets, haptic-equivalent micro-animations)
- **Web → Mobile:** Information architecture patterns that scale down well (e.g., progressive disclosure, card-based layouts)
- **Shared Ledger:** Both agents should reference each other's hypothesis logs before starting overlapping experiments

### Sync Checkpoints

When the mobile agent discovers a broadly applicable pattern:

1. Log it in `docs/agents/mobile-design/hypotheses.md`
2. Add a cross-reference note in `docs/agents/frontend-design/hypotheses.md`
3. Tag with `cross-platform: true` for the web agent to evaluate

## 7. Mobile-Specific Learning Categories

### Gesture Vocabulary

Track which gestures users discover naturally vs need to be taught:

- Swipe-to-dismiss (natural)
- Pull-to-refresh (natural)
- Long-press for context menu (needs hint)
- Swipe-to-reveal actions on list items (needs hint)

### Offline Behavior Patterns

Track how users behave when connectivity is poor:

- Do they retry actions? → Need better offline feedback
- Do they close and reopen? → Need persistent state indicators
- Do they switch to another tool? → Feature gap

### Time-of-Day Patterns

Shift workers have predictable usage spikes:

- Pre-shift (15 min before): check schedule, prep
- Shift start: punch in, view tasks
- Mid-shift: task completion, deviations
- Shift end: punch out, handoff, confirm hours
- Post-shift: review, messages

Each phase may benefit from different UI optimization. Track which phases show the highest friction.
