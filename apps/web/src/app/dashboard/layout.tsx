import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@smartout/supabase/server";
import { WorkspaceProvider, type WorkspaceData } from "@/lib/workspace-context";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const slug = headersList.get("x-workspace-slug");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let workspace: WorkspaceData | null = null;

  if (slug) {
    // Workspace subdomain: query workspace by slug
    const { data: wsData } = await supabase
      .from("workspace")
      .select(
        "workspace_id, company_id, name, slug, logo_url, currency, language, country, timezone, contract_status",
      )
      .eq("slug", slug)
      .single();

    if (!wsData) {
      redirect("/access-denied?reason=workspace-not-found");
    }

    const wsRow = wsData as unknown as WorkspaceData;

    // Verify user has profile in this workspace
    const { data: profile } = await supabase
      .from("profile")
      .select("profile_id")
      .eq("user_id", user.id)
      .eq("workspace_id", wsRow.workspace_id)
      .single();

    if (!profile) {
      redirect("/access-denied?reason=no-profile");
    }

    workspace = wsRow;
  } else {
    // No subdomain (local dev or legacy) — use first workspace
    const { data: profileData } = await supabase
      .from("profile")
      .select(
        "workspace_id, workspace:workspace_id(workspace_id, company_id, name, slug, logo_url, currency, language, country, timezone, contract_status)",
      )
      .eq("user_id", user.id)
      .limit(1)
      .single();

    const ws = (profileData as unknown as { workspace: WorkspaceData } | null)?.workspace;
    if (ws) {
      workspace = ws;
    }
  }

  if (workspace) {
    return (
      <WorkspaceProvider workspace={workspace}>
        <DashboardShell>{children}</DashboardShell>
      </WorkspaceProvider>
    );
  }

  // Fallback: no workspace found at all
  return <DashboardShell>{children}</DashboardShell>;
}
