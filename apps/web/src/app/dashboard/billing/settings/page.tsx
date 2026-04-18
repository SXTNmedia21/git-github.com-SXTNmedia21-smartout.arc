import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { listDispatchRules } from "@smartout/billing";

import { WorkspaceDispatchRulesPanelSkeleton } from "./_components/WorkspaceDispatchRulesPanelSkeleton";
import { WorkspaceDispatchRulesPanel } from "./_components/WorkspaceDispatchRulesPanel";

// Workspace-admin billing settings — dispatch rules tab (Fase 2 B3).
//
// Auth: workspace-admin surface. Same pattern as /dashboard/billing
// itself — resolve caller via createClient (cookie JWT), look up
// company_member with admin/owner role, then load rules visible to
// the caller's workspaces. RLS on billing_dispatch_rule already
// allows SELECT for platform rows + own-workspace rows; we still
// resolve workspaces here so the UI can restrict CRUD scope
// client-side (defensive; server enforces authoritatively).

export default async function WorkspaceBillingSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("company_member")
    .select("company_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .in("role", ["admin", "owner"])
    .limit(1)
    .maybeSingle();
  if (!member) redirect("/dashboard");

  const { data: workspaces } = await admin
    .from("workspace")
    .select("workspace_id, name")
    .eq("company_id", member.company_id);

  const workspaceIds = (workspaces ?? []).map((w) => w.workspace_id);
  const workspaceNames = new Map<string, string>(
    (workspaces ?? []).map((w) => [w.workspace_id, w.name ?? w.workspace_id]),
  );

  return (
    <Suspense fallback={<WorkspaceDispatchRulesPanelSkeleton />}>
      <WorkspaceDispatchRulesPanelLoader
        workspaceIds={workspaceIds}
        workspaceNames={workspaceNames}
      />
    </Suspense>
  );
}

async function WorkspaceDispatchRulesPanelLoader({
  workspaceIds,
  workspaceNames,
}: {
  workspaceIds: string[];
  workspaceNames: Map<string, string>;
}) {
  const admin = createAdminClient();

  // Two calls: platform baseline (shared with every tenant) + the
  // caller's own workspace rules. Merged in the client because the
  // panel renders them in two distinct sections.
  const [platformRules, workspaceRules] = await Promise.all([
    listDispatchRules(admin, { scope: "platform" }),
    listDispatchRules(admin, { scope: "workspace", workspace_ids: workspaceIds }),
  ]);

  return (
    <WorkspaceDispatchRulesPanel
      platformRules={platformRules}
      workspaceRules={workspaceRules}
      workspaceIds={workspaceIds}
      workspaceNames={workspaceNames}
    />
  );
}
