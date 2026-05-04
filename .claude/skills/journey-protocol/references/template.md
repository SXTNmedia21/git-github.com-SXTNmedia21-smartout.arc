# IR Template (skill reference)

When generating the IR file, use this exact structure. Copy. Replace placeholders. Validate before delivering.

```yaml
schema_version: "2.0.0"
journey_version: "v1"
id: "<kebab-case-id>"
title: "<title>"
description: "<one-sentence description>"

mode: "<sequential|free|hybrid|recurring>"
repeat_policy: "<first_time_only|always|anomaly_based>"

actor: "<role|anonymous_visitor|multi>"
platform: "<web|mobile|voice|any>"
auth_profile: "<anonymous|authenticated|custom>"

module: "<module>"
relevance:
  onboarding: <bool>
  daily_use: <bool>
  rare_event: <bool>
priority: "<P0|P1|P2|P3>"

entry_url: "<url>"
preconditions:
  - "<precondition>"

success_gate:
  description: "<plain-language>"
  predicate: "<deterministic predicate>"

prerequisites: []
terminates: []
exclusive_with: []

assist:
  threshold: 0.85
  default_silence_ms: 15000
  cooldown_ms: 3600000

tags: []

# Optional sections — only include if relevant:
# system_prompt: |
#   <AI guide voice>
#
# i18n:
#   en: { title: "...", description: "..." }
#   no: { title: "...", description: "..." }
#
# actors:  # only for actor: "multi"
#   - role: "<role>"
#     starts_at_step: "<step.key>"

steps:
  - key: "step.<namespace>.<action>"
    title: "<title>"
    description: "<plain-language>"
    order: <int>
    trigger:
      type: "<dom_event|network_response|server_event|state_predicate|absence>"
      # type-specific fields
    assertion: "<predicate>"
    next_step_window_ms: <int>
    on_timeout: "<abandon|pause|background|assist>"
    weight: <0.0-1.0>
    confidence_contribution: "<low|medium|high|terminal>"
    actor: "<role>"
    pii_input: <bool>
    instructions: "<AI-guide coaching>"
```

## Validation rules (run before delivering)

1. `id` is kebab-case, alphanumeric + hyphens only
2. `mode` is one of the four allowed
3. `repeat_policy` is one of the three allowed
4. Every step has unique `key`
5. Every step has all required fields
6. `success_gate.predicate` references real `step.*` keys
7. `prerequisites` references existing journey ids OR ids marked as "to be created"
8. Step weights for `confidence_contribution: "high"` and `"terminal"` sum is reasonable (typically 0.3–0.6 across 2–4 such steps)
9. `next_step_window_ms` is sensible for action type:
    - DOM events: 5_000 – 60_000
    - Network responses: 5_000 – 30_000
    - Server events: depends on system, often longer
    - State predicates: longer (poll-based)
10. `on_timeout: "background"` requires `reentry_trigger` to be set
11. `on_timeout: "assist"` requires `assist_silence_ms` OR uses `assist.default_silence_ms`
12. If any step has `pii_input: true`, ensure `platform` excludes `voice` OR includes `voice` with explicit acknowledgment
13. If `actor: "multi"`, the `actors` array is populated AND at least one step has `handoff_to`

## Common mistakes

- Using class selectors (`.btn-submit`) instead of journey-specific data attributes (`[data-journey='subscribe-submit']`). Always data attributes.
- Putting UI rendering as a "step." UI rendering is a system response, not a user step. Only include if user actively waits for it.
- `weight` adding up to numbers > 1.0. The cap is 0.6 for steps_score; weights should be sized so high-contribution steps total ≈ 0.5–0.6.
- Vague predicates like `"user is happy"`. Predicates must be deterministic boolean expressions.
- Forgetting `order` on sequential steps.