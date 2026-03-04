import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { WorkspaceProvider, type WorkspaceData } from "@/lib/workspace-context";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { QueryProvider } from "./query-provider";
import {
  getUser,
  getWorkspaceBySlug,
  getWorkspaceById,
  getProfileInWorkspace,
  getFirstProfile,
} from "./_data/queries";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const slug = headersList.get("x-workspace-slug");

  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  let workspace: WorkspaceData | null = null;
  let profileId: string | null = null;

  if (slug) {
    // Workspace subdomain: query workspace by slug (cached)
    const wsData = await getWorkspaceBySlug(slug);

    if (!wsData) {
      redirect("/access-denied?reason=workspace-not-found");
    }

    // Verify user has profile in this workspace (cached)
    const profile = await getProfileInWorkspace(user.id, wsData.workspace_id);

    if (!profile) {
      redirect("/access-denied?reason=no-profile");
    }

    profileId = profile.profile_id;
    workspace = wsData;
  } else {
    // No subdomain (local dev or legacy) — use first workspace
    const profileData = await getFirstProfile(user.id);

    if (profileData?.workspace_id) {
      profileId = profileData.profile_id;
      const wsData = await getWorkspaceById(profileData.workspace_id);

      if (wsData) {
        workspace = wsData;
      }
    }
  }

  if (workspace) {
    return (
      <QueryProvider>
        <WorkspaceProvider workspace={workspace}>
          <DashboardShell profileId={profileId}>{children}</DashboardShell>
        </WorkspaceProvider>
      </QueryProvider>
    );
  }

  // No workspace found — redirect instead of rendering without WorkspaceProvider
  redirect("/onboarding");
}
