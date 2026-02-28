import { z } from "zod";

export const createTemplateSchema = z.object({
  workspace_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  contract_type: z.enum(["client", "employee", "haccp", "training", "season", "custom"]),
  language: z.string().default("no"),
  content_html: z.string().min(1),
  content_css: z.string().optional(),
  header_html: z.string().optional(),
  footer_html: z.string().optional(),
  accent_color: z.string().default("#FF6B35"),
  placeholders: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        source: z.enum([
          "workspace",
          "workspace.company",
          "subscription",
          "auto",
          "manual",
          "constant",
        ]),
        default_value: z.string().optional(),
        required: z.boolean().default(false),
      }),
    )
    .default([]),
  is_system: z.boolean().default(false),
});

export const updateTemplateSchema = createTemplateSchema.partial();

export const listTemplatesQuery = z.object({
  workspace_id: z.string().uuid().optional(),
  contract_type: z.string().optional(),
  language: z.string().optional(),
  is_system: z.coerce.boolean().optional(),
  is_active: z.coerce.boolean().optional(),
});
