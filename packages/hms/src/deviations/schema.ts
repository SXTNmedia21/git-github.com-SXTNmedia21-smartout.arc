import { z } from "zod";

/** Must match public.deviation_domain enum in DB */
export const deviationDomainValues = [
  "safety",
  "customer",
  "procedure",
  "system",
  "material",
] as const;

/** Must match public.deviation_severity enum in DB */
export const deviationSeverityValues = ["low", "medium", "high", "critical"] as const;

export const DeviationPayloadSchema = z.object({
  title: z.string().min(1).max(500),
  domain: z.enum(deviationDomainValues),
  severity: z.enum(deviationSeverityValues),
  description: z.string().max(2000).optional(),
  workspace_id: z.string().uuid(),
  department_id: z.string().uuid().nullable().optional(),
  session_id: z.string().uuid().nullable().optional(),
  source_task_id: z.string().uuid().nullable().optional(),
  procedure_id: z.string().uuid().nullable().optional(),
  protocol_id: z.string().uuid().nullable().optional(),
  linked_shift_id: z.string().uuid().nullable().optional(),
  reported_by: z.string().uuid().nullable().optional(),
});

export type DeviationPayload = z.infer<typeof DeviationPayloadSchema>;
export type DeviationDomain = (typeof deviationDomainValues)[number];
export type DeviationSeverity = (typeof deviationSeverityValues)[number];
