/**
 * /dashboard/people/training/page.tsx
 *
 * Server Component shell — resolves workspace context server-side,
 * then hands workspaceId + profileId to the client island.
 * All data fetching, loading states, and KPI logic live in WorkforceReadinessClient.
 *
 * Pattern: same as people/roles/page.tsx (RSC shell + client island).
 * Replaces the "Kommer snart" placeholder (SM-2-followup-training).
 */
import { resolveDashboardContext } from "../../_data/resolve-page-context";
import { WorkforceReadinessClient } from "./_components/WorkforceReadinessClient";

export const dynamic = "force-dynamic";

export default async function TrainingPage() {
  const { workspace, profileId } = await resolveDashboardContext();

  return <WorkforceReadinessClient workspaceId={workspace.workspace_id} profileId={profileId} />;
}
