"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, CheckSquare } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addTaskAction } from "@/app/dashboard/_actions/add-task-action";
import { useWorkspaceProfiles } from "@/app/dashboard/settings/_hooks/use-employee-groups";
import { useSessionHooksWithTasks } from "@/app/dashboard/_hooks/use-session-hooks-with-tasks";

const MIN_REASON_LENGTH = 8;
const NONE_VALUE = "__none__"; // Select cannot use empty string values (Radix UI requirement).

/**
 * AddTaskDialog — admin adds an ad-hoc session_task from the WebDayControl
 * Oppgaver tab. Mirrors `ManualTimeEntryDialog` (same AlertDialog idiom,
 * spring-physics-respecting shadcn primitives, 44pt-safe buttons).
 *
 * Fields:
 *   - title (required, <=200)
 *   - owner (optional Select, workspace profiles)
 *   - hook (optional Select, session hooks scoped to session)
 *   - isComplianceRequired (checkbox)
 *   - reason (required, min 8 chars)
 *
 * Phase 1 scope note: no ad-hoc hook creation — unattached tasks land in the
 * "Andre oppgaver" null bucket already rendered by
 * `useSessionHooksWithTasks` (department_session_id query with
 * `session_hook_id=null`).
 */
export function AddTaskDialog({
  sessionId,
  variant = "cta",
}: {
  sessionId: string;
  variant?: "cta" | "inline";
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [ownerId, setOwnerId] = useState<string>(NONE_VALUE);
  const [hookId, setHookId] = useState<string>(NONE_VALUE);
  const [isCompliance, setIsCompliance] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const qc = useQueryClient();

  const profiles = useWorkspaceProfiles();
  const hooks = useSessionHooksWithTasks(sessionId);

  const reasonTrimmed = reason.trim();
  const reasonTooShort = reasonTrimmed.length < MIN_REASON_LENGTH;
  const remaining = MIN_REASON_LENGTH - reasonTrimmed.length;
  const titleTrimmed = title.trim();
  const canSubmit = titleTrimmed.length > 0 && !reasonTooShort;

  function resetForm() {
    setTitle("");
    setOwnerId(NONE_VALUE);
    setHookId(NONE_VALUE);
    setIsCompliance(false);
    setReason("");
  }

  function handleConfirm(e: React.MouseEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    startTransition(async () => {
      try {
        const result = await addTaskAction({
          sessionId,
          title: titleTrimmed,
          ownerProfileId: ownerId === NONE_VALUE ? null : ownerId,
          hookId: hookId === NONE_VALUE ? null : hookId,
          isComplianceRequired: isCompliance,
          reason: reasonTrimmed,
        });

        if (!result.ok) {
          toast.error(result.error);
          return;
        }

        toast.success("Oppgave lagt til. Loggført i revisjonsloggen.");
        // Invalidate the hook+task query for the Oppgaver tab.
        qc.invalidateQueries({ queryKey: ["day-control", "session-hooks-with-tasks"] });
        qc.invalidateQueries({ queryKey: ["hms", "department-sessions"] });
        resetForm();
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ukjent feil.");
      }
    });
  }

  // Hook options are derived from the session hooks query. Orphan bucket
  // (hookId=null) is excluded from the Select — users pick "Ingen hook" via
  // the NONE sentinel instead.
  const hookOptions = (hooks.data ?? []).filter((h) => h.hookId !== null);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {variant === "cta" ? (
          <Button type="button" className="h-11 gap-2" size="lg">
            <Plus className="h-4 w-4" aria-hidden />
            Legg til oppgave
          </Button>
        ) : (
          <Button type="button" variant="outline" className="h-11 gap-2">
            <Plus className="h-4 w-4" aria-hidden />
            Legg til oppgave
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading flex items-center gap-2">
            <CheckSquare className="h-5 w-5" aria-hidden />
            Legg til oppgave
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>
                Opprett en ad-hoc oppgave for denne dagen. Knytt til en eksisterende hook, eller la
                stå tom for å havne under &quot;Andre oppgaver&quot;.
              </p>
              <p className="text-muted-foreground">
                Handlingen logges som <code className="font-mono">manual=true</code> i
                revisjonsloggen med din profil som aktør og begrunnelse i notater.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="new-task-title" className="text-sm font-medium">
              Tittel <span className="text-destructive">*</span>
            </label>
            <input
              id="new-task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="F.eks. Bytt ølpumper på tapp 3"
              className="bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="new-task-owner" className="text-sm font-medium">
                Ansvarlig{" "}
                <span className="text-muted-foreground text-xs font-normal">(valgfritt)</span>
              </label>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger id="new-task-owner" className="h-11">
                  <SelectValue placeholder="Velg ansvarlig" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Ingen ansvarlig</SelectItem>
                  {(profiles.data ?? []).map((p) => (
                    <SelectItem key={p.profile_id} value={p.profile_id}>
                      {p.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="new-task-hook" className="text-sm font-medium">
                Hook <span className="text-muted-foreground text-xs font-normal">(valgfritt)</span>
              </label>
              <Select value={hookId} onValueChange={setHookId}>
                <SelectTrigger id="new-task-hook" className="h-11">
                  <SelectValue placeholder="Velg hook" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Ingen hook (Andre oppgaver)</SelectItem>
                  {hookOptions.map((h) => (
                    <SelectItem key={h.hookId!} value={h.hookId!}>
                      {h.typeLabel} — {h.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              id="new-task-compliance"
              checked={isCompliance}
              onCheckedChange={(v) => setIsCompliance(v === true)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">Krever compliance-evidens</span>
              <span className="text-muted-foreground block text-xs">
                Oppgaven må ha evidens-vedlegg for å kunne markeres som fullført.
              </span>
            </span>
          </label>

          <div className="space-y-1.5">
            <label htmlFor="new-task-reason" className="text-sm font-medium">
              Begrunnelse{" "}
              <span className="text-muted-foreground">(minst {MIN_REASON_LENGTH} tegn)</span>
            </label>
            <textarea
              id="new-task-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="F.eks. Ekstra kontroll etter kundeklage kl. 18."
              className="bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              aria-describedby="new-task-reason-hint"
            />
            <p
              id="new-task-reason-hint"
              className={
                reasonTooShort ? "text-destructive text-xs" : "text-muted-foreground text-xs"
              }
              aria-live="polite"
            >
              {reasonTooShort ? `${remaining} tegn igjen før du kan lagre.` : "Klar til å lagre."}
            </p>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending} className="h-11">
            Avbryt
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!canSubmit || isPending}
            className="h-11"
          >
            {isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />}
            Lagre oppgave
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
