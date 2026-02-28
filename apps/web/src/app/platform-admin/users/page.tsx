import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { UsersClient, type UserRow } from "./_components/users-client";

export default async function UsersPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();

  // Fetch users and profile counts in parallel
  const [usersResult, profilesResult] = await Promise.all([
    admin
      .from("user_identity")
      .select(
        "user_id, email, first_name, last_name, is_super_admin, is_active, last_login_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(250),
    admin.from("profile").select("user_id"),
  ]);

  const users = usersResult.data ?? [];
  const profiles = profilesResult.data ?? [];

  // Count workspaces (profiles) per user
  const workspaceCountMap = new Map<string, number>();
  for (const p of profiles) {
    workspaceCountMap.set(p.user_id, (workspaceCountMap.get(p.user_id) ?? 0) + 1);
  }

  const usersWithWorkspaces: UserRow[] = users.map((u) => ({
    user_id: u.user_id,
    email: u.email,
    first_name: u.first_name,
    last_name: u.last_name,
    is_super_admin: u.is_super_admin,
    is_active: u.is_active,
    last_login_at: u.last_login_at,
    created_at: u.created_at,
    workspace_count: workspaceCountMap.get(u.user_id) ?? 0,
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold">Users</h1>
      <p className="text-muted-foreground mt-1 text-sm">All platform users across workspaces</p>

      <div className="mt-6">
        <UsersClient users={usersWithWorkspaces} />
      </div>
    </div>
  );
}
