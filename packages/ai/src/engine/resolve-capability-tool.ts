// packages/ai/src/engine/resolve-capability-tool.ts
//
// ADR-0424 resolver layer: maps (capability_name, tool_name) to a callable
// that the engine-dispatch `invoke_capability_tool` handler can invoke.
//
// Why a separate module: the LLM router builds toolsets via getAllCapabilities()
// and tool-selector. Engine-dispatch must call tool bodies without going through
// the LLM — we expose the minimal callable surface without duplicating
// registry ownership.
//
// Per ADR-0424 handler invariants:
//   - The CALLER (engine-dispatch handler, T-Handler track) is responsible for
//     gate_action invocation BEFORE calling execute().
//   - The CALLER is responsible for recursion-depth enforcement (depth=1).
//   - This resolver does NOT gate, does NOT emit — it only resolves.
//
// Per L-0177: returns null on unknown capability or unknown tool.
// The engine-dispatch handler MUST fail-fast on null (never silently no-op).

import type { z } from "zod";
import { getCapability } from "../capabilities/registry.js";
import type { AgentToolContext } from "../capabilities/types.js";

/**
 * The shape returned by resolveCapabilityTool.
 *
 * execute() wraps the underlying SmartoutTool.execute() — which returns
 * Promise<string> — into a discriminated union so the engine-dispatch
 * handler can distinguish success from error without try/catch at the
 * call site.
 */
export type ResolvedCapabilityTool = {
  capabilityName: string;
  toolName: string;
  /** Zod schema from the underlying tool definition. */
  inputSchema: z.ZodTypeAny;
  /**
   * Invoke the tool body with pre-parsed input and a fully-hydrated
   * AgentToolContext. Returns a discriminated union per ADR-0424 §5.
   *
   * NOTE: caller must have already invoked gate_action before calling this.
   * NOTE: input must be validated against inputSchema by the caller (or
   *       pass the raw engine action.args — this function does NOT validate).
   */
  execute: (
    input: unknown,
    ctx: AgentToolContext,
  ) => Promise<{ ok: true; result: string } | { ok: false; error: string }>;
};

/**
 * Resolve a (capability, tool) pair to a callable matching the engine-dispatch
 * contract defined in ADR-0424.
 *
 * Returns null when:
 *   - capability is not registered in the capability registry, OR
 *   - tool is not present in capability.tools
 *
 * The engine-dispatch handler MUST fail-fast on null per L-0177 (no silent no-op).
 *
 * Per ADR-0424 + ADR-0356: this function does NOT invoke gate_action.
 * The handler MUST gate before calling the returned execute().
 */
export function resolveCapabilityTool(
  capabilityName: string,
  toolName: string,
): ResolvedCapabilityTool | null {
  const capability = getCapability(capabilityName as Parameters<typeof getCapability>[0]);
  if (!capability) {
    return null;
  }

  // Search the full tools array (not readOnlyTools / suggestTools subsets) so
  // engine-dispatch can invoke any tool the blueprint authorises, regardless of
  // which authority bucket it lives in. The gate_action call in the handler is
  // the enforcement layer — the resolver must not pre-filter by authority.
  const tool = capability.tools.find((t) => t.name === toolName);
  if (!tool) {
    return null;
  }

  return {
    capabilityName: capability.name,
    toolName: tool.name,
    inputSchema: tool.schema as z.ZodTypeAny,
    execute: async (input, ctx) => {
      try {
        // SmartoutTool.execute() returns Promise<string>.
        // Validate input against the tool schema before calling execute to
        // surface Zod errors as { ok: false } rather than thrown exceptions.
        const parsed = (tool.schema as z.ZodTypeAny).safeParse(input);
        if (!parsed.success) {
          return {
            ok: false,
            error: `input validation failed: ${parsed.error.message}`,
          };
        }
        // Cast is safe: tool.execute is (z.infer<TSchema>, TCtx) => Promise<string>
        // and we have parsed the input against the same schema.
        const result = await (
          tool.execute as (params: unknown, ctx: AgentToolContext) => Promise<string>
        )(parsed.data, ctx);
        return { ok: true, result };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, error: message };
      }
    },
  };
}
