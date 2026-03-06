# Dashboard Setup Wizard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the "Interface State" architecture (Normal, Soft Gate, Hard Gate) and build the 4-step post-onboarding Dashboard Setup Wizard for the Restaurant industry.

**Architecture:** We will introduce an `interfaceState` to the global workspace context. The `DashboardShell` will conditionally render its layout based on this state. We will then build a Wizard component that orchestrates the 4 steps, updating workspace settings and calling existing Supabase RPCs (like `template_restaurant_mattilsynet`) to hydrate the workspace with industry intelligence.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind v4, shadcn/ui, Supabase (RPCs and Edge Functions).

---

### Task 1: Add Interface State to Workspace Context

**Files:**

- Modify: `apps/web/src/lib/workspace-context.tsx`

**Step 1: Define the types and state**
Add the interface state types and default values to the context.

```typescript
// Add to types
export type InterfaceState = "NORMAL" | "FOCUS_SOFT" | "FOCUS_HARD";

// Add to context state interface
interface WorkspaceState {
  // ... existing fields
  interfaceState: InterfaceState;
  setInterfaceState: (state: InterfaceState) => void;
}
```

**Step 2: Implement state in provider**

```typescript
// Add to WorkspaceProvider component
const [interfaceState, setInterfaceState] = useState<InterfaceState>("NORMAL");

// Add to context value
const value = {
  // ... existing values
  interfaceState,
  setInterfaceState,
};
```

**Step 3: Auto-trigger based on setup status**
If the workspace `status` is `setup_pending` (or similar, depending on existing schema), automatically set the state to `FOCUS_HARD` on load.

```typescript
useEffect(() => {
  if (currentWorkspace?.status === "setup_pending" && interfaceState === "NORMAL") {
    setInterfaceState("FOCUS_HARD");
  }
}, [currentWorkspace?.status, interfaceState]);
```

**Step 4: Commit**

```bash
git add apps/web/src/lib/workspace-context.tsx
git commit -m "feat(core): add interface state to workspace context"
```

---

### Task 2: Implement Layout Control in DashboardShell

**Files:**

- Modify: `apps/web/src/components/dashboard/DashboardShell.tsx`

**Step 1: Read state from context**

```typescript
const { interfaceState } = useWorkspace();
const isFocusMode = interfaceState === "FOCUS_HARD" || interfaceState === "FOCUS_SOFT";
```

**Step 2: Conditionally render layout elements**
Wrap the Sidebar and Header components to only render when not in focus mode.

```tsx
return (
  <div className="bg-background flex h-screen overflow-hidden">
    {!isFocusMode && <Sidebar />}
    <div className="flex flex-1 flex-col overflow-hidden">
      {!isFocusMode && <Header />}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  </div>
);
```

**Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/DashboardShell.tsx
git commit -m "feat(ui): dashboard shell respects focus mode states"
```

---

### Task 3: Scaffold the Setup Wizard Container

**Files:**

- Create: `apps/web/src/components/dashboard/setup-wizard/SetupWizardContainer.tsx`

**Step 1: Create the base container component**
This component handles the rendering of the different steps and the "Close" button if in Soft Gate mode.

```tsx
"use client";

import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function SetupWizardContainer() {
  const { interfaceState, setInterfaceState } = useWorkspace();
  const [currentStep, setCurrentStep] = useState(1);

  if (interfaceState === "NORMAL") return null;

  const handleClose = () => {
    if (interfaceState === "FOCUS_SOFT") {
      setInterfaceState("NORMAL");
    }
  };

  return (
    <div className="bg-background flex min-h-screen flex-col items-center p-8">
      {interfaceState === "FOCUS_SOFT" && (
        <div className="mb-8 flex w-full justify-end">
          <Button variant="ghost" onClick={handleClose}>
            Close and return to dashboard
          </Button>
        </div>
      )}

      <div className="w-full max-w-3xl">
        {/* Step rendering logic will go here */}
        <h1>Dashboard Setup Wizard (Step {currentStep}/4)</h1>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/dashboard/setup-wizard/SetupWizardContainer.tsx
git commit -m "feat(wizard): create base setup wizard container"
```

---

### Task 4: Integrate Wizard into Dashboard Layout

**Files:**

- Modify: `apps/web/src/app/dashboard/layout.tsx` (or `page.tsx` depending on current structure)

**Step 1: Conditionally render the wizard or children**

```tsx
import { SetupWizardContainer } from "@/components/dashboard/setup-wizard/SetupWizardContainer";
// ... other imports

export default function DashboardLayout({ children }) {
  // If we need client state, we might need to wrap this or push logic down
  // Assuming we can access context here or we push the render logic into a client component wrapper

  return (
    <DashboardShell>
      <ClientWizardOrContent>{children}</ClientWizardOrContent>
    </DashboardShell>
  );
}
```

_(Note: May require creating a `ClientWizardOrContent.tsx` if `layout.tsx` is a Server Component and needs to read Context)._

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/layout.tsx
git commit -m "feat(wizard): integrate wizard into dashboard rendering tree"
```

---

### Task 5: Build Step 1 - Location Specifics (Hard Gate)

**Files:**

- Create: `apps/web/src/components/dashboard/setup-wizard/steps/LocationSpecificsStep.tsx`

**Step 1: Build the UI**
Create toggles for Food Service, Fire Safety, POS, and Allergens.

```tsx
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

export function LocationSpecificsStep({ onNext }) {
  // State for toggles
  return (
    <div className="space-y-6">
      <h2>Step 1: Location Specifics</h2>
      {/* Toggles for Food Service, Fire Safety, POS, Allergens */}
      <Button onClick={onNext}>Next Step</Button>
    </div>
  );
}
```

**Step 2: Implement Save Logic**
When clicking Next, save these preferences to the workspace/company record via Supabase.

**Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/setup-wizard/steps/LocationSpecificsStep.tsx
git commit -m "feat(wizard): implement step 1 location specifics UI"
```

---

### Task 6: Build Step 2 & Transition Logic (Hard Gate -> Soft Gate)

**Files:**

- Create: `apps/web/src/components/dashboard/setup-wizard/steps/OrientationStep.tsx`
- Modify: `apps/web/src/components/dashboard/setup-wizard/SetupWizardContainer.tsx`

**Step 1: Build Step 2 UI**
Framework selection and Handbook generation trigger.

**Step 2: Handle Transition in Container**
When Step 2 completes, change the context state.

```typescript
const handleStep2Complete = async () => {
  // save step 2 data
  setInterfaceState("FOCUS_SOFT");
  setCurrentStep(3);
};
```

**Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/setup-wizard/steps/OrientationStep.tsx apps/web/src/components/dashboard/setup-wizard/SetupWizardContainer.tsx
git commit -m "feat(wizard): implement step 2 and hard-to-soft gate transition"
```

---

### Task 7: Build Step 3 & 4 (Soft Gate)

**Files:**

- Create: `apps/web/src/components/dashboard/setup-wizard/steps/StaffingBudgetStep.tsx`
- Create: `apps/web/src/components/dashboard/setup-wizard/steps/TrainingComplianceStep.tsx`

**Step 1: Build UI and Logic for Steps 3 & 4**
Integrate with the existing `season_budget` system and `protocol_assignments`.

**Step 2: Finalize Workspace**
On completion of Step 4, update workspace status to `fully_operational` and set `interfaceState` to `NORMAL`.

**Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/setup-wizard/steps/StaffingBudgetStep.tsx apps/web/src/components/dashboard/setup-wizard/steps/TrainingComplianceStep.tsx
git commit -m "feat(wizard): implement step 3 and 4 with finalization logic"
```
