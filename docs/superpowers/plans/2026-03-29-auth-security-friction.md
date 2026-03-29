---
title: Auth, Security & Friction Implementation Plan
status: ready
updated: 2026-03-29
created: 2026-03-29
module: auth
tags: [auth, security, otp, sandbox, rate-limiting, telemetry]
---

# Auth, Security & Friction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Smartout's three onboarding wizards frictionless by moving auth to step 1 (invisible), adding OTP as login method, sandboxing unverified workspaces, and hardening rate limiting.

**Architecture:** Silent `signUp()` in Join wizard step 1, deferred email verification via OTP at workspace entry, `workspace_status` enum for sandbox lifecycle, `auth.users.email_confirmed_at` as verification source of truth, three-layer rate limiting (Supabase config + Upstash Redis + telemetry anomaly detection).

**Tech Stack:** Supabase Auth, Next.js middleware, Upstash Redis, Framer Motion, packages/telemetry registry, Supabase Edge Functions (cron cleanup)

**Spec:** `docs/superpowers/specs/2026-03-29-auth-security-friction-design.md`

---

## Task 1: Database migrations — workspace_status + engine FK cascade

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_workspace_status_and_sandbox.sql`
- Create: `supabase/migrations/YYYYMMDDHHMMSS_engine_fk_cascade.sql`
- Modify: `packages/supabase/src/database.types.ts` (regenerate)

- [ ] **Step 1: Write workspace_status migration**

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_workspace_status_and_sandbox.sql

-- New enum for workspace lifecycle
CREATE TYPE workspace_status AS ENUM ('sandbox', 'active', 'suspended', 'archived');

-- Add status column with sandbox as default (new workspaces start sandboxed)
ALTER TABLE workspace ADD COLUMN status workspace_status NOT NULL DEFAULT 'sandbox';

-- Set all existing workspaces to active (they're already verified)
UPDATE workspace SET status = 'active';

-- Deadline for sandbox expiry (NULL for active workspaces)
ALTER TABLE workspace ADD COLUMN verification_deadline timestamptz;

-- Helper function: check if a user's email is verified via auth.users
CREATE OR REPLACE FUNCTION is_email_verified(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT (email_confirmed_at IS NOT NULL)
  FROM auth.users
  WHERE id = user_uuid;
$$;

-- Index for cleanup cron queries
CREATE INDEX idx_workspace_sandbox_deadline
  ON workspace (status, verification_deadline)
  WHERE status = 'sandbox';
```

- [ ] **Step 2: Write engine FK cascade migration**

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_engine_fk_cascade.sql

-- Fix FK cascade on engine tables so workspace deletion doesn't fail
-- engine_sessions
ALTER TABLE engine_sessions
  DROP CONSTRAINT IF EXISTS engine_sessions_workspace_id_fkey;
ALTER TABLE engine_sessions
  ADD CONSTRAINT engine_sessions_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES workspace(workspace_id) ON DELETE CASCADE;

-- engine_memory
ALTER TABLE engine_memory
  DROP CONSTRAINT IF EXISTS engine_memory_workspace_id_fkey;
ALTER TABLE engine_memory
  ADD CONSTRAINT engine_memory_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES workspace(workspace_id) ON DELETE CASCADE;

-- engine_authority_config
ALTER TABLE engine_authority_config
  DROP CONSTRAINT IF EXISTS engine_authority_config_workspace_id_fkey;
ALTER TABLE engine_authority_config
  ADD CONSTRAINT engine_authority_config_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES workspace(workspace_id) ON DELETE CASCADE;

-- engine_inbox
ALTER TABLE engine_inbox
  DROP CONSTRAINT IF EXISTS engine_inbox_workspace_id_fkey;
ALTER TABLE engine_inbox
  ADD CONSTRAINT engine_inbox_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES workspace(workspace_id) ON DELETE CASCADE;

-- engine_missions (workspace_id is nullable)
ALTER TABLE engine_missions
  DROP CONSTRAINT IF EXISTS engine_missions_workspace_id_fkey;
ALTER TABLE engine_missions
  ADD CONSTRAINT engine_missions_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES workspace(workspace_id) ON DELETE CASCADE;
```

- [ ] **Step 3: Run migrations against local Supabase**

```bash
# Get container name
CONTAINER=$(docker ps -q -f name=supabase_db)

# Run workspace status migration
docker exec -i $CONTAINER psql -U postgres < supabase/migrations/YYYYMMDDHHMMSS_workspace_status_and_sandbox.sql

# Run engine FK cascade migration
docker exec -i $CONTAINER psql -U postgres < supabase/migrations/YYYYMMDDHHMMSS_engine_fk_cascade.sql
```

Expected: Both migrations succeed without errors.

- [ ] **Step 4: Verify migration results**

```bash
docker exec -i $CONTAINER psql -U postgres -c "
  SELECT column_name, data_type, column_default
  FROM information_schema.columns
  WHERE table_name = 'workspace'
    AND column_name IN ('status', 'verification_deadline');
"
```

Expected: `status` column with type `USER-DEFINED` (enum) and default `'sandbox'`, `verification_deadline` with type `timestamp with time zone`.

```bash
docker exec -i $CONTAINER psql -U postgres -c "
  SELECT tc.constraint_name, rc.delete_rule
  FROM information_schema.table_constraints tc
  JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
  WHERE tc.table_name IN ('engine_sessions', 'engine_memory', 'engine_authority_config', 'engine_inbox', 'engine_missions')
    AND tc.constraint_type = 'FOREIGN KEY'
    AND tc.constraint_name LIKE '%workspace%';
"
```

Expected: All workspace FK constraints show `delete_rule = CASCADE`.

- [ ] **Step 5: Regenerate types**

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/ packages/supabase/src/database.types.ts
git commit -m "feat(auth): add workspace_status enum and fix engine FK cascades

workspace_status enum (sandbox/active/suspended/archived) replaces
ad-hoc status tracking. Engine tables get ON DELETE CASCADE for
workspace FK to support sandbox cleanup.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Supabase config hardening

**Files:**

- Modify: `supabase/config.toml`

- [ ] **Step 1: Update rate limits and password length**

In `supabase/config.toml`, make these changes:

Line 189 — change `minimum_password_length`:

```toml
minimum_password_length = 8
```

Line 196-204 — update rate limits. Find the `[auth.rate_limit]` section and update. Note: the exact line numbers depend on your config.toml version, but look for these values:

```toml
# Change sign_in_sign_ups from 1000 to 30
sign_in_sign_ups = 30

# OTP sending rate (if configurable, reduce to 15)
```

Line 228-231 — update OTP settings in `[auth.email]`:

```toml
otp_length = 6
otp_expiry = 1800
```

- [ ] **Step 2: Verify config is valid**

```bash
npx supabase stop && npx supabase start
```

Expected: Supabase starts without config errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/config.toml
git commit -m "fix(auth): harden rate limits and increase min password length

min_password_length 6→8, sign_in_sign_ups 1000→30/5min, otp_expiry
3600→1800. Aligns server config with existing client-side validation.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Telemetry event registration

**Files:**

- Modify: `packages/telemetry/src/registry.ts`

- [ ] **Step 1: Add new EventCategory values**

Find the `EventCategory` type in `registry.ts` and add `"wizard"`, `"security"`, `"enrichment"`:

```typescript
type EventCategory =
  | "auth"
  | "onboarding"
  | "org_structure"
  | "scheduling"
  | "contracts"
  | "operations"
  | "haccp"
  | "training"
  | "communication"
  | "system"
  | "navigation"
  | "channels"
  | "agent"
  | "telegram"
  | "wizard"
  | "security"
  | "enrichment"; // NEW
```

- [ ] **Step 2: Add new ActionVerb values if missing**

Check if these verbs exist in `ActionVerb`. Add any that are missing:

```typescript
// Ensure these exist in ActionVerb:
"entered" |
  "completed" |
  "abandoned" |
  "requested" |
  "missed" |
  "corrected" |
  "sent" |
  "verified" |
  "failed" |
  "rate_limited" |
  "lockout_triggered" |
  "sandbox_blocked";
```

- [ ] **Step 3: Add wizard event interfaces**

```typescript
export interface WizardStepEntered extends BaseEvent {
  event: "wizard step_entered";
  properties: {
    data: {
      wizard_id: string;
      step_id: string;
      step_index: number;
    };
  };
}

export interface WizardStepCompleted extends BaseEvent {
  event: "wizard step_completed";
  properties: {
    data: {
      wizard_id: string;
      step_id: string;
      duration_ms: number;
    };
  };
}

export interface WizardAbandoned extends BaseEvent {
  event: "wizard abandoned";
  properties: {
    data: {
      wizard_id: string;
      last_step_id: string;
      total_duration_ms: number;
    };
  };
}

export interface WizardCompleted extends BaseEvent {
  event: "wizard completed";
  properties: {
    data: {
      wizard_id: string;
      total_duration_ms: number;
      steps_count: number;
    };
  };
}
```

- [ ] **Step 4: Add auth event interfaces**

```typescript
// Extend existing AuthSignedUp with silent flag
// Find AuthSignedUp interface and add silent to properties:
export interface AuthSignedUp extends BaseEvent {
  event: "auth signed_up";
  properties: {
    method: "email" | "google" | "invite_link";
    silent?: boolean; // NEW: true when signup happens in wizard step 1
  };
}

export interface AuthOtpSent extends BaseEvent {
  event: "auth otp_sent";
  properties: {
    data: {
      context: "workspace_entry" | "login";
    };
  };
}

export interface AuthOtpVerified extends BaseEvent {
  event: "auth otp_verified";
  properties: {
    data: {
      attempts: number;
      duration_ms: number;
    };
  };
}

export interface AuthOtpFailed extends BaseEvent {
  event: "auth otp_failed";
  properties: {
    data: {
      reason: "expired" | "wrong_code" | "max_attempts";
    };
  };
}

export interface AuthLoggedIn extends BaseEvent {
  event: "auth logged_in";
  properties: {
    data: {
      method: "password" | "otp" | "google";
    };
  };
}
```

- [ ] **Step 5: Add security event interfaces**

```typescript
export interface SecurityRateLimited extends BaseEvent {
  event: "security rate_limited";
  properties: {
    data: {
      endpoint: string;
      ip_hash: string;
      identifier: string;
      count: number;
    };
  };
}

export interface SecurityLockoutTriggered extends BaseEvent {
  event: "security lockout_triggered";
  properties: {
    data: {
      method: string;
      attempts: number;
    };
  };
}

export interface SecuritySandboxBlocked extends BaseEvent {
  event: "security sandbox_blocked";
  properties: {
    data: {
      action: string;
      workspace_id: string;
    };
  };
}

export interface WorkspaceAbandoned extends BaseEvent {
  event: "workspace abandoned";
  properties: {
    data: {
      workspace_id: string;
      created_at: string;
      last_step: string;
    };
  };
}
```

- [ ] **Step 6: Add enrichment event interfaces**

```typescript
export interface EnrichmentRequested extends BaseEvent {
  event: "enrichment requested";
  properties: {
    data: {
      source: "brreg" | "scraping";
      org_number: string;
    };
  };
}

export interface EnrichmentHit extends BaseEvent {
  event: "enrichment hit";
  properties: {
    data: {
      source: "brreg" | "scraping";
      fields_populated: number;
      fields_total: number;
    };
  };
}

export interface EnrichmentMissed extends BaseEvent {
  event: "enrichment missed";
  properties: {
    data: {
      source: "brreg" | "scraping";
      reason: string;
    };
  };
}

export interface EnrichmentCorrected extends BaseEvent {
  event: "enrichment corrected";
  properties: {
    data: {
      field_name: string;
      was_auto: boolean;
    };
  };
}
```

- [ ] **Step 7: Add all new events to SmartoutEvent union type**

Find the `SmartoutEvent` type and add all new interfaces:

```typescript
export type SmartoutEvent =
  | /* ...existing events... */
  | WizardStepEntered
  | WizardStepCompleted
  | WizardAbandoned
  | WizardCompleted
  | AuthOtpSent
  | AuthOtpVerified
  | AuthOtpFailed
  | AuthLoggedIn
  | SecurityRateLimited
  | SecurityLockoutTriggered
  | SecuritySandboxBlocked
  | WorkspaceAbandoned
  | EnrichmentRequested
  | EnrichmentHit
  | EnrichmentMissed
  | EnrichmentCorrected;
```

- [ ] **Step 8: Add EVENT_ROUTING entries**

```typescript
// In EVENT_ROUTING map, add:
"wizard step_entered": ["posthog", "logger"],
"wizard step_completed": ["posthog", "logger"],
"wizard abandoned": ["posthog", "logger"],
"wizard completed": ["posthog", "logger", "activity_trail"],
"auth otp_sent": ["posthog", "logger"],
"auth otp_verified": ["posthog", "logger"],
"auth otp_failed": ["posthog", "logger"],
"auth logged_in": ["posthog", "logger"],
"security rate_limited": ["logger", "activity_trail"],
"security lockout_triggered": ["logger", "activity_trail"],
"security sandbox_blocked": ["logger", "activity_trail"],
"workspace abandoned": ["logger", "activity_trail", "engine_event"],
"enrichment requested": ["posthog", "logger"],
"enrichment hit": ["posthog", "logger"],
"enrichment missed": ["posthog", "logger"],
"enrichment corrected": ["posthog", "logger"],
```

- [ ] **Step 9: Verify types compile**

```bash
pnpm --filter telemetry typecheck
```

Expected: 0 errors.

- [ ] **Step 10: Commit**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "feat(telemetry): register wizard, auth, security, enrichment events

17 new events with entity-verb format. Wizard/enrichment→posthog+logger.
Security→logger+activity_trail. New EventCategories: wizard, security,
enrichment.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Silent auth in Join wizard step 1

**Files:**

- Modify: `apps/web/src/app/join/_components/Step1Account.tsx`
- Modify: `apps/web/src/app/join/_components/Step6CreateAccount.tsx`
- Modify: `apps/web/src/app/join/wizard-definition.ts`
- Modify: `apps/web/src/app/join/_lib/setupActions.ts`

- [ ] **Step 1: Add password field and silent signUp to Step1Account.tsx**

Add password state and silent auth logic to Step1Account. The password field should appear after email (before name fields). On blur/submit of password, call `signUp()` silently.

```typescript
// Add to Step1Account.tsx imports:
import { createClient } from "@smartout/supabase/client";

// Add state:
const [password, setPassword] = useState("");
const [confirmPassword, setConfirmPassword] = useState("");
const [authError, setAuthError] = useState<string | null>(null);
const [isAuthenticating, setIsAuthenticating] = useState(false);
const authAttemptedRef = useRef(false);

// Add silent auth function:
async function attemptSilentAuth() {
  if (authAttemptedRef.current || !email.includes("@") || password.length < 8) return;
  authAttemptedRef.current = true;
  setIsAuthenticating(true);

  const supabase = createClient();

  // Try signup first
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { first_name: firstName, last_name: lastName } },
  });

  if (error) {
    // User might already exist — try signin
    if (error.message.includes("already registered") || data?.user?.identities?.length === 0) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setAuthError("Denne e-posten er allerede registrert. Sjekk passordet ditt.");
        authAttemptedRef.current = false;
      } else {
        updateState({ _accessToken: signInData.session?.access_token });
      }
    } else {
      setAuthError(error.message);
      authAttemptedRef.current = false;
    }
  } else if (data.session) {
    updateState({ _accessToken: data.session.access_token });
    // Clear email from localStorage after successful auth
    // (email now lives in Supabase, not in localStorage)
  }

  setIsAuthenticating(false);
}
```

Add password fields to the form JSX (after email, before name fields). Add `onSubmit` to call `attemptSilentAuth()` before `next()`.

The `next()` call should be gated on successful auth:

```typescript
const handleNext = async () => {
  if (!authAttemptedRef.current) {
    await attemptSilentAuth();
  }
  if (authError) return; // Don't proceed if auth failed
  next();
};
```

- [ ] **Step 2: Convert Step6CreateAccount to summary/review step**

Replace the auth form in Step6CreateAccount with a review/summary of all wizard data. Remove all `signUp`/`signInWithPassword` calls. Remove the OTP existence check. Keep the `next()` call.

```typescript
// Step6CreateAccount.tsx becomes Step6Summary.tsx
// Shows: company name, address, industry, opening hours, menu summary
// User can go back to any step to edit
// next() proceeds to onComplete() which provisions the workspace
```

Rename the file from `Step6CreateAccount.tsx` to `Step6Summary.tsx` and update the import in `wizard-definition.ts`.

- [ ] **Step 3: Update wizard-definition.ts**

Update the step 6 definition:

```typescript
// Change the last step:
{
  id: "summary",
  labelKey: "steps.summary.label",
  icon: CheckCircle,
  component: Step6Summary,  // was Step6CreateAccount
  // Remove hideNavBar: true — summary step should have nav
}
```

In `onComplete()`, the `_accessToken` is already in state from step 1. No changes needed to the token extraction logic (line 102). The existing pattern works because auth happened earlier.

- [ ] **Step 4: Update setupActions.ts — set workspace status to sandbox**

In `completeSignup()`, after provisioning the workspace, set its status to `sandbox` with a 48-hour deadline:

```typescript
// After workspace is provisioned (around line 171), add:
await supabase
  .from("workspace")
  .update({
    status: "sandbox",
    verification_deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
  })
  .eq("workspace_id", workspace.workspace_id);
```

- [ ] **Step 5: Add i18n keys**

Add to `packages/i18n/locales/nb/join.json` (or the appropriate namespace):

```json
{
  "steps.summary.label": "Oppsummering",
  "steps.account.password": "Passord",
  "steps.account.confirmPassword": "Bekreft passord",
  "steps.account.passwordMinLength": "Minimum 8 tegn",
  "steps.account.passwordMismatch": "Passordene stemmer ikke",
  "steps.account.emailAlreadyRegistered": "Denne e-posten er allerede registrert. Sjekk passordet ditt.",
  "steps.summary.title": "Alt ser bra ut",
  "steps.summary.subtitle": "Sjekk at informasjonen stemmer før vi setter opp arbeidsplassen din."
}
```

- [ ] **Step 6: Verify typecheck passes**

```bash
pnpm --filter web typecheck
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/join/ packages/i18n/
git commit -m "feat(auth): move silent signup to wizard step 1

Auth moves from step 6 to step 1. signUp() runs silently after
email+password entry. Step 6 becomes summary/review. Existing user
detection with fallback to signInWithPassword. Workspace starts
in sandbox status with 48h verification deadline.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: OTP verification component

**Files:**

- Create: `apps/web/src/components/auth/OtpVerificationForm.tsx`

- [ ] **Step 1: Create OtpVerificationForm component**

```typescript
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createClient } from "@smartout/supabase/client";
import { cn } from "@smartout/ui/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { emit } from "@smartout/telemetry";

type OtpContext = "login" | "workspace_entry";

interface OtpVerificationFormProps {
  email: string;
  context: OtpContext;
  onVerified: () => void;
  workspaceId?: string;
  actorId?: string;
}

export function OtpVerificationForm({
  email,
  context,
  onVerified,
  workspaceId,
  actorId,
}: OtpVerificationFormProps) {
  const { t } = useTranslation("auth");
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [canResend, setCanResend] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const startTimeRef = useRef(Date.now());
  const supabase = createClient();

  // Resend countdown timer
  useEffect(() => {
    if (resendCountdown <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  // Mask email: pontus@smartout.ai → p***@s***.ai
  const maskedEmail = maskEmail(email);

  const handleDigitChange = useCallback(
    (index: number, value: string) => {
      if (!/^\d*$/.test(value)) return;

      const newDigits = [...digits];
      newDigits[index] = value.slice(-1);
      setDigits(newDigits);
      setError(null);

      // Auto-advance to next field
      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }

      // Auto-submit when all 6 digits filled
      if (newDigits.every((d) => d) && newDigits.join("").length === 6) {
        verifyCode(newDigits.join(""));
      }
    },
    [digits],
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent) => {
      // Backspace: clear current and go back
      if (e.key === "Backspace" && !digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
      // Arrow keys
      if (e.key === "ArrowLeft" && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
      if (e.key === "ArrowRight" && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [digits],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
      if (pasted.length === 0) return;

      const newDigits = [...digits];
      for (let i = 0; i < pasted.length && i < 6; i++) {
        newDigits[i] = pasted[i];
      }
      setDigits(newDigits);

      // Focus the next empty field or the last filled field
      const nextEmpty = newDigits.findIndex((d) => !d);
      inputRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();

      if (pasted.length === 6) {
        verifyCode(pasted);
      }
    },
    [digits],
  );

  async function verifyCode(code: string) {
    setIsVerifying(true);
    setAttempts((a) => a + 1);
    const duration = Date.now() - startTimeRef.current;

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });

    if (verifyError) {
      setIsVerifying(false);
      const newAttempts = attempts + 1;

      if (newAttempts >= 5) {
        setError(t("otp.error.tooMany"));
        emit({
          event: "auth otp_failed",
          workspace_id: workspaceId ?? null,
          actor_id: actorId ?? "anonymous",
          properties: { data: { reason: "max_attempts" } },
        });
      } else if (verifyError.message.includes("expired")) {
        setError(t("otp.error.expired"));
        emit({
          event: "auth otp_failed",
          workspace_id: workspaceId ?? null,
          actor_id: actorId ?? "anonymous",
          properties: { data: { reason: "expired" } },
        });
      } else {
        setError(t("otp.error.invalid"));
        emit({
          event: "auth otp_failed",
          workspace_id: workspaceId ?? null,
          actor_id: actorId ?? "anonymous",
          properties: { data: { reason: "wrong_code" } },
        });
      }

      // Clear digits on error
      setDigits(Array(6).fill(""));
      inputRefs.current[0]?.focus();
      return;
    }

    // Success
    emit({
      event: "auth otp_verified",
      workspace_id: workspaceId ?? null,
      actor_id: actorId ?? "anonymous",
      properties: { data: { attempts: attempts + 1, duration_ms: duration } },
    });

    setIsVerifying(false);
    onVerified();
  }

  async function handleResend() {
    setCanResend(false);
    setResendCountdown(60);
    setDigits(Array(6).fill(""));
    setError(null);
    startTimeRef.current = Date.now();

    await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });

    emit({
      event: "auth otp_sent",
      workspace_id: workspaceId ?? null,
      actor_id: actorId ?? "anonymous",
      properties: { data: { context } },
    });
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="text-sm text-muted-foreground">
        {t("otp.subtitle", { email: maskedEmail })}
      </p>

      {/* 6-digit input group */}
      <div
        role="group"
        aria-label={t("otp.ariaGroupLabel")}
        className="flex gap-2"
        onPaste={handlePaste}
      >
        {digits.map((digit, i) => (
          <motion.input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={1}
            value={digit}
            onChange={(e) => handleDigitChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            aria-label={t("otp.ariaDigit", { n: i + 1 })}
            className={cn(
              "h-13 w-11 rounded-lg border text-center text-lg font-mono",
              "bg-background text-foreground",
              "focus:outline-none focus:ring-2 focus:ring-primary/30",
              error && "border-destructive",
              digit && !error && "border-primary/50",
            )}
            whileFocus={{ scale: 1.04 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          />
        ))}
      </div>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-sm text-destructive"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Resend link */}
      {canResend ? (
        <button
          onClick={handleResend}
          className="text-sm text-muted-foreground underline hover:text-foreground"
        >
          {t("otp.resend")}
        </button>
      ) : (
        <p className="text-sm text-muted-foreground font-mono tabular-nums">
          {t("otp.resendCountdown", { seconds: resendCountdown })}
        </p>
      )}
    </div>
  );
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const [domainName, ...tld] = domain.split(".");
  return `${local[0]}***@${domainName[0]}***.${tld.join(".")}`;
}
```

- [ ] **Step 2: Add i18n keys for OTP**

Add to `packages/i18n/locales/nb/auth.json`:

```json
{
  "otp.title": "Bekreft identiteten din",
  "otp.subtitle": "Vi har sendt en kode til {{email}}",
  "otp.resend": "Send kode på nytt",
  "otp.resendCountdown": "Send på nytt om {{seconds}}s",
  "otp.changeEmail": "Endre e-post",
  "otp.error.invalid": "Feil kode. Prøv igjen.",
  "otp.error.expired": "Koden har utløpt. Send en ny.",
  "otp.error.tooMany": "For mange forsøk. Prøv igjen om 15 minutter.",
  "otp.ariaGroupLabel": "Engangskode, 6 sifre",
  "otp.ariaDigit": "Siffer {{n}} av 6",
  "otp.ifExists": "Hvis denne e-posten finnes, har vi sendt en kode"
}
```

- [ ] **Step 3: Verify typecheck**

```bash
pnpm --filter web typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/auth/ packages/i18n/
git commit -m "feat(auth): add OTP verification form component

Shared 6-digit OTP input with auto-advance, paste support, keyboard
navigation, error states, resend countdown, and telemetry. Used by
both login page and workspace entry overlay.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Workspace verification gate (OTP overlay)

**Files:**

- Create: `apps/web/src/app/dashboard/_components/VerificationGate.tsx`

- [ ] **Step 1: Create VerificationGate component**

This component wraps the dashboard layout. If the user's `email_confirmed_at` is null, it shows the OTP overlay. Otherwise, it renders children normally.

```typescript
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@smartout/supabase/client";
import { OtpVerificationForm } from "@/components/auth/OtpVerificationForm";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { emit } from "@smartout/telemetry";

interface VerificationGateProps {
  children: React.ReactNode;
  workspaceId: string;
  userEmail: string;
  actorId: string;
}

export function VerificationGate({
  children,
  workspaceId,
  userEmail,
  actorId,
}: VerificationGateProps) {
  const { t } = useTranslation("auth");
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function checkVerification() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check email_confirmed_at from Supabase Auth
      const verified = user.email_confirmed_at != null;
      setIsVerified(verified);

      // If not verified, send OTP automatically
      if (!verified && !otpSent) {
        await supabase.auth.signInWithOtp({
          email: userEmail,
          options: { shouldCreateUser: false },
        });
        setOtpSent(true);
        emit({
          event: "auth otp_sent",
          workspace_id: workspaceId,
          actor_id: actorId,
          properties: { data: { context: "workspace_entry" } },
        });
      }
    }
    checkVerification();
  }, []);

  async function handleVerified() {
    // After OTP verification, activate the workspace
    const { error } = await supabase
      .from("workspace")
      .update({ status: "active" })
      .eq("workspace_id", workspaceId);

    if (error) {
      console.error("Failed to activate workspace:", error);
    }

    setIsVerified(true);
  }

  // Still loading
  if (isVerified === null) return <>{children}</>;

  // Verified — render normally
  if (isVerified) return <>{children}</>;

  // Not verified — show overlay
  return (
    <>
      {children}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xl"
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              type: "spring",
              stiffness: 35,
              damping: 22,
              mass: 2.2,
            }}
            className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-card/80 p-8 shadow-xl backdrop-blur-xl"
          >
            <h2 className="mb-2 text-center text-xl font-heading">
              {t("otp.title")}
            </h2>

            <OtpVerificationForm
              email={userEmail}
              context="workspace_entry"
              onVerified={handleVerified}
              workspaceId={workspaceId}
              actorId={actorId}
            />
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
```

- [ ] **Step 2: Integrate VerificationGate into dashboard layout**

Find the dashboard layout file (likely `apps/web/src/app/dashboard/layout.tsx` or within DashboardShell) and wrap children with VerificationGate. Pass the user's email, workspace ID, and actor ID from the server component context.

```typescript
// In the dashboard layout server component, get user data:
const { data: { user } } = await supabase.auth.getUser();
const email = user?.email ?? "";
const verified = user?.email_confirmed_at != null;

// Only render gate if not verified:
{!verified ? (
  <VerificationGate
    workspaceId={workspaceId}
    userEmail={email}
    actorId={profileId}
  >
    {children}
  </VerificationGate>
) : (
  children
)}
```

- [ ] **Step 3: Verify typecheck**

```bash
pnpm --filter web typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/
git commit -m "feat(auth): add verification gate with OTP overlay

Dashboard shows OTP overlay for unverified users. Auto-sends code
on first visit. Activates workspace on successful verification.
Spring-animated overlay with glassmorphism backdrop.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: OTP login on login page

**Files:**

- Modify: `apps/web/src/app/login/page.tsx`

- [ ] **Step 1: Add OTP login method to login page**

The login page currently has email+password and Google. Add a third option: "Send meg en kode".

Add state for auth method:

```typescript
const [authMethod, setAuthMethod] = useState<"password" | "otp">("password");
const [otpSent, setOtpSent] = useState(false);
```

Add a method switcher UI (tabs or buttons) above the form:

```typescript
<div className="flex gap-2 mb-4">
  <button
    onClick={() => setAuthMethod("password")}
    className={cn(
      "flex-1 py-2 text-sm rounded-lg transition-colors",
      authMethod === "password"
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:text-foreground"
    )}
  >
    {t("login.method.password")}
  </button>
  <button
    onClick={() => setAuthMethod("otp")}
    className={cn(
      "flex-1 py-2 text-sm rounded-lg transition-colors",
      authMethod === "otp"
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:text-foreground"
    )}
  >
    {t("login.method.otp")}
  </button>
</div>
```

- [ ] **Step 2: Add OTP send and verify logic**

When `authMethod === "otp"`, show email input + "Send kode" button. After sending, show `OtpVerificationForm`.

```typescript
async function handleSendOtp() {
  // Never reveal if email exists
  await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  setOtpSent(true);
  // Show same UI regardless of whether email exists
}

function handleOtpVerified() {
  setMode("logging-in");
  emit({
    event: "auth logged_in",
    workspace_id: null,
    actor_id: "anonymous",
    properties: { data: { method: "otp" } },
  });
  // Redirect after animation
  setTimeout(() => {
    window.location.href = "/dashboard";
  }, 1100);
}
```

- [ ] **Step 3: Conditionally render password form or OTP form**

```typescript
<AnimatePresence mode="wait">
  {authMethod === "password" ? (
    <motion.div key="password" /* existing password form */ />
  ) : otpSent ? (
    <motion.div key="otp-verify" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <OtpVerificationForm
        email={email}
        context="login"
        onVerified={handleOtpVerified}
      />
    </motion.div>
  ) : (
    <motion.div key="otp-send" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Email input + "Send kode" button */}
      <p className="text-sm text-muted-foreground mb-2">
        {t("login.otp.description")}
      </p>
      <button onClick={handleSendOtp} /* ... */ >
        {t("login.method.sendCode")}
      </button>
    </motion.div>
  )}
</AnimatePresence>
```

- [ ] **Step 4: Add "never reveal email existence" pattern**

After `handleSendOtp`, always show the same UI message:

```typescript
// In the OTP tab, after sending:
<p className="text-sm text-muted-foreground">
  {t("otp.ifExists")}  {/* "Hvis denne e-posten finnes, har vi sendt en kode" */}
</p>
```

- [ ] **Step 5: Add i18n keys**

Add to `packages/i18n/locales/nb/auth.json`:

```json
{
  "login.method.password": "E-post og passord",
  "login.method.otp": "Engangskode",
  "login.method.sendCode": "Send kode",
  "login.otp.description": "Vi sender en engangskode til e-posten din"
}
```

- [ ] **Step 6: Verify typecheck**

```bash
pnpm --filter web typecheck
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/login/ packages/i18n/
git commit -m "feat(auth): add OTP login method to login page

Three auth methods: password, OTP code, Google. Tab-based method
switching with AnimatePresence transitions. Never reveals email
existence on OTP send.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Rate limiting hardening

**Files:**

- Modify: `apps/web/src/lib/rate-limit.ts`

- [ ] **Step 1: Add per-email rate limiter and fail-closed auth limiter**

```typescript
// Add new rate limiter factories:

let _otpRateLimit: Ratelimit | null | undefined;
let _workspaceCreateRateLimit: Ratelimit | null | undefined;

export function getOtpRateLimit(): Ratelimit | null {
  if (_otpRateLimit === undefined) {
    const redis = createRedis();
    _otpRateLimit = redis
      ? new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(3, "900 s"), // 3 per 15 min
          analytics: true,
          prefix: "smartout:otp",
        })
      : null;
  }
  return _otpRateLimit;
}

export function getWorkspaceCreateRateLimit(): Ratelimit | null {
  if (_workspaceCreateRateLimit === undefined) {
    const redis = createRedis();
    _workspaceCreateRateLimit = redis
      ? new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(3, "3600 s"), // 3 per hour
          analytics: true,
          prefix: "smartout:workspace-create",
        })
      : null;
  }
  return _workspaceCreateRateLimit;
}

// Fail-closed wrapper for auth-critical rate limiting
export async function checkAuthRateLimit(
  identifier: string,
): Promise<{ allowed: boolean; remaining: number }> {
  const limiter = getAuthRateLimit();
  if (!limiter) {
    // FAIL-CLOSED: if Redis is unavailable, block auth requests
    console.error("[rate-limit] Redis unavailable — blocking auth request (fail-closed)");
    return { allowed: false, remaining: 0 };
  }
  const result = await limiter.limit(identifier);
  return { allowed: result.success, remaining: result.remaining };
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm --filter web typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/rate-limit.ts
git commit -m "feat(auth): add OTP and workspace-create rate limiters

OTP: 3/15min per email. Workspace create: 3/hour per IP. Auth rate
limiter is now fail-closed (blocks if Redis unavailable).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Middleware sandbox enforcement

**Files:**

- Modify: `apps/web/src/middleware.ts`

- [ ] **Step 1: Add sandbox route blocking**

After the auth session check (around line 166), add sandbox enforcement. Query workspace status and block restricted routes for sandbox workspaces.

```typescript
// After updateSession(), before the response is returned:

// Sandbox enforcement for workspace routes
if (routeType === "workspace" && user) {
  const workspaceSlug = /* extract from subdomain */;

  // Check workspace status (cached for 30s like godmode)
  const isSandbox = await checkWorkspaceSandbox(supabase, workspaceSlug);

  if (isSandbox) {
    const SANDBOX_BLOCKED_ROUTES = new Set([
      "/dashboard/settings/integrations",
      "/dashboard/settings/api-keys",
      "/dashboard/team/invite",
      "/dashboard/export",
      "/api/onboarding-agent",
      // Add other restricted routes
    ]);

    const isBlocked = [...SANDBOX_BLOCKED_ROUTES].some((route) =>
      pathname.startsWith(route),
    );

    if (isBlocked) {
      // Emit sandbox blocked event and redirect to dashboard
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }
}
```

Add the cache function (similar to godmode cache pattern):

```typescript
const SANDBOX_CACHE = new Map<string, { result: boolean; timestamp: number }>();
const SANDBOX_CACHE_TTL_MS = 30_000;

async function checkWorkspaceSandbox(supabase: SupabaseClient, slug: string): Promise<boolean> {
  const cached = SANDBOX_CACHE.get(slug);
  if (cached && Date.now() - cached.timestamp < SANDBOX_CACHE_TTL_MS) {
    return cached.result;
  }

  const { data } = await supabase.from("workspace").select("status").eq("slug", slug).single();

  const isSandbox = data?.status === "sandbox";
  SANDBOX_CACHE.set(slug, { result: isSandbox, timestamp: Date.now() });
  return isSandbox;
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm --filter web typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/middleware.ts
git commit -m "feat(auth): add sandbox route enforcement in middleware

Blocks integrations, API keys, invitations, export, and agent routes
for sandbox workspaces. 30-second cache to minimize DB lookups.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Sandbox cleanup Edge Function

**Files:**

- Create: `supabase/functions/cleanup-sandbox-workspaces/index.ts`

- [ ] **Step 1: Create cleanup Edge Function**

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WATCHDOG_CRON_SECRET = Deno.env.get("WATCHDOG_CRON_SECRET");

Deno.serve(async (req) => {
  // Auth: must have watchdog secret
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || authHeader !== `Bearer ${WATCHDOG_CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Find expired sandbox workspaces
  const { data: expiredWorkspaces, error: findError } = await supabase
    .from("workspace")
    .select("workspace_id, created_at")
    .eq("status", "sandbox")
    .lt("verification_deadline", new Date().toISOString());

  if (findError) {
    console.error("Failed to find expired sandboxes:", findError);
    return new Response(JSON.stringify({ error: findError.message }), { status: 500 });
  }

  if (!expiredWorkspaces?.length) {
    return new Response(JSON.stringify({ cleaned: 0 }), { status: 200 });
  }

  let cleaned = 0;
  const errors: string[] = [];

  for (const ws of expiredWorkspaces) {
    try {
      // Get the user who owns this workspace
      const { data: members } = await supabase
        .from("company_member")
        .select("user_id, company_id")
        .eq("workspace_id", ws.workspace_id);

      // Delete workspace (CASCADE handles engine tables)
      const { error: deleteError } = await supabase
        .from("workspace")
        .delete()
        .eq("workspace_id", ws.workspace_id);

      if (deleteError) throw deleteError;

      // Delete orphaned users (only if they have no other workspaces)
      for (const member of members ?? []) {
        const { count } = await supabase
          .from("company_member")
          .select("*", { count: "exact", head: true })
          .eq("user_id", member.user_id);

        if (count === 0) {
          // No other workspaces — delete the user
          const { error: userDeleteError } = await supabase.auth.admin.deleteUser(member.user_id);
          if (userDeleteError) {
            console.warn(`Failed to delete user ${member.user_id}:`, userDeleteError);
          }
        }
      }

      cleaned++;
      console.log(`Cleaned sandbox workspace ${ws.workspace_id} (created ${ws.created_at})`);
    } catch (err) {
      const msg = `Failed to clean workspace ${ws.workspace_id}: ${err}`;
      console.error(msg);
      errors.push(msg);
    }
  }

  return new Response(
    JSON.stringify({ cleaned, errors: errors.length, total: expiredWorkspaces.length }),
    { status: errors.length > 0 ? 207 : 200 },
  );
});
```

- [ ] **Step 2: Add to config.toml (verify_jwt = false)**

Add to `supabase/functions/config.toml`:

```toml
[cleanup-sandbox-workspaces]
verify_jwt = false
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/cleanup-sandbox-workspaces/ supabase/functions/config.toml
git commit -m "feat(auth): add sandbox cleanup Edge Function

Cron-triggered cleanup of expired sandbox workspaces. Deletes
workspace (CASCADE handles engine tables), then orphaned users.
Auth via WATCHDOG_CRON_SECRET.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Auth security protocol documentation

**Files:**

- Create: `docs/protocols/AUTH_SECURITY.md`

- [ ] **Step 1: Write the protocol document**

Create `docs/protocols/AUTH_SECURITY.md` with YAML frontmatter covering:

1. Complete auth flow (all three methods)
2. Sandbox rules (KAN/KAN IKKE)
3. Rate limit configurations (all three layers with exact values)
4. Cleanup routines (what, when, how)
5. Monitoring triggers and alert criteria
6. Weekly audit checklist
7. Escalation matrix
8. Incident response for auth events

This is operational documentation — how the system works in production, not a design spec.

- [ ] **Step 2: Commit**

```bash
git add docs/protocols/AUTH_SECURITY.md
git commit -m "docs(auth): add operational security protocol

Covers auth flows, sandbox rules, rate limiting, cleanup, monitoring,
weekly audit checklist, and escalation matrix. Living document.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Final typecheck and integration test

**Files:** None (verification only)

- [ ] **Step 1: Full typecheck**

```bash
pnpm typecheck
```

Expected: 0 errors across all packages.

- [ ] **Step 2: Verify login page works**

Start dev server, navigate to `/login`:

- Email + password login works as before
- New OTP tab appears
- "Send kode" button is functional
- OTP input renders correctly

- [ ] **Step 3: Verify join wizard works**

Navigate to `/join`:

- Step 1 now has password + confirm password fields
- After entering email + password, silent signUp occurs
- Steps 2-5 work normally with authenticated session
- Step 6 is now a summary/review

- [ ] **Step 4: Verify sandbox enforcement**

After completing wizard, dashboard should show OTP overlay.
Try navigating to a blocked route (settings/integrations) — should redirect.

- [ ] **Step 5: Commit council log**

```bash
git add docs/council/COUNCIL-LOG.md
git commit -m "docs(council): log auth security friction session

Council session 2026-03-29. Verdict: APPROVE WITH CHANGES. Key
findings: workspace.status column missing, email_verified belongs on
auth.users, engine FK CASCADE needed.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Implementation Order

```
Task 1  → Database migrations (foundation)
Task 2  → Config hardening (independent)
Task 3  → Telemetry registration (independent)
Task 4  → Silent auth in wizard (depends on Task 1)
Task 5  → OTP component (independent)
Task 6  → Verification gate (depends on Task 1, 5)
Task 7  → OTP login (depends on Task 5)
Task 8  → Rate limiting (independent)
Task 9  → Middleware sandbox (depends on Task 1)
Task 10 → Cleanup Edge Function (depends on Task 1)
Task 11 → Protocol docs (independent)
Task 12 → Integration verification (depends on all)
```

Tasks 1, 2, 3, 5, 8, 11 can run in parallel.
Tasks 4, 6, 7, 9, 10 depend on Task 1.
Task 12 runs last.
