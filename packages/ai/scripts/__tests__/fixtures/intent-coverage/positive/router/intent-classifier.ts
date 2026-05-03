// Fixture — matching enum with allow-listed fall-throughs.
import { z } from "zod";

export const intentSchema = z.object({
  intent: z.string(),
  capability: z.enum(["profile", "schedule", "ui", "knowledge", "payroll", "general"] as const),
});
