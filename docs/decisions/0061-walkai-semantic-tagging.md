---
title: "Walk AI Semantic Tagging Convention"
id: ADR-0061
status: accepted
layer: decision
created: 2026-03-24
updated: 2026-03-24
---

# ADR-0061: Walk AI Semantic Tagging Convention

## Context and Problem Statement

Walk AI agents need to discover and interact with UI elements. Existing `data-walkai-*` attributes (`no-drag`, `no-expand`, `content`) are behavioral flags, not semantic identifiers. There is no standard way for agents to find form fields, understand their purpose, or navigate wizard flows.

## Decision Drivers

- Agents must discover UI elements without hardcoded selectors
- Tags must survive SSR, work across frameworks, and align with Playwright selectors
- Convention must be lightweight (zero runtime cost when no agent is connected)
- Must work for wizards now and extend to all interactive surfaces later

## Considered Options

1. **ARIA attributes only** — use existing aria-label, role, etc.
2. **data-testid pattern** — reuse testing selectors for agent discovery
3. **Dedicated data-walkai-\* semantic convention** — id, intent, type, context

## Decision Outcome

Chosen option: **"Dedicated data-walkai-\* semantic convention"**, because ARIA is for accessibility (different purpose) and data-testid lacks intent/context fields.

**Convention:**

- `data-walkai-id` — kebab-case, format `{page}-{component}-{element}` (e.g., `join-account-email-input`)
- `data-walkai-intent` — human-readable description of what the element does (e.g., "Enter email address")
- `data-walkai-type` — element classification: `input`, `button`, `select`, `checkbox`, `wizard`, `wizard-step`
- `data-walkai-context` — optional JSON with metadata (e.g., `{"required":true,"fieldType":"email"}`)

**Helper:** `useWizardWalkAi(wizardId, stepId)` provides `id()` and `tag()` functions that generate correct attributes.

## Rules & Consequences

- **Good, because** agents discover elements by querying `[data-walkai-type="input"]` or `[data-walkai-intent*="email"]`
- **Good, because** zero runtime cost — just HTML attributes
- **Bad, because** new convention to learn and maintain
- **Agent Impact:** All new interactive components should include `data-walkai-id` and `data-walkai-intent`. Use the `walkai.tag()` helper in wizard steps.
