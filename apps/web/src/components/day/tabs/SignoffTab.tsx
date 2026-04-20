"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { UiPhase } from "@smartout/utils";
import type { DepartmentSessionRow } from "@/app/dashboard/hms/_hooks/use-department-sessions";
import { signoffSessionAction } from "@/app/dashboard/_actions/signoff-session-action";
import { SignoffPanel, ReconSummary } from "@smartout/ui";

export function SignoffTab({ session, phase }: { session: DepartmentSessionRow; phase: UiPhase }) {
  const [busy, startTransition] = useTransition();

  function handleConfirmPending({ notes }: { notes: string }) {
    startTransition(async () => {
      const res = await signoffSessionAction({
        sessionId: session.sessionId,
        confirm: "pending",
        notes: notes || undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Dagen sendt til oppgjør");
    });
  }

  function handleAdminClose() {
    startTransition(async () => {
      const res = await signoffSessionAction({
        sessionId: session.sessionId,
        confirm: "close",
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Dagen godkjent og stengt");
    });
  }

  const tasksDone = session.tasksCompleted;
  const tasksTotal = session.tasksTotal;
  const tasksUnfinished = Math.max(0, tasksTotal - tasksDone);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <SignoffPanel
        summary={{
          tasksDone,
          tasksTotal,
          tasksUnfinished,
          openDeviations: 0,
          openDeviationsLabel: "",
          lastOutAt: session.closedAt ? new Date(session.closedAt).toTimeString().slice(0, 5) : "—",
          lastOutBy: "",
        }}
        onConfirm={handleConfirmPending}
        busy={busy}
      />
      <ReconSummary
        phase={phase}
        dateLabel={new Date(session.sessionDate).toLocaleDateString("nb-NO", {
          day: "numeric",
          month: "long",
        })}
        locationLabel={session.departmentName}
        rows={[
          {
            label: "Omsetning",
            value: "—",
            delta: "etter oppgjør",
            dir: "flat",
          },
          {
            label: "Arbeidstid",
            value: "—",
            delta: "se Bemanning",
            dir: "flat",
          },
          {
            label: "Lønnskostnad",
            value: "—",
            delta: "etter oppgjør",
            dir: "flat",
          },
          {
            label: "Margin vs mål",
            value: "—",
            delta: "etter oppgjør",
            dir: "flat",
          },
        ]}
        onApprove={phase === "pending_signoff" ? handleAdminClose : undefined}
      />
    </div>
  );
}
