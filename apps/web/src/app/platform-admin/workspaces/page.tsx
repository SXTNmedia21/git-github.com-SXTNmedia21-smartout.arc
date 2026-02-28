import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { WorkspaceListEnhanced } from "./_components/workspace-list-enhanced";

export default async function WorkspacesPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: workspaces } = await admin
    .from("workspace")
    .select(
      `workspace_id, name, slug, is_active, created_at,
       company:company_id (company_id, name, org_number, subscription_plan, subscription_status)`,
    )
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Workspaces</h1>
      <p className="text-muted-foreground mt-1 text-sm">All workspaces across the platform</p>
      <div className="mt-6">
        <WorkspaceListEnhanced data={workspaces || []} />
      </div>
    </div>
  );
}
