// packages/ai/src/adapters/vercel-ai.ts
import { tool } from "ai";
import type { SmartoutTool } from "../types";

/**
 * Converts SmartoutTool[] to Vercel AI SDK tool format.
 * Uses `inputSchema` (Vercel AI SDK convention) from the tool's Zod schema.
 *
 * @param tools - Array of framework-agnostic tool definitions
 * @param ctx - The context object passed to each tool's execute function
 * @returns Record of tool name -> Vercel AI SDK tool, ready for generateText()
 */
export function toVercelTools<TCtx>(
  tools: ReadonlyArray<SmartoutTool<TCtx>>,
  ctx: TCtx,
) {
  return Object.fromEntries(
    tools.map((t) => [
      t.name,
      tool({
        description: t.description,
        inputSchema: t.schema,
        execute: async (params) => t.execute(params, ctx),
      }),
    ]),
  );
}
