// ============================================
// reports/page.tsx
// AI-driven custom report builder page entrypoint.
// Server Component shell (per ADR-0115). Each tab is dynamic-imported in
// ReportsPageShell so Recharts only ships when the user opens that tab.
// Connected to: _components/ReportsPageShell.tsx (client shell)
// ============================================

import { Suspense } from "react";
import { resolveDashboardContext } from "../_data/resolve-page-context";
import { withPagePerf } from "@/lib/page-perf";
import { ReportsPageShell } from "./_components/ReportsPageShell";
import ReportsLoading from "./loading";

/**
 * /dashboard/reports — Server Component entrypoint.
 *
 * Resolves the workspace + profile context server-side and passes
 * `workspaceId` to the client shell, eliminating the previous round-trip
 * where the shell read it from React context. Tabs lazy-load via
 * `next/dynamic` (Sprint 1C) so heavy Recharts bundles ship per-tab-click.
 */
export default withPagePerf(async function ReportsPage() {
  const { workspace } = await resolveDashboardContext();

  return (
    <Suspense fallback={<ReportsLoading />}>
      <ReportsPageShell workspaceId={workspace.workspace_id} />
    </Suspense>
  );
});
