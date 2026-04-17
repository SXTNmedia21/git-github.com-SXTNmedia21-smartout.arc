import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createAdminClient } from "@smartout/supabase/admin";
import { listIntegrations } from "@smartout/billing";
import { getSuperAdminId } from "@/lib/platform-admin";

import { IntegrationsList } from "./_components/IntegrationsList";
import { IntegrationsListSkeleton } from "./_components/IntegrationsListSkeleton";

// Platform-admin billing integrations tab (Fase 2 Spor B — B4).
//
// Server Component: loads the full integration registry once, renders
// the client <IntegrationsList /> table. The table owns the Sheet/Dialog
// state for create/edit/delete + sync history. Fase 2 is platform-admin
// only (ADR-0129), so the RLS policy + getSuperAdminId gate here are
// the sole auth surface.
//
// Norwegian copy is inlined for Fase 2 per spec §4.5 (platform-admin
// opt-in to i18n later). Comments flag that for the Fase 3 migration.

export default async function IntegrationsPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/");

  return (
    <Suspense fallback={<IntegrationsListSkeleton />}>
      <IntegrationsPanel />
    </Suspense>
  );
}

async function IntegrationsPanel() {
  const supabase = createAdminClient();
  const integrations = await listIntegrations(supabase);

  return <IntegrationsList integrations={integrations} />;
}
