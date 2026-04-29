"use client";

import { useEffect, useState } from "react";
import { formatISO } from "date-fns";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type CalendarEvent, type EventColor, EVENT_COLOR_HEX } from "../_lib/types";
import { newId } from "../_lib/store";
import { SheetShell } from "./SheetShell";

type EventSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: Partial<CalendarEvent> | null;
  onSave: (event: CalendarEvent) => void;
  onDelete?: (id: string) => void;
};

const COLOR_OPTIONS: { value: EventColor; label: string }[] = [
  { value: "orange", label: "Oransje" },
  { value: "warm", label: "Honning" },
  { value: "amber", label: "Rav" },
  { value: "rose", label: "Rose" },
  { value: "neutral", label: "Nøytral" },
];

export function EventSheet({ open, onOpenChange, initial, onSave, onDelete }: EventSheetProps) {
  const isEdit = Boolean(initial?.id);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState("");
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(10);
  const [color, setColor] = useState<EventColor>("orange");

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setNotes(initial?.notes ?? "");
    setDate(initial?.date ?? formatISO(new Date(), { representation: "date" }));
    setStartHour(initial?.startHour ?? 9);
    setEndHour(initial?.endHour ?? 10);
    setColor(initial?.color ?? "orange");
  }, [open, initial]);

  const handleSave = () => {
    const id = initial?.id ?? newId("evt");
    onSave({
      id,
      title: title.trim() || "(uten tittel)",
      notes: notes.trim() || undefined,
      date,
      startHour,
      endHour: Math.max(endHour, startHour + 1),
      color,
      source: initial?.source ?? "manual",
    });
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (initial?.id && onDelete) {
      onDelete(initial.id);
      onOpenChange(false);
    }
  };

  const body = (
    <div className="flex flex-col gap-5">
      <Field label="Tittel" htmlFor="evt-title">
        <Input
          id="evt-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="F.eks. Sjefsmøte"
          autoFocus
        />
      </Field>

      <Field label="Dato" htmlFor="evt-date">
        <Input
          id="evt-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Start" htmlFor="evt-start">
          <Input
            id="evt-start"
            type="number"
            min={0}
            max={23}
            value={startHour}
            onChange={(e) => setStartHour(Number(e.target.value))}
          />
        </Field>
        <Field label="Slutt" htmlFor="evt-end">
          <Input
            id="evt-end"
            type="number"
            min={1}
            max={24}
            value={endHour}
            onChange={(e) => setEndHour(Number(e.target.value))}
          />
        </Field>
      </div>

      <Field label="Farge">
        <div className="flex items-center gap-2">
          {COLOR_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setColor(opt.value)}
              aria-label={opt.label}
              className={`h-7 w-7 rounded-full border-2 transition-all ${
                color === opt.value
                  ? "border-foreground scale-110 shadow-sm"
                  : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: EVENT_COLOR_HEX[opt.value] }}
            />
          ))}
        </div>
      </Field>

      <Field label="Notater" htmlFor="evt-notes">
        <Textarea
          id="evt-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Detaljer, lenke, agenda…"
        />
      </Field>
    </div>
  );

  const footer = (
    <div className="flex items-center justify-between gap-2">
      {isEdit && onDelete ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="mr-1 h-4 w-4" />
          Slett
        </Button>
      ) : (
        <span />
      )}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
          Avbryt
        </Button>
        <Button size="sm" onClick={handleSave}>
          Lagre
        </Button>
      </div>
    </div>
  );

  return (
    <SheetShell
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Rediger event" : "Nytt event"}
      description={isEdit ? "Endre detaljene eller slett." : "Legg til et nytt event."}
      body={body}
      footer={footer}
    />
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
        {label}
      </Label>
      {children}
    </div>
  );
}
