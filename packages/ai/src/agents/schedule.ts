// ============================================
// schedule.ts — Schedule Agent (MCP-backed)
// AI agent that manages shifts via the Shift MCP Server.
// Instead of defining tools locally, it fetches them live
// from the MCP server — giving it create, update, list,
// get, and delete capabilities over real shift data.
//
// Auth: Accepts either a user JWT or a workspace API key.
//   - JWT:    used when called from a user session (web app)
//   - apiKey: used when called from a service (stage-engine)
//
// Connected to: services/shift-mcp/src/server.ts (5 MCP tools)
// Connected to: apps/web/src/app/api/schedule-agent/route.ts (API route)
// ============================================

import { generateText, stepCountIs } from "ai";
import type { ToolSet } from "ai";
import { createMCPClient } from "@ai-sdk/mcp";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { ModelMessage } from "ai";

/**
 * System prompt for the Schedule Agent (Lise).
 *
 * Why Norwegian: The product is for Norwegian hospitality businesses.
 * Why structured phases: Lise asks clarifying questions before acting,
 * then confirms the plan before writing to the database.
 */
const SYSTEM_PROMPT = `Du er Lise — Smartouts AI-drevne vaktplanlegger.

DIN ROLLE:
Du hjelper ledere med å planlegge og administrere vakter. Du bruker verktøy for å se, opprette, oppdatere og slette vakter i sanntid.

ARBEIDSFLYT:
1. FORSTÅ — Spør hva lederen trenger. Hva skal til? Hvilken dato/periode?
2. UNDERSØK — Bruk list_shifts for å se eksisterende vakter og avdekke hull.
3. FORESLÅ — Beskriv hva du planlegger å gjøre. Vent på bekreftelse.
4. UTFØR — Bruk create_shift, update_shift eller delete_shift for å gjøre endringene.
5. BEKREFT — Vis hva som ble gjort. Spør om det er mer å gjøre.

REGLER:
- Aldri slett eller overskrive vakter uten eksplisitt brukerbekreftelse
- Shift status "published" og "active" kan ikke slettes — informer lederen
- Bruk alltid list_shifts FØR du oppretter nye vakter for å unngå dobbeltbooking
- Tidspunkter alltid i "HH:MM"-format (f.eks. "08:00", "22:00")
- day_category velges automatisk: "morning" (06–12), "afternoon" (12–18), "evening" (18–00), "night" (00–06)
- work_hours beregnes automatisk av serveren — oppgi ikke dette feltet
- Snakk alltid norsk med brukeren

STATUSER:
- created: opprettet, ikke synlig for ansatte
- published: synlig for ansatte
- active: ansatt er innstemplet
- completed: avsluttet
- unpublished: trukket tilbake`;

/**
 * Context passed to the schedule agent per request.
 * Either jwt (user session) or apiKey (service) must be provided.
 */
export type ScheduleAgentContext = {
  /** User JWT from active session — used when called from web app */
  jwt?: string;
  /** Workspace API key — used when called from stage-engine or service */
  apiKey?: string;
  /** Base URL of the Shift MCP Server (e.g. http://localhost:5011) */
  mcpUrl: string;
};

export type ScheduleAgentInput = {
  ctx: ScheduleAgentContext;
  userMessage: string;
  conversationHistory: ModelMessage[];
};

export type ScheduleAgentResult = {
  text: string;
  /** True if any shift was created, updated, or deleted this turn */
  shiftsModified: boolean;
};

/**
 * Creates an OpenRouter model instance for the schedule agent.
 */
function getModel() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }
  const openrouter = createOpenRouter({ apiKey });
  return openrouter("anthropic/claude-sonnet-4");
}

/**
 * Builds the Authorization header for the MCP server.
 * Prefers API key over JWT — API key is more reliable for service calls.
 *
 * @param ctx - Agent context with auth credentials
 * @returns Headers object for MCP client
 */
function buildAuthHeaders(ctx: ScheduleAgentContext): Record<string, string> {
  if (ctx.apiKey) {
    return { "x-api-key": ctx.apiKey };
  }
  if (ctx.jwt) {
    return { authorization: `Bearer ${ctx.jwt}` };
  }
  throw new Error("ScheduleAgent: either jwt or apiKey must be provided in context");
}

/**
 * Runs the Schedule Agent for one turn.
 *
 * Creates an MCP client, fetches tools live from the Shift MCP Server,
 * runs generateText, then closes the client. The MCP client lifecycle
 * is scoped to one request — no persistent sessions.
 *
 * Why generateText (not streaming): The agent may call multiple tools
 * before responding (list → create → confirm). Streaming complicates
 * collecting tool results before sending the final reply.
 *
 * @param input - User message, conversation history, and MCP context
 * @returns Agent response text and whether any shifts were modified
 */
export async function runScheduleAgent(input: ScheduleAgentInput): Promise<ScheduleAgentResult> {
  const model = getModel();
  const headers = buildAuthHeaders(input.ctx);

  // Connect to the Shift MCP Server and fetch available tools
  const mcpClient = await createMCPClient({
    transport: {
      type: "http",
      url: `${input.ctx.mcpUrl}/mcp`,
      headers,
    },
  });

  try {
    // Fetch tools live from the MCP server.
    // Cast to ToolSet: the @ai-sdk/mcp client returns FlexibleSchema<unknown>
    // which TypeScript can't narrow to ToolSet's stricter generics, but the
    // runtime shape is compatible. This is the documented workaround.
    // See: https://github.com/vercel/ai/discussions/4890
    const mcpTools = (await mcpClient.tools()) as unknown as ToolSet;

    const messages: ModelMessage[] = [
      ...input.conversationHistory,
      { role: "user", content: input.userMessage },
    ];

    const result = await generateText({
      model,
      system: SYSTEM_PROMPT,
      messages,
      tools: mcpTools,
      // Allow up to 5 tool calls per turn (e.g., list → create × 3 → confirm)
      stopWhen: stepCountIs(5),
    });

    // Detect if any mutating tool was called this turn
    const mutatingTools = new Set(["create_shift", "update_shift", "delete_shift"]);
    const shiftsModified = result.steps.some((step) =>
      step.toolCalls?.some((tc) => mutatingTools.has(tc.toolName)),
    );

    return {
      text: result.text,
      shiftsModified,
    };
  } finally {
    // Always close the MCP client — even if generateText throws
    await mcpClient.close();
  }
}

// Re-export types used by API routes
export type { ModelMessage } from "ai";
