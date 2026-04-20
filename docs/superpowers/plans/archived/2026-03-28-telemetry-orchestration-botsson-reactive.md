---
title: Telemetry Orchestration & Reactive Botsson — Implementation Plan
status: draft
updated: 2026-03-28
created: 2026-03-28
module: telemetry, ai, onboarding
tags: [telemetry, botsson, reactive, implementation-plan]
---

# Telemetry Orchestration & Reactive Botsson — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an error-first telemetry system for the join/onboarding/setup journey where Botsson reacts to errors immediately and to stalls conservatively, with escalation gates for systematic failure patterns.

**Architecture:** Three layers — (1) telemetry foundation (registry events, emit calls, bug fixes), (2) reactive layer (client-side hook watching the `smartout:telemetry` CustomEvent bus), (3) UI layer (Warm Orb Companion). Botsson is a client-side reactive companion, NOT an agent session. Pre-workspace context uses hardcoded capabilities — no engine_sessions, no engine_event routing.

**Tech Stack:** TypeScript, React 19, Framer Motion, `@smartout/telemetry` (emit + registry), `@smartout/i18n`, `@smartout/ui` (WizardShell)

**Spec:** `docs/superpowers/specs/2026-03-28-telemetry-orchestration-botsson-reactive-design.md`

---

## File Map

### New files

| File                                                                  | Responsibility                                                     |
| --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `packages/telemetry/src/__tests__/error-events.test.ts`               | Tests for error event registration and interfaces                  |
| `apps/web/src/app/join/_lib/join-telemetry.ts`                        | Error emit helpers + correlation ID management for join flow       |
| `apps/web/src/app/join/_lib/intervention-rules.ts`                    | Error rules, stall rules, escalation gates for join wizard         |
| `apps/web/src/app/join/_lib/autofill-mapping.ts`                      | Deterministic scrape-data-to-wizard-state mapper                   |
| `apps/web/src/app/join/_lib/__tests__/autofill-mapping.test.ts`       | Tests for autofill mapping                                         |
| `apps/web/src/app/join/_lib/__tests__/intervention-rules.test.ts`     | Tests for gate evaluation logic                                    |
| `apps/web/src/components/wizard/useBotssonReactive.ts`                | Client-side reactive hook (event bus listener, ring buffer, gates) |
| `apps/web/src/components/wizard/__tests__/useBotssonReactive.test.ts` | Tests for reactive hook                                            |
| `apps/web/src/components/wizard/BotssonOrb.tsx`                       | Warm Orb Companion UI component                                    |
| `packages/i18n/locales/en/botsson.json`                               | English i18n keys for Botsson nudge messages                       |
| `packages/i18n/locales/nb/botsson.json`                               | Norwegian i18n keys for Botsson nudge messages                     |

### Modified files

| File                                                       | Change                                                                                    |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `packages/telemetry/src/registry.ts`                       | Add BaseEvent fields, 13 new event interfaces, SmartoutEvent union, EVENT_ROUTING entries |
| `packages/telemetry/src/emit.ts`                           | Auto-populate `page` field on client-side                                                 |
| `apps/web/src/app/join/_hooks/useScrapedData.ts`           | Add emit() calls in 3 catch blocks                                                        |
| `apps/web/src/app/join/_context/JoinScrapingProvider.tsx`  | Add emit() call in prefetch catch                                                         |
| `apps/web/src/app/join/_lib/setupActions.ts`               | Remove double-emit, add error emit calls                                                  |
| `apps/web/src/app/join/_components/Step6CreateAccount.tsx` | Add emit() for auth errors                                                                |
| `apps/web/src/app/onboarding/wizard-definition.ts`         | Add emit() for finalize error                                                             |
| `apps/web/src/app/onboarding/page.tsx`                     | Pass workspaceId + actorId to AnimatedWizardShell                                         |
| `apps/web/src/app/onboarding/hooks/useOnboardingState.ts`  | Remove orphaned manual emit calls                                                         |
| `apps/web/src/components/wizard/AnimatedWizardShell.tsx`   | Add BotssonOrb integration point                                                          |
| `packages/ui/src/wizard/WizardShell.tsx`                   | Add wizard abandoned beforeunload handler                                                 |

---

## Phase A: Telemetry Foundation (Tasks 1-4)

### Task 1: Register Error Events in Registry

**Files:**

- Modify: `packages/telemetry/src/registry.ts`
- Create: `packages/telemetry/src/__tests__/error-events.test.ts`

- [ ] **Step 1: Write test verifying new events exist in registry**

```typescript
// packages/telemetry/src/__tests__/error-events.test.ts
import { EVENT_ROUTING } from "../registry";

describe("Error events", () => {
  const errorEvents = [
    "scrape failed",
    "scrape partial",
    "brreg lookup_failed",
    "ai generation_failed",
    "auth signup_failed",
    "workspace provision_failed",
    "workspace finalize_failed",
    "industry_package load_failed",
  ];

  test.each(errorEvents)("'%s' is registered in EVENT_ROUTING", (event) => {
    expect(EVENT_ROUTING[event]).toBeDefined();
    expect(EVENT_ROUTING[event].destinations).toContain("posthog");
    expect(EVENT_ROUTING[event].destinations).toContain("logger");
  });

  test("pre-workspace errors do NOT route to activity_trail", () => {
    const preWorkspace = [
      "scrape failed",
      "scrape partial",
      "brreg lookup_failed",
      "ai generation_failed",
      "auth signup_failed",
    ];
    for (const event of preWorkspace) {
      expect(EVENT_ROUTING[event].destinations).not.toContain("activity_trail");
    }
  });

  test("post-workspace errors route to activity_trail", () => {
    const postWorkspace = [
      "workspace provision_failed",
      "workspace finalize_failed",
      "industry_package load_failed",
    ];
    for (const event of postWorkspace) {
      expect(EVENT_ROUTING[event].destinations).toContain("activity_trail");
    }
  });

  test("no error event routes to engine_event", () => {
    for (const event of errorEvents) {
      expect(EVENT_ROUTING[event].destinations).not.toContain("engine_event");
    }
  });
});

describe("Botsson response events", () => {
  const botssonEvents = [
    "botsson nudge_shown",
    "botsson nudge_accepted",
    "botsson nudge_dismissed",
    "botsson autofill_applied",
    "escalation triggered",
  ];

  test.each(botssonEvents)("'%s' is registered with category 'agent'", (event) => {
    expect(EVENT_ROUTING[event]).toBeDefined();
    expect(EVENT_ROUTING[event].category).toBe("agent");
  });

  test("no botsson event routes to engine_event (circuit breaker)", () => {
    for (const event of botssonEvents) {
      expect(EVENT_ROUTING[event].destinations).not.toContain("engine_event");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/telemetry && pnpm test -- --testPathPattern error-events`
Expected: FAIL — events not registered yet.

- [ ] **Step 3: Add error event interfaces to registry.ts**

In `packages/telemetry/src/registry.ts`, after the `WizardFactEdited` interface (around line 1528), add:

```typescript
// ─── Error Events ───────────────────────────────
export interface ScrapeFailed extends BaseEvent {
  event: "scrape failed";
  properties: {
    data: {
      error_code: string;
      error_message: string;
      step_id?: string;
      wizard_id?: string;
      recoverable: boolean;
      context?: Record<string, unknown>;
    };
  };
}

export interface ScrapePartial extends BaseEvent {
  event: "scrape partial";
  properties: {
    data: {
      error_code: string;
      error_message: string;
      step_id?: string;
      wizard_id?: string;
      recoverable: boolean;
      missing_fields?: string[];
      context?: Record<string, unknown>;
    };
  };
}

export interface BrregLookupFailed extends BaseEvent {
  event: "brreg lookup_failed";
  properties: {
    data: {
      error_code: string;
      error_message: string;
      step_id?: string;
      wizard_id?: string;
      recoverable: boolean;
      context?: Record<string, unknown>;
    };
  };
}

export interface AiGenerationFailed extends BaseEvent {
  event: "ai generation_failed";
  properties: {
    data: {
      error_code: string;
      error_message: string;
      step_id?: string;
      wizard_id?: string;
      recoverable: boolean;
      context?: Record<string, unknown>;
    };
  };
}

export interface AuthSignupFailed extends BaseEvent {
  event: "auth signup_failed";
  properties: {
    data: {
      error_code: string;
      error_message: string;
      step_id?: string;
      wizard_id?: string;
      recoverable: boolean;
      context?: Record<string, unknown>;
    };
  };
}

export interface WorkspaceProvisionFailed extends BaseEvent {
  event: "workspace provision_failed";
  properties: {
    entity: { type: "workspace"; id: string; label: string };
    data: {
      error_code: string;
      error_message: string;
      step_id?: string;
      wizard_id?: string;
      recoverable: boolean;
      context?: Record<string, unknown>;
    };
  };
}

export interface WorkspaceFinalizeFailed extends BaseEvent {
  event: "workspace finalize_failed";
  properties: {
    entity: { type: "workspace"; id: string; label: string };
    data: {
      error_code: string;
      error_message: string;
      step_id?: string;
      wizard_id?: string;
      recoverable: boolean;
      context?: Record<string, unknown>;
    };
  };
}

export interface IndustryPackageLoadFailed extends BaseEvent {
  event: "industry_package load_failed";
  properties: {
    entity: { type: "workspace"; id: string; label: string };
    data: {
      error_code: string;
      error_message: string;
      step_id?: string;
      wizard_id?: string;
      recoverable: boolean;
      context?: Record<string, unknown>;
    };
  };
}

// ─── Botsson Response Events ────────────────────
export interface BotssonNudgeShown extends BaseEvent {
  event: "botsson nudge_shown";
  properties: {
    data: {
      trigger_type: "error" | "stall" | "user_request";
      trigger_event?: string;
      wizard_id: string;
      step_id: string;
      nudge_count: number;
      action_type?: string;
    };
  };
}

export interface BotssonNudgeAccepted extends BaseEvent {
  event: "botsson nudge_accepted";
  properties: {
    data: {
      trigger_type: "error" | "stall" | "user_request";
      trigger_event?: string;
      wizard_id: string;
      step_id: string;
      nudge_count: number;
      action_type?: string;
    };
  };
}

export interface BotssonNudgeDismissed extends BaseEvent {
  event: "botsson nudge_dismissed";
  properties: {
    data: {
      trigger_type: "error" | "stall" | "user_request";
      trigger_event?: string;
      wizard_id: string;
      step_id: string;
      nudge_count: number;
    };
  };
}

export interface BotssonAutofillApplied extends BaseEvent {
  event: "botsson autofill_applied";
  properties: {
    data: {
      trigger_type: "error" | "stall" | "user_request";
      trigger_event?: string;
      wizard_id: string;
      step_id: string;
      nudge_count: number;
      field_count: number;
      source: string;
    };
  };
}

export interface EscalationTriggered extends BaseEvent {
  event: "escalation triggered";
  properties: {
    data: {
      gate: string;
      error_count: number;
      error_codes: string[];
      wizard_id: string;
      last_step: string;
      session_duration_ms: number;
      user_email?: string;
    };
  };
}
```

- [ ] **Step 4: Add new types to SmartoutEvent union**

In the `SmartoutEvent` union type (around line 2015), add after the existing wizard events:

```typescript
  | ScrapeFailed
  | ScrapePartial
  | BrregLookupFailed
  | AiGenerationFailed
  | AuthSignupFailed
  | WorkspaceProvisionFailed
  | WorkspaceFinalizeFailed
  | IndustryPackageLoadFailed
  | BotssonNudgeShown
  | BotssonNudgeAccepted
  | BotssonNudgeDismissed
  | BotssonAutofillApplied
  | EscalationTriggered
```

- [ ] **Step 5: Add EVENT_ROUTING entries**

In the `EVENT_ROUTING` object (after the existing wizard routing entries, around line 2486), add:

```typescript
  // ─── Error events ───
  "scrape failed": { destinations: ["posthog", "logger"], category: "onboarding" },
  "scrape partial": { destinations: ["posthog", "logger"], category: "onboarding" },
  "brreg lookup_failed": { destinations: ["posthog", "logger"], category: "onboarding" },
  "ai generation_failed": { destinations: ["posthog", "logger"], category: "onboarding" },
  "auth signup_failed": { destinations: ["posthog", "logger"], category: "auth" },
  "workspace provision_failed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "onboarding",
  },
  "workspace finalize_failed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "onboarding",
  },
  "industry_package load_failed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "onboarding",
  },

  // ─── Botsson response events (circuit breaker: NO engine_event) ───
  "botsson nudge_shown": { destinations: ["posthog", "logger"], category: "agent" },
  "botsson nudge_accepted": { destinations: ["posthog", "logger"], category: "agent" },
  "botsson nudge_dismissed": { destinations: ["posthog", "logger"], category: "agent" },
  "botsson autofill_applied": { destinations: ["posthog", "logger"], category: "agent" },
  "escalation triggered": { destinations: ["posthog", "logger"], category: "agent" },
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd packages/telemetry && pnpm test -- --testPathPattern error-events`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/telemetry/src/registry.ts packages/telemetry/src/__tests__/error-events.test.ts
git commit -m "feat(telemetry): register 13 new events for error tracking and botsson reactions

8 error events (scrape, brreg, auth, workspace provision/finalize),
4 botsson response events, 1 escalation event.
Circuit breaker: no botsson events route to engine_event.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Fix Telemetry Bugs

**Files:**

- Modify: `packages/telemetry/src/registry.ts` (remove engine_event from wizard routing)
- Modify: `apps/web/src/app/join/_lib/setupActions.ts` (remove double-emit)
- Modify: `apps/web/src/app/onboarding/page.tsx` (pass workspaceId + actorId)
- Modify: `apps/web/src/app/onboarding/hooks/useOnboardingState.ts` (remove dead emits)

- [ ] **Step 1: Remove engine_event from wizard event routing**

In `packages/telemetry/src/registry.ts`, change these entries:

```typescript
// BEFORE:
"wizard step_completed": {
  destinations: ["posthog", "logger", "engine_event"],
  category: "onboarding",
},
"wizard completed": {
  destinations: ["posthog", "logger", "activity_trail", "engine_event"],
  category: "onboarding",
},

// AFTER:
"wizard step_completed": {
  destinations: ["posthog", "logger"],
  category: "onboarding",
},
"wizard completed": {
  destinations: ["posthog", "logger", "activity_trail"],
  category: "onboarding",
},
```

- [ ] **Step 2: Remove double-emit in setupActions.ts**

In `apps/web/src/app/join/_lib/setupActions.ts`, remove the manual emit block (lines 348-355):

```typescript
// DELETE this entire block:
await emit({
  event: "wizard completed",
  workspace_id: workspace.workspace_id,
  actor_id: actorId,
  properties: {
    data: { wizard_id: "setup", workspace_id: workspace.workspace_id },
  },
});
```

Also remove the `import { emit } from "@smartout/telemetry";` if no other emit calls remain after Task 3.

- [ ] **Step 3: Pass workspaceId + actorId to onboarding AnimatedWizardShell**

In `apps/web/src/app/onboarding/page.tsx`, replace:

```typescript
<AnimatedWizardShell definition={onboardingWizard} />
```

with:

```typescript
<AnimatedWizardShellWithAuth definition={onboardingWizard} />
```

And add a wrapper component in the same file that resolves auth:

```typescript
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@smartout/supabase/client";
import { AnimatedWizardShell } from "@/components/wizard/AnimatedWizardShell";
import { onboardingWizard } from "./wizard-definition";

function AnimatedWizardShellWithAuth({
  definition,
}: {
  definition: typeof onboardingWizard;
}) {
  const [authContext, setAuthContext] = useState<{
    workspaceId: string | null;
    actorId: string;
  }>({ workspaceId: null, actorId: "anonymous" });

  useEffect(() => {
    async function resolve() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profiles } = await supabase
        .from("profile")
        .select("workspace_id, profile_id")
        .eq("user_id", user.id)
        .limit(1);

      const profile = profiles?.[0];
      if (profile) {
        setAuthContext({
          workspaceId: profile.workspace_id,
          actorId: profile.profile_id,
        });
      }
    }
    resolve();
  }, []);

  return (
    <AnimatedWizardShell
      definition={definition}
      workspaceId={authContext.workspaceId}
      actorId={authContext.actorId}
    />
  );
}
```

- [ ] **Step 4: Remove orphaned emit calls in useOnboardingState.ts**

In `apps/web/src/app/onboarding/hooks/useOnboardingState.ts`:

Remove the emit call at line 381 (inside `completeSection`):

```typescript
// DELETE:
if (userId) {
  emit({
    event: "wizard step_completed",
    workspace_id: onboardingWorkspaceId ?? null,
    actor_id: userId,
    properties: {
      data: {
        wizard_id: "onboarding",
        step_id: section,
        step_index: stepIndex,
      },
    },
  }).catch((e: unknown) => console.error("[onboarding] emit failed:", e));
}
```

Remove the emit call at line 814 (inside finalize):

```typescript
// DELETE:
if (userId) {
  emit({
    event: "wizard completed",
    workspace_id: workspaceId,
    actor_id: userId,
    properties: {
      data: {
        wizard_id: "onboarding",
        workspace_id: workspaceId,
      },
    },
  }).catch((e: unknown) => console.error("[onboarding] emit failed:", e));
}
```

Remove the `import { emit } from "@smartout/telemetry";` if no other emit calls remain.

- [ ] **Step 5: Run typecheck to verify**

Run: `pnpm turbo typecheck --filter=web --filter=telemetry`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add packages/telemetry/src/registry.ts apps/web/src/app/join/_lib/setupActions.ts apps/web/src/app/onboarding/page.tsx apps/web/src/app/onboarding/hooks/useOnboardingState.ts
git commit -m "fix(telemetry): fix 4 wizard telemetry bugs

- Remove engine_event from wizard routing (null workspace_id dropped silently)
- Remove double-emit in setupActions.ts (wizard_id 'setup' vs 'join')
- Pass workspaceId + actorId to onboarding AnimatedWizardShell
- Remove orphaned emit calls in legacy useOnboardingState

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Add Error Emit Calls to Join Flow

**Files:**

- Create: `apps/web/src/app/join/_lib/join-telemetry.ts`
- Modify: `apps/web/src/app/join/_hooks/useScrapedData.ts`
- Modify: `apps/web/src/app/join/_context/JoinScrapingProvider.tsx`
- Modify: `apps/web/src/app/join/_lib/setupActions.ts`
- Modify: `apps/web/src/app/join/_components/Step6CreateAccount.tsx`
- Modify: `apps/web/src/app/onboarding/wizard-definition.ts`

- [ ] **Step 1: Create join-telemetry helper**

```typescript
// apps/web/src/app/join/_lib/join-telemetry.ts

/**
 * Telemetry helpers for the join wizard flow.
 *
 * Provides typed emit wrappers for error events and manages
 * the correlation_id that links pre-auth and post-auth events.
 */

import { emit } from "@smartout/telemetry";

const CORRELATION_KEY = "smartout_join_correlation_id";

/** Get or create a correlation ID for this join session */
export function getJoinCorrelationId(): string {
  if (typeof window === "undefined") return crypto.randomUUID();

  let id = sessionStorage.getItem(CORRELATION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(CORRELATION_KEY, id);
  }
  return id;
}

/** Clear correlation ID (call after successful signup) */
export function clearJoinCorrelationId(): void {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(CORRELATION_KEY);
  }
}

interface ErrorEmitOptions {
  errorCode: string;
  errorMessage: string;
  stepId?: string;
  recoverable: boolean;
  context?: Record<string, unknown>;
}

export function emitJoinError(
  event:
    | "scrape failed"
    | "scrape partial"
    | "brreg lookup_failed"
    | "ai generation_failed"
    | "auth signup_failed"
    | "workspace provision_failed"
    | "workspace finalize_failed",
  opts: ErrorEmitOptions,
): void {
  emit({
    event,
    workspace_id: null,
    actor_id: "anonymous",
    correlation_id: getJoinCorrelationId(),
    properties: {
      data: {
        error_code: opts.errorCode,
        error_message: opts.errorMessage,
        step_id: opts.stepId,
        wizard_id: "join",
        recoverable: opts.recoverable,
        context: opts.context,
      },
    },
  } as Parameters<typeof emit>[0]).catch((e) => console.error("[join-telemetry] emit failed:", e));
}
```

- [ ] **Step 2: Add emit calls to useScrapedData.ts catch blocks**

In `apps/web/src/app/join/_hooks/useScrapedData.ts`, add import at top:

```typescript
import { emitJoinError } from "../_lib/join-telemetry";
```

Then modify the 3 catch blocks:

**Catch block 1 (BRREG lookup, ~line 74):**

```typescript
} catch (err) {
  emitJoinError("brreg lookup_failed", {
    errorCode: "BRREG_LOOKUP_FAILED",
    errorMessage: err instanceof Error ? err.message : "Unknown BRREG error",
    stepId: "account",
    recoverable: true,
  });
} finally {
  setBrregLoading(false);
}
```

**Catch block 2 (poll status, ~line 132):**

```typescript
} catch (err) {
  emitJoinError("scrape failed", {
    errorCode: "SCRAPE_POLL_FAILED",
    errorMessage: err instanceof Error ? err.message : "Scrape polling failed",
    stepId: "account",
    recoverable: true,
  });
  setScrapeStatus("failed");
  cleanup();
}
```

**Catch block 3 (trigger scrape, ~line 184):**

```typescript
} catch (err) {
  emitJoinError("scrape failed", {
    errorCode: "SCRAPE_TRIGGER_FAILED",
    errorMessage: err instanceof Error ? err.message : "Failed to trigger scrape",
    stepId: "account",
    recoverable: true,
  });
  setScrapeStatus("failed");
}
```

- [ ] **Step 3: Add emit to JoinScrapingProvider.tsx prefetch catch**

In `apps/web/src/app/join/_context/JoinScrapingProvider.tsx`, add import:

```typescript
import { emitJoinError } from "../_lib/join-telemetry";
```

Modify the catch block (~line 156):

```typescript
.catch((err) => {
  if (err instanceof DOMException && err.name === "AbortError") return;
  emitJoinError("ai generation_failed", {
    errorCode: "AI_PREFETCH_FAILED",
    errorMessage: err instanceof Error ? err.message : "AI content prefetch failed",
    stepId: "about",
    recoverable: true,
  });
  setPrefetchStatus("failed");
});
```

- [ ] **Step 4: Add error emit calls to setupActions.ts**

In `apps/web/src/app/join/_lib/setupActions.ts`, replace the `emit` import:

```typescript
// BEFORE:
import { emit } from "@smartout/telemetry";

// AFTER:
import { emitJoinError } from "./join-telemetry";
```

Add `emitJoinError` calls before each `throw` and `console.error`:

After `identityError` (~line 126):

```typescript
console.error("[completeSignup] user_identity update failed:", identityError);
emitJoinError("workspace provision_failed", {
  errorCode: "IDENTITY_UPDATE_FAILED",
  errorMessage: identityError.message,
  stepId: "create_account",
  recoverable: false,
});
```

Before the provision throw (~line 143):

```typescript
    emitJoinError("workspace provision_failed", {
      errorCode: "PROVISION_RPC_FAILED",
      errorMessage: provisionError?.message ?? "unknown",
      stepId: "create_account",
      recoverable: false,
    });
    throw new Error(...);
```

Before the workspace update throw (~line 179):

```typescript
    emitJoinError("workspace provision_failed", {
      errorCode: "WORKSPACE_UPDATE_FAILED",
      errorMessage: workspaceUpdateError.message,
      stepId: "create_account",
      recoverable: false,
    });
    throw new Error(...);
```

Before the profile update throw (~line 217):

```typescript
    emitJoinError("workspace provision_failed", {
      errorCode: "PROFILE_UPDATE_FAILED",
      errorMessage: profileError?.message ?? "unknown",
      stepId: "create_account",
      recoverable: false,
    });
    throw new Error(...);
```

- [ ] **Step 5: Add emit to Step6CreateAccount.tsx**

In `apps/web/src/app/join/_components/Step6CreateAccount.tsx`, add import:

```typescript
import { emitJoinError } from "../_lib/join-telemetry";
```

After the `signUpError` check (~line 93):

```typescript
    if (signUpError) {
      emitJoinError("auth signup_failed", {
        errorCode: signUpError.message.includes("already registered")
          ? "AUTH_DUPLICATE_EMAIL"
          : "AUTH_SIGNUP_ERROR",
        errorMessage: signUpError.message,
        stepId: "create_account",
        recoverable: true,
      });
```

After the `signInError` check (~line 100):

```typescript
      if (signInError) {
        emitJoinError("auth signup_failed", {
          errorCode: "AUTH_SIGNIN_FAILED",
          errorMessage: signInError.message,
          stepId: "create_account",
          recoverable: true,
        });
        setError("Feil passord for eksisterende konto.");
```

- [ ] **Step 6: Add emit to onboarding wizard-definition.ts**

In `apps/web/src/app/onboarding/wizard-definition.ts`, add import:

```typescript
import { emit } from "@smartout/telemetry";
```

In the `onComplete` function, modify the error handling (~line 247):

```typescript
if (error) {
  emit({
    event: "workspace finalize_failed",
    workspace_id: state.workspaceId,
    actor_id: "anonymous",
    properties: {
      entity: { type: "workspace" as const, id: state.workspaceId, label: "onboarding" },
      data: {
        error_code: "FINALIZE_EDGE_FN_FAILED",
        error_message: error.message || "Failed to finalize workspace",
        step_id: "summary",
        wizard_id: "onboarding",
        recoverable: true,
      },
    },
  }).catch(() => {});
  throw new Error(error.message || "Failed to finalize workspace");
}
```

- [ ] **Step 7: Run typecheck**

Run: `pnpm turbo typecheck --filter=web`
Expected: 0 errors

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/join/_lib/join-telemetry.ts apps/web/src/app/join/_hooks/useScrapedData.ts apps/web/src/app/join/_context/JoinScrapingProvider.tsx apps/web/src/app/join/_lib/setupActions.ts apps/web/src/app/join/_components/Step6CreateAccount.tsx apps/web/src/app/onboarding/wizard-definition.ts
git commit -m "feat(telemetry): add error event emission to join and onboarding flows

Emit structured error events for scrape failures, BRREG lookups,
auth signup errors, workspace provisioning, and finalization.
Adds correlation_id for cross-auth event linking.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Extend BaseEvent with page/phase/surface

**Files:**

- Modify: `packages/telemetry/src/registry.ts`
- Modify: `packages/telemetry/src/emit.ts`

- [ ] **Step 1: Add optional fields to BaseEvent**

In `packages/telemetry/src/registry.ts`, extend the BaseEvent interface:

```typescript
export interface BaseEvent {
  workspace_id: string | null;
  actor_id: string;
  timestamp?: string;
  correlation_id?: string;
  /** Auto-populated by emit() on client-side from window.location.pathname */
  page?: string;
  /** Which phase of the user journey */
  phase?: "pre_auth" | "bootstrap" | "post_bootstrap";
  /** Which UI surface emitted the event */
  surface?: "wizard" | "dashboard" | "walkAi" | "mobile";
}
```

- [ ] **Step 2: Auto-populate page in emit.ts**

In `packages/telemetry/src/emit.ts`, after the timestamp auto-population and before the routing lookup, add:

```typescript
// Auto-populate page from current route (client-side only)
if (!isServer && !event.page && typeof window !== "undefined") {
  event.page = window.location.pathname;
}
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm turbo typecheck`
Expected: 0 errors (new fields are optional, backward compatible)

- [ ] **Step 4: Commit**

```bash
git add packages/telemetry/src/registry.ts packages/telemetry/src/emit.ts
git commit -m "feat(telemetry): extend BaseEvent with page, phase, surface fields

Auto-populate page from window.location.pathname on client-side.
phase and surface are caller-provided. All fields optional for
backward compatibility.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase B: Reactive Layer (Tasks 5-7)

### Task 5: Create Intervention Rules and Gate Evaluation

**Files:**

- Create: `apps/web/src/app/join/_lib/intervention-rules.ts`
- Create: `apps/web/src/app/join/_lib/__tests__/intervention-rules.test.ts`

- [ ] **Step 1: Write tests for gate evaluation**

```typescript
// apps/web/src/app/join/_lib/__tests__/intervention-rules.test.ts
import { evaluateGates, type ErrorBufferEntry } from "../intervention-rules";

describe("evaluateGates", () => {
  const now = Date.now();

  test("error_burst fires on 3+ errors within 10 seconds", () => {
    const buffer: ErrorBufferEntry[] = [
      { errorCode: "A", timestamp: now - 5000 },
      { errorCode: "B", timestamp: now - 3000 },
      { errorCode: "C", timestamp: now - 1000 },
    ];
    const result = evaluateGates(buffer, now, new Set());
    expect(result?.gate.id).toBe("error_burst");
  });

  test("error_burst does NOT fire on 2 errors", () => {
    const buffer: ErrorBufferEntry[] = [
      { errorCode: "A", timestamp: now - 5000 },
      { errorCode: "B", timestamp: now - 1000 },
    ];
    const result = evaluateGates(buffer, now, new Set());
    expect(result).toBeNull();
  });

  test("repeated_error fires on same error_code 3x", () => {
    const buffer: ErrorBufferEntry[] = [
      { errorCode: "SCRAPE_TIMEOUT", timestamp: now - 60000 },
      { errorCode: "SCRAPE_TIMEOUT", timestamp: now - 30000 },
      { errorCode: "SCRAPE_TIMEOUT", timestamp: now - 1000 },
    ];
    const result = evaluateGates(buffer, now, new Set());
    expect(result?.gate.id).toBe("repeated_error");
  });

  test("gate in cooldown is skipped", () => {
    const buffer: ErrorBufferEntry[] = [
      { errorCode: "A", timestamp: now - 5000 },
      { errorCode: "B", timestamp: now - 3000 },
      { errorCode: "C", timestamp: now - 1000 },
    ];
    const cooldowns = new Set(["error_burst"]);
    const result = evaluateGates(buffer, now, cooldowns);
    expect(result).toBeNull();
  });

  test("total_errors fires on 5+ errors in session", () => {
    const buffer: ErrorBufferEntry[] = Array.from({ length: 5 }, (_, i) => ({
      errorCode: `ERR_${i}`,
      timestamp: now - (5 - i) * 60000,
    }));
    const result = evaluateGates(buffer, now, new Set());
    expect(result?.gate.id).toBe("total_errors");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test -- --testPathPattern intervention-rules`
Expected: FAIL — module not found

- [ ] **Step 3: Implement intervention rules and gate evaluation**

```typescript
// apps/web/src/app/join/_lib/intervention-rules.ts

/**
 * Intervention rules and escalation gates for the join wizard.
 *
 * Error rules trigger Botsson immediately (0ms). Stall rules trigger
 * after 15-20s of inactivity. Escalation gates detect error patterns
 * (frequency, repetition) and escalate to support.
 */

export interface ErrorBufferEntry {
  errorCode: string;
  timestamp: number;
}

export type InterventionRule = {
  id: string;
  trigger: "error_event" | "stall" | "validation_repeated";
  match?: string;
  delay: number;
  secondarySignal?: boolean;
  messageKey: string;
  actions: ReadonlyArray<{
    id: string;
    labelKey: string;
    type: "autofill" | "retry" | "explain" | "skip";
  }>;
};

export type EscalationGate = {
  id: string;
  trigger: "error_burst" | "repeated_error" | "total_errors" | "abandon_after_error";
  window_ms: number;
  threshold: number;
  match?: string;
  action: "capture_and_alert" | "offer_support_channel" | "offer_alternative_path";
  messageKey: string;
  cooldown_ms: number;
};

// ─── Error Rules (immediate, 0ms delay) ───

export const JOIN_ERROR_RULES: ReadonlyArray<InterventionRule> = [
  {
    id: "scrape_failed",
    trigger: "error_event",
    match: "scrape failed",
    delay: 0,
    messageKey: "botsson.nudge.scrape_failed",
    actions: [
      { id: "retry", labelKey: "botsson.action.retry", type: "retry" },
      { id: "skip", labelKey: "botsson.action.skip", type: "skip" },
    ],
  },
  {
    id: "scrape_partial",
    trigger: "error_event",
    match: "scrape partial",
    delay: 0,
    messageKey: "botsson.nudge.scrape_partial",
    actions: [
      { id: "autofill", labelKey: "botsson.action.autofill_partial", type: "autofill" },
      { id: "skip", labelKey: "botsson.action.skip", type: "skip" },
    ],
  },
  {
    id: "brreg_failed",
    trigger: "error_event",
    match: "brreg lookup_failed",
    delay: 0,
    messageKey: "botsson.nudge.brreg_failed",
    actions: [{ id: "skip", labelKey: "botsson.action.continue_manual", type: "skip" }],
  },
  {
    id: "ai_gen_failed",
    trigger: "error_event",
    match: "ai generation_failed",
    delay: 0,
    messageKey: "botsson.nudge.ai_gen_failed",
    actions: [{ id: "explain", labelKey: "botsson.action.use_templates", type: "explain" }],
  },
  {
    id: "auth_failed",
    trigger: "error_event",
    match: "auth signup_failed",
    delay: 0,
    messageKey: "botsson.nudge.auth_failed",
    actions: [{ id: "explain", labelKey: "botsson.action.explain_auth", type: "explain" }],
  },
  {
    id: "provision_failed",
    trigger: "error_event",
    match: "workspace provision_failed",
    delay: 0,
    messageKey: "botsson.nudge.provision_failed",
    actions: [{ id: "retry", labelKey: "botsson.action.retry", type: "retry" }],
  },
];

// ─── Stall Rules (conservative, 15-20s delay) ───

export const JOIN_STALL_RULES: ReadonlyArray<InterventionRule> = [
  {
    id: "about_autofill",
    trigger: "stall",
    delay: 15000,
    secondarySignal: true,
    messageKey: "botsson.nudge.about_autofill",
    actions: [{ id: "autofill", labelKey: "botsson.action.autofill", type: "autofill" }],
  },
  {
    id: "business_autofill",
    trigger: "stall",
    delay: 15000,
    secondarySignal: true,
    messageKey: "botsson.nudge.business_autofill",
    actions: [{ id: "autofill", labelKey: "botsson.action.autofill", type: "autofill" }],
  },
  {
    id: "hours_autofill",
    trigger: "stall",
    delay: 20000,
    secondarySignal: true,
    messageKey: "botsson.nudge.hours_autofill",
    actions: [{ id: "autofill", labelKey: "botsson.action.autofill", type: "autofill" }],
  },
  {
    id: "validation_help",
    trigger: "validation_repeated",
    delay: 0,
    messageKey: "botsson.nudge.validation_help",
    actions: [{ id: "explain", labelKey: "botsson.action.explain", type: "explain" }],
  },
];

// ─── Escalation Gates ───

export const ESCALATION_GATES: ReadonlyArray<EscalationGate> = [
  {
    id: "error_burst",
    trigger: "error_burst",
    window_ms: 10000,
    threshold: 3,
    action: "capture_and_alert",
    messageKey: "botsson.escalation.error_burst",
    cooldown_ms: 30000,
  },
  {
    id: "repeated_error",
    trigger: "repeated_error",
    window_ms: Infinity,
    threshold: 3,
    action: "offer_alternative_path",
    messageKey: "botsson.escalation.repeated_error",
    cooldown_ms: 30000,
  },
  {
    id: "auth_loop",
    trigger: "repeated_error",
    window_ms: Infinity,
    threshold: 3,
    match: "AUTH_",
    action: "offer_support_channel",
    messageKey: "botsson.escalation.auth_loop",
    cooldown_ms: 60000,
  },
  {
    id: "total_errors",
    trigger: "total_errors",
    window_ms: Infinity,
    threshold: 5,
    action: "offer_support_channel",
    messageKey: "botsson.escalation.total_errors",
    cooldown_ms: 60000,
  },
];

// ─── Gate Evaluation Engine ───

export function evaluateGates(
  buffer: ReadonlyArray<ErrorBufferEntry>,
  now: number,
  cooldowns: ReadonlySet<string>,
): { gate: EscalationGate; matchedErrors: ErrorBufferEntry[] } | null {
  for (const gate of ESCALATION_GATES) {
    if (cooldowns.has(gate.id)) continue;

    const filtered = gate.match
      ? buffer.filter((e) => e.errorCode.startsWith(gate.match!))
      : buffer;

    let matched: ErrorBufferEntry[];

    switch (gate.trigger) {
      case "error_burst": {
        matched = filtered.filter((e) => now - e.timestamp <= gate.window_ms);
        break;
      }
      case "repeated_error": {
        const counts = new Map<string, ErrorBufferEntry[]>();
        for (const entry of filtered) {
          const list = counts.get(entry.errorCode) ?? [];
          list.push(entry);
          counts.set(entry.errorCode, list);
        }
        matched = [];
        for (const entries of counts.values()) {
          if (entries.length >= gate.threshold) {
            matched = entries;
            break;
          }
        }
        break;
      }
      case "total_errors": {
        matched = [...filtered];
        break;
      }
      default:
        matched = [];
    }

    if (matched.length >= gate.threshold) {
      return { gate, matchedErrors: matched };
    }
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test -- --testPathPattern intervention-rules`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/join/_lib/intervention-rules.ts apps/web/src/app/join/_lib/__tests__/intervention-rules.test.ts
git commit -m "feat(join): add intervention rules and escalation gate evaluation

Error rules (immediate), stall rules (15-20s), and escalation gates
(error burst, repeated error, auth loop, total errors).
Pure functions, no side effects.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Create Autofill Mapping Function

**Files:**

- Create: `apps/web/src/app/join/_lib/autofill-mapping.ts`
- Create: `apps/web/src/app/join/_lib/__tests__/autofill-mapping.test.ts`

- [ ] **Step 1: Write tests for autofill mapping**

```typescript
// apps/web/src/app/join/_lib/__tests__/autofill-mapping.test.ts
import { mapScrapedDataToStepState } from "../autofill-mapping";
import type { ScrapedData } from "../../_context/JoinScrapingProvider";

describe("mapScrapedDataToStepState", () => {
  const scraped: ScrapedData = {
    companyName: "Test Restaurant",
    email: "info@test.no",
    phone: "+47 123 45 678",
    description: "A cozy restaurant in Oslo.",
    summary: "Fine dining",
    logoUrl: "https://test.no/logo.png",
    socialLinks: { instagram: "https://instagram.com/test" },
  };

  test("maps scraped data to 'about' step state", () => {
    const result = mapScrapedDataToStepState(scraped, "about");
    expect(result).toEqual({
      aboutUs: "A cozy restaurant in Oslo.",
    });
  });

  test("maps scraped data to 'business' step state", () => {
    const result = mapScrapedDataToStepState(scraped, "business");
    expect(result).toEqual({});
  });

  test("returns null for steps without mappable data", () => {
    const result = mapScrapedDataToStepState(scraped, "create_account");
    expect(result).toBeNull();
  });

  test("returns null when no scraped data", () => {
    const result = mapScrapedDataToStepState({}, "about");
    expect(result).toBeNull();
  });

  test("maps hours step with social links", () => {
    const result = mapScrapedDataToStepState(scraped, "hours");
    expect(result).toEqual({
      phone: "+47 123 45 678",
      instagram: "https://instagram.com/test",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test -- --testPathPattern autofill-mapping`
Expected: FAIL

- [ ] **Step 3: Implement autofill mapping**

```typescript
// apps/web/src/app/join/_lib/autofill-mapping.ts

/**
 * Deterministic mapping from scraped data to wizard step state.
 *
 * Pure function — no LLM, no side effects. Maps known scraped fields
 * to known wizard state keys. Returns null if no useful mapping exists.
 */

import type { ScrapedData } from "../_context/JoinScrapingProvider";

export function mapScrapedDataToStepState(
  scraped: ScrapedData,
  stepId: string,
): Record<string, unknown> | null {
  switch (stepId) {
    case "about": {
      const aboutUs = scraped.description || scraped.summary;
      if (!aboutUs) return null;
      return { aboutUs };
    }

    case "hours": {
      const result: Record<string, unknown> = {};
      if (scraped.phone) result.phone = scraped.phone;
      if (scraped.socialLinks?.instagram) result.instagram = scraped.socialLinks.instagram;
      if (scraped.socialLinks?.facebook) result.facebook = scraped.socialLinks.facebook;
      return Object.keys(result).length > 0 ? result : null;
    }

    case "business":
      return {};

    case "account":
    case "menu":
    case "create_account":
      return null;

    default:
      return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test -- --testPathPattern autofill-mapping`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/join/_lib/autofill-mapping.ts apps/web/src/app/join/_lib/__tests__/autofill-mapping.test.ts
git commit -m "feat(join): add deterministic autofill mapping from scraped data

Pure function mapping scraped fields to wizard step state.
No LLM, no side effects. Covers about, hours steps.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Create useBotssonReactive Hook

**Files:**

- Create: `apps/web/src/components/wizard/useBotssonReactive.ts`
- Create: `apps/web/src/components/wizard/__tests__/useBotssonReactive.test.ts`

- [ ] **Step 1: Write tests for the reactive hook**

```typescript
// apps/web/src/components/wizard/__tests__/useBotssonReactive.test.ts
import { renderHook, act } from "@testing-library/react";
import { useBotssonReactive } from "../useBotssonReactive";
import type { InterventionRule, EscalationGate } from "@/app/join/_lib/intervention-rules";

const mockRules: InterventionRule[] = [
  {
    id: "test_error",
    trigger: "error_event",
    match: "scrape failed",
    delay: 0,
    messageKey: "test.scrape_failed",
    actions: [{ id: "retry", labelKey: "test.retry", type: "retry" }],
  },
];

const mockGates: EscalationGate[] = [
  {
    id: "error_burst",
    trigger: "error_burst",
    window_ms: 10000,
    threshold: 3,
    action: "offer_support_channel",
    messageKey: "test.escalation",
    cooldown_ms: 30000,
  },
];

function dispatchTelemetryEvent(event: string, category: string, errorCode?: string) {
  window.dispatchEvent(
    new CustomEvent("smartout:telemetry", {
      detail: {
        event,
        properties: { data: { error_code: errorCode } },
      },
    }),
  );
  // Also dispatch with routing info
  window.dispatchEvent(
    new CustomEvent("smartout:telemetry", {
      detail: {
        event,
        _routing: { category },
        properties: { data: { error_code: errorCode } },
      },
    }),
  );
}

describe("useBotssonReactive", () => {
  test("returns hidden state by default", () => {
    const { result } = renderHook(() =>
      useBotssonReactive({
        rules: mockRules,
        gates: mockGates,
        wizardId: "join",
        stepId: "account",
      }),
    );
    expect(result.current.shouldShow).toBe(false);
    expect(result.current.nudgeType).toBeNull();
  });

  test("ignores events with category 'agent' (circuit breaker)", () => {
    const { result } = renderHook(() =>
      useBotssonReactive({
        rules: mockRules,
        gates: mockGates,
        wizardId: "join",
        stepId: "account",
      }),
    );

    act(() => {
      dispatchTelemetryEvent("botsson nudge_shown", "agent");
    });

    expect(result.current.shouldShow).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test -- --testPathPattern useBotssonReactive`
Expected: FAIL

- [ ] **Step 3: Implement the reactive hook**

```typescript
// apps/web/src/components/wizard/useBotssonReactive.ts

/**
 * useBotssonReactive — client-side reactive hook for Botsson interventions.
 *
 * Subscribes to the `smartout:telemetry` CustomEvent bus and decides when
 * Botsson should appear. Handles error rules (immediate), stall detection
 * (timer-based), and escalation gates (pattern detection).
 *
 * Circuit breaker: events with category "agent" are always ignored to
 * prevent infinite loops.
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { emit } from "@smartout/telemetry";
import type {
  InterventionRule,
  EscalationGate,
  ErrorBufferEntry,
} from "@/app/join/_lib/intervention-rules";
import { evaluateGates } from "@/app/join/_lib/intervention-rules";

const MAX_PROACTIVE = 3;
const RING_BUFFER_SIZE = 50;
const AUTO_DISMISS_MS = 15000;

interface BotssonAction {
  id: string;
  labelKey: string;
  type: "autofill" | "retry" | "explain" | "skip";
}

export interface BotssonReactiveState {
  shouldShow: boolean;
  nudgeType: "error" | "stall" | "escalation" | null;
  messageKey: string;
  actions: BotssonAction[];
  isEscalation: boolean;
  isPassive: boolean;
  dismiss: () => void;
  applyAction: (actionId: string) => void;
}

interface UseBotssonReactiveOptions {
  rules: ReadonlyArray<InterventionRule>;
  gates: ReadonlyArray<EscalationGate>;
  wizardId: string;
  stepId: string;
  onAutofill?: () => void;
  onRetry?: () => void;
}

export function useBotssonReactive({
  rules,
  gates,
  wizardId,
  stepId,
  onAutofill,
  onRetry,
}: UseBotssonReactiveOptions): BotssonReactiveState {
  const [visible, setVisible] = useState(false);
  const [messageKey, setMessageKey] = useState("");
  const [actions, setActions] = useState<BotssonAction[]>([]);
  const [nudgeType, setNudgeType] = useState<"error" | "stall" | "escalation" | null>(null);
  const [isEscalation, setIsEscalation] = useState(false);
  const [isPassive, setIsPassive] = useState(false);

  const nudgeCountRef = useRef(0);
  const errorBufferRef = useRef<ErrorBufferEntry[]>([]);
  const cooldownsRef = useRef(new Set<string>());
  const dismissedErrorsRef = useRef(new Set<string>());
  const autoDismissTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const triggerEventRef = useRef<string | undefined>();

  const showNudge = useCallback(
    (
      type: "error" | "stall" | "escalation",
      key: string,
      acts: BotssonAction[],
      triggerEvent?: string,
    ) => {
      if (isPassive && type !== "escalation") return;
      if (nudgeCountRef.current >= MAX_PROACTIVE && type !== "escalation") {
        setIsPassive(true);
        return;
      }

      nudgeCountRef.current += 1;
      triggerEventRef.current = triggerEvent;
      setVisible(true);
      setMessageKey(key);
      setActions(acts);
      setNudgeType(type);
      setIsEscalation(type === "escalation");

      emit({
        event: "botsson nudge_shown",
        workspace_id: null,
        actor_id: "anonymous",
        properties: {
          data: {
            trigger_type: type,
            trigger_event: triggerEvent,
            wizard_id: wizardId,
            step_id: stepId,
            nudge_count: nudgeCountRef.current,
            action_type: acts[0]?.type,
          },
        },
      } as Parameters<typeof emit>[0]).catch(() => {});

      // Auto-dismiss after 15s
      if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = setTimeout(() => {
        setVisible(false);
        setNudgeType(null);
      }, AUTO_DISMISS_MS);
    },
    [wizardId, stepId, isPassive],
  );

  const dismiss = useCallback(() => {
    if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
    setVisible(false);
    setNudgeType(null);

    emit({
      event: "botsson nudge_dismissed",
      workspace_id: null,
      actor_id: "anonymous",
      properties: {
        data: {
          trigger_type: nudgeType ?? "error",
          trigger_event: triggerEventRef.current,
          wizard_id: wizardId,
          step_id: stepId,
          nudge_count: nudgeCountRef.current,
        },
      },
    } as Parameters<typeof emit>[0]).catch(() => {});

    if (isEscalation) {
      setIsPassive(true);
    }
  }, [wizardId, stepId, nudgeType, isEscalation]);

  const applyAction = useCallback(
    (actionId: string) => {
      if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
      setVisible(false);
      setNudgeType(null);

      emit({
        event: "botsson nudge_accepted",
        workspace_id: null,
        actor_id: "anonymous",
        properties: {
          data: {
            trigger_type: nudgeType ?? "error",
            trigger_event: triggerEventRef.current,
            wizard_id: wizardId,
            step_id: stepId,
            nudge_count: nudgeCountRef.current,
            action_type: actionId,
          },
        },
      } as Parameters<typeof emit>[0]).catch(() => {});

      const action = actions.find((a) => a.id === actionId);
      if (action?.type === "autofill") onAutofill?.();
      if (action?.type === "retry") onRetry?.();
    },
    [wizardId, stepId, nudgeType, actions, onAutofill, onRetry],
  );

  // Subscribe to telemetry event bus
  useEffect(() => {
    function handleTelemetryEvent(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (!detail?.event) return;

      // Circuit breaker: ignore agent-category events
      const routing = detail._routing;
      if (routing?.category === "agent") return;

      const eventName = detail.event as string;
      const errorCode = detail.properties?.data?.error_code as string | undefined;

      // Check error rules
      for (const rule of rules) {
        if (rule.trigger !== "error_event") continue;
        if (rule.match && eventName !== rule.match) continue;
        if (dismissedErrorsRef.current.has(rule.id)) continue;

        // Add to error buffer for gate evaluation
        if (errorCode) {
          errorBufferRef.current.push({ errorCode, timestamp: Date.now() });
          if (errorBufferRef.current.length > RING_BUFFER_SIZE) {
            errorBufferRef.current.shift();
          }
        }

        // Check gates first (escalation takes priority)
        const gateResult = evaluateGates(errorBufferRef.current, Date.now(), cooldownsRef.current);
        if (gateResult) {
          cooldownsRef.current.add(gateResult.gate.id);
          setTimeout(() => {
            cooldownsRef.current.delete(gateResult.gate.id);
          }, gateResult.gate.cooldown_ms);

          showNudge("escalation", gateResult.gate.messageKey, [], eventName);

          emit({
            event: "escalation triggered",
            workspace_id: null,
            actor_id: "anonymous",
            properties: {
              data: {
                gate: gateResult.gate.id,
                error_count: gateResult.matchedErrors.length,
                error_codes: gateResult.matchedErrors.map((e) => e.errorCode),
                wizard_id: wizardId,
                last_step: stepId,
                session_duration_ms:
                  Date.now() - (errorBufferRef.current[0]?.timestamp ?? Date.now()),
              },
            },
          } as Parameters<typeof emit>[0]).catch(() => {});
          return;
        }

        // No escalation — show normal nudge
        showNudge("error", rule.messageKey, [...rule.actions], eventName);
        return;
      }

      // Add to buffer even if no rule matched (for gate evaluation)
      if (errorCode && eventName.includes("failed")) {
        errorBufferRef.current.push({ errorCode, timestamp: Date.now() });
        if (errorBufferRef.current.length > RING_BUFFER_SIZE) {
          errorBufferRef.current.shift();
        }
      }
    }

    window.addEventListener("smartout:telemetry", handleTelemetryEvent);
    return () => {
      window.removeEventListener("smartout:telemetry", handleTelemetryEvent);
      if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
    };
  }, [rules, gates, wizardId, stepId, showNudge]);

  return {
    shouldShow: visible,
    nudgeType,
    messageKey,
    actions,
    isEscalation,
    isPassive,
    dismiss,
    applyAction,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test -- --testPathPattern useBotssonReactive`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/wizard/useBotssonReactive.ts apps/web/src/components/wizard/__tests__/useBotssonReactive.test.ts
git commit -m "feat(wizard): add useBotssonReactive hook for proactive intervention

Client-side reactive hook subscribing to smartout:telemetry event bus.
Handles error rules (immediate), escalation gates (pattern detection),
and frequency capping (max 3 proactive, then passive).
Circuit breaker: agent-category events always ignored.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase C: UI & Integration (Tasks 8-10)

### Task 8: Create i18n Keys for Botsson

**Files:**

- Create: `packages/i18n/locales/nb/botsson.json`
- Create: `packages/i18n/locales/en/botsson.json`

- [ ] **Step 1: Create Norwegian botsson i18n file**

```json
{
  "nudge": {
    "scrape_failed": "Nettsiden svarte ikke. Du kan fylle ut manuelt, eller prøv igjen.",
    "scrape_partial": "Vi fant noe, men ikke alt. Skal jeg fylle ut det vi har?",
    "brreg_failed": "Klarte ikke hente bedriftsinfo fra Brønnøysund.",
    "ai_gen_failed": "AI-genereringen feilet. Her er noen maler du kan bruke.",
    "auth_failed": "Det oppsto en feil med kontoen. Prøv igjen.",
    "provision_failed": "Noe gikk galt under opprettelsen. Prøv igjen.",
    "about_autofill": "Jeg har allerede hentet info fra nettsiden din. Skal jeg fylle ut?",
    "business_autofill": "Jeg fant bedriftsinfo i Brønnøysund. Skal jeg fylle ut?",
    "hours_autofill": "Jeg fant åpningstider på nettsiden. Skal jeg legge dem inn?",
    "validation_help": "Ser ut som noe er vanskelig. Trenger du hjelp?"
  },
  "action": {
    "retry": "Prøv igjen",
    "skip": "Hopp over",
    "autofill": "Fyll ut for meg",
    "autofill_partial": "Fyll ut det vi har",
    "explain": "Vis meg",
    "explain_auth": "Hjelp meg",
    "use_templates": "Bruk mal",
    "continue_manual": "Fortsett manuelt",
    "dismiss": "Lukk"
  },
  "escalation": {
    "error_burst": "Noe ser ut til å være systematisk galt. Vi tar det herfra.",
    "repeated_error": "Dette problemet vedvarer. La oss finne en løsning.",
    "auth_loop": "Det ser ut som det er et problem med kontoen. Vi hjelper deg.",
    "total_errors": "Du har truffet på flere problemer. Vi bør ta en titt.",
    "support_link": "Kontakt oss direkte: support@smartout.ai"
  },
  "aria": {
    "assistant_label": "AI-assistent",
    "dismiss_label": "Lukk AI-forslag",
    "orb_label": "Botsson — klikk for hjelp"
  }
}
```

- [ ] **Step 2: Create English botsson i18n file**

```json
{
  "nudge": {
    "scrape_failed": "The website didn't respond. You can fill in manually, or try again.",
    "scrape_partial": "We found some info, but not everything. Shall I fill in what we have?",
    "brreg_failed": "Couldn't fetch business info from Brønnøysund.",
    "ai_gen_failed": "AI generation failed. Here are some templates you can use.",
    "auth_failed": "There was an account error. Try again.",
    "provision_failed": "Something went wrong during setup. Try again.",
    "about_autofill": "I've already fetched info from your website. Shall I fill it in?",
    "business_autofill": "I found business info in Brønnøysund. Shall I fill it in?",
    "hours_autofill": "I found opening hours on the website. Shall I add them?",
    "validation_help": "Looks like something is tricky. Need help?"
  },
  "action": {
    "retry": "Try again",
    "skip": "Skip",
    "autofill": "Fill in for me",
    "autofill_partial": "Fill in what we have",
    "explain": "Show me",
    "explain_auth": "Help me",
    "use_templates": "Use template",
    "continue_manual": "Continue manually",
    "dismiss": "Close"
  },
  "escalation": {
    "error_burst": "Something seems systematically wrong. We'll take it from here.",
    "repeated_error": "This problem persists. Let's find a solution.",
    "auth_loop": "There seems to be an account issue. We'll help you.",
    "total_errors": "You've hit several problems. We should take a look.",
    "support_link": "Contact us directly: support@smartout.ai"
  },
  "aria": {
    "assistant_label": "AI assistant",
    "dismiss_label": "Dismiss AI suggestion",
    "orb_label": "Botsson — click for help"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/i18n/locales/nb/botsson.json packages/i18n/locales/en/botsson.json
git commit -m "feat(i18n): add botsson nudge and escalation message keys

Norwegian and English translations for error nudges, stall nudges,
escalation messages, action labels, and accessibility labels.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Create Warm Orb Companion Component

**Files:**

- Create: `apps/web/src/components/wizard/BotssonOrb.tsx`

- [ ] **Step 1: Implement the Warm Orb Companion**

```typescript
// apps/web/src/components/wizard/BotssonOrb.tsx

"use client";

/**
 * BotssonOrb — Warm Orb Companion for proactive AI assistance.
 *
 * Floating UI element that appears when Botsson has a suggestion.
 * Uses Nordic Split design tokens: warm accent orb, spring physics,
 * glassmorphism speech bubble. Accessible and mobile-responsive.
 */

import { useEffect, useRef, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { BotssonReactiveState } from "./useBotssonReactive";

interface BotssonOrbProps {
  state: BotssonReactiveState;
  t: (key: string) => string;
}

const springEntrance = { type: "spring" as const, stiffness: 38, damping: 22, mass: 2.2 };
const springSubtle = { type: "spring" as const, stiffness: 45, damping: 24 };

export function BotssonOrb({ state, t }: BotssonOrbProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape" && state.shouldShow) {
        state.dismiss();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state]);

  // Passive state: small clickable orb
  if (state.isPassive && !state.shouldShow) {
    return (
      <motion.button
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed bottom-6 right-6 z-[60] h-6 w-6 rounded-full"
        style={{
          background: "radial-gradient(circle at 30% 30%, var(--color-accent), var(--color-accent-dark, #b45309))",
          boxShadow: "0 0 12px color-mix(in oklch, var(--color-accent) 30%, transparent)",
        }}
        aria-label={t("botsson.aria.orb_label")}
        onClick={() => {
          /* Manual summon — future work */
        }}
      >
        <motion.div
          animate={{ scale: [0.95, 1.05, 0.95] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="h-full w-full rounded-full"
        />
      </motion.button>
    );
  }

  return (
    <div
      ref={containerRef}
      role="complementary"
      aria-label={t("botsson.aria.assistant_label")}
      className="fixed bottom-6 right-6 z-[60] max-w-sm md:right-[calc(33%+24px)]"
    >
      <AnimatePresence mode="wait">
        {state.shouldShow && (
          <motion.div
            key="botsson-nudge"
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 8 }}
            transition={springEntrance}
            className="flex flex-col items-end gap-2"
          >
            {/* Speech bubble */}
            <motion.div
              initial={{ opacity: 0, scaleY: 0.5 }}
              animate={{ opacity: 1, scaleY: 1 }}
              exit={{ opacity: 0, scaleY: 0.5 }}
              transition={springSubtle}
              style={{ transformOrigin: "bottom right" }}
              className={`
                rounded-2xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur-xl
                ${state.isEscalation ? "border-destructive/50" : ""}
              `}
            >
              {/* Dismiss button */}
              <button
                onClick={state.dismiss}
                aria-label={t("botsson.aria.dismiss_label")}
                className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X size={14} />
              </button>

              {/* Message */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.2 }}
                className="pr-6 text-sm text-foreground"
              >
                {t(state.messageKey)}
              </motion.p>

              {/* Actions */}
              {state.actions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4, duration: 0.2 }}
                  className="mt-3 flex gap-2"
                >
                  {state.actions.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => state.applyAction(action.id)}
                      className={`
                        rounded-lg px-3 py-1.5 text-xs font-medium transition-colors
                        ${action.type === "autofill" || action.type === "retry"
                          ? "bg-accent text-accent-foreground hover:bg-accent/90"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }
                      `}
                    >
                      {t(action.labelKey)}
                    </button>
                  ))}
                </motion.div>
              )}

              {/* Escalation: support link */}
              {state.isEscalation && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5, duration: 0.2 }}
                  className="mt-2 text-xs text-muted-foreground"
                >
                  {t("botsson.escalation.support_link")}
                </motion.p>
              )}
            </motion.div>

            {/* Orb */}
            <motion.div
              className="h-10 w-10 rounded-full"
              style={{
                background: "radial-gradient(circle at 30% 30%, var(--color-accent), var(--color-accent-dark, #b45309))",
                boxShadow: "0 0 20px color-mix(in oklch, var(--color-accent) 30%, transparent)",
              }}
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm turbo typecheck --filter=web`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/wizard/BotssonOrb.tsx
git commit -m "feat(wizard): add BotssonOrb warm orb companion component

Floating UI with spring physics entrance/exit, glassmorphism bubble,
accent-palette orb, action buttons, escalation support link.
Accessible: role=status, aria-live=polite, Escape dismisses.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Wire Everything in /join

**Files:**

- Modify: `apps/web/src/components/wizard/AnimatedWizardShell.tsx`

- [ ] **Step 1: Add BotssonOrb integration to AnimatedWizardShell**

In `apps/web/src/components/wizard/AnimatedWizardShell.tsx`, add imports:

```typescript
import { useBotssonReactive } from "./useBotssonReactive";
import { BotssonOrb } from "./BotssonOrb";
import {
  JOIN_ERROR_RULES,
  JOIN_STALL_RULES,
  ESCALATION_GATES,
} from "@/app/join/_lib/intervention-rules";
```

Inside the component, after the existing hooks, add:

```typescript
// Botsson reactive intervention (only for join wizard)
const botssonRules = definition.id === "join" ? [...JOIN_ERROR_RULES, ...JOIN_STALL_RULES] : [];
const botssonGates = definition.id === "join" ? [...ESCALATION_GATES] : [];

const botsson = useBotssonReactive({
  rules: botssonRules,
  gates: botssonGates,
  wizardId: definition.id,
  stepId: currentStep?.id ?? "",
});
```

Note: `currentStep` is not directly available in `AnimatedWizardShell` — it comes from `WizardShell` internals. Instead, track it via the `onStepChange` callback:

```typescript
const [currentStepId, setCurrentStepId] = useState(definition.steps[0]?.id ?? "");

// Wrap the telemetry onStepChange to also track current step
const originalOnStepChange = telemetry.onStepChange;
const onStepChangeWithTracking = useCallback(
  (stepId: string, stepIndex: number, fromStep?: string) => {
    setCurrentStepId(stepId);
    originalOnStepChange(stepId, stepIndex, fromStep);
  },
  [originalOnStepChange],
);
```

Then update the WizardShell render to use `onStepChangeWithTracking`:

```typescript
  <WizardShell
    ...
    onStepChange={onStepChangeWithTracking}
    ...
  />
```

And render the BotssonOrb after WizardShell, inside the same container:

```typescript
  return (
    <>
      <WizardShell ... />
      {botssonRules.length > 0 && (
        <BotssonOrb state={botsson} t={t} />
      )}
    </>
  );
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm turbo typecheck --filter=web`
Expected: 0 errors

- [ ] **Step 3: Manual test — verify Botsson appears on scrape failure**

1. Start dev server: `pnpm --filter web dev`
2. Navigate to `/join`
3. Enter a non-existent URL (e.g., `https://this-does-not-exist-12345.no`)
4. Fill in required fields and proceed to step 2
5. Observe: Botsson orb should appear after scraping fails
6. Click dismiss: orb should disappear
7. Check browser console for `[join-telemetry]` logs confirming emit calls

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/wizard/AnimatedWizardShell.tsx
git commit -m "feat(wizard): wire BotssonOrb into AnimatedWizardShell for join flow

Connects useBotssonReactive hook + BotssonOrb component to the join
wizard. Botsson reacts to error events and appears with contextual help.
Only active for wizard id 'join' — other wizards unaffected.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Implement wizard abandoned Event

**Files:**

- Modify: `packages/ui/src/wizard/WizardShell.tsx`

- [ ] **Step 1: Add beforeunload handler to WizardShell**

In `packages/ui/src/wizard/WizardShell.tsx`, add a `useEffect` for abandoned detection.

After the existing hooks inside the component:

```typescript
// Track wizard start time for duration calculation
const wizardStartRef = useRef(Date.now());
const hasEnteredStepRef = useRef(false);

// Mark that at least one step has been entered
useEffect(() => {
  if (currentStep) hasEnteredStepRef.current = true;
}, [currentStep]);

// Emit wizard abandoned on beforeunload (best-effort via sendBeacon)
useEffect(() => {
  function handleBeforeUnload() {
    if (!hasEnteredStepRef.current) return;
    // Don't fire if wizard completed
    if (completedSteps.size === definition.steps.length) return;

    const payload = JSON.stringify({
      event: "wizard abandoned",
      workspace_id: null,
      actor_id: "anonymous",
      properties: {
        data: {
          wizard_id: definition.id,
          last_step: currentStep?.id ?? "unknown",
          duration_ms: Date.now() - wizardStartRef.current,
        },
      },
    });

    // Use sendBeacon for reliability on page unload
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/telemetry-beacon", payload);
    }
  }

  window.addEventListener("beforeunload", handleBeforeUnload);
  return () => window.removeEventListener("beforeunload", handleBeforeUnload);
}, [definition.id, definition.steps.length, currentStep, completedSteps]);
```

Note: This requires a `/api/telemetry-beacon` endpoint that calls `emit()` server-side. Create a minimal route:

```typescript
// apps/web/src/app/api/telemetry-beacon/route.ts
import { emit } from "@smartout/telemetry";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const event = await request.json();
    await emit(event);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
```

- [ ] **Step 2: Add the useRef import if not already present**

Verify `useRef` is imported from React in `WizardShell.tsx`. It is already imported on line 17.

- [ ] **Step 3: Run typecheck**

Run: `pnpm turbo typecheck --filter=ui --filter=web`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/wizard/WizardShell.tsx apps/web/src/app/api/telemetry-beacon/route.ts
git commit -m "feat(wizard): implement wizard abandoned event via sendBeacon

Fires on beforeunload when wizard is incomplete and at least one step
has been entered. Uses navigator.sendBeacon for reliability.
Adds /api/telemetry-beacon endpoint for server-side emission.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Summary

| Task | What                                        | Status  |
| ---- | ------------------------------------------- | ------- |
| 1    | Register 13 new events in registry          | `- [ ]` |
| 2    | Fix 4 telemetry bugs                        | `- [ ]` |
| 3    | Add error emit calls to join/onboarding     | `- [ ]` |
| 4    | Extend BaseEvent with page/phase/surface    | `- [ ]` |
| 5    | Create intervention rules + gate evaluation | `- [ ]` |
| 6    | Create autofill mapping function            | `- [ ]` |
| 7    | Create useBotssonReactive hook              | `- [ ]` |
| 8    | Create i18n keys for Botsson                | `- [ ]` |
| 9    | Create Warm Orb Companion component         | `- [ ]` |
| 10   | Wire everything in /join                    | `- [ ]` |
| 11   | Implement wizard abandoned event            | `- [ ]` |

**Total: 11 tasks, ~45 steps, 11 commits**

Phase A (Tasks 1-4) can be merged independently — pure telemetry work.
Phase B (Tasks 5-7) can be merged after Phase A — reactive logic.
Phase C (Tasks 8-11) completes the UI and wiring — needs both A and B.
