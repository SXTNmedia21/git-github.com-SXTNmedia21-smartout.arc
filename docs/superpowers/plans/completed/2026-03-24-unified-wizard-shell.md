---
title: Unified Wizard Shell Implementation Plan
status: done
updated: 2026-03-26
created: 2026-03-24
module: ui
tags: [wizard, i18n, design-tokens, telemetry]
---

# Unified Wizard Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a shared `<WizardShell>` component and i18n foundation that all Smartout wizards (Join, Onboarding, Dashboard Setup) use, replacing three divergent implementations.

**Architecture:** Config-driven wizard shell in `packages/ui` (layout + logic) with animated wrapper in `apps/web` (framer-motion). i18n via enhanced `packages/i18n` with `useTranslation` hook. Theme variants via `[data-wizard-theme]` CSS attribute. Walk AI semantic tags for future agent integration.

**Tech Stack:** React 19, TypeScript strict, Tailwind v4, framer-motion (web only), Zod, `@smartout/telemetry`, `@smartout/i18n`, `@smartout/design-tokens`

**Spec:** `docs/superpowers/specs/2026-03-24-unified-wizard-shell-design.md`

---

## File Structure

### New files

```
packages/i18n/src/react.ts                          -- useTranslation hook + LocaleProvider
packages/i18n/locales/nb/wizard.json                 -- Shell i18n keys (nb)
packages/i18n/locales/en/wizard.json                 -- Shell i18n keys (en)
packages/i18n/locales/nb/join.json                   -- Join wizard keys (nb)
packages/i18n/locales/en/join.json                   -- Join wizard keys (en)
packages/i18n/locales/nb/dashboard.json              -- Dashboard keys (nb)
packages/i18n/locales/en/dashboard.json              -- Dashboard keys (en)

packages/ui/src/wizard/types.ts                      -- WizardDefinition, WizardStepProps, WizardThemeTokens
packages/ui/src/wizard/WizardShell.tsx               -- Main shell layout (no animation deps)
packages/ui/src/wizard/WizardSidebar.tsx             -- Desktop sidebar with step progress
packages/ui/src/wizard/WizardTopBar.tsx              -- Mobile/tablet progress bar
packages/ui/src/wizard/WizardNavBar.tsx              -- Back/Next/Skip navigation
packages/ui/src/wizard/useWizardState.ts             -- Internal state management
packages/ui/src/wizard/useWizardWalkAi.ts            -- Walk AI semantic tagging helper
packages/ui/src/wizard/index.ts                      -- Public exports

apps/web/src/components/wizard/AnimatedWizardShell.tsx   -- framer-motion wrapper
apps/web/src/components/wizard/useWizardTelemetry.ts     -- Telemetry hook (web-only)
```

### Modified files

```
packages/i18n/src/translate.ts                       -- Add {param} interpolation + wire new namespaces
packages/i18n/src/index.ts                           -- Export react.ts
packages/i18n/locales/nb/onboarding.json             -- Extend with confirmation flow keys
packages/i18n/locales/en/onboarding.json             -- Extend with confirmation flow keys
packages/design-tokens/src/tokens.ts                 -- Add wizard theme colors
packages/design-tokens/src/tokens.css                -- Manual sync wizard theme CSS vars
packages/ui/src/index.ts                             -- Export wizard module
packages/ui/package.json                             -- Add zod peer dep
apps/web/src/app/globals.css                         -- Add [data-wizard-theme] rules + fix join tokens
apps/web/src/app/layout.tsx                          -- Wrap with LocaleProvider
packages/telemetry/src/registry.ts                   -- 6 new events + 2 updated
```

---

## Task 1: Add string interpolation to createTranslator

**Files:**

- Modify: `packages/i18n/src/translate.ts`

- [ ] **Step 1: Write the test**

Create `packages/i18n/src/__tests__/translate.test.ts`:

```typescript
import { createTranslator } from "../translate";

// Mock the imports by testing the interpolation logic directly
describe("createTranslator interpolation", () => {
  it("returns plain string unchanged", () => {
    // This tests against the "common" namespace which has flat keys
    const t = createTranslator("nb", "common");
    const result = t("nav.features");
    expect(result).not.toContain("{");
  });

  it("falls back to key when namespace missing", () => {
    const t = createTranslator("nb", "nonexistent");
    expect(t("anything")).toBe("anything");
  });
});
```

- [ ] **Step 2: Run test to verify setup works**

Run: `cd packages/i18n && npx vitest run src/__tests__/translate.test.ts`
If vitest not configured: `npx tsx --test src/__tests__/translate.test.ts`

- [ ] **Step 3: Add interpolation to translate.ts**

In `packages/i18n/src/translate.ts`, change the `t` function signature and add interpolation:

```typescript
// Change line 24 from:
return function t(key: string): string {
// To:
return function t(key: string, params?: Record<string, string | number>): string {
```

Then before every `return` that returns a resolved string (not the fallback key), wrap with interpolation:

```typescript
function interpolate(str: string, params?: Record<string, string | number>): string {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? `{${name}}`));
}
```

Full updated file:

```typescript
import type { SupportedLocale } from "./config";

import nbCommon from "../locales/nb/common.json";
import nbLanding from "../locales/nb/landing.json";
import nbDocs from "../locales/nb/docs.json";
import nbOnboarding from "../locales/nb/onboarding.json";
import nbWizard from "../locales/nb/wizard.json";
import nbJoin from "../locales/nb/join.json";
import nbDashboard from "../locales/nb/dashboard.json";
import enCommon from "../locales/en/common.json";
import enLanding from "../locales/en/landing.json";
import enDocs from "../locales/en/docs.json";
import enOnboarding from "../locales/en/onboarding.json";
import enWizard from "../locales/en/wizard.json";
import enJoin from "../locales/en/join.json";
import enDashboard from "../locales/en/dashboard.json";

type Messages = Record<string, string | Record<string, string>>;

const localeModules: Record<string, Record<string, Messages>> = {
  nb: {
    common: nbCommon,
    landing: nbLanding,
    docs: nbDocs,
    onboarding: nbOnboarding,
    wizard: nbWizard,
    join: nbJoin,
    dashboard: nbDashboard,
  },
  en: {
    common: enCommon,
    landing: enLanding,
    docs: enDocs,
    onboarding: enOnboarding,
    wizard: enWizard,
    join: enJoin,
    dashboard: enDashboard,
  },
};

function interpolate(str: string, params?: Record<string, string | number>): string {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? `{${name}}`));
}

export function createTranslator(locale: SupportedLocale, namespace: string) {
  const messages = localeModules[locale]?.[namespace] ?? {};
  return function t(key: string, params?: Record<string, string | number>): string {
    const direct = messages[key];
    if (typeof direct === "string") return interpolate(direct, params);

    const [group, subKey] = key.split(".");
    if (group && subKey) {
      const nested = messages[group];
      if (typeof nested === "object" && nested !== null) {
        const val = nested[subKey];
        if (val) return interpolate(val, params);
      }
    }

    return key;
  };
}
```

- [ ] **Step 4: Create empty namespace JSON files**

Create these 6 files (all with `{}`):

`packages/i18n/locales/nb/wizard.json`:

```json
{}
```

Same empty `{}` for: `en/wizard.json`, `nb/join.json`, `en/join.json`, `nb/dashboard.json`, `en/dashboard.json`

- [ ] **Step 5: Verify typecheck passes**

Run: `pnpm --filter @smartout/i18n typecheck`

- [ ] **Step 6: Commit**

```bash
git add packages/i18n/
git commit -m "feat(i18n): add string interpolation + wire onboarding/wizard/join/dashboard namespaces"
```

---

## Task 2: Create useTranslation React hook + LocaleProvider

**Files:**

- Create: `packages/i18n/src/react.ts`
- Modify: `packages/i18n/src/index.ts`

- [ ] **Step 1: Create react.ts**

```typescript
// packages/i18n/src/react.ts
"use client";

import { createContext, useContext } from "react";
import { createTranslator } from "./translate";
import type { SupportedLocale } from "./config";

const LocaleContext = createContext<SupportedLocale>("nb");

export function LocaleProvider({
  locale,
  children,
}: {
  locale: SupportedLocale;
  children: React.ReactNode;
}) {
  return <LocaleContext value={locale}>{children}</LocaleContext>;
}

export function useTranslation(namespace: string) {
  const locale = useContext(LocaleContext);
  const t = createTranslator(locale, namespace);
  return { t, locale };
}

export function useLocale(): SupportedLocale {
  return useContext(LocaleContext);
}
```

- [ ] **Step 2: Add React deps to packages/i18n**

Update `packages/i18n/package.json` -- add:

```json
"peerDependencies": {
  "react": "^19.0.0"
},
"devDependencies": {
  "@types/react": "^19"
}
```

Update `packages/i18n/tsconfig.json` -- add to `compilerOptions`:

```json
"jsx": "react-jsx",
"lib": ["DOM", "DOM.Iterable", "ES2022"]
```

- [ ] **Step 3: Update index.ts exports**

Change `packages/i18n/src/index.ts` to:

```typescript
export * from "./config";
export * from "./rtl";
export { createTranslator } from "./translate";
export { LocaleProvider, useTranslation, useLocale } from "./react";
```

- [ ] **Step 4: Verify typecheck**

Run: `pnpm --filter @smartout/i18n typecheck`

- [ ] **Step 5: Commit**

```bash
git add packages/i18n/
git commit -m "feat(i18n): add useTranslation hook + LocaleProvider for React apps"
```

---

## Task 3: Wire LocaleProvider into apps/web

**Files:**

- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Add LocaleProvider to root layout**

The layout is a Server Component. We need a client wrapper for the provider. Add import and wrap children:

```typescript
// apps/web/src/app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "sonner";
import { PHProvider } from "./providers";
import { LocaleProvider } from "@smartout/i18n";
import "./globals.css";

// ... fonts unchanged ...

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nb">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} antialiased`}
      >
        <PHProvider>
          <LocaleProvider locale="nb">
            {children}
            <Toaster position="top-right" richColors />
          </LocaleProvider>
        </PHProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

Note: Hardcoded to "nb" for now. Dynamic locale resolution (cookie/header) is a follow-up task.

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter web typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/layout.tsx
git commit -m "feat(i18n): wire LocaleProvider into web app root layout"
```

---

## Task 4: Add wizard theme tokens to design-tokens

**Files:**

- Modify: `packages/design-tokens/src/tokens.ts`
- Modify: `packages/design-tokens/src/tokens.css`
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Add wizard export to tokens.ts**

Append to end of `packages/design-tokens/src/tokens.ts` (before the closing), after the `shadows` export:

```typescript
// -- Wizard Shell Theme Colors -----------------
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
} as const;
```

- [ ] **Step 2: Manually sync to tokens.css**

In `packages/design-tokens/src/tokens.css`, add inside the `:root` block (after existing variables, before the closing `}`):

```css
/* Wizard Shell — Dark Theme */
--wizard-dark-bg: oklch(0.12 0.02 50);
--wizard-dark-sidebar: oklch(0.08 0.01 50);
--wizard-dark-text: oklch(0.85 0 0);
--wizard-dark-text-muted: oklch(0.55 0 0);
--wizard-dark-border: oklch(0.2 0.01 50);
--wizard-dark-step-pending: oklch(0.35 0 0);

/* Wizard Shell — Warm Theme */
--wizard-warm-bg: oklch(0.97 0.008 60);
--wizard-warm-sidebar: oklch(0.94 0.01 60);
--wizard-warm-text: oklch(0.2 0.02 50);
--wizard-warm-text-muted: oklch(0.5 0.02 50);
--wizard-warm-border: oklch(0.88 0.01 60);
--wizard-warm-step-pending: oklch(0.7 0.01 60);
```

- [ ] **Step 3: Add wizard theme CSS rules to globals.css**

In `apps/web/src/app/globals.css`, add AFTER the `@theme inline { ... }` block (after line 74):

```css
/* Wizard Shell Theme Variants */
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

- [ ] **Step 4: Fix missing join tokens in globals.css**

Also in `apps/web/src/app/globals.css`, add inside the `@theme inline` block (after line 71, before the `--font-heading` line):

```css
/* Join wizard tokens (cherry-pick d27a2d82 missed these) */
--color-join-bg: oklch(0.99 0.004 60);
--color-join-panel: oklch(0.18 0.03 50);
--color-join-glow-1: oklch(0.45 0.18 40);
--color-join-glow-2: oklch(0.35 0.14 35);
```

- [ ] **Step 5: Verify typecheck**

Run: `pnpm turbo typecheck`

- [ ] **Step 6: Commit**

```bash
git add packages/design-tokens/ apps/web/src/app/globals.css
git commit -m "feat(design-tokens): add wizard theme tokens + fix missing join CSS variables"
```

---

## Task 5: Register telemetry events

**Files:**

- Modify: `packages/telemetry/src/registry.ts`

- [ ] **Step 1: Update existing wizard interfaces**

Find the `WizardStepCompleted` interface (line ~1140) and add `wizard_id`:

```typescript
export interface WizardStepCompleted extends BaseEvent {
  event: "wizard step_completed";
  properties: {
    data: {
      wizard_id: string;
      step_id: string;
      step_index: number;
    };
  };
}
```

Find the `WizardCompleted` interface (line ~1150) and add `wizard_id`, make `workspace_id` nullable:

```typescript
export interface WizardCompleted extends BaseEvent {
  event: "wizard completed";
  properties: {
    data: {
      wizard_id: string;
      workspace_id: string | null;
    };
  };
}
```

- [ ] **Step 2: Add 6 new event interfaces**

Add after `WizardCompleted`:

```typescript
export interface WizardStarted extends BaseEvent {
  event: "wizard started";
  properties: {
    data: {
      wizard_id: string;
      theme: string;
      total_steps: number;
    };
  };
}

export interface WizardStepEntered extends BaseEvent {
  event: "wizard step_entered";
  properties: {
    data: {
      wizard_id: string;
      step_id: string;
      step_index: number;
      from_step?: string;
    };
  };
}

export interface WizardStepSkipped extends BaseEvent {
  event: "wizard step_skipped";
  properties: {
    data: {
      wizard_id: string;
      step_id: string;
      step_index: number;
    };
  };
}

export interface WizardStepBack extends BaseEvent {
  event: "wizard step_back";
  properties: {
    data: {
      wizard_id: string;
      step_id: string;
      to_step: string;
    };
  };
}

export interface WizardAbandoned extends BaseEvent {
  event: "wizard abandoned";
  properties: {
    data: {
      wizard_id: string;
      last_step: string;
      duration_ms: number;
    };
  };
}

export interface WizardValidationFailed extends BaseEvent {
  event: "wizard validation_failed";
  properties: {
    data: {
      wizard_id: string;
      step_id: string;
      errors: string[];
    };
  };
}
```

- [ ] **Step 3: Add to SmartoutEvent union**

Find the `SmartoutEvent` type union and add the 6 new interfaces:

```typescript
| WizardStarted
| WizardStepEntered
| WizardStepSkipped
| WizardStepBack
| WizardAbandoned
| WizardValidationFailed
```

- [ ] **Step 4: Add to EVENT_ROUTING**

Find the `EVENT_ROUTING` object and add entries:

```typescript
"wizard started": {
  destinations: ["posthog", "logger"],
  category: "onboarding",
},
"wizard step_entered": {
  destinations: ["posthog", "logger"],
  category: "onboarding",
},
"wizard step_skipped": {
  destinations: ["posthog", "logger", "activity_trail"],
  category: "onboarding",
},
"wizard step_back": {
  destinations: ["posthog", "logger"],
  category: "onboarding",
},
"wizard abandoned": {
  destinations: ["posthog", "logger", "activity_trail"],
  category: "onboarding",
},
"wizard validation_failed": {
  destinations: ["posthog", "logger"],
  category: "onboarding",
},
```

- [ ] **Step 5: Verify typecheck**

Run: `pnpm --filter @smartout/telemetry typecheck`

- [ ] **Step 6: Commit**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "feat(telemetry): register 6 new wizard events + update existing with wizard_id"
```

---

## Task 6: Build wizard types in packages/ui

**Files:**

- Create: `packages/ui/src/wizard/types.ts`

- [ ] **Step 1: Create types.ts**

```typescript
// packages/ui/src/wizard/types.ts
import type { ComponentType } from "react";
import type { ZodSchema } from "zod";
import type { LucideIcon } from "lucide-react";

// -- Wizard Definition (config object per wizard) --

export interface WizardDefinition<TState extends Record<string, unknown>> {
  id: string;
  theme: "dark" | "warm" | "light";
  steps: WizardStepDef<TState>[];
  metadata: {
    titleKey: string;
    descriptionKey: string;
    i18nNamespace: string;
  };
  initialState: TState;
  loadState?: () => Promise<Partial<TState>>;
  onComplete?: (state: TState) => Promise<void>;
}

export interface WizardStepDef<TState> {
  id: string;
  labelKey: string;
  icon?: LucideIcon;
  component: ComponentType<WizardStepProps<TState>>;
  validation?: ZodSchema;
  skippable?: boolean;
  estimatedMinutes?: number;
}

// -- Props received by step components --

export interface WizardStepProps<TState> {
  state: TState;
  updateState: (patch: Partial<TState>) => void;
  next: () => void;
  back: () => void;
  goTo: (stepId: string) => void;
  isFirst: boolean;
  isLast: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  theme: WizardThemeTokens;
  walkai: WalkAiHelper;
}

export interface WizardThemeTokens {
  name: "dark" | "warm" | "light";
}

// -- Walk AI semantic tagging --

export interface WalkAiHelper {
  id: (element: string) => string;
  tag: (element: string, intent: string, context?: Record<string, unknown>) => WalkAiDataAttributes;
}

export type WalkAiDataAttributes = {
  "data-walkai-id": string;
  "data-walkai-intent": string;
  "data-walkai-type": string;
  "data-walkai-context"?: string;
};

// -- Internal state --

export interface WizardState {
  currentStepIndex: number;
  completedSteps: Set<string>;
  data: Record<string, unknown>;
  startedAt: number;
  stepEnteredAt: number;
}
```

- [ ] **Step 2: Add zod as peer dependency to packages/ui**

Add to `packages/ui/package.json` peerDependencies:

```json
"zod": "^3.0.0"
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter @smartout/ui typecheck`

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/wizard/types.ts packages/ui/package.json
git commit -m "feat(ui): add wizard shell type definitions"
```

---

## Task 7: Build useWizardState hook

**Files:**

- Create: `packages/ui/src/wizard/useWizardState.ts`

- [ ] **Step 1: Create useWizardState.ts**

```typescript
// packages/ui/src/wizard/useWizardState.ts
"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import type { WizardDefinition, WizardState } from "./types";

export function useWizardState<TState extends Record<string, unknown>>(
  definition: WizardDefinition<TState>,
) {
  const [data, setData] = useState<TState>(definition.initialState);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const startedAt = useRef(Date.now());
  const stepEnteredAt = useRef(Date.now());

  const currentStep = definition.steps[currentStepIndex];
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === definition.steps.length - 1;

  const updateState = useCallback((patch: Partial<TState>) => {
    setData((prev) => ({ ...prev, ...patch }));
  }, []);

  const next = useCallback(async () => {
    const step = definition.steps[currentStepIndex];

    if (step?.validation) {
      const result = step.validation.safeParse(data);
      if (!result.success) {
        return { success: false as const, errors: result.error.issues.map((i) => i.message) };
      }
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
    back,
    goTo,
    wizardState,
    totalSteps: definition.steps.length,
  };
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @smartout/ui typecheck`

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/wizard/useWizardState.ts
git commit -m "feat(ui): add useWizardState hook for wizard navigation and data"
```

---

## Task 8: Build useWizardWalkAi hook

**Files:**

- Create: `packages/ui/src/wizard/useWizardWalkAi.ts`

- [ ] **Step 1: Create useWizardWalkAi.ts**

```typescript
// packages/ui/src/wizard/useWizardWalkAi.ts
"use client";

import { useMemo } from "react";
import type { WalkAiHelper, WalkAiDataAttributes } from "./types";

export function useWizardWalkAi(wizardId: string, stepId: string): WalkAiHelper {
  return useMemo(
    () => ({
      id: (element: string) => `${wizardId}-${stepId}-${element}`,

      tag: (
        element: string,
        intent: string,
        context?: Record<string, unknown>,
      ): WalkAiDataAttributes => {
        const attrs: WalkAiDataAttributes = {
          "data-walkai-id": `${wizardId}-${stepId}-${element}`,
          "data-walkai-intent": intent,
          "data-walkai-type": inferType(element),
        };
        if (context) {
          attrs["data-walkai-context"] = JSON.stringify(context);
        }
        return attrs;
      },
    }),
    [wizardId, stepId],
  );
}

function inferType(element: string): string {
  if (element.includes("input") || element.includes("field")) return "input";
  if (element.includes("button") || element.includes("btn")) return "button";
  if (element.includes("select") || element.includes("dropdown")) return "select";
  if (element.includes("checkbox") || element.includes("toggle")) return "checkbox";
  return "element";
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/wizard/useWizardWalkAi.ts
git commit -m "feat(ui): add useWizardWalkAi hook for semantic element tagging"
```

---

## Task 9: Build WizardSidebar, WizardTopBar, WizardNavBar

**Files:**

- Create: `packages/ui/src/wizard/WizardSidebar.tsx`
- Create: `packages/ui/src/wizard/WizardTopBar.tsx`
- Create: `packages/ui/src/wizard/WizardNavBar.tsx`

- [ ] **Step 1: Create WizardSidebar.tsx**

```typescript
// packages/ui/src/wizard/WizardSidebar.tsx
"use client";

import { Check } from "lucide-react";
import type { WizardStepDef } from "./types";

interface WizardSidebarProps {
  steps: WizardStepDef<Record<string, unknown>>[];
  currentStepIndex: number;
  completedSteps: Set<string>;
  t: (key: string, params?: Record<string, string | number>) => string;
  onStepClick?: (stepId: string) => void;
}

export function WizardSidebar({
  steps,
  currentStepIndex,
  completedSteps,
  t,
  onStepClick,
}: WizardSidebarProps) {
  return (
    <nav
      className="hidden w-64 shrink-0 flex-col gap-1 p-6 lg:flex"
      style={{ backgroundColor: "var(--wizard-sidebar)", color: "var(--wizard-text)" }}
      aria-label="Wizard progress"
    >
      {steps.map((step, index) => {
        const isCompleted = completedSteps.has(step.id);
        const isCurrent = index === currentStepIndex;
        const isPending = !isCompleted && !isCurrent;
        const Icon = step.icon;

        return (
          <button
            key={step.id}
            type="button"
            onClick={() => isCompleted && onStepClick?.(step.id)}
            disabled={isPending}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
              isCurrent
                ? "font-medium"
                : isCompleted
                  ? "cursor-pointer opacity-80 hover:opacity-100"
                  : "cursor-default opacity-40"
            }`}
          >
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs"
              style={{
                backgroundColor: isCompleted
                  ? "var(--wizard-step-completed)"
                  : isCurrent
                    ? "var(--wizard-step-active)"
                    : "var(--wizard-step-pending)",
                color: isCompleted || isCurrent ? "white" : "var(--wizard-text-muted)",
              }}
            >
              {isCompleted ? (
                <Check className="h-3.5 w-3.5" />
              ) : Icon ? (
                <Icon className="h-3.5 w-3.5" />
              ) : (
                index + 1
              )}
            </span>
            <span>{t(step.labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Create WizardTopBar.tsx**

```typescript
// packages/ui/src/wizard/WizardTopBar.tsx
"use client";

import type { WizardStepDef } from "./types";

interface WizardTopBarProps {
  steps: WizardStepDef<Record<string, unknown>>[];
  currentStepIndex: number;
  completedSteps: Set<string>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function WizardTopBar({ steps, currentStepIndex, completedSteps, t }: WizardTopBarProps) {
  const currentStep = steps[currentStepIndex];
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  return (
    <div
      className="flex flex-col gap-2 p-4 lg:hidden"
      style={{ backgroundColor: "var(--wizard-sidebar)", color: "var(--wizard-text)" }}
    >
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{currentStep ? t(currentStep.labelKey) : ""}</span>
        <span style={{ color: "var(--wizard-text-muted)" }}>
          {t("progress.step", { current: currentStepIndex + 1, total: steps.length })}
        </span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: "var(--wizard-step-pending)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%`, backgroundColor: "var(--wizard-step-active)" }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create WizardNavBar.tsx**

```typescript
// packages/ui/src/wizard/WizardNavBar.tsx
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface WizardNavBarProps {
  isFirst: boolean;
  isLast: boolean;
  isSkippable: boolean;
  isLoading?: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  onBack: () => void;
  onNext: () => void;
  onSkip?: () => void;
}

export function WizardNavBar({
  isFirst,
  isLast,
  isSkippable,
  isLoading,
  t,
  onBack,
  onNext,
  onSkip,
}: WizardNavBarProps) {
  return (
    <div
      className="flex items-center justify-between border-t px-6 py-4"
      style={{ borderColor: "var(--wizard-border)", backgroundColor: "var(--wizard-bg)" }}
    >
      <button
        type="button"
        onClick={onBack}
        disabled={isFirst}
        className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm transition-opacity disabled:opacity-30"
        style={{ color: "var(--wizard-text-muted)" }}
      >
        <ChevronLeft className="h-4 w-4" />
        {t("nav.back")}
      </button>

      <div className="flex items-center gap-3">
        {isSkippable && onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="rounded-lg px-4 py-2 text-sm transition-opacity hover:opacity-80"
            style={{ color: "var(--wizard-text-muted)" }}
          >
            {t("nav.skip")}
          </button>
        )}

        <button
          type="button"
          onClick={onNext}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-lg px-6 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "var(--wizard-step-active)" }}
        >
          {isLast ? t("nav.finish") : t("nav.next")}
          {!isLast && <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify typecheck**

Run: `pnpm --filter @smartout/ui typecheck`

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/wizard/WizardSidebar.tsx packages/ui/src/wizard/WizardTopBar.tsx packages/ui/src/wizard/WizardNavBar.tsx
git commit -m "feat(ui): add WizardSidebar, WizardTopBar, WizardNavBar components"
```

---

## Task 10: Build WizardShell + exports

**Files:**

- Create: `packages/ui/src/wizard/WizardShell.tsx`
- Create: `packages/ui/src/wizard/index.ts`
- Modify: `packages/ui/src/index.ts`

- [ ] **Step 1: Create WizardShell.tsx**

```typescript
// packages/ui/src/wizard/WizardShell.tsx
"use client";

import { useEffect, useCallback } from "react";
import type { WizardDefinition, WizardStepProps, WizardThemeTokens } from "./types";
import { useWizardState } from "./useWizardState";
import { useWizardWalkAi } from "./useWizardWalkAi";
import { WizardSidebar } from "./WizardSidebar";
import { WizardTopBar } from "./WizardTopBar";
import { WizardNavBar } from "./WizardNavBar";

interface WizardShellProps<TState extends Record<string, unknown>> {
  definition: WizardDefinition<TState>;
  t: (key: string, params?: Record<string, string | number>) => string;
  onStepChange?: (stepId: string, stepIndex: number, fromStep?: string) => void;
  onStepComplete?: (stepId: string, stepIndex: number, durationMs: number) => void;
  onStepSkip?: (stepId: string, stepIndex: number) => void;
  onStepBack?: (stepId: string, toStep: string) => void;
  onComplete?: () => void;
  onValidationFail?: (stepId: string, errors: string[]) => void;
  renderStep?: (
    stepContent: React.ReactNode,
    direction: "forward" | "back",
    stepKey: string,
  ) => React.ReactNode;
}

export function WizardShell<TState extends Record<string, unknown>>({
  definition,
  t,
  onStepChange,
  onStepComplete,
  onStepSkip,
  onStepBack,
  onComplete,
  onValidationFail,
  renderStep,
}: WizardShellProps<TState>) {
  const {
    data,
    updateState,
    currentStep,
    currentStepIndex,
    completedSteps,
    isFirst,
    isLast,
    next: rawNext,
    back: rawBack,
    goTo: rawGoTo,
    wizardState,
    totalSteps,
  } = useWizardState(definition);

  const walkai = useWizardWalkAi(definition.id, currentStep?.id ?? "");
  const theme: WizardThemeTokens = { name: definition.theme };

  const handleNext = useCallback(async () => {
    const prevStep = currentStep;
    const durationMs = Date.now() - wizardState.stepEnteredAt;
    const result = await rawNext();

    if (result.success) {
      if (prevStep) {
        onStepComplete?.(prevStep.id, currentStepIndex, durationMs);
      }
      if (isLast) {
        onComplete?.();
      }
    } else if ("errors" in result) {
      onValidationFail?.(currentStep?.id ?? "", result.errors);
    }
  }, [rawNext, currentStep, currentStepIndex, isLast, wizardState.stepEnteredAt, onStepComplete, onComplete, onValidationFail]);

  const handleBack = useCallback(() => {
    const fromStep = currentStep?.id ?? "";
    rawBack();
    const prevIndex = currentStepIndex - 1;
    const toStep = definition.steps[prevIndex]?.id ?? "";
    onStepBack?.(fromStep, toStep);
  }, [rawBack, currentStep, currentStepIndex, definition.steps, onStepBack]);

  const handleSkip = useCallback(() => {
    if (currentStep) {
      onStepSkip?.(currentStep.id, currentStepIndex);
    }
    rawNext();
  }, [currentStep, currentStepIndex, rawNext, onStepSkip]);

  const handleGoTo = useCallback(
    (stepId: string) => {
      rawGoTo(stepId);
    },
    [rawGoTo],
  );

  useEffect(() => {
    if (currentStep) {
      onStepChange?.(currentStep.id, currentStepIndex);
    }
  }, [currentStep, currentStepIndex, onStepChange]);

  if (!currentStep) return null;

  const StepComponent = currentStep.component;
  const stepProps: WizardStepProps<TState> = {
    state: data,
    updateState,
    next: handleNext,
    back: handleBack,
    goTo: handleGoTo,
    isFirst,
    isLast,
    t,
    theme,
    walkai,
  };

  const stepContent = <StepComponent {...stepProps} />;
  const renderedStep = renderStep
    ? renderStep(stepContent, "forward", currentStep.id)
    : stepContent;

  return (
    <div
      className="flex h-dvh flex-col"
      data-wizard-theme={definition.theme}
      data-walkai-id={`${definition.id}-shell`}
      data-walkai-type="wizard"
      data-walkai-context={JSON.stringify({
        wizardId: definition.id,
        currentStep: currentStep.id,
        currentStepIndex,
        totalSteps,
        theme: definition.theme,
      })}
    >
      <div className="flex min-h-0 flex-1">
        <WizardSidebar
          steps={definition.steps}
          currentStepIndex={currentStepIndex}
          completedSteps={completedSteps}
          t={t}
          onStepClick={handleGoTo}
        />

        <div className="flex min-h-0 flex-1 flex-col">
          <WizardTopBar
            steps={definition.steps}
            currentStepIndex={currentStepIndex}
            completedSteps={completedSteps}
            t={t}
          />

          <main
            className="flex-1 overflow-y-auto"
            style={{ backgroundColor: "var(--wizard-bg)" }}
            data-walkai-id={`${definition.id}-${currentStep.id}-step`}
            data-walkai-type="wizard-step"
          >
            {renderedStep}
          </main>

          <WizardNavBar
            isFirst={isFirst}
            isLast={isLast}
            isSkippable={currentStep.skippable ?? false}
            t={t}
            onBack={handleBack}
            onNext={handleNext}
            onSkip={currentStep.skippable ? handleSkip : undefined}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create index.ts**

```typescript
// packages/ui/src/wizard/index.ts
export { WizardShell } from "./WizardShell";
export { WizardSidebar } from "./WizardSidebar";
export { WizardTopBar } from "./WizardTopBar";
export { WizardNavBar } from "./WizardNavBar";
export { useWizardState } from "./useWizardState";
export { useWizardWalkAi } from "./useWizardWalkAi";
export type {
  WizardDefinition,
  WizardStepDef,
  WizardStepProps,
  WizardThemeTokens,
  WizardState,
  WalkAiHelper,
  WalkAiDataAttributes,
} from "./types";
```

- [ ] **Step 3: Update packages/ui/src/index.ts**

Add at end of file:

```typescript
export * from "./wizard";
```

- [ ] **Step 4: Verify typecheck**

Run: `pnpm --filter @smartout/ui typecheck`

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/wizard/ packages/ui/src/index.ts
git commit -m "feat(ui): add WizardShell — unified config-driven wizard component"
```

---

## Task 11: Build AnimatedWizardShell + useWizardTelemetry

**Files:**

- Create: `apps/web/src/components/wizard/AnimatedWizardShell.tsx`
- Create: `apps/web/src/components/wizard/useWizardTelemetry.ts`

- [ ] **Step 1: Create useWizardTelemetry.ts**

```typescript
// apps/web/src/components/wizard/useWizardTelemetry.ts
"use client";

import { useCallback, useRef } from "react";
import { emit } from "@smartout/telemetry";
import type { WizardDefinition } from "@smartout/ui";

export function useWizardTelemetry<TState extends Record<string, unknown>>(
  definition: WizardDefinition<TState>,
  workspaceId: string | null,
  actorId: string,
) {
  const startedAt = useRef(Date.now());

  const emitWizardStarted = useCallback(() => {
    emit({
      event: "wizard started",
      workspace_id: workspaceId,
      actor_id: actorId,
      properties: {
        data: {
          wizard_id: definition.id,
          theme: definition.theme,
          total_steps: definition.steps.length,
        },
      },
    });
    startedAt.current = Date.now();
  }, [definition, workspaceId, actorId]);

  const onStepChange = useCallback(
    (stepId: string, stepIndex: number, fromStep?: string) => {
      emit({
        event: "wizard step_entered",
        workspace_id: workspaceId,
        actor_id: actorId,
        properties: {
          data: {
            wizard_id: definition.id,
            step_id: stepId,
            step_index: stepIndex,
            from_step: fromStep,
          },
        },
      });
    },
    [definition.id, workspaceId, actorId],
  );

  const onStepComplete = useCallback(
    (stepId: string, stepIndex: number, durationMs: number) => {
      emit({
        event: "wizard step_completed",
        workspace_id: workspaceId,
        actor_id: actorId,
        properties: { data: { wizard_id: definition.id, step_id: stepId, step_index: stepIndex } },
      });
    },
    [definition.id, workspaceId, actorId],
  );

  const onStepSkip = useCallback(
    (stepId: string, stepIndex: number) => {
      emit({
        event: "wizard step_skipped",
        workspace_id: workspaceId,
        actor_id: actorId,
        properties: { data: { wizard_id: definition.id, step_id: stepId, step_index: stepIndex } },
      });
    },
    [definition.id, workspaceId, actorId],
  );

  const onStepBack = useCallback(
    (stepId: string, toStep: string) => {
      emit({
        event: "wizard step_back",
        workspace_id: workspaceId,
        actor_id: actorId,
        properties: { data: { wizard_id: definition.id, step_id: stepId, to_step: toStep } },
      });
    },
    [definition.id, workspaceId, actorId],
  );

  const onComplete = useCallback(() => {
    emit({
      event: "wizard completed",
      workspace_id: workspaceId,
      actor_id: actorId,
      properties: { data: { wizard_id: definition.id, workspace_id: workspaceId } },
    });
  }, [definition.id, workspaceId, actorId]);

  const onValidationFail = useCallback(
    (stepId: string, errors: string[]) => {
      emit({
        event: "wizard validation_failed",
        workspace_id: workspaceId,
        actor_id: actorId,
        properties: { data: { wizard_id: definition.id, step_id: stepId, errors } },
      });
    },
    [definition.id, workspaceId, actorId],
  );

  return {
    emitWizardStarted,
    onStepChange,
    onStepComplete,
    onStepSkip,
    onStepBack,
    onComplete,
    onValidationFail,
  };
}
```

- [ ] **Step 2: Create AnimatedWizardShell.tsx**

```typescript
// apps/web/src/components/wizard/AnimatedWizardShell.tsx
"use client";

import { useRef, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { WizardShell, type WizardDefinition } from "@smartout/ui";
import { useTranslation } from "@smartout/i18n";
import { useWizardTelemetry } from "./useWizardTelemetry";

const springIn = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 35, damping: 22, mass: 2 } },
  exit: { opacity: 0, x: -24, transition: { duration: 0.25 } },
};

interface AnimatedWizardShellProps<TState extends Record<string, unknown>> {
  definition: WizardDefinition<TState>;
  workspaceId?: string | null;
  actorId?: string;
}

export function AnimatedWizardShell<TState extends Record<string, unknown>>({
  definition,
  workspaceId = null,
  actorId = "anonymous",
}: AnimatedWizardShellProps<TState>) {
  const { t } = useTranslation("wizard");
  const telemetry = useWizardTelemetry(definition, workspaceId, actorId);
  const directionRef = useRef<"forward" | "back">("forward");

  useEffect(() => {
    telemetry.emitWizardStarted();
  }, [telemetry.emitWizardStarted]);

  const renderStep = useCallback(
    (stepContent: React.ReactNode, direction: "forward" | "back", stepKey: string) => {
      directionRef.current = direction;
      return (
        <AnimatePresence mode="wait">
          <motion.div
            key={stepKey}
            initial={springIn.initial}
            animate={springIn.animate}
            exit={springIn.exit}
            className="h-full"
          >
            {stepContent}
          </motion.div>
        </AnimatePresence>
      );
    },
    [],
  );

  return (
    <WizardShell
      definition={definition}
      t={t}
      onStepChange={telemetry.onStepChange}
      onStepComplete={telemetry.onStepComplete}
      onStepSkip={telemetry.onStepSkip}
      onStepBack={telemetry.onStepBack}
      onComplete={telemetry.onComplete}
      onValidationFail={telemetry.onValidationFail}
      renderStep={renderStep}
    />
  );
}
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter web typecheck`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/wizard/
git commit -m "feat(web): add AnimatedWizardShell with framer-motion transitions + telemetry"
```

---

## Task 12: Add wizard i18n keys

**Files:**

- Create/Update: `packages/i18n/locales/nb/wizard.json`
- Create/Update: `packages/i18n/locales/en/wizard.json`

- [ ] **Step 1: Write nb wizard keys**

```json
{
  "nav": {
    "back": "Tilbake",
    "next": "Neste",
    "skip": "Hopp over",
    "finish": "Fullfør"
  },
  "progress": {
    "step": "Steg {current} av {total}",
    "estimated": "Ca. {minutes} min"
  }
}
```

- [ ] **Step 2: Write en wizard keys**

```json
{
  "nav": {
    "back": "Back",
    "next": "Next",
    "skip": "Skip",
    "finish": "Finish"
  },
  "progress": {
    "step": "Step {current} of {total}",
    "estimated": "About {minutes} min"
  }
}
```

- [ ] **Step 3: Verify translate.ts can resolve these**

Quick manual test: the namespace `wizard` is now imported in `translate.ts` (Task 1). Keys like `t("nav.back")` should resolve via the nested lookup.

- [ ] **Step 4: Commit**

```bash
git add packages/i18n/locales/
git commit -m "feat(i18n): add wizard shell translation keys (nb + en)"
```

---

## Task 13: Full typecheck + final verification

- [ ] **Step 1: Run full monorepo typecheck**

Run: `pnpm turbo typecheck`

Fix any errors that appear.

- [ ] **Step 2: Run full monorepo lint**

Run: `pnpm turbo lint`

Fix any lint errors.

- [ ] **Step 3: Verify the join token fix works**

Check that `bg-join-bg`, `bg-join-panel`, `bg-join-glow-1`, `bg-join-glow-2` are now valid Tailwind classes by searching for them in SignupWizard.tsx and confirming the CSS variables exist in globals.css.

- [ ] **Step 4: Final commit if fixes needed**

```bash
git add -A
git commit -m "fix: resolve typecheck and lint errors from wizard shell foundation"
```

---

## Summary: What This Plan Produces

After all 13 tasks:

1. `packages/i18n` -- Enhanced with interpolation, `useTranslation` hook, `LocaleProvider`, 4 new namespaces
2. `packages/ui/src/wizard/` -- Complete WizardShell with sidebar, top bar, nav bar, state management, Walk AI tagging
3. `apps/web/src/components/wizard/` -- AnimatedWizardShell with framer-motion + telemetry
4. `packages/design-tokens` -- Wizard theme tokens (dark/warm/light)
5. `apps/web/src/app/globals.css` -- Wizard theme CSS rules + fixed join tokens
6. `packages/telemetry` -- 6 new + 2 updated wizard events
7. `apps/web/src/app/layout.tsx` -- LocaleProvider wired in

**Not included (follow-up plans):**

- Migrating Join wizard to use WizardShell (Phase 2)
- Rewriting Onboarding to confirmation flow (Phase 3)
- Migrating Dashboard Setup wizard (Phase 4)
- i18n sweep of hardcoded strings (Phase 1.5 -- 3 parallel agents)
- Walk AI agent bridge (Phase 5)
- ADR documents (write alongside implementation)
