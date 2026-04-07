import { generateText, stepCountIs } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { toVercelTools } from "../adapters/vercel-ai";
import { CONTRACT_TOOLS } from "../tools/contract";
import type { SmartoutTool } from "../types";
import type { ContractToolContext, EditorAction } from "../tools/contract/types";
import type { ModelMessage } from "ai";

/**
 * System prompt for the contract template AI assistant.
 * Architecture spec Section 5.5.
 */
const SYSTEM_PROMPT = `Du er en kontraktsassistent for Smartout, en norsk SaaS-plattform for
serveringsbransjen. Du hjelper administratorer å bygge, redigere og
forbedre kontraktsmaler.

PERSONLIGHET:
- Profesjonell men vennlig
- Forklarer juridiske begreper på enkelt norsk
- Foreslår forbedringer proaktivt
- Advarer om manglende eller svake klausuler
- Bruker verktøyene aktivt — ikke bare foreslå, GJØR endringene

REGLER:
- Kontrakter skal følge norsk lov (Avtaleloven, GDPR/Personopplysningsloven)
- Behold placeholders som {{variabel}} — aldri erstatt dem med tekst
- Vis endringer som diff (grønn=lagt til, rød=fjernet)
- Design skal være moderne, fargerikt og lettlest
- Signaturfelt alltid til slutt
- Hver seksjon bør ha en én-linjers oppsummering

KONTEKST:
- Smartout selger SaaS til restauranter, hoteller og kafeer i Norge
- Prismodell: per ansatt per måned
- Alle kundeavtaler krever databehandleravtale (DPA) referanse
- Norsk lovvalg, Oslo tingrett som verneting

VERKTØYBRUK:
- Bruk read_document for å lese gjeldende innhold FØR du foreslår endringer
- Bruk search_clauses for å finne godkjente klausuler fra biblioteket
- Bruk validate_contract for å sjekke at kontrakten er komplett
- Alltid les dokumentet først, analyser, og GJØR endringene med verktøyene`;

function getModel() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it to .env.local (runtime/server, development env).",
    );
  }
  const openrouter = createOpenRouter({ apiKey });
  // Bumped from anthropic/claude-sonnet-4 → 4.6 on 2026-04-07 as part of
  // the Phase 5 council audit. Uses generateText({tools}), which per
  // ADR-0073's Phase 4 empirical finding is NOT affected by the
  // structured-output bug that broke intent-classifier.ts. Bump is for
  // model freshness + consistency, not bug-fix. See ADR-0073 audit addendum.
  return openrouter("anthropic/claude-sonnet-4.6");
}

export type ContractAgentInput = {
  ctx: ContractToolContext;
  userMessage: string;
  conversationHistory: ModelMessage[];
};

export type ContractAgentResult = {
  text: string;
  actions: EditorAction[];
  toolCalls: unknown[];
};

/**
 * Run the contract template AI agent.
 * Takes a user message, conversation history, and editor state.
 * Returns text response and any editor actions to apply.
 */
export async function runContractAgent({
  ctx,
  userMessage,
  conversationHistory,
}: ContractAgentInput): Promise<ContractAgentResult> {
  // CONTRACT_TOOLS uses `as const` with specific ZodObject schemas per tool.
  // toVercelTools expects SmartoutTool<TCtx> (schema defaults to base ZodType).
  // The cast is safe — toVercelTools only reads .schema and .execute from each tool.
  const tools = toVercelTools(
    CONTRACT_TOOLS as unknown as ReadonlyArray<SmartoutTool<ContractToolContext>>,
    ctx,
  );

  const messages: ModelMessage[] = [...conversationHistory, { role: "user", content: userMessage }];

  const result = await generateText({
    model: getModel(),
    system: SYSTEM_PROMPT,
    messages,
    tools,
    stopWhen: stepCountIs(10),
  });

  // Extract EditorActions from tool results
  const actions: EditorAction[] = [];
  for (const step of result.steps) {
    for (const toolResult of step.toolResults) {
      try {
        // toolResult shape varies by AI SDK version — cast to access result string
        const resultObj = toolResult as unknown as Record<string, unknown>;
        const resultStr = (resultObj.result ?? resultObj.output ?? "") as string;
        if (typeof resultStr === "string" && resultStr.startsWith("{")) {
          const parsed = JSON.parse(resultStr) as { action?: EditorAction };
          if (parsed.action) {
            actions.push(parsed.action);
          }
        }
      } catch {
        // Not all tool results contain actions (e.g., read_document)
      }
    }
  }

  return {
    text: result.text,
    actions,
    toolCalls: result.steps.flatMap((s) => s.toolCalls),
  };
}

/** Re-export for convenience */
export type { ModelMessage };
export type { ContractToolContext } from "../tools/contract/types";
