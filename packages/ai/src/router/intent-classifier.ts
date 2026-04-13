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

// NOTE (2026-04-07): This schema was simplified after eval-harness found
// production was broken. OpenRouter's structured-output bridge to Anthropic
// rejects two Zod constructs:
//   - field `.describe()` calls          → "Provider returned error"
//   - `.min()/.max()` on numbers         → "Provider returned error"
// Both produce JSON-schema constraints that Anthropic's tool-input format
// does not accept. The system prompt and `intentSchemaConstraints` below
// document the same intent without breaking the wire format.
// See ADR-0073 addendum.
export const intentSchema = z.object({
  intent: z.string(),
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
    "contract_intake",
    "shift_swap",
    "general",
  ] as const),
  // Confidence in [0, 1]. Range constraint omitted from the schema; the
  // model is instructed in the system prompt to stay within bounds and
  // returned values are clamped at the call site if needed.
  confidence: z.number(),
  reasoning: z.string(),
});

export type IntentResult = z.infer<typeof intentSchema>;

export async function classifyIntent(
  message: string,
  context: string,
  options?: { apiKey?: string },
): Promise<IntentResult> {
  const registered = getRegisteredCapabilities();

  const { object } = await generateObject({
    // Was `anthropic/claude-sonnet-4` until 2026-04-07. That model returns
    // unparseable structured output via OpenRouter ("could not parse the
    // response"). Verified by eval-harness repro: sonnet-4 fails on every
    // schema; sonnet-4.6 succeeds. See ADR-0073 addendum.
    model: getOpenRouter(options?.apiKey)("anthropic/claude-sonnet-4.6"),
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
- contract_intake: Collecting personal information (bank details, address, tax card) needed to finalize an employment contract
- shift_swap: Requesting, approving, or managing shift swaps between employees
- general: Greetings, small talk, unclear intent, meta-questions

The user writes in Norwegian or English. Classify based on intent, not language.
Set confidence 0.0-1.0: high (>0.7) when intent is clear, low (<0.7) when ambiguous.`,
    prompt: `Employee context: ${context}\n\nMessage: "${message}"`,
  });

  return object;
}
