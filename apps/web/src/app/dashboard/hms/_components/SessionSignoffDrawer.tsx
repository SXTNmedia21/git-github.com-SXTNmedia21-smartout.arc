"use client";

import { useState, useMemo } from "react";
import { CheckCircle2, AlertTriangle, PenLine, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useSessionTasks } from "../_hooks/use-session-tasks";
import { useSignoffSession } from "../_hooks/use-signoff-session";
import type { DepartmentSessionRow } from "../_hooks/use-department-sessions";

type Props = {
  session: DepartmentSessionRow;
  open: boolean;
  onClose: () => void;
};

export function SessionSignoffDrawer({ session, open, onClose }: Props) {
  const { data: tasks, isLoading } = useSessionTasks(session.sessionId);
  const signoff = useSignoffSession();
  const [notes, setNotes] = useState("");

  const complianceTasks = useMemo(
    () => (tasks ?? []).filter((t) => t.isComplianceRequired),
    [tasks],
  );

  const incompleteCompliance = complianceTasks.filter((t) => t.status !== "completed");
  const hasWarnings = incompleteCompliance.length > 0;

  function handleSignoff() {
    signoff.mutate(
      {
        sessionId: session.sessionId,
        departmentId: session.departmentId,
        signoffNotes: notes || null,
        date: session.sessionDate,
      },
      { onSuccess: () => onClose() },
    );
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[400px] sm:w-[500px]">
        <SheetHeader>
          <SheetTitle>Signering — {session.departmentName}</SheetTitle>
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
                <h3 className="text-foreground mb-2 text-sm font-semibold">Pakrevde oppgaver</h3>
                {complianceTasks.length === 0 ? (
                  <p className="text-muted-foreground text-xs">Ingen pakrevde oppgaver.</p>
                ) : (
                  <div className="space-y-1">
                    {complianceTasks.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 rounded-md p-2">
                        {t.status === "completed" ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-500" />
                        )}
                        <span
                          className={`text-sm ${t.status === "completed" ? "text-muted-foreground" : "text-foreground font-medium"}`}
                        >
                          {t.title}
                        </span>
                        {t.status !== "completed" && (
                          <Badge className="ml-auto bg-yellow-500/15 text-[9px] text-yellow-600 hover:bg-yellow-500/15">
                            Ufullstendig
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sign-off type */}
              <div>
                <h3 className="text-foreground mb-2 text-sm font-semibold">Signeringstype</h3>
                {hasWarnings ? (
                  <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm font-medium text-yellow-600">
                        Signering med unntak
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {incompleteCompliance.length} pakrevde oppgaver er ufullstendige. Du ma legge
                      til en forklaring.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium text-green-600">Ren signering</span>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Alle pakrevde oppgaver er fullfort.
                    </p>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <h3 className="text-foreground mb-2 text-sm font-semibold">
                  Notater {hasWarnings && <span className="text-red-500">*</span>}
                </h3>
                <Textarea
                  placeholder={hasWarnings ? "Forklar unntak..." : "Valgfrie notater..."}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Submit */}
              <Button
                className="w-full"
                onClick={handleSignoff}
                disabled={signoff.isPending || (hasWarnings && !notes.trim())}
              >
                {signoff.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PenLine className="mr-2 h-4 w-4" />
                )}
                {hasWarnings ? "Signer med unntak" : "Signer okt"}
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
