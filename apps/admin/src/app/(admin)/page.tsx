// page.tsx — / (admin root)
//
// Accountant action-dashboard. Server Component.
// Replaces the stub redirect-to-/workspaces per PLAN-avstemming §Forsiden.
//
// Layout:
//   DashboardCTA   — current period summary + "Kjør avstemming" button
//   QuickTasks     — orders pending "mottatt betalt" (Phase 1)
//   RecentSettlement — last completed run preview

import { requireAccountant } from "@/lib/accountant";
import { createClient } from "@/lib/supabase/server";
import { emit, nonEmpty } from "@/lib/telemetry";
import { fetchWorkspacesForCompanies } from "@smartout/billing";
import {
  fetchLastSuccessfulRun,
  fetchPeriodPreview,
  countPendingOrders,
} from "@/lib/avstemming/fetchers";

import { DashboardCTA } from "./_components/DashboardCTA";
import { QuickTasks } from "./_components/QuickTasks";
import { RecentSettlement } from "./_components/RecentSettlement";

/** Compute current-period start/end (first/last day of current month). */
function currentPeriodDates(): { periodStart: string; periodEnd: string; periodLabel: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed

  const first = new Date(Date.UTC(y, m, 1));
  const last = new Date(Date.UTC(y, m + 1, 0));

  const pad = (n: number) => String(n).padStart(2, "0");
  const periodStart = `${y}-${pad(m + 1)}-01`;
  const periodEnd = `${last.getUTCFullYear()}-${pad(last.getUTCMonth() + 1)}-${pad(last.getUTCDate())}`;
  const periodLabel = first.toLocaleDateString("nb-NO", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  });

  return { periodStart, periodEnd, periodLabel };
}

export default async function DashboardPage() {
  const { userId, companyIds } = await requireAccountant();
  const supabase = await createClient();

  const { periodStart, periodEnd, periodLabel } = currentPeriodDates();

  // Resolve workspace IDs for the period preview.
  const workspaces = await fetchWorkspacesForCompanies(supabase, companyIds);
  const workspaceIds = workspaces.map((ws) => ws.workspace_id);

  // Parallel data fetch.
  const [preview, pendingOrdersCount, lastRun] = await Promise.all([
    fetchPeriodPreview(supabase, workspaceIds, periodStart, periodEnd),
    countPendingOrders(supabase, companyIds),
    fetchLastSuccessfulRun(supabase),
  ]);

  // Emit telemetry once per dashboard load.
  await emit({
    event: "kartotek viewed",
    actor_id: nonEmpty(userId, "actor_id"),
    workspace_id: null,
    properties: {
      entity: {
        entity_type: "workspace",
        entity_id: "00000000-0000-0000-0000-000000000000",
      },
      data: {
        workspace_id: "dashboard",
        company_id: companyIds[0] ?? "unknown",
        sections_loaded: 3,
      },
    },
  });

  return (
    <div className="space-y-4">
      <DashboardCTA
        periodLabel={periodLabel}
        periodEnd={periodEnd}
        workspacesCount={preview.workspace_count}
        ordersCount={preview.order_count}
        totalNok={preview.total_nok_incl_vat}
      />
      <QuickTasks pendingOrdersCount={pendingOrdersCount} />
      <RecentSettlement lastRun={lastRun} />
    </div>
  );
}
