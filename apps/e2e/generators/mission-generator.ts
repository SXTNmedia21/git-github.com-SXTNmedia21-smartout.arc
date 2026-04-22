import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import type { JourneyIR } from "@smartout/journey-ir";
import type { ProtocolTestOutput } from "../protocols/types";

/**
 * Schema for the generated mission package.
 * Targets engine_missions + engine_stages DB tables (not registry.ts).
 * All generated missions are drafts — is_active is always false.
 */
export const GeneratedMissionPackageSchema = z.object({
  mission: z.object({
    name: z.string(),
    description: z.string(),
    system_prompt: z.string(),
    mode: z.enum(["sequential", "free", "hybrid"]).default("sequential"),
    language: z.enum(["no", "en", "sv"]).default("no"),
    is_active: z.literal(false),
  }),
  stages: z.array(
    z.object({
      stage_order: z.number(),
      name: z.string(),
      goal: z.string(),
      instructions: z.string(),
      success_criteria: z.string(),
      escalation_instructions: z.string().optional(),
      creative_freedom: z.number().min(0).max(1).default(0.3),
      emotion_hint: z.string().optional(),
      is_required: z.boolean().default(true),
      journey_step_slug: z.string().optional(),
      tool_hints: z.array(z.string()).optional(),
    }),
  ),
  guardrails: z.array(
    z.object({
      stage_order: z.number(),
      description: z.string(),
      source: z.enum(["license", "journey", "observed"]),
    }),
  ),
});

export type GeneratedMissionPackage = z.infer<typeof GeneratedMissionPackageSchema>;

/**
 * Generates a draft mission package from a JourneyIR and a protocol run result.
 *
 * Per ADR-0174 C.3/C.9, this is the canonical generator signature. The
 * legacy `ProtocolDefinition` authoring shape and the migration adapter
 * have been retired (ADR-0174 C.11 closed at M3.5 exit). Callers pass a
 * `JourneyIR` v2 directly.
 */
export function generateMissionFromIR(
  ir: JourneyIR,
  output: ProtocolTestOutput,
  outputDir: string = path.resolve(process.cwd(), "../../docs/missions"),
): string {
  fs.mkdirSync(outputDir, { recursive: true });

  const pkg: GeneratedMissionPackage = {
    mission: {
      name: `${ir.title} Mission`,
      description: `AI-assisted guide for: ${ir.title}. Generated from protocol run.`,
      system_prompt: [
        `Du er en AI-assistent som hjelper brukeren gjennom ${ir.title}.`,
        `Denne misjonen har ${ir.steps.length} steg. Guide brukeren gjennom hvert steg.`,
        "",
        "[HUMAN REVIEW REQUIRED: Enrich with domain knowledge, tone, and tool instructions]",
      ].join("\n"),
      mode: "sequential",
      language: "no",
      is_active: false,
    },
    stages: ir.steps.map((step, i) => ({
      stage_order: i + 1,
      name: step.title,
      goal: step.action,
      instructions: `Guide brukeren gjennom: ${step.title}.\n[HUMAN REVIEW REQUIRED]`,
      success_criteria: step.assertion,
      is_required: true,
      creative_freedom: 0.3,
      journey_step_slug: step.key,
    })),
    // Guardrails derived from db_record gates are now encoded in the
    // JourneyStep.assertion string (prefix "DB record exists in …"). We keep
    // the array for schema parity and surface those assertions as journey-
    // sourced guardrails.
    guardrails: ir.steps
      .map((step, i) => ({ step, i }))
      .filter(({ step }) => step.assertion.startsWith("DB record exists in "))
      .map(({ step, i }) => ({
        stage_order: i + 1,
        description: step.assertion,
        source: "journey" as const,
      })),
  };

  // Validate before writing
  GeneratedMissionPackageSchema.parse(pkg);

  const filePath = path.join(outputDir, `MISSION-DRAFT-${ir.slug}.json`);
  fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2), "utf-8");

  return filePath;
}
