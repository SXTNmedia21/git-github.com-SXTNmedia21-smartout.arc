# FLOW.md schema — closed-loop spine

> ⚠️ **STATUS: INTENT, NOT IMPLEMENTED (2026-04-28).** No generator, no consumer, no dashboard. Example event names below are illustrative — they violate ADR-0175 frozen-5 contract if registered as-is. ADR-0225 (proposed) reconciles whether FLOW.md becomes a registry source or stays intent-doc-only.

Mirrors `docs/engines/system-intelligence/05-protocol-pipeline.md` §5.

`FLOW.md` is the chronological function list. Closed-loop dashboard reads it. `e2e.spec.ts` is generated from it. Every row has a registry-bound event.

## Schema

```yaml
flow:
  - order: <int>           # strictly increasing
    name: <snake_case>     # unique within journey
    actor: <user|system|agent>
    type: <client|dom_event|network|service|stage|ui_render|state_predicate>
    surface: <web|mobile|backend|voice>     # optional
    expected_ms: <int|null>                  # null = user-paced
    event: <registry-bound event name>       # MUST exist in packages/telemetry/src/registry.ts
    consumer: <telemetry|runtime|both>       # who reads the event
    trigger_ref: <step.key|null>             # back-ref to journey.md step.key, or null for derived rows
    # type-specific fields:
    selector: "..."             # dom_event
    method: "..."               # network
    path: "..."                 # network
    service: "..."              # service
    mission_stage: "..."        # stage
    component: "..."            # ui_render
    side_effect: "..."          # any (DB write, external call)
```

## Type cheat sheet

| `type` | Means | Required fields |
|---|---|---|
| `client` | Page load, navigation, app boot | (name + event) |
| `dom_event` | DOM observer fires | `selector` |
| `network` | API call (fetch / route handler) | `method`, `path` |
| `service` | Internal service invocation | `service` |
| `stage` | Stage-engine mission stage | `mission_stage` |
| `ui_render` | Component renders | `component` |
| `state_predicate` | Periodic poll | `predicate` (deterministic) |

## Closed-loop guarantees

- Every row has `event` in registry. CI fails on miss.
- Dashboard subscribes to event stream:
  - Row green: event observed within `expected_ms`
  - Row yellow: observed but `actual_ms > expected_ms × 2`
  - Row red: window elapsed, no event → run flagged `stuck` / `failed`
- `e2e.spec.ts` = one Playwright assertion per row with `trigger_ref != null`
- Refine pass cross-validates `journey.md` step.key set ↔ FLOW.md `trigger_ref` set (must match exactly)

## Adding fields

`FLOW.md` schema is a contract. Adding fields ≈ ADR-class because dashboard renderer + e2e generator both consume the schema. Tighten before extending.

## Example

```yaml
flow:
  - order: 1
    name: page_load
    actor: user
    type: client
    surface: web
    expected_ms: 200
    event: page.loaded
    consumer: telemetry
    trigger_ref: null

  - order: 2
    name: click_subscribe
    actor: user
    type: dom_event
    selector: "button[data-journey='subscribe-submit']"
    expected_ms: null
    event: step.form.submitted
    trigger_ref: "step.form.submitted"

  - order: 3
    name: api_subscribe
    actor: system
    type: network
    method: POST
    path: /api/subscribe
    expected_ms: 350
    side_effect: "INSERT subscriber"
    event: step.api.subscribe_ok
    consumer: both
    trigger_ref: "step.api.subscribe_ok"

  - order: 4
    name: agent_welcome
    actor: agent
    type: stage
    mission_stage: welcome
    expected_ms: 1200
    event: step.agent.responded
    consumer: runtime
    trigger_ref: null
```
