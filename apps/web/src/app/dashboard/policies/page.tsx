import { Suspense } from "react";
import { resolveDashboardContext } from "../_data/resolve-page-context";
import { withPagePerf } from "@/lib/page-perf";
import { timed } from "@/lib/perf";
import { listPolicies } from "./_actions/policy-actions";
import { PoliciesPageClient, type PoliciesPageInitialData } from "./_components/PoliciesPageClient";
import PoliciesLoading from "./loading";

/**
 * /dashboard/policies — Server Component shell.
 *
 * Resolves workspace + profile, fetches active policies for the workspace,
 * and hands off to a single client boundary (PoliciesPageClient) per
 * ADR-0115 (RSC migration pattern).
 *
 * Wraps with withPagePerf for performance budget tracking.
 */
export default withPagePerf(async function PoliciesPage() {
  const { workspace } = await resolveDashboardContext();

  const policies = await timed("policies.listPolicies", () => listPolicies(workspace.workspace_id));

  const initialData: PoliciesPageInitialData = {
    policies,
  };

  return (
    <Suspense fallback={<PoliciesLoading />}>
      <PoliciesPageClient initialData={initialData} />
    </Suspense>
  );
});
