# Journey Portal Phase 2 — Agent & Output Generation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Journey Agent wizard (AI-guided journey definition via 6-phase conversation) and 4 output generators (E2E test, onboarding doc, Linear issue, Botsson script) so every journey produces 5 deliverables from a single definition.

**Architecture:** Follows existing AI agent pattern — API route in `apps/web`, agent logic in `packages/ai`, Supabase table for wizard session persistence. The wizard is a multi-turn conversation using OpenRouter + Claude Sonnet, with access to all existing journeys for deduplication and consistency. Output generators are pure functions that transform a Journey + Steps into formatted text. All UI lives under `/platform-admin/journeys/`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, shadcn/ui, Supabase PostgreSQL 17, Vercel AI SDK v6, OpenRouter (anthropic/claude-sonnet-4), Zod, Lucide icons.

---

## Task 1: Database Migration — Wizard Session Table

**Files:**

- Create: `supabase/migrations/20260301500000_journey_wizard_session.sql`

**Step 1: Write the migration SQL**

```sql
-- ============================================
-- Journey wizard session table.
-- Stores AI wizard conversations for defining new journeys.
-- Each session tracks the 6-phase wizard flow, persists
-- messages as JSONB, and builds up a draft journey progressively.
-- Connected to: journey table (journey_id set on completion)
-- ============================================

-- Wizard session status
CREATE TYPE wizard_session_status AS ENUM ('active', 'completed', 'abandoned');

-- Wizard phase progression
CREATE TYPE wizard_phase AS ENUM (
  'discovery',
  'classification',
  'steps',
  'testing',
  'documentation',
  'review'
);

-- Wizard session table
CREATE TABLE wizard_session (
  wizard_session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  journey_id uuid REFERENCES journey(journey_id) ON DELETE SET NULL,
  status wizard_session_status NOT NULL DEFAULT 'active',
  current_phase wizard_phase NOT NULL DEFAULT 'discovery',
  messages jsonb NOT NULL DEFAULT '[]',
  draft_journey jsonb NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL REFERENCES user_identity(user_identity_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Indexes
CREATE INDEX idx_wizard_session_workspace ON wizard_session(workspace_id);
CREATE INDEX idx_wizard_session_status ON wizard_session(status);
CREATE INDEX idx_wizard_session_created_by ON wizard_session(created_by);

-- Updated_at trigger
CREATE TRIGGER set_wizard_session_updated_at
  BEFORE UPDATE ON wizard_session
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE wizard_session ENABLE ROW LEVEL SECURITY;

-- Platform admin (godmode) full access
CREATE POLICY "godmode_wizard_session_all" ON wizard_session
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_identity WHERE user_identity_id = auth.uid() AND is_godmode = true)
  );

-- Workspace-scoped read access
CREATE POLICY "workspace_wizard_session_read" ON wizard_session
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );
```

**Step 2: Apply the migration**

Run: `npx supabase db reset`

Expected: Table `wizard_session` created with RLS policies and indexes.

**Step 3: Regenerate TypeScript types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

Expected: `wizard_session`, `wizard_session_status`, `wizard_phase` appear in `database.types.ts`.

**Step 4: Commit**

```bash
git add supabase/migrations/20260301500000_journey_wizard_session.sql packages/supabase/src/database.types.ts
git commit -m "feat(journey): add wizard_session table for AI journey definition"
```

---

## Task 2: TypeScript Types — Wizard Session + Output Types

**Files:**

- Modify: `packages/types/src/enums.ts` — add wizard enums
- Modify: `packages/types/src/journey.ts` — add wizard session + output types

**Step 1: Add wizard enums to `packages/types/src/enums.ts`**

Append after the existing journey enums:

```typescript
// Wizard session enums
export const WizardSessionStatusEnum = z.enum(["active", "completed", "abandoned"]);
export type WizardSessionStatus = z.infer<typeof WizardSessionStatusEnum>;

export const WizardPhaseEnum = z.enum([
  "discovery",
  "classification",
  "steps",
  "testing",
  "documentation",
  "review",
]);
export type WizardPhase = z.infer<typeof WizardPhaseEnum>;
```

**Step 2: Add wizard session and output types to `packages/types/src/journey.ts`**

Append after existing types:

```typescript
import {
  // ... existing imports ...
  WizardSessionStatusEnum,
  WizardPhaseEnum,
} from "./enums";

// ─── Wizard Session ──────────────────────────────────────
export const WizardSessionSchema = z.object({
  wizard_session_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  journey_id: z.string().uuid().nullable(),
  status: WizardSessionStatusEnum,
  current_phase: WizardPhaseEnum,
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
      phase: WizardPhaseEnum.optional(),
      timestamp: z.string(),
    }),
  ),
  draft_journey: z.record(z.unknown()),
  created_by: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
  completed_at: z.string().nullable(),
});
export type WizardSession = z.infer<typeof WizardSessionSchema>;

// ─── Wizard Message ──────────────────────────────────────
export type WizardMessage = {
  role: "user" | "assistant";
  content: string;
  phase?: WizardPhase;
  timestamp: string;
};

// ─── Draft Journey (progressive build during wizard) ─────
export type DraftJourney = {
  title?: string;
  slug?: string;
  module?: JourneyModule;
  actor?: JourneyActor;
  platform?: JourneyPlatform;
  priority?: JourneyPriority;
  tags?: string[];
  trigger_description?: string;
  preconditions?: string[];
  test_assertion?: string;
  doc_title?: string;
  outcomes_success?: string;
  outcomes_empty?: string;
  outcomes_error?: string;
  steps?: Array<{
    title: string;
    action: string;
    expects?: string;
    screen?: string;
    component?: string;
  }>;
};

// ─── Output Generator Types ──────────────────────────────
export type JourneyOutputType = "e2e" | "doc" | "linear" | "botsson";

export type JourneyOutput = {
  type: JourneyOutputType;
  content: string;
  generated_at: string;
};
```

**Step 3: Run typecheck**

Run: `pnpm typecheck`

Expected: PASS.

**Step 4: Commit**

```bash
git add packages/types/src/enums.ts packages/types/src/journey.ts
git commit -m "feat(types): add wizard session, draft journey, and output types"
```

---

## Task 3: Journey Agent — System Prompt + Tools

**Files:**

- Create: `packages/ai/src/agents/journey.ts`
- Create: `packages/ai/src/tools/journey/index.ts`
- Create: `packages/ai/src/tools/journey/lookup-journeys.ts`
- Create: `packages/ai/src/tools/journey/save-draft.ts`
- Create: `packages/ai/src/tools/journey/check-duplicates.ts`
- Create: `packages/ai/src/tools/journey/types.ts`
- Modify: `packages/ai/src/index.ts` — export journey tools

**Step 1: Write the tool context type**

File: `packages/ai/src/tools/journey/types.ts`

```typescript
// ============================================
// types.ts — Journey Agent Tool Context
// Defines the context object passed to all journey agent tools.
// Contains the Supabase admin client, workspace ID, and session ID
// so tools can read/write journey data during the wizard flow.
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";
import type { DraftJourney, WizardPhase } from "@smartout/types";

/**
 * Context passed to every journey agent tool.
 * Provides database access and session state needed
 * by the tool functions.
 */
export type JourneyToolContext = {
  supabase: SupabaseClient<Database>;
  workspaceId: string;
  sessionId: string;
  currentPhase: WizardPhase;
  draftJourney: DraftJourney;
};
```

**Step 2: Write the lookup-journeys tool**

File: `packages/ai/src/tools/journey/lookup-journeys.ts`

```typescript
// ============================================
// lookup-journeys.ts — Look Up Existing Journeys
// Allows the journey agent to search and browse existing
// journeys in the workspace. Used for finding related journeys,
// checking module coverage, and understanding what already exists.
// Connected to: journey table
// ============================================

import { z } from "zod";
import { defineTool } from "../../types";
import type { JourneyToolContext } from "./types";

export const lookupJourneys = defineTool({
  name: "lookup_journeys",
  description:
    "Search existing journeys by module, actor, keyword, or code. " +
    "Use this to find related journeys, check for gaps, and understand " +
    "what already exists before defining new ones.",
  schema: z.object({
    module: z.string().optional().describe("Filter by module name"),
    actor: z.string().optional().describe("Filter by actor type"),
    keyword: z.string().optional().describe("Search title and trigger_description"),
    limit: z.number().int().min(1).max(20).default(10).describe("Max results"),
  }),

  /**
   * Queries the journey table with optional filters.
   * Returns a formatted list of matching journeys with code, title, module, status.
   */
  async execute({ module, actor, keyword, limit }, ctx: JourneyToolContext) {
    let query = ctx.supabase
      .from("journey")
      .select("code, title, module, actor, status, priority, slug")
      .eq("workspace_id", ctx.workspaceId)
      .order("code", { ascending: true })
      .limit(limit);

    if (module) query = query.eq("module", module);
    if (actor) query = query.eq("actor", actor);
    if (keyword)
      query = query.or(`title.ilike.%${keyword}%,trigger_description.ilike.%${keyword}%`);

    const { data, error } = await query;

    if (error) return `Error looking up journeys: ${error.message}`;
    if (!data || data.length === 0) return "No matching journeys found.";

    const rows = data.map(
      (j) => `${j.code} | ${j.title} | ${j.module} | ${j.actor} | ${j.status} | ${j.priority}`,
    );

    return `Found ${data.length} journeys:\nCode | Title | Module | Actor | Status | Priority\n${rows.join("\n")}`;
  },
});
```

**Step 3: Write the check-duplicates tool**

File: `packages/ai/src/tools/journey/check-duplicates.ts`

```typescript
// ============================================
// check-duplicates.ts — Check for Duplicate Journeys
// Searches existing journeys for potential duplicates based
// on title similarity, same module+actor combination, or
// overlapping trigger descriptions.
// Connected to: journey table
// ============================================

import { z } from "zod";
import { defineTool } from "../../types";
import type { JourneyToolContext } from "./types";

export const checkDuplicates = defineTool({
  name: "check_duplicates",
  description:
    "Check if a proposed journey might duplicate an existing one. " +
    "Pass the draft title, module, and actor to find potential overlaps. " +
    "Always call this before saving a new journey.",
  schema: z.object({
    title: z.string().describe("Proposed journey title"),
    module: z.string().describe("Proposed module"),
    actor: z.string().describe("Proposed actor"),
  }),

  /**
   * Checks for duplicates by searching same module+actor combinations
   * and doing a fuzzy title match. Returns warnings if potential
   * duplicates are found.
   */
  async execute({ title, module, actor }, ctx: JourneyToolContext) {
    // Check same module+actor journeys
    const { data: sameModuleActor } = await ctx.supabase
      .from("journey")
      .select("code, title, slug, status")
      .eq("workspace_id", ctx.workspaceId)
      .eq("module", module)
      .eq("actor", actor)
      .order("code", { ascending: true });

    // Check title similarity across all journeys
    const titleWords = title
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    const { data: allJourneys } = await ctx.supabase
      .from("journey")
      .select("code, title, module, actor")
      .eq("workspace_id", ctx.workspaceId);

    const titleMatches = (allJourneys ?? []).filter((j) => {
      const jTitle = j.title.toLowerCase();
      return titleWords.some((word) => jTitle.includes(word));
    });

    const parts: string[] = [];

    if (sameModuleActor && sameModuleActor.length > 0) {
      parts.push(
        `Same module (${module}) + actor (${actor}) — ${sameModuleActor.length} existing:\n` +
          sameModuleActor.map((j) => `  ${j.code}: ${j.title} [${j.status}]`).join("\n"),
      );
    }

    if (titleMatches.length > 0) {
      parts.push(
        `Title keyword overlap — ${titleMatches.length} matches:\n` +
          titleMatches.map((j) => `  ${j.code}: ${j.title} (${j.module}/${j.actor})`).join("\n"),
      );
    }

    if (parts.length === 0) {
      return "No potential duplicates found. Safe to proceed.";
    }

    return `POTENTIAL DUPLICATES:\n\n${parts.join("\n\n")}\n\nReview carefully before proceeding. Ask the user to confirm this is a new journey.`;
  },
});
```

**Step 4: Write the save-draft tool**

File: `packages/ai/src/tools/journey/save-draft.ts`

```typescript
// ============================================
// save-draft.ts — Save Draft Journey Progress
// Updates the wizard session's draft_journey and current_phase.
// Called by the agent after each phase to persist progress.
// Connected to: wizard_session table
// ============================================

import { z } from "zod";
import { defineTool } from "../../types";
import type { JourneyToolContext } from "./types";

export const saveDraft = defineTool({
  name: "save_draft",
  description:
    "Save the current draft journey state and optionally advance to the next phase. " +
    "Call this after collecting info in each phase to persist progress.",
  schema: z.object({
    draft: z.record(z.unknown()).describe("Updated draft journey object"),
    next_phase: z
      .enum(["discovery", "classification", "steps", "testing", "documentation", "review"])
      .optional()
      .describe("Phase to advance to (omit to stay in current phase)"),
  }),

  /**
   * Persists the draft journey to the wizard_session table
   * and optionally advances the phase.
   */
  async execute({ draft, next_phase }, ctx: JourneyToolContext) {
    const updates: Record<string, unknown> = {
      draft_journey: draft,
    };

    if (next_phase) {
      updates.current_phase = next_phase;
    }

    const { error } = await ctx.supabase
      .from("wizard_session")
      .update(updates)
      .eq("wizard_session_id", ctx.sessionId);

    if (error) return `Error saving draft: ${error.message}`;

    const phaseMsg = next_phase ? ` Advanced to phase: ${next_phase}.` : "";
    return `Draft saved successfully.${phaseMsg}`;
  },
});
```

**Step 5: Write the tools index**

File: `packages/ai/src/tools/journey/index.ts`

```typescript
// ============================================
// index.ts — Journey Agent Tool Exports
// Barrel export for all journey agent tools and context type.
// ============================================

export { lookupJourneys } from "./lookup-journeys";
export { checkDuplicates } from "./check-duplicates";
export { saveDraft } from "./save-draft";
export type { JourneyToolContext } from "./types";

import { lookupJourneys } from "./lookup-journeys";
import { checkDuplicates } from "./check-duplicates";
import { saveDraft } from "./save-draft";
import type { JourneyToolContext } from "./types";
import type { SmartoutTool } from "../../types";

/**
 * All tools available to the Journey Agent.
 */
export const JOURNEY_TOOLS: SmartoutTool<JourneyToolContext>[] = [
  lookupJourneys as SmartoutTool<JourneyToolContext>,
  checkDuplicates as SmartoutTool<JourneyToolContext>,
  saveDraft as SmartoutTool<JourneyToolContext>,
];
```

**Step 6: Write the journey agent**

File: `packages/ai/src/agents/journey.ts`

```typescript
// ============================================
// journey.ts — Journey Definition Agent
// AI agent that guides users through a 6-phase wizard
// to define new journeys. Uses tools to search existing
// journeys, check for duplicates, and persist draft state.
// Connected to: packages/ai/src/tools/journey/ (tools)
// Connected to: apps/web/src/app/api/journey-agent/route.ts (API route)
// ============================================

import { generateText, stepCountIs } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { toVercelTools } from "../adapters/vercel-ai";
import { JOURNEY_TOOLS } from "../tools/journey";
import type { SmartoutTool } from "../types";
import type { JourneyToolContext } from "../tools/journey/types";
import type { ModelMessage } from "ai";

/**
 * System prompt for the Journey Definition Agent.
 *
 * Why structured phases: Each phase collects specific data fields.
 * The agent enforces completeness before advancing.
 * The draft_journey grows progressively through the 6 phases.
 */
const SYSTEM_PROMPT = `Du er Journey Agent for Smartout — en AI-assistent som hjelper med å definere nye brukerreiser (journeys).

DIN ROLLE:
Du guider brukeren gjennom 6 faser for å definiere en komplett journey. Vær grundig, still gode oppfølgingsspørsmål, og bruk verktøyene aktivt.

DE 6 FASENE:

1. DISCOVERY (Oppdagelse)
   Mål: Forstå HVA brukeren skal kunne gjøre.
   Spør om: Hva er målet? Hvem er brukeren? Når skjer dette? Hva trigger det?
   Resultat: title, trigger_description

2. CLASSIFICATION (Klassifisering)
   Mål: Kategorisere journeyen korrekt.
   Foreslå: module, actor, platform, priority, tags
   Bruk check_duplicates for å sjekke overlapp.
   Bruk lookup_journeys for å se relaterte journeys.
   Resultat: module, actor, platform, priority, tags

3. STEPS (Steg)
   Mål: Definere steg-for-steg hva som skjer.
   For hvert steg: title, action, expects, screen, component
   Vær spesifikk — hvert steg er EN brukerhandling.
   Resultat: steps array

4. TESTING (Testing)
   Mål: Definere testverdier.
   Foreslå: test_assertion (en-linjers E2E-sjekk), preconditions
   Resultat: test_assertion, preconditions

5. DOCUMENTATION (Dokumentasjon)
   Mål: Norske titler og utfall.
   Foreslå: doc_title (norsk), outcomes_success, outcomes_empty, outcomes_error
   Resultat: doc_title, outcomes_success, outcomes_empty, outcomes_error

6. REVIEW (Gjennomgang)
   Mål: Vis komplett oversikt, be om bekreftelse.
   Vis alle felter formatert. Bruk save_draft for å lagre.
   Vent på brukerens godkjenning før du sier du er ferdig.

REGLER:
- ALLTID kall save_draft etter hver fase for å lagre fremgangen
- ALLTID kall check_duplicates i Classification-fasen
- ALLTID kall lookup_journeys for å finne relaterte journeys
- Snakk norsk med brukeren, men bruk engelske verdier for tekniske felt
- Foreslå verdier proaktivt — brukeren skal bekrefte/justere, ikke fylle inn fra scratch
- Vis fase-progresjon tydelig: "Fase 2/6: Klassifisering"
- Slug genereres automatisk fra title (lowercase, kebab-case)
- Code (J-XXX) tildeles ved lagring, ikke under wizard

SMARTOUT KONTEKST:
- 18 moduler: core, onboarding, org, scheduling, operations, haccp, training, absence, payroll, communication, reports, settings, ai, season, governance, contracts, certifications, meta
- 6 aktørtyper: employee, trainee, manager, admin, owner, all
- 3 plattformer: mobile, desktop, both
- 4 prioriteter: P0 (Critical), P1 (Important), P2 (Nice to have), P3 (Future)
- En journey er "en aktør som oppnår et mål gjennom en sekvens av steg"`;

/**
 * Creates an OpenRouter model instance for the journey agent.
 */
function getModel() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set.");
  }
  const openrouter = createOpenRouter({ apiKey });
  return openrouter("anthropic/claude-sonnet-4");
}

export type JourneyAgentInput = {
  ctx: JourneyToolContext;
  userMessage: string;
  conversationHistory: ModelMessage[];
};

export type JourneyAgentResult = {
  text: string;
  phase: string;
  draftUpdated: boolean;
};

/**
 * Runs the Journey Agent for one turn.
 *
 * Why generateText (not streaming): The wizard UI shows
 * complete responses per turn. The agent may call multiple
 * tools before responding. Streaming complicates tool result handling.
 *
 * @param input - User message, conversation history, and tool context
 * @returns Agent response text, current phase, and whether draft was updated
 */
export async function runJourneyAgent(input: JourneyAgentInput): Promise<JourneyAgentResult> {
  const model = getModel();
  const tools = toVercelTools(JOURNEY_TOOLS as SmartoutTool<JourneyToolContext>[], input.ctx);

  const messages: ModelMessage[] = [
    ...input.conversationHistory,
    { role: "user", content: input.userMessage },
  ];

  const result = await generateText({
    model,
    system: SYSTEM_PROMPT,
    messages,
    tools,
    stopWhen: stepCountIs(5),
  });

  // Check if save_draft was called to detect phase changes
  const draftUpdated = result.steps.some((step) =>
    step.toolCalls?.some((tc) => tc.toolName === "save_draft"),
  );

  return {
    text: result.text,
    phase: input.ctx.currentPhase,
    draftUpdated,
  };
}

// Re-export types used by API route
export type { ModelMessage } from "ai";
export type { JourneyToolContext } from "../tools/journey/types";
```

**Step 7: Add exports to `packages/ai/src/index.ts`**

Add after existing exports:

```typescript
// Journey tools
export { JOURNEY_TOOLS } from "./tools/journey";
export type { JourneyToolContext } from "./tools/journey";
```

**Step 8: Run typecheck**

Run: `pnpm typecheck`

Expected: PASS.

**Step 9: Commit**

```bash
git add packages/ai/src/agents/journey.ts packages/ai/src/tools/journey/ packages/ai/src/index.ts
git commit -m "feat(journey): add journey definition agent with 3 tools and 6-phase wizard"
```

---

## Task 4: API Route — Journey Agent

**Files:**

- Create: `apps/web/src/app/api/journey-agent/route.ts`

**Step 1: Write the API route**

Follow the same pattern as `apps/web/src/app/api/contract-agent/route.ts`:

```typescript
// ============================================
// route.ts — Journey Agent API Route
// Handles POST requests from the wizard chat UI.
// Validates auth (godmode only), loads wizard session,
// runs the journey agent, and persists messages.
// Connected to: packages/ai/src/agents/journey.ts (agent logic)
// Connected to: wizard_session table (session persistence)
// ============================================

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { runJourneyAgent } from "@smartout/ai/agents/journey";
import type { ModelMessage, JourneyToolContext } from "@smartout/ai/agents/journey";

const RequestSchema = z.object({
  sessionId: z.string().uuid(),
  userMessage: z.string().min(1).max(10000),
});

/**
 * POST /api/journey-agent
 *
 * Runs one turn of the journey wizard agent.
 * Loads session state from DB, passes context to agent,
 * then saves the new messages back to the session.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // 1. Auth check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Godmode check — wizard is platform-admin only
  const admin = createAdminClient();
  const { data: identity } = await admin
    .from("user_identity")
    .select("is_godmode")
    .eq("user_id", user.id)
    .single();

  if (!identity?.is_godmode) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3. Parse request
  let body: z.infer<typeof RequestSchema>;
  try {
    const raw = await request.json();
    body = RequestSchema.parse(raw);
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")
        : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // 4. Load wizard session
  const { data: session, error: sessionError } = await admin
    .from("wizard_session")
    .select("*")
    .eq("wizard_session_id", body.sessionId)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.status !== "active") {
    return NextResponse.json({ error: "Session is not active" }, { status: 400 });
  }

  try {
    // 5. Build conversation history from stored messages
    const existingMessages = (session.messages as Array<{ role: string; content: string }>) ?? [];
    const conversationHistory = existingMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })) as ModelMessage[];

    // 6. Build tool context
    const ctx: JourneyToolContext = {
      supabase: admin,
      workspaceId: session.workspace_id,
      sessionId: session.wizard_session_id,
      currentPhase: session.current_phase,
      draftJourney: (session.draft_journey as Record<string, unknown>) ?? {},
    };

    // 7. Run the agent
    const result = await runJourneyAgent({
      ctx,
      userMessage: body.userMessage,
      conversationHistory,
    });

    // 8. Append new messages to session
    const now = new Date().toISOString();
    const updatedMessages = [
      ...existingMessages,
      { role: "user", content: body.userMessage, timestamp: now },
      { role: "assistant", content: result.text, phase: result.phase, timestamp: now },
    ];

    await admin
      .from("wizard_session")
      .update({ messages: updatedMessages })
      .eq("wizard_session_id", body.sessionId);

    // 9. Reload session to get latest draft state (tools may have updated it)
    const { data: updatedSession } = await admin
      .from("wizard_session")
      .select("current_phase, draft_journey")
      .eq("wizard_session_id", body.sessionId)
      .single();

    return NextResponse.json({
      text: result.text,
      phase: updatedSession?.current_phase ?? session.current_phase,
      draftJourney: updatedSession?.draft_journey ?? session.draft_journey,
    });
  } catch (err) {
    console.error("Journey agent error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`

Expected: PASS.

**Step 3: Commit**

```bash
git add apps/web/src/app/api/journey-agent/route.ts
git commit -m "feat(journey): add journey agent API route with session persistence"
```

---

## Task 5: API Route — Wizard Session CRUD

**Files:**

- Create: `apps/web/src/app/api/platform-admin/journeys/wizard/route.ts` — create + list sessions
- Create: `apps/web/src/app/api/platform-admin/journeys/wizard/[sessionId]/route.ts` — get session
- Create: `apps/web/src/app/api/platform-admin/journeys/wizard/[sessionId]/complete/route.ts` — finalize journey

**Step 1: Write the create/list route**

File: `apps/web/src/app/api/platform-admin/journeys/wizard/route.ts`

```typescript
// ============================================
// route.ts — Wizard Session Create + List
// POST: Creates a new wizard session.
// GET: Lists wizard sessions for the workspace.
// Connected to: wizard_session table
// ============================================

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";

const CreateSchema = z.object({
  workspaceId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: identity } = await admin
    .from("user_identity")
    .select("is_godmode, user_identity_id")
    .eq("user_id", user.id)
    .single();
  if (!identity?.is_godmode) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: z.infer<typeof CreateSchema>;
  try {
    body = CreateSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("wizard_session")
    .insert({
      workspace_id: body.workspaceId,
      created_by: identity.user_identity_id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: identity } = await admin
    .from("user_identity")
    .select("is_godmode")
    .eq("user_id", user.id)
    .single();
  if (!identity?.is_godmode) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await admin
    .from("wizard_session")
    .select("wizard_session_id, status, current_phase, created_at, completed_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
```

**Step 2: Write the complete route**

File: `apps/web/src/app/api/platform-admin/journeys/wizard/[sessionId]/complete/route.ts`

This route finalizes a wizard session: creates the journey + steps from the draft, marks session as completed.

```typescript
// ============================================
// route.ts — Wizard Session Complete
// POST: Finalizes a wizard session by creating the journey
// and steps from the draft, then marking the session complete.
// Connected to: wizard_session, journey, journey_step tables
// ============================================

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";

type Props = { params: Promise<{ sessionId: string }> };

export async function POST(request: NextRequest, { params }: Props) {
  const { sessionId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: identity } = await admin
    .from("user_identity")
    .select("is_godmode, user_identity_id")
    .eq("user_id", user.id)
    .single();
  if (!identity?.is_godmode) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Load session
  const { data: session } = await admin
    .from("wizard_session")
    .select("*")
    .eq("wizard_session_id", sessionId)
    .single();

  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (session.status !== "active")
    return NextResponse.json({ error: "Session not active" }, { status: 400 });

  const draft = session.draft_journey as Record<string, unknown>;
  if (!draft.title || !draft.module || !draft.actor) {
    return NextResponse.json({ error: "Draft is incomplete" }, { status: 400 });
  }

  // Generate next journey code
  const { data: lastJourney } = await admin
    .from("journey")
    .select("code")
    .eq("workspace_id", session.workspace_id)
    .order("code", { ascending: false })
    .limit(1)
    .single();

  const lastNum = lastJourney ? parseInt(lastJourney.code.replace("J-", ""), 10) : 0;
  const nextCode = `J-${String(lastNum + 1).padStart(3, "0")}`;

  // Generate slug from title
  const slug = String(draft.title)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();

  // Create journey
  const { data: journey, error: journeyError } = await admin
    .from("journey")
    .insert({
      workspace_id: session.workspace_id,
      code: nextCode,
      title: String(draft.title),
      slug,
      module: String(draft.module) as never,
      actor: String(draft.actor) as never,
      platform: String(draft.platform ?? "both") as never,
      priority: String(draft.priority ?? "P1") as never,
      status: "defined" as never,
      tags: (draft.tags as string[]) ?? [],
      trigger_description: draft.trigger_description ? String(draft.trigger_description) : null,
      preconditions: (draft.preconditions as string[]) ?? [],
      test_assertion: draft.test_assertion ? String(draft.test_assertion) : null,
      doc_title: draft.doc_title ? String(draft.doc_title) : null,
      outcomes_success: draft.outcomes_success ? String(draft.outcomes_success) : null,
      outcomes_empty: draft.outcomes_empty ? String(draft.outcomes_empty) : null,
      outcomes_error: draft.outcomes_error ? String(draft.outcomes_error) : null,
      created_by: identity.user_identity_id,
    })
    .select()
    .single();

  if (journeyError || !journey) {
    return NextResponse.json(
      { error: journeyError?.message ?? "Failed to create journey" },
      { status: 500 },
    );
  }

  // Create steps
  const draftSteps =
    (draft.steps as Array<{
      title: string;
      action: string;
      expects?: string;
      screen?: string;
      component?: string;
    }>) ?? [];
  if (draftSteps.length > 0) {
    const stepRows = draftSteps.map((s, i) => ({
      journey_id: journey.journey_id,
      workspace_id: session.workspace_id,
      step_order: i + 1,
      title: s.title,
      action: s.action,
      expects: s.expects ?? null,
      screen: s.screen ?? null,
      component: s.component ?? null,
    }));

    await admin.from("journey_step").insert(stepRows);
  }

  // Log event
  await admin.from("journey_event").insert({
    journey_id: journey.journey_id,
    workspace_id: session.workspace_id,
    event_type: "status_change" as never,
    from_status: null,
    to_status: "defined" as never,
    actor_id: identity.user_identity_id,
    metadata: { source: "wizard", session_id: sessionId },
  });

  // Mark session complete
  await admin
    .from("wizard_session")
    .update({
      status: "completed" as never,
      journey_id: journey.journey_id,
      completed_at: new Date().toISOString(),
    })
    .eq("wizard_session_id", sessionId);

  return NextResponse.json({
    journey_id: journey.journey_id,
    code: nextCode,
    title: journey.title,
  });
}
```

**Step 3: Write the get session route**

File: `apps/web/src/app/api/platform-admin/journeys/wizard/[sessionId]/route.ts`

```typescript
// ============================================
// route.ts — Get Wizard Session
// GET: Returns a specific wizard session with all messages.
// ============================================

import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";

type Props = { params: Promise<{ sessionId: string }> };

export async function GET(_request: Request, { params }: Props) {
  const { sessionId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: identity } = await admin
    .from("user_identity")
    .select("is_godmode")
    .eq("user_id", user.id)
    .single();
  if (!identity?.is_godmode) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await admin
    .from("wizard_session")
    .select("*")
    .eq("wizard_session_id", sessionId)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}
```

**Step 4: Run typecheck**

Run: `pnpm typecheck`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/src/app/api/platform-admin/journeys/wizard/
git commit -m "feat(journey): add wizard session CRUD and completion API routes"
```

---

## Task 6: Wizard UI — Chat Page

**Files:**

- Create: `apps/web/src/app/platform-admin/journeys/wizard/page.tsx` — wizard launcher
- Create: `apps/web/src/app/platform-admin/journeys/wizard/[sessionId]/page.tsx` — server page
- Create: `apps/web/src/app/platform-admin/journeys/wizard/[sessionId]/_components/wizard-chat.tsx` — chat client
- Create: `apps/web/src/app/platform-admin/journeys/wizard/[sessionId]/_components/wizard-phase-indicator.tsx` — phase bar
- Create: `apps/web/src/app/platform-admin/journeys/wizard/[sessionId]/_components/wizard-draft-preview.tsx` — draft sidebar

**Step 1: Write the wizard launcher page**

`apps/web/src/app/platform-admin/journeys/wizard/page.tsx`

Server component that:

- Checks godmode auth
- Fetches existing active sessions
- Shows "Start New Wizard" button that POSTs to `/api/platform-admin/journeys/wizard` and redirects to the new session
- Lists recent sessions (active + completed) with links to resume/view

**Step 2: Write the wizard session server page**

`apps/web/src/app/platform-admin/journeys/wizard/[sessionId]/page.tsx`

Server component that:

- Loads wizard session by ID via admin client
- Passes session data to WizardChat client component
- 404s if session not found

**Step 3: Write the WizardChat client component**

`wizard-chat.tsx` — the main chat interface:

- Full-height chat layout (messages + input at bottom)
- Each message shows role (user/assistant) with proper formatting
- User input: text area + send button (disabled while loading)
- On send: POST to `/api/journey-agent` with `{ sessionId, userMessage }`
- Optimistic UI: append user message immediately, show typing indicator, then append assistant response
- Auto-scroll to bottom on new messages
- Phase indicator at top (from WizardPhaseIndicator)
- Draft preview in right sidebar (from WizardDraftPreview)
- "Complete Journey" button in review phase → POST to `/api/platform-admin/journeys/wizard/{sessionId}/complete`
- On completion → redirect to journey detail page

Key UI structure:

```
┌─────────────────────────────────────────────────────────────────┐
│ [←Back] Journey Wizard — Session                                │
├──────────────────────────────────┬──────────────────────────────┤
│ Phase: [1]─[2]─[3]─[4]─[5]─[6] │                              │
├──────────────────────────────────┤     Draft Preview            │
│                                  │     ┌────────────────────┐   │
│  🧙 Welcome! Let's define a     │     │ Title: ...         │   │
│  new journey. What should the    │     │ Module: ...        │   │
│  user be able to do?             │     │ Actor: ...         │   │
│                                  │     │ Steps: 0           │   │
│  👤 The employee should be       │     └────────────────────┘   │
│  able to swap shifts with...     │                              │
│                                  │                              │
│  🧙 Great! So this is about     │                              │
│  shift swapping. Let me check... │                              │
│                                  │                              │
├──────────────────────────────────┤                              │
│ [Type your message...    ] [Send]│ [Complete Journey] (review)  │
└──────────────────────────────────┴──────────────────────────────┘
```

- Use shadcn Card, Badge, Button, Textarea, ScrollArea
- Use CSS variables for colors, not hardcoded values
- Assistant messages render markdown (use a simple markdown renderer or dangerouslySetInnerHTML with sanitization for basic formatting)

**Step 4: Write WizardPhaseIndicator**

`wizard-phase-indicator.tsx`:

- Shows 6 phases as a horizontal stepper
- Current phase highlighted, completed phases checked
- Phase names: Discovery, Classification, Steps, Testing, Documentation, Review
- Icons per phase: Lightbulb, FolderKanban, ListOrdered, TestTube2, BookOpen, CheckCircle2

**Step 5: Write WizardDraftPreview**

`wizard-draft-preview.tsx`:

- Shows the current draft journey state
- Updates in real-time as the agent fills in fields
- Sections: Title, Module/Actor/Platform/Priority badges, Tags, Trigger, Steps (count + list), Test assertion
- Empty fields show placeholder "Not yet defined"

**Step 6: Add wizard link to journey list page**

Modify: `apps/web/src/app/platform-admin/journeys/_components/journey-list-client.tsx`

Add a "New Journey (Wizard)" button in the header area that links to `/platform-admin/journeys/wizard`.

**Step 7: Run and verify**

Run: `pnpm --filter web dev`

1. Navigate to `/platform-admin/journeys` → see "New Journey" button
2. Click → go to `/platform-admin/journeys/wizard`
3. Click "Start New Wizard" → creates session, redirects to chat
4. Chat with agent → messages persist, phase advances
5. Complete wizard → journey created, redirected to detail page

**Step 8: Commit**

```bash
git add apps/web/src/app/platform-admin/journeys/wizard/ apps/web/src/app/platform-admin/journeys/_components/journey-list-client.tsx
git commit -m "feat(journey): add wizard chat UI with phase indicator and draft preview"
```

---

## Task 7: Output Generators — E2E + Doc + Linear + Botsson

**Files:**

- Create: `packages/ai/src/generators/journey-e2e.ts`
- Create: `packages/ai/src/generators/journey-doc.ts`
- Create: `packages/ai/src/generators/journey-linear.ts`
- Create: `packages/ai/src/generators/journey-botsson.ts`
- Create: `packages/ai/src/generators/index.ts`
- Modify: `packages/ai/src/index.ts` — export generators

**Step 1: Write the E2E test generator**

File: `packages/ai/src/generators/journey-e2e.ts`

Pure function that takes a Journey + Steps and returns a Playwright test skeleton:

```typescript
// ============================================
// journey-e2e.ts — E2E Test Generator
// Transforms a journey definition into a Playwright test
// skeleton with describe blocks, test cases, and assertions
// derived from the journey steps and test_assertion field.
// Connected to: JourneyWithSteps type
// ============================================

import type { Journey, JourneyStep } from "@smartout/types";

/**
 * Generates a Playwright E2E test skeleton from a journey definition.
 *
 * Why a skeleton: Full test implementation needs app-specific selectors
 * and seed data. The skeleton provides structure, setup/teardown,
 * and assertion comments that developers fill in.
 *
 * @param journey - The journey record
 * @param steps - Ordered journey steps
 * @returns Playwright test code as a string
 */
export function generateE2ETest(journey: Journey, steps: JourneyStep[]): string {
  const testId = journey.slug;
  const lines: string[] = [];

  lines.push(`import { test, expect } from "@playwright/test";`);
  lines.push(``);
  lines.push(`test.describe("${journey.code}: ${journey.title}", () => {`);
  lines.push(`  test.beforeEach(async ({ page }) => {`);
  lines.push(`    // Seed: ${journey.actor} with active profile`);

  if (journey.preconditions.length > 0) {
    journey.preconditions.forEach((pre) => {
      lines.push(`    // Precondition: ${pre}`);
    });
  }

  lines.push(`    // Login as ${journey.actor}`);
  lines.push(`  });`);
  lines.push(``);

  // Main happy path test
  lines.push(`  test("completes full journey", async ({ page }) => {`);

  steps.forEach((step) => {
    lines.push(`    // Step ${step.step_order}: ${step.title}`);
    lines.push(`    // Action: ${step.action}`);

    if (step.screen) {
      lines.push(`    // Screen: ${step.screen}`);
    }

    if (step.expects) {
      lines.push(`    // Expects: ${step.expects}`);
    }

    lines.push(``);
  });

  if (journey.test_assertion) {
    lines.push(`    // Final assertion: ${journey.test_assertion}`);
  }

  lines.push(`  });`);
  lines.push(`});`);

  return lines.join("\n");
}
```

**Step 2: Write the onboarding doc generator**

File: `packages/ai/src/generators/journey-doc.ts`

Pure function that generates a Norwegian onboarding guide:

```typescript
// ============================================
// journey-doc.ts — Onboarding Doc Generator
// Transforms a journey definition into a Norwegian
// markdown onboarding guide for employees.
// Connected to: JourneyWithSteps type
// ============================================

import type { Journey, JourneyStep } from "@smartout/types";

/**
 * Generates a Norwegian onboarding documentation page
 * from a journey definition.
 *
 * @param journey - The journey record
 * @param steps - Ordered journey steps
 * @returns Markdown string in Norwegian
 */
export function generateOnboardingDoc(journey: Journey, steps: JourneyStep[]): string {
  const lines: string[] = [];

  const title = journey.doc_title ?? journey.title;
  lines.push(`# ${title}`);
  lines.push(``);
  lines.push(`> Denne guiden viser deg hvordan du ${journey.title.toLowerCase()}.`);
  lines.push(``);

  if (journey.trigger_description) {
    lines.push(`## Når bruker du dette?`);
    lines.push(``);
    lines.push(journey.trigger_description);
    lines.push(``);
  }

  if (journey.preconditions.length > 0) {
    lines.push(`## Før du begynner`);
    lines.push(``);
    journey.preconditions.forEach((pre) => {
      lines.push(`- ${pre}`);
    });
    lines.push(``);
  }

  lines.push(`## Steg for steg`);
  lines.push(``);

  steps.forEach((step) => {
    lines.push(`### ${step.step_order}. ${step.title}`);
    lines.push(``);
    lines.push(step.action);
    lines.push(``);

    if (step.expects) {
      lines.push(`**Forventet resultat:** ${step.expects}`);
      lines.push(``);
    }
  });

  if (journey.outcomes_success) {
    lines.push(`## Ferdig!`);
    lines.push(``);
    lines.push(journey.outcomes_success);
    lines.push(``);
  }

  if (journey.outcomes_error) {
    lines.push(`## Problemer?`);
    lines.push(``);
    lines.push(journey.outcomes_error);
    lines.push(``);
  }

  return lines.join("\n");
}
```

**Step 3: Write the Linear issue generator**

File: `packages/ai/src/generators/journey-linear.ts`

```typescript
// ============================================
// journey-linear.ts — Linear Issue Generator
// Transforms a journey definition into a markdown spec
// suitable for creating a Linear issue with acceptance criteria.
// Connected to: JourneyWithSteps type
// ============================================

import type { Journey, JourneyStep } from "@smartout/types";

/**
 * Generates a Linear issue spec markdown from a journey.
 *
 * @param journey - The journey record
 * @param steps - Ordered journey steps
 * @returns Markdown for a Linear issue description
 */
export function generateLinearSpec(journey: Journey, steps: JourneyStep[]): string {
  const lines: string[] = [];

  lines.push(`## ${journey.code}: ${journey.title}`);
  lines.push(``);
  lines.push(`| Field | Value |`);
  lines.push(`|-------|-------|`);
  lines.push(`| Module | ${journey.module} |`);
  lines.push(`| Actor | ${journey.actor} |`);
  lines.push(`| Platform | ${journey.platform} |`);
  lines.push(`| Priority | ${journey.priority} |`);

  if (journey.tags.length > 0) {
    lines.push(`| Tags | ${journey.tags.join(", ")} |`);
  }

  lines.push(``);

  if (journey.trigger_description) {
    lines.push(`### Trigger`);
    lines.push(``);
    lines.push(journey.trigger_description);
    lines.push(``);
  }

  if (journey.preconditions.length > 0) {
    lines.push(`### Preconditions`);
    lines.push(``);
    journey.preconditions.forEach((pre) => {
      lines.push(`- [ ] ${pre}`);
    });
    lines.push(``);
  }

  lines.push(`### Steps`);
  lines.push(``);

  steps.forEach((step) => {
    lines.push(`**Step ${step.step_order}: ${step.title}**`);
    lines.push(`- Action: ${step.action}`);

    if (step.expects) {
      lines.push(`- Expects: ${step.expects}`);
    }

    if (step.screen) {
      lines.push(`- Screen: \`${step.screen}\``);
    }

    if (step.component) {
      lines.push(`- Component: \`${step.component}\``);
    }

    lines.push(``);
  });

  lines.push(`### Acceptance Criteria`);
  lines.push(``);

  if (journey.test_assertion) {
    lines.push(`- [ ] ${journey.test_assertion}`);
  }

  if (journey.outcomes_success) {
    lines.push(`- [ ] Success: ${journey.outcomes_success}`);
  }

  if (journey.outcomes_empty) {
    lines.push(`- [ ] Empty state: ${journey.outcomes_empty}`);
  }

  if (journey.outcomes_error) {
    lines.push(`- [ ] Error handling: ${journey.outcomes_error}`);
  }

  steps.forEach((step) => {
    if (step.expects) {
      lines.push(`- [ ] Step ${step.step_order}: ${step.expects}`);
    }
  });

  return lines.join("\n");
}
```

**Step 4: Write the Botsson script generator**

File: `packages/ai/src/generators/journey-botsson.ts`

```typescript
// ============================================
// journey-botsson.ts — Mr. Botsson Script Generator
// Transforms a journey definition into a voice/chat
// walkthrough script for the Mr. Botsson AI assistant.
// Connected to: JourneyWithSteps type
// ============================================

import type { Journey, JourneyStep } from "@smartout/types";

/**
 * Generates a Mr. Botsson voice walkthrough script.
 * Written in Norwegian as that's the target language
 * for the AI assistant.
 *
 * @param journey - The journey record
 * @param steps - Ordered journey steps
 * @returns Botsson script as a string
 */
export function generateBotssonScript(journey: Journey, steps: JourneyStep[]): string {
  const lines: string[] = [];

  const title = journey.doc_title ?? journey.title;

  lines.push(`# Mr. Botsson — ${title}`);
  lines.push(`# Journey: ${journey.code}`);
  lines.push(`# Trigger: Bruker ber om hjelp med "${journey.title.toLowerCase()}"`);
  lines.push(``);
  lines.push(`## Intro`);
  lines.push(``);
  lines.push(
    `"Hei! Jeg skal hjelpe deg med å ${journey.title.toLowerCase()}. La meg guide deg gjennom det steg for steg."`,
  );
  lines.push(``);

  steps.forEach((step) => {
    lines.push(`## Steg ${step.step_order}: ${step.title}`);
    lines.push(``);
    lines.push(`[Instruks til Botsson: Guide brukeren gjennom dette steget]`);
    lines.push(``);
    lines.push(`"Nå skal du ${step.action.toLowerCase()}."`);
    lines.push(``);

    if (step.expects) {
      lines.push(`[Vent på bekreftelse]`);
      lines.push(`"Bra! Du bør nå se: ${step.expects}"`);
      lines.push(``);
    }
  });

  lines.push(`## Avslutning`);
  lines.push(``);

  if (journey.outcomes_success) {
    lines.push(`"Gratulerer! ${journey.outcomes_success}"`);
  } else {
    lines.push(`"Flott, du er ferdig! Er det noe annet jeg kan hjelpe deg med?"`);
  }

  return lines.join("\n");
}
```

**Step 5: Write the generators index**

File: `packages/ai/src/generators/index.ts`

```typescript
// ============================================
// index.ts — Output Generator Barrel Export
// ============================================

export { generateE2ETest } from "./journey-e2e";
export { generateOnboardingDoc } from "./journey-doc";
export { generateLinearSpec } from "./journey-linear";
export { generateBotssonScript } from "./journey-botsson";
```

**Step 6: Add exports to `packages/ai/src/index.ts`**

Append:

```typescript
// Journey output generators
export {
  generateE2ETest,
  generateOnboardingDoc,
  generateLinearSpec,
  generateBotssonScript,
} from "./generators";
```

**Step 7: Run typecheck**

Run: `pnpm typecheck`

Expected: PASS.

**Step 8: Commit**

```bash
git add packages/ai/src/generators/ packages/ai/src/index.ts
git commit -m "feat(journey): add 4 output generators (E2E, doc, Linear, Botsson)"
```

---

## Task 8: Output Tabs — Detail Page Integration

**Files:**

- Create: `apps/web/src/app/api/platform-admin/journeys/[id]/generate/route.ts` — generate output on demand
- Modify: `apps/web/src/app/platform-admin/journeys/[id]/_components/journey-detail-client.tsx` — enable output tabs

**Step 1: Write the generate API route**

File: `apps/web/src/app/api/platform-admin/journeys/[id]/generate/route.ts`

```typescript
// ============================================
// route.ts — Generate Journey Output
// POST: Generates an output (e2e, doc, linear, botsson)
// for a specific journey on demand.
// Connected to: packages/ai/src/generators/
// ============================================

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import {
  generateE2ETest,
  generateOnboardingDoc,
  generateLinearSpec,
  generateBotssonScript,
} from "@smartout/ai";

const RequestSchema = z.object({
  type: z.enum(["e2e", "doc", "linear", "botsson"]),
});

type Props = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: identity } = await admin
    .from("user_identity")
    .select("is_godmode")
    .eq("user_id", user.id)
    .single();
  if (!identity?.is_godmode) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Fetch journey + steps
  const [{ data: journey }, { data: steps }] = await Promise.all([
    admin.from("journey").select("*").eq("journey_id", id).single(),
    admin.from("journey_step").select("*").eq("journey_id", id).order("step_order"),
  ]);

  if (!journey) return NextResponse.json({ error: "Journey not found" }, { status: 404 });

  // Cast to match expected types
  const journeyData = journey as unknown as import("@smartout/types").Journey;
  const stepsData = (steps ?? []) as unknown as import("@smartout/types").JourneyStep[];

  let content: string;
  switch (body.type) {
    case "e2e":
      content = generateE2ETest(journeyData, stepsData);
      break;
    case "doc":
      content = generateOnboardingDoc(journeyData, stepsData);
      break;
    case "linear":
      content = generateLinearSpec(journeyData, stepsData);
      break;
    case "botsson":
      content = generateBotssonScript(journeyData, stepsData);
      break;
  }

  // Log generation event
  await admin.from("journey_event").insert({
    journey_id: id,
    workspace_id: journey.workspace_id,
    event_type: "output_generated" as never,
    metadata: { output_type: body.type },
  });

  return NextResponse.json({
    type: body.type,
    content,
    generated_at: new Date().toISOString(),
  });
}
```

**Step 2: Update the detail client component**

Modify: `apps/web/src/app/platform-admin/journeys/[id]/_components/journey-detail-client.tsx`

Changes needed:

1. Remove `disabled` from the E2E, Doc, Linear, Botsson TabsTrigger elements
2. Add a "Generate" button inside each tab content area
3. On click: POST to `/api/platform-admin/journeys/{id}/generate` with `{ type: "e2e" | "doc" | "linear" | "botsson" }`
4. Show the generated content in a code/markdown preview area
5. Add a "Copy to Clipboard" button for each output
6. For the Linear tab: add a "Create in Linear" button (placeholder — logs the action but shows toast that Linear integration is coming in Phase 3)

Each tab content structure:

```
┌─────────────────────────────────────┐
│ [Generate]  [Copy]  [Create in...] │
├─────────────────────────────────────┤
│                                     │
│  Generated content displayed here   │
│  (code block for E2E, markdown      │
│   preview for doc/linear/botsson)   │
│                                     │
└─────────────────────────────────────┘
```

Use a shared `OutputTabContent` sub-component to avoid repeating the generate/copy/display logic 4 times.

**Step 3: Run and verify**

1. Navigate to a journey detail page
2. Click "E2E Test" tab → click "Generate" → Playwright test skeleton appears
3. Click "Doc" tab → click "Generate" → Norwegian onboarding guide appears
4. Click "Linear" tab → click "Generate" → Linear issue spec appears
5. Click "Botsson" tab → click "Generate" → Voice script appears
6. "Copy" button copies content to clipboard
7. Event log shows "output_generated" events

**Step 4: Commit**

```bash
git add apps/web/src/app/api/platform-admin/journeys/[id]/generate/ apps/web/src/app/platform-admin/journeys/[id]/_components/journey-detail-client.tsx
git commit -m "feat(journey): enable output tabs with on-demand generation and copy"
```

---

## Task 9: ADR-0038 + Documentation

**Files:**

- Create: `docs/decisions/0038-journey-agent-output-generators.md`
- Modify: `docs/decisions/0000-decision-log.md`
- Modify: `docs/INDEX.md`

**Step 1: Write the ADR**

Use template from `docs/templates/decision.md`. Key content:

- **Context:** Phase 1 delivered the Journey Portal with tracking. Phase 2 adds AI-assisted journey definition and output generation, closing the loop from "idea" to "five deliverables".
- **Decision:** Multi-turn AI wizard using OpenRouter + Claude Sonnet with 3 tools (lookup, duplicates, save_draft). 4 output generators as pure functions (E2E, doc, Linear, Botsson). Wizard session persisted in `wizard_session` table with JSONB messages.
- **Alternatives considered:** (1) Edge Function for AI — rejected because API route is simpler and matches existing contract-agent pattern. (2) Streaming responses — rejected for wizard because tool calls between turns need to complete before display.
- **Consequences:** New table (wizard_session), 2 new enums. New agent in @smartout/ai. New API routes (journey-agent, wizard CRUD, generate). Detail page tabs activated. Foundation for Phase 3 automation (Linear sync, auto-generation triggers).

**Step 2: Register in decision log**

Add to `0000-decision-log.md`:

```
| ADR-0038 | 01-03-2026 | [Journey Agent & Output Generators](./0038-journey-agent-output-generators.md) | **Accepted** |
```

**Step 3: Update INDEX.md**

Add Phase 2 plan reference and ADR link.

**Step 4: Commit**

```bash
git add docs/decisions/ docs/INDEX.md
git commit -m "docs: add ADR-0038 journey agent and output generators"
```

---

## Task 10: Final Verification

**Step 1: Run full checks**

```bash
pnpm typecheck
pnpm lint
```

Expected: Both pass.

**Step 2: Manual smoke test — Wizard**

1. `npx supabase db reset` — clean database with migrations
2. `pnpm --filter web dev` — start dashboard
3. Navigate to `/platform-admin/journeys` → see "New Journey" button
4. Click → wizard launcher page shows
5. Start new wizard → creates session, redirects to chat
6. Chat through all 6 phases:
   - Discovery: describe a journey → agent asks questions
   - Classification: agent suggests module/actor/priority → confirm
   - Steps: define 3-4 steps → agent formats them
   - Testing: agent proposes test assertion → refine
   - Documentation: agent suggests Norwegian doc title + outcomes
   - Review: agent shows complete draft → confirm
7. Click "Complete Journey" → journey created with status "defined"
8. Redirected to journey detail page → see all data from wizard

**Step 3: Manual smoke test — Output Generators**

1. On any journey detail page → click "E2E Test" tab
2. Click "Generate" → Playwright test appears
3. Click "Copy" → content in clipboard
4. Repeat for Doc, Linear, Botsson tabs
5. Check Event Log → "output_generated" events logged

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(journey): address Phase 2 verification issues"
```

---

## Summary

| Task | What                                      | Files          |   Complexity    |
| :--: | ----------------------------------------- | -------------- | :-------------: |
|  1   | Database migration (wizard_session table) | 1 migration    |      Small      |
|  2   | TypeScript types (wizard + output types)  | 2 files modify |      Small      |
|  3   | Journey Agent (system prompt + 3 tools)   | 7 files        |      Large      |
|  4   | API route (journey-agent)                 | 1 file         |     Medium      |
|  5   | API routes (wizard CRUD + complete)       | 3 files        |     Medium      |
|  6   | Wizard UI (chat + phases + draft preview) | 5+ files       | Large (main UI) |
|  7   | Output generators (4 pure functions)      | 6 files        |     Medium      |
|  8   | Output tabs (detail page integration)     | 2 files        |     Medium      |
|  9   | ADR + documentation                       | 3 files        |      Small      |
|  10  | Verification                              | 0 files        |      Small      |

**Total files:** ~25 new + ~5 modified

**Dependencies:**

- Task 1 (migration) blocks Tasks 4, 5, 6
- Task 2 (types) blocks Tasks 3, 4, 5, 6, 7
- Task 3 (agent) blocks Task 4
- Task 4 (API route) blocks Task 6
- Task 5 (wizard CRUD) blocks Task 6
- Task 7 (generators) blocks Task 8
- Tasks 7-8 are independent of Tasks 3-6

**Agent Team Strategy:**

- **Agent A (DB + Types + Agent):** Tasks 1, 2, 3 — migration, types, agent logic
- **Agent B (Generators):** Tasks 7, 8 — output generators + detail page integration (parallel with A after Task 2)
- **Agent C (API + UI):** Tasks 4, 5, 6 — API routes + wizard UI (after A completes)
- **Lead:** Tasks 9, 10 — ADR, verification, review
