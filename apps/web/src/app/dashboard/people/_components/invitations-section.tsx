"use client";

/**
 * Client wrapper around InvitationStatusList. The Server Component (page.tsx)
 * hydrates the first row set; this wrapper owns the refetch lifecycle so
 * the list can refresh itself after resend/cancel/expiry mutations without
 * a full route re-render (matching the PeoplePageClient pattern).
 *
 * Placement: directly below the existing employees table on /dashboard/people.
 * Additive — never replaces the employees view.
 */

import { useCallback, useState } from "react";
import {
  InvitationStatusList,
  type InvitationListRow,
} from "@/components/auth/InvitationStatusList";
import { listWorkspaceInvitations } from "../_actions/people-actions";

type Props = {
  initialRows: InvitationListRow[];
  workspaceId: string;
  workspaceSlug: string;
};

export function InvitationsSection({ initialRows, workspaceId, workspaceSlug }: Props) {
  const [rows, setRows] = useState<InvitationListRow[]>(initialRows);

  const refetch = useCallback(async () => {
    const fresh = await listWorkspaceInvitations(workspaceId);
    setRows(fresh);
  }, [workspaceId]);

  return <InvitationStatusList rows={rows} workspaceSlug={workspaceSlug} onChange={refetch} />;
}
