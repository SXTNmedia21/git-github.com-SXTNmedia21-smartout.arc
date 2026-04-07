import { z } from "zod";

/**
 * Onboarding extraction fixture schema.
 *
 * One labeled example for `extractOnboardingIntelligence`. Each fixture
 * provides a mock conversation history and the fields the model should
 * recover from it. Field assertions are partial — only the keys listed
 * are checked, and only by predicate type:
 *
 *  - `present`: field must be a non-null primitive or non-empty array
 *  - `absent`: field must be null or empty array
 *  - `equals`: field must deep-equal the given primitive or array
 *
 * The intent is NOT to nail down exact strings ("Solsiden Bistro" vs
 * "Solsiden bistro" — capitalization wobble is real). The intent is
 * to verify the model extracts the RIGHT INFORMATION FROM THE RIGHT
 * UTTERANCES.
 */

export const fieldAssertion = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("present") }),
  z.object({ kind: z.literal("absent") }),
  z.object({
    kind: z.literal("equals"),
    value: z.union([z.string(), z.array(z.string()), z.null()]),
  }),
]);

export type FieldAssertion = z.infer<typeof fieldAssertion>;

export const fixtureSchema = z.object({
  id: z.string().min(1),
  note: z.string().optional(),
  /**
   * Mock conversation history. Roles are limited to assistant/user
   * because that's all `extractOnboardingIntelligence` needs.
   */
  conversation: z
    .array(
      z.object({
        role: z.enum(["assistant", "user"]),
        content: z.string().min(1),
      }),
    )
    .min(1),
  /** Per-field assertions. Only listed fields are checked. */
  expected: z.record(z.string(), fieldAssertion),
  tags: z.array(z.string()).default([]),
});

export type Fixture = z.infer<typeof fixtureSchema>;

export const fixtureFileSchema = z.object({
  suite: z.string().min(1),
  fixtures: z.array(fixtureSchema).min(1),
});

export type FixtureFile = z.infer<typeof fixtureFileSchema>;
