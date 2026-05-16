/**
 * apps/web/src/app/dashboard/admin/pos-accounts/page.tsx
 *
 * /dashboard/admin/pos-accounts — POS Integrations admin page.
 *
 * Server Component shell (ADR-0115). Fetches pos_account rows for the
 * current workspace, renders the static list, and passes data down to
 * the PosAccountsList client island.
 *
 * Scope: admin+ only (enforced by dashboard middleware). ADR-0133: web-only
 * V1 (connect/disconnect are authoring verbs). No mobile authoring surface.
 *
 * References:
 *   ADR-0305 — POS adapter pattern.
 *   ADR-0133 — web composes, mobile executes.
 *   smartout-nordic-split — font-heading, CSS vars, glassmorphism.
 */

import { Plug } from "lucide-react";
import { createClient } from "@smartout/supabase/server";
import { resolveDashboardContext } from "../../_data/resolve-page-context";
import { PosAccountsList } from "./_components/PosAccountsList";

export type PosAccountRow = {
  pos_account_id: string;
  vendor: string;
  external_account_id: string;
  status: string;
  last_synced_at: string | null;
  created_at: string;
};

async function fetchPosAccounts(workspaceId: string): Promise<PosAccountRow[]> {
  // Server-side fetch via Supabase — uses the SSR client (cookie session).
  // ADR-0305: read path is workspace-scoped via RLS.
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("pos_account")
    .select("pos_account_id, vendor, external_account_id, status, last_synced_at, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    // Fail open — return empty so the page renders with the "connect" CTA.
    console.error("[pos-accounts] fetch error:", error.message);
    return [];
  }
  return (data ?? []) as PosAccountRow[];
}

export default async function PosAccountsPage() {
  const { workspace } = await resolveDashboardContext();
  const accounts = await fetchPosAccounts(workspace.workspace_id);

  return (
    <div className="flex flex-col gap-6">
      {/* ─── Page header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-foreground flex items-center gap-2 text-2xl">
            <Plug className="text-muted-foreground h-6 w-6" aria-hidden="true" />
            POS Integrasjoner
          </h1>
          <p className="text-muted-foreground text-sm">
            Koble til kassasystemet for automatisk salgsdata og bedre bemanningsprognoser.
          </p>
        </div>
      </div>

      {/* ─── Accounts list (client island) ───────────────────────────── */}
      <PosAccountsList accounts={accounts} workspaceId={workspace.workspace_id} />
    </div>
  );
}
