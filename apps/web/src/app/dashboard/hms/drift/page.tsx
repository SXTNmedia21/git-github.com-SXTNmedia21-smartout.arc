"use client";

import { useContext, useEffect, useRef, useState } from "react";
import { emit, nonEmpty } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { DriftSessionTable } from "../_components/DriftSessionTable";
import { DriftTaskList } from "../_components/DriftTaskList";
import { DriftInsightStrip } from "../_components/DriftInsightStrip";
import { useDriftInsights } from "../_hooks/use-drift-insights";
import { HmsDriftToolsBridge } from "./_tools/hms-drift-tools-bridge";

export default function DriftPage() {
  const { isAdminMode, workspaceData, profileId } = useContext(DashboardContext);
  const [date] = useState(() => new Date().toISOString().split("T")[0]!);

  const workspaceId = workspaceData?.workspace_id ?? null;

  // Emit `hms.drift.viewed` once workspace AND profile are resolved (L-0177).
  // active_session_count deferred — useDriftInsights is called inside AdminDriftView
  // to avoid an extra hook call at this level. Hoisting would duplicate the session
  // query; out of scope for this sortie.
  // TODO: hoist useDriftInsights to DriftPage and pass insights down to derive active_session_count.
  const driftViewedRef = useRef(false);
  useEffect(() => {
    if (!workspaceId || !profileId || driftViewedRef.current) return;
    driftViewedRef.current = true;
    void emit({
      event: "hms.drift.viewed",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(profileId, "actor_id"),
      properties: {
        entity: {
          entity_type: "workspace",
          entity_id: workspaceId,
          entity_label: "HMS Drift",
        },
        data: { active_session_count: 0 },
      },
    });
  }, [workspaceId, profileId]);

  if (!isAdminMode) {
    return (
      <>
        <HmsDriftToolsBridge isAdminMode={false} date={date} loading={false} insights={null} />
        <DriftTaskList />
      </>
    );
  }

  return <AdminDriftView date={date} />;
}

function AdminDriftView({ date }: { date: string }) {
  const { insights, isLoading } = useDriftInsights(date);

  return (
    <>
      <HmsDriftToolsBridge isAdminMode={true} date={date} loading={isLoading} insights={insights} />
      <div className="space-y-4">
        <DriftInsightStrip date={date} />
        <DriftSessionTable />
      </div>
    </>
  );
}
