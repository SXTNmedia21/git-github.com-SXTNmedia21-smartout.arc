// packages/ai/src/schemas/onboarding.ts
import { z } from "zod";

/**
 * Structured output schema for onboarding intelligence extraction.
 * 1:1 parity with Python OnboardingIntelligence Pydantic model.
 * Used with generateObject() for guaranteed structured output.
 */
export const OnboardingIntelligenceSchema = z.object({
  company_name: z.string().nullable().describe("The name of the business"),
  vibe: z.string().nullable().describe("The concept or vibe of the business"),
  general_manager: z.string().nullable().describe("Daglig leder (general manager)"),
  hr_manager: z.string().nullable().describe("Personalansvarig (HR manager)"),
  fire_safety_manager: z.string().nullable().describe("Brannansvarig (fire safety manager)"),
  current_season: z.string().nullable().describe("Current operating season"),
  departments: z.array(z.string()).describe("List of departments (e.g., Kitchen, Floor, Bar)"),
  teams: z.array(z.string()).describe("List of teams"),
  locations: z.array(z.string()).describe("List of physical locations"),
  zones: z.array(z.string()).describe("List of zones within locations"),
  assets_with_haccp: z.array(z.string()).describe("Assets requiring HACCP controls or routines"),
});

export type OnboardingIntelligence = z.infer<typeof OnboardingIntelligenceSchema>;
