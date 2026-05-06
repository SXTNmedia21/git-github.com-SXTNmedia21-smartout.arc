// Fixture — enum did NOT learn 'shift_lifecycle'.
import { z } from "zod";

export const intentSchema = z.object({
  capability: z.enum(["profile", "schedule", "general"] as const),
});
