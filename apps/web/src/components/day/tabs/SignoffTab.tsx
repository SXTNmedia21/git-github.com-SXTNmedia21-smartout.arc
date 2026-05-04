"use client";

/**
 * SignoffTab — session close-out flow with optional tips card.
 *
 * Phase 4 (ADR-0228): Tips card injected when tips_enabled = true.
 *   - Pool null  → "Ingen tips registrert" + link to Økonomi-tab.
 *   - status='recorded' → short summary card + ApproveBar.
 *   - status='approved' → "Godkjent ✓ {approved_at}" badge.
 */

import { useTransition } from "react";
import { toast } from "sonner";
import { Coins, CheckCircle2, ArrowRight } from "lucide-react";
import type { UiPhase } from "@smartout/utils";
import type { DepartmentSessionRow } from "@/app/dashboard/hms/_hooks/use-department-sessions";
import { signoffSessionAction } from "@/app/dashboard/_actions/signoff-session-action";
import { SignoffPanel, ReconSummary } from "@smartout/ui";
import { useTipsEnabled } from "@/hooks/use-tips-enabled";
import { useTipsPool } from "@/hooks/queries/use-tips-pool";
import { ApproveBar } from "@/components/tips/ApproveBar";

function formatNok(amount: number): string {
  return (
    amount.toLocaleString("nb-NO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " kr"
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("nb-NO", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SignoffTab({ session, phase }: { session: DepartmentSessionRow; phase: UiPhase }) {
  const [busy, startTransition] = useTransition();

  // Tips — Phase 4 (ADR-0228)
  const { enabled: tipsEnabled } = useTipsEnabled();
  // session.sessionId maps to department_session_id (use-department-sessions.ts:44)
  const { data: tipsView } = useTipsPool(tipsEnabled ? session.sessionId : null);

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

  const pool = tipsView?.pool ?? null;
  const isApproved = pool?.status === "approved";
  const isRecorded = pool?.status === "recorded";

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-5">
        <SignoffPanel
          summary={{
            tasksDone,
            tasksTotal,
            tasksUnfinished,
            openDeviations: 0,
            openDeviationsLabel: "",
            lastOutAt: session.closedAt
              ? new Date(session.closedAt).toTimeString().slice(0, 5)
              : "—",
            lastOutBy: "",
          }}
          onConfirm={handleConfirmPending}
          busy={busy}
        />

        {/* Tips card — gated on tips_enabled (ADR-0228) */}
        {tipsEnabled && (
          <section
            className="border-border bg-card space-y-3 rounded-xl border p-4"
            aria-label="Tips-distribusjon"
          >
            <div className="flex items-center gap-2">
              <Coins className="text-muted-foreground h-4 w-4" aria-hidden />
              <h3 className="font-heading text-foreground text-sm font-semibold">Tips</h3>
            </div>

            {!pool ? (
              /* No pool — empty state */
              <div className="py-3 text-center">
                <p className="text-muted-foreground mb-2 text-sm">Ingen tips registrert</p>
                <div className="text-muted-foreground flex items-center justify-center gap-1 text-xs">
                  <span>Registrer i Økonomi-tab</span>
                  <ArrowRight className="h-3 w-3" aria-hidden />
                </div>
              </div>
            ) : isApproved ? (
              /* Approved state */
              <div className="flex items-start gap-2">
                <CheckCircle2
                  className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--success)]"
                  aria-hidden
                />
                <div>
                  <p className="text-foreground text-sm font-semibold">
                    Godkjent — {formatNok(tipsView!.sumDistributed)}
                  </p>
                  {pool.approved_at && (
                    <p className="text-muted-foreground text-xs">
                      {formatDateTime(pool.approved_at as string)}
                    </p>
                  )}
                </div>
              </div>
            ) : isRecorded ? (
              /* Recorded — show summary + ApproveBar */
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-muted-foreground text-xs font-medium">Pot</span>
                  <span className="text-foreground font-mono text-sm font-semibold">
                    {formatNok(Number(pool.amount_nok))}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-muted-foreground text-xs font-medium">Fordelt</span>
                  <span className="text-foreground font-mono text-sm font-semibold">
                    {formatNok(tipsView!.sumDistributed)}
                  </span>
                </div>
                <ApproveBar
                  poolId={pool.id}
                  departmentSessionId={session.sessionId}
                  total={tipsView!.sumDistributed}
                  diffFromPot={tipsView!.diffFromPot}
                />
              </div>
            ) : null}
          </section>
        )}
      </div>

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
