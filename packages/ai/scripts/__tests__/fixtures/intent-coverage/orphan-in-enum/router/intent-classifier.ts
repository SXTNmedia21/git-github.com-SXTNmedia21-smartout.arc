// Fixture — 'phantom_capability' is in the enum but nowhere else.
import { z } from "zod";

export const intentSchema = z.object({
  capability: z.enum(["profile", "phantom_capability", "knowledge", "general"] as const),
});
