"use client";

import { useState, useMemo, useTransition } from "react";
import { CheckCircle2, AlertTriangle, PenLine, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@smartout/i18n";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useSessionTasks } from "../_hooks/use-session-tasks";
import { signoffSessionAction } from "@/app/dashboard/_actions/signoff-session-action";
import type { DepartmentSessionRow } from "../_hooks/use-department-sessions";

type Props = {
  session: DepartmentSessionRow;
  open: boolean;
  onClose: () => void;
};

/**
 * HMS session sign-off drawer.
 *
 * Post-council 2026-04-19 (T5): migrated from legacy `useSignoffSession`
 * TanStack hook to `signoffSessionAction` Server Action per ADR-0157
 * grandfather rule (scheduled migration). This consolidates onto the
 * registry-emit path: leader submits to `pending_signoff`; admin final-close
 * now happens separately via WebDayControl Oppgjør tab (correct C4 split
 * — leader = send, admin = approve).
 */
export function SessionSignoffDrawer({ session, open, onClose }: Props) {
  const { t } = useTranslation("dashboard");
  const { data: tasks, isLoading } = useSessionTasks(session.sessionId);
  const [busy, startTransition] = useTransition();
  const [notes, setNotes] = useState("");

  const complianceTasks = useMemo(
    () => (tasks ?? []).filter((t) => t.isComplianceRequired),
    [tasks],
  );

  const incompleteCompliance = complianceTasks.filter((t) => t.status !== "completed");
  const hasWarnings = incompleteCompliance.length > 0;

  function handleSignoff() {
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
      toast.success(t("hms.signoff.sent_to_review"));
      onClose();
    });
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[400px] sm:w-[500px]">
        <SheetHeader>
          <SheetTitle>
            {t("hms.signoff.title")} — {session.departmentName}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
            </div>
          ) : (
            <>
              {/* Compliance tasks checklist */}
              <div>
                <h3 className="text-foreground mb-2 text-sm font-semibold">
                  {t("hms.signoff.required_tasks")}
                </h3>
                {complianceTasks.length === 0 ? (
                  <p className="text-muted-foreground text-xs">
                    {t("hms.signoff.no_required_tasks")}
                  </p>
                ) : (
                  <div className="space-y-1">
                    {complianceTasks.map((task) => (
                      <div key={task.id} className="flex items-center gap-2 rounded-md p-2">
                        {task.status === "completed" ? (
                          <CheckCircle2 className="text-success h-4 w-4 shrink-0" />
                        ) : (
                          <AlertTriangle className="text-warning h-4 w-4 shrink-0" />
                        )}
                        <span
                          className={`text-sm ${task.status === "completed" ? "text-muted-foreground" : "text-foreground font-medium"}`}
                        >
                          {task.title}
                        </span>
                        {task.status !== "completed" && (
                          <Badge className="bg-warning/15 text-warning hover:bg-warning/15 ml-auto text-[9px]">
                            {t("hms.signoff.incomplete")}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sign-off type */}
              <div>
                <h3 className="text-foreground mb-2 text-sm font-semibold">
                  {t("hms.signoff.signoff_type")}
                </h3>
                {hasWarnings ? (
                  <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm font-medium text-yellow-600">
                        {t("hms.signoff.with_exceptions")}
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {incompleteCompliance.length} {t("hms.signoff.incomplete_explanation")}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium text-green-600">
                        {t("hms.signoff.clean_signoff")}
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {t("hms.signoff.all_tasks_completed")}
                    </p>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <h3 className="text-foreground mb-2 text-sm font-semibold">
                  {t("hms.signoff.notes")} {hasWarnings && <span className="text-red-500">*</span>}
                </h3>
                <Textarea
                  placeholder={
                    hasWarnings
                      ? t("hms.signoff.explain_exceptions")
                      : t("hms.signoff.optional_notes")
                  }
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Submit */}
              <Button
                className="w-full"
                onClick={handleSignoff}
                disabled={busy || (hasWarnings && !notes.trim())}
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PenLine className="mr-2 h-4 w-4" />
                )}
                {hasWarnings
                  ? t("hms.signoff.sign_with_exceptions")
                  : t("hms.signoff.sign_session")}
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
