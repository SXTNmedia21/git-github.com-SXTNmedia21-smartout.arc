// packages/ai/src/adapters/vercel-ai.ts
import { tool } from "ai";
import { emit } from "@smartout/telemetry";
import type { SmartoutTool } from "../types.js";

type EmitContext = {
  workspaceId?: string;
  profileId?: string;
  sessionId?: string;
  requestId?: string;
};

/**
 * Converts SmartoutTool[] to Vercel AI SDK tool format.
 * Uses `inputSchema` (Vercel AI SDK convention) from the tool's Zod schema.
 *
 * Auto-emits `botsson.tool_invoked` / `botsson.tool_failed` per invocation
 * (ADR-0113). Context fields (workspaceId, profileId, sessionId) are read
 * best-effort from `ctx`; missing fields fall back to "unknown" so legacy
 * agent contexts that predate the observability contract still emit — the
 * signal is that it's unattributed, not silent.
 *
 * @param tools - Array of framework-agnostic tool definitions
 * @param ctx - The context object passed to each tool's execute function
 * @returns Record of tool name -> Vercel AI SDK tool, ready for generateText()
 */
export function toVercelTools<TCtx>(tools: ReadonlyArray<SmartoutTool<TCtx>>, ctx: TCtx) {
  const emitCtx = ctx as unknown as EmitContext;
  return Object.fromEntries(
    tools.map((t) => [
      t.name,
      tool({
        description: t.description,
        inputSchema: t.schema,
        execute: async (params) => {
          const start = Date.now();
          try {
            const result = await t.execute(params, ctx);
            await emit({
              event: "botsson.tool_invoked",
              workspace_id: emitCtx.workspaceId ?? null,
              actor_id: emitCtx.profileId ?? "unknown",
              correlation_id: emitCtx.requestId,
              properties: {
                entity: {
                  entity_type: "agent_session",
                  entity_id: emitCtx.sessionId ?? "unknown",
                  entity_label: `${t.capability ?? "unknown"}:${t.name}`,
                },
                data: {
                  session_id: emitCtx.sessionId ?? "unknown",
                  capability: t.capability ?? "unknown",
                  tool: t.name,
                  latency_ms: Date.now() - start,
                  success: true,
                },
              },
            });
            return result;
          } catch (err) {
            await emit({
              event: "botsson.tool_failed",
              workspace_id: emitCtx.workspaceId ?? null,
              actor_id: emitCtx.profileId ?? "unknown",
              correlation_id: emitCtx.requestId,
              properties: {
                entity: {
                  entity_type: "agent_session",
                  entity_id: emitCtx.sessionId ?? "unknown",
                  entity_label: `${t.capability ?? "unknown"}:${t.name}`,
                },
                data: {
                  session_id: emitCtx.sessionId ?? "unknown",
                  capability: t.capability ?? "unknown",
                  tool: t.name,
                  latency_ms: Date.now() - start,
                  error_message: err instanceof Error ? err.message : String(err),
                },
              },
            });
            throw err;
          }
        },
      }),
    ]),
  );
}
