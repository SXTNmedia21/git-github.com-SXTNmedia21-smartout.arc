"use client";

/**
 * Procedure builder with inline step editor.
 * Add/remove/reorder steps for a procedure within a protocol.
 * Connected to: use-governance-mutations.ts (useCreateProcedure)
 *
 * UI Events:
 * - action: addStep (adds step to list)
 * - action: removeStep (removes step from list)
 * - action: submitProcedure (creates procedure with steps)
 */

import { useState } from "react";
import { Plus, Trash2, GripVertical, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useCreateProcedure } from "../_hooks/use-governance-mutations";

type StepDraft = {
  id: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  isRequired: boolean;
};

export function ProcedureBuilder() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [protocolId, setProtocolId] = useState("");
  const [steps, setSteps] = useState<StepDraft[]>([]);

  const { workspace } = useWorkspace();
  const createProcedure = useCreateProcedure();

  // Fetch available protocols
  const { data: protocols } = useQuery({
    queryKey: ["governance", "protocols", workspace.workspace_id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("protocol")
        .select("protocol_id, name")
        .eq("workspace_id", workspace.workspace_id)
        .eq("status", "active")
        .order("name");

      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  function addStep() {
    setSteps((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        title: "",
        description: "",
        estimatedMinutes: 5,
        isRequired: true,
      },
    ]);
  }

  function removeStep(id: string) {
    setSteps((prev) => prev.filter((s) => s.id !== id));
  }

  function updateStep(id: string, field: keyof StepDraft, value: string | number | boolean) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !protocolId) return;

    createProcedure.mutate(
      {
        name: name.trim(),
        description: description.trim() || undefined,
        protocol_id: protocolId,
        steps: steps.map((s, idx) => ({
          title: s.title,
          description: s.description || s.title,
          step_order: idx + 1,
          is_required: s.isRequired,
          estimated_minutes: s.estimatedMinutes || undefined,
        })),
      },
      {
        onSuccess: () => {
          setOpen(false);
          resetForm();
        },
      },
    );
  }

  function resetForm() {
    setName("");
    setDescription("");
    setProtocolId("");
    setSteps([]);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors">
          <Plus className="h-4 w-4" />
          Ny Prosedyre
        </button>
      </SheetTrigger>
      <SheetContent className="w-[400px] overflow-y-auto sm:w-[600px]">
        <SheetHeader>
          <SheetTitle>Opprett ny prosedyre</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="proc-name">Navn</Label>
            <Input
              id="proc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="F.eks. Apningsrutine bar"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="proc-desc">Beskrivelse (valgfritt)</Label>
            <Textarea
              id="proc-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Tilhorende protokoll</Label>
            <Select value={protocolId} onValueChange={setProtocolId}>
              <SelectTrigger>
                <SelectValue placeholder="Velg protokoll..." />
              </SelectTrigger>
              <SelectContent>
                {(protocols ?? []).map((p) => (
                  <SelectItem key={p.protocol_id} value={p.protocol_id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Steps builder */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Steg</Label>
              <button
                type="button"
                onClick={addStep}
                className="text-primary flex items-center gap-1 text-xs font-bold transition-colors hover:underline"
              >
                <Plus className="h-3 w-3" />
                Legg til steg
              </button>
            </div>

            {steps.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">
                Ingen steg lagt til enna. Klikk &quot;Legg til steg&quot; for a begynne.
              </p>
            ) : (
              <div className="space-y-2">
                {steps.map((step, idx) => (
                  <div key={step.id} className="border-border bg-muted/30 rounded-lg border p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <GripVertical className="text-muted-foreground h-4 w-4 shrink-0" />
                      <span className="text-muted-foreground text-xs font-bold">
                        Steg {idx + 1}
                      </span>
                      <div className="flex-1" />
                      <button
                        type="button"
                        onClick={() => removeStep(step.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <Input
                        value={step.title}
                        onChange={(e) => updateStep(step.id, "title", e.target.value)}
                        placeholder="Stegtittel..."
                        className="text-sm"
                      />
                      <Textarea
                        value={step.description}
                        onChange={(e) => updateStep(step.id, "description", e.target.value)}
                        placeholder="Beskrivelse av steget..."
                        rows={2}
                        className="text-sm"
                      />
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <Label className="text-muted-foreground text-xs">Min:</Label>
                          <Input
                            type="number"
                            value={step.estimatedMinutes}
                            onChange={(e) =>
                              updateStep(step.id, "estimatedMinutes", parseInt(e.target.value) || 0)
                            }
                            className="h-7 w-16 text-xs"
                            min={0}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              Avbryt
            </button>
            <button
              type="submit"
              disabled={createProcedure.isPending || !name.trim() || !protocolId}
              className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors disabled:opacity-50"
            >
              {createProcedure.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Opprett
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
