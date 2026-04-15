"use client";

import { useContext } from "react";
import { GraduationCap } from "lucide-react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { ProtocolList } from "./_components/ProtocolList";

// UI Events:
// - nav: /dashboard/my-training (sidebar link)
// - action: expand protocol card
// - action: complete step, submit test, sign confirmation

export default function MyTrainingPage() {
  const { isDark } = useContext(DashboardContext);

  return (
    <div className="space-y-6">
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
