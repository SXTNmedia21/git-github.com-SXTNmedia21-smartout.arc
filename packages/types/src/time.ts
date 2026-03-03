import { z } from "zod";
import { SeasonTypeEnum, SeasonStatusEnum } from "./enums.js";

export const SeasonSchema = z.object({
  season_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  parent_season_id: z.string().uuid().nullish(),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullish(),
  season_type: SeasonTypeEnum.default("default"),
  start_date: z.string().nullish(), // date string
  end_date: z.string().nullish(), // date string
  status: SeasonStatusEnum.default("draft"),
  is_default: z.boolean().default(false),
  color: z.string().nullish(),
  icon: z.string().nullish(),
  created_by: z.string().uuid().nullish(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullish(),
});
export type Season = z.infer<typeof SeasonSchema>;
