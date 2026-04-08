/**
 * runBotssonAgent — General-purpose Botsson chat runner.
 *
 * Wraps the Vercel AI SDK with Botsson's capability tools so admin chat sessions can
 * delegate work to Botsson. Mirrors the structure of runContractAgent (template editor)
 * and runJourneyAgent (wizard) but exposes capability tools instead of domain-specific tools.
 *
 * V0 wires only the contract capability. Future capabilities (schedule, payroll, governance)
 * will be added incrementally as Botsson's surface grows. The router/intent-classifier
 * abstraction will eventually pick capabilities dynamically per turn — for now we surface
 * a fixed set so the chat surface itself can ship.
 *
 * Output shape: text response + tool calls + any InputRequestDescriptors detected in tool
 * results. The API route forwards InputRequests to the chat UI, which renders them as
 * inline form widgets and posts the typed answer back as a follow-up turn.
 */

import { generateText, stepCountIs } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { ModelMessage } from "ai";

import { toVercelTools } from "../adapters/vercel-ai.js";
import { contractCapability } from "../capabilities/contract/index.js";
import type { AgentToolContext, CapabilityDefinition } from "../capabilities/types.js";
import type { SmartoutTool } from "../types.js";
import {
  isInputRequest,
  type InputRequestDescriptor,
  type SessionChannel,
} from "../primitives/input-request/index.js";

// ── System prompt ───────────────────────────────────────────────────────────
// Designed for ADMIN chat sessions. Botsson is a worker, not a chatbot —
// admin delegates, Botsson does, admin reviews. Do NOT relax this voice;
// it shapes how Botsson uses the available tools.
const SYSTEM_PROMPT = `Du er Mr. Botsson, en AI-kollega for administratorer i Smartout.
Smartout er en SaaS for skiftbaserte bedrifter i Norge — restauranter, hoteller, kafeer.

DIN ROLLE:
Du er en arbeider, ikke en assistent. Når admin ber deg om å gjøre noe (lage en kontrakt,
sjekke en status, sende en avtale), bruker du verktøyene dine til å faktisk gjøre jobben.
Du foreslår ikke. Du gjør. Admin reviewer og godkjenner irreversible handlinger.

VERKTØYBRUK:
- Ta initiativ. Hvis admin sier "lag en kontrakt for Lise", finn Lise i systemet, finn
  riktig template, lag drafen. Ikke be admin om å gjøre stegene manuelt.
- Bruk read-only tools (list_*, check_*) først for å hente kontekst, deretter mutation tools
  (create_*, send_*) for å gjøre endringene.
- Send ALDRI en kontrakt uten eksplisitt bekreftelse fra admin — det er irreversibelt.
- Hvis du mangler data (f.eks. ikke vet hvilken template), spør admin med en presis,
  kort melding. Ikke be om data du allerede kan finne via list-tools.

KRITISK SIKKERHET — PII OG SENSITIV DATA:
- Du skal ALDRI be om personnummer, bankkontonummer, eller annen sensitiv personlig data
  direkte i samtalen. Hverken muntlig (voice) eller skriftlig (chat).
- Hvis admin trenger å fylle inn slik data, returner en input_request (verktøyene dine
  som krever PII gir deg dette automatisk) eller henvis admin til
  /dashboard/people/[id]/complete-data hvor det finnes en sikker innfyllingsside.
- Du skal aldri gjenta sensitiv data tilbake i samtalen, selv om admin gir deg det.

PERSONLIGHET:
- Profesjonell, vennlig, direkte. Norsk språk.
- Ingen unødvendig formalitet. Du er en kollega, ikke en byråkrat.
- Korte svar. Ikke fyll plass med høflig prosa.
- Når du har gjort en endring, fortell admin hva som skjedde med ett konkret resultat:
  "Draft opprettet for Lise (kontrakt-ID: 1234). Vil du sende den nå?"`;

function getModel() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it to .env.local (runtime/server, development env).",
    );
  }
  const openrouter = createOpenRouter({ apiKey });
  // Same model as runContractAgent — Sonnet 4.6 via OpenRouter, picked for tool-calling
  // reliability per ADR-0073's Phase 4 audit. generateText({tools}) is unaffected by the
  // structured-output bug that broke intent-classifier.
  return openrouter("anthropic/claude-sonnet-4.6");
}

// ── Capabilities surfaced to Botsson chat ───────────────────────────────────
// V0: contract only. Adding a capability is one line — append to this array.
// Each capability brings its full tool set (read + suggest + mutation).
const BOTSSON_CAPABILITIES: ReadonlyArray<CapabilityDefinition> = [contractCapability];

// ── Public types ────────────────────────────────────────────────────────────
export type BotssonAgentInput = {
  ctx: AgentToolContext;
  channel: SessionChannel;
  userMessage: string;
  conversationHistory: ModelMessage[];
};

export type BotssonAgentResult = {
  text: string;
  /** Any InputRequestDescriptors returned by tools during this turn. */
  inputRequests: InputRequestDescriptor[];
  /** Raw tool calls for telemetry / audit. */
  toolCalls: unknown[];
  /** Tool execution outcomes for the chat UI to display ("Created draft 1234"). */
  toolResults: Array<{ tool_name: string; result: string }>;
};

/**
 * Run one turn of Botsson admin chat.
 */
export async function runBotssonAgent({
  ctx,
  channel: _channel, // reserved for the runtime channel guard once tools start emitting input_requests
  userMessage,
  conversationHistory,
}: BotssonAgentInput): Promise<BotssonAgentResult> {
  // Flatten all tools from active capabilities.
  // The cast is the same one runContractAgent uses — toVercelTools only reads
  // .schema and .execute from each entry, so the structural mismatch between
  // domain-specific schemas and the base SmartoutTool type is benign.
  const flatTools = BOTSSON_CAPABILITIES.flatMap((cap) => cap.tools);
  const tools = toVercelTools(
    flatTools as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>,
    ctx,
  );

  const messages: ModelMessage[] = [...conversationHistory, { role: "user", content: userMessage }];

  const result = await generateText({
    model: getModel(),
    system: SYSTEM_PROMPT,
    messages,
    tools,
    stopWhen: stepCountIs(10), // generous — Botsson can chain list → check → create → send
  });

  // Walk every tool result this turn produced; capture InputRequests + plain text outcomes.
  const inputRequests: InputRequestDescriptor[] = [];
  const toolResults: Array<{ tool_name: string; result: string }> = [];

  for (const step of result.steps) {
    for (const toolResult of step.toolResults) {
      // toolResult shape varies between AI SDK versions — read defensively.
      const obj = toolResult as unknown as Record<string, unknown>;
      const toolName = (obj.toolName ?? obj.tool_name ?? "unknown") as string;
      const rawValue = obj.result ?? obj.output ?? "";

      // Tools may return either a plain string or a structured InputRequestDescriptor.
      // Detection is duck-typed; isInputRequest() handles both shapes.
      if (isInputRequest(rawValue)) {
        inputRequests.push(rawValue);
        toolResults.push({
          tool_name: toolName,
          result: `[input_request: ${rawValue.fields.map((f) => f.label).join(", ")}]`,
        });
        continue;
      }

      // Tools that JSON.stringify their result (like createEmployeeContract) — try to parse
      // and detect an embedded input_request. If parsing fails, fall back to the raw string.
      if (typeof rawValue === "string") {
        if (rawValue.startsWith("{")) {
          try {
            const parsed = JSON.parse(rawValue) as unknown;
            if (isInputRequest(parsed)) {
              inputRequests.push(parsed);
              toolResults.push({
                tool_name: toolName,
                result: `[input_request: ${parsed.fields.map((f) => f.label).join(", ")}]`,
              });
              continue;
            }
          } catch {
            // Not JSON or not an InputRequest — treat as opaque tool output.
          }
        }
        toolResults.push({ tool_name: toolName, result: rawValue });
      }
    }
  }

  return {
    text: result.text,
    inputRequests,
    toolCalls: result.steps.flatMap((s) => s.toolCalls),
    toolResults,
  };
}

/** Re-export for convenience. */
export type { ModelMessage };
export type { AgentToolContext } from "../capabilities/types.js";
