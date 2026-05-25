// page.tsx — /workspaces
//
// Accountant workspace list. Server Component.
// Auth gate via requireAccountant() → redirect /auth/login or 404 when
// no active grants exist.
//
// Data: resolves granted company IDs, then fetches all workspaces for
// those companies (with billing aggregates) via fetchWorkspacesForCompanies.
// The WorkspaceList client component handles search/filter client-side.
//
// Godmode path (ADR-0410): uses admin client to bypass RLS when is_godmode=true,
// receiving all workspaces across all companies.

import { requireAccountant } from "@/lib/accountant";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emit, nonEmpty } from "@/lib/telemetry";
import { fetchWorkspacesForCompanies } from "@smartout/billing";

import { WorkspaceList } from "./_components/WorkspaceList";

export default async function WorkspacesPage() {
  const { userId, companyIds, isGodmode } = await requireAccountant();

  // Godmode uses the service-role admin client to bypass RLS and see all
  // workspaces across all companies (ADR-0410). Regular accountants use
  // their JWT-scoped client (RLS enforces grant-bound visibility).
  const supabase = isGodmode ? createAdminClient() : await createClient();

  const workspaces = await fetchWorkspacesForCompanies(supabase, companyIds);

  // Emit telemetry once per list page load.
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
        workspace_id: "list",
        company_id: companyIds[0] ?? "unknown",
        sections_loaded: 1,
      },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-heading text-2xl">Workspaces</h1>
      </div>
      <WorkspaceList workspaces={workspaces} isGodmode={isGodmode} />
    </div>
  );
}
