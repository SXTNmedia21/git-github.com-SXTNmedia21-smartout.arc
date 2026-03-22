"use client";

/**
 * Repeatable content task configuration for a spokesperson section.
 *
 * Each task specifies what the spokesperson should produce (photo, post, quote,
 * custom), how often (weekly / biweekly / monthly), which weekday the deadline
 * falls on, any extra instructions, and whether the task is active.
 *
 * Changes propagate immediately via the onChange prop.
 */

import { useCallback } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";
import type { ContentTask } from "@smartout/website";

const TASK_TYPE_LABELS: Record<ContentTask["type"], string> = {
  upload_photo: "Last opp bilde",
  write_post: "Skriv innlegg",
  update_quote: "Oppdater sitat",
  custom: "Egendefinert",
};

const FREQUENCY_LABELS: Record<ContentTask["frequency"], string> = {
  weekly: "Ukentlig",
  biweekly: "Annenhver uke",
  monthly: "Månedlig",
};

const WEEKDAY_LABELS: Record<number, string> = {
  0: "Mandag",
  1: "Tirsdag",
  2: "Onsdag",
  3: "Torsdag",
  4: "Fredag",
  5: "Lørdag",
  6: "Søndag",
};

const DEFAULT_TASK: ContentTask = {
  type: "write_post",
  frequency: "monthly",
  deadlineDay: 4, // Friday
  instructions: "",
  enabled: true,
};

type Props = {
  tasks: ContentTask[];
  onChange: (tasks: ContentTask[]) => void;
};

export default function ContentTaskConfig({ tasks, onChange }: Props) {
  const updateTask = useCallback(
    (index: number, patch: Partial<ContentTask>) => {
      const updated = tasks.map((t, i) => (i === index ? { ...t, ...patch } : t));
      onChange(updated);
    },
    [tasks, onChange],
  );

  const removeTask = useCallback(
    (index: number) => {
      onChange(tasks.filter((_, i) => i !== index));
    },
    [tasks, onChange],
  );

  const addTask = useCallback(() => {
    onChange([...tasks, { ...DEFAULT_TASK }]);
  }, [tasks, onChange]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Innholdsoppgaver</Label>
        <Button type="button" variant="outline" size="sm" onClick={addTask} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Legg til oppgave
        </Button>
      </div>

      {tasks.length === 0 && (
        <p className="text-muted-foreground py-2 text-sm">
          Ingen oppgaver konfigurert. Legg til oppgaver som talspersonen skal utføre.
        </p>
      )}

      {tasks.map((task, index) => (
        <div key={index} className="border-border bg-muted/30 space-y-3 rounded-lg border p-4">
          {/* Header: type + enable toggle + remove */}
          <div className="flex items-center gap-2">
            <Select
              value={task.type}
              onValueChange={(v) => updateTask(index, { type: v as ContentTask["type"] })}
            >
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TASK_TYPE_LABELS) as ContentTask["type"][]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {TASK_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Switch
              checked={task.enabled}
              onCheckedChange={(enabled) => updateTask(index, { enabled })}
              aria-label="Aktiver oppgave"
            />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeTask(index)}
              className="text-muted-foreground hover:text-destructive h-8 w-8"
              aria-label="Fjern oppgave"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Frequency + deadline row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block text-xs">Frekvens</Label>
              <Select
                value={task.frequency}
                onValueChange={(v) =>
                  updateTask(index, { frequency: v as ContentTask["frequency"] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(FREQUENCY_LABELS) as ContentTask["frequency"][]).map((f) => (
                    <SelectItem key={f} value={f}>
                      {FREQUENCY_LABELS[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1 block text-xs">Frist (ukedag)</Label>
              <Select
                value={String(task.deadlineDay)}
                onValueChange={(v) => updateTask(index, { deadlineDay: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(WEEKDAY_LABELS).map(([day, label]) => (
                    <SelectItem key={day} value={day}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Instructions */}
          <div>
            <Label className="mb-1 block text-xs">Instruksjoner (valgfritt)</Label>
            <Textarea
              value={task.instructions}
              onChange={(e) => updateTask(index, { instructions: e.target.value })}
              placeholder="Beskriv hva talspersonen skal lage…"
              rows={2}
              className="resize-none text-sm"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
