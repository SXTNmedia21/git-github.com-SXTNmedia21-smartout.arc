---
title: "Engine Agent Runtime — Implementation Plan"
status: draft
updated: 2026-03-23
created: 2026-03-23
module: ai
tags: [engine, guardian, missions, journeys, ultravox, lise, botsson, implementation]
---

# Engine Agent Runtime Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire journeys into mission runtime so agents get full step-by-step context, Guardian orchestrates stage progression and coaches agents in real-time, and Botsson inherits context from completed onboarding sessions.

**Architecture:** Journey data (steps, timing, data requirements) is loaded at session start and injected into every stage prompt. A new Guardian evaluation loop monitors events and whispers corrections or auto-advances stages when journey criteria are met. Botsson reads completed session data + memories to personalize takeover.

**Tech Stack:** Hono (stage engine), Supabase (PostgreSQL), Zod, Ultravox (voice), TypeScript strict mode.

**Design doc:** `docs/plans/2026-03-23-engine-agent-runtime-design.md`

---

## Task 1: Database Migration — Journey Timing Fields

Add timing metadata to `journey_step` and tracking fields to `engine_sessions`.

**Files:**

- Create: `supabase/migrations/20260323100000_journey_timing_and_guardian_fields.sql`
- Modify: `packages/supabase/src/database.types.ts` (regenerate)

**Step 1: Write the migration**

```sql
-- Add timing fields to journey_step
ALTER TABLE journey_step
  ADD COLUMN min_duration_seconds integer,
  ADD COLUMN max_duration_seconds integer,
  ADD COLUMN required_confirmation boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN journey_step.min_duration_seconds IS 'Minimum seconds before Guardian auto-advances';
COMMENT ON COLUMN journey_step.max_duration_seconds IS 'Guardian nudges/timeouts after this many seconds';
COMMENT ON COLUMN journey_step.required_confirmation IS 'Explicit user confirmation needed before advancing';

-- Add journey tracking to engine_sessions
ALTER TABLE engine_sessions
  ADD COLUMN journey_id uuid REFERENCES journey(journey_id) ON DELETE SET NULL,
  ADD COLUMN stage_started_at timestamptz,
  ADD COLUMN guardian_whisper_count integer NOT NULL DEFAULT 0;

CREATE INDEX idx_engine_sessions_journey ON engine_sessions(journey_id) WHERE journey_id IS NOT NULL;

COMMENT ON COLUMN engine_sessions.journey_id IS 'Journey driving this session (copied from mission at creation)';
COMMENT ON COLUMN engine_sessions.stage_started_at IS 'When current stage began (for Guardian timing)';
COMMENT ON COLUMN engine_sessions.guardian_whisper_count IS 'Number of Guardian whispers sent this session';
```

**Step 2: Apply migration**

Run: `npx supabase db push` (or `npx supabase migration up` locally)

**Step 3: Regenerate types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

**Step 4: Commit**

```bash
git add supabase/migrations/20260323100000_journey_timing_and_guardian_fields.sql packages/supabase/src/database.types.ts
git commit -m "feat(engine): add journey timing fields and guardian tracking to sessions"
```

---

## Task 2: Update Session Types

Add new fields to the TypeScript types used by the stage engine.

**Files:**

- Modify: `services/stage-engine/src/types/session.ts` (lines 67–82 JourneyStep, lines 88–107 Session)

**Step 1: Update JourneyStep type**

In `services/stage-engine/src/types/session.ts`, add timing fields to JourneyStep (after line ~82):

```typescript
// Add to JourneyStep type:
export type JourneyStep = {
  journey_step_id: string;
  journey_id: string;
  workspace_id: string;
  step_order: number;
  title: string;
  action: string;
  expects: string | null;
  screen: string | null;
  component: string | null;
  data_reads: string[] | null;
  data_writes: string[] | null;
  notes: string | null;
  min_duration_seconds: number | null; // NEW
  max_duration_seconds: number | null; // NEW
  required_confirmation: boolean; // NEW
  created_at: string;
  updated_at: string;
};
```

**Step 2: Update Session type**

Add journey tracking fields to Session type (after line ~107):

```typescript
// Add to Session type:
export type Session = {
  // ... existing fields ...
  journey_id: string | null; // NEW
  stage_started_at: string | null; // NEW
  guardian_whisper_count: number; // NEW
};
```

**Step 3: Commit**

```bash
git add services/stage-engine/src/types/session.ts
git commit -m "feat(engine): add journey timing and guardian fields to session types"
```

---

## Task 3: Enrich Session Creation with Journey Context

When a mission has a linked journey, load all steps and inject enriched context into the session.

**Files:**

- Modify: `services/stage-engine/src/core/session-manager.ts` (createSession ~line 172, loadMission ~line 57)

**Step 1: Enhance journey context building in createSession**

Currently lines 192–205 build a basic journey context. Replace with enriched version:

```typescript
// In createSession, after loading mission (around line 192):
// Replace existing journey context building with:

let journeySteps: JourneyStep[] = [];
if (missionData.mission.journey_id) {
  const { data: steps } = await supabaseAdmin
    .from("journey_step")
    .select("*")
    .eq("journey_id", missionData.mission.journey_id)
    .order("step_order", { ascending: true });

  journeySteps = (steps ?? []) as JourneyStep[];
}

// Build enriched journey context
const journeyContext = missionData.journey
  ? {
      journey_id: missionData.mission.journey_id,
      journey_title: missionData.journey.title,
      journey_code: missionData.journey.code,
      total_steps: journeySteps.length,
      steps: journeySteps.map((s) => ({
        step_order: s.step_order,
        title: s.title,
        action: s.action,
        expects: s.expects,
        screen: s.screen,
        component: s.component,
        data_writes: s.data_writes ?? [],
        data_reads: s.data_reads ?? [],
        min_duration_seconds: s.min_duration_seconds,
        max_duration_seconds: s.max_duration_seconds,
        required_confirmation: s.required_confirmation,
      })),
    }
  : null;

// Merge into session context
const sessionContext = {
  ...identityContext,
  ...(req.context ?? {}),
  ...(journeyContext ? { journey: journeyContext } : {}),
};
```

**Step 2: Set journey_id and stage_started_at on session insert**

In the session insert (around line 210), add:

```typescript
// Add to insert payload:
journey_id: missionData.mission.journey_id ?? null,
stage_started_at: new Date().toISOString(),
guardian_whisper_count: 0,
```

**Step 3: Commit**

```bash
git add services/stage-engine/src/core/session-manager.ts
git commit -m "feat(engine): enrich session creation with full journey step context"
```

---

## Task 4: Inject Journey Step into Stage Prompts

When building a stage prompt, include the linked journey step's expectations, screen, and data requirements.

**Files:**

- Modify: `services/stage-engine/src/core/prompt-builder.ts` (buildStagePrompt ~line 23)

**Step 1: Add journey step section to prompt builder**

After the context section (~line 67) and before collected data (~line 71), add a journey step block:

```typescript
// After context section, add journey step enrichment:
const journeyStep = context.journeyStep as Record<string, unknown> | undefined;
if (journeyStep) {
  sections.push(`\n--- AKTUELT JOURNEY-STEG ---`);
  sections.push(
    `Steg ${journeyStep.step_order} av ${context.journey_total_steps ?? "?"}: "${journeyStep.title}"`,
  );
  if (journeyStep.action) sections.push(`Brukerens handling: ${journeyStep.action}`);
  if (journeyStep.expects) sections.push(`Forventet resultat: ${journeyStep.expects}`);
  if (journeyStep.screen) sections.push(`Brukerens skjerm: ${journeyStep.screen}`);
  if (journeyStep.component) sections.push(`UI-komponent: ${journeyStep.component}`);
  const dataWrites = journeyStep.data_writes as string[] | undefined;
  if (dataWrites && dataWrites.length > 0) {
    sections.push(`Data du skal samle: ${dataWrites.join(", ")}`);
  }
  if (journeyStep.required_confirmation) {
    sections.push(`VIKTIG: Bruker MÅ eksplisitt bekrefte før du kan gå videre.`);
  }
}
```

**Step 2: Add progress context**

```typescript
// After journey step, add progress if available:
const journeyProgress = context.journey_progress as string | undefined;
if (journeyProgress) {
  sections.push(`Progresjon: ${journeyProgress}`);
}
```

**Step 3: Commit**

```bash
git add services/stage-engine/src/core/prompt-builder.ts
git commit -m "feat(engine): inject journey step context into stage prompts"
```

---

## Task 5: Enrich Stage Advancement with Journey + Timing

When advancing a stage, update stage_started_at and pass journey step data to the prompt builder.

**Files:**

- Modify: `services/stage-engine/src/core/stage-manager.ts` (advanceStage ~line 25)

**Step 1: Update stage_started_at on advance**

After the session update query that sets the new stage (~line 95), add:

```typescript
// After updating session with new stage, also update stage_started_at:
await supabaseAdmin
  .from("engine_sessions")
  .update({ stage_started_at: new Date().toISOString() })
  .eq("id", session.id);
```

**Step 2: Enrich stageContext with journey step and progress**

In the stage context building section (~line 108), enhance the journey step injection:

```typescript
// Build enriched stage context with journey step
const stageContext = { ...session.context };

if (nextStage.journey_step_id && session.journey_id) {
  const { data: journeyStep } = await supabaseAdmin
    .from("journey_step")
    .select("*")
    .eq("journey_step_id", nextStage.journey_step_id)
    .single();

  if (journeyStep) {
    stageContext.journeyStep = {
      step_order: journeyStep.step_order,
      title: journeyStep.title,
      action: journeyStep.action,
      expects: journeyStep.expects,
      screen: journeyStep.screen,
      component: journeyStep.component,
      data_writes: journeyStep.data_writes ?? [],
      data_reads: journeyStep.data_reads ?? [],
      min_duration_seconds: journeyStep.min_duration_seconds,
      max_duration_seconds: journeyStep.max_duration_seconds,
      required_confirmation: journeyStep.required_confirmation,
    };

    // Add total steps count for prompt display
    const journeyCtx = session.context.journey as Record<string, unknown> | undefined;
    stageContext.journey_total_steps = journeyCtx?.total_steps ?? null;

    // Calculate progress
    const totalSteps = (journeyCtx?.total_steps as number) ?? 0;
    stageContext.journey_progress =
      totalSteps > 0 ? `${journeyStep.step_order}/${totalSteps} steg` : null;
  }
}
```

**Step 3: Commit**

```bash
git add services/stage-engine/src/core/stage-manager.ts
git commit -m "feat(engine): enrich stage advancement with journey step data and timing"
```

---

## Task 6: Guardian Evaluation Loop — Core Module

New module that evaluates active sessions against journey criteria and whispers corrections or auto-advances.

**Files:**

- Create: `services/stage-engine/src/core/guardian-evaluator.ts`

**Step 1: Create the evaluator module**

```typescript
// services/stage-engine/src/core/guardian-evaluator.ts
import { getAdminClient } from "../lib/supabase.js";
import { emitGuardianEvent } from "./guardian-bus.js";
import { advanceStage } from "./stage-manager.js";
import type { Session, JourneyStep } from "../types/session.js";

type EvaluationResult = {
  action: "none" | "advance" | "nudge" | "timeout" | "off_topic" | "silence";
  whisper?: string;
  details?: Record<string, unknown>;
};

/**
 * Evaluate a session against its journey criteria.
 * Called on events (data.collected, user.message, agent.response)
 * and periodically (every 30 seconds for active sessions).
 */
export async function evaluateSession(sessionId: string): Promise<EvaluationResult> {
  const supabase = getAdminClient();

  // Load session
  const { data: session } = await supabase
    .from("engine_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("status", "active")
    .single();

  if (!session) return { action: "none" };
  if (!session.journey_id) return { action: "none" };

  // Load current stage's linked journey step
  const { data: stages } = await supabase
    .from("engine_stages")
    .select("*")
    .eq("mission_id", session.mission_id)
    .order("stage_order", { ascending: true });

  const currentStage = stages?.find((s) => s.stage_id === session.current_stage_id);
  if (!currentStage?.journey_step_id) return { action: "none" };

  const { data: journeyStep } = await supabase
    .from("journey_step")
    .select("*")
    .eq("journey_step_id", currentStage.journey_step_id)
    .single();

  if (!journeyStep) return { action: "none" };

  const collected = (session.collected_data ?? {}) as Record<string, unknown>;
  const stageStarted = session.stage_started_at
    ? new Date(session.stage_started_at)
    : new Date(session.created_at);
  const elapsedSeconds = (Date.now() - stageStarted.getTime()) / 1000;

  // 1. Check data completeness
  const requiredFields = (journeyStep.data_writes as string[]) ?? [];
  const missing = requiredFields.filter((field) => !hasNestedValue(collected, field));

  if (missing.length === 0) {
    // All data collected — check minimum time
    const minDuration = journeyStep.min_duration_seconds ?? 0;
    if (elapsedSeconds >= minDuration) {
      // Check if confirmation is required
      if (journeyStep.required_confirmation) {
        // Don't auto-advance, but nudge if user hasn't confirmed
        if (elapsedSeconds > minDuration + 30) {
          return whisperToSession(
            session,
            sessionId,
            "Alle data er samlet. Spør bruker om bekreftelse før du går videre.",
            "guardian.nudge_confirm",
          );
        }
        return { action: "none" };
      }

      // Auto-advance!
      try {
        await advanceStage(session as Session, {});
        emitGuardianEvent({
          session_id: sessionId,
          workspace_id: session.workspace_id,
          event_type: "guardian.auto_advance",
          actor: "guardian",
          summary: `Auto-advanced past "${journeyStep.title}" — all required data collected`,
          data: { journey_step: journeyStep.title, elapsed_seconds: Math.round(elapsedSeconds) },
        });
        return { action: "advance", details: { step: journeyStep.title } };
      } catch {
        return { action: "none" };
      }
    }
  }

  // 2. Hard timeout
  const maxDuration = journeyStep.max_duration_seconds;
  if (maxDuration && elapsedSeconds > maxDuration) {
    return whisperToSession(
      session,
      sessionId,
      `Timeout på "${journeyStep.title}". Avslutt steget og gå videre. Sakner: ${missing.join(", ")}`,
      "guardian.timeout",
    );
  }

  // 3. Timeout warning (80%)
  if (maxDuration && elapsedSeconds > maxDuration * 0.8) {
    const remaining = Math.round(maxDuration - elapsedSeconds);
    return whisperToSession(
      session,
      sessionId,
      `${remaining} sekunder igjen på "${journeyStep.title}". Sakner: ${missing.join(", ")}`,
      "guardian.timeout_warning",
    );
  }

  // 4. Missing field nudge (after 60s)
  if (elapsedSeconds > 60 && missing.length > 0) {
    return whisperToSession(session, sessionId, `Spør om: ${missing.join(", ")}`, "guardian.nudge");
  }

  return { action: "none" };
}

/**
 * Write a whisper to the session and emit a Guardian event.
 */
async function whisperToSession(
  session: Record<string, unknown>,
  sessionId: string,
  message: string,
  eventType: string,
): Promise<EvaluationResult> {
  const supabase = getAdminClient();

  // Append whisper to collected_data._whispers[]
  const collected = (session.collected_data ?? {}) as Record<string, unknown>;
  const whispers = (collected._whispers as string[]) ?? [];
  whispers.push(`[Guardian ${new Date().toISOString()}] ${message}`);

  await supabase
    .from("engine_sessions")
    .update({
      collected_data: { ...collected, _whispers: whispers },
      guardian_whisper_count: ((session.guardian_whisper_count as number) ?? 0) + 1,
    })
    .eq("id", sessionId);

  emitGuardianEvent({
    session_id: sessionId,
    workspace_id: session.workspace_id as string,
    event_type: eventType,
    actor: "guardian",
    summary: message,
    data: { whisper: message },
  });

  return { action: eventType.split(".")[1] as EvaluationResult["action"], whisper: message };
}

/**
 * Check if a nested field path has a value in collected data.
 * Supports: "company.name", "departments[]", "season.start_date"
 */
function hasNestedValue(obj: Record<string, unknown>, path: string): boolean {
  // Handle array notation: "departments[]" means array with at least one element
  if (path.endsWith("[]")) {
    const key = path.slice(0, -2);
    const val = getNestedValue(obj, key);
    return Array.isArray(val) && val.length > 0;
  }

  const val = getNestedValue(obj, path);
  return val !== undefined && val !== null && val !== "";
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Run evaluation loop for all active sessions with journeys.
 * Called on a timer (every 30 seconds).
 */
export async function evaluateAllActiveSessions(): Promise<void> {
  const supabase = getAdminClient();

  const { data: sessions } = await supabase
    .from("engine_sessions")
    .select("id")
    .eq("status", "active")
    .not("journey_id", "is", null);

  if (!sessions || sessions.length === 0) return;

  // Evaluate each (sequentially to avoid overwhelming DB)
  for (const session of sessions) {
    try {
      await evaluateSession(session.id);
    } catch (err) {
      console.error(`Guardian eval failed for session ${session.id}:`, err);
    }
  }
}
```

**Step 2: Commit**

```bash
git add services/stage-engine/src/core/guardian-evaluator.ts
git commit -m "feat(engine): add Guardian evaluation loop for journey-driven sessions"
```

---

## Task 7: Wire Guardian Evaluator into Stage Engine

Hook the evaluator into events and the cleanup interval.

**Files:**

- Modify: `services/stage-engine/src/index.ts` (~line 72, cleanup interval)
- Modify: `services/stage-engine/src/routes/store.ts` (~line 78, after guardian event)
- Modify: `services/stage-engine/src/routes/adapters/ultravox.ts` (~line 156, after data collected)

**Step 1: Add evaluator to cleanup interval**

In `index.ts`, import and add to the interval (around line 72):

```typescript
import { evaluateAllActiveSessions } from "./core/guardian-evaluator.js";

// In the cleanup interval section, add a separate 30s interval:
setInterval(async () => {
  try {
    await evaluateAllActiveSessions();
  } catch (err) {
    console.error("Guardian evaluation loop error:", err);
  }
}, 30_000); // Every 30 seconds
```

**Step 2: Trigger evaluation after data.collected in store.ts**

After the guardian event emission (~line 78 in store.ts):

```typescript
import { evaluateSession } from "../core/guardian-evaluator.js";

// After emitGuardianEvent for data.collected:
// Fire evaluation (non-blocking)
evaluateSession(sessionId).catch((err) => console.error("Guardian eval after store:", err));
```

**Step 3: Trigger evaluation after voice data collected in ultravox.ts**

After data collected event in the Ultravox store handler (~line 156):

```typescript
import { evaluateSession } from "../../core/guardian-evaluator.js";

// After emitGuardianEvent for data.collected:
evaluateSession(sessionId).catch((err) => console.error("Guardian eval after voice store:", err));
```

**Step 4: Commit**

```bash
git add services/stage-engine/src/index.ts services/stage-engine/src/routes/store.ts services/stage-engine/src/routes/adapters/ultravox.ts
git commit -m "feat(engine): wire Guardian evaluator into events and cleanup interval"
```

---

## Task 8: Deliver Whispers via Fetch

When an agent calls fetch, include pending Guardian whispers in the response.

**Files:**

- Modify: `services/stage-engine/src/routes/fetch.ts` (~line 57, context query type)

**Step 1: Include whispers in context and stage responses**

In the fetch handler, after loading session data, for query_type "context" and "stage":

```typescript
// In the context query type handler:
// After building response data, add whispers if present:
const whispers = (session.collected_data as Record<string, unknown>)?._whispers as
  | string[]
  | undefined;
if (whispers && whispers.length > 0) {
  responseData._guardian_whispers = whispers;

  // Clear whispers after delivery (agent has seen them)
  const collected = { ...(session.collected_data as Record<string, unknown>) };
  delete collected._whispers;
  await supabaseAdmin
    .from("engine_sessions")
    .update({ collected_data: collected })
    .eq("id", sessionId);
}
```

**Step 2: Commit**

```bash
git add services/stage-engine/src/routes/fetch.ts
git commit -m "feat(engine): deliver Guardian whispers via fetch endpoint and clear after delivery"
```

---

## Task 9: Ultravox Voice Integration — Journey Context Tool

Add a 4th tool to Ultravox calls that lets the agent request journey context mid-conversation.

**Files:**

- Modify: `services/stage-engine/src/lib/ultravox.ts` (buildUltravoxTools ~line 60)

**Step 1: Add getJourneyContext tool**

After the existing 3 tools in buildUltravoxTools, add:

```typescript
// 4th tool: getJourneyContext
{
  temporaryTool: {
    modelToolName: "getJourneyContext",
    description: "Get the current journey step details including what data to collect, what screen the user is on, and what to expect. Call this when you need to check what you should be doing.",
    dynamicParameters: [
      {
        name: "include_progress",
        location: "PARAMETER_LOCATION_BODY",
        schema: { type: "boolean", description: "Include overall progress info" },
        required: false,
      },
    ],
    http: {
      baseUrlPattern: `${engineUrl}/adapters/ultravox/fetch`,
      httpMethod: "POST",
    },
    automaticParameters: [
      ...staticParams,
      {
        name: "query_type",
        location: "PARAMETER_LOCATION_BODY",
        value: "context",
      },
    ],
  },
},
```

**Step 2: Commit**

```bash
git add services/stage-engine/src/lib/ultravox.ts
git commit -m "feat(engine): add getJourneyContext tool for Ultravox voice calls"
```

---

## Task 10: Botsson Context Transfer

When Botsson starts a session for a profile that completed onboarding, load Lise's session data.

**Files:**

- Modify: `services/stage-engine/src/core/agent-router.ts` (~line 92, context collection)
- Modify: `services/stage-engine/src/core/session-manager.ts` (createSession, for agent mode)

**Step 1: Add onboarding context loader function**

Create a helper in session-manager.ts:

```typescript
/**
 * Load completed onboarding data for a profile.
 * Used by Botsson to inherit Lise's collected data.
 */
export async function loadOnboardingContext(
  profileId: string,
  workspaceId: string,
): Promise<Record<string, unknown> | null> {
  const supabase = getAdminClient();

  // Find most recent completed onboarding session for this profile
  const { data: session } = await supabase
    .from("engine_sessions")
    .select("collected_data, created_at, completed_at, context")
    .eq("profile_id", profileId)
    .eq("workspace_id", workspaceId)
    .eq("status", "complete")
    .eq("mode", "mission")
    .not("journey_id", "is", null)
    .order("completed_at", { ascending: false })
    .limit(1)
    .single();

  if (!session) return null;

  return {
    prior_onboarding: {
      collected_data: session.collected_data,
      completed_at: session.completed_at,
      created_at: session.created_at,
    },
  };
}
```

**Step 2: Inject onboarding context in agent-router.ts**

In routeAgentMessage, before building the prompt (~line 92):

```typescript
import { loadOnboardingContext } from "./session-manager.js";

// After collectContext, check for onboarding data:
const onboardingCtx = await loadOnboardingContext(input.profileId, input.workspaceId);
if (onboardingCtx) {
  ctx.priorOnboarding = onboardingCtx.prior_onboarding;
}
```

**Step 3: Commit**

```bash
git add services/stage-engine/src/core/session-manager.ts services/stage-engine/src/core/agent-router.ts
git commit -m "feat(engine): Botsson inherits onboarding context from completed Lise sessions"
```

---

## Task 11: Seed Onboarding Journey + Link to Mission

Create the journey definition for onboarding and link it to the existing onboarding-interview mission.

**Files:**

- Create: `supabase/migrations/20260323200000_seed_onboarding_journey.sql`

**Step 1: Write the seed migration**

```sql
-- Insert onboarding journey (workspace-agnostic seed, will be copied per workspace)
-- This is the PoC journey for Lise onboarding

-- Note: journey_id and journey_step_id use gen_random_uuid()
-- In production, each workspace gets its own copy via workspace setup

DO $$
DECLARE
  v_journey_id uuid := gen_random_uuid();
  v_step1_id uuid := gen_random_uuid();
  v_step2_id uuid := gen_random_uuid();
  v_step3_id uuid := gen_random_uuid();
  v_step4_id uuid := gen_random_uuid();
BEGIN
  -- Only insert if no onboarding journey exists yet (idempotent)
  IF NOT EXISTS (SELECT 1 FROM journey WHERE code = 'J-ONBOARD-001' LIMIT 1) THEN

    INSERT INTO journey (
      journey_id, code, title, slug, module, actor, platform, priority, status,
      trigger_description, preconditions, test_assertion,
      doc_title, outcomes_success, outcomes_error
    ) VALUES (
      v_journey_id,
      'J-ONBOARD-001',
      'New Workspace Onboarding via Lise',
      'new-workspace-onboarding',
      'onboarding',
      'admin',
      'desktop',
      'P0',
      'active',
      'Admin starts onboarding wizard for first time',
      ARRAY['User has created a Smartout account', 'User has created a company'],
      'Workspace has company info, at least one season, and at least one department',
      'Ny arbeidsplass — onboarding med Lise',
      'Workspace er ferdig satt opp med bedriftsinfo, sesong og avdelinger',
      'Bruker kan alltid prøve igjen — data som er samlet blir lagret'
    );

    -- Step 1: Bedriftsinfo
    INSERT INTO journey_step (
      journey_step_id, journey_id, step_order, title, action, expects,
      screen, component, data_writes, data_reads,
      min_duration_seconds, max_duration_seconds, required_confirmation
    ) VALUES (
      v_step1_id, v_journey_id, 1,
      'Bli kjent og bedriftsinfo',
      'Presentér deg og oppgi bedriftens navn, adresse, telefon og org.nummer',
      'Lise fyller inn bedriftsinfo i UI via updateBusiness-verktøy',
      '/onboarding/business', 'BusinessSection',
      ARRAY['company.name', 'company.address', 'company.phone'],
      ARRAY['company.org_number'],
      30, 300, false
    );

    -- Step 2: Sesong
    INSERT INTO journey_step (
      journey_step_id, journey_id, step_order, title, action, expects,
      screen, component, data_writes, data_reads,
      min_duration_seconds, max_duration_seconds, required_confirmation
    ) VALUES (
      v_step2_id, v_journey_id, 2,
      'Sesong',
      'Fortell om årets sesonger, datoer og forventet omsetning',
      'Lise oppretter sesong med navn, start/sluttdato via updateSeason-verktøy',
      '/onboarding/season', 'SeasonSection',
      ARRAY['season.name', 'season.start_date', 'season.end_date'],
      NULL,
      20, 300, false
    );

    -- Step 3: Avdelinger
    INSERT INTO journey_step (
      journey_step_id, journey_id, step_order, title, action, expects,
      screen, component, data_writes, data_reads,
      min_duration_seconds, max_duration_seconds, required_confirmation
    ) VALUES (
      v_step3_id, v_journey_id, 3,
      'Avdelinger og team',
      'Beskriv avdelingene og hvem som leder dem',
      'Lise legger til avdelinger via addDepartments-verktøy',
      '/onboarding/departments', 'DepartmentsSection',
      ARRAY['departments[]'],
      NULL,
      20, 300, false
    );

    -- Step 4: Avslutning
    INSERT INTO journey_step (
      journey_step_id, journey_id, step_order, title, action, expects,
      screen, component, data_writes, data_reads,
      min_duration_seconds, max_duration_seconds, required_confirmation
    ) VALUES (
      v_step4_id, v_journey_id, 4,
      'Bekreft og avslutt',
      'Bekreft at all informasjon stemmer',
      'Oppsummering vises og brukeren overføres til dashboard',
      '/onboarding/done', 'DoneSection',
      NULL, NULL,
      10, 120, true
    );

    RAISE NOTICE 'Onboarding journey created: %', v_journey_id;
  END IF;
END $$;
```

**Step 2: Commit**

```bash
git add supabase/migrations/20260323200000_seed_onboarding_journey.sql
git commit -m "feat(engine): seed onboarding journey with 4 steps for Lise PoC"
```

---

## Task 12: Typecheck and Verify

Run typecheck across the monorepo to ensure no type errors.

**Files:**

- None (verification only)

**Step 1: Typecheck**

Run: `pnpm turbo typecheck`

Expected: 0 errors in stage-engine and packages/ai

**Step 2: Fix any type errors**

If errors exist, fix them in the relevant files.

**Step 3: Commit fixes if any**

```bash
git commit -m "fix(engine): resolve type errors from journey runtime integration"
```

---

## Dependency Graph

```
Task 1 (migration)
  ├── Task 2 (types) ── depends on Task 1
  │     ├── Task 3 (session creation) ── depends on Task 2
  │     ├── Task 4 (prompt builder) ── depends on Task 2
  │     └── Task 5 (stage advancement) ── depends on Task 2
  │
  ├── Task 6 (guardian evaluator) ── depends on Task 2
  │     └── Task 7 (wire evaluator) ── depends on Task 6
  │
  ├── Task 8 (fetch whispers) ── depends on Task 6
  ├── Task 9 (ultravox tool) ── independent after Task 2
  └── Task 10 (botsson transfer) ── independent after Task 2

Task 11 (seed journey) ── depends on Task 1
Task 12 (typecheck) ── depends on all tasks
```

**Parallelizable groups:**

- After Task 2: Tasks 3, 4, 5, 6, 9, 10 can run in parallel
- After Task 6: Tasks 7, 8 can run in parallel
- Task 11 only depends on Task 1 (migration)
- Task 12 runs last

---

## Summary

| Task | What                                   | Key File                                | Depends On |
| ---- | -------------------------------------- | --------------------------------------- | ---------- |
| 1    | DB migration: timing + guardian fields | `supabase/migrations/20260323100000_*`  | —          |
| 2    | Update TypeScript types                | `types/session.ts`                      | 1          |
| 3    | Enrich session creation with journey   | `core/session-manager.ts`               | 2          |
| 4    | Inject journey step into prompts       | `core/prompt-builder.ts`                | 2          |
| 5    | Enrich stage advancement               | `core/stage-manager.ts`                 | 2          |
| 6    | Guardian evaluation loop (new)         | `core/guardian-evaluator.ts`            | 2          |
| 7    | Wire evaluator into events + timer     | `index.ts`, `store.ts`, `ultravox.ts`   | 6          |
| 8    | Deliver whispers via fetch             | `routes/fetch.ts`                       | 6          |
| 9    | Ultravox journey context tool          | `lib/ultravox.ts`                       | 2          |
| 10   | Botsson context transfer               | `session-manager.ts`, `agent-router.ts` | 2          |
| 11   | Seed onboarding journey                | `supabase/migrations/20260323200000_*`  | 1          |
| 12   | Typecheck verification                 | —                                       | all        |
