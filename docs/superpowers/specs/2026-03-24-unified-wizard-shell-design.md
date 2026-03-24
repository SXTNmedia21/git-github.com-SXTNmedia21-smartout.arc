---
title: Unified Wizard Shell Design
status: draft
updated: 2026-03-24
created: 2026-03-24
module: ui
tags: [wizard, design-system, walk-ai, onboarding, join, dashboard-setup, i18n]
---

# Unified Wizard Shell Design

## Problem

Three separate wizard implementations (Join, Onboarding, Dashboard Setup) have drifted apart in design, token usage, and code quality:

- **Join** -- Cherry-pick `d27a2d82` broke the sidebar by referencing 4 CSS variables (`--color-join-bg`, `--color-join-panel`, `--color-join-glow-1`, `--color-join-glow-2`) never added to `globals.css`
- **Dashboard Setup** -- 38+ hardcoded color violations (`bg-zinc-*`, `bg-orange-*`, `text-zinc-*`) across 11 step components after incomplete token migration (commit `6b8a8c7e`)
- **Onboarding** -- Mostly healthy tokens, but over-engineered with Botsson voice agent, scroll-based parallax, and 371-line WizardContext. This is a **rewrite** to a simplified confirmation flow, not a migration.
- **i18n** -- `apps/web` has zero imports of `@smartout/i18n`. All text is hardcoded. `apps/mobile` has hardcoded Norwegian strings in `constants/strings.ts`.

Each wizard has its own layout, navigation, progress tracking, state management, and animation system. Changes to one don't propagate. Design drift is inevitable.

## Solution

Two parallel workstreams:

1. **i18n Foundation** -- Upgrade `packages/i18n` and wire it into all three surfaces (web, mobile, landing)
2. **WizardShell** -- A single `<WizardShell>` component that all wizards use, built on the i18n foundation

### Principles

1. **Shell = identical** -- Progress, navigation, layout, sidebar, transitions, responsive, i18n
2. **Steps = free within tokens** -- Each step component has its own visual character but must use the design token system
3. **Theme variants** -- Shell accepts a theme (`dark` | `warm` | `light`) that sets the color profile
4. **AI-agent ready** -- Walk AI semantic tagging (NEW convention, see ADR), telemetry events on everything
5. **Mobile-first** -- Phone, tablet/iPad, desktop breakpoints from day 1
6. **Bilingual** -- Norwegian + English via `packages/i18n` from day 1. No hardcoded text.

---

## Part 1: i18n Foundation

### Current State

| Surface         | Status    | Details                                                                                  |
| --------------- | --------- | ---------------------------------------------------------------------------------------- |
| `apps/landing`  | Active    | 7 files import `@smartout/i18n`, middleware resolves locale via URL/cookie/geo           |
| `apps/web`      | None      | Zero imports, all hardcoded Norwegian/English                                            |
| `apps/mobile`   | Hardcoded | `constants/strings.ts` with 200+ Norwegian strings, planned V2 migration                 |
| `packages/i18n` | Minimal   | `createTranslator(locale, namespace)` -- no interpolation, no React hook, no type safety |

### What Exists

- **4 namespaces**: `common` (41 keys), `landing` (120 keys), `docs` (37 keys), `onboarding` (167 keys)
- **2 locales**: nb, en (both complete for existing namespaces)
- **6 declared but unimplemented**: sv, da, pl, ar, so, fi
- **Locale resolution**: Landing middleware reads URL prefix, cookie, Vercel geo header

### What Must Be Built

#### 1. Add string interpolation to `createTranslator`

Current: `t("crawling.title")` returns literal `"Analyserer {url}..."` -- cannot substitute.

New signature:

```typescript
function t(key: string, params?: Record<string, string | number>): string;
// t("crawling.title", { url: "example.com" }) -> "Analyserer example.com..."
```

Simple `{key}` replacement. No ICU MessageFormat complexity.

#### 2. Add `useTranslation` React hook

```typescript
// packages/i18n/src/react.ts
"use client"

import { createContext, useContext } from "react"
import { createTranslator, type SupportedLocale } from "./translate"

const LocaleContext = createContext<SupportedLocale>("nb")

export function LocaleProvider({ locale, children }: { locale: SupportedLocale; children: React.ReactNode }) {
  return <LocaleContext value={locale}>{children}</LocaleContext>
}

export function useTranslation(namespace: string) {
  const locale = useContext(LocaleContext)
  const t = createTranslator(locale, namespace)
  return { t, locale }
}
```

#### 3. Add `LocaleProvider` to app layouts

```typescript
// apps/web/src/app/layout.tsx -- wrap children
<LocaleProvider locale={resolvedLocale}>
  {children}
</LocaleProvider>
```

Locale resolution for web: cookie or browser `Accept-Language` header (no URL prefix -- web uses subdomains).

#### 4. Add new namespaces

| Namespace    | Purpose                                      | Keys (est.) |
| ------------ | -------------------------------------------- | ----------- |
| `wizard`     | Shared shell text (nav, progress)            | ~10         |
| `join`       | Join wizard step labels + content            | ~60         |
| `onboarding` | Already exists, extend for confirmation flow | ~30         |
| `dashboard`  | Dashboard setup + general dashboard text     | ~100        |

#### 5. Type-safe keys (optional, recommended)

Generate TypeScript types from JSON files:

```typescript
// Auto-generated from locales/nb/wizard.json
type WizardKeys =
  | "nav.back"
  | "nav.next"
  | "nav.skip"
  | "nav.finish"
  | "progress.step"
  | "progress.estimated";
```

This catches typos at compile time. Can be a build step or manual.

### i18n Parallelization Plan

Three agents, separate scopes, no file conflicts:

| Agent   | Scope                          | Namespace             | File conflicts       |
| ------- | ------------------------------ | --------------------- | -------------------- |
| Agent 1 | `apps/web/src/app/join/`       | `join`                | None -- isolated dir |
| Agent 2 | `apps/web/src/app/onboarding/` | `onboarding` (extend) | None -- isolated dir |
| Agent 3 | `apps/web/src/app/dashboard/`  | `dashboard`           | None -- isolated dir |

**Prerequisites (before agents start):**

1. Interpolation added to `createTranslator`
2. `useTranslation` hook created
3. `LocaleProvider` wired into `apps/web/src/app/layout.tsx`
4. Empty namespace JSON files created
5. i18n key naming convention documented (see below)

### i18n Key Naming Convention

```
{namespace}.{section}.{element}

Examples:
  wizard.nav.back           -- Shell navigation
  join.account.email_label  -- Join step content
  join.account.email_placeholder
  dashboard.payroll.tariff_title
  onboarding.departments.confirm_heading
```

Rules:

- Flat structure, max 2 levels of nesting in JSON
- `snake_case` for key segments
- Keys describe the UI element, not the content
- Parameterized keys use `{param}` syntax: `"progress.step": "Steg {current} av {total}"`

---

## Part 2: Data Flow Between Wizards

```
JOIN (collects)
  - Registration, business info, web scraping, BRREG, Google Places
  - Workspace Intelligence pipeline
  - Stores to: intelligence_data in DB
      |
      v
I1 Industry Intelligence (generates)
  - Suggests departments, locations, procedures, seasons
  - Based on industry vertical + scraped data
      |
      v
ONBOARDING (confirms)
  - Pre-filled from Join + I1 suggestions
  - User confirms/adjusts: departments, locations, routines, procedures
  - No Botsson -- removed (voice agent operates in arena, not confirmation flows)
  - Pure confirmation and adjustment flow
      |
      v
DASHBOARD SETUP (configures)
  - Technical configuration based on confirmed data
  - Upload documents, knowledge, handbooks
  - Configure payroll, contracts, shifts, seasons
  - Individual data setup
```

**Rule:** Data is collected ONCE in Join. Everything after is confirmation, adjustment, or technical configuration. No wizard asks for data that was already collected.

**Ownership contract:** Per `docs/specs/SETUP_WIZARD_ARCHITECTURE.md`, `/join` creates provisional data, `/onboarding` confirms and finalizes through `finalize-workspace`, `/dashboard/setup` is post-bootstrap technical configuration.

---

## Part 3: WizardDefinition -- Config Object

```typescript
interface WizardDefinition<TState extends Record<string, unknown>> {
  /** Unique wizard identifier */
  id: string;

  /** Color profile for the shell */
  theme: "dark" | "warm" | "light";

  /** Ordered step definitions */
  steps: WizardStepDef<TState>[];

  /** Wizard metadata */
  metadata: {
    titleKey: string; // i18n key: "join.wizard.title"
    descriptionKey: string; // i18n key: "join.wizard.description"
    i18nNamespace: string; // "join" | "onboarding" | "dashboard"
  };

  /** Initial state (or empty defaults) */
  initialState: TState;

  /** Load pre-filled state from previous phase (DB/API) */
  loadState?: () => Promise<Partial<TState>>;

  /** Called when wizard completes all steps */
  onComplete?: (state: TState) => Promise<void>;
}
```

## WizardStepDef -- Step Configuration

```typescript
interface WizardStepDef<TState> {
  /** Unique step identifier within this wizard */
  id: string;

  /** i18n key for sidebar label (resolved via definition.metadata.i18nNamespace) */
  labelKey: string;

  /** Lucide icon for sidebar */
  icon?: LucideIcon;

  /** The step component to render */
  component: ComponentType<WizardStepProps<TState>>;

  /** Zod schema -- validated before allowing next() */
  validation?: ZodSchema;

  /** Whether the user can skip this step */
  skippable?: boolean;

  /** Estimated time in minutes (shown in progress) */
  estimatedMinutes?: number;
}
```

## WizardStepProps -- What Step Components Receive

```typescript
interface WizardStepProps<TState> {
  // --- Data ---
  state: TState;
  updateState: (patch: Partial<TState>) => void;

  // --- Navigation ---
  next: () => void;
  back: () => void;
  goTo: (stepId: string) => void;
  isFirst: boolean;
  isLast: boolean;

  // --- Translation ---
  t: (key: string, params?: Record<string, string | number>) => string;

  // --- Theme ---
  theme: WizardThemeTokens;

  // --- Walk AI (semantic tagging helper) ---
  walkai: {
    /** Generate data-walkai-id: walkai.id("email-input") -> "join-account-email-input" */
    id: (element: string) => string;
    /** Generate all data-walkai-* attributes */
    tag: (
      element: string,
      intent: string,
      context?: Record<string, unknown>,
    ) => WalkAiDataAttributes;
  };
}

type WalkAiDataAttributes = {
  "data-walkai-id": string;
  "data-walkai-intent": string;
  "data-walkai-type": string;
  "data-walkai-context"?: string;
};
```

---

## Part 4: Shell Layout

### Desktop (>1024px)

```
+-------------+----------------------------------+
|  Sidebar    |                                  |
|             |  Step Content Area               |
|  [Logo]     |                                  |
|             |  {steps[currentIndex].component} |
|  * Step 1   |                                  |
|  * Step 2   |  <- Free design within tokens    |
|  o Step 3   |                                  |
|  o Step 4   |                                  |
|             |                                  |
|             +----------------------------------+
|             |  <- Back       Next ->   [Skip]  |
+-------------+----------------------------------+
```

### Tablet/iPad (640-1024px)

```
+------------------------------------------+
|  [Logo]  Step 1 > Step 2 > Step 3 > ...  |
+------------------------------------------+
|                                          |
|  Step Content Area                       |
|                                          |
|  {steps[currentIndex].component}         |
|                                          |
+------------------------------------------+
|  <- Back              Next ->    [Skip]  |
+------------------------------------------+
```

### Mobile (<640px)

```
+---------------------------+
| [Logo]  2/6  Step Name    |
| [====-------] progress    |
+---------------------------+
|                           |
| Step Content Area         |
|                           |
| {steps[i].component}      |
|                           |
+---------------------------+
| <- Back    Next -> [Skip] |
+---------------------------+
```

### Shell Responsibilities

- Sidebar/top-bar with step progress indicators
- Navigation bar (back/next/skip) with validation gate
- Step transition animations (slide + fade, spring physics per Ren og Varm)
- Theme application (CSS variables on shell wrapper)
- Responsive layout across all three breakpoints
- Keyboard navigation (Enter = next, Escape = back)
- Telemetry (see Telemetry section)
- Walk AI semantic tags on shell elements
- i18n via `useTranslation("wizard")` for shell text

### Step Component Responsibilities

- All content within the content area
- Own animations and visual effects (within token system)
- Call `updateState()` to persist data
- Call `next()` when ready to advance (or let nav bar handle it)
- Use `t()` for all text (translator scoped to wizard's namespace)
- Use `walkai.tag()` on interactive elements

---

## Part 5: Theme System

Three theme variants set CSS variables on the shell wrapper via a CSS class.

### Token Definitions (added to packages/design-tokens/src/tokens.ts)

Source of truth is `tokens.ts`. Values flow: `tokens.ts` -> `tokens.css` (manual sync, no build script) -> `globals.css @theme inline`. The `tokens.css` file header says "AUTO-DERIVED" but there is no generation script -- sync is manual.

```typescript
// packages/design-tokens/src/tokens.ts
export const wizard = {
  dark: {
    bg: "oklch(0.12 0.02 50)",
    sidebar: "oklch(0.08 0.01 50)",
    text: "oklch(0.85 0 0)",
    textMuted: "oklch(0.55 0 0)",
    border: "oklch(0.2 0.01 50)",
    stepPending: "oklch(0.35 0 0)",
  },
  warm: {
    bg: "oklch(0.97 0.008 60)",
    sidebar: "oklch(0.94 0.01 60)",
    text: "oklch(0.2 0.02 50)",
    textMuted: "oklch(0.5 0.02 50)",
    border: "oklch(0.88 0.01 60)",
    stepPending: "oklch(0.7 0.01 60)",
  },
  // light theme uses existing surface tokens (--background, --card, etc.)
} as const;
```

### CSS Variables (derived into tokens.css)

```css
/* In tokens.css :root block */
--wizard-dark-bg: oklch(0.12 0.02 50);
--wizard-dark-sidebar: oklch(0.08 0.01 50);
--wizard-dark-text: oklch(0.85 0 0);
--wizard-dark-text-muted: oklch(0.55 0 0);
--wizard-dark-border: oklch(0.2 0.01 50);
--wizard-dark-step-pending: oklch(0.35 0 0);

--wizard-warm-bg: oklch(0.97 0.008 60);
--wizard-warm-sidebar: oklch(0.94 0.01 60);
--wizard-warm-text: oklch(0.2 0.02 50);
--wizard-warm-text-muted: oklch(0.5 0.02 50);
--wizard-warm-border: oklch(0.88 0.01 60);
--wizard-warm-step-pending: oklch(0.7 0.01 60);
```

### Theme Application (CSS class on shell wrapper)

```css
/* In globals.css -- scoped custom properties */
[data-wizard-theme="dark"] {
  --wizard-bg: var(--wizard-dark-bg);
  --wizard-sidebar: var(--wizard-dark-sidebar);
  --wizard-text: var(--wizard-dark-text);
  --wizard-text-muted: var(--wizard-dark-text-muted);
  --wizard-border: var(--wizard-dark-border);
  --wizard-step-active: var(--brand-orange);
  --wizard-step-completed: var(--success);
  --wizard-step-pending: var(--wizard-dark-step-pending);
}

[data-wizard-theme="warm"] {
  --wizard-bg: var(--wizard-warm-bg);
  --wizard-sidebar: var(--wizard-warm-sidebar);
  --wizard-text: var(--wizard-warm-text);
  --wizard-text-muted: var(--wizard-warm-text-muted);
  --wizard-border: var(--wizard-warm-border);
  --wizard-step-active: var(--brand-orange);
  --wizard-step-completed: var(--success);
  --wizard-step-pending: var(--wizard-warm-step-pending);
}

[data-wizard-theme="light"] {
  --wizard-bg: var(--background);
  --wizard-sidebar: var(--card);
  --wizard-text: var(--foreground);
  --wizard-text-muted: var(--muted-foreground);
  --wizard-border: var(--border);
  --wizard-step-active: var(--brand-orange);
  --wizard-step-completed: var(--success);
  --wizard-step-pending: var(--muted);
}
```

Shell uses: `bg-[var(--wizard-bg)]`, `text-[var(--wizard-text)]`, etc. This avoids polluting the global `@theme inline` block with wizard-specific mappings.

### WizardThemeTokens (passed to steps)

```typescript
interface WizardThemeTokens {
  name: "dark" | "warm" | "light";
  // Steps can read theme name to adapt their visual character
}
```

Steps read CSS variables directly via Tailwind arbitrary values or inline styles. No duplication of token values in JS.

---

## Part 6: Animations

### Platform Strategy

Animations live in `apps/web`, NOT in `packages/ui`. Reason: framer-motion is web-only and not available in React Native. The shell component in `packages/ui` exports the layout and logic. The web app wraps it with animations.

```
packages/ui/src/wizard/
  WizardShell.tsx          -- Layout + logic (no animation deps)
  WizardSidebar.tsx        -- Sidebar structure
  WizardTopBar.tsx         -- Mobile/tablet top bar
  WizardNavBar.tsx         -- Navigation buttons

apps/web/src/components/wizard/
  AnimatedWizardShell.tsx  -- Wraps WizardShell with framer-motion transitions
```

### Step Transitions (Ren og Varm Compliant)

Spring physics: stiffness 30-45, damping 20-24, mass 2-2.5.

```typescript
const stepTransition = {
  enter: {
    opacity: [0, 1],
    x: [24, 0],
    transition: { type: "spring", stiffness: 35, damping: 22, mass: 2 },
  },
  exit: {
    opacity: [1, 0],
    x: [0, -24],
    transition: { duration: 0.25 }, // Min 250ms exit per spec
  },
};
```

### Sidebar Progress

- Completed steps: scale-in checkmark with spring
- Active step: pulse glow on indicator dot
- Connecting line between steps: animated fill on completion

### Navigation Bar

- Next button: subtle scale on hover (1.02), spring press (0.98)
- Disabled state: opacity 0.5, no pointer events
- Validation error: shake animation (horizontal spring, 3 oscillations)

---

## Part 7: Walk AI Integration (Structural Prep)

The shell exposes semantic tags for future AI agent operation. This is a **NEW convention** -- no existing codebase pattern for `data-walkai-id`/`data-walkai-intent`/`data-walkai-type`. Existing `data-walkai-*` attributes (`no-drag`, `no-expand`, `content`) are behavioral flags, not semantic tags. This new convention requires an ADR.

No agent logic is implemented in v1. Tags only.

### Shell-Level Tags

```html
<div
  data-walkai-id="{wizardId}-shell"
  data-walkai-type="wizard"
  data-walkai-context='{
    "wizardId": "join",
    "currentStep": "account",
    "currentStepIndex": 0,
    "totalSteps": 6,
    "theme": "dark"
  }'
></div>
```

### Step-Level Tags

```html
<div
  data-walkai-id="{wizardId}-{stepId}-step"
  data-walkai-type="wizard-step"
  data-walkai-intent="{step description}"
></div>
```

### walkai Helper (provided to steps)

```tsx
function Step1Account({ walkai, state, updateState, t }: WizardStepProps<JoinState>) {
  return (
    <input
      {...walkai.tag("email-input", "Enter email address", { required: true, fieldType: "email" })}
      placeholder={t("account.email_placeholder")}
      value={state.email}
      onChange={(e) => updateState({ email: e.target.value })}
    />
  );
}
// Generates:
// data-walkai-id="join-account-email-input"
// data-walkai-intent="Enter email address"
// data-walkai-type="input"
// data-walkai-context='{"required":true,"fieldType":"email"}'
```

### Future Agent Bridge (v2)

```typescript
// Defined as a contract. NOT implemented in v1.
// When implemented, must wrap in ClientTool definitions
// to align with packages/agent-sdk patterns.
interface WizardAgentBridge {
  getState: () => WizardState;
  getCurrentStep: () => WizardStepDef;
  goToStep: (stepId: string) => void;
  next: () => void;
  back: () => void;
  updateState: (patch: Partial<unknown>) => void;
  onStepChange: (cb: (step: WizardStepDef) => void) => Unsubscribe;
  onStateChange: (cb: (state: unknown) => void) => Unsubscribe;
}
```

---

## Part 8: Telemetry

Every wizard interaction emits via `@smartout/telemetry`. Events use the existing space-separated naming convention from `registry.ts`.

### Event Naming

Registry convention: `"{domain} {action}"` -- e.g. `"wizard step_completed"`, `"wizard completed"`.

### Shell Events (automatic)

| Event                        | Properties                                       | When                       | Registry Status                                                                                      |
| ---------------------------- | ------------------------------------------------ | -------------------------- | ---------------------------------------------------------------------------------------------------- |
| `"wizard started"`           | `{ wizard_id, theme, total_steps }`              | Shell mounts               | NEW -- must register                                                                                 |
| `"wizard step_entered"`      | `{ wizard_id, step_id, step_index, from_step? }` | Step becomes active        | NEW -- must register                                                                                 |
| `"wizard step_completed"`    | `{ wizard_id, step_id, step_index }`             | next() succeeds validation | EXISTS (line 1140) -- UPDATE: add `wizard_id`                                                        |
| `"wizard step_skipped"`      | `{ wizard_id, step_id, step_index }`             | User clicks Skip           | NEW -- must register                                                                                 |
| `"wizard step_back"`         | `{ wizard_id, step_id, to_step }`                | User clicks Back           | NEW -- must register                                                                                 |
| `"wizard completed"`         | `{ wizard_id, workspace_id? }`                   | Last step completed        | EXISTS (line 1150) -- UPDATE: add `wizard_id`, make `workspace_id` nullable (null for Join pre-auth) |
| `"wizard abandoned"`         | `{ wizard_id, last_step, duration_ms }`          | User leaves mid-wizard     | NEW -- must register                                                                                 |
| `"wizard validation_failed"` | `{ wizard_id, step_id, errors[] }`               | Validation blocks next()   | NEW -- must register                                                                                 |

### Telemetry Wrapper

The `useWizardTelemetry` hook lives in `apps/web/src/components/wizard/` (not `packages/ui`) because it imports `@smartout/telemetry` which may not be available in React Native. It wraps `emit()` to construct full `SmartoutEvent` objects:

```typescript
function useWizardTelemetry(wizardId: string) {
  // workspace_id: from WizardDefinition context or null (Join wizard pre-auth)
  // actor_id: from auth context or "anonymous" (Join wizard pre-auth)
  // For Join wizard: workspace_id=null, actor_id="anonymous" until Step6CreateAccount
}
```

Pre-auth context (Join wizard): `workspace_id: null`, `actor_id: "anonymous"`. After auth step, switch to real values.

### Implementation Requirement

6 new events must be added to `packages/telemetry/src/registry.ts`:

1. Add TypeScript interfaces to the `SmartoutEvent` discriminated union
2. Add entries to `EVENT_ROUTING` with destinations + category
3. Update 2 existing interfaces: add `wizard_id` to `WizardStepCompleted` and `WizardCompleted`, make `workspace_id` nullable on `WizardCompleted`

**Note:** The registry uses two naming conventions: space-separated (`"wizard step_completed"`) and dot-separated (`"channel.created"`). Wizard events follow the space-separated convention.

---

## Part 9: File Structure

```
packages/i18n/
  src/
    translate.ts             # Enhanced: add {param} interpolation
    react.ts                 # NEW: LocaleProvider + useTranslation hook
    index.ts                 # Updated exports
  locales/
    nb/
      wizard.json            # NEW: shared shell keys
      join.json              # NEW: join wizard keys
      dashboard.json         # NEW: dashboard keys
      onboarding.json        # EXTEND: add confirmation flow keys
    en/
      (same structure)

packages/ui/src/wizard/
  WizardShell.tsx            # Layout + logic (framework-agnostic, no framer-motion)
  WizardSidebar.tsx          # Desktop sidebar with progress
  WizardTopBar.tsx           # Mobile/tablet progress bar
  WizardNavBar.tsx           # Back/Next/Skip navigation
  types.ts                   # WizardDefinition, WizardStepProps, WizardThemeTokens
  useWizardState.ts          # Internal state management hook
  useWizardWalkAi.ts         # Walk AI semantic tag helpers
  index.ts                   # Public exports ("use client" on hooks)

apps/web/src/components/wizard/
  AnimatedWizardShell.tsx    # Wraps packages/ui WizardShell with framer-motion
  useWizardTelemetry.ts      # Auto-telemetry hook (web-only: imports @smartout/telemetry)

apps/web/src/app/join/
  wizard-definition.ts       # joinWizard: WizardDefinition<JoinState>
  page.tsx                   # <AnimatedWizardShell definition={joinWizard} />
  steps/
    Step1Account.tsx         # Existing (refactored to WizardStepProps)
    Step2Business.tsx        # Existing (was Step2Business.tsx)
    Step3About.tsx           # Existing (was Step3About.tsx)
    Step4Hours.tsx           # Existing (was Step4Hours.tsx)
    Step5Menu.tsx            # Existing
    Step6CreateAccount.tsx   # Existing
    Step6Team.tsx            # Existing (team invite step)

apps/web/src/app/onboarding/
  wizard-definition.ts       # onboardingWizard: WizardDefinition<OnboardingState>
  page.tsx                   # <AnimatedWizardShell definition={onboardingWizard} />
  steps/                     # REWRITE: 8 scroll sections -> stepped confirmation
    ConfirmDepartments.tsx
    ConfirmLocations.tsx
    ConfirmProcedures.tsx
    ConfirmSummary.tsx

apps/web/src/app/dashboard/setup/
  wizard-definition.ts       # dashboardSetupWizard: WizardDefinition<SetupState>
  page.tsx                   # <AnimatedWizardShell definition={dashboardSetupWizard} />
  steps/                     # Existing files from components/dashboard/wizard-steps/
    WelcomeStep.tsx          # Moved + refactored
    DocumentDropStep.tsx
    GovernanceSetupStep.tsx
    PayrollSetupStep.tsx
    EmploymentSetupStep.tsx
    TeamSetupStep.tsx
    ShiftTemplateSetupStep.tsx
    SeasonSetupStep.tsx
    HandbookSetupStep.tsx
```

**Note:** Dashboard setup step files currently live in `apps/web/src/components/dashboard/wizard-steps/`. They will be moved to `apps/web/src/app/dashboard/setup/steps/` and the import in `apps/web/src/app/dashboard/setup/page.tsx` updated.

---

## Part 10: Implementation Order

### Phase 0: Foundation (prerequisite for everything)

| #     | Task                                                                               | Scope                        | Parallel? |
| ----- | ---------------------------------------------------------------------------------- | ---------------------------- | --------- |
| 0a    | Add `{param}` interpolation to `createTranslator`                                  | `packages/i18n`              | --        |
| 0b    | Wire `onboarding.json` + new namespaces into `localeModules` map in `translate.ts` | `packages/i18n`              | --        |
| 0c    | Create `useTranslation` hook + `LocaleProvider`                                    | `packages/i18n/src/react.ts` | --        |
| 0d    | Wire `LocaleProvider` into `apps/web/src/app/layout.tsx`                           | `apps/web`                   | --        |
| 0e-i  | Create empty namespace files (`wizard.json`, `join.json`, `dashboard.json`)        | `packages/i18n/locales/`     | --        |
| 0e-ii | Add wizard color tokens to `tokens.ts` + manually sync to `tokens.css`             | `packages/design-tokens`     | --        |
| 0f    | Add wizard theme CSS (`[data-wizard-theme]`) to `globals.css`                      | `apps/web`                   | --        |
| 0g    | Fix missing Join tokens (`--color-join-*`) in `globals.css`                        | `apps/web` (immediate fix)   | --        |
| 0h    | Register 6 new telemetry events in `registry.ts`                                   | `packages/telemetry`         | --        |
| 0i    | Write ADR for unified wizard shell + semantic tagging convention                   | `docs/decisions/`            | --        |

### Phase 1: Build Shell

| #   | Task                                                                                  | Scope          |
| --- | ------------------------------------------------------------------------------------- | -------------- |
| 1a  | Build `WizardShell`, `WizardSidebar`, `WizardTopBar`, `WizardNavBar` in `packages/ui` | Shell layout   |
| 1b  | Build `useWizardState`, `useWizardTelemetry`, `useWizardWalkAi` hooks                 | Shell logic    |
| 1c  | Build `AnimatedWizardShell` in `apps/web` (framer-motion wrapper)                     | Web animations |
| 1d  | Add shared wizard i18n keys to `locales/{nb,en}/wizard.json`                          | i18n           |
| 1e  | Export types + components from `packages/ui/src/wizard/index.ts`                      | Package setup  |

### Phase 1.5: i18n Sweep (3 parallel agents)

| Agent   | Scope                                                     | Namespace    |
| ------- | --------------------------------------------------------- | ------------ |
| Agent 1 | `apps/web/src/app/join/**` -- all hardcoded strings       | `join`       |
| Agent 2 | `apps/web/src/app/onboarding/**` -- all hardcoded strings | `onboarding` |
| Agent 3 | `apps/web/src/app/dashboard/**` -- all hardcoded strings  | `dashboard`  |

Each agent: find hardcoded nb/en strings, extract to namespace JSON, replace with `t()` calls.

### Phase 2: Migrate Join (North Star)

| #   | Task                                                                           | Scope     |
| --- | ------------------------------------------------------------------------------ | --------- |
| 2a  | Create `joinWizard` definition                                                 | Config    |
| 2b  | Refactor existing 7 step components to use `WizardStepProps`                   | Steps     |
| 2c  | Replace `SignupWizard.tsx` + `WizardProgress.tsx` with `<AnimatedWizardShell>` | Migration |
| 2d  | Add Walk AI semantic tags to step components                                   | Tagging   |
| 2e  | Verify all three breakpoints (mobile, tablet, desktop)                         | QA        |
| 2f  | Update `apps/e2e/tests/join-wizard.spec.ts` for new structure                  | E2E       |

### Phase 3: Rewrite Onboarding (Simplify)

| #   | Task                                                                         | Scope     |
| --- | ---------------------------------------------------------------------------- | --------- |
| 3a  | Create `onboardingWizard` definition                                         | Config    |
| 3b  | Build 4 new confirmation steps (departments, locations, procedures, summary) | Steps     |
| 3c  | Wire `loadState()` to read Join + I1 data from DB                            | Data flow |
| 3d  | Archive old onboarding (Botsson, scroll sections, WizardContext, parallax)   | Cleanup   |
| 3e  | Verify responsive + i18n                                                     | QA        |

### Phase 4: Migrate Dashboard Setup (Fix Tokens)

| #   | Task                                                                                            | Scope       |
| --- | ----------------------------------------------------------------------------------------------- | ----------- |
| 4a  | Create `dashboardSetupWizard` definition                                                        | Config      |
| 4b  | Move step files from `components/dashboard/wizard-steps/` to `app/dashboard/setup/steps/`       | Restructure |
| 4c  | Refactor 9 step components: replace 38 hardcoded colors with tokens, adapt to `WizardStepProps` | Steps       |
| 4d  | Remove dead `isDark` context usage                                                              | Cleanup     |
| 4e  | Replace `WorkspaceSetupWizard.tsx` with `<AnimatedWizardShell>`                                 | Migration   |
| 4f  | Verify responsive + i18n                                                                        | QA          |

### Phase 5: Walk AI Bridge (Future)

| #   | Task                                                      | Scope             |
| --- | --------------------------------------------------------- | ----------------- |
| 5a  | Implement `WizardAgentBridge` as `ClientTool` definitions | Agent integration |
| 5b  | Connect to Stage Engine session lifecycle                 | Backend           |
| 5c  | Add tool handlers for wizard navigation/state             | Tools             |

---

## Decisions Made

| Decision                                                   | Rationale                                                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Shell layout in `packages/ui`, animations in `apps/web`    | Mobile parity: packages/ui must work with React Native. framer-motion is web-only.          |
| Three themes via `data-wizard-theme` attribute             | Bounded flexibility. Scoped CSS vars, no global pollution.                                  |
| Walk AI semantic tags in v1, bridge in v2                  | Tags are zero-cost structural prep. Bridge needs Stage Engine + ClientTool work.            |
| Join first                                                 | North Star, currently broken. Fastest path to visual proof.                                 |
| Remove Botsson from Onboarding                             | Onboarding becomes pure confirmation. Voice agent operates in arena.                        |
| i18n foundation first                                      | This is the platform's language handling -- web, mobile, landing. Not wizard-specific.      |
| `useTranslation` hook + `LocaleProvider`                   | Same pattern as landing, works with React context, SSR-compatible.                          |
| Token source: `tokens.ts` -> `tokens.css` -> `globals.css` | Respects existing derivation chain. Single source of truth.                                 |
| Space-separated telemetry events                           | Matches existing `registry.ts` convention (`"wizard step_completed"`).                      |
| Onboarding is a rewrite                                    | 8 scroll sections with deep state management -> 4 stepped confirmation. Call it what it is. |

---

## Required ADRs

1. **ADR: Unified Wizard Shell** -- Shared wizard infrastructure in `packages/ui`, config-driven wizard definitions, theme system
2. **ADR: Walk AI Semantic Tagging Convention** -- `data-walkai-id`/`data-walkai-intent`/`data-walkai-type` as new codebase pattern for AI agent element discovery

---

## Risks & Mitigations

| Risk                                   | Level  | Mitigation                                                                                 |
| -------------------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| Existing E2E tests break               | Medium | Phase 2f explicitly updates `join-wizard.spec.ts`                                          |
| Onboarding rewrite scope               | High   | Clearly scoped to 4 confirmation steps. Old code archived, not deleted.                    |
| i18n sweep misses strings              | Medium | Post-sweep grep for remaining hardcoded Norwegian text                                     |
| Agent file conflicts during i18n sweep | Low    | Separate directories, separate namespace files                                             |
| Design token naming precedent          | Low    | ADR documents the convention. Wizard tokens are scoped, not a pattern for every component. |

---

## Out of Scope

- Walk AI agent logic (v2, Phase 5)
- LiveKit/voice integration in wizard shell
- Dark mode toggle within wizard (theme is set by definition, not user)
- Wizard-to-wizard navigation (each is a separate route)
- Database schema changes (uses existing tables)
- Mobile app i18n migration (separate task, but foundation supports it)
- Additional locale translations (sv, da, pl, ar, so, fi)
