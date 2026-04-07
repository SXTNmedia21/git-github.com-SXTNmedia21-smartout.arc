// packages/ai/src/schemas/onboarding.ts
import { z } from "zod";

/**
 * Structured output schema for onboarding intelligence extraction.
 * 1:1 parity with Python OnboardingIntelligence Pydantic model.
 * Used with generateObject() for guaranteed structured output.
 *
 * NOTE (2026-04-07): Field-level `.describe()` calls were removed because
 * OpenRouter's structured-output bridge to Anthropic models rejects
 * JSON-schema descriptions with "Provider returned error". Same root cause
 * as the intent-classifier bug. The describes are preserved as JSDoc on
 * each field below; they document the same intent without breaking the
 * wire format. The system prompt in `agents/onboarding.ts` already
 * instructs the model what each field means. See ADR-0073 addendum.
 *
 * Field guide (formerly Zod describes):
 *   company_name        — The name of the business
 *   vibe                — The concept or vibe of the business
 *   general_manager     — Daglig leder (general manager)
 *   hr_manager          — Personalansvarig (HR manager)
 *   fire_safety_manager — Brannansvarig (fire safety manager)
 *   current_season      — Current operating season
 *   departments         — List of departments (e.g., Kitchen, Floor, Bar)
 *   teams               — List of teams
 *   locations           — List of physical locations
 *   zones               — List of zones within locations
 *   assets_with_haccp   — Assets requiring HACCP controls or routines
 */
export const OnboardingIntelligenceSchema = z.object({
  company_name: z.string().nullable(),
  vibe: z.string().nullable(),
  general_manager: z.string().nullable(),
  hr_manager: z.string().nullable(),
  fire_safety_manager: z.string().nullable(),
  current_season: z.string().nullable(),
  departments: z.array(z.string()),
  teams: z.array(z.string()),
  locations: z.array(z.string()),
  zones: z.array(z.string()),
  assets_with_haccp: z.array(z.string()),
});

export type OnboardingIntelligence = z.infer<typeof OnboardingIntelligenceSchema>;
