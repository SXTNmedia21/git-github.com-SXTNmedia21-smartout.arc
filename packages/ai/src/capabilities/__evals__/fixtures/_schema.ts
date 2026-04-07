import { z } from "zod";

/**
 * Tool-call fixture schema.
 *
 * One labeled example for capability-level evals. Each fixture says:
 * "given this prompt, the agent should call THIS tool with these args".
 *
 * Fixtures live next to the capability they test. New capability =
 * new __evals__/fixtures/<capability>-seed.ts.
 */

export const fixtureSchema = z.object({
  /** Stable ID for regression tracking. `<capability>-<short-slug>`. */
  id: z.string().min(1),

  /** Optional human note about what this fixture is checking. */
  note: z.string().optional(),

  /** The user's actual message. */
  prompt: z.string().min(1),

  /** Context block that the agent would normally see. */
  context: z.string(),

  /**
   * What the agent is expected to do.
   *
   * - `toolName` must match exactly.
   * - `args` is partial: only the keys listed are checked, and only by
   *   strict equality for primitives. Omit `args` (or pass `{}`) when
   *   the tool takes no required arguments and you only care about
   *   tool selection, not arg values.
   */
  expected: z.object({
    toolName: z.string().min(1),
    args: z.record(z.string(), z.unknown()).optional(),
  }),

  /** Free-form tags for slicing reports (e.g. ["norwegian", "ambiguous"]). */
  tags: z.array(z.string()).default([]),
});

export type Fixture = z.infer<typeof fixtureSchema>;

export const fixtureFileSchema = z.object({
  suite: z.string().min(1),
  fixtures: z.array(fixtureSchema).min(1),
});

export type FixtureFile = z.infer<typeof fixtureFileSchema>;
