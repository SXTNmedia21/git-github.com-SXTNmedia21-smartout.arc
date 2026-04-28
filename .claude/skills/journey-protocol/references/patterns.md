# Common patterns and pushback scripts

## Patterns

### Pattern 1: Linear onboarding

Symptoms: user-described flow has clear before/after, single actor, must-be-done-once.

Setting:

```yaml
mode: "sequential"
repeat_policy: "first_time_only"
relevance.onboarding: true
priority: "P0"
```

Step `on_timeout` typically:

- Early steps: `background` (let user come back later)
- Middle steps: `assist` (user is engaged, may need nudge)
- Final steps: `abandon` (if they don't complete now, start over)

### Pattern 2: Repeating daily action

Symptoms: user does this regularly, performance varies, occasional snags.

Setting:

```yaml
mode: "sequential" or "hybrid"
repeat_policy: "anomaly_based"
relevance.daily_use: true
```

Assist threshold often higher (0.9+) because false positives annoy expert users.

### Pattern 3: Multi-actor handoff

Symptoms: one actor initiates, another picks up, hours or days between.

Setting:

```yaml
actor: "multi"
mode: "sequential"
```

Each handoff step has:

```yaml
handoff_to: "<role>"
handoff_token_field: "<field>"
handoff_timeout_ms: <usually 24h to 72h>
on_timeout: "background"
reentry_trigger: "<token-based action>"
```

### Pattern 4: Recurring background flow

Symptoms: never really "done", happens continuously, no terminal step.

Setting:

```yaml
mode: "recurring"
repeat_policy: "always"
```

Success gate fires `cycle_completed` instead of `completed`.

### Pattern 5: Free-form exploration

Symptoms: user can do parts in any order, completion is "have they done enough?"

Setting:

```yaml
mode: "free"
```

Steps don't have `order`. Success gate is a count or set: "completed at least 3 of these 5 steps."

## Pushback scripts

### When user proposes too many journeys

> "I count <N> journeys you want. For a Phase 0 project, the engine ships best with 5–10 core journeys. Let's separate must-work-on-day-one from add-later. Which 5 are you most worried about being broken at launch?"

### When a "journey" is actually a feature

> "What you're describing is a feature with multiple flows. Let's pick the most important flow as journey 1. The other flows can become journeys later as their importance is proven."

### When a "journey" is actually a bug

> "That's a problem with an existing flow. Which existing journey covers this flow? We'll edit that journey's IR, not create a new one."

### When user wants to skip step definition

> "I can't generate the IR without steps. The steps are how the engine knows where the user is. Walk me through what the user does, one action at a time."

### When user is fuzzy on success

> "If we can't define what 'done' looks like, we can't track completion. Even a rough definition helps. What's the simplest thing — what does the user have, see, or do that means 'this worked'?"

### When user wants AI guide on every step

> "If AI guide fires on every step it becomes noise. Pick the steps where users actually get stuck — usually the ones with novel UI, or the ones with delays (waiting for email). Default everywhere else is silent."

### When user wants 0 confidence threshold

> "If threshold is 0, every event triggers an assist. Users will see suggestions for journeys they're not in. Start at 0.85 — we tune down if completion data shows we're missing valid trigger moments."

### When user proposes a journey that's just one step

> "One step is not a journey — it's a single event. We'd track it as raw telemetry, not as a journey. What happens _before_ and _after_ this step that the user goes through?"

## Anti-patterns to refuse

### "Track every page view as a journey"

This is analytics, not journeys. Push back hard. Suggest using regular telemetry events without IR.

### "Every API endpoint is a journey"

Wrong abstraction. Journeys are user-facing, not API-facing. An API endpoint may be a step in a journey, but is not itself a journey.

### "Make the assist always trigger"

If assist always triggers, it's not an assist — it's a tutorial. Push back: either make it a real journey with a defined end, or make it a static onboarding overlay (not the engine's job).

### "Make journey J trigger journey K automatically"

Use `prerequisites` and `terminates`, not "automatic triggering." The engine doesn't auto-start runs without observing user state. If journey K should follow J, declare K's `prerequisites: [J]` and the runtime will surface K when its preconditions hold AND J is complete.