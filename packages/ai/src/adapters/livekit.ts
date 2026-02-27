// packages/ai/src/adapters/livekit.ts
import type { SmartoutTool } from "../types";

/**
 * Function signature matching LiveKit's llm.tool().
 * Avoids importing @livekit/agents so this file compiles without the dependency.
 */
type LiveKitToolFactory = (config: {
  description: string;
  parameters: unknown;
  execute: (
    params: Record<string, unknown>,
    opts: { ctx: unknown },
  ) => Promise<unknown>;
}) => unknown;

/**
 * Converts SmartoutTool[] to LiveKit agent tool format.
 * Uses `parameters` (LiveKit convention) from the tool's Zod schema.
 *
 * Requires @livekit/agents to be installed in the consuming app.
 *
 * Usage:
 *   import { llm } from '@livekit/agents';
 *   import { toLiveKitTools } from '@smartout/ai/adapters/livekit';
 *   import { ONBOARDING_TOOLS } from '@smartout/ai';
 *
 *   const tools = toLiveKitTools(ONBOARDING_TOOLS, ctx, llm.tool);
 *
 * @param tools - Array of framework-agnostic tool definitions
 * @param ctx - The context object passed to each tool's execute function
 * @param createTool - The llm.tool function from @livekit/agents
 * @returns Record of tool name -> LiveKit tool, ready for voice.Agent
 */
export function toLiveKitTools<TCtx>(
  tools: ReadonlyArray<SmartoutTool<TCtx>>,
  ctx: TCtx,
  createTool: LiveKitToolFactory,
): Record<string, unknown> {
  return Object.fromEntries(
    tools.map((t) => [
      t.name,
      createTool({
        description: t.description,
        parameters: t.schema,
        execute: async (params) => t.execute(params, ctx),
      }),
    ]),
  );
}
