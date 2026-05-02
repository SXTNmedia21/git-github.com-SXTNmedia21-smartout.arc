"use client";

import { useMemo } from "react";
import { useDeviations } from "@/app/dashboard/hms/_hooks/use-deviations";
import { DeviationCard } from "@smartout/ui";
import type { DayDeviation } from "@smartout/ui";

export function DeviationsTab({ sessionId: _sessionId }: { sessionId: string }) {
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

  return (
    <div className="flex h-full min-h-0 flex-col">
      {rows.length === 0 ? (
        <div className="bg-card border-border rounded-2xl border p-6 text-center shadow-sm">
          <h3 className="font-heading text-[18px]">Ingen avvik registrert</h3>
          <p className="text-muted-foreground mt-2 text-[13px]">
            Ingenting å følge opp her. Logg avvik fra mobilens deviation-flow.
          </p>
        </div>
      ) : (
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="grid gap-3">
            {rows.map((d) => (
              <DeviationCard key={d.id} deviation={d} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
