"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { GuardianEvent, SessionInfo } from "../_hooks/useGuardianSocket";

type SessionDetailsProps = {
  session: SessionInfo | null;
  events: GuardianEvent[];
};

export function SessionDetails({ session, events }: SessionDetailsProps) {
  const stats = useMemo(() => {
    const userMessages = events.filter((e) => e.event_type === "user.message").length;
    const agentResponses = events.filter((e) => e.event_type === "agent.response").length;
    const stageChanges = events.filter((e) => e.event_type === "stage.changed").length;
    return { total: events.length, userMessages, agentResponses, stageChanges };
  }, [events]);

  if (!session) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center px-4 text-sm">
        Select a session
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-4">
        {/* Session info */}
        <div className="space-y-3">
          <h3 className="text-foreground text-sm font-semibold">Session</h3>
          <div className="space-y-2 text-sm">
            <Row label="Profile" value={session.profile_name} />
            <Row label="Mission" value={session.mission_id ?? "agent mode"} />
            <Row label="Channel">
              <Badge variant="outline">{session.channel}</Badge>
            </Row>
            <Row label="Stage" value={session.current_stage ?? "—"} />
            <Row
              label="Started"
              value={new Date(session.started_at).toLocaleTimeString("nb-NO", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            />
          </div>
        </div>

        {/* Event stats */}
        <div className="space-y-3">
          <h3 className="text-foreground text-sm font-semibold">Activity</h3>
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Events" value={stats.total} />
            <StatCard label="User msgs" value={stats.userMessages} />
            <StatCard label="Agent msgs" value={stats.agentResponses} />
            <StatCard label="Stage changes" value={stats.stageChanges} />
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

function Row({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      {children ?? <span className="text-foreground truncate">{value}</span>}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-border rounded-lg border p-2 text-center">
      <div className="text-foreground text-lg font-semibold">{value}</div>
      <div className="text-muted-foreground text-xs">{label}</div>
    </div>
  );
}
