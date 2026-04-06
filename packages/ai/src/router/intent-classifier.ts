// packages/ai/src/router/intent-classifier.ts
import { generateObject } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { getRegisteredCapabilities } from "../capabilities/registry.js";

let _openrouter: ReturnType<typeof createOpenRouter> | null = null;
let _cachedKey: string | undefined;

/**
 * Gets or creates the OpenRouter client.
 * Recreates the client if the API key has changed (supports runtime key rotation).
 */
function getOpenRouter(apiKey?: string) {
  const key = apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OpenRouter API key required: pass apiKey or set OPENROUTER_API_KEY");

  if (!_openrouter || key !== _cachedKey) {
    _openrouter = createOpenRouter({ apiKey: key });
    _cachedKey = key;
  }
  return _openrouter;
}

export const intentSchema = z.object({
  intent: z.string().describe("Specific intent, e.g. 'schedule:query', 'training:status'"),
  capability: z.enum([
    "knowledge",
    "schedule",
    "training",
    "operations",
    "profile",
    "communication",
    "memory",
    "payroll",
    "ui",
    "guardian",
    "contract",
    "general",
  ] as const),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().describe("Brief explanation of why this classification was chosen"),
});

export type IntentResult = z.infer<typeof intentSchema>;

export async function classifyIntent(
  message: string,
  context: string,
  options?: { apiKey?: string },
): Promise<IntentResult> {
  const registered = getRegisteredCapabilities();

  const { object } = await generateObject({
    model: getOpenRouter(options?.apiKey)("anthropic/claude-sonnet-4"),
    schema: intentSchema,
    system: `You are an intent classifier for a Norwegian employee assistant called Mr. Botsson.
Classify the user's message into one of these capabilities: ${registered.join(", ")}, general.

Capabilities:
- knowledge: Questions about company policies, procedures, rules, FAQs
- schedule: Shift queries, schedule changes, availability, swap requests
- training: Protocol assignments, readiness status, knowledge tests, learning
- operations: Department sessions, checklists, routines, daily ops
- profile: Employee info, team membership, contract status
- communication: Sending messages, notifications
- memory: Asking about past conversations or preferences
- payroll: Salary, overtime, deductions, pay period
- ui: Screen navigation, form filling, UI element highlighting, panel display, toast notifications
- guardian: Workspace health monitoring, readiness alerts, maturity signals, system status
- contract: Creating, sending, tracking, and managing employment contracts and agreements for employees in the workspace
- general: Greetings, small talk, unclear intent, meta-questions

The user writes in Norwegian or English. Classify based on intent, not language.
Set confidence 0.0-1.0: high (>0.7) when intent is clear, low (<0.7) when ambiguous.`,
    prompt: `Employee context: ${context}\n\nMessage: "${message}"`,
  });

  return object;
}
