import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  getUser,
  getWorkspaceBySlug,
  getWorkspaceById,
  getProfileInWorkspace,
  getFirstProfile,
} from "./queries";
import type { WorkspaceData } from "@/lib/workspace-context";

export type DashboardPageContext = {
  user: { id: string; email?: string };
  workspace: WorkspaceData;
  profileId: string;
  profileStatus: string | null;
};

/**
 * Resolves the dashboard page request to its workspace + profile context,
 * matching the resolution performed in `app/dashboard/layout.tsx`.
 *
 * Cached: relies on `cache()` decorators on the underlying queries — the
 * layout's prior calls dedupe to zero additional DB hits.
 *
 * **Assumes the layout has already run.** The layout is the access-control
 * boundary; this resolver re-derives the same values for use inside server
 * pages. If the layout would have redirected (e.g. workspace-not-found),
 * it has already done so before any page renders. The redirects in this
 * resolver are belt-and-braces — they should never fire in practice. One
 * subtle drift to know: layout's wsParam path falls through to
 * `getFirstProfile`, but this resolver redirects to `/access-denied` on
 * wsParam failure. Layout-first invariant means this divergence is
 * unreachable, but document for future readers.
 *
 * Use at the top of every server `page.tsx` under `/dashboard/**` that
 * needs to fetch workspace-scoped data server-side. Per ADR-0115
 * (RSC migration pattern).
 */
export async function resolveDashboardContext(): Promise<DashboardPageContext> {
  const headersList = await headers();
  const slug = headersList.get("x-workspace-slug");
  const wsParam = headersList.get("x-workspace-id-param");

  const user = await getUser();
  if (!user) redirect("/login");

  let workspace: WorkspaceData | null = null;
  let profileId: string | null = null;
  let profileStatus: string | null = null;

  if (slug) {
    workspace = await getWorkspaceBySlug(slug);
    if (!workspace) redirect("/access-denied?reason=workspace-not-found");
    const p = await getProfileInWorkspace(user.id, workspace.workspace_id);
    if (!p) redirect("/access-denied?reason=no-profile");
    profileId = p.profile_id;
    profileStatus = p.status;
  } else if (wsParam) {
    workspace = await getWorkspaceById(wsParam);
    if (!workspace) redirect("/access-denied");
    const p = await getProfileInWorkspace(user.id, workspace.workspace_id);
    if (!p) redirect("/access-denied");
    profileId = p.profile_id;
    profileStatus = p.status;
  } else {
    const first = await getFirstProfile(user.id);
    if (!first) redirect("/access-denied");
    workspace = await getWorkspaceById(first.workspace_id);
    if (!workspace) redirect("/access-denied");
    profileId = first.profile_id;
    profileStatus = first.status;
  }

  return {
    user: { id: user.id, email: user.email },
    workspace: workspace!,
    profileId: profileId!,
    profileStatus,
  };
}
