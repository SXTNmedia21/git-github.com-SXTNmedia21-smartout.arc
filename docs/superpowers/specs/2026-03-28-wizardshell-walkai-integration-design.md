---
title: WizardShell + WalkAi Integration
status: draft
updated: 2026-03-28
created: 2026-03-28
module: wizard
tags: [walkai, botsson, emma, wizard, onboarding, setup, voice-agent]
---

# WizardShell + WalkAi Integration — Design Spec

## Problem

Two parallel systems exist for voice-agent interaction with wizards:

1. **WalkAi** (`apps/web/src/app/walkAi/`) — Emma's runtime with dynamic tool registry (`useRegisterTools`), global tools, page-specific tools, authority config. Used by dashboard pages.
2. **Botsson** (`apps/web/src/app/onboarding/hooks/useBotsson.ts` + `WizardContext.tsx`) — 1076 lines of hardcoded Ultravox integration with 13 client tools. Only understands the onboarding wizard. Runs its own `UltravoxSession` outside WalkAi.

WizardShell already has WalkAi awareness via `useWizardWalkAi` (semantic `data-walkai-*` tagging on every element). But no wizard actually registers tools in WalkAi's tool registry. The setup wizard has no voice-agent support at all.

## Goal

Unify wizard ↔ voice-agent interaction through WalkAi's existing infrastructure. Every wizard that runs in WizardShell gets Emma support automatically. No new abstractions — connect existing systems.

## Decisions

| #   | Decision                                                       | Rationale                                                                                                                               |
| --- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Step components own their tools via `useRegisterTools`         | Same pattern as schedule page. Tools mount/unmount with component. No WizardStepDef changes needed.                                     |
| D2  | WizardShell pushes navigation context to WalkAi on step change | Shell knows wizard-id, step, progress. Cheap to push. Step components push domain-specific context on top.                              |
| D3  | Tools mutate via `updateState()` from WizardStepProps          | One source of truth. Emma writes to the same state as the UI. Validation, save logic, onStepLeave all apply regardless of input source. |
| D4  | Delete `useBotsson.ts` + `WizardContext.tsx`                   | WalkAi/Emma handles the agent session. Onboarding becomes a normal WizardShell consumer. 13 tools migrate to step components.           |

## Architecture

```
WizardShell
  |
  |-- useWizardWalkAi (semantic tagging) ........... [exists]
  |-- useWizardContext (navigation context push) .... [NEW — small hook]
  |
  +-- StepComponent
        |-- useRegisterTools("wizard-{id}-{step}", tools)
        |-- tools call updateState() / external APIs
        |-- domain context push on mount + state change
```

Emma (via WalkAi) sees:

- Navigation context: which wizard, which step, how far along
- Step-specific tools: only the current step's tools are registered
- Semantic tags: `data-walkai-*` on all form elements (already exists)
- Domain context: step-specific state summaries

## Detailed Design

### 1. WizardShell Context Push

A new hook `useWizardContext` inside WizardShell that pushes wizard navigation state to WalkAi whenever the step changes.

**Location:** `packages/ui/src/wizard/useWizardContext.ts`

**Mechanism:** WalkAi needs a lightweight context channel. Two options:

- **Option A: Custom event** — `window.dispatchEvent(new CustomEvent("walkai:context", { detail }))`. WalkAiProvider listens. No import coupling between `packages/ui` and `apps/web`.
- **Option B: data attributes** — Already done. The shell root div has `data-walkai-context` with `{ wizardId, currentStep, currentStepIndex, totalSteps, theme }`. WalkAi can read this from DOM.

**Recommendation: Option A** — events are reactive (WalkAi gets notified on change), DOM attributes require polling.

**Payload shape:**

```typescript
type WizardContextEvent = {
  type: "wizard:step_changed";
  wizardId: string;
  stepId: string;
  stepIndex: number;
  totalSteps: number;
  completedSteps: string[];
  theme: "dark" | "warm" | "light";
};
```

**Hook implementation (in WizardShell):**

```typescript
// packages/ui/src/wizard/useWizardContext.ts
import { useEffect } from "react";

export function useWizardContext(
  wizardId: string,
  stepId: string,
  stepIndex: number,
  totalSteps: number,
  completedSteps: string[],
  theme: string,
) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("walkai:context", {
        detail: {
          type: "wizard:step_changed",
          wizardId,
          stepId,
          stepIndex,
          totalSteps,
          completedSteps,
          theme,
        },
      }),
    );
  }, [wizardId, stepId, stepIndex, totalSteps, completedSteps, theme]);
}
```

WizardShell calls this hook with the current state. WalkAiProvider (or a dedicated listener) picks up the event and includes it in Emma's context window.

### 2. Step-Level Tool Registration

Each step component that wants Emma support calls `useRegisterTools` with a memoized toolkit.

**Pattern:**

```typescript
// Example: GovernanceSetupStep.tsx
import { useRegisterTools } from "@/app/walkAi/_components/tool-registry";
import { useMemo } from "react";

function GovernanceSetupStep({ state, updateState, walkai }: WizardStepProps<SetupState>) {
  const tools = useMemo(() => buildGovernanceTools(state, updateState), [state, updateState]);
  useRegisterTools("wizard-setup-governance", tools);

  // ... rest of component
}
```

**Tool builder pattern (per step):**

```typescript
// Example: governance-tools.ts
import type { ClientToolKit } from "@smartout/agent-sdk";

export function buildGovernanceTools(
  state: SetupState,
  updateState: (patch: Partial<SetupState>) => void,
): ClientToolKit {
  return {
    definitions: [
      {
        temporaryTool: {
          modelToolName: "toggle_policy",
          description: "Enable or disable a governance policy by name",
          dynamicParameters: [
            {
              name: "policyName",
              location: "PARAMETER_LOCATION_BODY",
              schema: { type: "string", description: "Name of the policy to toggle" },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "get_governance_status",
          description:
            "Get current governance setup: which policies are enabled, filter selections",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    implementations: {
      toggle_policy: (params) => {
        const name =
          typeof params === "string" ? params : (params as Record<string, string>).policyName;
        // Find policy in state, toggle it via updateState
        // Return confirmation string for Emma
        return `Policy "${name}" toggled`;
      },
      get_governance_status: () => {
        const active = state.governance?.filter((p) => p.enabled).length ?? 0;
        const total = state.governance?.length ?? 0;
        return `${active} of ${total} policies enabled`;
      },
    },
  };
}
```

### 3. Domain Context Push from Steps

Step components push domain-specific context via the same CustomEvent mechanism:

```typescript
// Inside a step component
useEffect(() => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("walkai:context", {
      detail: {
        type: "wizard:step_context",
        wizardId: "setup",
        stepId: "governance",
        summary: `${activeCount} av ${totalCount} retningslinjer aktivert. Filtre: ${activeFilters.join(", ")}`,
      },
    }),
  );
}, [activeCount, totalCount, activeFilters]);
```

### 4. Onboarding Migration

The 13 existing Botsson tools map to onboarding wizard steps:

| Tool                   | Target Step               | Notes                                             |
| ---------------------- | ------------------------- | ------------------------------------------------- |
| `getOnboardingState`   | Global (all steps)        | Read-only, register at wizard level or each step  |
| `updateBusiness`       | Step: business-info       | Calls `updateState({ business: ... })`            |
| `updateSeason`         | Step: season              | Calls `updateState({ season: ... })`              |
| `addDepartments`       | Step: confirm-departments | Calls `updateState({ departments: [...] })`       |
| `addLocations`         | Step: confirm-locations   | Calls `updateState({ locations: [...] })`         |
| `addZones`             | Step: confirm-locations   | Nested under locations                            |
| `addProcedures`        | Step: confirm-procedures  | Calls `updateState({ procedures: [...] })`        |
| `searchCompany`        | Step: business-info       | External API call, returns candidates             |
| `identifyCompany`      | Step: business-info       | External API call, creates workspace              |
| `scrapeWebsite`        | Step: business-info       | External API call via scraping service            |
| `advanceToNextSection` | Global (all steps)        | Calls `next()` from WizardStepProps               |
| `addKeyFact`           | Global (all steps)        | Visual panel update — may need WalkAi global tool |
| `saveMemory`           | Global (all steps)        | Persists to engine_memory — WalkAi global tool    |
| `finalizeOnboarding`   | Step: summary             | Calls wizard `onComplete()`                       |

**Cross-step tools** (`advanceToNextSection`, `addKeyFact`, `saveMemory`, `getOnboardingState`):

- `advanceToNextSection` → each step registers it, calling `next()` from props
- `saveMemory` → already exists as global WalkAi tool (`save_memory` in `walkai-tools.ts`)
- `addKeyFact` → onboarding-specific visual panel. If the panel exists in the new onboarding flow, register as a step tool. If removed, drop this tool entirely.
- `getOnboardingState` → each step registers its own read, returning step-relevant state

**Files to delete:**

- `apps/web/src/app/onboarding/hooks/useBotsson.ts` (712 lines)
- `apps/web/src/app/onboarding/WizardContext.tsx` (364 lines)

**Files to create (tool builders per step):**

- `apps/web/src/app/onboarding/steps/tools/business-tools.ts`
- `apps/web/src/app/onboarding/steps/tools/departments-tools.ts`
- `apps/web/src/app/onboarding/steps/tools/locations-tools.ts`
- `apps/web/src/app/onboarding/steps/tools/procedures-tools.ts`
- `apps/web/src/app/onboarding/steps/tools/summary-tools.ts`

### 5. Setup Wizard Tools

New tool builders for the 9 setup steps:

| Step            | Key Tools                                                      |
| --------------- | -------------------------------------------------------------- |
| Welcome         | `get_setup_status` (read progress)                             |
| Document Drop   | `upload_document`, `get_extraction_status`                     |
| Governance      | `toggle_policy`, `set_filter`, `get_governance_status`         |
| Payroll         | `select_tariff`, `add_supplement`, `get_payroll_status`        |
| Employment      | `toggle_employment_type`, `set_terms`, `get_employment_status` |
| Team            | `invite_member`, `get_team_status`                             |
| Shift Templates | `add_shift_template`, `get_shift_status`                       |
| Season          | `set_season_name`, `set_season_dates`, `get_season_status`     |
| Handbook        | `edit_chapter`, `get_handbook_status`                          |

Every step also registers `advance_to_next_step` (calls `next()`) and `go_back` (calls `back()`).

**Files to create:**

- `apps/web/src/components/dashboard/wizard-steps/tools/welcome-tools.ts`
- `apps/web/src/components/dashboard/wizard-steps/tools/document-drop-tools.ts`
- `apps/web/src/components/dashboard/wizard-steps/tools/governance-tools.ts`
- `apps/web/src/components/dashboard/wizard-steps/tools/payroll-tools.ts`
- `apps/web/src/components/dashboard/wizard-steps/tools/employment-tools.ts`
- `apps/web/src/components/dashboard/wizard-steps/tools/team-tools.ts`
- `apps/web/src/components/dashboard/wizard-steps/tools/shift-template-tools.ts`
- `apps/web/src/components/dashboard/wizard-steps/tools/season-tools.ts`
- `apps/web/src/components/dashboard/wizard-steps/tools/handbook-tools.ts`

### 6. WalkAi Context Listener

WalkAiProvider needs to listen for `walkai:context` events and include them in Emma's context.

**Location:** `apps/web/src/app/walkAi/_components/WalkAiProvider.tsx`

**Addition:**

```typescript
useEffect(() => {
  const handler = (e: CustomEvent) => {
    const { type, ...payload } = e.detail;
    if (type === "wizard:step_changed") {
      setWizardContext(payload); // stored in provider state
    } else if (type === "wizard:step_context") {
      setStepContext(payload); // merged into context
    }
  };
  window.addEventListener("walkai:context", handler as EventListener);
  return () => window.removeEventListener("walkai:context", handler as EventListener);
}, []);
```

The combined wizard + step context is passed to Emma's system prompt or context injection point.

## What Changes

| File                                                        | Change                              |
| ----------------------------------------------------------- | ----------------------------------- |
| `packages/ui/src/wizard/useWizardContext.ts`                | **New** — context push hook         |
| `packages/ui/src/wizard/WizardShell.tsx`                    | Add `useWizardContext` call         |
| `packages/ui/src/wizard/index.ts`                           | Export new hook                     |
| `apps/web/src/app/walkAi/_components/WalkAiProvider.tsx`    | Add `walkai:context` event listener |
| `apps/web/src/app/onboarding/hooks/useBotsson.ts`           | **Delete**                          |
| `apps/web/src/app/onboarding/WizardContext.tsx`             | **Delete**                          |
| `apps/web/src/app/onboarding/steps/tools/*.ts`              | **New** — 5 tool builder files      |
| `apps/web/src/app/onboarding/steps/*.tsx`                   | Add `useRegisterTools` call         |
| `apps/web/src/components/dashboard/wizard-steps/tools/*.ts` | **New** — 9 tool builder files      |
| `apps/web/src/components/dashboard/wizard-steps/*.tsx`      | Add `useRegisterTools` call         |

## What Does NOT Change

- `WizardStepDef` type — no tool declarations in definition
- `useWizardWalkAi` — semantic tagging continues as-is
- `useRegisterTools` / `tool-registry.ts` — no modifications
- `walkai-tools.ts` global tools — untouched (save_memory already exists)
- `useWizardState` — navigation logic unchanged
- WalkAi agent session management — already handles connect/disconnect

## Scope

- ~1076 lines deleted (useBotsson + WizardContext)
- ~14 new tool builder files (5 onboarding + 9 setup)
- ~1 new hook in packages/ui (useWizardContext, ~20 lines)
- ~1 listener addition in WalkAiProvider (~15 lines)
- ~15 step components get `useRegisterTools` call (~5 lines each)
- No new packages, no new abstractions, no WizardShell type changes
