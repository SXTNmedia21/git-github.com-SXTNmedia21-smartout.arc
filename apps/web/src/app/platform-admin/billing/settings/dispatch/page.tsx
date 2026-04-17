import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createAdminClient } from "@smartout/supabase/admin";
import { listDispatchRules } from "@smartout/billing";
import { getSuperAdminId } from "@/lib/platform-admin";

import { DispatchRulesTable } from "./_components/DispatchRulesTable";
import { DispatchRulesTableSkeleton } from "./_components/DispatchRulesTableSkeleton";

// Platform-admin dispatch settings page (Fase 2 Spor A — B3).
//
// Server Component: loads the full rule set (platform + all workspace)
// in one trip, hands off to a client table that owns the Sheet/Dialog
// state + filters. The table groups rows into "Platform-defaults" +
// per-workspace sections per spec §3.6.
//
// Auth: getSuperAdminId gate. RLS policy
// billing_dispatch_rule_platform_admin_all is defensive — service-role
// createAdminClient bypasses RLS anyway, but we still keep the godmode
// policy in the DB for direct JWT access.
//
// Norwegian copy is inlined for Fase 2 (platform-admin opt-in to i18n
// per spec §9). The workspace-admin mirror at /dashboard/billing/settings
// does go through @smartout/i18n.

export default async function PlatformDispatchSettingsPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/");

  return (
    <Suspense fallback={<DispatchRulesTableSkeleton />}>
      <DispatchRulesPanel />
    </Suspense>
  );
}

async function DispatchRulesPanel() {
  const supabase = createAdminClient();
  // scope: 'all' — returns platform baseline + every workspace rule.
  // listDispatchRules orders newest first; the table regroups into
  // "Platform" + per-workspace sections in the client layer.
  const rules = await listDispatchRules(supabase, { scope: "all" });

  // Workspace names for display. One extra round-trip is acceptable —
  // the settings page is admin-only and cardinality is small (hundreds
  // of workspaces at most). If this ever becomes hot, cache via
  // React.cache or move to a view.
  const { data: workspaces } = await supabase
    .from("workspace")
    .select("workspace_id, name")
    .limit(2000);

  const workspaceNames = new Map<string, string>(
    (workspaces ?? []).map((w) => [w.workspace_id, w.name ?? w.workspace_id]),
  );

  return <DispatchRulesTable rules={rules} workspaceNames={workspaceNames} />;
}
