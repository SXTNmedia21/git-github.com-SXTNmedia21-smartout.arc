---
title: "Emma-Wizard Bridge: tool-based agent control over wizard flows"
id: ADR-0070
status: accepted
layer: decision
created: 2026-03-28
updated: 2026-03-28
module: onboarding
tags: [walkai, wizard, tools, onboarding, voice-agent]
---

# ADR-0070: Emma-Wizard Bridge: tool-based agent control over wizard flows

## Context and Problem Statement

Two parallel voice-agent systems existed: WalkAi (Emma's runtime with dynamic tool registry) and Botsson (1076 lines of hardcoded Ultravox integration for onboarding). Both did the same thing — let a voice agent interact with wizard forms — but through incompatible mechanisms. The setup wizard had no voice-agent support at all. Maintaining two separate integration paths creates divergence in behaviour, duplicates logic, and blocks Emma from working in wizard contexts.

## Decision Drivers

- Eliminate duplicate voice-agent integration paths (Botsson + WalkAi)
- Allow each wizard step to opt into Emma support independently
- Keep `packages/ui` agent-agnostic (no WalkAi imports in the shared package)
- Prevent stale closures when tool implementations read state
- Support WalkAiProvider outside DashboardShell (onboarding runs before a workspace is loaded)
- Enable incremental migration without breaking existing flows

## Considered Options

1. **Keep Botsson** — maintain the hardcoded Ultravox integration for onboarding, add parallel support for setup wizard
2. **Central tool registry in WizardShell** — WizardShell registers all tools for all steps upfront
3. **Step-level tool registration via `useRegisterTools`** — each step owns its tools, registers on mount, deregisters on unmount

## Decision Outcome

Chosen option: **"Step-level tool registration via `useRegisterTools`"**, because it mirrors the proven pattern from the schedule page, keeps tool logic co-located with the step that owns the data, and allows incremental adoption without touching unrelated steps.

## Rules & Consequences

- **Good, because** every wizard step can opt into Emma support by adding ~20 lines (tool hook + `useRegisterTools`)
- **Good, because** step components own their tools — tools register on mount, deregister on unmount, no central coordination needed
- **Good, because** `packages/ui` stays agent-agnostic — `WizardShell` exposes an `onContextChange` callback (not a CustomEvent), app-level code translates to WalkAi context injection via `sendContext()`
- **Good, because** ref-based tool implementations prevent stale closure bugs — `useRegisterTools` compares tool names to skip re-registration; all implementations read state via `useRef`, never closure captures
- **Good, because** Emma writes to wizard state via `updateState()`, so validation, save logic, and `onStepLeave` apply regardless of whether input came from voice or keyboard
- **Bad, because** `WalkAiProvider` must wrap any route that uses wizard tools, not just dashboard routes
- **Bad, because** tool definitions must be static per step (the empty-deps `useMemo` pattern does not support dynamic tool lists)
- **Agent Impact:** Onboarding Botsson tools are migrated to step-level registration. Old Botsson files are deleted after verification. New wizard steps that need voice support must implement a tool hook and call `useRegisterTools` — not register tools in any central location.

## Additional Decisions

| #   | Decision                                                                                      | Rationale                                                                                 |
| --- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | `useEntityDrawer` made optional via `useEntityDrawerOptional()`                               | WalkAiProvider must work outside DashboardShell where no EntityDrawer context exists      |
| 2   | Client-side wizard tools have no C4 authority gating — by design                              | User is authenticated and editing their own data; API-calling tools rely on endpoint auth |
| 3   | `agent tool_called` telemetry event (capability: `"wizard"`) tracks all Emma tool invocations | Provides observability without coupling tool logic to telemetry internals                 |

## Supersedes

ADR-0049 for wizard-specific tools. That ADR placed all tools in `packages/agent-sdk/src/tools/`. Wizard tools are tightly coupled to `updateState()` and `WizardStepProps`, so they live near their step components instead.

---

> Registered in `docs/decisions/0000-decision-log.md`.
