/**
 * useDutyLeader — Fetches the on-duty leader for the current department session.
 *
 * Finds the active department_session for the user's department,
 * reads duty_leader_id (falls back to opened_by), and returns
 * the leader's name + phone number for "Ring sjefen".
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type DutyLeader = {
  profileId: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
};

export function useDutyLeader(departmentId: string | null, workspaceId: string | null) {
  return useQuery({
    queryKey: ["duty-leader", departmentId],
    enabled: !!departmentId && !!workspaceId,
    staleTime: 60_000,
    queryFn: async (): Promise<DutyLeader | null> => {
      if (!departmentId || !workspaceId) return null;

      // Find active session for this department
      const { data: session } = await supabase
        .from("department_session")
        .select("duty_leader_id, opened_by")
        .eq("department_id", departmentId)
        .eq("workspace_id", workspaceId)
        .eq("status", "active")
        .order("session_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!session) return null;

      const leaderId = session.duty_leader_id ?? session.opened_by;
      if (!leaderId) return null;

      // Get leader profile + phone from user_identity
      const { data: leader } = await supabase
        .from("profile")
        .select("profile_id, display_name, avatar_url, user_identity!inner(phone)")
        .eq("profile_id", leaderId)
        .single();

      if (!leader) return null;

      const identity = leader.user_identity as unknown as { phone: string | null };

      return {
        profileId: leader.profile_id,
        name: leader.display_name ?? "Leder",
        phone: identity?.phone ?? null,
        avatarUrl: leader.avatar_url,
      };
    },
  });
}
