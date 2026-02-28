import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { WorkspaceDetailClient } from "./_components/workspace-detail-client";

export default async function WorkspaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const { id } = await params;
  const admin = createAdminClient();

  const [
    { data: workspace },
    { count: totalProfiles },
    { count: activeProfiles },
    { count: traineeProfiles },
    { count: departmentCount },
    { data: profiles },
    { data: notes },
    { data: commHistory },
  ] = await Promise.all([
    admin.from("workspace").select("*, company:company_id (*)").eq("workspace_id", id).single(),
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
    admin
      .from("profile")
      .select(
        "profile_id, user_id, display_name, role, status, created_at, user_identity!inner(email, last_login_at)",
      )
      .eq("workspace_id", id)
      .order("created_at", { ascending: false }),
    admin
      .from("platform_audit_log")
      .select("id, action, details, created_at")
      .eq("entity_type", "workspace_note")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("platform_communication_log" as never)
      .select("*")
      .eq("workspace_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (!workspace) redirect("/platform-admin/workspaces");

  const company = workspace.company as Record<string, unknown> | null;

  const profileRows = (profiles ?? []).map((p) => {
    const ui = p.user_identity as unknown as { email: string; last_login_at: string | null };
    return {
      profileId: p.profile_id,
      userId: p.user_id,
      name: p.display_name || "\u2014",
      email: ui.email,
      role: p.role as string,
      status: p.status as string,
      lastLogin: ui.last_login_at,
    };
  });

  return (
    <WorkspaceDetailClient
      workspace={{
        workspaceId: workspace.workspace_id,
        name: workspace.name,
        slug: workspace.slug ?? "",
        createdAt: workspace.created_at,
      }}
      company={
        company
          ? {
              name: (company.name as string) ?? "\u2014",
              orgNumber: (company.org_number as string) ?? "\u2014",
              city: (company.city as string) ?? "\u2014",
              industry: (company.industry as string) ?? "\u2014",
              email: (company.email as string) ?? "\u2014",
              phone: (company.phone as string) ?? "\u2014",
              subscriptionPlan: (company.subscription_plan as string) ?? "\u2014",
              subscriptionStatus: (company.subscription_status as string) ?? "unknown",
              trialEndsAt: (company.trial_ends_at as string) ?? null,
            }
          : null
      }
      stats={{
        totalProfiles: totalProfiles ?? 0,
        activeProfiles: activeProfiles ?? 0,
        traineeProfiles: traineeProfiles ?? 0,
        departmentCount: departmentCount ?? 0,
      }}
      profiles={profileRows}
      notes={(notes ?? []).map((n) => ({
        id: n.id,
        text: ((n.details as Record<string, unknown>)?.note as string) ?? "",
        createdAt: n.created_at,
      }))}
      commHistory={(commHistory as Array<Record<string, unknown>>) ?? []}
    />
  );
}
