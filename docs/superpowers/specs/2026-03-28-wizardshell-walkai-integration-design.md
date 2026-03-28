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

Unify wizard <> voice-agent interaction through WalkAi's existing infrastructure. Every wizard that runs in WizardShell gets Emma support automatically. No new abstractions — connect existing systems.

## Council Review (2026-03-28)

Reviewed by System Steward (chair), Supervisor, System Agent Coordinator, Frontend Designer. Verdict: **APPROVE WITH CHANGES**. This spec incorporates all required changes.

## Decisions

| #   | Decision                                                                                | Rationale                                                                                                                                                     |
| --- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Step components own their tools via `useRegisterTools`                                  | Same pattern as schedule page. Tools mount/unmount with component. No WizardStepDef changes needed.                                                           |
| D2  | WizardShell exposes navigation context via `onContextChange` callback — NOT CustomEvent | Keeps `packages/ui` agent-agnostic. App-level code translates to WalkAi context. Mobile-compatible.                                                           |
| D3  | Tools mutate via `updateState()` from WizardStepProps                                   | One source of truth. Emma writes to the same state as the UI. Validation, save logic, onStepLeave all apply regardless of input source.                       |
| D4  | Delete `useBotsson.ts` + `WizardContext.tsx` INCREMENTALLY                              | WalkAi/Emma handles the agent session. But 15 files import `useOnboarding()`. Migration must be incremental — keep thin wrapper until all consumers migrated. |
| D5  | Tool implementations use refs, not closures                                             | `useRegisterTools` compares tool names to skip re-registration. Closures capturing state go stale. Refs ensure fresh state at invocation time.                |
| D6  | Every Emma tool invocation emits telemetry                                              | No mutation without `emit()`. Tool builders categorized by side-effect scope.                                                                                 |
| D7  | Client-side tools have NO authority gating                                              | Acceptable because: user is authenticated, wizard is their own data. Tools hitting APIs rely on endpoint auth. Documented explicitly — not an oversight.      |

## Architecture

```
WizardShell (packages/ui — agent-agnostic)
  |
  |-- useWizardWalkAi (semantic tagging) ........... [exists]
  |-- onContextChange callback ..................... [NEW — prop on WizardShell]
  |
  +-- StepComponent (apps/web — app-specific)
        |-- useRegisterTools("wizard-{id}-{step}", tools)
        |-- tools read state via refs, call updateState()
        |-- domain context push via WalkAi bridge hook
```

Emma (via WalkAi) sees:

- Navigation context: which wizard, which step, how far along
- Step-specific tools: only the current step's tools are registered
- Semantic tags: `data-walkai-*` on all form elements (already exists)
- Domain context: step-specific state summaries

## Detailed Design

### 1. WizardShell Context Callback (replaces CustomEvent)

Instead of emitting `CustomEvent` from `packages/ui` (which would couple the shared package to WalkAi and break React Native compatibility), WizardShell gets a new callback prop.

**Change to `packages/ui/src/wizard/types.ts`:**

```typescript
// New type — exported from packages/ui
export type WizardContextPayload = {
  wizardId: string;
  stepId: string;
  stepIndex: number;
  totalSteps: number;
  completedSteps: string[];
  theme: "dark" | "warm" | "light";
};

// Add to WizardShellProps:
onContextChange?: (context: WizardContextPayload) => void;
```

**Change to `packages/ui/src/wizard/WizardShell.tsx`:**

Call `onContextChange` in the existing `useEffect` that fires on step change (line ~139-145). No new hook needed.

**App-level bridge in `apps/web`:**

```typescript
// apps/web/src/app/walkAi/_hooks/useWizardWalkAiContext.ts
// Translates WizardShell callback into WalkAi context injection
export function useWizardWalkAiContext() {
  const handleContextChange = useCallback((ctx: WizardContextPayload) => {
    // Push to WalkAi's context system (agent.sendContext or provider state)
  }, []);
  return handleContextChange;
}
```

This keeps `packages/ui` fully agent-agnostic. The WalkAi-specific translation lives in `apps/web`.

### 2. Ref-Based Tool Registration (stale closure fix)

**Critical pattern.** `useRegisterTools` compares tool names to skip re-registration. If tools capture `state` in a closure, the implementation becomes stale after state changes. All wizard tools MUST use refs.

**Pattern:**

```typescript
// Example: governance-tools.ts
export function useGovernanceTools(
  state: SetupState,
  updateState: (patch: Partial<SetupState>) => void,
): ClientToolKit {
  // Refs — always fresh at invocation time
  const stateRef = useRef(state);
  const updateRef = useRef(updateState);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    updateRef.current = updateState;
  }, [updateState]);

  // Tools built once — stable reference, never re-creates
  return useMemo(
    () => ({
      definitions: [
        {
          temporaryTool: {
            modelToolName: "toggle_policy",
            description: "Enable or disable a governance policy by name",
            dynamicParameters: [
              {
                name: "policyName",
                location: "PARAMETER_LOCATION_BODY",
                schema: { type: "string", description: "Policy name" },
                required: true,
              },
            ],
            client: {},
          },
        },
        {
          temporaryTool: {
            modelToolName: "get_governance_status",
            description: "Get governance setup status: enabled policies, filter selections",
            dynamicParameters: [],
            client: {},
          },
        },
      ],
      implementations: {
        toggle_policy: (params) => {
          const name =
            typeof params === "string" ? params : (params as Record<string, string>).policyName;
          const current = stateRef.current; // fresh via ref
          // Find and toggle policy, call updateRef.current(...)
          emit({
            event: "button clicked",
            /* ... */ properties: { trackingId: "wizard-tool-toggle-policy" },
          });
          return `Policy "${name}" toggled`;
        },
        get_governance_status: () => {
          const s = stateRef.current;
          const active = s.governance?.filter((p) => p.enabled).length ?? 0;
          const total = s.governance?.length ?? 0;
          return `${active} of ${total} policies enabled`;
        },
      },
    }),
    [],
  ); // empty deps — refs handle freshness
}
```

**Step component usage:**

```typescript
function GovernanceSetupStep({ state, updateState }: WizardStepProps<SetupState>) {
  const tools = useGovernanceTools(state, updateState);
  useRegisterTools("wizard-setup-governance", tools);
  // ... rest of component
}
```

### 3. Domain Context Push from Steps

Step components push domain-specific context via the app-level WalkAi bridge. This is separate from the navigation context (which WizardShell handles via callback).

```typescript
// Inside a step component — uses a WalkAi hook, NOT packages/ui
import { useWalkAiStepContext } from "@/app/walkAi/_hooks/useWalkAiStepContext";

function GovernanceSetupStep({ state }: WizardStepProps<SetupState>) {
  useWalkAiStepContext("setup", "governance", {
    activePolicies: state.governance?.filter((p) => p.enabled).length ?? 0,
    totalPolicies: state.governance?.length ?? 0,
  });
  // ...
}
```

Context strings sent to Emma can be Norwegian (agent-facing, not user-visible UI). Document this as an explicit exception to the i18n rule — Emma's system prompt handles Norwegian natively.

### 4. Onboarding Migration — Full Scope

#### Files importing `useOnboarding()` from `WizardContext.tsx`

**Sections (9 files):**

1. `sections/BusinessSection.tsx` — uses business state, scrape triggers, BRREG lookup
2. `sections/DepartmentsSection.tsx` — uses departments state, add/toggle
3. `sections/LocationsSection.tsx` — uses locations state, add/zones
4. `sections/SeasonSection.tsx` — uses season state
5. `sections/ProceduresSection.tsx` — uses procedures state, toggle
6. `sections/WelcomeSection.tsx` — uses botsson start/status, key facts
7. `sections/HeroSection.tsx` — uses botsson status for ambient visuals
8. `sections/DoneSection.tsx` — uses finalize action
9. `sections/CustomerDocumentView.tsx` — uses business state for display

**Components (6 files):** 10. `components/AmbientBackground.tsx` — reads botsson speaking/listening state for visual effects 11. `components/VoiceSessionOverlay.tsx` — reads botsson transcript, status, mute toggle 12. `components/BigBoard.tsx` — reads full onboarding state for display board 13. `components/AgentControlPanel.tsx` — reads botsson debug log, status controls 14. `components/KeyFactsPanel.tsx` — reads key facts array 15. `components/NavigationController.tsx` — reads section state, scroll position

#### What `useOnboarding()` provides beyond tools

| Concern                                                                 | Current source                                 | Migration path                                                       |
| ----------------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------- |
| Onboarding state (business, season, departments, locations, procedures) | `useOnboardingState` hook inside WizardContext | Moves to WizardShell state via `WizardStepProps`                     |
| Botsson session (status, transcript, mute, connect/disconnect)          | `useBotsson` hook inside WizardContext         | **Replaced by WalkAi/Emma session** — `useAgent()` in WalkAiProvider |
| Key facts panel data                                                    | Local state in WizardContext                   | Move to WalkAi global state or a small context in onboarding layout  |
| Ambient background state (isSpeaking, isListening)                      | Derived from botsson status                    | Read from WalkAi agent status                                        |
| Voice overlay (transcript, controls)                                    | Derived from botsson                           | **Already exists in WalkAi** — EmmaOverlay handles this              |
| Debug panel                                                             | Derived from botsson debugLog                  | Move to WalkAi dev tools or drop                                     |
| Section navigation / scroll                                             | Local state                                    | Move to WizardShell navigation via `goTo()`                          |

#### Migration strategy: incremental, not big-bang

**Phase A:** Add WalkAiProvider to onboarding layout (prerequisite).
**Phase B:** Create tool builders per step, wire `useRegisterTools`.
**Phase C:** Migrate sections 1-9 to use WizardStepProps instead of useOnboarding() for state.
**Phase D:** Migrate components 10-15 to read from WalkAi agent state instead of botsson state.
**Phase E:** Delete `useBotsson.ts` and `WizardContext.tsx`.

During phases B-D, `WizardContext.tsx` stays as a thin compatibility wrapper. Only delete after ALL 15 consumers are migrated.

#### Prerequisite: WalkAiProvider in onboarding

`/onboarding` lives outside DashboardShell. WalkAiProvider (which wraps EmmaOverlay and the agent session) must be added to the onboarding layout:

```
apps/web/src/app/onboarding/layout.tsx
  +-- WalkAiProvider  ← NEW
        +-- existing onboarding content
```

This is a prerequisite for ANY tool registration to work. Without it, `useRegisterTools` has no consumer.

### 5. Telemetry

Tool invocations categorized by side-effect scope:

| Scope                | Tools                                                                              | Emit pattern                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Local state only** | `toggle_policy`, `set_filter`, `set_season_name`, `toggle_employment_type`, etc.   | Emit `wizard.tool_invoked` with `{ wizardId, stepId, toolName }` to `activity_trail`             |
| **External API**     | `searchCompany`, `scrapeWebsite`                                                   | Emit before API call with `{ toolName, endpoint }`                                               |
| **Database write**   | `identifyCompany` (creates workspace), `finalizeOnboarding` (bootstraps workspace) | Emit with `{ toolName, effect: "workspace_created" }`. These are NOT just `updateState()` calls. |
| **Read-only**        | `get_governance_status`, `get_season_status`, etc.                                 | No emit needed                                                                                   |

Register `wizard.tool_invoked` in `packages/telemetry/src/registry.ts` with routing to `activity_trail`.

### 6. Concurrent Input Handling

When Emma calls `updateState()` while the user is actively editing the same field:

**Rule:** If a field has focus (user is editing), Emma's `updateState` for that field is deferred until blur. Other fields update immediately.

**Implementation:** Tool builders check `document.activeElement` before updating a specific field. If the active element matches the target field (via `data-walkai-id`), queue the update and apply on blur. This is a small utility shared across all wizard tools.

### 7. Tool Error Handling

When Emma calls `advance_to_next_step` and validation fails, the tool must return a meaningful error:

```typescript
advance_to_next_step: async () => {
  try {
    await nextRef.current(); // calls WizardShell next()
    return "Advanced to next step";
  } catch {
    // Validation errors are displayed in WizardNavBar
    return "Cannot advance: validation errors on current step. Ask the user to review.";
  }
};
```

All tools must return strings (confirmation or error). Emma uses these to decide what to say.

### 8. Setup Wizard Tools

New tool builders for the 9 setup steps:

| Step            | Key Tools                                                      | Scope            |
| --------------- | -------------------------------------------------------------- | ---------------- |
| Welcome         | `get_setup_status`                                             | read-only        |
| Document Drop   | `upload_document`, `get_extraction_status`                     | api, read-only   |
| Governance      | `toggle_policy`, `set_filter`, `get_governance_status`         | local, read-only |
| Payroll         | `select_tariff`, `add_supplement`, `get_payroll_status`        | local, read-only |
| Employment      | `toggle_employment_type`, `set_terms`, `get_employment_status` | local, read-only |
| Team            | `invite_member`, `get_team_status`                             | api, read-only   |
| Shift Templates | `add_shift_template`, `get_shift_status`                       | local, read-only |
| Season          | `set_season_name`, `set_season_dates`, `get_season_status`     | local, read-only |
| Handbook        | `edit_chapter`, `get_handbook_status`                          | local, read-only |

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

### 9. Onboarding Tool Migration Map

The 13 existing Botsson tools map to onboarding wizard steps:

| Tool                   | Target Step               | Scope     | Notes                                                     |
| ---------------------- | ------------------------- | --------- | --------------------------------------------------------- |
| `getOnboardingState`   | Per-step read             | read-only | Each step returns its own slice                           |
| `updateBusiness`       | Step: business-info       | local     | `updateState({ business: ... })`                          |
| `updateSeason`         | Step: season              | local     | `updateState({ season: ... })`                            |
| `addDepartments`       | Step: confirm-departments | local     | `updateState({ departments: [...] })`                     |
| `addLocations`         | Step: confirm-locations   | local     | `updateState({ locations: [...] })`                       |
| `addZones`             | Step: confirm-locations   | local     | Nested under locations                                    |
| `addProcedures`        | Step: confirm-procedures  | local     | `updateState({ procedures: [...] })`                      |
| `searchCompany`        | Step: business-info       | api       | BRREG external API                                        |
| `identifyCompany`      | Step: business-info       | database  | Creates workspace                                         |
| `scrapeWebsite`        | Step: business-info       | api       | Scraping service                                          |
| `advanceToNextSection` | Per-step                  | local     | Calls `next()` from props                                 |
| `addKeyFact`           | Per-step or global        | local     | If panel exists, register as step tool. If removed, drop. |
| `saveMemory`           | Global                    | database  | Already exists as `save_memory` in walkai-tools.ts        |
| `finalizeOnboarding`   | Step: summary             | database  | Calls `onComplete()`                                      |

**Files to create:**

- `apps/web/src/app/onboarding/steps/tools/business-tools.ts`
- `apps/web/src/app/onboarding/steps/tools/departments-tools.ts`
- `apps/web/src/app/onboarding/steps/tools/locations-tools.ts`
- `apps/web/src/app/onboarding/steps/tools/procedures-tools.ts`
- `apps/web/src/app/onboarding/steps/tools/summary-tools.ts`

## What Changes

| File                                                       | Change                                                                 |
| ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| `packages/ui/src/wizard/types.ts`                          | Add `WizardContextPayload` type, `onContextChange` to WizardShellProps |
| `packages/ui/src/wizard/WizardShell.tsx`                   | Call `onContextChange` in step-change effect                           |
| `packages/ui/src/wizard/index.ts`                          | Export new type                                                        |
| `apps/web/src/app/onboarding/layout.tsx`                   | Wrap with WalkAiProvider                                               |
| `apps/web/src/app/walkAi/_hooks/useWizardWalkAiContext.ts` | **New** — translates callback to WalkAi context                        |
| `apps/web/src/app/walkAi/_hooks/useWalkAiStepContext.ts`   | **New** — step domain context push                                     |
| `packages/telemetry/src/registry.ts`                       | Add `wizard.tool_invoked` event                                        |
| Onboarding steps (5 tool builder files)                    | **New** — migrated from useBotsson                                     |
| Setup steps (9 tool builder files)                         | **New** — Emma tools per step                                          |
| 15 onboarding consumer files                               | Migrate off `useOnboarding()` incrementally                            |
| `apps/web/src/app/onboarding/hooks/useBotsson.ts`          | **Delete** (after Phase E)                                             |
| `apps/web/src/app/onboarding/WizardContext.tsx`            | **Delete** (after Phase E)                                             |

## What Does NOT Change

- `WizardStepDef` type — no tool declarations in definition
- `useWizardWalkAi` — semantic tagging continues as-is
- `useRegisterTools` / `tool-registry.ts` — no modifications needed
- `walkai-tools.ts` global tools — untouched (save_memory already exists)
- `useWizardState` — navigation logic unchanged
- WalkAi agent session management — already handles connect/disconnect

## ADR Required

**ADR: Emma-Wizard Bridge** — covers:

- Tool registration pattern (per-step via `useRegisterTools`)
- Ref-based state access in tool implementations
- WalkAiProvider mounting strategy for non-dashboard routes
- Callback-based context push (not CustomEvent)
- Incremental migration coexistence strategy
- Client-side tools have no C4 authority gating (by design)
- Supersedes ADR-0049 for wizard-specific tools (tools live near consumers, not in agent-sdk)

## Learning to Capture

**Stale closures in useRegisterTools** — The hook compares tool name keys to decide whether to re-register. If tool implementations capture state via closure, they become stale after re-renders. Always use refs for mutable state in WalkAi tool builders. This applies to ALL tool surfaces, not just wizards.
