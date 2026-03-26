---
title: "LEARNING_LOOP"
status: active
updated: 2026-03-26
created: 2026-03-01
module: ai
tags: [agent, frontend, learning-loop, telemetry, ux]
---

# Frontend Architect: Self-Reflection & Learning Loop

To ensure the Frontend Designer Agent evolves and improves its design decisions over time, it operates within a continuous, self-reflective learning loop. It does not just build components—it hypothesizes, tests, reflects, and updates its own guidelines.

## 1. The Architecture of the Loop

The learning loop consists of four distinct phases:

1. **Hypothesis Formulation:** Before changing a UI component, the agent writes a hypothesis in a dedicated tracking file.
2. **Implementation (The A/B Split):** The agent creates the new variant and deploys it alongside the original using the Event Motor's `journey_version` flag.
3. **Data Ingestion:** The agent reads the resulting metrics from the Vector Store (via the Guardian/Analyst agent).
4. **Reflection & Solidification:** The agent compares the data against its hypothesis, logs the learning, and updates its own design profiles.

## 2. The Hypothesis Tracking System

The agent maintains a rolling ledger of active UI experiments located at `docs/designprofiler/hypotheses.md`.
When the agent proposes a UI change (e.g., swapping a dropdown for radio buttons), it must log:

- **Experiment ID:** e.g., `EXP-UI-004`
- **Trigger/Context:** "Vector Store shows 45s stall time on Industry Dropdown."
- **Hypothesis:** "If we replace the dropdown with a 6-item radio-grid (with a 'Search other' fallback), time-to-complete will drop by 50% because cognitive load is reduced."
- **Variant Tag:** `industry-select-radio-grid-v1`

## 3. Data Ingestion & Reflection

Once a week (or after N events), the agent executes a reflection script:

1. The agent queries the Event Motor / Vector Store for events matching the Variant Tag.
2. It compares the metrics (`validation_error_count`, `time_to_first_interaction_ms`, `stall_duration_ms`) against the control variant.
3. **The Reflection Log:** The agent must write a post-mortem for the experiment:
   - _Was the hypothesis correct?_
   - _Did a secondary metric suffer? (e.g., speed increased, but `agent_correction_flag` increased?)_

## 4. Solidification (Self-Updating the System Prompt)

If an experiment is a resounding success, the agent must institutionalize the learning.
The agent has the explicit authority to rewrite its own aesthetic and mechanical guidelines.

- It updates `docs/designprofiler/smartout-modern-dark.md` (or similar profile docs) to mandate the new pattern.
- Example: "LEARNING ADDED: Never use native HTML `<select>` elements for lists under 8 items. Always use spatial radio grids. (Proven by EXP-UI-004)."

## 5. The "Rage-Click" Auto-Revert

As a safety mechanism, the loop contains a circuit breaker. If the agent deploys a new UI variant and the Event Motor detects a 300% spike in `rage_click_count` or `abandonment_flag` within the first 100 sessions, the agent must automatically execute a hard-revert to the previous `schema_hash` and log a "Failed State" reflection, preventing that specific UI pattern from being attempted again.

## 6. Cross-Platform Learning Sync

The web `frontend-designer` and mobile `mobile-designer` share a design token foundation and learning loop structure. Insights should flow between them.

- **Shared principles:** `docs/agents/SHARED_DESIGN_PRINCIPLES.md` — universal rules both agents follow
- **Mobile hypothesis ledger:** `docs/agents/mobile-design/hypotheses.md`
- **Mobile decisions:** `docs/agents/mobile-design/decisions.md`

### When to share a learning

Tag an experiment `cross-platform: true` when:

- The insight is about data patterns (e.g., `queryData ?? []` anti-pattern)
- The insight is about state management (e.g., Zustand `useShallow`)
- The insight is about information architecture (e.g., progressive disclosure)
- The insight is about user behavior (e.g., rage clicks on ambiguous CTAs)

Keep platform-specific when:

- The insight is about CSS/Tailwind-specific rendering
- The insight is about Framer Motion choreography
- The insight is about web-only interaction patterns (hover, focus rings)

### Sync process

1. Prove the pattern on your platform first
2. Tag `cross-platform: true` in your hypothesis ledger
3. Add a reference entry in the mobile agent's `docs/agents/mobile-design/hypotheses.md`
4. If broadly proven on both platforms → add to `docs/agents/SHARED_DESIGN_PRINCIPLES.md` section 5 (anti-patterns) or section 3 (interaction principles)
