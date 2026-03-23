import { z } from "zod";

const contentTaskSchema = z.object({
  type: z.enum(["upload_photo", "write_post", "update_quote", "custom"]),
  frequency: z.enum(["weekly", "biweekly", "monthly"]),
  deadlineDay: z.number().min(0).max(6).default(4), // 0=Mon, 4=Fri
  instructions: z.string().default(""),
  enabled: z.boolean().default(true),
});

export const spokespersonContentSchema = z.object({
  profileId: z.string().uuid().optional(),
  roleTitle: z.string().default(""),
  quote: z.string().default(""),
  bio: z.string().default(""),
  imageAssetId: z.string().uuid().optional(),
  contentTasks: z.array(contentTaskSchema).default([]),
});

export type SpokespersonContent = z.infer<typeof spokespersonContentSchema>;
export type ContentTask = z.infer<typeof contentTaskSchema>;

export const spokespersonDefaults: SpokespersonContent = {
  roleTitle: "",
  quote: "",
  bio: "",
  contentTasks: [],
};
