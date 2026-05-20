"use client";

/**
 * DayLineCreateSheet — right-side Sheet for creating a new day_line.
 *
 * The sheet is scoped to a single department_session. The user picks a
 * location from the locations linked to the department via department_location
 * (scope: departmentId), and optionally adds notes (≤ 2000 chars).
 *
 * On submit it calls createDayLineAction and invalidates the ["day-lines"]
 * query so the parent page refreshes automatically.
 *
 * L-0177 guard: department_session_id and location_id flow through the action;
 * workspace_id and actor identity are resolved server-side (ADR-0151). No
 * workspace_id is sent in the form body.
 *
 * References: ADR-0099, ADR-0134, ADR-0151, ADR-0367.
 */

import { useState } from "react";
import { PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createDayLineAction } from "@/app/dashboard/_actions/create-day-line-action";

// ─── Types ────────────────────────────────────────────────────────────────────

type LocationOption = { location_id: string; name: string };

// ─── Data hook ────────────────────────────────────────────────────────────────

/**
 * useDepartmentLocations — fetch location options for a given department.
 *
 * Joins department_location → location to produce a name-labelled list.
 * Enabled only when workspaceId + departmentId are available.
 */
function useDepartmentLocations(workspaceId: string | null | undefined, departmentId: string) {
  return useQuery({
    queryKey: ["department-locations", workspaceId ?? "", departmentId],
    enabled: !!workspaceId && !!departmentId,
    staleTime: 60_000,
    queryFn: async (): Promise<LocationOption[]> => {
      if (!workspaceId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("department_location")
        .select("location_id, location:location_id(name)")
        .eq("department_id", departmentId)
        .eq("workspace_id", workspaceId);

      if (error) throw error;

      return (data ?? []).map((row) => ({
        location_id: row.location_id,
        // Supabase returns join as object; cast carefully.
        name: (row.location as { name: string } | null)?.name ?? row.location_id,
      }));
    },
  });
}

// ─── Props ────────────────────────────────────────────────────────────────────

export type DayLineCreateSheetProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** department_id used to filter linked locations. */
  departmentId: string;
  /** department_session_id passed to createDayLineAction. */
  departmentSessionId: string;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function DayLineCreateSheet({
  open,
  onOpenChange,
  departmentId,
  departmentSessionId,
}: DayLineCreateSheetProps) {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id;
  const queryClient = useQueryClient();

  const [locationId, setLocationId] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const { data: locations = [], isLoading: loadingLocations } = useDepartmentLocations(
    workspaceId,
    departmentId,
  );

  const mutation = useMutation({
    mutationFn: async () => {
      if (!locationId) throw new Error("Velg et område.");

      const result = await createDayLineAction({
        department_session_id: departmentSessionId,
        location_id: locationId,
        notes: notes.trim() || undefined,
      });

      if (!result.ok) {
        throw new Error(result.error ?? "Ukjent feil.");
      }

      return result;
    },
    onSuccess: () => {
      toast.success("Dagslinje opprettet.");
      void queryClient.invalidateQueries({ queryKey: ["day-lines"] });
      handleClose();
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Kunne ikke opprette dagslinje.");
    },
  });

  function handleClose() {
    setLocationId("");
    setNotes("");
    onOpenChange(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <SheetContent
        side="right"
        data-testid="day-line-create-sheet"
        className="bg-background border-border flex w-[380px] flex-col gap-0 border-l sm:w-[420px]"
      >
        <SheetHeader className="border-border border-b px-6 pt-6 pb-4">
          <SheetTitle className="text-foreground flex items-center gap-2">
            <PlusCircle className="text-muted-foreground h-4 w-4" />
            Ny dagslinje
          </SheetTitle>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5"
        >
          {/* Location picker */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="location-picker" className="text-foreground text-sm">
              Område
            </Label>
            <Select
              value={locationId}
              onValueChange={setLocationId}
              disabled={loadingLocations || locations.length === 0}
            >
              <SelectTrigger
                id="location-picker"
                data-testid="location-picker"
                className="bg-background border-border text-foreground"
              >
                <SelectValue
                  placeholder={
                    loadingLocations
                      ? "Laster…"
                      : locations.length === 0
                        ? "Ingen områder tilgjengelig"
                        : "Velg område"
                  }
                />
              </SelectTrigger>
              <SelectContent className="bg-background border-border">
                {locations.map((loc) => (
                  <SelectItem key={loc.location_id} value={loc.location_id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="day-line-notes" className="text-foreground text-sm">
              Notater
            </Label>
            <Textarea
              id="day-line-notes"
              data-testid="day-line-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="Valgfrie notater for denne dagslinjen…"
              className="bg-background border-border text-foreground resize-none"
            />
            <span className="text-muted-foreground text-right text-xs">{notes.length} / 2000</span>
          </div>
        </form>

        <SheetFooter className="border-border flex justify-end gap-2 border-t px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={mutation.isPending}
            className="text-foreground/70"
          >
            Avbryt
          </Button>
          <Button
            type="submit"
            data-testid="create-day-line-submit"
            disabled={mutation.isPending || !locationId}
            onClick={handleSubmit}
            className="bg-background border-border text-foreground hover:bg-muted border"
          >
            {mutation.isPending ? "Oppretter…" : "Opprett"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
