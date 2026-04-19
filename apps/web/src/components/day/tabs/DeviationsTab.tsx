"use client";

import { useMemo } from "react";
import { useDeviations } from "@/app/dashboard/hms/_hooks/use-deviations";
import { DeviationCard } from "../widgets";
import type { DayDeviation } from "../widgets";

export function DeviationsTab({ sessionId: _sessionId }: { sessionId: string }) {
  // All workspace-scoped deviations for now; session-scoped filter wires in PR 3
  // when we thread session_id through the hook options consistently.
  const q = useDeviations({
    status: ["open", "acknowledged", "resolved", "escalated"],
  });

  const rows: DayDeviation[] = useMemo(
    () =>
      (q.data ?? []).map((d) => ({
        id: d.deviationId,
        severity: d.severity,
        status: d.status,
        type: d.domain ?? "Avvik",
        title: d.title,
        desc: d.description ?? "",
        reporter: d.reporterName ?? "—",
        time: d.createdAt ? new Date(d.createdAt).toTimeString().slice(0, 5) : "",
        photos: Array.isArray(d.attachments) ? d.attachments.length : 0,
        assignedTo: null,
      })),
    [q.data],
  );

  if (q.isLoading) {
    return <div className="text-muted-foreground text-[13px]">Laster avvik…</div>;
  }
  if (rows.length === 0) {
    return (
      <div className="bg-card border-border rounded-[14px] border p-6 text-center">
        <h3 className="font-heading text-[18px]">Ingen avvik registrert</h3>
        <p className="text-muted-foreground mt-2 text-[13px]">
          Ingenting å følge opp her. Logg avvik fra mobilens deviation-flow.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {rows.map((d) => (
        <DeviationCard key={d.id} deviation={d} />
      ))}
    </div>
  );
}
