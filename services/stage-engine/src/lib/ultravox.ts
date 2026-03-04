// ============================================
// ultravox.ts
// Ultravox API client for creating voice calls.
// Calls the Ultravox Create Call API and returns the call ID + join URL.
// Connected to: src/routes/adapters/ultravox.ts (adapter endpoints)
// Connected to: Ultravox API docs
// ============================================

import { getSecrets } from "../secrets.js";
import type {
  UltravoxCreateCallPayload,
  UltravoxCreateCallApiResponse,
  UltravoxHttpTool,
  UltravoxStaticParameter,
} from "../types/ultravox.js";

/**
 * Creates an Ultravox voice call via the Ultravox API.
 *
 * @param payload - The call configuration
 * @returns Call ID and join URL, or null on failure
 */
export async function createUltravoxCall(
  payload: UltravoxCreateCallPayload,
): Promise<UltravoxCreateCallApiResponse | null> {
  try {
    const res = await fetch("https://api.ultravox.ai/api/calls", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": getSecrets().ultravoxApiKey ?? "",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[ultravox] Create call failed: ${res.status} ${text}`);
      return null;
    }

    const data = (await res.json()) as UltravoxCreateCallApiResponse;
    return data;
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error(`[ultravox] Create call error: ${message}`);
    return null;
  }
}

/**
 * Builds the Ultravox HTTP tool definitions for store, fetch, advance, and getJourneyContext.
 * These tools point back to the engine's adapter endpoints.
 *
 * @param engineUrl - The public URL of the engine (e.g. https://engine.smartout.ai)
 * @param sessionId - The session ID to include in tool URLs
 * @param apiKey - The API key to include in tool headers
 * @returns Array of Ultravox tool definitions
 */
export function buildUltravoxTools(
  engineUrl: string,
  sessionId: string,
  apiKey: string,
): UltravoxHttpTool[] {
  // Auth and session routing via staticParameters — invisible to the AI model.
  // Never put secrets in baseUrlPattern (leaks via logs and referrer headers).
  // See: docs/learnings/0013-ultravox-http-tool-parameters.md
  const staticParams: UltravoxStaticParameter[] = [
    { name: "session_id", location: "PARAMETER_LOCATION_QUERY", value: sessionId },
    ...(apiKey
      ? [{ name: "x-api-key", location: "PARAMETER_LOCATION_HEADER" as const, value: apiKey }]
      : []),
  ];

  return [
    {
      temporaryTool: {
        modelToolName: "store",
        description:
          "Store data that you have collected from the conversation. Call this whenever you learn something important — a name, a problem, a preference, a decision.",
        dynamicParameters: [
          {
            name: "entity_type",
            location: "PARAMETER_LOCATION_BODY",
            schema: { type: "string", description: "Category: 'person', 'problem', 'note', etc." },
            required: true,
          },
          {
            name: "data",
            location: "PARAMETER_LOCATION_BODY",
            schema: { type: "object", description: "The data to store as key-value pairs" },
            required: true,
          },
        ],
        staticParameters: staticParams,
        http: {
          baseUrlPattern: `${engineUrl}/adapters/ultravox/store`,
          httpMethod: "POST",
        },
      },
    },
    {
      temporaryTool: {
        modelToolName: "fetch",
        description:
          "Retrieve information you need. Use query_type 'context' for user/workspace info, 'inbox' for previously stored data, 'history' for all collected data.",
        dynamicParameters: [
          {
            name: "query_type",
            location: "PARAMETER_LOCATION_BODY",
            schema: {
              type: "string",
              enum: ["context", "inbox", "stage", "history"],
              description: "What to retrieve",
            },
            required: true,
          },
        ],
        staticParameters: staticParams,
        http: {
          baseUrlPattern: `${engineUrl}/adapters/ultravox/fetch`,
          httpMethod: "POST",
        },
      },
    },
    {
      temporaryTool: {
        modelToolName: "advance",
        description:
          "Call this when you have completed the current stage and are ready to move to the next one. Include a summary of what you collected as 'result'.",
        dynamicParameters: [
          {
            name: "result",
            location: "PARAMETER_LOCATION_BODY",
            schema: { type: "object", description: "Summary data for the completed stage" },
            required: false,
          },
        ],
        staticParameters: staticParams,
        http: {
          baseUrlPattern: `${engineUrl}/adapters/ultravox/advance`,
          httpMethod: "POST",
        },
      },
    },
    {
      temporaryTool: {
        modelToolName: "getJourneyContext",
        description:
          "Get the current journey step details including what data to collect, what screen the user is on, and what to expect. Call this when you need to check what you should be doing.",
        dynamicParameters: [
          {
            name: "include_progress",
            location: "PARAMETER_LOCATION_BODY",
            schema: { type: "boolean", description: "Include overall progress info" },
            required: false,
          },
        ],
        staticParameters: [
          ...staticParams,
          {
            name: "query_type",
            location: "PARAMETER_LOCATION_BODY",
            value: "context",
          },
        ],
        http: {
          baseUrlPattern: `${engineUrl}/adapters/ultravox/fetch`,
          httpMethod: "POST",
        },
      },
    },
  ];
}
