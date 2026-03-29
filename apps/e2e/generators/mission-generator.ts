import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import type { ProtocolTestOutput } from "../protocols/types";
import type { ProtocolDefinition } from "../protocols/schema";

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
 * Generates a draft mission package from protocol run results.
 *
 * Produces a scaffolded mission structure based on the protocol steps.
 * The system_prompt and instructions are templates that need human review
 * and enrichment before being inserted into engine_missions/engine_stages.
 */
export function generateMissionDraft(
  protocol: ProtocolDefinition,
  output: ProtocolTestOutput,
  outputDir: string = path.resolve(process.cwd(), "../../docs/missions"),
): string {
  fs.mkdirSync(outputDir, { recursive: true });

  const pkg: GeneratedMissionPackage = {
    mission: {
      name: `${protocol.name} Mission`,
      description: `AI-assisted guide for: ${protocol.name}. Generated from protocol run.`,
      system_prompt: [
        `Du er en AI-assistent som hjelper brukeren gjennom ${protocol.name}.`,
        `Denne misjonen har ${protocol.steps.length} steg. Guide brukeren gjennom hvert steg.`,
        "",
        "[HUMAN REVIEW REQUIRED: Enrich with domain knowledge, tone, and tool instructions]",
      ].join("\n"),
      mode: "sequential",
      language: "no",
      is_active: false,
    },
    stages: protocol.steps.map((step, i) => ({
      stage_order: i + 1,
      name: step.title,
      goal: step.description,
      instructions: `Guide brukeren gjennom: ${step.title}.\n[HUMAN REVIEW REQUIRED]`,
      success_criteria: formatGateAsCriteria(step.gate),
      is_required: true,
      creative_freedom: 0.3,
      journey_step_slug: step.journey_step_slug,
    })),
    guardrails: protocol.steps
      .filter((s) => s.gate.type === "db_record")
      .map((s) => ({
        stage_order: s.order,
        description: `Gate: ${s.gate.type} on ${(s.gate as { table?: string }).table ?? "unknown"}`,
        source: "journey" as const,
      })),
  };

  // Validate before writing
  GeneratedMissionPackageSchema.parse(pkg);

  const filePath = path.join(outputDir, `MISSION-DRAFT-${protocol.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2), "utf-8");

  return filePath;
}

function formatGateAsCriteria(gate: ProtocolDefinition["steps"][0]["gate"]): string {
  switch (gate.type) {
    case "db_record":
      return `DB record exists in ${gate.table} matching ${JSON.stringify(gate.where)}`;
    case "ui_state":
      return `Element [data-testid="${gate.testid}"] is ${gate.visible ? "visible" : "hidden"}`;
    case "url_match":
      return `URL matches pattern: ${gate.pattern}`;
  }
}
