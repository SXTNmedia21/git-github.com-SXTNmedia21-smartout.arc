"use client";

import { useContext } from "react";
import { GraduationCap } from "lucide-react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { ProtocolList } from "./_components/ProtocolList";
import { useAssignedProtocols } from "./_hooks/use-assigned-protocols";
import { MyTrainingToolsBridge } from "./_tools/my-training-tools-bridge";

// UI Events:
// - nav: /dashboard/my-training (sidebar link)
// - action: expand protocol card
// - action: complete step, submit test, sign confirmation

export default function MyTrainingPage() {
  const { isDark, profileId } = useContext(DashboardContext);
  const { data: protocols, isLoading } = useAssignedProtocols(profileId);

  // Flatten to bridge-compatible summaries (strip procedure/test/confirmation detail)
  const protocolSummaries = (protocols ?? []).map((p) => ({
    assignmentId: p.assignmentId,
    protocolName: p.protocolName,
    protocolDescription: p.protocolDescription,
    assignmentStatus: p.assignmentStatus,
    assignedAt: p.assignedAt,
    completedAt: p.completedAt,
    progress: p.progress,
  }));

  return (
    <div className="space-y-6">
      {/* Botsson harness — register training tools for voice/chat */}
      <MyTrainingToolsBridge loading={isLoading} protocols={protocolSummaries} />

      {/* Header */}
      <div>
        <div className="mb-1 flex items-center gap-3">
          <h1
            className={`text-3xl font-extrabold tracking-tight ${isDark ? "text-foreground" : "text-foreground"}`}
          >
            Min Opplaering
          </h1>
          <GraduationCap className={`h-6 w-6 ${isDark ? "text-orange-500" : "text-orange-500"}`} />
        </div>
        <p className={`text-sm ${isDark ? "text-muted-foreground" : "text-muted-foreground"}`}>
          Dine tildelte protokoller, prosedyrer, tester og bekreftelser.
        </p>
      </div>

      {/* Protocol list */}
      <ProtocolList />
    </div>
  );
}
