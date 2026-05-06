// packages/ai/src/adapters/vercel-ai.ts
import { tool } from "ai";
import { emit } from "@smartout/telemetry";
import { nonEmpty } from "@smartout/telemetry/server";
import type { SmartoutTool } from "../types.js";

type EmitContext = {
  workspaceId?: string;
  profileId?: string;
  sessionId?: string;
  requestId?: string;
};

/**
 * SMA-301: OpenRouter (Anthropic / Bedrock upstream) enforces tool-name
 * pattern `^[a-zA-Z0-9_-]{1,128}$`. Some tools were authored with dotted
 * names (`season.get_readiness`, `tips.set_pot`) which Bedrock rejects with
 * 400 "tools.N.custom.name: String should match pattern". We sanitize at
 * the wire boundary — internal registry/authority keys keep dotted form
 * (used as `capability` in `gate_action` and ADR-0195 per-tool authority);
 * only the LLM-visible name is rewritten by replacing `.` with `__`.
 *
 * Two-underscore separator was chosen over single underscore to keep the
 * dotted-vs-flat distinction visually obvious in logs and to avoid
 * collisions with existing snake_case tool names (e.g. `season_get_readiness`
 * is unlikely but `season__get_readiness` is unique to sanitized output).
 */
function sanitizeToolName(name: string): string {
  return name.includes(".") ? name.replace(/\./g, "__") : name;
}

/**
 * Converts SmartoutTool[] to Vercel AI SDK tool format.
 * Uses `inputSchema` (Vercel AI SDK convention) from the tool's Zod schema.
 *
 * Auto-emits `botsson.tool_invoked` / `botsson.tool_failed` per invocation
 * (ADR-0116). Context fields (workspaceId, profileId, sessionId) are read
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
      sanitizeToolName(t.name),
      tool({
        description: t.description,
        inputSchema: t.schema,
        execute: async (params) => {
          const start = Date.now();
          try {
            const result = await t.execute(params, ctx);
            await emit({
              event: "botsson.tool_invoked",
              workspace_id: emitCtx.workspaceId
                ? nonEmpty(emitCtx.workspaceId, "workspace_id")
                : null,
              actor_id: nonEmpty(emitCtx.profileId ?? "unknown", "actor_id"),
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
              workspace_id: emitCtx.workspaceId
                ? nonEmpty(emitCtx.workspaceId, "workspace_id")
                : null,
              actor_id: nonEmpty(emitCtx.profileId ?? "unknown", "actor_id"),
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
