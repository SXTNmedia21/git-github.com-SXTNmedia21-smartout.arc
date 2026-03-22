/**
 * Shared hook for fetching absence types for the current user's workspace.
 *
 * Extracted from AbsenceBalanceScreen and AbsenceRequestScreen which both
 * needed the same query. Using a shared hook ensures the data is cached
 * under one query key and never fetched twice in the same session.
 *
 * staleTime: Infinity — absence types rarely change within a session.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Database } from "@smartout/supabase/database.types";

export type AbsenceType = Database["payroll"]["Tables"]["absence_type"]["Row"];

/** Fetches active absence types for the current user's workspace, ordered by sort_order */
async function fetchAbsenceTypes(workspaceId: string): Promise<AbsenceType[]> {
  const { data, error } = await supabase
    .schema("payroll")
    .from("absence_type")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** Resolves the current user's workspace ID — required before fetching types */
async function resolveWorkspaceId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile, error } = await supabase
    .from("profile")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (error) throw error;
  return profile.workspace_id;
}

/**
 * Returns active absence types for the current workspace.
 *
 * Uses staleTime: Infinity because types (Ferie, Egenmelding, Omsorgsdager)
 * are workspace configuration — they don't change during a normal user session.
 */
export function useAbsenceTypes() {
  return useQuery<AbsenceType[]>({
    queryKey: ["absence-types"],
    queryFn: async () => {
      const workspaceId = await resolveWorkspaceId();
      return fetchAbsenceTypes(workspaceId);
    },
    staleTime: Infinity,
    retry: 1,
  });
}
