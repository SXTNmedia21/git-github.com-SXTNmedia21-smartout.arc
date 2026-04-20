import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { listDispatchRules } from "@smartout/billing";
import type { BillingDispatchRule } from "@smartout/billing";

import { WorkspaceDispatchRulesPanelSkeleton } from "./_components/WorkspaceDispatchRulesPanelSkeleton";
import { WorkspaceDispatchRulesPanel } from "./_components/WorkspaceDispatchRulesPanel";
import { DunningOptOutSection } from "./_components/DunningOptOutSection";
import { EhfSettingsSection } from "./_components/EhfSettingsSection";
import {
  DUNNING_OPTOUT_CHANNEL,
  DUNNING_OPTOUT_TRIGGER_EVENT,
} from "./_components/DunningOptOutToggle";

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

  // B6-fase3b: last EHF-innstillinger for selskapet så toggle viser riktig startverdi.
  const { data: companyRow } = await admin
    .from("company")
    .select("ehf_enabled, peppol_participant_id")
    .eq("company_id", member.company_id)
    .maybeSingle();

  const workspaceIds = (workspaces ?? []).map((w) => w.workspace_id);
  const workspaceNames = new Map<string, string>(
    (workspaces ?? []).map((w) => [w.workspace_id, w.name ?? w.workspace_id]),
  );

  const workspaceList = (workspaces ?? []).map((w) => ({
    workspace_id: w.workspace_id,
    name: w.name ?? w.workspace_id,
  }));

  return (
    <div className="space-y-12">
      <Suspense fallback={<WorkspaceDispatchRulesPanelSkeleton />}>
        <WorkspaceDispatchRulesPanelLoader
          workspaceIds={workspaceIds}
          workspaceNames={workspaceNames}
        />
      </Suspense>

      {/* B5-fase3a: dunning opt-out — spec §4.5 */}
      <Suspense fallback={null}>
        <DunningOptOutLoader workspaces={workspaceList} />
      </Suspense>

      {/* B6-fase3b: EHF-innstillinger — ADR-0139 */}
      <EhfSettingsSection
        initialEhfEnabled={companyRow?.ehf_enabled ?? false}
        initialPeppolParticipantId={companyRow?.peppol_participant_id ?? null}
      />
    </div>
  );
}

// Loads the current suppress rule (if any) per workspace for the
// "Automatiske påminnelser" section. A single row matching
// (channel=email_customer, trigger_event='invoice dunning_escalated',
// action='suppress') means auto-dunning is OFF for that workspace
// (spec §4.4).
async function DunningOptOutLoader({
  workspaces,
}: {
  workspaces: Array<{ workspace_id: string; name: string }>;
}) {
  const admin = createAdminClient();
  const workspaceIds = workspaces.map((w) => w.workspace_id);

  const rules =
    workspaceIds.length > 0
      ? await listDispatchRules(admin, {
          scope: "workspace",
          workspace_ids: workspaceIds,
          channel: DUNNING_OPTOUT_CHANNEL,
          trigger_event: DUNNING_OPTOUT_TRIGGER_EVENT,
        })
      : [];

  // Index by workspace_id. We only care about enabled suppress rules;
  // disabled rows mean the opt-out has been paused (treated as ON).
  const suppressRulesByWorkspace: Record<string, BillingDispatchRule | null> = {};
  for (const ws of workspaces) {
    suppressRulesByWorkspace[ws.workspace_id] = null;
  }
  for (const rule of rules) {
    if (!rule.workspace_id) continue;
    if (rule.action !== "suppress") continue;
    if (!rule.is_enabled) continue;
    suppressRulesByWorkspace[rule.workspace_id] = rule;
  }

  return (
    <DunningOptOutSection
      workspaces={workspaces}
      suppressRulesByWorkspace={suppressRulesByWorkspace}
    />
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
