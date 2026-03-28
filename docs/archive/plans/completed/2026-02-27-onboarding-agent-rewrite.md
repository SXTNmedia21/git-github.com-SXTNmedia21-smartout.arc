---
title: "Onboarding Agent Rewrite: Python to TypeScript"
id: PLAN_ONBOARDING_AGENT
status: completed
layer: plan
created: 2026-02-27
updated: 2026-02-27
---

# Onboarding Agent Rewrite: Python to TypeScript

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the Python Pydantic AI onboarding agent with a TypeScript equivalent using the Vercel AI SDK + OpenRouter, persisting data to Supabase instead of the filesystem.

**Architecture:** Server-side agent module in `apps/web/src/lib/ai/` exposed via a Next.js API route. Uses `generateText` with Claude (via OpenRouter) for conversation, `generateObject` with Zod for structured extraction, and Supabase for persistence. Reuses the existing `onboarding_session` table (migration `00009`).

**Tech Stack:** Vercel AI SDK (`ai` v5+), `@openrouter/ai-sdk-provider`, Zod, Supabase, Next.js 16 App Router

---

## Key References

| File                                          | Purpose                               |
| --------------------------------------------- | ------------------------------------- |
| `agents/onboarding_agent.py`                  | Python source — 1:1 parity reference  |
| `supabase/migrations/00009_onboarding_v3.sql` | `onboarding_session` table schema     |
| `packages/supabase/src/server.ts`             | Server-side Supabase client factory   |
| `packages/supabase/src/database.types.ts`     | Auto-generated DB types (needs regen) |
| `apps/web/src/app/api/wizard/start/route.ts`  | Existing API route pattern            |
| `apps/web/tsconfig.json`                      | Path alias: `@/*` -> `./src/*`        |

## Environment Variable

`OPENROUTER_API_KEY` — add to `apps/web/.env.local`. Classified as `runtime/server`, `development` env. Store in 1Password first.

---

## Task 0: Regenerate Supabase Types

The `onboarding_session` table exists in migration `00009` but is missing from `packages/supabase/src/database.types.ts`. We need it for type-safe Supabase queries.

**Files:**

- Modify: `packages/supabase/src/database.types.ts` (auto-generated)

**Step 1: Start local Supabase (if not running)**

Run: `npx supabase status`

If not running:
Run: `npx supabase start`

**Step 2: Regenerate types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

**Step 3: Verify `onboarding_session` is in the output**

Run: `grep -c "onboarding_session" packages/supabase/src/database.types.ts`
Expected: A number > 0

**Step 4: Commit**

```bash
git add packages/supabase/src/database.types.ts
git commit -m "chore: regenerate Supabase types (includes onboarding_session)"
```

---

## Task 1: Install Vercel AI SDK + OpenRouter Provider

**Files:**

- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`

**Step 1: Install packages**

Run: `pnpm --filter web add ai @openrouter/ai-sdk-provider`

**Step 2: Verify installation**

Run: `pnpm --filter web ls ai @openrouter/ai-sdk-provider`
Expected: Both packages listed with versions

**Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "feat: add Vercel AI SDK and OpenRouter provider"
```

---

## Task 2: Create Zod Schemas for OnboardingIntelligence

1:1 TypeScript equivalent of the Python `OnboardingIntelligence` Pydantic model. Used for AI structured output extraction via `generateObject`.

**Files:**

- Create: `apps/web/src/lib/ai/onboarding-schemas.ts`

**Step 1: Create the directory**

Run: `mkdir -p apps/web/src/lib/ai`

**Step 2: Create the schema file**

```typescript
// apps/web/src/lib/ai/onboarding-schemas.ts
import { z } from "zod";

export const OnboardingIntelligenceSchema = z.object({
  company_name: z.string().nullable().describe("The name of the business"),
  vibe: z.string().nullable().describe("The concept or vibe of the business"),
  general_manager: z.string().nullable().describe("Daglig leder (general manager)"),
  hr_manager: z.string().nullable().describe("Personalansvarig (HR manager)"),
  fire_safety_manager: z.string().nullable().describe("Brannansvarig (fire safety manager)"),
  current_season: z.string().nullable().describe("Current operating season"),
  departments: z.array(z.string()).describe("List of departments (e.g., Kitchen, Floor, Bar)"),
  teams: z.array(z.string()).describe("List of teams"),
  locations: z.array(z.string()).describe("List of physical locations"),
  zones: z.array(z.string()).describe("List of zones within locations"),
  assets_with_haccp: z.array(z.string()).describe("Assets requiring HACCP controls or routines"),
});

export type OnboardingIntelligence = z.infer<typeof OnboardingIntelligenceSchema>;
```

**Step 3: Verify types compile**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add apps/web/src/lib/ai/onboarding-schemas.ts
git commit -m "feat: add OnboardingIntelligence Zod schema"
```

---

## Task 3: Create Agent Tools (Supabase Operations)

Replaces Python filesystem I/O with Supabase database operations. Uses factory pattern `createOnboardingTools(sessionId)` — every tool is scoped to a specific `onboarding_session` row.

Tool mapping from Python:

- `save_raw_transcription` -> `save_transcription` (appends to `scraped_data.transcripts` JSONB array)
- `generate_markdown_report` -> `save_intelligence_report` (writes to `ai_analysis[topic]` JSONB object)
- `create_workspace_folder` -> removed (no filesystem needed)
- NEW: `update_intelligence` (writes structured data to `suggested_departments/teams/locations/positions`)

**Files:**

- Create: `apps/web/src/lib/ai/onboarding-tools.ts`

**Step 1: Create the tools file**

```typescript
// apps/web/src/lib/ai/onboarding-tools.ts
import { tool } from "ai";
import { z } from "zod";
import { createClient } from "@smartout/supabase/server";

export function createOnboardingTools(sessionId: string) {
  return {
    save_transcription: tool({
      description:
        "Save a voice transcription entry. Call this for each meaningful user statement during the interview.",
      inputSchema: z.object({
        speaker: z.enum(["user", "agent"]).describe("Who said it"),
        text: z.string().describe("The transcribed text"),
      }),
      execute: async ({ speaker, text }) => {
        const supabase = await createClient();

        // Read current transcripts array
        const { data: session } = await supabase
          .from("onboarding_session")
          .select("scraped_data")
          .eq("id", sessionId)
          .single();

        const scraped = (session?.scraped_data as Record<string, unknown>) ?? {};
        const transcripts = (scraped.transcripts as Array<unknown>) ?? [];

        transcripts.push({
          speaker,
          text,
          timestamp: new Date().toISOString(),
        });

        const { error } = await supabase
          .from("onboarding_session")
          .update({
            scraped_data: { ...scraped, transcripts },
            updated_at: new Date().toISOString(),
          })
          .eq("id", sessionId);

        if (error) return `Error saving transcription: ${error.message}`;
        return "Transcription saved.";
      },
    }),

    save_intelligence_report: tool({
      description:
        "Save a markdown intelligence report for a specific topic (e.g., 'departments', 'leadership', 'locations').",
      inputSchema: z.object({
        topic: z.string().describe("Report topic key (e.g., 'departments', 'leadership')"),
        content_markdown: z.string().describe("The markdown report content"),
      }),
      execute: async ({ topic, content_markdown }) => {
        const supabase = await createClient();

        const { data: session } = await supabase
          .from("onboarding_session")
          .select("ai_analysis")
          .eq("id", sessionId)
          .single();

        const analysis = (session?.ai_analysis as Record<string, unknown>) ?? {};
        analysis[topic] = {
          content: content_markdown,
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from("onboarding_session")
          .update({
            ai_analysis: analysis,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sessionId);

        if (error) return `Error saving report: ${error.message}`;
        return `Report '${topic}' saved.`;
      },
    }),

    update_intelligence: tool({
      description:
        "Update the structured intelligence data (departments, teams, locations, positions) based on what the user has described so far.",
      inputSchema: z.object({
        departments: z.array(z.string()).optional().describe("List of department names"),
        teams: z.array(z.string()).optional().describe("List of team names"),
        locations: z.array(z.string()).optional().describe("List of physical location names"),
        positions: z.array(z.string()).optional().describe("List of position/role names"),
      }),
      execute: async ({ departments, teams, locations, positions }) => {
        const supabase = await createClient();

        const updates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };

        if (departments) updates.suggested_departments = departments;
        if (teams) updates.suggested_teams = teams;
        if (locations) updates.suggested_locations = locations;
        if (positions) updates.suggested_positions = positions;

        const { error } = await supabase
          .from("onboarding_session")
          .update(updates)
          .eq("id", sessionId);

        if (error) return `Error updating intelligence: ${error.message}`;

        const saved = [
          departments && "departments",
          teams && "teams",
          locations && "locations",
          positions && "positions",
        ].filter(Boolean);

        return `Updated: ${saved.join(", ")}.`;
      },
    }),
  };
}
```

**Step 2: Verify types compile**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors (depends on Task 0 completing successfully — `onboarding_session` must be in generated types)

**Step 3: Commit**

```bash
git add apps/web/src/lib/ai/onboarding-tools.ts
git commit -m "feat: add onboarding agent tools with Supabase persistence"
```

---

## Task 4: Create the Agent Module

Two exported functions:

1. `runOnboardingAgent(...)` — main conversation loop. Uses `generateText` with Claude via OpenRouter, the Mr. Botsson system prompt, and the Supabase tools. `stopWhen: stepCountIs(5)` for multi-tool reasoning.

2. `extractOnboardingIntelligence(...)` — called when conversation is done. Uses `generateObject` with `OnboardingIntelligenceSchema` for guaranteed structured output.

System prompt preserved from Python with voice-friendly rules.

**Files:**

- Create: `apps/web/src/lib/ai/onboarding-agent.ts`

**Step 1: Create the agent file**

```typescript
// apps/web/src/lib/ai/onboarding-agent.ts
import { generateText, generateObject, stepCountIs } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { OnboardingIntelligenceSchema } from "./onboarding-schemas";
import { createOnboardingTools } from "./onboarding-tools";
import type { OnboardingIntelligence } from "./onboarding-schemas";
import type { CoreMessage } from "ai";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

const model = openrouter("anthropic/claude-sonnet-4");

const SYSTEM_PROMPT = `You are 'Mr. Botsson', an expert Smartout Workspace Architect and AI Onboarding Copilot.
Your mission is to interview business managers to map out their entire organization's structure.

Because you are connected to a Voice Assistant, you must adhere to these voice rules:
1. Ask ONE question at a time. Never ask multiple questions at once.
2. Keep your responses short, conversational, and natural.
3. Wait for the user to answer before moving on.
4. Acknowledge and validate ('Flott', 'Skjønner', 'Bra') before asking the next question.

Your objective is to map the following areas, in this order:
1. Identity & Leadership (company name, vibe, daglig leder, HR, brannansvarig)
2. Seasons (current operating season, seasonal patterns)
3. Departments (kitchen, floor, bar, etc.)
4. Teams (groupings within departments)
5. Locations (physical buildings/areas)
6. Zones (service sections within locations)
7. Assets & Routines (equipment requiring HACCP or daily checks)

You have tools to save transcriptions, generate intelligence reports, and update structured data as you gather information. Use them proactively as you learn new facts.

When you have gathered enough information about a topic, save an intelligence report before moving to the next topic. Update the structured intelligence data whenever you learn about departments, teams, locations, or positions.`;

type AgentInput = {
  sessionId: string;
  userMessage: string;
  conversationHistory: CoreMessage[];
};

type AgentResult = {
  text: string;
  toolCalls: unknown[];
  toolResults: unknown[];
};

export async function runOnboardingAgent({
  sessionId,
  userMessage,
  conversationHistory,
}: AgentInput): Promise<AgentResult> {
  const tools = createOnboardingTools(sessionId);

  const messages: CoreMessage[] = [...conversationHistory, { role: "user", content: userMessage }];

  const result = await generateText({
    model,
    system: SYSTEM_PROMPT,
    messages,
    tools,
    stopWhen: stepCountIs(5),
  });

  return {
    text: result.text,
    toolCalls: result.steps.flatMap((s) => s.toolCalls),
    toolResults: result.steps.flatMap((s) => s.toolResults),
  };
}

type ExtractionInput = {
  conversationHistory: CoreMessage[];
};

export async function extractOnboardingIntelligence({
  conversationHistory,
}: ExtractionInput): Promise<OnboardingIntelligence> {
  const { object } = await generateObject({
    model,
    schema: OnboardingIntelligenceSchema,
    messages: [
      {
        role: "system",
        content:
          "Extract all organizational intelligence from this onboarding conversation. Return structured data for every field you can identify. Use null for fields not discussed.",
      },
      ...conversationHistory,
    ],
  });

  return object;
}
```

**Step 2: Verify types compile**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/web/src/lib/ai/onboarding-agent.ts
git commit -m "feat: add onboarding agent module with Vercel AI SDK + OpenRouter"
```

---

## Task 5: Create the API Route

POST endpoint following existing patterns from `apps/web/src/app/api/wizard/start/route.ts`.

Flow:

1. Auth check via `supabase.auth.getUser()`
2. Input validation via Zod
3. Session ownership check (verify `user_id` matches authenticated user)
4. Run agent or extract intelligence
5. Return `{ text, toolCalls, toolResults }` or `{ intelligence }`
6. Proper error handling with HTTP status codes

**Files:**

- Create: `apps/web/src/app/api/onboarding-agent/route.ts`

**Step 1: Create the route directory**

Run: `mkdir -p apps/web/src/app/api/onboarding-agent`

**Step 2: Create the route handler**

```typescript
// apps/web/src/app/api/onboarding-agent/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import { runOnboardingAgent, extractOnboardingIntelligence } from "@/lib/ai/onboarding-agent";
import type { CoreMessage } from "ai";

const RequestSchema = z.object({
  sessionId: z.string().uuid(),
  userMessage: z.string().min(1).max(5000),
  conversationHistory: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    }),
  ),
  extractIntelligence: z.boolean().optional().default(false),
});

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

  // 2. Parse & validate input
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

  // 3. Session ownership check
  const { data: session, error: sessionError } = await supabase
    .from("onboarding_session")
    .select("id, user_id")
    .eq("id", body.sessionId)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Onboarding session not found" }, { status: 404 });
  }

  if (session.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const history = body.conversationHistory as CoreMessage[];

    // 4a. Extract intelligence (final step)
    if (body.extractIntelligence) {
      const allMessages: CoreMessage[] = [...history, { role: "user", content: body.userMessage }];

      const intelligence = await extractOnboardingIntelligence({
        conversationHistory: allMessages,
      });

      return NextResponse.json({ intelligence });
    }

    // 4b. Run conversation agent
    const result = await runOnboardingAgent({
      sessionId: body.sessionId,
      userMessage: body.userMessage,
      conversationHistory: history,
    });

    return NextResponse.json({
      text: result.text,
      toolCalls: result.toolCalls,
      toolResults: result.toolResults,
    });
  } catch (err) {
    console.error("Onboarding agent error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 3: Verify build**

Run: `pnpm --filter web build`
Expected: Build succeeds with no errors

**Step 4: Commit**

```bash
git add apps/web/src/app/api/onboarding-agent/route.ts
git commit -m "feat: add onboarding agent API route"
```

---

## Task 6: Delete Python Agent

**Files:**

- Delete: `agents/onboarding_agent.py`
- Delete: `agents/` directory (if no other files exist)

**Step 1: Check directory contents**

Run: `ls -la agents/`
Expected: Only `onboarding_agent.py` (and maybe `__pycache__`)

**Step 2: Remove the directory**

Run: `rm -rf agents/`

**Step 3: Verify removal**

Run: `ls agents/ 2>&1`
Expected: "No such file or directory"

**Step 4: Commit**

```bash
git add agents/
git commit -m "chore: remove Python onboarding agent — replaced by TypeScript"
```

---

## Task 7: Final Verification

**Step 1: Clean install**

Run: `pnpm install`
Expected: No errors

**Step 2: Lint**

Run: `pnpm lint`
Expected: No errors (or only pre-existing warnings)

**Step 3: Build web app**

Run: `pnpm --filter web build`
Expected: Build succeeds

**Step 4: Review created files**

Verify these files exist and are non-empty:

```
apps/web/src/lib/ai/onboarding-schemas.ts
apps/web/src/lib/ai/onboarding-tools.ts
apps/web/src/lib/ai/onboarding-agent.ts
apps/web/src/app/api/onboarding-agent/route.ts
```

Verify this directory is gone:

```
agents/
```

---

## Summary of Changes

| Action | File                                                        |
| ------ | ----------------------------------------------------------- |
| Regen  | `packages/supabase/src/database.types.ts`                   |
| Modify | `apps/web/package.json` (+ai, +@openrouter/ai-sdk-provider) |
| Create | `apps/web/src/lib/ai/onboarding-schemas.ts`                 |
| Create | `apps/web/src/lib/ai/onboarding-tools.ts`                   |
| Create | `apps/web/src/lib/ai/onboarding-agent.ts`                   |
| Create | `apps/web/src/app/api/onboarding-agent/route.ts`            |
| Delete | `agents/` directory                                         |
