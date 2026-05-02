// page.tsx — /avstemming/run
//
// Pre-check + confirm flow for running an avstemming. Server Component.
// Fetches all granted workspaces, computes default period (last completed
// month), and renders the RunConfirmation client form.
//
// Auth: requireAccountant() — redirects if no session or no grants.
// ⛔ NEVER auto-trigger runSettlement — only on explicit user submission.

import { requireAccountant } from "@/lib/accountant";
import { createClient } from "@/lib/supabase/server";
import { fetchWorkspacesForCompanies } from "@smartout/billing";

import { RunConfirmation } from "./_components/RunConfirmation";

/** Compute last fully completed month period dates. */
function lastMonthPeriod(): { periodStart: string; periodEnd: string; periodLabel: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed

  // Last completed month is m-1 (0-indexed). If m===0 → December of previous year.
  const lastMonth = m === 0 ? 11 : m - 1;
  const lastMonthYear = m === 0 ? y - 1 : y;

  const first = new Date(Date.UTC(lastMonthYear, lastMonth, 1));
  const last = new Date(Date.UTC(lastMonthYear, lastMonth + 1, 0));

  const pad = (n: number) => String(n).padStart(2, "0");
  const periodStart = `${lastMonthYear}-${pad(lastMonth + 1)}-01`;
  const periodEnd = `${last.getUTCFullYear()}-${pad(last.getUTCMonth() + 1)}-${pad(last.getUTCDate())}`;
  const periodLabel = first.toLocaleDateString("nb-NO", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  });

  return { periodStart, periodEnd, periodLabel };
}

export default async function RunPage() {
  const { companyIds } = await requireAccountant();
  const supabase = await createClient();

  const workspaces = await fetchWorkspacesForCompanies(supabase, companyIds);
  const { periodStart, periodEnd, periodLabel } = lastMonthPeriod();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl">Kjør avstemming</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Bekreft workspaces og periode, deretter genereres 4 artefakter automatisk.
        </p>
      </div>

      <RunConfirmation
        workspaces={workspaces}
        defaultPeriodStart={periodStart}
        defaultPeriodEnd={periodEnd}
        defaultPeriodLabel={periodLabel}
      />
    </div>
  );
}
