import type { SupabaseClient } from "@supabase/supabase-js";

type ProfileRow = {
  profile_id: string;
  display_name: string;
  job_title: string | null;
  role: string;
  status: string;
  avatar_url: string | null;
  department_id: string | null;
  departments: string[] | null;
  address_line_1: string | null;
  postal_code: string | null;
  city: string | null;
  personal_number: string | null;
  bank_account: string | null;
  is_active: boolean;
  department: { name: string } | null;
  user_identity: {
    email: string;
    phone: string | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
  } | null;
};

type InvitationRow = {
  invitation_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  department_ids: string[] | null;
  status: string;
  token: string;
  expires_at: string;
  invite_type: string | null;
};

type ReadinessRow = {
  profile_id: string;
  total: number;
  completed: number;
};

export type FetchPeopleResult = {
  profiles: ProfileRow[];
  departments: { department_id: string; name: string }[];
  invitations: InvitationRow[];
  readinessMap: Map<string, number>;
  contractProfileIds: Set<string>;
};

/**
 * Fetches all people data for a workspace in parallel:
 * profiles, departments, invitations, readiness scores, and contract status.
 * Shared between web dashboard and mobile app.
 */
export async function fetchWorkspacePeople(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<FetchPeopleResult> {
  const [profilesRes, deptsRes, invitesRes, readinessRes, contractsRes] = await Promise.all([
    supabase
      .from("profile")
      .select(
        `profile_id, display_name, job_title, role, status, avatar_url,
         department_id, departments, address_line_1, postal_code, city,
         personal_number, bank_account, is_active,
         department:department_id(name),
         user_identity:user_id(email, phone, emergency_contact_name, emergency_contact_phone)`,
      )
      .eq("workspace_id", workspaceId)
      .returns<ProfileRow[]>(),
    supabase
      .from("department")
      .select("department_id, name")
      .eq("workspace_id", workspaceId)
      .order("sort_order"),
    supabase
      .from("invitation")
      .select(
        "invitation_id, email, first_name, last_name, role, department_ids, status, token, expires_at, invite_type",
      )
      .eq("workspace_id", workspaceId)
      .eq("status", "pending")
      .returns<InvitationRow[]>(),
    supabase.rpc("get_workspace_readiness", {
      p_workspace_id: workspaceId,
    }),
    supabase
      .from("employment_contract")
      .select("profile_id")
      .eq("workspace_id", workspaceId)
      .eq("status", "signed"),
  ]);

  // Build readiness map: profile_id → percentage
  const readinessMap = new Map<string, number>();
  if (readinessRes.data) {
    for (const row of readinessRes.data as ReadinessRow[]) {
      readinessMap.set(
        row.profile_id,
        row.total > 0 ? Math.round((row.completed / row.total) * 100) : 0,
      );
    }
  }

  // Build contract set: profile_ids with signed contracts
  const contractProfileIds = new Set<string>();
  if (contractsRes.data) {
    for (const row of contractsRes.data) {
      contractProfileIds.add((row as { profile_id: string }).profile_id);
    }
  }

  return {
    profiles: profilesRes.data ?? [],
    departments: deptsRes.data ?? [],
    invitations: invitesRes.data ?? [],
    readinessMap,
    contractProfileIds,
  };
}
