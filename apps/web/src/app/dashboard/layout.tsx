import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { WorkspaceProvider, type WorkspaceData } from "@/lib/workspace-context";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { QueryProvider } from "./query-provider";
import { VerificationGate } from "./_components/VerificationGate";
import {
  getUser,
  getWorkspaceBySlug,
  getWorkspaceById,
  getProfileInWorkspace,
  getFirstProfile,
} from "./_data/queries";

const SHOWCASE_WORKSPACE: WorkspaceData = {
  workspace_id: "00000000-0000-0000-0000-000000000000",
  company_id: null,
  name: "Dunner Bros Demo Workspace",
  slug: "showcase",
  logo_url: null,
  currency: "NOK",
  language: "nb",
  country: "NO",
  timezone: "Europe/Oslo",
  contract_status: "active",
  onboarding_completed: true,
  setup_guide_completed: true,
};

/**
 * Enforces workspace access redirects for dashboard routes.
 * - Workspaces that still need post-bootstrap setup may be routed to `/dashboard/setup`
 * - Deactivated workspaces → /blocked
 */
function enforceWorkspaceAccess(workspace: WorkspaceData): void {
  if (workspace.contract_status === "deactivated") {
    redirect("/blocked");
  }
}

export default async function DashboardLayout({
  children,
  params: _params,
}: {
  children: React.ReactNode;
  params?: Promise<Record<string, string>>;
}) {
  const headersList = await headers();
  const slug = headersList.get("x-workspace-slug");
  const isShowcaseMode = headersList.get("x-showcase-mode") === "1";
  // Local dev: support ?ws=<workspace_id> to select a specific workspace
  const wsParam = headersList.get("x-workspace-id-param");

  const user = await getUser();

  if (!user) {
    if (isShowcaseMode) {
      return (
        <QueryProvider>
          <WorkspaceProvider workspace={SHOWCASE_WORKSPACE}>
            <DashboardShell profileId={null}>{children}</DashboardShell>
          </WorkspaceProvider>
        </QueryProvider>
      );
    }
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
  } else if (wsParam) {
    // Local dev: specific workspace selected via ?ws= query param
    const profile = await getProfileInWorkspace(user.id, wsParam);
    if (profile) {
      profileId = profile.profile_id;
      const wsData = await getWorkspaceById(wsParam);
      if (wsData) {
        workspace = wsData;
      }
    }
  }

  if (!workspace) {
    // Fallback: use best workspace
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
    if (!isShowcaseMode) {
      enforceWorkspaceAccess(workspace);
    }

    // Sandbox workspaces need email verification before the owner can use the dashboard.
    // Showcase mode skips this gate — it has no real auth user to verify.
    const needsVerification = !isShowcaseMode && !user.email_confirmed_at;

    const content = <DashboardShell profileId={profileId}>{children}</DashboardShell>;

    return (
      <QueryProvider>
        <WorkspaceProvider workspace={workspace}>
          {needsVerification ? (
            <VerificationGate
              workspaceId={workspace.workspace_id}
              userEmail={user.email ?? ""}
              actorId={profileId ?? ""}
            >
              {content}
            </VerificationGate>
          ) : (
            content
          )}
        </WorkspaceProvider>
      </QueryProvider>
    );
  }

  // No workspace found — redirect instead of rendering without WorkspaceProvider
  if (isShowcaseMode) {
    return (
      <QueryProvider>
        <WorkspaceProvider workspace={SHOWCASE_WORKSPACE}>
          <DashboardShell profileId={profileId}>{children}</DashboardShell>
        </WorkspaceProvider>
      </QueryProvider>
    );
  }

  redirect("/onboarding");
}
