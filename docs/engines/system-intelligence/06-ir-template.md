---
title: "JourneyIR Template"
id: ENGINE_SYSTEM_IR_TEMPLATE
version: "2.0.0"
status: draft
layer: architecture
created: 2026-04-28
updated: 2026-04-28
owner: platform
module: journey-engine
tags:
  - template
  - ir
  - schema
---

# JourneyIR Template

> Copy this file. Fill in every required section. Strip optional sections you don't need.
>
> Filename convention during authoring: `<id>.spec.yaml` (defined) → `<id>.refined.yaml` (refined) → `docs/journeys/<id>/ir/journey.yaml` (approved, immutable).
>
> Example: newsletter-signup-and-welcome → `newsletter-signup-and-welcome.spec.yaml`.

```yaml
# ─── Identity ──────────────────────────────────────────────────────────
schema_version: "2.0.0"
journey_version: "v1"
id: "<kebab-case-unique-id>"
title: "<Human-readable title>"
description: "<One sentence: who does what to achieve what>"

# ─── Mode + repeat policy ─────────────────────────────────────────────
# sequential — strict order; each step blocks the next
# free       — any order; success_gate decides completion
# hybrid     — mix; per-step `order` declares strict steps
# recurring  — never terminates; emits cycle_completed
mode: "sequential"

# first_time_only — assist on first run only
# always          — assist always allowed (rare/complex journeys)
# anomaly_based   — assist when current run is N× user's baseline
repeat_policy: "first_time_only"

# ─── Who and where ────────────────────────────────────────────────────
actor: "<role | anonymous_visitor | multi>"
platform: "<web | mobile | voice | any>"
auth_profile: "<anonymous | authenticated | custom>"

# ─── Module + classification ──────────────────────────────────────────
# Module groups journeys by feature area. Drives admin filtering, dashboards,
# AI-guide retrieval. Examples: onboarding, scheduling, comms, settings, admin
module: "<onboarding | scheduling | comms | settings | admin | ...>"

relevance:
  onboarding: false       # is this part of new-user onboarding?
  daily_use: false        # do users do this daily?
  rare_event: false       # is this a once-per-quarter kind of flow?

priority: "P1"            # P0 critical, P1 important, P2 nice-to-have, P3 backlog

# ─── Entry + preconditions ────────────────────────────────────────────
entry_url: "<absolute URL or route pattern>"
preconditions:
  - "<what must be true before this journey can start>"

# ─── Success ──────────────────────────────────────────────────────────
success_gate:
  description: "<plain-language: when is this done?>"
  predicate: "<deterministic boolean over events + state>"

# ─── Cross-journey relationships ─────────────────────────────────────
prerequisites: []          # journey_ids that must complete before this can start
terminates: []             # journey_ids terminated when this completes
exclusive_with: []         # journey_ids that cannot run concurrently

# ─── Confidence + assist ──────────────────────────────────────────────
assist:
  threshold: 0.85          # confidence required before assist may fire
  default_silence_ms: 15000  # default silence-window before assist
  cooldown_ms: 3600000     # how long to wait before re-offering assist

# ─── Tags ─────────────────────────────────────────────────────────────
tags: []

# ─── Multi-actor (only if actor: "multi") ─────────────────────────────
# actors:
#   - role: "admin"
#     starts_at_step: "step.invite.created"
#   - role: "employee"
#     starts_at_step: "step.invite.accepted"

# ─── i18n ─────────────────────────────────────────────────────────────
i18n:
  en:
    title: "<English title>"
    description: "<English description>"
  no:
    title: "<Norsk tittel>"
    description: "<Norsk beskrivelse>"

# ─── Optional AI-guide context ────────────────────────────────────────
system_prompt: |
  <Voice and tone for AI guide on this journey.
   Keep it short. Brand-appropriate. No PII.>

# ─── Steps ────────────────────────────────────────────────────────────
steps:
  - key: "step.<namespace>.<action>"
    title: "<Human-readable step title>"
    description: "<What the user does, in plain language>"
    order: 1

    # How engine sees it (one of five trigger types)
    trigger:
      type: "dom_event"
      # For dom_event:
      event: "click"                    # click | input | scroll | viewport_intersect | focus | submit
      selector: "[data-journey='...']"  # MUST be journey-specific data attr
      # For network_response:
      # method: "POST"
      # path: "/api/..."
      # status: 200
      # For server_event:
      # event_name: "..."
      # filter: "..."
      # For state_predicate:
      # predicate: "..."
      # poll_interval_ms: 60000
      # For absence:
      # after: "step.x"
      # timeout_ms: 300000

    # What must be true for step to count
    assertion: "<deterministic predicate>"

    # Stuck-window for THIS step
    next_step_window_ms: 30000

    # What happens at timeout
    on_timeout: "abandon"     # abandon | pause | background | assist
    # reentry_trigger: "..."  # required if on_timeout == "background"
    # assist_silence_ms: 15000  # override if on_timeout == "assist"

    # Confidence weighting
    weight: 0.4
    confidence_contribution: "high"  # low | medium | high | terminal

    # Multi-actor (only if applicable)
    actor: "<role>"
    # handoff_to: "<role>"
    # handoff_token_field: "<field>"
    # handoff_timeout_ms: 86400000

    # Optional
    pii_input: false
    instructions: "<AI-guide coaching for this step, plain language>"
    # screenshots: ["<reference>"]

  # ─── Add more steps ─────────────────────────────────────────────────
  - key: "step.<namespace>.<next_action>"
    title: "<...>"
    order: 2
    # ...
```

## Authoring checklist

Before transitioning to `validated`:

- [ ] `id` is unique across the workspace
- [ ] `mode` is explicitly chosen (no default)
- [ ] `module` is set
- [ ] `success_gate.predicate` is deterministic and references real events
- [ ] Every step has a `trigger` with concrete type + fields
- [ ] Every step has a non-empty `assertion`
- [ ] Every step has `next_step_window_ms` and `on_timeout`
- [ ] Confidence weights sum to a sensible total (≈ 1.0 for terminal-step coverage)
- [ ] `prerequisites` and `terminates` reference existing journey ids
- [ ] If `actor: "multi"` then `actors` array is populated and handoff steps declared
- [ ] If any step has `pii_input: true`, voice channel is excluded from `platform`
- [ ] `i18n` has at least the workspace's default locale

## Naming conventions

- `id`: kebab-case, descriptive, action-oriented. Good: `newsletter-signup-and-welcome`. Bad: `journey-1`, `signup`.
- `step.key`: `step.<namespace>.<action>` — namespace is the surface (form, api, ui, email, search), action is what happened.
- Selectors: always use a journey-specific data attribute (`data-journey="..."`) — never CSS class or ID. This protects against UI refactors.

## See also

- `01-prd.md` §4 — full IR field reference + validation layers
- `05-protocol-pipeline.md` §4 — what compiles from this template into the journey folder
- `02-architecture.md` §3.1 — `journey_ir` table schema where IR persists
