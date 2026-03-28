---
title: WizardShell + WalkAi Integration Plan
status: draft
updated: 2026-03-28
created: 2026-03-28
module: wizard
tags: [walkai, botsson, emma, wizard, onboarding, setup, voice-agent]
---

# WizardShell + WalkAi Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify wizard voice-agent interaction through WalkAi's existing tool registry so Emma can drive any wizard (onboarding + setup) through the same infrastructure, then delete the legacy Botsson parallel system.

**Architecture:** Step components register their own tools via `useRegisterTools` on mount/unmount (same pattern as schedule page). WizardShell exposes a callback for navigation context. Tool implementations use refs to avoid stale closures. Onboarding migration is incremental across 5 phases.

**Tech Stack:** React 19, TypeScript, @smartout/agent-sdk (ClientToolKit), @smartout/ui (WizardShell), @smartout/telemetry (emit), Ultravox client tools

**Spec:** `docs/superpowers/specs/2026-03-28-wizardshell-walkai-integration-design.md`

---

## File Structure

### New files

| File                                                                   | Responsibility                                                |
| ---------------------------------------------------------------------- | ------------------------------------------------------------- |
| `packages/ui/src/wizard/types.ts`                                      | Add `WizardContextPayload` type (MODIFY)                      |
| `packages/ui/src/wizard/WizardShell.tsx`                               | Add `onContextChange` prop + call (MODIFY)                    |
| `packages/ui/src/wizard/index.ts`                                      | Export new type (MODIFY)                                      |
| `apps/web/src/app/walkAi/_hooks/useWizardWalkAiContext.ts`             | Translates WizardShell callback into WalkAi context injection |
| `apps/web/src/lib/wizard-tools/shared.ts`                              | Shared ref-based tool builder helpers + nav tools             |
| `apps/web/src/components/dashboard/wizard-steps/tools/season-tools.ts` | Season step tool builder (proof of concept)                   |
| `apps/web/src/components/wizard/AnimatedWizardShell.tsx`               | Wire `onContextChange` (MODIFY)                               |

### Files modified later (per-step tool builders, listed for reference)

| File                                                                           | Phase            |
| ------------------------------------------------------------------------------ | ---------------- |
| `apps/web/src/components/dashboard/wizard-steps/tools/welcome-tools.ts`        | Setup tools      |
| `apps/web/src/components/dashboard/wizard-steps/tools/governance-tools.ts`     | Setup tools      |
| `apps/web/src/components/dashboard/wizard-steps/tools/payroll-tools.ts`        | Setup tools      |
| `apps/web/src/components/dashboard/wizard-steps/tools/employment-tools.ts`     | Setup tools      |
| `apps/web/src/components/dashboard/wizard-steps/tools/team-tools.ts`           | Setup tools      |
| `apps/web/src/components/dashboard/wizard-steps/tools/shift-template-tools.ts` | Setup tools      |
| `apps/web/src/components/dashboard/wizard-steps/tools/handbook-tools.ts`       | Setup tools      |
| `apps/web/src/components/dashboard/wizard-steps/tools/document-drop-tools.ts`  | Setup tools      |
| `apps/web/src/app/onboarding/steps/tools/departments-tools.ts`                 | Onboarding tools |
| `apps/web/src/app/onboarding/steps/tools/locations-tools.ts`                   | Onboarding tools |
| `apps/web/src/app/onboarding/steps/tools/procedures-tools.ts`                  | Onboarding tools |
| `apps/web/src/app/onboarding/steps/tools/business-tools.ts`                    | Onboarding tools |
| `apps/web/src/app/onboarding/steps/tools/summary-tools.ts`                     | Onboarding tools |

---

## Task 1: Add `WizardContextPayload` type and `onContextChange` callback

This is the core infrastructure change in `packages/ui`. Adds a callback prop so app-level code can react to wizard navigation changes without coupling `packages/ui` to WalkAi.

**Files:**

- Modify: `packages/ui/src/wizard/types.ts`
- Modify: `packages/ui/src/wizard/WizardShell.tsx`
- Modify: `packages/ui/src/wizard/index.ts`

- [ ] **Step 1: Add `WizardContextPayload` type to `types.ts`**

At the end of `packages/ui/src/wizard/types.ts`, before `WizardState`, add:

```typescript
// -- Wizard context payload for external consumers (WalkAi, telemetry) --

export type WizardContextPayload = {
  wizardId: string;
  stepId: string;
  stepIndex: number;
  totalSteps: number;
  completedSteps: string[];
  theme: "dark" | "warm" | "light";
};
```

- [ ] **Step 2: Add `onContextChange` to `WizardShellProps` in `WizardShell.tsx`**

In `WizardShell.tsx`, add to the `WizardShellProps` interface:

```typescript
onContextChange?: (context: WizardContextPayload) => void;
```

Destructure it in the component params alongside other callbacks.

- [ ] **Step 3: Call `onContextChange` in the step-change effect**

In `WizardShell.tsx`, find the existing `useEffect` that fires on step change (the one calling `onStepChange`). Add the `onContextChange` call:

```typescript
useEffect(() => {
  setValidationErrors([]);
  setAttempted(false);
  if (currentStep) {
    onStepChange?.(currentStep.id, currentStepIndex);
    onContextChange?.({
      wizardId: definition.id,
      stepId: currentStep.id,
      stepIndex: currentStepIndex,
      totalSteps,
      completedSteps: Array.from(completedSteps),
      theme: definition.theme,
    });
  }
}, [
  currentStep,
  currentStepIndex,
  onStepChange,
  onContextChange,
  definition.id,
  totalSteps,
  completedSteps,
  definition.theme,
]);
```

Note: `completedSteps` comes from `useWizardState` as a `Set`. The `Array.from()` call converts it for the payload. The `useEffect` dependency on a Set is stable (same reference until mutation).

- [ ] **Step 4: Export the new type from `index.ts`**

In `packages/ui/src/wizard/index.ts`, add to the type exports:

```typescript
export type {
  WizardDefinition,
  WizardStepDef,
  WizardStepProps,
  WizardThemeTokens,
  WizardState,
  WalkAiHelper,
  WalkAiDataAttributes,
  WizardContextPayload, // NEW
} from "./types";
```

- [ ] **Step 5: Verify typecheck passes**

Run: `pnpm turbo typecheck --filter=@smartout/ui`

Expected: 0 errors. The new prop is optional so no consumers break.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/wizard/types.ts packages/ui/src/wizard/WizardShell.tsx packages/ui/src/wizard/index.ts
git commit -m "feat(ui): add onContextChange callback to WizardShell

Exposes wizard navigation context via callback prop so app-level
code can translate it to WalkAi context injection. Keeps packages/ui
fully agent-agnostic — no CustomEvent, no WalkAi imports.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Create shared wizard tool helpers

A small utility module with the ref-based pattern and shared navigation tools (advance/back) that every step will use.

**Files:**

- Create: `apps/web/src/lib/wizard-tools/shared.ts`

- [ ] **Step 1: Create the shared module**

```typescript
// apps/web/src/lib/wizard-tools/shared.ts
"use client";

/**
 * Shared helpers for wizard tool builders.
 *
 * All wizard tools use refs to avoid stale closures — useRegisterTools
 * compares tool names (not implementations) to skip re-registration,
 * so closures captured at registration time would go stale.
 *
 * Every mutating tool emits "agent tool_called" telemetry.
 */

import { useRef, useEffect, useMemo } from "react";
import { emit } from "@smartout/telemetry";
import type {
  ClientToolKit,
  ClientToolDefinition,
  ClientToolImplementation,
} from "@smartout/agent-sdk";

// ─── Ref helpers ──────────────────────────────────────────

/** Keep a ref synced with a value. Returns the ref. */
export function useSyncRef<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

// ─── Telemetry helper ─────────────────────────────────────

export function emitToolInvoked(
  wizardId: string,
  stepId: string,
  toolName: string,
  workspaceId: string,
  actorId: string,
) {
  void emit({
    event: "agent tool_called",
    workspace_id: workspaceId,
    actor_id: actorId,
    properties: {
      entity: { type: "workspace", id: workspaceId },
      data: { tool_name: toolName, capability: "wizard", success: true },
    },
  });
}

// ─── Navigation tool definitions ──────────────────────────

/** Standard navigation tool definitions shared by every wizard step. */
export const NAV_TOOL_DEFINITIONS: ClientToolDefinition[] = [
  {
    temporaryTool: {
      modelToolName: "advance_to_next_step",
      description:
        "Move to the next wizard step. Runs validation first — returns error if validation fails.",
      dynamicParameters: [],
      client: {},
    },
  },
  {
    temporaryTool: {
      modelToolName: "go_back",
      description: "Go back to the previous wizard step.",
      dynamicParameters: [],
      client: {},
    },
  },
];

/**
 * Build navigation tool implementations using refs to next/back.
 * Call this inside useMemo with empty deps — refs handle freshness.
 */
export function buildNavImplementations(
  nextRef: React.RefObject<(() => void | Promise<void>) | undefined>,
  backRef: React.RefObject<(() => void) | undefined>,
): Record<string, ClientToolImplementation> {
  return {
    advance_to_next_step: async () => {
      try {
        await nextRef.current?.();
        return "Advanced to next step successfully.";
      } catch {
        return "Cannot advance: validation errors on current step. Ask the user to review the highlighted fields.";
      }
    },
    go_back: () => {
      backRef.current?.();
      return "Moved back to the previous step.";
    },
  };
}

// ─── Tool kit builder ─────────────────────────────────────

/**
 * Merge step-specific tools with navigation tools into a single toolkit.
 * Returns a stable reference (useMemo with empty deps).
 */
export function useWizardToolKit(
  stepDefinitions: ClientToolDefinition[],
  stepImplementations: Record<string, ClientToolImplementation>,
  nextRef: React.RefObject<(() => void | Promise<void>) | undefined>,
  backRef: React.RefObject<(() => void) | undefined>,
): ClientToolKit {
  return useMemo(
    () => ({
      definitions: [...stepDefinitions, ...NAV_TOOL_DEFINITIONS],
      implementations: {
        ...stepImplementations,
        ...buildNavImplementations(nextRef, backRef),
      },
    }),
    [], // empty deps — refs handle freshness
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm turbo typecheck --filter=web`

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/wizard-tools/shared.ts
git commit -m "feat(wizard-tools): add shared ref-based tool builder helpers

Provides useSyncRef, emitToolInvoked, navigation tool definitions,
and useWizardToolKit merger. All wizard steps will use these to
avoid the stale closure trap in useRegisterTools.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Create WalkAi context bridge hook

The app-level hook that translates WizardShell's `onContextChange` callback into WalkAi context injection.

**Files:**

- Create: `apps/web/src/app/walkAi/_hooks/useWizardWalkAiContext.ts`

- [ ] **Step 1: Create the bridge hook**

```typescript
// apps/web/src/app/walkAi/_hooks/useWizardWalkAiContext.ts
"use client";

/**
 * Bridge between WizardShell (packages/ui) and WalkAi context system.
 *
 * WizardShell fires onContextChange with navigation payload.
 * This hook translates that into a format WalkAi can inject
 * into Emma's context window.
 *
 * Lives in apps/web (not packages/ui) to keep the shared
 * package agent-agnostic.
 */

import { useState, useCallback } from "react";
import type { WizardContextPayload } from "@smartout/ui";

/** The current wizard context, or null if no wizard is active. */
export type WizardContext = WizardContextPayload | null;

/**
 * Returns a callback to pass as WizardShell's onContextChange prop,
 * plus the latest wizard context for consumption by WalkAiProvider.
 */
export function useWizardWalkAiContext() {
  const [wizardContext, setWizardContext] = useState<WizardContext>(null);

  const handleContextChange = useCallback((ctx: WizardContextPayload) => {
    setWizardContext(ctx);
  }, []);

  /** Call when wizard unmounts to clear context */
  const clearContext = useCallback(() => {
    setWizardContext(null);
  }, []);

  return { wizardContext, handleContextChange, clearContext } as const;
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm turbo typecheck --filter=web`

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/walkAi/_hooks/useWizardWalkAiContext.ts
git commit -m "feat(walkai): add wizard context bridge hook

Translates WizardShell onContextChange callback into WalkAi
context state. Lives in apps/web to keep packages/ui agent-agnostic.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Wire `onContextChange` in AnimatedWizardShell

Connect the new callback through the layer that wraps WizardShell.

**Files:**

- Modify: `apps/web/src/components/wizard/AnimatedWizardShell.tsx`

- [ ] **Step 1: Add `onContextChange` prop to `AnimatedWizardShellProps`**

In `AnimatedWizardShell.tsx`, add to the interface:

```typescript
interface AnimatedWizardShellProps<TState extends Record<string, unknown>> {
  definition: WizardDefinition<TState>;
  workspaceId?: string | null;
  actorId?: string;
  onContextChange?: (context: import("@smartout/ui").WizardContextPayload) => void; // NEW
}
```

Destructure it in the component params.

- [ ] **Step 2: Pass it to WizardShell**

In the `<WizardShell>` JSX at the bottom of the file, add the prop:

```typescript
<WizardShell
  definition={definition}
  t={t}
  onStepChange={telemetry.onStepChange}
  onStepComplete={telemetry.onStepComplete}
  onStepSkip={telemetry.onStepSkip}
  onStepBack={telemetry.onStepBack}
  onComplete={telemetry.onComplete}
  onValidationFail={telemetry.onValidationFail}
  onContextChange={onContextChange}   // NEW
  renderStep={renderStep}
  renderBrandPanel={definition.brandPanel ? renderBrandPanel : undefined}
/>
```

- [ ] **Step 3: Wire it in the setup wizard page**

In `apps/web/src/app/dashboard/setup/page.tsx`, import and use the bridge hook:

```typescript
import { useWizardWalkAiContext } from "@/app/walkAi/_hooks/useWizardWalkAiContext";

export default function DashboardSetupPage() {
  // ... existing code ...
  const { handleContextChange } = useWizardWalkAiContext();

  return (
    <Suspense fallback={...}>
      <div className="relative flex h-full flex-col">
        {/* ... skip button ... */}
        <AnimatedWizardShell
          definition={dashboardSetupWizard}
          workspaceId={workspace.workspace_id}
          actorId={profileId ?? "anonymous"}
          onContextChange={handleContextChange}   // NEW
        />
      </div>
    </Suspense>
  );
}
```

- [ ] **Step 4: Verify typecheck**

Run: `pnpm turbo typecheck --filter=web`

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/wizard/AnimatedWizardShell.tsx apps/web/src/app/dashboard/setup/page.tsx
git commit -m "feat(wizard): wire onContextChange through AnimatedWizardShell

Setup wizard now pushes navigation context to WalkAi on every
step change via the bridge hook.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Build season step tools (proof of concept)

Create the first real tool builder for one setup wizard step. Season is the simplest step (name + two dates), making it ideal for proving the pattern.

**Files:**

- Create: `apps/web/src/components/dashboard/wizard-steps/tools/season-tools.ts`
- Modify: `apps/web/src/components/dashboard/wizard-steps/SeasonSetupStep.tsx`

- [ ] **Step 1: Create the season tool builder**

```typescript
// apps/web/src/components/dashboard/wizard-steps/tools/season-tools.ts
"use client";

import { useMemo } from "react";
import type { ClientToolDefinition, ClientToolImplementation } from "@smartout/agent-sdk";
import { useSyncRef, useWizardToolKit } from "@/lib/wizard-tools/shared";

/**
 * Tools Emma can use on the Season setup step.
 *
 * Reads/writes via refs — never captures state in closure.
 * See: docs/superpowers/specs/2026-03-28-wizardshell-walkai-integration-design.md §2
 */
export function useSeasonTools(
  name: string,
  startDate: string,
  endDate: string,
  setName: (v: string) => void,
  setStartDate: (v: string) => void,
  setEndDate: (v: string) => void,
  handleSave: () => Promise<void>,
  next: () => void | Promise<void>,
  back: () => void,
) {
  const nameRef = useSyncRef(name);
  const startRef = useSyncRef(startDate);
  const endRef = useSyncRef(endDate);
  const setNameRef = useSyncRef(setName);
  const setStartRef = useSyncRef(setStartDate);
  const setEndRef = useSyncRef(setEndDate);
  const saveRef = useSyncRef(handleSave);
  const nextRef = useSyncRef(next);
  const backRef = useSyncRef(back);

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "set_season_name",
          description: "Set the season name. Example: 'Sommersesong 2026'",
          dynamicParameters: [
            {
              name: "name",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: { type: "string", description: "Season name" },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "set_season_dates",
          description:
            "Set the season start and end dates. Format: YYYY-MM-DD. End must be after start.",
          dynamicParameters: [
            {
              name: "startDate",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: { type: "string", description: "Start date (YYYY-MM-DD)" },
              required: true,
            },
            {
              name: "endDate",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: { type: "string", description: "End date (YYYY-MM-DD)" },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "save_season",
          description: "Save the current season to the database.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "get_season_status",
          description: "Get the current season setup: name, dates, duration.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      set_season_name: (params) => {
        const p = params as Record<string, string>;
        const val = p.name?.trim();
        if (!val) return "Error: name is required.";
        setNameRef.current(val);
        return `Season name set to "${val}".`;
      },
      set_season_dates: (params) => {
        const p = params as Record<string, string>;
        const s = p.startDate;
        const e = p.endDate;
        if (!s || !e) return "Error: both startDate and endDate are required.";
        if (s >= e) return "Error: endDate must be after startDate.";
        setStartRef.current(s);
        setEndRef.current(e);
        const days = Math.round((new Date(e).getTime() - new Date(s).getTime()) / 86400000);
        return `Season dates set: ${s} to ${e} (${days} days).`;
      },
      save_season: async () => {
        try {
          await saveRef.current();
          return "Season saved successfully.";
        } catch {
          return "Error saving season. Ask the user to check the form.";
        }
      },
      get_season_status: () => {
        const n = nameRef.current;
        const s = startRef.current;
        const e = endRef.current;
        if (!n && !s && !e) return "No season configured yet.";
        const days =
          s && e ? Math.round((new Date(e).getTime() - new Date(s).getTime()) / 86400000) : 0;
        return `Season: "${n || "(unnamed)"}". Period: ${s || "not set"} to ${e || "not set"} (${days} days).`;
      },
    }),
    [],
  );

  return useWizardToolKit(definitions, implementations, nextRef, backRef);
}
```

- [ ] **Step 2: Wire tool registration in SeasonSetupStep**

In `apps/web/src/components/dashboard/wizard-steps/SeasonSetupStep.tsx`, add at the top of the component (after the existing hooks):

```typescript
import { useRegisterTools } from "@/app/walkAi/_components/tool-registry";
import { useSeasonTools } from "./tools/season-tools";
```

Inside the component, after the existing state declarations (`name`, `startDate`, `endDate`, `handleSave`):

```typescript
const seasonTools = useSeasonTools(
  name,
  startDate,
  endDate,
  setName,
  setStartDate,
  setEndDate,
  handleSave,
  () => {},
  () => {}, // next/back not available in this step (it has its own save)
);
useRegisterTools("wizard-setup-season", seasonTools);
```

Note: `next` and `back` are not available in this step's props (it uses `handleSave` directly). Pass no-ops for now — they will be wired when the step receives `WizardStepProps` in a future task.

- [ ] **Step 3: Verify typecheck**

Run: `pnpm turbo typecheck --filter=web`

Expected: 0 errors.

- [ ] **Step 4: Verify tool registration works at runtime**

Start the dev server: `pnpm --filter web dev`

Navigate to `http://localhost:3060/dashboard/setup` and advance to the Season step (step 8). Open browser DevTools console and run:

```javascript
// The tool registry is a module-level singleton
// If tools are registered, WalkAi should see them
// Check that Emma's tool list includes season tools
```

The tools should appear in WalkAi's merged toolkit when the season step is active, and disappear when navigating away.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/dashboard/wizard-steps/tools/season-tools.ts apps/web/src/components/dashboard/wizard-steps/SeasonSetupStep.tsx
git commit -m "feat(setup): add Emma tools for season step (proof of concept)

First wizard step with WalkAi tool integration. Demonstrates the
ref-based pattern: set_season_name, set_season_dates, save_season,
get_season_status + shared nav tools.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Build remaining setup wizard tools (8 steps)

Create tool builders for the remaining 8 setup steps following the same pattern as Task 5. Each step gets its own tool file. All use the shared helpers from Task 2.

**Files:**

- Create: `apps/web/src/components/dashboard/wizard-steps/tools/welcome-tools.ts`
- Create: `apps/web/src/components/dashboard/wizard-steps/tools/document-drop-tools.ts`
- Create: `apps/web/src/components/dashboard/wizard-steps/tools/governance-tools.ts`
- Create: `apps/web/src/components/dashboard/wizard-steps/tools/payroll-tools.ts`
- Create: `apps/web/src/components/dashboard/wizard-steps/tools/employment-tools.ts`
- Create: `apps/web/src/components/dashboard/wizard-steps/tools/team-tools.ts`
- Create: `apps/web/src/components/dashboard/wizard-steps/tools/shift-template-tools.ts`
- Create: `apps/web/src/components/dashboard/wizard-steps/tools/handbook-tools.ts`
- Modify: Each corresponding step component to add `useRegisterTools` call

This task is large. Implement one tool file at a time, wire it in the step component, verify typecheck, and commit per step. Each tool file follows the exact same pattern as `season-tools.ts`:

1. Accept component state + setters as args
2. Wrap in `useSyncRef`
3. Define `ClientToolDefinition[]` in `useMemo([], [])`
4. Define `Record<string, ClientToolImplementation>` in `useMemo([], [])`
5. Return `useWizardToolKit(definitions, implementations, nextRef, backRef)`

**Tool definitions per step:**

| Step            | Tools                                                                           | Notes                                             |
| --------------- | ------------------------------------------------------------------------------- | ------------------------------------------------- |
| Welcome         | `get_setup_status` (read-only)                                                  | Reads completion flags from state                 |
| Document Drop   | `get_extraction_status` (read-only)                                             | Reads extracted data summary                      |
| Governance      | `toggle_policy(name)`, `set_filter(key, value)`, `get_governance_status`        | Toggles policies, sets filter questions           |
| Payroll         | `select_tariff(name)`, `add_supplement(name, rate, unit)`, `get_payroll_status` | Selects tariff agreement, adds supplements        |
| Employment      | `toggle_employment_type(type)`, `get_employment_status`                         | Toggles ansettelsesformer                         |
| Team            | `get_team_status`                                                               | Read-only — invites are complex, defer to user    |
| Shift Templates | `add_shift_template(dept, name, start, end)`, `get_shift_status`                | Adds template entries                             |
| Handbook        | `get_handbook_status`                                                           | Read-only — chapters are rich text, defer to user |

- [ ] **Step 1: Create each tool file following the season-tools pattern**

For each step, create the tool file and wire `useRegisterTools` in the step component. Commit after each step:

```bash
git commit -m "feat(setup): add Emma tools for [step-name] step"
```

- [ ] **Step 2: Final typecheck**

Run: `pnpm turbo typecheck --filter=web`

Expected: 0 errors across all 9 tool files.

---

## Task 7: Add WalkAiProvider to onboarding layout (Phase A prerequisite)

Before any onboarding tool migration, WalkAiProvider must wrap the `/onboarding` route.

**Files:**

- Modify: `apps/web/src/app/onboarding/layout.tsx`

- [ ] **Step 1: Check WalkAiProvider's import path and required props**

Read `apps/web/src/app/walkAi/_components/WalkAiProvider.tsx` to understand what props it needs and whether it can work outside DashboardShell.

This is a research step. The provider may depend on DashboardContext, workspace context, or other dashboard-only providers. If so, we need a lighter wrapper or must satisfy those dependencies.

Document findings before proceeding.

- [ ] **Step 2: Add WalkAiProvider to onboarding layout**

In `apps/web/src/app/onboarding/layout.tsx`, wrap the children:

```typescript
import { WalkAiProvider } from "@/app/walkAi/_components/WalkAiProvider";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  // ... existing auth guard ...

  return (
    <div className="h-dvh w-full overflow-hidden bg-[oklch(0.08_0.015_50)]">
      <WalkAiProvider>
        {children}
      </WalkAiProvider>
    </div>
  );
}
```

**Important:** If WalkAiProvider requires props from DashboardShell (workspace, profile), this step becomes more complex. The research in Step 1 determines the approach.

- [ ] **Step 3: Verify the onboarding page still loads**

Navigate to `http://localhost:3060/onboarding` and verify no crashes.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/onboarding/layout.tsx
git commit -m "feat(onboarding): add WalkAiProvider to onboarding layout

Prerequisite for migrating Botsson tools to WalkAi's tool registry.
Emma is now available on the /onboarding route.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Build onboarding step tools (Phase B)

Create tool builders for the 5 onboarding step groups, migrating the 13 Botsson tools.

**Files:**

- Create: `apps/web/src/app/onboarding/steps/tools/business-tools.ts`
- Create: `apps/web/src/app/onboarding/steps/tools/departments-tools.ts`
- Create: `apps/web/src/app/onboarding/steps/tools/locations-tools.ts`
- Create: `apps/web/src/app/onboarding/steps/tools/procedures-tools.ts`
- Create: `apps/web/src/app/onboarding/steps/tools/summary-tools.ts`

The tool implementations must match the behavior of the 13 tools in `useBotsson.ts` (lines 73-250). Key difference: instead of calling action callbacks directly, they call `updateState()` from `WizardStepProps`.

**Tool migration mapping:**

| Botsson tool         | New file             | Implementation                                                           |
| -------------------- | -------------------- | ------------------------------------------------------------------------ |
| `updateBusiness`     | business-tools.ts    | `updateState({ business: { ...stateRef.current.business, ...fields } })` |
| `searchCompany`      | business-tools.ts    | Calls BRREG API, returns candidates as string                            |
| `identifyCompany`    | business-tools.ts    | Calls workspace creation API, emits telemetry                            |
| `scrapeWebsite`      | business-tools.ts    | Calls scraping service, returns results                                  |
| `addDepartments`     | departments-tools.ts | `updateState({ departments: [...existing, ...new] })`                    |
| `addLocations`       | locations-tools.ts   | `updateState({ locations: [...existing, ...new] })`                      |
| `addZones`           | locations-tools.ts   | Updates zones within a location                                          |
| `addProcedures`      | procedures-tools.ts  | `updateState({ procedures: [...toggled] })`                              |
| `finalizeOnboarding` | summary-tools.ts     | Calls `onComplete()` from wizard definition                              |
| `getOnboardingState` | Each file            | Returns step-relevant state slice                                        |

Tools that are GLOBAL and already exist in WalkAi: `saveMemory` → already `save_memory` in walkai-tools.ts.
Tools that are DROPPED: `addKeyFact` → only needed if key facts panel is kept (assess in Phase D).

- [ ] **Step 1: Create each tool file following the ref-based pattern**

Each file follows the same structure as `season-tools.ts`. The key difference is that onboarding tools receive `OnboardingConfirmState` instead of `SetupState`.

For `business-tools.ts`, the `searchCompany` and `identifyCompany` tools make external API calls. These must emit telemetry with `capability: "wizard"` and return string results for Emma.

- [ ] **Step 2: Wire `useRegisterTools` in each onboarding step component**

Add imports and the `useRegisterTools` call in each step. The onboarding step components (`ConfirmDepartments.tsx`, etc.) already receive `WizardStepProps` so `state` and `updateState` are available.

- [ ] **Step 3: Verify typecheck**

Run: `pnpm turbo typecheck --filter=web`

- [ ] **Step 4: Commit per tool file**

```bash
git commit -m "feat(onboarding): add Emma tools for [step] (Phase B migration)"
```

---

## Task 9: Migrate onboarding sections off `useOnboarding()` (Phase C+D)

This is the incremental migration of 15 files from `useOnboarding()` to either `WizardStepProps` or WalkAi agent state.

**This task is intentionally high-level.** Each of the 15 files needs individual assessment — some are trivial (just read state), others are complex (ambient background tied to agent speaking state). The migration should be done one file at a time with a commit per file.

**Files:**

- Modify: 9 section files + 6 component files in `apps/web/src/app/onboarding/`

**Migration strategy per file:**

| File                 | Current `useOnboarding()` usage | Migration to                                           |
| -------------------- | ------------------------------- | ------------------------------------------------------ |
| BusinessSection      | business state, scrape, BRREG   | WizardStepProps state + step tools handle scrape/BRREG |
| DepartmentsSection   | departments state, add/toggle   | WizardStepProps state                                  |
| LocationsSection     | locations state, add/zones      | WizardStepProps state                                  |
| SeasonSection        | season state                    | WizardStepProps state                                  |
| ProceduresSection    | procedures state, toggle        | WizardStepProps state                                  |
| WelcomeSection       | botsson start/status            | WalkAi agent status                                    |
| HeroSection          | botsson status for visuals      | WalkAi agent status                                    |
| DoneSection          | finalize action                 | WizardStepProps `next()` or `onComplete`               |
| CustomerDocumentView | business state for display      | WizardStepProps state                                  |
| AmbientBackground    | isSpeaking/isListening          | WalkAi agent status                                    |
| VoiceSessionOverlay  | transcript, status, mute        | **DROP** — EmmaOverlay handles this                    |
| BigBoard             | full state for display          | WizardStepProps state                                  |
| AgentControlPanel    | debug log, controls             | **DROP** or move to WalkAi dev tools                   |
| KeyFactsPanel        | key facts array                 | Move to local context or WalkAi state                  |
| NavigationController | section state, scroll           | WizardShell `goTo()`                                   |

- [ ] **Step 1: Migrate sections 1-5 (state-only, trivial)**

These sections only read onboarding state. Replace `useOnboarding().state` with the state they receive via props (or a parent context if they're not direct step components).

- [ ] **Step 2: Migrate sections 6-9 (mixed state + botsson)**

These need both state migration AND botsson replacement with WalkAi agent status.

- [ ] **Step 3: Migrate components 10-15 (botsson-dependent)**

These read agent state (speaking, listening, transcript). Replace with WalkAi agent hooks. Some may be droppable (VoiceSessionOverlay, AgentControlPanel) since WalkAi already provides equivalent UI.

- [ ] **Step 4: Verify no imports from WizardContext remain**

Run: `grep -r "from.*WizardContext\|from.*useOnboarding" apps/web/src/app/onboarding/`

Expected: Only `WizardContext.tsx` itself (self-reference).

- [ ] **Step 5: Commit per file migrated**

---

## Task 10: Delete legacy Botsson files (Phase E)

Only after ALL 15 consumers are migrated off `useOnboarding()`.

**Files:**

- Delete: `apps/web/src/app/onboarding/hooks/useBotsson.ts` (712 lines)
- Delete: `apps/web/src/app/onboarding/WizardContext.tsx` (364 lines)
- Delete: `apps/web/src/app/onboarding/lib/tool-schemas.ts` (if only used by useBotsson)

- [ ] **Step 1: Verify zero imports from deleted files**

Run:

```bash
grep -r "useBotsson\|WizardContext\|useOnboarding" apps/web/src/app/onboarding/ --include="*.ts" --include="*.tsx" | grep -v "WizardContext.tsx" | grep -v "useBotsson.ts"
```

Expected: 0 results.

- [ ] **Step 2: Delete the files**

```bash
rm apps/web/src/app/onboarding/hooks/useBotsson.ts
rm apps/web/src/app/onboarding/WizardContext.tsx
```

Also check and delete `tool-schemas.ts` if it was only used by `useBotsson.ts`.

- [ ] **Step 3: Verify typecheck**

Run: `pnpm turbo typecheck`

Expected: 0 errors. If anything breaks, a consumer was missed — fix before committing.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(onboarding): delete legacy Botsson + WizardContext (Phase E)

Removes 1076 lines of parallel voice-agent infrastructure.
All 13 tools migrated to WalkAi tool registry via useRegisterTools.
All 15 consumers migrated to WizardStepProps or WalkAi agent state.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Write ADR

Document the architectural decision.

**Files:**

- Create: ADR entry in `docs/decisions/0000-decision-log.md`

- [ ] **Step 1: Read the decision log to get the next ADR number**

Read `docs/decisions/0000-decision-log.md` to find the highest existing number.

- [ ] **Step 2: Write the ADR**

Use the template at `docs/templates/decision.md`. Key points:

- **Title:** Emma-Wizard Bridge: tool-based agent control over wizard flows
- **Context:** Two parallel systems (WalkAi + Botsson), need for unified voice-agent wizard interaction
- **Decision:** Step-level tool registration via `useRegisterTools`, callback-based context push, ref-based implementations, incremental migration
- **Supersedes:** ADR-0049 for wizard-specific tools (tools live near consumers, not in agent-sdk)
- **Consequences:** Client-side tools have no C4 authority gating (by design). WalkAiProvider must wrap any route with wizard tools.

- [ ] **Step 3: Register in decision log and commit**

```bash
git commit -m "docs(decisions): add ADR for Emma-Wizard Bridge pattern"
```

---

## Dependency Order

```
Task 1 (types + callback)
  └─→ Task 2 (shared helpers)
       └─→ Task 3 (bridge hook)
            └─→ Task 4 (wire AnimatedWizardShell)
                 └─→ Task 5 (season proof of concept)
                      └─→ Task 6 (remaining 8 setup tools)
                      └─→ Task 7 (WalkAiProvider in onboarding)
                           └─→ Task 8 (onboarding tools)
                                └─→ Task 9 (migrate 15 consumers)
                                     └─→ Task 10 (delete legacy)
                                          └─→ Task 11 (ADR)
```

Tasks 6 and 7 can run in parallel after Task 5.

## Deferred Items

These items from the spec are intentionally deferred to follow-up work:

| Item                                                     | Spec Section                  | Reason                                                                                     |
| -------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------ |
| Concurrent input mutex (activeElement check)             | Section 6                     | UX polish — requires per-field focus tracking. Ship core integration first.                |
| Agent Presence visual layer (glow on Emma-filled fields) | Council: Frontend Designer R1 | Visual design work — needs separate spec for the presence indicator component.             |
| ARIA live region for agent mutations                     | Council: Frontend Designer R4 | Accessibility — ship after core integration proves stable.                                 |
| Tool-call queue during step transitions                  | Council: Frontend Designer R2 | Edge case — AnimatePresence `mode="wait"` creates a brief dead zone. Low risk in practice. |
