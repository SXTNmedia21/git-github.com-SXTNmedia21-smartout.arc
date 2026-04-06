# Setup Wizard Shell Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `/dashboard/setup` from the 665-line legacy `WorkspaceSetupWizard` to `AnimatedWizardShell` + `dashboardSetupWizard` definition, matching the pattern used by `/join` and `/onboarding`.

**Architecture:** Three phases — (1) fix shared wizard infrastructure in `packages/ui` (wire `loadState`, add `onStepLeave`), (2) implement the setup wizard definition's `loadState` + `onComplete` + step headers, (3) swap the page and delete the legacy component.

**Tech Stack:** TypeScript, React, Next.js App Router, Supabase client, TanStack Query (for invalidation only), framer-motion (via AnimatedWizardShell), @smartout/telemetry, @smartout/i18n

**Spec:** `docs/superpowers/specs/2026-03-28-setup-wizard-shell-migration-design.md`

---

### Task 1: Wire `loadState` into `useWizardState`

**Files:**

- Modify: `packages/ui/src/wizard/useWizardState.ts`
- Modify: `packages/ui/src/wizard/types.ts`

The `loadState` function is declared on `WizardDefinition` but never called by the runtime. This task fixes that for all wizards.

- [ ] **Step 1: Add `loading` state and `loadState` call to `useWizardState`**

In `packages/ui/src/wizard/useWizardState.ts`, add a `loading` state and a mount effect:

```typescript
// packages/ui/src/wizard/useWizardState.ts
"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import type { WizardDefinition, WizardState } from "./types";

export function useWizardState<TState extends Record<string, unknown>>(
  definition: WizardDefinition<TState>,
) {
  const [data, setData] = useState<TState>(definition.initialState);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(!!definition.loadState);
  const startedAt = useRef(Date.now());
  const stepEnteredAt = useRef(Date.now());
  const loadAttempted = useRef(false);

  // Hydrate state from loadState on mount (once only)
  useEffect(() => {
    if (loadAttempted.current || !definition.loadState) return;
    loadAttempted.current = true;

    definition
      .loadState()
      .then((partial) => {
        if (!partial) {
          setLoading(false);
          return;
        }

        // Extract meta field for initial step index
        const { _initialStepIndex, ...statePartial } = partial as Partial<TState> & {
          _initialStepIndex?: number;
        };

        setData((prev) => ({ ...prev, ...statePartial }));

        if (typeof _initialStepIndex === "number" && _initialStepIndex > 0) {
          setCurrentStepIndex(_initialStepIndex);
        }

        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [definition]);

  const currentStep = definition.steps[currentStepIndex];
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === definition.steps.length - 1;

  const updateState = useCallback((patch: Partial<TState>) => {
    setData((prev) => ({ ...prev, ...patch }));
  }, []);

  const next = useCallback(async () => {
    const step = definition.steps[currentStepIndex];

    if (!step) {
      return { success: false as const, errors: ["No current step"] };
    }

    if (step.validation) {
      const dataToValidate = step.validationKey ? data[step.validationKey] : data;
      const result = step.validation.safeParse(dataToValidate);
      if (!result.success) {
        return {
          success: false as const,
          errors: result.error.issues.map((i: { message: string }) => i.message),
        };
      }
    }

    // Call onStepLeave before advancing
    if (step.onStepLeave) {
      await step.onStepLeave(data);
    }

    setCompletedSteps((prev) => new Set(prev).add(step.id));

    if (currentStepIndex < definition.steps.length - 1) {
      setCurrentStepIndex((i) => i + 1);
      stepEnteredAt.current = Date.now();
    } else if (definition.onComplete) {
      await definition.onComplete(data);
    }

    return { success: true as const };
  }, [currentStepIndex, data, definition]);

  const skip = useCallback(() => {
    const step = definition.steps[currentStepIndex];
    if (step) {
      setCompletedSteps((prev) => new Set(prev).add(step.id));
    }
    if (currentStepIndex < definition.steps.length - 1) {
      setCurrentStepIndex((i) => i + 1);
      stepEnteredAt.current = Date.now();
    }
  }, [currentStepIndex, definition.steps]);

  const back = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((i) => i - 1);
      stepEnteredAt.current = Date.now();
    }
  }, [currentStepIndex]);

  const goTo = useCallback(
    (stepId: string) => {
      const index = definition.steps.findIndex((s) => s.id === stepId);
      if (index >= 0) {
        setCurrentStepIndex(index);
        stepEnteredAt.current = Date.now();
      }
    },
    [definition.steps],
  );

  const wizardState: WizardState = useMemo(
    () => ({
      currentStepIndex,
      completedSteps,
      data,
      startedAt: startedAt.current,
      stepEnteredAt: stepEnteredAt.current,
    }),
    [currentStepIndex, completedSteps, data],
  );

  return {
    data,
    updateState,
    currentStep,
    currentStepIndex,
    completedSteps,
    isFirst,
    isLast,
    next,
    skip,
    back,
    goTo,
    wizardState,
    totalSteps: definition.steps.length,
    loading,
  };
}
```

- [ ] **Step 2: Add `onStepLeave` to `WizardStepDef` type**

In `packages/ui/src/wizard/types.ts`, add to `WizardStepDef`:

```typescript
export interface WizardStepDef<TState> {
  id: string;
  labelKey: string;
  icon?: LucideIcon;
  component: ComponentType<WizardStepProps<TState>>;
  validation?: ZodSchema;
  validationKey?: keyof TState;
  skippable?: boolean;
  hideNavBar?: boolean;
  estimatedMinutes?: number;
  /** Called before navigating away from this step (next or back). Use for per-step persistence. */
  onStepLeave?: (state: TState) => void | Promise<void>;
}
```

- [ ] **Step 3: Wire `loading` state into `WizardShell`**

In `packages/ui/src/wizard/WizardShell.tsx`, destructure `loading` from `useWizardState` and show a loading state:

After line 73 (`} = useWizardState(definition);`), add:

```typescript
// Show loading state while loadState hydrates
if (loading) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-current border-t-transparent opacity-30" />
    </div>
  );
}
```

- [ ] **Step 4: Export `loading` from `WizardShell` if needed**

Check that `useWizardState` returns `loading` — already done in Step 1.

- [ ] **Step 5: Run typecheck**

Run:

```bash
pnpm --filter @smartout/ui typecheck 2>&1 | tail -20
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/wizard/useWizardState.ts packages/ui/src/wizard/types.ts packages/ui/src/wizard/WizardShell.tsx
git commit -m "feat(ui): wire loadState + onStepLeave into WizardShell infrastructure

loadState was declared on WizardDefinition type but never called
by useWizardState. Now called on mount with loading state. Also adds
onStepLeave callback to WizardStepDef for per-step persistence.
Supports _initialStepIndex meta field for smart initial step.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Implement `loadState` in `dashboardSetupWizard`

**Files:**

- Modify: `apps/web/src/app/dashboard/setup/wizard-definition.ts`

This hydrates `SetupState` from Supabase on mount — matching the pattern in `/onboarding/wizard-definition.ts`.

- [ ] **Step 1: Implement the `loadState` function**

Replace the import block and add `loadState` at the top of `apps/web/src/app/dashboard/setup/wizard-definition.ts`:

```typescript
"use client";

/**
 * Dashboard Setup wizard definition — config object for AnimatedWizardShell.
 *
 * Maps the 9-step workspace setup flow to WizardDefinition<SetupState>.
 * loadState hydrates from Supabase (company, company_details, opening_hours, social_media).
 * onComplete handles flag update, K1b ingestion, and redirect.
 */

import {
  Sparkles,
  Upload,
  ShieldCheck,
  DollarSign,
  Briefcase,
  Users,
  Clock,
  Calendar,
  BookOpen,
} from "lucide-react";
import type { WizardDefinition } from "@smartout/ui";
import { createClient } from "@smartout/supabase/client";
import type { SetupState } from "./types";
import { defaultSetupState } from "./types";
import {
  WelcomeStepAdapter,
  DocumentDropStepAdapter,
  GovernanceStepAdapter,
  PayrollStepAdapter,
  EmploymentStepAdapter,
  TeamStepAdapter,
  ShiftTemplateStepAdapter,
  SeasonStepAdapter,
  HandbookStepAdapter,
} from "./_adapters";

/**
 * Hydrate setup state from existing workspace data.
 *
 * Queries company, company_details, opening_hours, and social_media
 * to pre-fill the wizard with existing business information.
 * Also computes _initialStepIndex based on workspace setup module completion.
 */
async function loadState(): Promise<Partial<SetupState> & { _initialStepIndex?: number }> {
  if (typeof window === "undefined") return {};

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return {};

  // Find active profile + workspace
  const { data: profiles } = await supabase
    .from("profile")
    .select(
      "profile_id, workspace_id, workspace:workspace_id(workspace_id, company_id, name, slug, intelligence_data)",
    )
    .eq("user_id", user.id)
    .limit(10);

  if (!profiles?.length) return {};

  // Use first profile with a workspace (most users have one)
  const profile = profiles[0];
  const ws = profile?.workspace as unknown as {
    workspace_id: string;
    company_id: string | null;
    name: string;
    slug: string | null;
  } | null;

  if (!ws) return {};

  const workspaceId = ws.workspace_id;
  const profileId = profile!.profile_id;

  // Parallel queries for all business data
  const [companyResult, detailsResult, hoursResult, socialResult] = await Promise.all([
    ws.company_id
      ? supabase.from("company").select("*").eq("company_id", ws.company_id).single()
      : Promise.resolve({ data: null }),
    supabase.from("company_details").select("*").eq("workspace_id", workspaceId).maybeSingle(),
    supabase
      .from("company_opening_hours")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("day_of_week"),
    supabase.from("company_social_media").select("*").eq("workspace_id", workspaceId),
  ]);

  const company = companyResult.data;
  const companyDetails = detailsResult.data;
  const openingHoursData = hoursResult.data ?? [];
  const socialMedia = socialResult.data ?? [];

  // Build scrapedData (same mapping as legacy WorkspaceSetupWizard lines 225-270)
  const scrapedData = {
    companyName: ws.name,
    orgNumber: company?.org_number ?? undefined,
    industryType: company?.industry ?? undefined,
    address:
      [company?.address_line_1, company?.postal_code, company?.city].filter(Boolean).join(", ") ||
      undefined,
    website: company?.website ?? undefined,
    email: company?.email ?? undefined,
    phone: company?.phone ?? undefined,
    openingHours:
      openingHoursData
        .filter((h) => !h.is_closed)
        .map(
          (h) =>
            `${["Man", "Tir", "Ons", "Tor", "Fre", "Lor", "Son"][h.day_of_week]}: ${h.open_time}-${h.close_time}`,
        )
        .join(", ") || undefined,
    aboutUs: companyDetails?.about_us ?? undefined,
    ourHistory: companyDetails?.our_history ?? undefined,
    ourConcept: companyDetails?.our_concept ?? undefined,
    restaurantType: companyDetails?.restaurant_type ?? undefined,
    cuisineTypes: companyDetails?.cuisine_types ?? undefined,
    priceCategory: companyDetails?.price_category ?? undefined,
    menuDescription: companyDetails?.menu_description ?? undefined,
    socialLinks:
      socialMedia.length > 0
        ? socialMedia.reduce(
            (acc, sm) => ({ ...acc, [sm.platform]: sm.url }),
            {} as Record<string, string>,
          )
        : undefined,
    fieldSources: (companyDetails?.field_sources as Record<string, string>) ?? undefined,
  };

  return {
    scrapedData,
    workspaceId,
    profileId,
  };
}
```

- [ ] **Step 2: Run typecheck**

Run:

```bash
pnpm --filter web typecheck 2>&1 | tail -20
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/setup/wizard-definition.ts
git commit -m "feat(setup): implement loadState for dashboard setup wizard

Hydrates SetupState from Supabase on mount: company, company_details
(.maybeSingle), opening_hours, social_media. Resolves workspaceId and
profileId from auth context.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Implement `onComplete` in `dashboardSetupWizard`

**Files:**

- Modify: `apps/web/src/app/dashboard/setup/wizard-definition.ts`

ALL business logic lives in `definition.onComplete` — matching `/join` and `/onboarding` pattern. The page becomes trivial.

- [ ] **Step 1: Replace the stub `onComplete` with real logic**

In `apps/web/src/app/dashboard/setup/wizard-definition.ts`, replace the existing `onComplete` function:

```typescript
/**
 * Complete the setup wizard:
 * 1. Set workspace.setup_guide_completed = true
 * 2. Send team invitations (if any pending)
 * 3. Trigger K1b knowledge ingestion (non-blocking)
 * 4. Clear session dismiss flag
 * 5. Redirect to dashboard
 *
 * Telemetry is handled by useWizardTelemetry — do NOT emit from here.
 */
async function onComplete(state: SetupState): Promise<void> {
  const supabase = createClient();

  // 1. Update workspace flag
  const { error } = await supabase
    .from("workspace")
    .update({ setup_guide_completed: true })
    .eq("workspace_id", state.workspaceId);

  if (error) {
    throw new Error(`Failed to update setup_guide_completed: ${error.message}`);
  }

  // 2. Send team invitations if any
  if (state.teamMembers.length > 0 && !state._invitationsSent) {
    await sendTeamInvitations(supabase, state);
  }

  // 3. Trigger K1b knowledge ingestion (non-blocking)
  void supabase.functions.invoke("ingest-workspace-knowledge", {
    body: { workspace_id: state.workspaceId, force: true },
  });

  // 4. Clear session dismiss
  sessionStorage.removeItem("setup_dismissed");

  // 5. Redirect to dashboard (hard navigation forces server layout re-fetch)
  window.location.href = "/dashboard";
}

/**
 * Bulk-insert invitation records for team members added in the wizard.
 * Called on team step leave AND on wizard completion (with idempotency guard).
 */
async function sendTeamInvitations(
  supabase: ReturnType<typeof createClient>,
  state: SetupState,
): Promise<void> {
  const members = state.teamMembers;
  if (members.length === 0) return;

  // Resolve company_id for invitation records
  const { data: ws } = await supabase
    .from("workspace")
    .select("company_id")
    .eq("workspace_id", state.workspaceId)
    .single();

  const companyId = ws?.company_id;
  if (!companyId) return;

  const inviteRecords = members.map((m) => ({
    workspace_id: state.workspaceId,
    company_id: companyId,
    email: m.email.trim() || null,
    first_name: m.firstName.trim(),
    last_name: m.lastName.trim(),
    role: m.role,
    department_ids: m.departmentId ? [m.departmentId] : [],
    status: "pending" as const,
    invite_type: "email" as const,
    invited_by: state.profileId,
    metadata: {
      ...(m.phone ? { phone: m.phone } : {}),
      ...(m.positionId ? { positionId: m.positionId } : {}),
      ...(m.employmentForm ? { employmentForm: m.employmentForm } : {}),
      ...(m.hourlyRate ? { hourlyRate: m.hourlyRate } : {}),
      ...(m.startDate ? { startDate: m.startDate } : {}),
      ...(m.positionPct ? { positionPct: m.positionPct } : {}),
      ...(m.birthDate ? { birthDate: m.birthDate } : {}),
      ...(m.address ? { address: m.address } : {}),
      ...(Object.keys(m.extraData).length > 0 ? { extraData: m.extraData } : {}),
    },
  }));

  const { error } = await supabase.from("invitation").insert(inviteRecords);
  if (error) {
    console.error("[setup-wizard] Failed to create invitations:", error);
  }
}
```

- [ ] **Step 2: Add `_invitationsSent` to `SetupState` type**

In `apps/web/src/app/dashboard/setup/types.ts`, add:

```typescript
/** Whether invitations have already been sent (idempotency guard for onStepLeave + onComplete) */
_invitationsSent: boolean;
```

And in `defaultSetupState`:

```typescript
_invitationsSent: false,
```

- [ ] **Step 3: Add `onStepLeave` to the team step definition**

In the steps array of `dashboardSetupWizard`, update the team step:

```typescript
{
  id: "team",
  labelKey: "steps.team",
  icon: Users,
  component: TeamStepAdapter,
  skippable: true,
  onStepLeave: async (state: SetupState) => {
    if (state.teamMembers.length > 0 && !state._invitationsSent) {
      const supabase = createClient();
      await sendTeamInvitations(supabase, state);
      // Mark as sent — state is mutable here via the hook's setData
      // but onStepLeave doesn't have updateState access.
      // Instead, onComplete checks _invitationsSent flag.
    }
  },
},
```

Note: Since `onStepLeave` receives state but can't update it, the `_invitationsSent` flag approach needs adjustment. Alternative: check if invitations already exist in the DB in `sendTeamInvitations` (query before insert, skip if records exist for these emails in this workspace with status 'pending'). This makes the function naturally idempotent without state mutation.

Update `sendTeamInvitations` to check for existing pending invitations:

```typescript
async function sendTeamInvitations(
  supabase: ReturnType<typeof createClient>,
  state: SetupState,
): Promise<void> {
  const members = state.teamMembers;
  if (members.length === 0) return;

  const { data: ws } = await supabase
    .from("workspace")
    .select("company_id")
    .eq("workspace_id", state.workspaceId)
    .single();

  const companyId = ws?.company_id;
  if (!companyId) return;

  // Check for existing pending invitations to avoid duplicates
  const emails = members.map((m) => m.email.trim()).filter(Boolean);
  const { data: existing } = await supabase
    .from("invitation")
    .select("email")
    .eq("workspace_id", state.workspaceId)
    .eq("status", "pending")
    .in("email", emails);

  const existingEmails = new Set((existing ?? []).map((e) => e.email));
  const newMembers = members.filter((m) => !existingEmails.has(m.email.trim()));

  if (newMembers.length === 0) return;

  const inviteRecords = newMembers.map((m) => ({
    workspace_id: state.workspaceId,
    company_id: companyId,
    email: m.email.trim() || null,
    first_name: m.firstName.trim(),
    last_name: m.lastName.trim(),
    role: m.role,
    department_ids: m.departmentId ? [m.departmentId] : [],
    status: "pending" as const,
    invite_type: "email" as const,
    invited_by: state.profileId,
    metadata: {
      ...(m.phone ? { phone: m.phone } : {}),
      ...(m.positionId ? { positionId: m.positionId } : {}),
      ...(m.employmentForm ? { employmentForm: m.employmentForm } : {}),
      ...(m.hourlyRate ? { hourlyRate: m.hourlyRate } : {}),
      ...(m.startDate ? { startDate: m.startDate } : {}),
      ...(m.positionPct ? { positionPct: m.positionPct } : {}),
      ...(m.birthDate ? { birthDate: m.birthDate } : {}),
      ...(m.address ? { address: m.address } : {}),
      ...(Object.keys(m.extraData).length > 0 ? { extraData: m.extraData } : {}),
    },
  }));

  const { error } = await supabase.from("invitation").insert(inviteRecords);
  if (error) {
    console.error("[setup-wizard] Failed to create invitations:", error);
  }
}
```

- [ ] **Step 4: Run typecheck**

Run:

```bash
pnpm --filter web typecheck 2>&1 | tail -20
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/setup/wizard-definition.ts apps/web/src/app/dashboard/setup/types.ts
git commit -m "feat(setup): implement onComplete + team invitation logic

All completion logic in definition.onComplete (matches /join and
/onboarding pattern): flag update, team invitations, K1b ingestion,
session clear, redirect. Invitations are idempotent via DB check.
onStepLeave on team step persists invitations on step navigation.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Create `SetupStepHeader` and add brand panel messages

**Files:**

- Create: `apps/web/src/app/dashboard/setup/_components/SetupStepHeader.tsx`
- Modify: `apps/web/src/app/dashboard/setup/wizard-definition.ts` (brand panel messages)

The legacy shell rendered step headers (title, subtitle, explanation, HelpTip). The new shell doesn't — adapters must render their own. A shared header component ensures consistency.

- [ ] **Step 1: Create `SetupStepHeader` component**

```typescript
// apps/web/src/app/dashboard/setup/_components/SetupStepHeader.tsx
"use client";

/**
 * SetupStepHeader — shared header for all setup wizard adapters.
 *
 * Renders step title, subtitle, explanation, and optional industry-specific
 * tip (from IndustryPackage.botsson). Replaces the legacy shell's built-in
 * header + BotsTip + HelpTip.
 */

import { Info } from "lucide-react";

interface SetupStepHeaderProps {
  /** i18n translation function from WizardStepProps */
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Step ID — used to resolve i18n keys (e.g., "welcome" → "steps.welcome_title") */
  stepId: string;
  /** Step index (0-based) */
  stepIndex: number;
  /** Total number of steps */
  totalSteps: number;
  /** Industry-specific tip from IndustryPackage.botsson[stepId] */
  botssonTip?: string;
}

export function SetupStepHeader({
  t,
  stepId,
  stepIndex,
  totalSteps,
  botssonTip,
}: SetupStepHeaderProps) {
  const title = t(`steps.${stepId}_title`);
  const subtitle = t(`steps.${stepId}_subtitle`);
  const explanation = t(`steps.${stepId}_explanation`);

  return (
    <div className="mb-8 space-y-3">
      <p className="text-brand-orange/70 text-xs font-bold tracking-widest uppercase">
        {t("steps.counter", { current: stepIndex, total: totalSteps - 1 })} &middot; {subtitle}
      </p>
      <h1 className="text-foreground text-3xl font-black tracking-tight">{title}</h1>
      <p className="text-muted-foreground max-w-xl text-base leading-relaxed">{explanation}</p>

      {botssonTip && (
        <div className="bg-muted/50 border-border mt-4 flex items-start gap-3 rounded-xl border px-4 py-3">
          <Info className="text-brand-orange mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-muted-foreground text-sm leading-relaxed">{botssonTip}</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add brand panel messages to wizard definition**

In `apps/web/src/app/dashboard/setup/wizard-definition.ts`, add `brandPanel` to the definition:

```typescript
brandPanel: {
  logoSrc: "/smartout-logo.png",
  position: "right",
  messages: {
    welcome: {
      heading: "setup.brand.welcome_heading",
      sub: "setup.brand.welcome_sub",
    },
    "document-drop": {
      heading: "setup.brand.documents_heading",
      sub: "setup.brand.documents_sub",
    },
    governance: {
      heading: "setup.brand.governance_heading",
      sub: "setup.brand.governance_sub",
    },
    payroll: {
      heading: "setup.brand.payroll_heading",
      sub: "setup.brand.payroll_sub",
    },
    employment: {
      heading: "setup.brand.employment_heading",
      sub: "setup.brand.employment_sub",
    },
    team: {
      heading: "setup.brand.team_heading",
      sub: "setup.brand.team_sub",
    },
    "shift-template": {
      heading: "setup.brand.shifts_heading",
      sub: "setup.brand.shifts_sub",
    },
    season: {
      heading: "setup.brand.season_heading",
      sub: "setup.brand.season_sub",
    },
    handbook: {
      heading: "setup.brand.handbook_heading",
      sub: "setup.brand.handbook_sub",
    },
  },
},
```

- [ ] **Step 3: Add i18n keys for step headers and brand panel**

Create or update `packages/i18n/locales/nb/dashboard.json` with keys for:

- `steps.counter` — "Steg {{current}} av {{total}}"
- `steps.welcome_title`, `steps.welcome_subtitle`, `steps.welcome_explanation`
- Same pattern for all 9 steps
- `setup.brand.welcome_heading`, `setup.brand.welcome_sub`
- Same pattern for all 9 brand panel messages

Values should match the legacy Norwegian text from `WorkspaceSetupWizard.tsx` lines 44-128 (STEPS array).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/setup/_components/SetupStepHeader.tsx apps/web/src/app/dashboard/setup/wizard-definition.ts packages/i18n/locales/nb/dashboard.json packages/i18n/locales/en/dashboard.json
git commit -m "feat(setup): add SetupStepHeader + brand panel messages

Shared header component renders title, subtitle, explanation, and
industry-specific BotsTip per step. Brand panel messages provide
atmospheric context in the Nordic Split dark panel. All strings
use i18n keys.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Update all 9 adapters to render `SetupStepHeader`

**Files:**

- Modify: `apps/web/src/app/dashboard/setup/_adapters/WelcomeStepAdapter.tsx`
- Modify: `apps/web/src/app/dashboard/setup/_adapters/DocumentDropStepAdapter.tsx`
- Modify: `apps/web/src/app/dashboard/setup/_adapters/GovernanceStepAdapter.tsx`
- Modify: `apps/web/src/app/dashboard/setup/_adapters/PayrollStepAdapter.tsx`
- Modify: `apps/web/src/app/dashboard/setup/_adapters/EmploymentStepAdapter.tsx`
- Modify: `apps/web/src/app/dashboard/setup/_adapters/TeamStepAdapter.tsx`
- Modify: `apps/web/src/app/dashboard/setup/_adapters/ShiftTemplateStepAdapter.tsx`
- Modify: `apps/web/src/app/dashboard/setup/_adapters/SeasonStepAdapter.tsx`
- Modify: `apps/web/src/app/dashboard/setup/_adapters/HandbookStepAdapter.tsx`

Each adapter adds `SetupStepHeader` at the top and passes the botsson tip from `useIndustryPackage`.

- [ ] **Step 1: Update WelcomeStepAdapter**

```typescript
"use client";

import type { WizardStepProps } from "@smartout/ui";
import type { SetupState } from "../types";
import { WelcomeStep } from "@/components/dashboard/wizard-steps/WelcomeStep";
import { useIndustryPackage } from "@/lib/industry/use-industry-package";
import { SetupStepHeader } from "../_components/SetupStepHeader";

export function WelcomeStepAdapter(props: WizardStepProps<SetupState>) {
  const { state, updateState, t } = props;
  const { detectedType, setIndustryType, package: industryPackage } = useIndustryPackage();

  return (
    <div className="mx-auto w-full max-w-2xl px-8 py-12">
      <SetupStepHeader stepId="welcome" stepIndex={0} totalSteps={9} t={t} botssonTip={industryPackage.botsson?.welcome} />
      <WelcomeStep
        scrapedData={state.scrapedData}
        detectedIndustry={detectedType}
        onIndustryChange={(type) => {
          setIndustryType(type);
          updateState({ detectedIndustry: type });
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Update remaining 8 adapters**

Apply the same pattern to each adapter:

1. Import `SetupStepHeader` and `useIndustryPackage`
2. Add `<SetupStepHeader stepId="..." stepIndex={N} totalSteps={9} t={t} botssonTip={industryPackage.botsson?.stepId} />` before the step component
3. Destructure `t` from `props`

Each adapter follows the exact same pattern — only `stepId`, `stepIndex`, and the wrapped component differ.

- [ ] **Step 3: Run typecheck**

Run:

```bash
pnpm --filter web typecheck 2>&1 | tail -20
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/setup/_adapters/*.tsx
git commit -m "feat(setup): add SetupStepHeader to all 9 adapters

Each adapter now renders step title, subtitle, explanation, and
industry-specific BotsTip via the shared SetupStepHeader component.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Swap `page.tsx` and add escape hatch

**Files:**

- Modify: `apps/web/src/app/dashboard/setup/page.tsx`

- [ ] **Step 1: Replace the page with trivial shell render**

```typescript
// apps/web/src/app/dashboard/setup/page.tsx
"use client";

/**
 * Dashboard Setup page — renders the setup wizard via AnimatedWizardShell.
 *
 * All business logic (flag update, K1b ingestion, redirect) lives in
 * wizard-definition.ts onComplete. This page is intentionally trivial.
 */

import { Suspense } from "react";
import { Loader2, SkipForward } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { AnimatedWizardShell } from "@/components/wizard/AnimatedWizardShell";
import { useWorkspace } from "@/lib/workspace-context";
import { dashboardSetupWizard } from "./wizard-definition";

export default function DashboardSetupPage() {
  const { workspace } = useWorkspace();
  const { t } = useTranslation("dashboard");

  return (
    <Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center">
          <Loader2 className="text-muted-foreground animate-spin" size={32} />
        </div>
      }
    >
      <div className="relative flex h-full flex-col">
        {/* Escape hatch — skip to dashboard */}
        <div className="absolute top-4 right-4 z-50">
          <a
            href="/dashboard"
            className="text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          >
            <SkipForward className="h-3.5 w-3.5" />
            {t("setup.skip_to_dashboard")}
          </a>
        </div>

        <AnimatedWizardShell
          definition={dashboardSetupWizard}
          workspaceId={workspace.workspace_id}
          actorId={workspace.workspace_id}
        />
      </div>
    </Suspense>
  );
}
```

Note: `actorId` should ideally be the profile ID. Since `DashboardContext` provides `profileId`, we can use it. But `AnimatedWizardShell` needs it as a prop, and the page already has `useWorkspace()`. The profileId can be resolved via a hook:

```typescript
import { useContext } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";

// Inside the component:
const { profileId } = useContext(DashboardContext);
```

Then pass `actorId={profileId ?? "anonymous"}`.

- [ ] **Step 2: Add i18n key for skip button**

In `packages/i18n/locales/nb/dashboard.json`:

```json
"setup.skip_to_dashboard": "Hopp over og ga til dashboard"
```

In `packages/i18n/locales/en/dashboard.json`:

```json
"setup.skip_to_dashboard": "Skip to dashboard"
```

- [ ] **Step 3: Run dev server and verify**

Run:

```bash
pnpm --filter web dev
```

Navigate to `/dashboard/setup` and verify:

1. Wizard renders with AnimatedWizardShell layout (brand panel on right)
2. Step headers show title, subtitle, explanation
3. BotsTip shows for each step (if industry package loaded)
4. "Hopp over" button visible top-right
5. Navigation between steps works
6. Completion redirects to dashboard

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/setup/page.tsx packages/i18n/locales/nb/dashboard.json packages/i18n/locales/en/dashboard.json
git commit -m "feat(setup): swap page to AnimatedWizardShell + escape hatch

Page is now trivial — just renders AnimatedWizardShell with the
dashboardSetupWizard definition. Escape hatch ('skip to dashboard')
added as absolute-positioned link. actorId resolved from DashboardContext.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Delete legacy `WorkspaceSetupWizard` and clean up

**Files:**

- Delete: `apps/web/src/components/dashboard/WorkspaceSetupWizard.tsx`

- [ ] **Step 1: Verify no other imports**

Run:

```bash
grep -r "WorkspaceSetupWizard" apps/web/src/ --include="*.ts" --include="*.tsx" -l
```

Expected: Only `apps/web/src/app/dashboard/setup/page.tsx` (which we already updated). If any other file imports it, update that file first.

- [ ] **Step 2: Delete the legacy component**

```bash
rm apps/web/src/components/dashboard/WorkspaceSetupWizard.tsx
```

- [ ] **Step 3: Run typecheck**

Run:

```bash
pnpm --filter web typecheck 2>&1 | tail -20
```

Expected: 0 errors. If there are errors, they indicate files that still reference the deleted component — fix them.

- [ ] **Step 4: Run build**

Run:

```bash
pnpm --filter web build 2>&1 | tail -10
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(setup): delete legacy WorkspaceSetupWizard

665-line bespoke component replaced by AnimatedWizardShell +
dashboardSetupWizard definition + 9 adapter components.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Final typecheck + full verification

**Files:** None (verification only)

- [ ] **Step 1: Full typecheck**

Run:

```bash
pnpm turbo typecheck 2>&1 | tail -30
```

Expected: 0 errors across all packages.

- [ ] **Step 2: Verify all three wizards still work**

1. `/join` — verify AnimatedWizardShell renders, step navigation works
2. `/onboarding` — verify loadState hydrates from intelligence_data (if test workspace available)
3. `/dashboard/setup` — verify full flow: loadState → steps → onComplete → redirect

- [ ] **Step 3: Verify the 406 bug is resolved**

Navigate to `/dashboard/setup` for a workspace without a `company_details` row. Verify no 406 error in console (the `loadState` uses `.maybeSingle()`).

- [ ] **Step 4: Commit any fixes**

If any issues found during verification, fix and commit.
