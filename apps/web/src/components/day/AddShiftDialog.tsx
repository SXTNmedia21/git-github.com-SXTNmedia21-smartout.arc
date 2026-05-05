"use client";

import { useMemo, useState, useTransition } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { motion as motionTokens } from "@smartout/design-tokens";
import { Plus, Loader2, User, Calendar, AlertCircle, AlertTriangle } from "lucide-react";
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
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { useTeamAvailability } from "@/app/dashboard/_hooks/use-team-availability";
import {
  STATUS_TIER,
  STATUS_LABEL_NB_INLINE,
  type DailyStatus,
} from "@/lib/availability/status-tier";

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
 * Sortie 3 (roster-overlay) makes it availability-aware:
 *   - Profile dropdown is sorted by status on `dateISO`
 *     (available → preferred → unavailable → absent), alphabetical
 *     within each tier.
 *   - Profiles in `unavailable` / `absent` render muted with an
 *     inline `AlertCircle` so admins see the conflict at a glance.
 *   - When the selected profile is `unavailable` / `absent`, a warm
 *     warning banner renders above the submit footer. Admin can still
 *     submit (override) — this is a warning, not a blocker.
 *   - Submitting an override attaches `override_reason` to the Server
 *     Action payload; the action folds it into
 *     `activity_trail.data.override_reason` via `emit()` (no direct
 *     `activity_trail.insert()` — ADR-0175 destinations flow through
 *     the telemetry emit).
 *
 * Fields:
 *   - Person (Select from workspace profiles, availability-aware)
 *   - Start / end (datetime-local, pre-filled to 08:00–16:00 on the session date)
 *   - Rolle (free-text, validated non-empty)
 *   - Begrunnelse (min 8 chars — audit contract)
 *
 * Submit → `addShiftAction` (Server Action) → `schedule_shift` insert +
 * `emit("shift added_manual")`. Dialog closes on success and invalidates
 * the TanStack Query cache keys the RosterTab depends on.
 *
 * Nordic Split tokens only. Spring physics `stiffness=35, damping=22,
 * mass=2.2` on the title entrance + warning banner, respecting
 * `useReducedMotion()`.
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
   * The parent RosterTab knows the department scope — used for:
   *   1. Telemetry context
   *   2. Availability-query filter (Sortie 3) so the dropdown only
   *      considers the relevant team
   *   3. **Shift write-path scope.** Passed through to `addShiftAction`
   *      as `departmentId` when `departmentSessionId` is null, so the
   *      inserted `schedule_shift` has a populated `department_id` and
   *      is visible to `use-roster.ts` (which filters dept directly).
   *      Added 2026-04-24 alongside migrations 20260519000000/000001.
   */
  departmentId?: string;
  departmentSessionId?: string | null;
  triggerVariant?: "default" | "ghost";
  triggerLabel?: string;
}) {
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

  const wsCtx = useWorkspaceOptional();
  const workspaceId = wsCtx?.workspace.workspace_id ?? "";

  /**
   * Availability window = the shift date. Task L's hook accepts a
   * single `dateISO` and returns a resolved per-profile status so the
   * dropdown can render without client-side rrule logic. The hook's
   * internal `enabled` flag already gates on a non-empty `workspaceId`;
   * we don't pre-fetch when the dialog is closed — the hook is called
   * unconditionally (React hook rules) but TanStack's cache makes the
   * closed-dialog case free.
   */
  const availabilityQuery = useTeamAvailability({
    workspaceId,
    ...(departmentId ? { departmentId } : {}),
    dateISO,
  });

  /**
   * `profile_id → { status, reason }` keyed for O(1) lookup. Missing
   * profiles default to `available` (rule-less day = no restriction).
   */
  const availabilityMap = useMemo(() => {
    const map = new Map<string, { status: DailyStatus; reason: string | null }>();
    const rows = availabilityQuery.data?.profiles ?? [];
    for (const p of rows) {
      map.set(p.profile_id, {
        status: p.daily_status,
        reason: p.reason ?? null,
      });
    }
    return map;
  }, [availabilityQuery.data]);

  /**
   * Sorted profile list: by tier (available → preferred → unavailable →
   * absent), then alphabetically within each tier. Profiles without
   * availability rows fall into the `available` tier.
   */
  const sortedProfiles = useMemo(() => {
    const decorated = profiles.map((p) => {
      const entry = availabilityMap.get(p.profile_id);
      const status: DailyStatus = entry?.status ?? "available";
      const name = p.display_name ?? p.profile_id;
      return { profile: p, status, name };
    });
    decorated.sort((a, b) => {
      const tierDiff = STATUS_TIER[a.status] - STATUS_TIER[b.status];
      if (tierDiff !== 0) return tierDiff;
      return a.name.localeCompare(b.name, "nb");
    });
    return decorated;
  }, [profiles, availabilityMap]);

  const selectedStatus: DailyStatus | null = useMemo(() => {
    if (!profileId) return null;
    return availabilityMap.get(profileId)?.status ?? "available";
  }, [profileId, availabilityMap]);

  const selectedReason: string | null = useMemo(() => {
    if (!profileId) return null;
    return availabilityMap.get(profileId)?.reason ?? null;
  }, [profileId, availabilityMap]);

  const selectedName: string | null = useMemo(() => {
    if (!profileId) return null;
    const match = profiles.find((p) => p.profile_id === profileId);
    return match?.display_name ?? null;
  }, [profileId, profiles]);

  const isOverride = selectedStatus === "unavailable" || selectedStatus === "absent";

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
          channel: "chat",
          departmentSessionId,
          // Pass departmentId so RosterTab CTA-created shifts get
          // department_id populated. Without this, session-less manual
          // adds land with department_id=NULL and disappear from the
          // very tab that created them (use-roster.ts filters dept
          // directly — see migration 20260519000000).
          ...(departmentId ? { departmentId } : {}),
          profileId,
          startAtISO: localToISO(startAt),
          endAtISO: localToISO(endAt),
          role: roleTrimmed,
          reason: reasonTrimmed,
          // Override context — the Server Action writes this into
          // `activity_trail.data.override_reason` via `emit()` when
          // present. Status is the employee's resolved daily status at
          // the moment of override (so the audit trail preserves what
          // the admin saw, not what's true later).
          ...(isOverride
            ? {
                overrideReason: `availability=${selectedStatus ?? "unknown"}; reason=${selectedReason ?? "n/a"}`,
              }
            : {}),
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
        qc.invalidateQueries({ queryKey: ["team-availability"] });
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
          transition={reducedMotion ? { duration: 0 } : { type: "spring", ...motionTokens.spring }}
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
                  ) : sortedProfiles.length === 0 ? (
                    <SelectItem value="__empty__" disabled>
                      Ingen ansatte funnet
                    </SelectItem>
                  ) : (
                    sortedProfiles.map(({ profile, status, name }) => {
                      const muted = status === "unavailable" || status === "absent";
                      return (
                        <SelectItem key={profile.profile_id} value={profile.profile_id}>
                          <span
                            className={
                              muted
                                ? "text-muted-foreground inline-flex items-center gap-1.5"
                                : "inline-flex items-center gap-1.5"
                            }
                          >
                            {muted && (
                              <AlertCircle
                                className="h-3.5 w-3.5"
                                aria-label={STATUS_LABEL_NB_INLINE[status]}
                              />
                            )}
                            <span>{name}</span>
                          </span>
                        </SelectItem>
                      );
                    })
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

          {isOverride && selectedName && (
            <motion.div
              role="status"
              aria-live="polite"
              initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reducedMotion ? { duration: 0 } : { type: "spring", ...motionTokens.spring }
              }
              className="bg-warning/10 border-warning/30 text-foreground mt-4 flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <AlertTriangle className="text-warning mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div className="space-y-0.5">
                <p>
                  <span className="font-medium">{selectedName}</span> er{" "}
                  {STATUS_LABEL_NB_INLINE[selectedStatus ?? "unavailable"]} denne dagen
                  {selectedReason ? (
                    <>
                      {" "}
                      — <span className="text-muted-foreground">{selectedReason}</span>
                    </>
                  ) : null}
                  .
                </p>
                <p className="text-muted-foreground text-xs">
                  Du kan fortsatt lagre vakten. Overstyringen loggføres i revisjonsloggen.
                </p>
              </div>
            </motion.div>
          )}

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
