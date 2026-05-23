// packages/ai/src/types.ts
import type { z } from "zod";
import type { ToolSurfaceConstraints } from "./harness/types.js";

/**
 * Framework-agnostic tool definition.
 * Compatible with both Vercel AI SDK (via toVercelTools) and LiveKit (via toLiveKitTools).
 *
 * @typeParam TCtx - The context type passed to execute (e.g., SessionContext)
 * @typeParam TSchema - The Zod schema type for input validation
 */
export type SmartoutTool<TCtx = unknown, TSchema extends z.ZodType = z.ZodType> = {
  name: string;
  description: string;
  /**
   * Capability category this tool belongs to. Populated by each capability's tool registry.
   * Used by toVercelTools adapter for auto-emit telemetry routing (ADR-0116).
   */
  capability?: string;
  /**
   * ADR-0399 — Surface constraints declared at definition time.
   * Optional — absent means unconstrained (both channels, both platforms).
   * Harness pre-filter reads this when building ClientToolDefinition for a session.
   * See {@link ToolSurfaceConstraints} in packages/ai/src/harness/types.ts.
   */
  surfaceConstraints?: ToolSurfaceConstraints;
  schema: TSchema;
  execute: (params: z.infer<TSchema>, ctx: TCtx) => Promise<string>;
};

// Re-export so capability authors can import ToolSurfaceConstraints from the same module.
export type { ToolSurfaceConstraints };

/**
 * Type-safe tool definition helper.
 * Infers TSchema from the schema property and TCtx from the execute ctx annotation.
 *
 * Usage:
 *   const myTool = defineTool({
 *     name: 'my_tool',
 *     description: '...',
 *     schema: z.object({ input: z.string() }),
 *     execute: async ({ input }, ctx: SessionContext) => { ... },
 *   });
 */
export function defineTool<TCtx, TSchema extends z.ZodType>(
  tool: SmartoutTool<TCtx, TSchema>,
): SmartoutTool<TCtx, TSchema> {
  return tool;
}
