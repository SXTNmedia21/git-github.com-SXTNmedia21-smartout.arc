"use client";

/**
 * ApplyTemplateDialog — modal for applying a saved template to a target date.
 *
 * Shows: template name, scope chip, target date, item breakdown.
 * For free_form items: per-chip radio group (Oppgave | Notat | Hopp over).
 * Defaults all free_form items to "task".
 *
 * "Sett alle til oppgave" shortcut sets all free_form chips to task at once.
 *
 * Disabled when target_date <= today (Oslo TZ). BFF also enforces this.
 *
 * L-0177 guard: workspace_id is NOT supplied in the body; BFF derives it.
 *
 * Spec ref: docs/superpowers/specs/2026-05-16-timeline-templates-design.md §Apply flow
 * ADR ref:  ADR-0334
 */

import { useState, useMemo } from "react";
import { Calendar, Users, Building, MapPin, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useApplyTemplate } from "@/app/dashboard/_hooks/timeline-template";
import type {
  TimelineTemplateRow,
  TimelineTemplateItemT,
  TimelineTemplateItemsT,
  FreeFormMaterializationT,
  ScopeTypeT,
} from "@smartout/types";
import { TimelineTemplateItems } from "@smartout/types";

// ── Helpers ────────────────────────────────────────────────────────────────────

const SCOPE_META: Record<ScopeTypeT, { label: string; Icon: typeof Users; colorClass: string }> = {
  team: {
    label: "Team",
    Icon: Users,
    colorClass:
      "bg-[oklch(0.90_0.04_250)] text-[oklch(0.35_0.14_250)] border-[oklch(0.80_0.08_250)]",
  },
  department: {
    label: "Avdeling",
    Icon: Building,
    colorClass:
      "bg-[oklch(0.90_0.04_145)] text-[oklch(0.30_0.14_145)] border-[oklch(0.78_0.10_145)]",
  },
  location: {
    label: "Lokasjon",
    Icon: MapPin,
    colorClass: "bg-[oklch(0.90_0.04_55)] text-[oklch(0.30_0.10_55)] border-[oklch(0.82_0.08_55)]",
  },
  shift: {
    label: "Vakt",
    Icon: Clock,
    colorClass: "bg-muted text-muted-foreground border-border",
  },
};

const KIND_LABELS: Record<string, string> = {
  schedule_shift: "Vakt",
  session_hook: "Hook",
  session_task: "Oppgave",
  session_note: "Notat",
  deviation: "Avvik",
};

/** Format YYYY-MM-DD → "23. mai 2026" */
function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`); // noon UTC avoids midnight TZ flips
  return d.toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Oslo",
  });
}

/**
 * Today in Oslo TZ as YYYY-MM-DD.
 * Uses Intl API — works in Vercel edge + Node runtimes.
 */
function todayOslo(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Oslo" }).format(new Date());
}

// ── Types ──────────────────────────────────────────────────────────────────────

export type ApplyTemplateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: TimelineTemplateRow | null;
  /** ISO date the template will be applied to — from TimelineTab's dateISO. */
  targetDate: string;
  workspaceId: string;
  departmentId: string | null;
  sessionId: string | null;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function ApplyTemplateDialog({
  open,
  onOpenChange,
  template,
  targetDate,
  workspaceId,
  departmentId,
  sessionId,
}: ApplyTemplateDialogProps) {
  // Parse items_json from template row
  const items: TimelineTemplateItemsT = useMemo(() => {
    if (!template) return [];
    const parsed = TimelineTemplateItems.safeParse(template.items_json);
    return parsed.success ? parsed.data : [];
  }, [template]);

  // Free-form items and their indices
  const freeFormEntries: Array<{
    index: number;
    item: TimelineTemplateItemT & { kind: "free_form" };
  }> = useMemo(
    () =>
      items
        .map((item, index) => ({ index, item }))
        .filter(
          (
            entry,
          ): entry is { index: number; item: TimelineTemplateItemT & { kind: "free_form" } } =>
            entry.item.kind === "free_form",
        ),
    [items],
  );

  const nonFreeFormItems = useMemo(() => items.filter((i) => i.kind !== "free_form"), [items]);

  // Count non-free-form by kind
  const kindCounts: Record<string, number> = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of nonFreeFormItems) {
      counts[item.kind] = (counts[item.kind] ?? 0) + 1;
    }
    return counts;
  }, [nonFreeFormItems]);

  // Per-chip mapping state — keyed by item index → "task" | "note" | "skip".
  // We store OVERRIDES only; actual resolved value = overrides[index] ?? "task" (default).
  // This means we never need to reset state when template changes — missing keys naturally
  // fall back to "task", and stale overrides from the previous template are irrelevant
  // (they key on index, and new template indices start fresh from freeFormEntries).
  const [freeFormOverrides, setFreeFormOverrides] = useState<
    Record<number, FreeFormMaterializationT>
  >({});

  // Resolve effective mapping: override or default "task"
  const freeFormMapping = useMemo<Record<number, FreeFormMaterializationT>>(
    () =>
      Object.fromEntries(
        freeFormEntries.map(({ index }) => [index, freeFormOverrides[index] ?? "task"]),
      ),
    [freeFormEntries, freeFormOverrides],
  );

  const applyMutation = useApplyTemplate();
  const scopeMeta = template ? SCOPE_META[template.scope_type] : null;
  const ScopeIcon = scopeMeta?.Icon ?? Users;

  // Disable when target date is today or in the past
  const isPast = targetDate <= todayOslo();
  const isPending = applyMutation.isPending;

  // Count materialized (skip = 0, task/note = 1)
  const materializedFreeFormCount = Object.values(freeFormMapping).filter(
    (v) => v !== "skip",
  ).length;
  const totalMaterialized = nonFreeFormItems.length + materializedFreeFormCount;

  function setAllToTask() {
    setFreeFormOverrides(
      Object.fromEntries(
        freeFormEntries.map(({ index }) => [index, "task" as FreeFormMaterializationT]),
      ),
    );
  }

  function handleOpenChange(next: boolean) {
    if (!next) applyMutation.reset();
    onOpenChange(next);
  }

  async function handleConfirm() {
    if (!template) return;
    // Convert mapping to string-keyed (JSON object key constraint)
    const stringMapping: Record<string, FreeFormMaterializationT> = {};
    for (const [k, v] of Object.entries(freeFormMapping)) {
      stringMapping[String(k)] = v;
    }

    await applyMutation.mutateAsync(
      {
        template_id: template.id,
        target_date: targetDate,
        freeform_mapping: stringMapping,
        workspaceId,
        departmentId,
        sessionId,
      },
      {
        onSuccess: () => handleOpenChange(false),
      },
    );
  }

  if (!template || !scopeMeta) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg" aria-labelledby="apply-template-title">
        <DialogHeader>
          <DialogTitle id="apply-template-title" className="flex items-center gap-2">
            <Calendar className="text-muted-foreground h-4 w-4" aria-hidden />
            Bruk mal
          </DialogTitle>
        </DialogHeader>

        <div className="mt-1 flex flex-col gap-4">
          {/* Template info */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-foreground text-sm font-semibold">{template.name}</span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${scopeMeta.colorClass}`}
            >
              <ScopeIcon className="h-3 w-3" aria-hidden />
              {scopeMeta.label}
            </span>
          </div>

          {/* Target date + disabled notice */}
          <div className="flex flex-col gap-1">
            <p className="text-foreground text-sm">
              Brukes på: <span className="font-mono font-medium">{formatDate(targetDate)}</span>
            </p>
            {isPast && (
              <p className="text-destructive text-xs" role="alert">
                Kan ikke bruke mal på en dato som allerede har passert.
              </p>
            )}
          </div>

          {/* Will be created */}
          {Object.keys(kindCounts).length > 0 && (
            <div>
              <p className="text-muted-foreground mb-1.5 text-[11px] font-semibold tracking-wider uppercase">
                Vil bli opprettet
              </p>
              <ul className="border-border bg-muted/40 space-y-1 rounded-md border px-3 py-2">
                {Object.entries(kindCounts).map(([kind, count]) => (
                  <li key={kind} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{KIND_LABELS[kind] ?? kind}</span>
                    <span className="text-muted-foreground font-mono text-xs">{count}×</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Free-form chip materialization */}
          {freeFormEntries.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                  Fri tekst — velg type
                </p>
                {freeFormEntries.length > 1 && (
                  <button
                    type="button"
                    onClick={setAllToTask}
                    className="text-primary text-xs underline-offset-2 hover:underline"
                  >
                    Sett alle til oppgave
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-3">
                {freeFormEntries.map(({ index, item }) => (
                  <div
                    key={index}
                    className="border-border bg-muted/40 rounded-md border px-3 py-2.5"
                  >
                    <p className="text-foreground mb-2 text-sm font-medium">{item.payload.label}</p>
                    <RadioGroup
                      value={freeFormMapping[index] ?? "task"}
                      onValueChange={(val) =>
                        setFreeFormOverrides((prev) => ({
                          ...prev,
                          [index]: val as FreeFormMaterializationT,
                        }))
                      }
                      className="flex items-center gap-4"
                      aria-label={`Materialiseringsvalg for "${item.payload.label}"`}
                    >
                      {(
                        [
                          { value: "task", label: "Oppgave" },
                          { value: "note", label: "Notat" },
                          { value: "skip", label: "Hopp over" },
                        ] as const
                      ).map(({ value, label }) => (
                        <div key={value} className="flex items-center gap-1.5">
                          <RadioGroupItem
                            value={value}
                            id={`ff-${index}-${value}`}
                            className="h-3.5 w-3.5"
                          />
                          <Label
                            htmlFor={`ff-${index}-${value}`}
                            className="cursor-pointer text-sm font-normal"
                          >
                            {label}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error state from mutation */}
          {applyMutation.isError && (
            <p className="text-destructive text-sm" role="alert">
              {applyMutation.error?.message ?? "Påføring feilet — prøv igjen"}
            </p>
          )}
        </div>

        <DialogFooter className="mt-2 flex-col-reverse sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Avbryt
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={isPending || isPast}>
            {isPending
              ? "Oppretter…"
              : `Bekreft og legg til ${totalMaterialized} element${totalMaterialized !== 1 ? "er" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
