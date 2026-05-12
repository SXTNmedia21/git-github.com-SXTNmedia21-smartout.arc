---
title: "Unified Wizard Shell in packages/ui"
id: ADR_0060
status: accepted
layer: decision
created: 2026-03-24
updated: 2026-03-24
---

# ADR-0060: Unified Wizard Shell in packages/ui

## Context and Problem Statement

Three wizard implementations (Join, Onboarding, Dashboard Setup) had independent layouts, navigation, progress tracking, state management, and animation systems. Design drift was inevitable — the Join wizard broke when cherry-picked CSS tokens were incomplete, and the Dashboard Setup had 44 hardcoded color violations.

## Decision Drivers

- Design drift between wizards causes recurring bugs
- Mobile parity requires shared logic in packages/, not apps/web/
- Future wizards (employee onboarding, HMS setup) need the same shell
- Walk AI agent integration requires consistent semantic tagging across wizards
- i18n must work from day 1 (Norwegian + English)

## Considered Options

1. **Fix each wizard independently** — patch tokens, keep separate implementations
2. **Shared WizardShell in packages/ui** — config-driven shell, wizard-specific step components
3. **Third-party wizard library** — react-hook-form wizard, formkit, etc.

## Decision Outcome

Chosen option: **"Shared WizardShell in packages/ui"**, because it eliminates drift, enables mobile parity, and provides a consistent arena for Walk AI agents.

**Architecture:**

- `packages/ui/src/wizard/` — Shell layout + logic (no animation deps, React Native compatible)
- `apps/web/src/components/wizard/AnimatedWizardShell.tsx` — framer-motion wrapper (web only)
- Each wizard provides a `WizardDefinition<TState>` config object with steps, theme, and lifecycle hooks
- Three themes: dark, warm, light — applied via `[data-wizard-theme]` CSS attribute
- Validation via `validationKey` field on steps (validates substate, not full state)
- Telemetry: 8 wizard lifecycle events in registry

## Rules & Consequences

- **Good, because** all wizards share layout, navigation, progress, i18n, telemetry, and Walk AI tagging
- **Good, because** step components are free to design their own content within the token system
- **Bad, because** migrating existing wizards requires touching many files (83 files changed)
- **Agent Impact:** New wizards must use WizardShell. Never create standalone wizard layouts. Define a `WizardDefinition` and plug step components into the shell.
