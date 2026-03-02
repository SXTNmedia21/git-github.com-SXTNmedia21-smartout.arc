// ============================================
// leads-tab.tsx
// Client component: the "Leads" tab content.
// Renders a data table of visitors who have been identified
// (linked to user_identity) or manually tagged by an admin.
// Clicking a row opens the lead detail sheet.
//
// Connected to: landing-tabs.tsx (parent tab container)
//               lead-columns.tsx (column definitions)
//               lead-detail.tsx (detail sheet)
//               platform-admin/landing/page.tsx (LeadRow type)
// ============================================

"use client";

import { useState } from "react";
import { DataTable } from "@/components/platform-admin/data-table";
import { leadColumns } from "./lead-columns";
import { LeadDetail } from "./lead-detail";
import type { LeadRow } from "../page";

type LeadsTabProps = {
  leads: LeadRow[];
  totalVisitors: number;
};

export function LeadsTab({ leads }: LeadsTabProps) {
  const [selectedLead, setSelectedLead] = useState<LeadRow | null>(null);

  return (
    <div className="space-y-6">
      {leads.length === 0 ? (
        <div className="bg-muted/50 rounded-lg border p-8 text-center">
          <p className="text-muted-foreground text-sm">
            No leads yet. Leads appear when visitors are identified (sign up) or manually tagged by
            an admin.
          </p>
        </div>
      ) : (
        <DataTable columns={leadColumns} data={leads} onRowClick={(row) => setSelectedLead(row)} />
      )}

      <LeadDetail lead={selectedLead} onClose={() => setSelectedLead(null)} />
    </div>
  );
}
