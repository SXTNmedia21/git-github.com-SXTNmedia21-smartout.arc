// page.tsx — /avstemming/historikk
//
// Liste over alle tidligere settlement runs. Server Component.
// Auth: requireAccountant() — redirects if no session or no grants.
// Fetches last 50 runs ordered by started_at desc.

import { requireAccountant } from "@/lib/accountant";
import { createClient } from "@/lib/supabase/server";
import { fetchSettlementHistory } from "@/lib/avstemming/fetchers";

import { HistoryTable } from "./_components/HistoryTable";

export default async function HistorikkPage() {
  await requireAccountant(); // Access gate — redirect on no session/no grants.
  const supabase = await createClient();

  const runs = await fetchSettlementHistory(supabase);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl">Historikk</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Alle tidligere avstemminger. Klikk «Vis pakke» for å åpne artefakter.
        </p>
      </div>
      <HistoryTable runs={runs} />
    </div>
  );
}
