---
title: "Design — Setup Wizard Shell Migration"
status: review
updated: 2026-03-28
created: 2026-03-28
module: dashboard
tags: [wizard, setup, migration, shell, council-reviewed]
---

# Design — Setup Wizard Shell Migration

> Council-reviewed 2026-03-28. Verdict: APPROVE WITH CONDITIONS (2 blockers + 7 conditions resolved below).

## Goal

Migrate `/dashboard/setup` from the legacy `WorkspaceSetupWizard` (665-line bespoke component) to `AnimatedWizardShell` + `dashboardSetupWizard` definition, matching the pattern used by `/join` and `/onboarding`.

## Non-Goals

- Changing the step content components (`wizard-steps/*.tsx`) — they stay as-is
- Adding new steps or removing existing ones
- Voice agent integration for setup wizard (future)
- K1b re-ingestion triggers from dashboard CRUD (tracked separately)

## Current State

| Component                         | Status                                                                |
| --------------------------------- | --------------------------------------------------------------------- |
| `dashboardSetupWizard` definition | Exists (`wizard-definition.ts`), `onComplete` is stub, no `loadState` |
| 9 adapter components              | Exist (`_adapters/*.tsx`), thin bridges only                          |
| `SetupState` type                 | Exists (`types.ts`), correct shape                                    |
| `AnimatedWizardShell`             | Works for `/join` and `/onboarding`                                   |
| `WorkspaceSetupWizard`            | Legacy 665-line component, still rendered by `page.tsx`               |

## Architecture

```
page.tsx (trivial — just <AnimatedWizardShell definition={...} />)
  └── AnimatedWizardShell
        ├── WizardShell (packages/ui)
        │     ├── useWizardState (manages state, calls loadState on mount)
        │     ├── WizardTopBar (progress indicators)
        │     ├── StepComponent (adapter)
        │     │     ├── SetupStepHeader (title, subtitle, help, botsson tip)
        │     │     └── Legacy step component (WelcomeStep, GovernanceSetupStep, etc.)
        │     └── WizardNavBar (back/next/skip)
        └── useWizardTelemetry (handles ALL telemetry — never emit from definition)
```

## Phase 1: Shared Wizard Infrastructure Fixes

These fixes benefit all 3 wizards (`/join`, `/onboarding`, `/dashboard/setup`).

### 1.1 Wire `loadState` into `useWizardState`

**File:** `packages/ui/src/wizard/useWizardState.ts`

`loadState` is declared on `WizardDefinition` but never called. The hook initializes from `definition.initialState` only.

**Change:** Add a `useEffect` on mount that calls `definition.loadState?.()` and merges the result into state. Expose a `loading` boolean so the shell can show a spinner during hydration.

```
const [loading, setLoading] = useState(!!definition.loadState);

useEffect(() => {
  if (!definition.loadState) return;
  definition.loadState().then((partial) => {
    setData((prev) => ({ ...prev, ...partial }));
    setLoading(false);
  });
}, []); // mount only
```

**Return value extension:** `loadState` may return `{ _initialStepIndex?: number }` as a meta field. If present, `useWizardState` sets `currentStepIndex` to that value. This enables smart initial step.

### 1.2 Add `onStepLeave` to `WizardStepDef`

**File:** `packages/ui/src/wizard/types.ts`

Add optional callback:

```typescript
onStepLeave?: (state: TState) => void | Promise<void>;
```

**File:** `packages/ui/src/wizard/WizardShell.tsx`

Call `currentStep.onStepLeave?.(data)` in the `next()` and `back()` handlers before advancing.

### 1.3 Expose `onComplete` callback on `WizardShell`

**File:** `packages/ui/src/wizard/WizardShell.tsx`

The shell already has an `onComplete` prop, but `AnimatedWizardShell` wires it to telemetry only.

**File:** `apps/web/src/components/wizard/AnimatedWizardShell.tsx`

After `telemetry.onComplete()` fires, call a new `onShellComplete` prop if provided. This lets the page run post-completion logic (if needed). However, per council decision, the primary pattern is: ALL business logic in `definition.onComplete`. The page should be trivial.

## Phase 2: Setup Wizard Definition

### 2.1 Implement `loadState`

**File:** `apps/web/src/app/dashboard/setup/wizard-definition.ts`

Query Supabase directly (no hooks — `loadState` is async, not a React component):

1. `supabase.auth.getUser()` → get user ID
2. Query `profile` for workspace_id + profile_id (find the active workspace)
3. Query `company` (`.single()`) — company info
4. Query `company_details` (`.maybeSingle()`) — narrative fields (may not exist)
5. Query `company_opening_hours` — opening hours
6. Query `company_social_media` — social links
7. Build `scrapedData` object (same mapping as legacy lines 225-270)
8. Query `useWorkspaceSetup` equivalent — check module completion status
9. Compute `_initialStepIndex` from module status (first incomplete module)

Return `Partial<SetupState>` with `scrapedData`, `workspaceId`, `profileId`, and `_initialStepIndex`.

**Pattern precedent:** `/onboarding/wizard-definition.ts` loadState does the same — queries Supabase for workspace + intelligence_data.

### 2.2 Implement `onComplete`

**File:** `apps/web/src/app/dashboard/setup/wizard-definition.ts`

ALL business logic lives here (matches /join and /onboarding pattern):

```typescript
async function onComplete(state: SetupState): Promise<void> {
  const supabase = createClient();

  // 1. Update workspace flag
  await supabase
    .from("workspace")
    .update({ setup_guide_completed: true })
    .eq("workspace_id", state.workspaceId);

  // 2. Send team invitations (if any)
  if (state.teamMembers.length > 0) {
    await sendTeamInvitations(supabase, state);
  }

  // 3. Trigger K1b knowledge ingestion (non-blocking)
  void supabase.functions.invoke("ingest-workspace-knowledge", {
    body: { workspace_id: state.workspaceId, force: true },
  });

  // 4. Clear session dismiss
  sessionStorage.removeItem("setup_dismissed");

  // 5. Redirect to dashboard
  window.location.href = "/dashboard";
}
```

**Telemetry contract:** `onComplete` does NOT emit telemetry. `useWizardTelemetry` handles all telemetry events (step_completed, wizard_completed, step_skipped). This is the canonical contract for all wizards.

### 2.3 Add `onStepLeave` for team invitations

On the `team` step definition:

```typescript
{
  id: "team",
  labelKey: "steps.team",
  icon: Users,
  component: TeamStepAdapter,
  skippable: true,
  onStepLeave: async (state: SetupState) => {
    if (state.teamMembers.length > 0) {
      await sendTeamInvitations(createClient(), state);
    }
  },
}
```

This preserves the legacy behavior: invitations persist when leaving the team step, not just on wizard completion. The `onComplete` handler skips invitations if they were already sent (idempotency via a flag in state).

### 2.4 Map BotsTip content to brand panel messages

The legacy `BotsTip` renders `industryPackage.botsson[stepId]` — real regulatory content (tariff rates, Mattilsynet, employment law). This content maps to the brand panel's per-step `sub` field:

```typescript
brandPanel: {
  logoSrc: "/smartout-logo.png",
  position: "right",
  messages: {
    welcome: {
      heading: "setup.brand.welcome_heading",
      sub: "setup.brand.welcome_sub",  // includes industry tip
    },
    governance: {
      heading: "setup.brand.governance_heading",
      sub: "setup.brand.governance_sub",  // includes Mattilsynet tip
    },
    // ... per step
  },
},
```

**Note:** The brand panel is atmospheric (dark panel, large text). For detailed regulatory content, the `SetupStepHeader` component (see 2.5) includes an expandable help section with the full botsson tip text inline.

### 2.5 Create `SetupStepHeader` component

**File:** `apps/web/src/app/dashboard/setup/_components/SetupStepHeader.tsx`

Shared header that every adapter renders at the top:

```typescript
interface SetupStepHeaderProps {
  stepId: string;
  t: (key: string) => string;
  helpTip?: string; // from i18n
  botssonTip?: string; // from industryPackage.botsson[stepId]
}
```

Renders: step title, subtitle, explanation text (all from i18n keys), optional HelpTip tooltip, and optional BotsTip-style inline guidance.

Each adapter renders:

```tsx
<div className="mx-auto w-full max-w-2xl px-8 py-12">
  <SetupStepHeader stepId="governance" t={t} botssonTip={industryPackage.botsson?.governance} />
  <GovernanceSetupStep ... />
</div>
```

### 2.6 Add escape hatch

**File:** `apps/web/src/app/dashboard/setup/wizard-definition.ts`

Add metadata for the shell to render an exit button:

```typescript
metadata: {
  titleKey: "setup.title",
  descriptionKey: "setup.description",
  i18nNamespace: "dashboard",
  exitRoute: "/dashboard",  // renders "Hopp over" button in shell
},
```

If `AnimatedWizardShell` doesn't support `exitRoute` natively, the page wrapper adds a floating exit button. This replaces the legacy "Hopp over og ga til dashboard" button.

## Phase 3: Page Swap

### 3.1 Simplify `page.tsx`

**File:** `apps/web/src/app/dashboard/setup/page.tsx`

Replace the entire file with a trivial shell (matching /join and /onboarding pattern):

```typescript
"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { AnimatedWizardShell } from "@/components/wizard/AnimatedWizardShell";
import { dashboardSetupWizard } from "./wizard-definition";

export default function DashboardSetupPage() {
  return (
    <Suspense fallback={<div className="flex h-dvh items-center justify-center"><Loader2 className="animate-spin" /></div>}>
      <AnimatedWizardShell definition={dashboardSetupWizard} />
    </Suspense>
  );
}
```

The `workspaceId` and `actorId` props are no longer needed — they come from `loadState` → `SetupState.workspaceId` / `SetupState.profileId`.

### 3.2 Delete legacy component

**File:** `apps/web/src/components/dashboard/WorkspaceSetupWizard.tsx`

Delete after migration is verified. Grep for other imports first — confirm no other consumers.

## Telemetry Contract (ADR)

| Concern                                                    | Owner                   | Never                          |
| ---------------------------------------------------------- | ----------------------- | ------------------------------ |
| Business logic (DB writes, redirects, EF calls)            | `definition.onComplete` | Never in telemetry hook        |
| Telemetry (step_completed, wizard_completed, step_skipped) | `useWizardTelemetry`    | Never in definition.onComplete |
| Per-step side-effects (invitations)                        | `step.onStepLeave`      | Never in adapters              |

## Risk Assessment

| Risk                                   | Severity | Mitigation                                       |
| -------------------------------------- | -------- | ------------------------------------------------ |
| `loadState` query fails (no workspace) | HIGH     | Return empty partial, wizard shows defaults      |
| Returning users restart at step 0      | HIGH     | `_initialStepIndex` from loadState               |
| Team invitations double-sent           | MEDIUM   | Idempotency flag in state + DB unique constraint |
| BotsTip content lost                   | MEDIUM   | SetupStepHeader + brand panel messages           |
| Double telemetry                       | LOW      | Documented contract, code review                 |

## Migration Checklist

- [ ] Wire `loadState` into `useWizardState` (Phase 1.1)
- [ ] Add `onStepLeave` to `WizardStepDef` type (Phase 1.2)
- [ ] Implement `loadState` in `wizard-definition.ts` (Phase 2.1)
- [ ] Implement real `onComplete` in `wizard-definition.ts` (Phase 2.2)
- [ ] Add `onStepLeave` for team step (Phase 2.3)
- [ ] Create i18n keys for brand panel + step headers (Phase 2.4)
- [ ] Create `SetupStepHeader` component (Phase 2.5)
- [ ] Update all 9 adapters to render SetupStepHeader (Phase 2.5)
- [ ] Add escape hatch (Phase 2.6)
- [ ] Swap `page.tsx` (Phase 3.1)
- [ ] Verify all 9 steps render correctly
- [ ] Verify completion flow (flag + K1b + redirect)
- [ ] Verify team invitations persist on step leave
- [ ] Fix `actor_id` resolution (from SetupState.profileId)
- [ ] Delete `WorkspaceSetupWizard.tsx` (Phase 3.2)
- [ ] Run typecheck
- [ ] Run E2E tests
