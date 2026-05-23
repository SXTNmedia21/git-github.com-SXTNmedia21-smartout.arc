// Shared routine-draft contract for 2B (bilde→rutine). Imported by the
// stage-engine extract route, the commit BFF route, and tests.
import { z } from "zod";

export const DraftStepSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(""),
  is_required: z.boolean().default(true),
  estimated_minutes: z.number().int().min(1).nullable().default(null),
});

export const DraftSchema = z.object({
  routine_name: z.string().min(1).max(200),
  trigger_guess: z.object({
    trigger_type: z.enum(["scheduled", "event"]),
    trigger_config: z.record(z.unknown()).default({}),
  }),
  location_hint: z.string().max(200).nullable().default(null),
  steps: z.array(DraftStepSchema).min(1).max(50),
});

export type RoutineDraft = z.infer<typeof DraftSchema>;
export type RoutineDraftStep = z.infer<typeof DraftStepSchema>;
