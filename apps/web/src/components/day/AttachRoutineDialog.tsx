"use client";

/**
 * AttachRoutineDialog — modal for attaching a location-scoped timeline template
 * (routine) to an existing day_line.
 *
 * Shows a Select for templates where scope_type = 'location' AND scope_id =
 * locationId (via useTimelineTemplates BFF hook — no direct DB access here).
 * When a template is selected, a preview "{N} oppgaver vil bli lagt til" is
 * rendered below. On submit it calls instantiateTemplateAction and invalidates
 * both ["day-lines"] and ["calendar-items"] queries.
 *
 * L-0177 guard: day_line_id and template_id flow through the action;
 * workspace_id and actor identity are resolved server-side (ADR-0151). No
 * workspace_id is sent in the form body.
 *
 * References: ADR-0099, ADR-0134, ADR-0151, ADR-0240, ADR-0356, ADR-0367.
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { useTimelineTemplates } from "@/app/dashboard/_hooks/timeline-template";
import { instantiateTemplateAction } from "@/app/dashboard/_actions/instantiate-template-action";
import type { TimelineTemplateRow } from "@smartout/types";

// ─── Props ────────────────────────────────────────────────────────────────────

export type AttachRoutineDialogProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** day_line_id the template will be instantiated onto. */
  dayLineId: string;
  /** location_id used to filter templates (scope_type='location'). */
  locationId: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Safely derive item count from a template row (field may vary by API version). */
function getItemCount(tpl: TimelineTemplateRow): number {
  const withCount = tpl as TimelineTemplateRow & { item_count?: number };
  if (typeof withCount.item_count === "number") return withCount.item_count;
  const withItems = tpl as TimelineTemplateRow & { items?: unknown[] };
  if (Array.isArray(withItems.items)) return withItems.items.length;
  return 0;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AttachRoutineDialog({
  open,
  onOpenChange,
  dayLineId,
  locationId,
}: AttachRoutineDialogProps) {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id;
  const [templateId, setTemplateId] = useState("");
  const queryClient = useQueryClient();

  // Fetch location-scoped templates via BFF (no direct Supabase access).
  const { data: templates = [], isLoading: templatesLoading } = useTimelineTemplates({
    workspaceId,
    scopeType: "location",
    scopeId: locationId,
    includeArchived: false,
  });

  const selectedTemplate = templates.find((t) => t.id === templateId);
  const taskCount = selectedTemplate ? getItemCount(selectedTemplate) : 0;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!templateId) throw new Error("Velg en mal.");
      const result = await instantiateTemplateAction({
        day_line_id: dayLineId,
        template_id: templateId,
      });
      if (!result.ok) {
        throw new Error(result.error ?? "Ukjent feil.");
      }
      return result;
    },
    onSuccess: (result) => {
      const count = result.ok ? result.items_applied : 0;
      void queryClient.invalidateQueries({ queryKey: ["day-lines"] });
      void queryClient.invalidateQueries({ queryKey: ["calendar-items"] });
      toast.success(`${count} oppgave${count === 1 ? "" : "r"} lagt til.`);
      setTemplateId("");
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Kunne ikke legge til rutine.");
    },
  });

  const handleOpenChange = (next: boolean) => {
    if (!next) setTemplateId("");
    onOpenChange(next);
  };

  const canSubmit = Boolean(templateId) && !mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        data-testid="attach-routine-dialog"
        className="border-border bg-background border sm:max-w-sm"
      >
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Sparkles className="text-muted-foreground h-4 w-4" />
            Legg til rutine
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Velg en mal for å legge til oppgaver på denne dagslinjen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="template-picker" className="text-foreground text-sm font-medium">
              Mal
            </Label>
            <Select
              value={templateId}
              onValueChange={setTemplateId}
              disabled={templatesLoading || mutation.isPending}
            >
              <SelectTrigger
                id="template-picker"
                data-testid="template-picker"
                className="border-border bg-background text-foreground"
              >
                <SelectValue
                  placeholder={
                    templatesLoading
                      ? "Laster maler…"
                      : templates.length === 0
                        ? "Ingen maler for dette området"
                        : "Velg mal"
                  }
                />
              </SelectTrigger>
              <SelectContent className="border-border bg-background">
                {templates.map((tpl) => (
                  <SelectItem
                    key={tpl.id}
                    value={tpl.id}
                    className="text-foreground focus:bg-muted"
                  >
                    <span>{tpl.name}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      ({getItemCount(tpl)} oppgaver)
                    </span>
                  </SelectItem>
                ))}
                {!templatesLoading && templates.length === 0 && (
                  <div className="text-muted-foreground px-2 py-3 text-center text-xs">
                    Ingen maler for dette området
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedTemplate && (
            <div
              data-testid="template-preview"
              className="border-border bg-muted text-foreground rounded-lg border px-3.5 py-3 text-sm"
            >
              <span className="font-medium">{taskCount}</span>{" "}
              {taskCount === 1 ? "oppgave" : "oppgaver"} vil bli lagt til
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={mutation.isPending}
            className="text-muted-foreground hover:text-foreground"
          >
            Avbryt
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!canSubmit}
            data-testid="attach-routine-submit"
            className="bg-background border-border text-foreground hover:bg-muted border"
          >
            {mutation.isPending ? "Legger til…" : "Legg til rutine"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
