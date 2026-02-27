import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export default async function WorkspaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const { id } = await params;
  const admin = createAdminClient();

  const { data: workspace } = await admin
    .from("workspace")
    .select("*, company:company_id (*)")
    .eq("workspace_id", id)
    .single();

  if (!workspace) redirect("/platform-admin/workspaces");

  // Parallel count queries using profile.status enum
  const [
    { count: totalProfiles },
    { count: activeProfiles },
    { count: traineeProfiles },
    { count: departmentCount },
  ] = await Promise.all([
    admin.from("profile").select("*", { count: "exact", head: true }).eq("workspace_id", id),
    admin
      .from("profile")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", id)
      .eq("status", "active"),
    admin
      .from("profile")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", id)
      .eq("status", "trainee"),
    admin.from("department").select("*", { count: "exact", head: true }).eq("workspace_id", id),
  ]);

  const company = workspace.company as Record<string, unknown> | null;

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-semibold">{workspace.name}</h1>
        <Badge variant="outline" className="capitalize">
          {(company?.subscription_status as string) || "unknown"}
        </Badge>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-muted-foreground text-xs uppercase">Profiles</p>
          <p className="text-2xl font-semibold">{totalProfiles || 0}</p>
          <p className="text-muted-foreground text-xs">
            {activeProfiles || 0} active, {traineeProfiles || 0} trainee
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-muted-foreground text-xs uppercase">Departments</p>
          <p className="text-2xl font-semibold">{departmentCount || 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-muted-foreground text-xs uppercase">Plan</p>
          <p className="text-2xl font-semibold capitalize">
            {(company?.subscription_plan as string) || "\u2014"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-muted-foreground text-xs uppercase">Created</p>
          <p className="text-lg font-semibold">
            {new Date(workspace.created_at).toLocaleDateString("no-NO")}
          </p>
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="mb-4 text-lg font-medium">Company Info</h2>
        <div className="border-border rounded-md border p-4">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Name</dt>
              <dd>{(company?.name as string) || "\u2014"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Org Number</dt>
              <dd className="font-mono">{(company?.org_number as string) || "\u2014"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">City</dt>
              <dd>{(company?.city as string) || "\u2014"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Industry</dt>
              <dd className="capitalize">{(company?.industry as string) || "\u2014"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd>{(company?.email as string) || "\u2014"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Phone</dt>
              <dd>{(company?.phone as string) || "\u2014"}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
