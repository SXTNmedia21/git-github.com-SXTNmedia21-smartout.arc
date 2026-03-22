"use client";

import { useContext, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, PenLine } from "lucide-react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useDepartmentSessions,
  type DepartmentSessionRow,
} from "../_hooks/use-department-sessions";
import { DriftTaskList } from "./DriftTaskList";
import { SessionSignoffDrawer } from "./SessionSignoffDrawer";

// TODO: move to i18n
const STRINGS = {
  department: "Avdeling",
  status: "Status",
  tasks: "Oppgaver",
  deviations: "Avvik",
  signoff: "Signering",
  noSessions: "Ingen okter for denne datoen.",
} as const;

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function statusBadge(status: DepartmentSessionRow["status"]) {
  const styles: Record<string, { bg: string; label: string }> = {
    upcoming: { bg: "bg-blue-500/15 text-blue-600", label: "Kommende" },
    active: { bg: "bg-green-500/15 text-green-600", label: "Aktiv" },
    pending_signoff: { bg: "bg-yellow-500/15 text-yellow-600", label: "Venter" },
    closed: { bg: "bg-muted text-muted-foreground", label: "Lukket" },
    missed: { bg: "bg-red-500/15 text-red-600", label: "Uteblitt" },
  };
  const s = styles[status] ?? styles.upcoming;
  return <Badge className={`${s.bg} text-[10px] hover:${s.bg}`}>{s.label}</Badge>;
}

export function DriftSessionTable() {
  const { isDark } = useContext(DashboardContext);
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [signoffSession, setSignoffSession] = useState<DepartmentSessionRow | null>(null);

  const { data: sessions, isLoading } = useDepartmentSessions(date);

  function shiftDate(days: number) {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split("T")[0]);
    setExpandedSession(null);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Date picker */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => shiftDate(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-foreground text-sm font-semibold capitalize">{formatDate(date)}</span>
        <Button variant="ghost" size="icon" onClick={() => shiftDate(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Table */}
      {!sessions || sessions.length === 0 ? (
        <div className="border-border bg-card/50 rounded-xl border-2 border-dashed p-8 text-center">
          <p className="text-muted-foreground text-sm">{STRINGS.noSessions}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`border-b ${isDark ? "border-zinc-800" : "border-border"}`}>
                <th className="text-muted-foreground px-3 py-2 text-left text-xs font-medium">
                  {STRINGS.department}
                </th>
                <th className="text-muted-foreground px-3 py-2 text-center text-xs font-medium">
                  {STRINGS.status}
                </th>
                <th className="text-muted-foreground px-3 py-2 text-center text-xs font-medium">
                  {STRINGS.tasks}
                </th>
                <th className="text-muted-foreground px-3 py-2 text-center text-xs font-medium">
                  {STRINGS.signoff}
                </th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <>
                  <tr
                    key={session.sessionId}
                    onClick={() =>
                      setExpandedSession(
                        expandedSession === session.sessionId ? null : session.sessionId,
                      )
                    }
                    className={`hover:bg-muted/30 cursor-pointer border-b transition-colors ${isDark ? "border-zinc-800/50" : "border-border/50"}`}
                  >
                    <td className="text-foreground px-3 py-3 font-medium">
                      {session.departmentName}
                    </td>
                    <td className="px-3 py-3 text-center">{statusBadge(session.status)}</td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="bg-muted h-1.5 w-16 overflow-hidden rounded-full">
                          <div
                            className="h-full rounded-full bg-green-500"
                            style={{
                              width: `${session.tasksTotal > 0 ? (session.tasksCompleted / session.tasksTotal) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <span className="text-muted-foreground text-xs">
                          {session.tasksCompleted}/{session.tasksTotal}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {session.status === "pending_signoff" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSignoffSession(session);
                          }}
                        >
                          <PenLine className="mr-1 h-3 w-3" />
                          Signer
                        </Button>
                      ) : session.status === "closed" ? (
                        <span className="text-muted-foreground text-xs">Signert</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                  </tr>
                  {/* Expanded drill-down */}
                  {expandedSession === session.sessionId && (
                    <tr key={`${session.sessionId}-detail`}>
                      <td colSpan={4} className="bg-muted/20 px-4 py-4">
                        <DriftTaskList sessionId={session.sessionId} showAll />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Sign-off drawer */}
      {signoffSession && (
        <SessionSignoffDrawer
          session={signoffSession}
          open={!!signoffSession}
          onClose={() => setSignoffSession(null)}
        />
      )}
    </div>
  );
}
