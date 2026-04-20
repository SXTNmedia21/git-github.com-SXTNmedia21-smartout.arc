import { redirect } from "next/navigation";
import { createClient } from "@smartout/supabase/server";
import { SelectWorkspaceClient } from "./SelectWorkspaceClient";

/**
 * /select-workspace — post-login workspace picker.
 *
 * Per council verdict Q19 (auth plan 2026-04-20): ALWAYS renders the picker,
 * even when the user has exactly one workspace. No auto-redirect shortcut.
 *
 * The server component does the data fetch; the client component handles
 * click → navigate (subdomain in production, ?ws= query in local dev).
 *
 * Per Q20: if welcome hasn't been shown AND signup was recent (< 24h),
 * route the first selection through /welcome. /welcome stamps
 * `user_metadata.welcome_shown_at` on dismiss so this only fires once.
 */
export default async function SelectWorkspacePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  type ProfileRow = {
    profile_id: string;
    role: string;
    display_name: string;
    workspace_id: string;
  };
  type WorkspaceRow = {
    workspace_id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    onboarding_completed: boolean;
  };

  const { data: profiles } = (await supabase
    .from("profile")
    .select("profile_id, role, display_name, workspace_id")
    .eq("user_id", user.id)) as { data: ProfileRow[] | null };

  const workspaceIds = (profiles ?? []).map((p) => p.workspace_id);

  const { data: workspaceRows } =
    workspaceIds.length > 0
      ? ((await supabase
          .from("workspace")
          .select("workspace_id, name, slug, logo_url, onboarding_completed")
          .in("workspace_id", workspaceIds)) as { data: WorkspaceRow[] | null })
      : { data: [] as WorkspaceRow[] };

  const allWorkspaces = (profiles ?? [])
    .map((p) => {
      const ws = (workspaceRows ?? []).find((w) => w.workspace_id === p.workspace_id);
      return ws ? { ...ws, role: p.role, displayName: p.display_name } : null;
    })
    .filter(Boolean) as (WorkspaceRow & { role: string; displayName: string | null })[];

  const workspaces = allWorkspaces.filter((ws) => ws.onboarding_completed);
  const staleWorkspaces = allWorkspaces.filter((ws) => !ws.onboarding_completed);

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";
  const isProduction = rootDomain !== "localhost";

  // Welcome routing (Q20): show once, within 24h of signup.
  const welcomeShownAt = user.user_metadata?.welcome_shown_at as string | undefined;
  const createdAtMs = user.created_at ? Date.parse(user.created_at) : 0;
  const withinFreshWindow = createdAtMs > 0 && Date.now() - createdAtMs < 24 * 60 * 60 * 1000;
  const shouldShowWelcome = !welcomeShownAt && withinFreshWindow;

  return (
    <SelectWorkspaceClient
      userEmail={user.email ?? ""}
      workspaces={workspaces}
      staleWorkspaces={staleWorkspaces}
      rootDomain={rootDomain}
      isProduction={isProduction}
      shouldShowWelcome={shouldShowWelcome}
    />
  );
}
