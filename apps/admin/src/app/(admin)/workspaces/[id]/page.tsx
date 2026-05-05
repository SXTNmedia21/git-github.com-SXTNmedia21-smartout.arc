// page.tsx — /workspaces/[id]
//
// Per-workspace kartotek. Server Component.
//
// Auth: requireAccountant() then hasAccountantAccess() against the
// workspace's company_id — 404 if not granted.
//
// Data: fetchWorkspaceKartotek() fires 7 parallel queries. Sections that
// fail RLS (orders_only scope) return null; section components render a
// graceful "Ikke tilgang" placeholder and emit kartotek section_failed.
//
// Rendering order matches Erik's mental model: place → deal → activity → people → recent.

import { notFound } from "next/navigation";
import { requireAccountant } from "@/lib/accountant";
import { createClient } from "@/lib/supabase/server";
import { emit, nonEmpty } from "@/lib/telemetry";
import { fetchWorkspaceKartotek } from "@smartout/billing/server";
import { hasAccountantAccess } from "@smartout/billing/accountant";

import { WorkspaceHeader } from "./_components/WorkspaceHeader";
import { BillingConfigSection } from "./_components/BillingConfigSection";
import { OrderHistorySection } from "./_components/OrderHistorySection";
import { PaymentStatusSection } from "./_components/PaymentStatusSection";
import { ContractSection } from "./_components/ContractSection";
import { MembersSection } from "./_components/MembersSection";
import { RecentActivitySection } from "./_components/RecentActivitySection";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function WorkspaceDetailPage({ params }: Props) {
  const { id: workspaceId } = await params;

  // Auth gate — requireAccountant throws/redirects; hasAccountantAccess
  // requires company_id which we resolve after fetching the workspace.
  const { userId } = await requireAccountant();

  const supabase = await createClient();

  // Resolve workspace + company_id (needed for hasAccountantAccess).
  const { data: workspace, error: wsError } = await supabase
    .from("workspace")
    .select("workspace_id, company_id, name")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (wsError || !workspace || !workspace.company_id) {
    notFound();
  }

  // Guard: accountant must have an active grant for this company.
  const hasAccess = await hasAccountantAccess(supabase, userId, workspace.company_id);
  if (!hasAccess) notFound();

  // Fetch all 7 kartotek slices in parallel.
  const kartotek = await fetchWorkspaceKartotek(supabase, workspaceId);

  // Count non-null sections for telemetry.
  const sectionsLoaded = [
    kartotek.summary,
    kartotek.recentOrders.length > 0 ? kartotek.recentOrders : null,
    kartotek.outstandingPayments.length > 0 ? kartotek.outstandingPayments : null,
    kartotek.members,
    kartotek.contracts,
    kartotek.pricingTerms,
    kartotek.recentActivity.length > 0 ? kartotek.recentActivity : null,
  ].filter(Boolean).length;

  await emit({
    event: "kartotek viewed",
    actor_id: nonEmpty(userId, "actor_id"),
    workspace_id: null,
    properties: {
      entity: {
        entity_type: "workspace",
        entity_id: workspaceId,
      },
      data: {
        workspace_id: workspaceId,
        company_id: workspace.company_id,
        sections_loaded: sectionsLoaded,
      },
    },
  });

  return (
    <div className="space-y-6">
      {/* 1. Header — company name, workspace name, org_nr, status, outstanding */}
      <WorkspaceHeader
        summary={kartotek.summary}
        workspaceName={workspace.name}
        workspaceId={workspaceId}
        userId={userId}
      />

      {/* 2. Billing config — pricing terms, currency, payment terms, channels */}
      <BillingConfigSection
        pricingTerms={kartotek.pricingTerms}
        hasPartialAccess={kartotek.hasPartialAccess}
        workspaceId={workspaceId}
        userId={userId}
      />

      {/* 3. Order history — last 12 invoices, link each to /orders?preview= */}
      <OrderHistorySection recentOrders={kartotek.recentOrders} />

      {/* 4. Payment status — outstanding invoices + payment attempts */}
      <PaymentStatusSection
        outstandingPayments={kartotek.outstandingPayments}
        summary={kartotek.summary}
      />

      {/* 5. Contracts — employment contracts (collapsed by default) */}
      <ContractSection
        contracts={kartotek.contracts}
        hasPartialAccess={kartotek.hasPartialAccess}
        workspaceId={workspaceId}
        userId={userId}
      />

      {/* 6. Members — company_member roster */}
      <MembersSection
        members={kartotek.members}
        hasPartialAccess={kartotek.hasPartialAccess}
        workspaceId={workspaceId}
        userId={userId}
      />

      {/* 7. Recent activity — billing_activity_log tail */}
      <RecentActivitySection recentActivity={kartotek.recentActivity} />
    </div>
  );
}
