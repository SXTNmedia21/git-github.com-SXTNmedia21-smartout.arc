import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { WorkspaceProvider, type WorkspaceData } from "@/lib/workspace-context";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { QueryProvider } from "./query-provider";
import { VerificationGate } from "./_components/VerificationGate";
import { WelcomeWizardGate } from "./_components/WelcomeWizardGate";
import { createAdminClient } from "@smartout/supabase/admin";
import {
  getUser,
  getWorkspaceBySlug,
  getWorkspaceById,
  getProfileInWorkspace,
  getFirstProfile,
  getProfileWelcomeStatus,
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
  is_active: true,
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
  const pathname = headersList.get("x-pathname");

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
  let profileStatus: string | null = null;
  let profileRole: string | null = null;

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
    profileStatus = profile.status;
    profileRole = profile.role;
    workspace = wsData;
  } else if (wsParam) {
    // Local dev: specific workspace selected via ?ws= query param
    const [profile, wsData] = await Promise.all([
      getProfileInWorkspace(user.id, wsParam),
      getWorkspaceById(wsParam),
    ]);
    if (profile && wsData) {
      profileId = profile.profile_id;
      profileStatus = profile.status;
      profileRole = profile.role;
      workspace = wsData;
    }
  }

  if (!workspace) {
    // Fallback: use best workspace
    const profileData = await getFirstProfile(user.id);

    if (profileData?.workspace_id) {
      profileId = profileData.profile_id;
      profileStatus = profileData.status;
      profileRole = profileData.role;
      const wsData = await getWorkspaceById(profileData.workspace_id);

      if (wsData) {
        workspace = wsData;
      }
    }
  }

  // Trainee redirect: employees with trainee status land on my-training
  // instead of the general dashboard. Avoids redirect loop by checking pathname.
  if (profileStatus === "trainee" && pathname && !pathname.startsWith("/dashboard/my-training")) {
    redirect("/dashboard/my-training");
  }

  // Role-based admin-area gate: employees may not access admin/management routes.
  // Admin paths cover org management (people, contracts, settings, billing, governance,
  // cost, season, year-wheel, schedule editor, website, reconciliation). Manager+
  // get full access; employees get redirected to their personal landing.
  // Routes starting with /dashboard/my-* are personal — always allowed.
  // Routes /dashboard/komm, /dashboard/help, /dashboard/notifications, /dashboard
  // (root) are shared.
  const ADMIN_ONLY_PATH_PREFIXES = [
    "/dashboard/people",
    // "/dashboard/contracts" removed — now under /dashboard/people/contracts (SM-2-followup-contracts).
    // Redirect stubs at old path are safe for non-admins (immediate redirect, no data access).
    // /dashboard/people prefix above already covers /dashboard/people/contracts.
    "/dashboard/settings",
    "/dashboard/billing",
    "/dashboard/governance",
    "/dashboard/cost",
    "/dashboard/season",
    "/dashboard/year-wheel",
    "/dashboard/schedule",
    "/dashboard/website",
    "/dashboard/reconciliation",
    "/dashboard/onboarding-assistant",
  ];
  const isEmployee = profileRole === "employee" || profileRole === null;
  const isOnAdminPath = pathname
    ? ADMIN_ONLY_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
    : false;
  if (isEmployee && isOnAdminPath) {
    redirect("/dashboard/my-schedule");
  }

  if (workspace) {
    if (!isShowcaseMode) {
      enforceWorkspaceAccess(workspace);
    }

    // Sandbox workspaces need email verification before the owner can use the dashboard.
    // Showcase mode skips this gate — it has no real auth user to verify.
    const needsVerification = !isShowcaseMode && !user.email_confirmed_at;

    // Welcome wizard gate: check if profile has completed the first-login wizard.
    // Showcase mode and profiles without a profileId skip the check.
    // Treat column-not-found (migration not yet applied) as complete (degrade gracefully).
    let showWelcomeWizard = false;
    const userEmail = user.email ?? "";
    if (!isShowcaseMode && profileId) {
      const welcomeStatus = await getProfileWelcomeStatus(profileId);
      // is_welcome_complete = null means column exists but not set → show wizard
      // is_welcome_complete = false (default) → show wizard
      // Treat DB error / column missing (data null) as complete to avoid blocking
      showWelcomeWizard =
        welcomeStatus?.is_welcome_complete === false || welcomeStatus?.is_welcome_complete === null;
    }

    // Resolve tariffBound from payroll schema (per T10 — NOT public.workspace).
    // Row may not exist for workspaces not yet on payroll — defaults to false gracefully.
    let tariffBound = false;
    if (showWelcomeWizard && workspace) {
      const admin = createAdminClient();
      const { data: payrollSettings } = await admin
        .schema("payroll")
        .from("workspace_settings")
        .select("is_tariff_bound")
        .eq("workspace_id", workspace.workspace_id)
        .maybeSingle();
      tariffBound = payrollSettings?.is_tariff_bound === true;
    }

    const shell = (
      <DashboardShell profileId={profileId}>
        {children}
        {showWelcomeWizard && <WelcomeWizardGate userEmail={userEmail} tariffBound={tariffBound} />}
      </DashboardShell>
    );

    const content = needsVerification ? (
      <VerificationGate
        workspaceId={workspace.workspace_id}
        userEmail={userEmail}
        actorId={profileId ?? ""}
      >
        {shell}
      </VerificationGate>
    ) : (
      shell
    );

    return (
      <QueryProvider>
        <WorkspaceProvider workspace={workspace}>{content}</WorkspaceProvider>
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
