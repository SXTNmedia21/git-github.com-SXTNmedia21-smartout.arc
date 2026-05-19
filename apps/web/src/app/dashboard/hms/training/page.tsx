"use client";

import { useContext, useEffect, useRef } from "react";
import { emit, nonEmpty } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { CompetenceMatrix } from "../_components/CompetenceMatrix";
import { ProtocolList } from "@/app/dashboard/my-training/_components/ProtocolList";

export default function TrainingPage() {
  const { isAdminMode, workspaceData, profileId } = useContext(DashboardContext);

  const workspaceId = workspaceData?.workspace_id ?? null;

  // Emit `hms.training.viewed` once workspace AND profile are resolved (L-0177).
  // protocol_count deferred — requires useGovernanceFiltered or a dedicated RPC
  // to count protocols in scope; plumbing here is out of scope for this sortie.
  // TODO: derive real protocol_count when governance hooks are lifted to page level.
  const trainingViewedRef = useRef(false);
  useEffect(() => {
    if (!workspaceId || !profileId || trainingViewedRef.current) return;
    trainingViewedRef.current = true;
    void emit({
      event: "hms.training.viewed",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(profileId, "actor_id"),
      properties: {
        entity: {
          entity_type: "workspace",
          entity_id: workspaceId,
          entity_label: "HMS Training",
        },
        data: { protocol_count: 0 },
      },
    });
  }, [workspaceId, profileId]);

  // Admin sees competence matrix. Employee sees their protocol list.
  // LearnFlow is accessible via /dashboard/hms/procedure/[id] but not the default yet.
  return isAdminMode ? <CompetenceMatrix /> : <ProtocolList />;
}
