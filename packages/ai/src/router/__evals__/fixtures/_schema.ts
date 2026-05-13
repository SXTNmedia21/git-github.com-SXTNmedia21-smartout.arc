import { z } from "zod";

/**
 * Eval fixture — one labeled example of what the router should do.
 *
 * A fixture is the smallest unit of measurement: a realistic user message,
 * the context Botsson would see, and the capability we expect the
 * classifier to pick. Fixtures live next to the code they evaluate so a
 * new capability's first PR should add fixtures in the same commit.
 */
export const capabilityEnum = z.enum([
  "knowledge",
  "schedule",
  "training",
  "operations",
  "profile",
  "communication",
  "memory",
  "payroll",
  "ui",
  "guardian",
  "task",
  "general",
]);

export type Capability = z.infer<typeof capabilityEnum>;

export const fixtureSchema = z.object({
  /** Stable ID used in reports and regression tracking. `<capability>-<short-slug>`. */
  id: z.string().min(1),

  /** Optional longer description of what this fixture is checking. */
  note: z.string().optional(),

  /** The user's actual message, as it would arrive at the classifier. */
  message: z.string().min(1),

  /** Employee/workspace context string that the classifier also sees. */
  context: z.string(),

  /** What the router should classify this as. */
  expected: z.object({
    capability: capabilityEnum,
    /**
     * Minimum confidence we expect. If actual < min, the fixture is a
     * soft fail (the classification may still be right but the model
     * hedged). Use this for ambiguous-but-answerable cases.
     */
    minConfidence: z.number().min(0).max(1).default(0.6),
  }),

  /**
   * Tags for slicing eval reports. E.g. ["norwegian", "shift-swap", "ambiguous"].
   * Tags are free-form but should be reused where possible.
   */
  tags: z.array(z.string()).default([]),
});

export type Fixture = z.infer<typeof fixtureSchema>;

export const fixtureFileSchema = z.object({
  /** Package/module this fixture set belongs to. */
  suite: z.string().min(1),
  fixtures: z.array(fixtureSchema).min(1),
});

export type FixtureFile = z.infer<typeof fixtureFileSchema>;
