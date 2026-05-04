"use client";

/**
 * SeasonQuickCreateSheet — right-side shadcn Sheet used after draw-to-create
 * on the year-wheel canvas. Collects name, dates, color, and binds to the
 * active planning cycle for the target year. On submit, routes to
 * /dashboard/season/{id}?tab=budget.
 *
 * Why a separate sheet (not the old SeasonCreateSheet): the year-wheel
 * redesign (spec §4.2) replaces the drawer-based flow with a dedicated
 * season page. This sheet is the first touchpoint — keep it minimal so
 * the user lands on the full editor within one click.
 *
 * Telemetry note: parent owns workspace/actor context — this sheet only
 * reports abandon via `onAbandon` so the parent can emit
 * "season draw_cancelled" with a sheet_abandoned reason.
 */

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useTranslation } from "@smartout/i18n";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useSeasons, usePlanningCycles } from "@/app/dashboard/year-wheel/_hooks";

// Curated palette: brand orange + five distinct swatches (amber, red, blue,
// purple, green) so a workspace with 6 active seasons still reads clearly.
const COLOR_PRESETS = [
  "var(--brand-orange)",
  "#c18200",
  "#e7000b",
  "#2784d5",
  "#864ad2",
  "#2ba85a",
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-filled start date (YYYY-MM-DD) from the canvas draw. */
  initialStart: string;
  /** Pre-filled end date (YYYY-MM-DD) from the canvas draw. */
  initialEnd: string;
  /** The year the canvas is showing — used to pick a matching planning cycle. */
  year: number;
  /**
   * Fires when the sheet closes without a successful submit. Parent uses this
   * to emit `season draw_cancelled` with `reason: "sheet_abandoned"` so we
   * keep workspace/actor IDs out of this component.
   */
  onAbandon?: (reason: "sheet_abandoned") => void;
};

export function SeasonQuickCreateSheet({
  open,
  onOpenChange,
  initialStart,
  initialEnd,
  year,
  onAbandon,
}: Props) {
  const router = useRouter();
  const { t } = useTranslation("year-wheel");
  const { createSeason } = useSeasons();
  const { cycles } = usePlanningCycles();

  // Match cycle by UTC year of start_date so DST edges don't shift us a year.
  const activeCycleForYear = cycles?.find(
    (c) => c.start_date != null && new Date(c.start_date).getUTCFullYear() === year,
  );

  const [name, setName] = useState("Ny sesong");
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const [color, setColor] = useState<string>(COLOR_PRESETS[0]!);
  const [submitting, setSubmitting] = useState(false);

  // Close semantics: treat any close-without-submit as an abandon so the
  // parent can record it. We check !submitting to avoid double-firing when
  // the sheet closes as part of a successful submit flow.
  const handleClose = (next: boolean) => {
    if (!next && !submitting) {
      onAbandon?.("sheet_abandoned");
    }
    onOpenChange(next);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const created = await createSeason.mutateAsync({
        name: name.trim(),
        startDate,
        endDate,
        color,
        planningCycleId: activeCycleForYear?.planning_cycle_id ?? null,
      });
      onOpenChange(false);
      router.push(`/dashboard/season/${created.season_id}?tab=budget`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Kunne ikke opprette sesong: ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        {/* Form wrapper so Enter on any input submits — Supervisor council C10. */}
        <form onSubmit={handleSubmit}>
          <SheetHeader>
            <SheetTitle className="font-heading">Ny sesong</SheetTitle>
            <SheetDescription>Fyll inn navn og bekreft perioden.</SheetDescription>
          </SheetHeader>

          <div className="my-6 space-y-5">
            <div>
              <Label htmlFor="season-name">Navn</Label>
              <Input
                id="season-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                minLength={1}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="start-date">Start</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="end-date">Slutt</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <Label>Farge</Label>
              <div className="mt-1.5 flex gap-2">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setColor(preset)}
                    className={`h-7 w-7 rounded-full border-2 ${
                      color === preset ? "border-foreground" : "border-transparent"
                    }`}
                    style={{ background: preset }}
                    aria-label={`Velg farge ${preset}`}
                  />
                ))}
              </div>
            </div>

            {!activeCycleForYear && (
              <div className="border-muted text-muted-foreground rounded-md border border-dashed p-3 text-xs">
                {t("quickCreate.noPlanningCycleWarning", { year })}
              </div>
            )}
          </div>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              {t("quickCreate.cancel")}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Oppretter…" : "Opprett sesong"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
