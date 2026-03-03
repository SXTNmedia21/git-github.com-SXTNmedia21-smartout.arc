import { z } from "zod";
import { LocationTypeEnum, TeamTypeEnum, ProfileRoleEnum } from "./enums.js";

export const DepartmentSchema = z.object({
  department_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullish(),
  color: z.string().nullish(),
  icon: z.string().nullish(),
  sort_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullish(),
});
export type Department = z.infer<typeof DepartmentSchema>;

export const LocationSchema = z.object({
  location_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullish(),
  address: z.string().nullish(),
  latitude: z.number().nullish(),
  longitude: z.number().nullish(),
  floor: z.string().nullish(),
  capacity: z.number().int().nullish(),
  location_type: LocationTypeEnum,
  sort_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullish(),
});
export type Location = z.infer<typeof LocationSchema>;

export const ZoneSchema = z.object({
  zone_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  location_id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullish(),
  capacity: z.number().int().nullish(),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullish(),
});
export type Zone = z.infer<typeof ZoneSchema>;

export const AssetSchema = z.object({
  asset_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  location_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullish(),
  requires_training: z.boolean().default(false),
  requires_routine: z.boolean().default(false),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullish(),
});
export type Asset = z.infer<typeof AssetSchema>;

export const PositionSchema = z.object({
  position_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  department_id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullish(),
  skill_requirements: z.record(z.any()).nullish(), // jsonb
  minimum_role: ProfileRoleEnum.nullish(),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullish(),
});
export type Position = z.infer<typeof PositionSchema>;

export const TeamSchema = z.object({
  team_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  department_id: z.string().uuid().nullish(),
  season_id: z.string().uuid().nullish(),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullish(),
  color: z.string().nullish(),
  icon: z.string().nullish(),
  leader_profile_id: z.string().uuid().nullish(),
  team_type: TeamTypeEnum,
  is_active: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullish(),
});
export type Team = z.infer<typeof TeamSchema>;

export const TeamMemberSchema = z.object({
  team_member_id: z.string().uuid(),
  team_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullish(),
});
export type TeamMember = z.infer<typeof TeamMemberSchema>;
