// packages/ai/src/capabilities/profile/tools.ts
import { z } from "zod";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";
import type { SupabaseClient } from "@supabase/supabase-js";

export const getProfile = defineTool({
  name: "get_profile",
  description:
    "Get the current employee's profile information including name, role, department, team, and status.",
  schema: z.object({}),
  execute: async (_params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin as SupabaseClient;
    const { data, error } = await supabase
      .from("profile")
      .select(
        "profile_id, display_name, role, status, department:department_id(name), team:team_id(name)",
      )
      .eq("profile_id", ctx.profileId)
      .single();

    if (error || !data) return "Could not load profile.";
    return JSON.stringify(data);
  },
});

export const getTeam = defineTool({
  name: "get_team",
  description: "Get information about the employee's team including team members and team leader.",
  schema: z.object({}),
  execute: async (_params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin as SupabaseClient;

    const { data: profile } = await supabase
      .from("profile")
      .select("team_id")
      .eq("profile_id", ctx.profileId)
      .single();

    if (!profile?.team_id) return "Employee is not assigned to a team.";

    const { data: team, error } = await supabase
      .from("team")
      .select("name, leader_profile_id")
      .eq("team_id", profile.team_id)
      .single();

    if (error || !team) return "Could not load team information.";

    const { data: members } = await supabase
      .from("profile")
      .select("profile_id, display_name, role")
      .eq("team_id", profile.team_id)
      .eq("is_active", true);

    return JSON.stringify({ team, members: members ?? [] });
  },
});

export const getContractStatus = defineTool({
  name: "get_contract_status",
  description: "Get the current status of the employee's employment contract.",
  schema: z.object({}),
  execute: async (_params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin as SupabaseClient;
    const { data, error } = await supabase
      .from("employment_contract")
      .select("contract_id, status, signed_at, starts_at, ends_at")
      .eq("profile_id", ctx.profileId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return "No contract found for this employee.";
    return JSON.stringify(data);
  },
});
