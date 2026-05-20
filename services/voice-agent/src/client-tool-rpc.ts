// client-tool-rpc.ts — Client-tool RPC roundtrip for LiveKit voice-agent.
//
// When the browser registers client-shipped tools (topic: "botsson-tools-register"),
// voice-agent builds stub llm.tool() entries here. Each stub's async execute body
// publishes a "botsson-tool-call" event over the LiveKit data channel and parks
// a Promise in pendingRPCCalls waiting for the browser to respond on
// "botsson-tool-result". The LLM blocks on the Promise — it cannot produce a
// follow-up response until the client result arrives or the 10 s timeout fires.
//
// Topic protocol (locked in investigation-findings.md):
//   botsson-tools-register  browser → voice-agent  { definitions: ClientToolDefinition[] }
//   botsson-tool-call       voice-agent → browser  { type:"tool_call", call_id, name, arguments }
//   botsson-tool-result     browser → voice-agent  { call_id, result }
//
// Feature flag: HARNESS_ADAPTER_VOICE=true enables stub building + updateTools.
// Listeners in agent.ts are installed regardless (cheap, idempotent).
//
// ADR-0078: voice channel + PII strip is defence-in-depth — authority layer
// already filtered PII tools before ClientToolDefinition reached the browser.
// Stubs built here inherit that guarantee transitively.

import { llm } from "@livekit/agents";
import { randomUUID } from "node:crypto";
import { _publishOnTopic } from "./adapter-internal.js";
import type { ClientToolDefinition, ClientToolParameter } from "@smartout/ai/harness/types";

// JSON-safe record type compatible with llm.tool()'s JSONObject constraint.
// llm.tool() parameters is typed as JSONSchema7 (plain object) when passed
// as a literal — the execute function receives InferToolInput<Schema> which
// for JSONSchema7 is `any`. We use this alias for call sites that need to
// construct the args object.
type JsonArgs = Record<string, unknown>;

// ── Module state ─────────────────────────────────────────────────────────────

/**
 * Pending RPC Promises indexed by call_id.
 *
 * Lifecycle: set when stub execute fires → cleared on browser result OR timeout.
 * Map is module-scoped so stubs built across multiple updateTools() calls share
 * the same resolution surface (call_id is globally unique per randomUUID()).
 */
const pendingRPCCalls = new Map<string, (result: string) => void>();

const TOOL_CALL_TIMEOUT_MS = 10_000;
const TOOL_CALL_TOPIC = "botsson-tool-call";

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Called by agent.ts DataReceived handler when topic === "botsson-tool-result".
 *
 * Resolves the pending Promise for the matching call_id and removes it from
 * the map. Silently ignores unknown call_ids (e.g. late arrivals after timeout).
 */
export function resolveToolResult(callId: string, result: string): void {
  const resolver = pendingRPCCalls.get(callId);
  if (resolver) {
    pendingRPCCalls.delete(callId);
    resolver(result);
  }
}

/**
 * Build a stub llm.FunctionTool for one client-shipped definition.
 *
 * The stub's execute body:
 *   1. Generates a unique call_id.
 *   2. Parks a Promise + 10 s timeout in pendingRPCCalls.
 *   3. Publishes { type:"tool_call", call_id, name, arguments } on topic "botsson-tool-call".
 *   4. Awaits the Promise — resolves when resolveToolResult() is called by the
 *      browser result handler, or after 10 s with a timeout string.
 *
 * parameters: built as a JSON Schema object from dynamicParameters. The shape
 * matches the plain-object parameters used across tools-orb.ts / tools-schedule.ts
 * (JSONSchema7-compatible, no Zod at runtime — llm.tool() accepts both).
 */
export function buildClientToolStub(
  def: ClientToolDefinition,
): llm.FunctionTool<Record<never, never>> {
  const name = def.temporaryTool.modelToolName;
  const parameters = dynamicParametersToJsonSchema(def.temporaryTool.dynamicParameters);

  return llm.tool({
    description: def.temporaryTool.description,
    parameters,
    // args typed as Record<never, never> at compile time; runtime receives the
    // actual argument object from the LLM (shape is determined by parameters).
    // We cast to JsonArgs to access args as a plain record for RPC forwarding.
    execute: async (args) => {
      const rpcArgs = args as JsonArgs;
      const callId = randomUUID();

      const resultPromise = new Promise<string>((resolve) => {
        pendingRPCCalls.set(callId, resolve);
        setTimeout(() => {
          // Guard: only resolve + delete if this call_id is still pending.
          // If the browser already responded (resolveToolResult ran), the entry
          // was already deleted — this branch is a no-op.
          if (pendingRPCCalls.delete(callId)) {
            resolve(`Tool execution timed out after ${TOOL_CALL_TIMEOUT_MS / 1000}s.`);
          }
        }, TOOL_CALL_TIMEOUT_MS);
      });

      _publishOnTopic(
        { type: "tool_call", call_id: callId, name, arguments: rpcArgs },
        TOOL_CALL_TOPIC,
      );

      return await resultPromise;
    },
  });
}

// ── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Convert dynamicParameters array to a JSON Schema "object" compatible with
 * llm.tool()'s `parameters` field (JSONSchema7 subset).
 *
 * Each ClientToolParameter has a `schema` with a `type` field and optional
 * extras (enum, properties, items). We map these directly into JSON Schema
 * properties, preserving enum/properties/items when present.
 */
function dynamicParametersToJsonSchema(params: ClientToolParameter[]): Record<string, unknown> {
  const properties: Record<string, Record<string, unknown>> = {};
  const required: string[] = [];

  for (const param of params) {
    const propSchema: Record<string, unknown> = {
      type: param.schema.type,
      description: param.description,
    };

    // Preserve optional schema extras
    if ("enum" in param.schema && param.schema.enum !== undefined) {
      propSchema["enum"] = param.schema.enum;
    }
    if ("properties" in param.schema && param.schema.properties !== undefined) {
      propSchema["properties"] = param.schema.properties;
    }
    if ("items" in param.schema && param.schema.items !== undefined) {
      propSchema["items"] = param.schema.items;
    }

    properties[param.name] = propSchema;

    if (param.required !== false) {
      // Default required unless explicitly false
      required.push(param.name);
    }
  }

  const schema: Record<string, unknown> = {
    type: "object",
    properties,
    additionalProperties: false,
  };

  if (required.length > 0) {
    schema["required"] = required;
  }

  return schema;
}
