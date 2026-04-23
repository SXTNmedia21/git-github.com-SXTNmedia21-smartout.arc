"use client";

import { useMemo, useState, useTransition } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Plus, Loader2, User, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkspaceProfiles } from "@/app/dashboard/settings/_hooks/use-employee-groups";
import { addShiftAction } from "@/app/dashboard/_actions/add-shift-action";

const MIN_REASON_LENGTH = 8;

/**
 * ISO-ify a `<input type="datetime-local">` value (`YYYY-MM-DDTHH:mm` in the
 * browser's local tz). Returns UTC ISO string the Server Action expects.
 * Mirrors the helper in RosterTab's ManualTimeEntryDialog.
 */
function localToISO(value: string): string {
  return new Date(value).toISOString();
}

function defaultDatetimeLocal(dateISO: string, hhmm: string): string {
  const clean = hhmm.length >= 5 ? hhmm.slice(0, 5) : hhmm;
  return `${dateISO}T${clean}`;
}

/**
 * AddShiftDialog — admin creates a planned shift directly from RosterTab.
 *
 * Invariant #13 (campaign/daily-operation): empty states are CTAs, not
 * dead-ends. This dialog backs both the empty-state "Legg til vakt"
 * button and the sticky header button in populated rosters.
 *
 * Fields:
 *   - Person (Select from workspace profiles)
 *   - Start / end (datetime-local, pre-filled to 08:00–16:00 on the session date)
 *   - Rolle (free-text, validated non-empty)
 *   - Begrunnelse (min 8 chars — audit contract)
 *
 * Submit → `addShiftAction` (Server Action) → `schedule_shift` insert +
 * `emit("shift added_manual")`. Dialog closes on success and invalidates
 * the TanStack Query cache keys the RosterTab depends on.
 *
 * Nordic Split tokens only. Spring physics `stiffness=35, damping=22,
 * mass=2.2` on the title entrance, respecting `useReducedMotion()`.
 */
export function AddShiftDialog({
  dateISO,
  departmentId,
  departmentSessionId = null,
  triggerVariant = "default",
  triggerLabel = "Legg til vakt",
}: {
  dateISO: string;
  /**
   * The parent RosterTab knows the department scope — used for telemetry
   * context. The Server Action does not currently insert `department_id`
   * based on this (it derives from `department_session_id` when supplied)
   * so this prop is forward-looking.
   */
  departmentId?: string;
  departmentSessionId?: string | null;
  triggerVariant?: "default" | "ghost";
  triggerLabel?: string;
}) {
  // departmentId is contextual only — kept in the signature for future
  // expansion (e.g. filtering the profile list by department membership)
  // but not consumed yet. Prevents `noUnusedParameters` noise.
  void departmentId;

  const [open, setOpen] = useState(false);
  const [profileId, setProfileId] = useState<string>("");
  const [startAt, setStartAt] = useState(() => defaultDatetimeLocal(dateISO, "08:00"));
  const [endAt, setEndAt] = useState(() => defaultDatetimeLocal(dateISO, "16:00"));
  const [role, setRole] = useState("");
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const qc = useQueryClient();
  const reducedMotion = useReducedMotion();

  const profilesQuery = useWorkspaceProfiles();
  const profiles = useMemo(() => profilesQuery.data ?? [], [profilesQuery.data]);

  const reasonTrimmed = reason.trim();
  const reasonTooShort = reasonTrimmed.length < MIN_REASON_LENGTH;
  const roleTrimmed = role.trim();
  const canSubmit =
    !!profileId &&
    startAt.length > 0 &&
    endAt.length > 0 &&
    roleTrimmed.length > 0 &&
    !reasonTooShort;

  const remaining = MIN_REASON_LENGTH - reasonTrimmed.length;

  function resetForm() {
    setProfileId("");
    setStartAt(defaultDatetimeLocal(dateISO, "08:00"));
    setEndAt(defaultDatetimeLocal(dateISO, "16:00"));
    setRole("");
    setReason("");
  }

  function handleConfirm(e: React.MouseEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    startTransition(async () => {
      try {
        const result = await addShiftAction({
          departmentSessionId,
          profileId,
          startAtISO: localToISO(startAt),
          endAtISO: localToISO(endAt),
          role: roleTrimmed,
          reason: reasonTrimmed,
        });

        if (!result.ok) {
          toast.error(result.error);
          return;
        }

        toast.success("Vakt lagt til. Loggført i revisjonsloggen.");
        qc.invalidateQueries({ queryKey: ["roster"] });
        qc.invalidateQueries({ queryKey: ["day-control", "roster"] });
        qc.invalidateQueries({ queryKey: ["schedule"] });
        qc.invalidateQueries({ queryKey: ["shifts"] });
        resetForm();
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ukjent feil.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={triggerVariant}
          size="default"
          className="h-11 min-w-[44px] gap-1.5"
          aria-label={triggerLabel}
        >
          <Plus className="h-4 w-4" aria-hidden />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border sm:max-w-[520px]">
        <motion.div
          initial={reducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            reducedMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 35, damping: 22, mass: 2.2 }
          }
        >
          <DialogHeader>
            <DialogTitle className="font-heading text-[20px]">
              <span className="inline-flex items-center gap-2">
                <Calendar className="h-4 w-4" aria-hidden />
                Legg til vakt
              </span>
            </DialogTitle>
            <DialogDescription>
              Oppretter en manuell vakt på <span className="font-mono">{dateISO}</span>. Lagres som{" "}
              <code className="font-mono">source=manual_admin</code> i revisjonsloggen med din
              profil som aktør.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="add-shift-person" className="text-sm font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" aria-hidden />
                  Person
                </span>
              </label>
              <Select value={profileId} onValueChange={setProfileId}>
                <SelectTrigger
                  id="add-shift-person"
                  className="bg-background h-11 w-full"
                  aria-label="Velg ansatt"
                >
                  <SelectValue placeholder="Velg ansatt…" />
                </SelectTrigger>
                <SelectContent>
                  {profilesQuery.isLoading ? (
                    <SelectItem value="__loading__" disabled>
                      Laster ansatte…
                    </SelectItem>
                  ) : profiles.length === 0 ? (
                    <SelectItem value="__empty__" disabled>
                      Ingen ansatte funnet
                    </SelectItem>
                  ) : (
                    profiles.map((p) => (
                      <SelectItem key={p.profile_id} value={p.profile_id}>
                        {p.display_name ?? p.profile_id.slice(0, 8)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="add-shift-start" className="text-sm font-medium">
                  Start
                </label>
                <input
                  id="add-shift-start"
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  className="bg-background border-border focus-visible:ring-ring h-11 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="add-shift-end" className="text-sm font-medium">
                  Slutt
                </label>
                <input
                  id="add-shift-end"
                  type="datetime-local"
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                  className="bg-background border-border focus-visible:ring-ring h-11 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="add-shift-role" className="text-sm font-medium">
                Rolle
              </label>
              <input
                id="add-shift-role"
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="F.eks. servitør, resepsjon, kokk"
                className="bg-background border-border focus-visible:ring-ring h-11 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="add-shift-reason" className="text-sm font-medium">
                Begrunnelse{" "}
                <span className="text-muted-foreground">(minst {MIN_REASON_LENGTH} tegn)</span>
              </label>
              <textarea
                id="add-shift-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="F.eks. Ekstra-vakt etter sykemelding, bekreftet over telefon."
                className="bg-background border-border focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                aria-describedby="add-shift-reason-hint"
              />
              <p
                id="add-shift-reason-hint"
                className={
                  reasonTooShort ? "text-destructive text-xs" : "text-muted-foreground text-xs"
                }
                aria-live="polite"
              >
                {reasonTooShort ? `${remaining} tegn igjen før du kan lagre.` : "Klar til å lagre."}
              </p>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Avbryt
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={!canSubmit || isPending}
              className="min-w-[44px]"
            >
              {isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />}
              Lagre vakt
            </Button>
          </DialogFooter>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
