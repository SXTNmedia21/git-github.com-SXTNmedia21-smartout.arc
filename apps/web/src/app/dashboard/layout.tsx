import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@smartout/supabase/server";
import { WorkspaceProvider, type WorkspaceData } from "@/lib/workspace-context";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { QueryProvider } from "./query-provider";

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
    const { data: profileData } = (await supabase
      .from("profile")
      .select("workspace_id")
      .eq("user_id", user.id)
      .limit(1)
      .single()) as { data: { workspace_id: string } | null };

    if (profileData?.workspace_id) {
      const { data: wsData } = await supabase
        .from("workspace")
        .select(
          "workspace_id, company_id, name, slug, logo_url, currency, language, country, timezone, contract_status",
        )
        .eq("workspace_id", profileData.workspace_id)
        .single();

      if (wsData) {
        workspace = wsData as unknown as WorkspaceData;
      }
    }
  }

  if (workspace) {
    return (
      <QueryProvider>
        <WorkspaceProvider workspace={workspace}>
          <DashboardShell>{children}</DashboardShell>
        </WorkspaceProvider>
      </QueryProvider>
    );
  }

  // Fallback: no workspace found at all
  return (
    <QueryProvider>
      <DashboardShell>{children}</DashboardShell>
    </QueryProvider>
  );
}
