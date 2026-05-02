"use client";

import { useEffect, useState } from "react";
import { formatISO } from "date-fns";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { type Booking } from "../_lib/types";
import { newId } from "../_lib/store";
import { SheetShell } from "./SheetShell";

type BookingSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: Partial<Booking> | null;
  onSave: (booking: Booking) => void;
  onDelete?: (id: string) => void;
};

export function BookingSheet({ open, onOpenChange, initial, onSave, onDelete }: BookingSheetProps) {
  const isEdit = Boolean(initial?.id);
  const [guest, setGuest] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("18:00");
  const [seats, setSeats] = useState(2);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setGuest(initial?.guest ?? "");
    setDate(initial?.date ?? formatISO(new Date(), { representation: "date" }));
    setTime(initial?.time ?? "18:00");
    setSeats(initial?.seats ?? 2);
    setNotes(initial?.notes ?? "");
  }, [open, initial]);

  const handleSave = () => {
    onSave({
      id: initial?.id ?? newId("bkg"),
      guest: guest.trim() || "(uten navn)",
      date,
      time,
      seats: Math.max(1, seats),
      notes: notes.trim() || undefined,
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
      <Field label="Gjest / firma" htmlFor="bkg-guest">
        <Input
          id="bkg-guest"
          value={guest}
          onChange={(e) => setGuest(e.target.value)}
          placeholder="F.eks. Statkraft"
          autoFocus
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Dato" htmlFor="bkg-date">
          <Input id="bkg-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Tid" htmlFor="bkg-time">
          <Input id="bkg-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>

      <Field label="Antall personer" htmlFor="bkg-seats">
        <Input
          id="bkg-seats"
          type="number"
          min={1}
          value={seats}
          onChange={(e) => setSeats(Number(e.target.value))}
        />
      </Field>

      <Field label="Notater" htmlFor="bkg-notes">
        <Textarea
          id="bkg-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Allergier, preferanser, anledning…"
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
      title={isEdit ? "Rediger booking" : "Ny booking"}
      description={isEdit ? "Endre eller slett bookingen." : "Registrer ny booking."}
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
      <Label
        htmlFor={htmlFor}
        className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase"
      >
        {label}
      </Label>
      {children}
    </div>
  );
}
