import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { WorkspaceDetailClient } from "./_components/workspace-detail-client";

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

  // Parallel data fetches
  const [
    { count: totalProfiles },
    { count: activeProfiles },
    { count: traineeProfiles },
    { count: departmentCount },
    { data: profiles },
    { data: notes },
    { data: communicationHistory },
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
    admin
      .from("profile")
      .select(
        "profile_id, display_name, role, status, created_at, user_identity:user_id (email, last_sign_in_at)",
      )
      .eq("workspace_id", id)
      .order("created_at", { ascending: false }),
    admin
      .from("platform_audit_log")
      .select("log_id, action, details, created_at, super_admin_id")
      .eq("entity_type", "workspace_note")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("platform_audit_log")
      .select("log_id, action, details, created_at")
      .eq("entity_type", "communication")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const company = workspace.company as Record<string, unknown> | null;

  // Flatten profiles with user_identity join
  const flatProfiles = (profiles ?? []).map((p: Record<string, unknown>) => {
    const ui = p.user_identity as Record<string, unknown> | null;
    return {
      profile_id: p.profile_id as string,
      display_name: p.display_name as string | null,
      email: (ui?.email as string) ?? null,
      role: p.role as string,
      status: p.status as string,
      last_sign_in_at: (ui?.last_sign_in_at as string) ?? null,
    };
  });

  return (
    <WorkspaceDetailClient
      workspace={{
        workspace_id: workspace.workspace_id,
        name: workspace.name,
        slug: workspace.slug,
        is_active: workspace.is_active,
        created_at: workspace.created_at,
      }}
      company={
        company
          ? {
              company_id: company.company_id as string,
              name: (company.name as string) ?? null,
              org_number: (company.org_number as string) ?? null,
              city: (company.city as string) ?? null,
              industry: (company.industry as string) ?? null,
              email: (company.email as string) ?? null,
              phone: (company.phone as string) ?? null,
              subscription_plan: (company.subscription_plan as string) ?? null,
              subscription_status: (company.subscription_status as string) ?? null,
              trial_ends_at: (company.trial_ends_at as string) ?? null,
            }
          : null
      }
      stats={{
        totalProfiles: totalProfiles ?? 0,
        activeProfiles: activeProfiles ?? 0,
        traineeProfiles: traineeProfiles ?? 0,
        departmentCount: departmentCount ?? 0,
      }}
      profiles={flatProfiles}
      notes={
        (notes as Array<{
          log_id: string;
          action: string;
          details: { note?: string } | null;
          created_at: string;
          super_admin_id: string;
        }>) ?? []
      }
      communicationHistory={
        (communicationHistory as Array<{
          log_id: string;
          action: string;
          details: Record<string, unknown> | null;
          created_at: string;
        }>) ?? []
      }
    />
  );
}
