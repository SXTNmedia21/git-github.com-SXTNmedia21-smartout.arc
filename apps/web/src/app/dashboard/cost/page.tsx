import { Suspense } from "react";
import { resolveDashboardContext } from "../_data/resolve-page-context";
import { withPagePerf } from "@/lib/page-perf";
import { CostOverview } from "./_components/CostOverview";
import CostLoading from "./loading";

/**
 * /dashboard/cost — Server Component shell.
 *
 * Resolves workspace + profile context server-side (gating, redirect
 * on access-denied), then hands off to the client `<CostOverview/>`
 * island which owns TanStack state for the weekly cost drilldown.
 *
 * Per ADR-0115 RSC migration pattern. No initial data is passed down
 * because the client hook keys on (workspace, dateFrom, dateTo) and
 * week navigation is driven by client state — prefetching a single
 * week server-side would be thrown away on the first `+` click.
 *
 * Botsson harness bridge: <CostToolsBridge> is mounted inside <CostOverview>
 * (not here) because it needs live week-state + aggregated cost data from
 * useCostOverview. Client-side mount is necessary — see _tools/cost-tools-bridge.tsx.
 * ADR-0238: owns_chat_surface=false. ADR-0151: workspace_id resolved server-side.
 */
export default withPagePerf(async function CostPage() {
  await resolveDashboardContext();

  return (
    <Suspense fallback={<CostLoading />}>
      <CostOverview />
    </Suspense>
  );
});
