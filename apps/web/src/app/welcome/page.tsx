import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@smartout/supabase/server";
import { WelcomeClient } from "./WelcomeClient";

type ProfileRow = {
  profile_id: string;
  role: string;
  workspace_id: string;
  created_at: string;
};

type WorkspaceRow = {
  workspace_id: string;
  name: string;
  slug: string;
};

type RoleKey = "employee" | "manager" | "admin" | "owner" | "trainee";

function normalizeRole(role: string): RoleKey {
  const valid: ReadonlyArray<RoleKey> = ["employee", "manager", "admin", "owner", "trainee"];
  const lower = role.toLowerCase() as RoleKey;
  return valid.includes(lower) ? lower : "employee";
}

/**
 * /welcome — one-time post-signup orientation.
 *
 * Per council verdict Q20: if `user_metadata.welcome_shown_at` is set, we
 * redirect straight to /dashboard — this screen only renders once.
 *
 * Workspace detection (no auto-injected workspace context on /welcome):
 *   1. Prefer `x-workspace-slug` header set by middleware on workspace
 *      subdomains — this is the production path after /select-workspace
 *      redirects to `{slug}.rootDomain/welcome`.
 *   2. Local-dev fallback: `?ws=<workspace_id>` query param (mirrors the
 *      pattern used by /select-workspace client for non-subdomain nav).
 *   3. Final fallback: most-recent profile for the user (best effort).
 *
 * If we can't find any workspace, send the user back to /select-workspace —
 * they may have zero memberships or the subdomain context is wrong.
 */
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ ws?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Q20: already shown → straight to dashboard.
  if (user.user_metadata?.welcome_shown_at) {
    redirect("/dashboard");
  }

  const headersList = await headers();
  const headerSlug = headersList.get("x-workspace-slug");
  const { ws: wsParam } = await searchParams;

  let workspace: WorkspaceRow | null = null;
  let role: RoleKey = "employee";

  if (headerSlug) {
    const { data } = (await supabase
      .from("workspace")
      .select("workspace_id, name, slug")
      .eq("slug", headerSlug)
      .maybeSingle()) as { data: WorkspaceRow | null };
    workspace = data;
    if (workspace) {
      const { data: profile } = (await supabase
        .from("profile")
        .select("role")
        .eq("user_id", user.id)
        .eq("workspace_id", workspace.workspace_id)
        .maybeSingle()) as { data: Pick<ProfileRow, "role"> | null };
      if (profile) role = normalizeRole(profile.role);
    }
  } else if (wsParam) {
    const { data } = (await supabase
      .from("workspace")
      .select("workspace_id, name, slug")
      .eq("workspace_id", wsParam)
      .maybeSingle()) as { data: WorkspaceRow | null };
    workspace = data;
    if (workspace) {
      const { data: profile } = (await supabase
        .from("profile")
        .select("role")
        .eq("user_id", user.id)
        .eq("workspace_id", workspace.workspace_id)
        .maybeSingle()) as { data: Pick<ProfileRow, "role"> | null };
      if (profile) role = normalizeRole(profile.role);
    }
  } else {
    // Fallback: most-recent profile for the user.
    const { data: profiles } = (await supabase
      .from("profile")
      .select("role, workspace_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)) as {
      data: Array<Pick<ProfileRow, "role" | "workspace_id" | "created_at">> | null;
    };
    const latest = profiles?.[0];
    if (latest) {
      role = normalizeRole(latest.role);
      const { data: ws } = (await supabase
        .from("workspace")
        .select("workspace_id, name, slug")
        .eq("workspace_id", latest.workspace_id)
        .maybeSingle()) as { data: WorkspaceRow | null };
      workspace = ws;
    }
  }

  if (!workspace) {
    redirect("/select-workspace");
  }

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";
  const isProduction = rootDomain !== "localhost";
  // On the workspace subdomain /dashboard is same-origin. Local dev: /dashboard?ws=<id>.
  const dashboardHref =
    isProduction && headerSlug ? "/dashboard" : `/dashboard?ws=${workspace.workspace_id}`;

  return (
    <WelcomeClient
      workspaceName={workspace.name}
      workspaceSlug={workspace.slug}
      role={role}
      dashboardHref={dashboardHref}
    />
  );
}
