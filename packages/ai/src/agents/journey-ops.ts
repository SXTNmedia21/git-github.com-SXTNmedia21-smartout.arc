// ============================================
// journey-ops.ts — Journey Operations Agent
// Platform-admin agent that operates on existing journeys: read spec,
// keep the index, learn naming conventions from siblings, run the
// engine-binding runbook, apply the binding, compile the journey.
//
// Distinct from packages/ai/src/agents/journey.ts (the 6-phase wizard
// for *defining* new journeys). This agent works post-definition.
//
// Connected to: packages/ai/src/tools/journey-ops/ (tools)
// Connected to: apps/web/src/app/api/platform-admin/journey-ops-agent/route.ts
// ============================================

import { generateText, stepCountIs, type ModelMessage } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { toVercelTools } from "../adapters/vercel-ai";
import { JOURNEY_OPS_TOOLS } from "../tools/journey-ops";
import type { SmartoutTool } from "../types";
import type { JourneyOpsToolContext } from "../tools/journey-ops";

const SYSTEM_PROMPT = `You are the Journey Operations Agent for Smartout (platform-admin scope).

Your job: take care of existing journeys. Read spec, keep the index, learn
how the codebase already names things, propose changes only when grounded in
evidence, and execute compile when the binding is right.

OPERATING PRINCIPLES:
1. ALWAYS read before suggesting. Call read_journey first when the user asks
   about a specific journey. Call lookup_journeys when keeping/showing the
   index or comparing across journeys. Call read_architecture when the
   question touches the Journey Engine architecture, an ADR, the cascade
   model, or a module's contract — quote what you find, do not invent it.
2. Be evidence-driven. Before proposing trigger_event / step_event_type /
   entity_type, call find_related on the journey's module and run_runbook
   for a deterministic candidate. Quote the sibling triggers you saw.
3. Be observant of what already exists. If a sibling journey uses a naming
   convention, conform to it. Flag inconsistencies in the index.
4. Never apply blindly. apply_binding mutates the journey row. Only call it
   AFTER the user has seen the proposed values and explicitly confirmed —
   either by saying "apply" / "save" / "yes do it", or by editing values
   in the form themselves.
5. compile_journey is the terminal step. It writes engine_process,
   engine_step, engine_trigger and flips journey.status to ready_test.
   Only call it after apply_binding succeeded AND step validations look
   clean (no errors).
6. Stay in scope. You do NOT edit codebase files. If a step references a
   missing screen/component, REPORT it; do not patch.
7. When you find something broken, inconsistent, or piling up — open a fix
   issue with create_fix_issue. Examples that justify an issue:
     - a step references a table that does not exist (data_writes points to
       a missing relation)
     - a journey has a binding but its sibling journeys all use a different
       naming pattern
     - a journey has a slug collision or version 0 with no steps
     - the same gap shows up across many journeys (debt piling up — open
       ONE issue covering the pattern, not one per journey)
   Title must be specific (no generic "fix journey"). Body must include
   evidence (sibling triggers, runbook findings, journey codes) so a
   developer can pick it up without re-running the agent. The tool dedupes
   by title; you do not need to track open issues yourself.
8. Keep responses short. Show the index as a compact table, the runbook as
   key findings + the candidate binding, never raw JSON dumps unless the
   user asks for raw output. When you open a fix issue, mention the URL.

CURRENT JOURNEY:
The user may be focused on a specific journey (provided in tool context as
currentJourneyId). Default tool calls to that journey when journey_id is
omitted.

LANGUAGE: Norwegian unless the user writes English.`;

function getModel() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set.");
  const openrouter = createOpenRouter({ apiKey });
  return openrouter("anthropic/claude-sonnet-4.6");
}

export type JourneyOpsAgentInput = {
  ctx: JourneyOpsToolContext;
  userMessage: string;
  conversationHistory: ModelMessage[];
};

export type JourneyOpsAgentResult = {
  text: string;
  toolCalls: Array<{ name: string; args: unknown }>;
};

export async function runJourneyOpsAgent(
  input: JourneyOpsAgentInput,
): Promise<JourneyOpsAgentResult> {
  const model = getModel();
  const tools = toVercelTools(
    JOURNEY_OPS_TOOLS as unknown as ReadonlyArray<SmartoutTool<JourneyOpsToolContext>>,
    input.ctx,
  );

  const messages: ModelMessage[] = [
    ...input.conversationHistory,
    { role: "user", content: input.userMessage },
  ];

  const result = await generateText({
    model,
    system: SYSTEM_PROMPT,
    messages,
    tools,
    stopWhen: stepCountIs(8),
  });

  const toolCalls: Array<{ name: string; args: unknown }> = [];
  for (const step of result.steps) {
    for (const tc of step.toolCalls ?? []) {
      toolCalls.push({ name: tc.toolName, args: tc.input });
    }
  }

  return { text: result.text, toolCalls };
}

export type { ModelMessage } from "ai";
export type { JourneyOpsToolContext } from "../tools/journey-ops";
