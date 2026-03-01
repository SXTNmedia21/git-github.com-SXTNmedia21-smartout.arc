# Admin Onboarding Wizard Completion — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the monolithic onboarding wizard into step components with progressive save, add inline auth after crawl, wire workspace activation, and add a full invite step (email + SMS + link).

**Architecture:** Extract 1,880-line `page.tsx` into ~15 step components + 4 drawers + 1 shared context hook. Auth step inserted after crawl. Progressive save to `onboarding_session` on each step transition. Existing `invitation` table + `create-invitation` Edge Function reused (not a new table). Email via SendGrid HTTP API, SMS via Twilio HTTP API.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind v4, Supabase Auth + DB + Edge Functions, SendGrid (email), Twilio (SMS)

---

## Critical Discovery: Existing Systems

The codebase already has a complete invitation system that the design doc didn't account for:

| System                            | Status                     | Files                                                |
| --------------------------------- | -------------------------- | ---------------------------------------------------- |
| `invitation` table                | Exists                     | `supabase/migrations/00011_employee_invitations.sql` |
| `invite_status` enum              | Exists                     | `pending`, `accepted`, `expired`, `cancelled`        |
| `create-invitation` Edge Function | Exists (no email dispatch) | `supabase/functions/create-invitation/index.ts`      |
| `accept-invitation` Edge Function | Exists (full flow)         | `supabase/functions/accept-invitation/index.ts`      |
| `/invite/[token]` acceptance page | Exists                     | `apps/web/src/app/invite/[token]/page.tsx`           |

**Plan adjustment:** We use the existing `invitation` table instead of creating `workspace_invite`. We extend `create-invitation` with email/SMS dispatch. We add `phone` and `invite_type` columns to the invitation table.

Also: `onboarding_session.current_step` is an **integer** (not string). We'll use a step-to-index mapping.

Also: Email uses **SendGrid** (not Resend). SSO providers are **all disabled** — defer SSO buttons to future work.

---

## Track A: Types & Hook Foundation

### Task 1: Create shared types file

**Files:**

- Create: `apps/web/src/app/onboarding/types.ts`

**Step 1: Create the types file**

```typescript
/**
 * onboarding/types.ts
 * Shared types for the onboarding wizard.
 * All step components and the useOnboardingWizard hook import from here.
 */

/** All possible wizard steps in order. */
export const WIZARD_STEPS = [
  "init",
  "crawling",
  "auth",
  "org_verification",
  "branding",
  "season_education",
  "season_identity",
  "departments",
  "teams",
  "locations",
  "procedures",
  "battlefield_review",
  "finalizing",
  "invite",
  "done",
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];

/**
 * Maps step names to onboarding_session.current_step integer values.
 * The DB column is integer, so we need this mapping for progressive save.
 */
export const STEP_INDEX: Record<WizardStep, number> = Object.fromEntries(
  WIZARD_STEPS.map((step, i) => [step, i]),
) as Record<WizardStep, number>;

/** Reverse mapping: integer → step name for session resume. */
export function stepFromIndex(index: number): WizardStep {
  return WIZARD_STEPS[index] ?? "init";
}

export interface CoreLocation {
  id?: string;
  name: string;
  description?: string;
  type?: string;
  [key: string]: unknown;
}

export interface CoreTeam {
  id?: string;
  name: string;
  description?: string;
  roles?: string[];
  isMultiDepartment?: boolean;
  [key: string]: unknown;
}

export interface CoreDepartment {
  id?: string;
  name: string;
  description?: string;
  teams?: CoreTeam[];
  isSeasonActive?: boolean;
  [key: string]: unknown;
}

export interface CoreProcedure {
  id?: string;
  title: string;
  description?: string;
  urgency?: string;
  assignedTo?: string;
  [key: string]: unknown;
}

export interface Policy {
  id: string;
  title: string;
  summary: string;
}

/** Full workspace data accumulated across all wizard steps. */
export interface WorkspaceData {
  name: string;
  website: string;
  email: string;
  phone: string;
  address: string;
  ceo: string;
  employeeCount: string;
  industry: string;
  concept: string;
  summary: string;
  slogan: string;
  locations: CoreLocation[];
  departments: CoreDepartment[];
  multiDepartmentTeams: CoreTeam[];
  procedures: CoreProcedure[];
  policies: Policy[];
  pageDictionary: Record<string, string>;
  images: { src: string; alt: string }[];
  menus: { href: string; text: string }[];
  socialLinks: Record<string, string>;
  reservationUrl: string | null;
  brandColor: string;
  communicationTone: string;
  seasonName: string;
  seasonStartDate: string;
  seasonEndDate: string;
  seasonType: string;
}

/** Default empty workspace data for wizard initialization. */
export const EMPTY_WORKSPACE_DATA: WorkspaceData = {
  name: "",
  website: "",
  email: "",
  phone: "",
  address: "",
  ceo: "",
  employeeCount: "",
  industry: "",
  concept: "",
  summary: "",
  slogan: "",
  locations: [],
  departments: [],
  multiDepartmentTeams: [],
  procedures: [],
  policies: [],
  pageDictionary: {},
  images: [],
  menus: [],
  socialLinks: {},
  reservationUrl: null,
  brandColor: "#3B82F6",
  communicationTone: "Professional & Formal",
  seasonName: "Core Operations",
  seasonStartDate: "",
  seasonEndDate: "",
  seasonType: "Permanent",
};

/** Verified org data from Brønnøysundregistrene lookup. */
export interface VerifiedOrgData {
  name: string;
  address: string;
  ceo: string;
  employeeCount?: string;
  industry?: string;
  description?: string;
}

/** Props that every step component receives from the wizard context. */
export interface WizardContext {
  step: WizardStep;
  goTo: (step: WizardStep) => void;
  workspaceData: WorkspaceData;
  updateData: (partial: Partial<WorkspaceData>) => void;
  sessionId: string | null;
  isAuthenticated: boolean;
  userId: string | null;
  error: string | null;
  setError: (error: string | null) => void;

  /** Org verification state */
  orgNumberInput: string;
  setOrgNumberInput: (value: string) => void;
  verifiedOrgData: VerifiedOrgData | null;
  setVerifiedOrgData: (data: VerifiedOrgData | null) => void;

  /** Workspace activation result */
  activatedWorkspaceId: string | null;
  activatedWorkspaceSlug: string | null;

  /** Finalize the workspace (call activate_workspace_v3) */
  finalize: () => Promise<void>;
}
```

**Step 2: Verify it compiles**

Run: `cd /home/sxtnl/dev/smartout.ai && pnpm --filter web exec tsc --noEmit --pretty 2>&1 | head -20`

**Step 3: Commit**

```bash
git add apps/web/src/app/onboarding/types.ts
git commit -m "feat(onboarding): add shared wizard types"
```

---

### Task 2: Create useOnboardingWizard hook

**Files:**

- Create: `apps/web/src/app/onboarding/hooks/useOnboardingWizard.ts`

**Context:** This hook is the brain of the wizard. It manages:

- Step navigation with `goTo()`
- Workspace data state with `updateData()`
- Progressive save to `onboarding_session` via Supabase
- Session resume on page load
- Auth state tracking
- Workspace activation via `activate-workspace` Edge Function

**Step 1: Create the hook**

```typescript
/**
 * onboarding/hooks/useOnboardingWizard.ts
 * Central state machine for the onboarding wizard.
 *
 * Manages step navigation, workspace data, progressive save to
 * onboarding_session, auth state, and workspace activation.
 *
 * Connected to: onboarding/types.ts (shared types)
 * Connected to: supabase/migrations/00009_onboarding_v3.sql (onboarding_session table)
 * Connected to: supabase/functions/activate-workspace/index.ts (workspace creation)
 */
"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createClient } from "@smartout/supabase/client";
import type { WizardStep, WizardContext, WorkspaceData, VerifiedOrgData } from "../types";
import { EMPTY_WORKSPACE_DATA, STEP_INDEX, stepFromIndex } from "../types";

/**
 * Debounce delay for saving to onboarding_session.
 * Set high enough to not spam DB on rapid field edits,
 * low enough that step transitions always persist.
 */
const SAVE_DEBOUNCE_MS = 500;

export function useOnboardingWizard(): WizardContext {
  const supabase = createClient();

  // Core state
  const [step, setStep] = useState<WizardStep>("init");
  const [workspaceData, setWorkspaceData] = useState<WorkspaceData>(EMPTY_WORKSPACE_DATA);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Org verification state
  const [orgNumberInput, setOrgNumberInput] = useState("");
  const [verifiedOrgData, setVerifiedOrgData] = useState<VerifiedOrgData | null>(null);

  // Activation result
  const [activatedWorkspaceId, setActivatedWorkspaceId] = useState<string | null>(null);
  const [activatedWorkspaceSlug, setActivatedWorkspaceSlug] = useState<string | null>(null);

  // Debounce ref for save
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasResumed = useRef(false);

  // ── Check auth state on mount ──
  useEffect(() => {
    async function checkAuth() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setIsAuthenticated(true);
        setUserId(user.id);
      }
    }
    checkAuth();

    // Listen for auth changes (signup/login during wizard)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setIsAuthenticated(true);
        setUserId(session.user.id);
      } else {
        setIsAuthenticated(false);
        setUserId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // ── Resume incomplete session ──
  useEffect(() => {
    if (!isAuthenticated || !userId || hasResumed.current) return;
    hasResumed.current = true;

    async function resume() {
      const { data } = await supabase
        .from("onboarding_session")
        .select(
          "id, current_step, scraped_data, confirmed_departments, confirmed_locations, confirmed_branding",
        )
        .eq("user_id", userId!)
        .is("completed_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) return;

      setSessionId(data.id);

      // Restore step from integer
      const restoredStep = stepFromIndex(data.current_step ?? 0);
      // Don't restore to transient steps like crawling/finalizing
      const safeStep =
        restoredStep === "crawling" || restoredStep === "finalizing" ? "init" : restoredStep;
      setStep(safeStep);

      // Restore workspace data from confirmed_* JSONB columns
      if (
        data.scraped_data ||
        data.confirmed_departments ||
        data.confirmed_locations ||
        data.confirmed_branding
      ) {
        const scraped = (data.scraped_data ?? {}) as Record<string, unknown>;
        const depts = data.confirmed_departments as CoreDepartment[] | null;
        const locs = data.confirmed_locations as CoreLocation[] | null;
        const branding = (data.confirmed_branding ?? {}) as Record<string, unknown>;

        setWorkspaceData((prev) => ({
          ...prev,
          name: (scraped.companyName as string) ?? prev.name,
          email: (scraped.email as string) ?? prev.email,
          phone: (scraped.phone as string) ?? prev.phone,
          summary: (scraped.summary as string) ?? prev.summary,
          ...(depts ? { departments: depts } : {}),
          ...(locs ? { locations: locs } : {}),
          brandColor: (branding.brandColor as string) ?? prev.brandColor,
          slogan: (branding.slogan as string) ?? prev.slogan,
          communicationTone: (branding.communicationTone as string) ?? prev.communicationTone,
        }));
      }
    }

    resume();
  }, [isAuthenticated, userId, supabase]);

  // ── Save to onboarding_session ──
  const save = useCallback(
    async (nextStep: WizardStep) => {
      if (!isAuthenticated || !userId) return;

      const upsertData = {
        user_id: userId,
        current_step: STEP_INDEX[nextStep],
        confirmed_departments: workspaceData.departments as unknown,
        confirmed_locations: workspaceData.locations as unknown,
        confirmed_branding: {
          brandColor: workspaceData.brandColor,
          slogan: workspaceData.slogan,
          communicationTone: workspaceData.communicationTone,
        } as unknown,
        updated_at: new Date().toISOString(),
      };

      if (sessionId) {
        await supabase.from("onboarding_session").update(upsertData).eq("id", sessionId);
      } else {
        const { data } = await supabase
          .from("onboarding_session")
          .insert({ ...upsertData, started_at: new Date().toISOString() })
          .select("id")
          .single();
        if (data) setSessionId(data.id);
      }
    },
    [isAuthenticated, userId, sessionId, workspaceData, supabase],
  );

  // ── Step navigation with auto-save ──
  const goTo = useCallback(
    (nextStep: WizardStep) => {
      setStep(nextStep);
      setError(null);

      // Debounced save on step transitions
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        save(nextStep);
      }, SAVE_DEBOUNCE_MS);
    },
    [save],
  );

  // ── Update workspace data ──
  const updateData = useCallback((partial: Partial<WorkspaceData>) => {
    setWorkspaceData((prev) => ({ ...prev, ...partial }));
  }, []);

  // ── Finalize: call activate-workspace Edge Function ──
  const finalize = useCallback(async () => {
    setStep("finalizing");
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke("activate-workspace", {
        body: { workspaceData },
      });

      if (invokeError) throw new Error(invokeError.message || "Failed to activate workspace");

      const workspaceId = data?.workspaceId;
      if (!workspaceId) throw new Error("No workspace ID returned");

      setActivatedWorkspaceId(workspaceId);

      // Fetch the workspace slug for redirect
      const { data: ws } = await supabase
        .from("workspace")
        .select("slug")
        .eq("workspace_id", workspaceId)
        .single();

      setActivatedWorkspaceSlug(ws?.slug ?? null);

      // Mark onboarding session as completed
      if (sessionId) {
        await supabase
          .from("onboarding_session")
          .update({
            workspace_id: workspaceId,
            completed_at: new Date().toISOString(),
            current_step: STEP_INDEX["invite"],
          })
          .eq("id", sessionId);
      }

      setStep("invite");
    } catch (err: unknown) {
      console.error("Finalization error:", err);
      setError(
        err instanceof Error ? err.message : "An error occurred while setting up your workspace.",
      );
      setStep("battlefield_review");
    }
  }, [workspaceData, sessionId, supabase]);

  const context = useMemo<WizardContext>(
    () => ({
      step,
      goTo,
      workspaceData,
      updateData,
      sessionId,
      isAuthenticated,
      userId,
      error,
      setError,
      orgNumberInput,
      setOrgNumberInput,
      verifiedOrgData,
      setVerifiedOrgData,
      activatedWorkspaceId,
      activatedWorkspaceSlug,
      finalize,
    }),
    [
      step,
      goTo,
      workspaceData,
      updateData,
      sessionId,
      isAuthenticated,
      userId,
      error,
      orgNumberInput,
      verifiedOrgData,
      activatedWorkspaceId,
      activatedWorkspaceSlug,
      finalize,
    ],
  );

  return context;
}
```

Import type needed at top (add after existing imports):

```typescript
import type { CoreDepartment, CoreLocation } from "../types";
```

**Step 2: Verify it compiles**

Run: `cd /home/sxtnl/dev/smartout.ai && pnpm --filter web exec tsc --noEmit --pretty 2>&1 | head -20`

**Step 3: Commit**

```bash
git add apps/web/src/app/onboarding/hooks/useOnboardingWizard.ts
git commit -m "feat(onboarding): add useOnboardingWizard hook with progressive save"
```

---

## Track B: Extract Existing Steps from Monolith

### Task 3: Create WizardProvider context + shell page

**Files:**

- Create: `apps/web/src/app/onboarding/WizardContext.tsx`
- Modify: `apps/web/src/app/onboarding/page.tsx` (replace entire contents)

**Step 1: Create WizardContext.tsx**

```typescript
/**
 * onboarding/WizardContext.tsx
 * React Context that provides the wizard state to all step components.
 * Wraps useOnboardingWizard hook into a Provider.
 */
"use client";

import { createContext, useContext } from "react";
import type { WizardContext as WizardContextType } from "./types";

const Context = createContext<WizardContextType | null>(null);

export function WizardProvider({ children, value }: { children: React.ReactNode; value: WizardContextType }) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/**
 * Access the wizard context from any step component.
 * Throws if used outside WizardProvider.
 */
export function useWizard(): WizardContextType {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useWizard must be used within WizardProvider");
  return ctx;
}
```

**Step 2: Replace page.tsx with the shell**

Replace the entire contents of `apps/web/src/app/onboarding/page.tsx` with:

```typescript
/**
 * onboarding/page.tsx
 * Shell page for the onboarding wizard.
 *
 * Renders the ambient background, WizardProvider, and routes to the
 * correct step component based on wizard state.
 *
 * Connected to: onboarding/hooks/useOnboardingWizard.ts (state machine)
 * Connected to: onboarding/WizardContext.tsx (context provider)
 */
"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { useOnboardingWizard } from "./hooks/useOnboardingWizard";
import { WizardProvider } from "./WizardContext";
import type { WizardStep } from "./types";

// Step components — lazy-loaded to keep initial bundle small
import { InitStep } from "./steps/InitStep";
import { CrawlStep } from "./steps/CrawlStep";
import { AuthStep } from "./steps/AuthStep";
import { OrgVerificationStep } from "./steps/OrgVerificationStep";
import { BrandingStep } from "./steps/BrandingStep";
import { SeasonEducationStep } from "./steps/SeasonEducationStep";
import { SeasonIdentityStep } from "./steps/SeasonIdentityStep";
import { DepartmentsStep } from "./steps/DepartmentsStep";
import { TeamsStep } from "./steps/TeamsStep";
import { LocationsStep } from "./steps/LocationsStep";
import { ProceduresStep } from "./steps/ProceduresStep";
import { BattlefieldReviewStep } from "./steps/BattlefieldReviewStep";
import { FinalizeStep } from "./steps/FinalizeStep";
import { InviteStep } from "./steps/InviteStep";
import { DoneStep } from "./steps/DoneStep";

/** Maps each step to its component. */
const STEP_COMPONENTS: Record<WizardStep, React.ComponentType> = {
  init: InitStep,
  crawling: CrawlStep,
  auth: AuthStep,
  org_verification: OrgVerificationStep,
  branding: BrandingStep,
  season_education: SeasonEducationStep,
  season_identity: SeasonIdentityStep,
  departments: DepartmentsStep,
  teams: TeamsStep,
  locations: LocationsStep,
  procedures: ProceduresStep,
  battlefield_review: BattlefieldReviewStep,
  finalizing: FinalizeStep,
  invite: InviteStep,
  done: DoneStep,
};

function OnboardingContent() {
  const wizard = useOnboardingWizard();
  const StepComponent = STEP_COMPONENTS[wizard.step];

  return (
    <WizardProvider value={wizard}>
      <div className="relative flex h-full w-full flex-col items-center justify-center bg-[#0a0a0c] font-sans text-zinc-300 selection:bg-cyan-500/30">
        {/* Ambient Background */}
        <div className="pointer-events-none absolute inset-0 z-0">
          <div className="absolute top-0 right-1/4 h-[800px] w-[800px] -translate-y-1/2 rounded-full bg-blue-600/10 blur-[120px]" />
          <div className="absolute bottom-0 left-1/4 h-[800px] w-[800px] translate-y-1/2 rounded-full bg-purple-600/10 blur-[120px]" />
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col justify-center px-6 py-12">
          <StepComponent />
        </div>
      </div>
    </WizardProvider>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full min-h-screen w-full items-center justify-center bg-[#0a0a0c]">
          <Loader2 className="animate-spin text-cyan-500" size={32} />
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
```

**Note:** Do NOT delete the old page.tsx contents yet. Save a backup first:

```bash
cp apps/web/src/app/onboarding/page.tsx apps/web/src/app/onboarding/page.tsx.bak
```

The `.bak` file is a temporary reference for extracting step JSX. Delete it after all steps are extracted.

**Step 3: Commit the shell (won't compile yet — step files don't exist)**

```bash
git add apps/web/src/app/onboarding/WizardContext.tsx apps/web/src/app/onboarding/page.tsx
git commit -m "feat(onboarding): add wizard shell page with step routing"
```

---

### Task 4: Extract InitStep + CrawlStep

**Files:**

- Create: `apps/web/src/app/onboarding/steps/InitStep.tsx`
- Create: `apps/web/src/app/onboarding/steps/CrawlStep.tsx`

**Context:** These are the first two steps. InitStep handles the URL input form. CrawlStep shows the loading spinner while the `gather-workspace-intelligence` Edge Function runs. Extract the JSX from the old `page.tsx.bak` lines 447-518, replacing direct state access with `useWizard()`.

**Key changes from monolith:**

- Replace `step`/`setStep` with `wizard.goTo()`
- Replace `workspaceData`/`setWorkspaceData` with `wizard.workspaceData`/`wizard.updateData()`
- Replace `urlInput`/`setUrlInput` with local state (only used in InitStep)
- After crawl completes: `goTo("auth")` instead of `goTo("org_verification")` — auth step is now between crawl and org verification
- If user is already authenticated: `goTo("org_verification")` to skip auth

**Step 1:** Extract InitStep from `page.tsx.bak` lines 447-502 (the `step === "init"` block). Use `useWizard()` for context. Include the `handleStartCrawling` logic and `useSearchParams` auto-start.

**Step 2:** Extract CrawlStep from `page.tsx.bak` lines 504-518 (the `step === "crawling"` block). This is just a loading spinner — minimal component.

**Step 3:** Verify both compile. Run: `pnpm --filter web exec tsc --noEmit --pretty 2>&1 | head -20`

**Step 4:** Commit:

```bash
git add apps/web/src/app/onboarding/steps/InitStep.tsx apps/web/src/app/onboarding/steps/CrawlStep.tsx
git commit -m "feat(onboarding): extract InitStep and CrawlStep"
```

---

### Task 5: Extract OrgVerificationStep

**Files:**

- Create: `apps/web/src/app/onboarding/steps/OrgVerificationStep.tsx`

**Context:** Extract from `page.tsx.bak` lines 520-627. This step does the Brønnøysundregistrene lookup. Uses `orgNumberInput`, `verifiedOrgData`, etc. from wizard context.

**Key changes:**

- The `handleVerifyOrg` function calls the Brreg API directly — keep this logic in the step (it's step-specific)
- `handleConfirmOrg` should save the org_number to the company if `tempWorkspaceId` exists, then `goTo("branding")`
- Replace `tempWorkspaceId` with `wizard.sessionId` if appropriate, or keep as local state within the step

**Step 1:** Extract the component, using `useWizard()` for shared state.
**Step 2:** Verify compile.
**Step 3:** Commit.

---

### Task 6: Extract BrandingStep + SeasonEducationStep + SeasonIdentityStep

**Files:**

- Create: `apps/web/src/app/onboarding/steps/BrandingStep.tsx`
- Create: `apps/web/src/app/onboarding/steps/SeasonEducationStep.tsx`
- Create: `apps/web/src/app/onboarding/steps/SeasonIdentityStep.tsx`

**Context:** These are straightforward extraction:

- BrandingStep: `page.tsx.bak` lines 629-725. Logo upload, slogan, brand color, tone.
- SeasonEducationStep: lines 727-765. Static explainer page, "I understand" button.
- SeasonIdentityStep: lines 767-876. Season name, dates, type selector.

All use `useWizard()` context. No special logic changes needed.

**Step 1-3:** Extract each, verify compile, commit together:

```bash
git commit -m "feat(onboarding): extract Branding, SeasonEducation, SeasonIdentity steps"
```

---

### Task 7: Extract DepartmentsStep + TeamsStep + LocationsStep + ProceduresStep

**Files:**

- Create: `apps/web/src/app/onboarding/steps/DepartmentsStep.tsx`
- Create: `apps/web/src/app/onboarding/steps/TeamsStep.tsx`
- Create: `apps/web/src/app/onboarding/steps/LocationsStep.tsx`
- Create: `apps/web/src/app/onboarding/steps/ProceduresStep.tsx`

**Context:** These are the data collection steps. Each has add/edit functionality with drawers.

- DepartmentsStep: lines 878-1054. Department cards + suggestions + "Add Custom" button.
- TeamsStep: lines 1056-1219. Teams per department + cross-department teams.
- LocationsStep: lines 1221-1309. Location cards + add.
- ProceduresStep: lines 1311-1412. Procedure list + urgency + assignment.

**Key change:** Drawer open/close state is local to each step (not shared). Each step imports its drawer component from `../drawers/`.

**Step 1-4:** Extract each step component.
**Step 5:** Verify compile.
**Step 6:** Commit:

```bash
git commit -m "feat(onboarding): extract Departments, Teams, Locations, Procedures steps"
```

---

### Task 8: Extract drawers

**Files:**

- Create: `apps/web/src/app/onboarding/drawers/DepartmentDrawer.tsx`
- Create: `apps/web/src/app/onboarding/drawers/TeamDrawer.tsx`
- Create: `apps/web/src/app/onboarding/drawers/LocationDrawer.tsx`
- Create: `apps/web/src/app/onboarding/drawers/ProcedureDrawer.tsx`

**Context:** Extract the 4 drawer overlays from `page.tsx.bak` lines 1513-1864. Each drawer is a slide-in panel with form fields and a "Done" button.

**Interface pattern for all drawers:**

```typescript
interface DepartmentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  department: CoreDepartment;
  onUpdate: (updated: CoreDepartment) => void;
}
```

Each drawer receives its entity + callbacks. The parent step manages open/close state and which index is being edited.

**Step 1-4:** Extract each drawer.
**Step 5:** Verify compile.
**Step 6:** Commit:

```bash
git commit -m "refactor(onboarding): extract drawer components"
```

---

### Task 9: Extract BattlefieldReviewStep + FinalizeStep + DoneStep

**Files:**

- Create: `apps/web/src/app/onboarding/steps/BattlefieldReviewStep.tsx`
- Create: `apps/web/src/app/onboarding/steps/FinalizeStep.tsx`
- Create: `apps/web/src/app/onboarding/steps/DoneStep.tsx`

**Context:**

- BattlefieldReviewStep: lines 1414-1484. Summary cards. **Enhance** to show all sections (locations, teams, procedures) with counts. Each section clickable to `goTo(step)` for editing.
- FinalizeStep: lines 1486-1497. Loading spinner. Calls `wizard.finalize()`.
- DoneStep: lines 1499-1510. Success message + redirect to dashboard.

**Enhancement for BattlefieldReviewStep:** Add cards for:

- Locations (count + name list)
- Departments (count + team count per dept)
- Procedures (count + urgency breakdown)

Each card has a small "Edit" link that calls `goTo("locations")` etc.

**Step 1-3:** Create each component. BattlefieldReviewStep enhanced with additional summary cards.
**Step 4:** Verify compile.
**Step 5:** Commit:

```bash
git commit -m "feat(onboarding): extract BattlefieldReview, Finalize, Done steps with enhanced review"
```

---

### Task 10: Delete backup file + verify full wizard works

**Files:**

- Delete: `apps/web/src/app/onboarding/page.tsx.bak`

**Step 1:** Delete the backup:

```bash
rm apps/web/src/app/onboarding/page.tsx.bak
```

**Step 2:** Full typecheck:

```bash
pnpm --filter web exec tsc --noEmit --pretty
```

**Step 3:** Start dev server and manually walk through all existing steps:

```bash
pnpm --filter web dev
```

Navigate to `http://localhost:3050/onboarding` and verify:

- Init → Enter URL → Crawling → (mock data loads) → Org Verification → Branding → Season Education → Season Identity → Departments → Teams → Locations → Procedures → Battlefield Review

**Step 4:** Commit the cleanup:

```bash
git add -A && git commit -m "refactor(onboarding): complete step extraction, remove monolith backup"
```

---

## Track C: New Features

### Task 11: Create AuthStep (inline signup after crawl)

**Files:**

- Create: `apps/web/src/app/onboarding/steps/AuthStep.tsx`

**Context:** This is a NEW step inserted between CrawlStep and OrgVerificationStep. It asks the user to create an account to save progress. If user is already authenticated, this step is skipped (handled in CrawlStep — after crawl completes, check `wizard.isAuthenticated`).

**UI:**

- Title: "Save your progress"
- Subtitle: "Create an account to keep everything we just found."
- Email + password form (matches existing signup page pattern)
- "Already have an account? Sign in" toggle (switches to login form)
- On success: creates `onboarding_session` row with scraped data, then `goTo("org_verification")`
- Error display inline

**Note:** SSO buttons deferred — all OAuth providers are currently disabled in `supabase/config.toml`. The AuthStep should be designed to easily add SSO buttons later (leave a commented placeholder section).

```typescript
/**
 * onboarding/steps/AuthStep.tsx
 * Inline auth step shown after crawl completes.
 *
 * Allows the user to create an account or sign in to save their
 * workspace setup progress. Skipped if already authenticated.
 *
 * Connected to: Supabase Auth (signUp, signInWithPassword)
 * Connected to: onboarding_session table (first save after auth)
 */
"use client";

import { useState } from "react";
import { useWizard } from "../WizardContext";
import { createClient } from "@smartout/supabase/client";
import { Bot, ArrowRight, Loader2 } from "lucide-react";

export function AuthStep() {
  const wizard = useWizard();
  const supabase = createClient();
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    const { error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Auth state change listener in useOnboardingWizard will set isAuthenticated
    // Progressive save will create the session on next goTo()
    wizard.goTo("org_verification");
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    wizard.goTo("org_verification");
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 mx-auto flex w-full max-w-xl flex-col items-center text-center duration-500">
      <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-full border border-cyan-500/20 bg-cyan-500/10 text-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.2)]">
        <Bot size={40} />
      </div>

      <h1 className="mb-3 text-3xl font-extrabold tracking-tight text-white">
        Save your progress
      </h1>
      <p className="mb-10 text-lg text-zinc-400">
        Create an account to keep everything we just found about your business.
      </p>

      <div className="w-full overflow-hidden rounded-3xl border border-white/5 bg-[#111] p-6 shadow-xl sm:p-8">
        {/* Tab toggle */}
        <div className="mb-6 flex rounded-xl bg-black/40 p-1">
          <button
            type="button"
            onClick={() => { setMode("signup"); setError(null); }}
            className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${mode === "signup" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={() => { setMode("signin"); setError(null); }}
            className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${mode === "signin" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            Sign In
          </button>
        </div>

        <form onSubmit={mode === "signup" ? handleSignUp : handleSignIn} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            required
            autoComplete="email"
            className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white transition-colors outline-none focus:border-cyan-500 placeholder:text-zinc-600"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "signup" ? "Password (min. 8 characters)" : "Password"}
            required
            minLength={8}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white transition-colors outline-none focus:border-cyan-500 placeholder:text-zinc-600"
          />
          {mode === "signup" && (
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white transition-colors outline-none focus:border-cyan-500 placeholder:text-zinc-600"
            />
          )}

          {error && <p className="text-sm font-medium text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-4 font-bold text-white shadow-lg shadow-cyan-500/20 transition-transform hover:from-cyan-400 hover:to-blue-500 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                {mode === "signup" ? "Create Account & Continue" : "Sign In & Continue"}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* SSO placeholder — enable when OAuth providers are configured */}
        {/* <div className="mt-6 border-t border-white/10 pt-6">
          <p className="mb-4 text-sm text-zinc-500">Or continue with</p>
          <div className="flex gap-3">
            <button className="...">Google</button>
            <button className="...">Microsoft</button>
          </div>
        </div> */}
      </div>

      <button
        type="button"
        onClick={() => wizard.goTo("org_verification")}
        className="mt-6 text-sm text-zinc-500 transition-colors hover:text-white"
      >
        Skip for now (you can create an account later)
      </button>
    </div>
  );
}
```

**Step 1:** Create the file with the code above.
**Step 2:** Update `CrawlStep` — after crawl completes, check `wizard.isAuthenticated`. If true, `goTo("org_verification")`. If false, `goTo("auth")`.
**Step 3:** Verify compile.
**Step 4:** Commit:

```bash
git add apps/web/src/app/onboarding/steps/AuthStep.tsx apps/web/src/app/onboarding/steps/CrawlStep.tsx
git commit -m "feat(onboarding): add AuthStep for inline signup after crawl"
```

---

### Task 12: DB migration — add phone + invite_type to invitation table

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_invitation_sms_support.sql`

**Context:** The existing `invitation` table only supports email. We need to add `phone` column and `invite_type` enum for SMS + link invite support.

**Step 1:** Create migration file (use current timestamp):

```sql
-- Migration: invitation_sms_support
-- Description: Add phone and invite_type columns to invitation table for SMS and link invite support.
-- Connected to: docs/plans/2026-03-01-admin-wizard-completion.md

-- Create the invite_type enum
CREATE TYPE public.invite_type AS ENUM ('email', 'sms', 'link');

-- Add new columns
ALTER TABLE public.invitation
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS invite_type public.invite_type NOT NULL DEFAULT 'email';

-- Relax the unique constraint to allow phone-only invites
-- Current constraint: UNIQUE(workspace_id, email, status)
-- We need to allow null email for phone/link invites
ALTER TABLE public.invitation
  ALTER COLUMN email DROP NOT NULL;

-- Add check constraint: must have email or phone (or be a link invite)
ALTER TABLE public.invitation
  ADD CONSTRAINT invitation_contact_check
  CHECK (email IS NOT NULL OR phone IS NOT NULL OR invite_type = 'link');

-- Index for phone lookups
CREATE INDEX IF NOT EXISTS idx_invitation_phone ON public.invitation (phone) WHERE phone IS NOT NULL;
```

**Step 2:** Apply migration locally:

```bash
cd /home/sxtnl/dev/smartout.ai && npx supabase db push --local
```

**Step 3:** Regenerate TypeScript types:

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

**Step 4:** Commit:

```bash
git add supabase/migrations/*invitation_sms* packages/supabase/src/database.types.ts
git commit -m "feat(db): add phone and invite_type to invitation table for SMS support"
```

---

### Task 13: Update create-invitation Edge Function with email + SMS dispatch

**Files:**

- Modify: `supabase/functions/create-invitation/index.ts`

**Context:** The existing `create-invitation` Edge Function creates invitation rows but has a TODO for email dispatch. We need to:

1. Accept `phone` and `invite_type` in the payload
2. Send email via SendGrid HTTP API (Deno-compatible, no npm package)
3. Send SMS via Twilio HTTP API
4. Support link-only invites (no external dispatch)

**Important:** Edge Functions run in Deno. Cannot use `@sendgrid/mail` npm package. Must use HTTP API directly.

**SendGrid HTTP API pattern for Deno:**

```typescript
const sgRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${Deno.env.get("SENDGRID_API_KEY")}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    personalizations: [{ to: [{ email: recipientEmail }] }],
    from: { email: "noreply@smartout.io", name: "Smartout" },
    subject: "You've been invited to join ...",
    content: [{ type: "text/html", value: htmlBody }],
  }),
});
```

**Twilio HTTP API pattern for Deno:**

```typescript
const twilioRes = await fetch(
  `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
  {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: phone,
      From: fromNumber,
      Body: `You've been invited to join ${workspaceName} on Smartout. Accept here: ${inviteUrl}`,
    }),
  },
);
```

**Step 1:** Update the Edge Function to support phone, invite_type, and dispatch.
**Step 2:** Add env vars to `.env.local.example` documentation (do NOT add actual secrets):

- `SENDGRID_API_KEY` (already exists)
- `TWILIO_ACCOUNT_SID` (already in env.ts)
- `TWILIO_AUTH_TOKEN` (already in env.ts)
- `TWILIO_FROM_NUMBER` (new — the Twilio phone number to send from)
  **Step 3:** Test locally with `supabase functions serve`.
  **Step 4:** Commit:

```bash
git add supabase/functions/create-invitation/index.ts
git commit -m "feat(edge): add email and SMS dispatch to create-invitation"
```

---

### Task 14: Create InviteStep component

**Files:**

- Create: `apps/web/src/app/onboarding/steps/InviteStep.tsx`

**Context:** This is the NEW step shown after workspace activation. It uses the existing `create-invitation` Edge Function. The admin can:

1. Enter an email → sends email invite
2. Enter a phone number → sends SMS invite
3. Copy an invite link (auto-generated)
4. Skip → go to dashboard

**Critical:** The admin just completed workspace activation, so we have `wizard.activatedWorkspaceId` and `wizard.activatedWorkspaceSlug`. We also need the `company_id` — get it from the workspace.

```typescript
/**
 * onboarding/steps/InviteStep.tsx
 * Post-activation step where the admin invites their first employee.
 *
 * Three invite channels: email, SMS, shareable link.
 * Uses the existing create-invitation Edge Function.
 *
 * Connected to: supabase/functions/create-invitation/index.ts
 * Connected to: supabase/migrations/00011_employee_invitations.sql (invitation table)
 */
```

**UI sections:**

1. Header: "Invite your first team member" + workspace name
2. Email invite: input + send button
3. Phone invite: input (with +47 prefix for Norway) + send button
4. Shareable link: auto-generated on first render, copy button
5. "Skip for now" → redirect to dashboard
6. Success states: "Email sent!" / "SMS sent!" with check icon
7. "Enter Dashboard" button always available

**For the shareable link:** Create a link-type invitation via `create-invitation` Edge Function with `invite_type: "link"`. Display the resulting token as `https://app.smartout.ai/invite/{token}`.

**Step 1:** Create the InviteStep component.
**Step 2:** Verify compile.
**Step 3:** Commit:

```bash
git add apps/web/src/app/onboarding/steps/InviteStep.tsx
git commit -m "feat(onboarding): add InviteStep with email, SMS, and link invite"
```

---

### Task 15: Wire DoneStep with dashboard redirect

**Files:**

- Modify: `apps/web/src/app/onboarding/steps/DoneStep.tsx`

**Context:** The DoneStep should redirect to the workspace dashboard. Use `wizard.activatedWorkspaceSlug` to build the URL.

**Production:** `https://{slug}.smartout.ai/dashboard`
**Development:** `http://localhost:3050/dashboard` (subdomain routing doesn't work locally)

```typescript
const dashboardUrl =
  process.env.NEXT_PUBLIC_ROOT_DOMAIN === "localhost"
    ? "/dashboard"
    : `https://${wizard.activatedWorkspaceSlug}.smartout.ai/dashboard`;
```

**Step 1:** Update DoneStep with redirect logic.
**Step 2:** Commit:

```bash
git add apps/web/src/app/onboarding/steps/DoneStep.tsx
git commit -m "feat(onboarding): wire DoneStep redirect to workspace dashboard"
```

---

## Track D: Integration & Verification

### Task 16: Full typecheck + lint

**Step 1:** Run full typecheck:

```bash
cd /home/sxtnl/dev/smartout.ai && pnpm typecheck
```

**Step 2:** Run lint:

```bash
pnpm lint
```

**Step 3:** Fix any errors.
**Step 4:** Commit fixes:

```bash
git add -A && git commit -m "fix(onboarding): typecheck and lint fixes"
```

---

### Task 17: Manual E2E verification

**Step 1:** Start local Supabase:

```bash
npx supabase start
```

**Step 2:** Start dev server:

```bash
pnpm --filter web dev
```

**Step 3:** Walk through the full wizard flow:

1. Go to `http://localhost:3050/onboarding`
2. Enter a test URL → verify crawl works (or mock data fallback)
3. Auth step appears → create account → verify redirect to org verification
4. Walk through all steps to battlefield review
5. Click "Activate Workspace" → verify finalize loading → invite step
6. Send a test invite (email) → verify invitation row created
7. Copy invite link → verify URL format
8. Click "Enter Dashboard" → verify redirect

**Step 4:** Test session resume:

1. Start wizard, get to departments step
2. Refresh the page → verify wizard resumes at departments with data preserved

**Step 5:** Fix any issues found during testing.

---

## Task Dependency Graph

```
Track A (Foundation):     Task 1 → Task 2
Track B (Extract):        Task 3 → Task 4 → Task 5 → Task 6 → Task 7 → Task 8 → Task 9 → Task 10
Track C (New Features):   Task 11 (AuthStep, depends on Task 4)
                          Task 12 (DB migration, independent)
                          Task 13 (Edge Function, depends on Task 12)
                          Task 14 (InviteStep, depends on Task 13)
                          Task 15 (DoneStep, depends on Task 9)
Track D (Integration):    Task 16 → Task 17 (depend on all above)
```

**Parallelization opportunities:**

- Tasks 1-2 (Track A) can run in parallel with Task 12 (DB migration)
- Tasks 4-8 (step extraction) are sequential but each is fast mechanical work
- Task 11 (AuthStep) can be built while Tasks 5-8 are being extracted
- Task 13 (Edge Function) can be built while Track B completes

---

## Files Created/Modified Summary

| Action  | File                                                            |
| ------- | --------------------------------------------------------------- |
| Create  | `apps/web/src/app/onboarding/types.ts`                          |
| Create  | `apps/web/src/app/onboarding/hooks/useOnboardingWizard.ts`      |
| Create  | `apps/web/src/app/onboarding/WizardContext.tsx`                 |
| Replace | `apps/web/src/app/onboarding/page.tsx`                          |
| Create  | `apps/web/src/app/onboarding/steps/InitStep.tsx`                |
| Create  | `apps/web/src/app/onboarding/steps/CrawlStep.tsx`               |
| Create  | `apps/web/src/app/onboarding/steps/AuthStep.tsx`                |
| Create  | `apps/web/src/app/onboarding/steps/OrgVerificationStep.tsx`     |
| Create  | `apps/web/src/app/onboarding/steps/BrandingStep.tsx`            |
| Create  | `apps/web/src/app/onboarding/steps/SeasonEducationStep.tsx`     |
| Create  | `apps/web/src/app/onboarding/steps/SeasonIdentityStep.tsx`      |
| Create  | `apps/web/src/app/onboarding/steps/DepartmentsStep.tsx`         |
| Create  | `apps/web/src/app/onboarding/steps/TeamsStep.tsx`               |
| Create  | `apps/web/src/app/onboarding/steps/LocationsStep.tsx`           |
| Create  | `apps/web/src/app/onboarding/steps/ProceduresStep.tsx`          |
| Create  | `apps/web/src/app/onboarding/steps/BattlefieldReviewStep.tsx`   |
| Create  | `apps/web/src/app/onboarding/steps/FinalizeStep.tsx`            |
| Create  | `apps/web/src/app/onboarding/steps/InviteStep.tsx`              |
| Create  | `apps/web/src/app/onboarding/steps/DoneStep.tsx`                |
| Create  | `apps/web/src/app/onboarding/drawers/DepartmentDrawer.tsx`      |
| Create  | `apps/web/src/app/onboarding/drawers/TeamDrawer.tsx`            |
| Create  | `apps/web/src/app/onboarding/drawers/LocationDrawer.tsx`        |
| Create  | `apps/web/src/app/onboarding/drawers/ProcedureDrawer.tsx`       |
| Create  | `supabase/migrations/YYYYMMDDHHMMSS_invitation_sms_support.sql` |
| Modify  | `supabase/functions/create-invitation/index.ts`                 |
| Regen   | `packages/supabase/src/database.types.ts`                       |
