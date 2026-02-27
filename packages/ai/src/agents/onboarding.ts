// packages/ai/src/agents/onboarding.ts
import { generateText, generateObject, stepCountIs } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { toVercelTools } from "../adapters/vercel-ai";
import { OnboardingIntelligenceSchema } from "../schemas/onboarding";
import { ONBOARDING_TOOLS } from "../tools/onboarding";
import type { OnboardingIntelligence } from "../schemas/onboarding";
import type { SmartoutTool } from "../types";
import type { SessionContext } from "../session-context";
import type { ModelMessage } from "ai";

const SYSTEM_PROMPT = `You are 'Mr. Botsson', an expert Smartout Workspace Architect and AI Onboarding Copilot.
Your mission is to interview business managers to map out their entire organization's structure.

Because you are connected to a Voice Assistant, you must adhere to these voice rules:
1. Ask ONE question at a time. Never ask multiple questions at once.
2. Keep your responses short, conversational, and natural.
3. Wait for the user to answer before moving on.
4. Acknowledge and validate ('Flott', 'Skjonner', 'Bra') before asking the next question.

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

function getModel() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it to .env.local (runtime/server, development env).",
    );
  }
  const openrouter = createOpenRouter({ apiKey });
  return openrouter("anthropic/claude-sonnet-4");
}

export type AgentInput = {
  ctx: SessionContext;
  userMessage: string;
  conversationHistory: ModelMessage[];
};

export type AgentResult = {
  text: string;
  toolCalls: unknown[];
  toolResults: unknown[];
};

export async function runOnboardingAgent({
  ctx,
  userMessage,
  conversationHistory,
}: AgentInput): Promise<AgentResult> {
  // ONBOARDING_TOOLS uses `as const` with specific ZodObject schemas per tool.
  // toVercelTools expects SmartoutTool<TCtx> (schema defaults to base ZodType).
  // The cast is safe — toVercelTools only reads .schema and .execute from each tool.
  const tools = toVercelTools(
    ONBOARDING_TOOLS as unknown as ReadonlyArray<SmartoutTool<SessionContext>>,
    ctx,
  );

  const messages: ModelMessage[] = [
    ...conversationHistory,
    { role: "user", content: userMessage },
  ];

  const result = await generateText({
    model: getModel(),
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

export async function extractOnboardingIntelligence({
  conversationHistory,
}: {
  conversationHistory: ModelMessage[];
}): Promise<OnboardingIntelligence> {
  const { object } = await generateObject({
    model: getModel(),
    schema: OnboardingIntelligenceSchema,
    system:
      "Extract all organizational intelligence from this onboarding conversation. Return structured data for every field you can identify. Use null for fields not discussed.",
    messages: conversationHistory,
  });

  return object;
}

/** Re-export for convenience — API route needs this type */
export type { ModelMessage };
