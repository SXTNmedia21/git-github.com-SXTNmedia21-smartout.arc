// packages/ai/src/router/intent-classifier.ts
import { generateObject } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { getRegisteredCapabilities } from "../capabilities/registry.js";

let _openrouter: ReturnType<typeof createOpenRouter> | null = null;

function getOpenRouter(apiKey?: string) {
  if (!_openrouter) {
    const key = apiKey ?? process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("OpenRouter API key required: pass apiKey or set OPENROUTER_API_KEY");
    _openrouter = createOpenRouter({ apiKey: key });
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
- general: Greetings, small talk, unclear intent, meta-questions

The user writes in Norwegian or English. Classify based on intent, not language.
Set confidence 0.0-1.0: high (>0.7) when intent is clear, low (<0.7) when ambiguous.`,
    prompt: `Employee context: ${context}\n\nMessage: "${message}"`,
  });

  return object;
}
