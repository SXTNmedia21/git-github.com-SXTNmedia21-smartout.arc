import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";

export default async function UsersPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: users } = await admin
    .from("user_identity")
    .select(
      "user_id, email, first_name, last_name, is_super_admin, is_active, last_login_at, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Users</h1>
      <p className="text-muted-foreground mt-1 text-sm">All platform users</p>

      <div className="border-border mt-6 rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border text-muted-foreground border-b text-left text-xs tracking-wider uppercase">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Last Login</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((user) => (
              <tr key={user.user_id} className="border-border border-b last:border-0">
                <td className="px-4 py-3 font-medium">
                  {user.first_name} {user.last_name}
                </td>
                <td className="text-muted-foreground px-4 py-3">{user.email}</td>
                <td className="px-4 py-3">
                  {user.is_super_admin && (
                    <Badge
                      variant="outline"
                      className="border-purple-500/20 bg-purple-500/10 text-xs text-purple-400"
                    >
                      Super Admin
                    </Badge>
                  )}
                </td>
                <td className="text-muted-foreground px-4 py-3">
                  {user.last_login_at
                    ? new Date(user.last_login_at).toLocaleDateString("no-NO")
                    : "Never"}
                </td>
                <td className="text-muted-foreground px-4 py-3">
                  {new Date(user.created_at).toLocaleDateString("no-NO")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
