// ============================================
// booking-dialog.tsx
// Dialog for manually adding a booking to a specific day.
// Uses shadcn Dialog + form fields. Dispatches ADD_BOOKING
// to the schedule context on submit.
// Connected to: schedule-context.tsx (dispatch consumer)
// Connected to: daily-briefing.tsx (opened from BookingsTab)
// ============================================
"use client";

import { useState } from "react";
import { CalendarCheck } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import { useCreateDayBooking } from "../_hooks/use-day-content";
import { useWeekRange } from "../_hooks/use-week-range";

// ── Props ────────────────────────────────────────────────────

type BookingDialogProps = {
  dateId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// ── Component ────────────────────────────────────────────────

/**
 * Dialog for creating a new booking on a given day.
 * All fields map 1:1 to the DayBooking type in schedule-types.ts.
 *
 * @param dateId - The day to attach the booking to
 * @param open - Controlled open state
 * @param onOpenChange - Callback when open state changes
 */
export function BookingDialog({ dateId, open, onOpenChange }: BookingDialogProps) {
  const { weekStart } = useWeekRange();
  const createDayBooking = useCreateDayBooking(weekStart);

  // Form state
  const [title, setTitle] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [menu, setMenu] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<"confirmed" | "pending" | "cancelled">("pending");
  const [isVip, setIsVip] = useState(false);
  const [notes, setNotes] = useState("");
  const [contactPerson, setContactPerson] = useState("");

  /**
   * Resets all form fields to their default values.
   */
  function resetForm() {
    setTitle("");
    setGuestCount("");
    setMenu("");
    setTime("");
    setLocation("");
    setStatus("pending");
    setIsVip(false);
    setNotes("");
    setContactPerson("");
  }

  /**
   * Validates required fields and dispatches ADD_BOOKING.
   * Shows toast feedback and closes dialog on success.
   */
  function handleSubmit() {
    if (!title.trim()) {
      toast.error("Tittel er påkrevd");
      return;
    }

    const parsedGuests = parseInt(guestCount, 10);
    if (isNaN(parsedGuests) || parsedGuests < 1) {
      toast.error("Antall gjester må være minst 1");
      return;
    }

    if (!time.trim() || !/^\d{2}:\d{2}$/.test(time.trim())) {
      toast.error("Tidspunkt er påkrevd (HH:MM)");
      return;
    }

    createDayBooking.mutate({
      id: crypto.randomUUID(),
      dateId,
      title: title.trim(),
      guestCount: parsedGuests,
      menu: menu.trim() || "Ikke spesifisert",
      time: time.trim(),
      location: location.trim() || "Ikke tildelt",
      status,
      isVip,
      notes: notes.trim() || undefined,
      contactPerson: contactPerson.trim() || undefined,
    });

    toast.success(`Booking "${title.trim()}" lagt til`);
    resetForm();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-orange-400" />
            Ny booking
          </DialogTitle>
          <DialogDescription>Legg til en reservasjon eller et selskap for dagen.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Title */}
          <div className="grid gap-1.5">
            <Label htmlFor="booking-title">Tittel *</Label>
            <Input
              id="booking-title"
              placeholder="F.eks. Julebord Firma AS"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Guest count + time row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="booking-guests">Antall gjester *</Label>
              <Input
                id="booking-guests"
                type="number"
                min={1}
                placeholder="30"
                value={guestCount}
                onChange={(e) => setGuestCount(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="booking-time">Tidspunkt</Label>
              <Input
                id="booking-time"
                placeholder="18:00"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          {/* Menu */}
          <div className="grid gap-1.5">
            <Label htmlFor="booking-menu">Meny</Label>
            <Input
              id="booking-menu"
              placeholder="3-retters julemeny"
              value={menu}
              onChange={(e) => setMenu(e.target.value)}
            />
          </div>

          {/* Location */}
          <div className="grid gap-1.5">
            <Label htmlFor="booking-location">Lokasjon</Label>
            <Input
              id="booking-location"
              placeholder="Festsalen"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          {/* Status + VIP row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">Bekreftet</SelectItem>
                  <SelectItem value="pending">Avventer</SelectItem>
                  <SelectItem value="cancelled">Kansellert</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="booking-vip">VIP</Label>
              <div className="flex h-9 items-center">
                <Switch id="booking-vip" checked={isVip} onCheckedChange={setIsVip} />
                <span className="text-muted-foreground ml-2 text-xs">{isVip ? "Ja" : "Nei"}</span>
              </div>
            </div>
          </div>

          {/* Contact person */}
          <div className="grid gap-1.5">
            <Label htmlFor="booking-contact">Kontaktperson</Label>
            <Input
              id="booking-contact"
              placeholder="Navn på kontaktperson"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="grid gap-1.5">
            <Label htmlFor="booking-notes">Notater</Label>
            <textarea
              id="booking-notes"
              placeholder="Allergier, spesielle ønsker, etc."
              className="border-input placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[60px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground rounded-md px-4 py-2 text-sm font-medium transition-colors"
          >
            Avbryt
          </button>
          <button
            onClick={handleSubmit}
            className="rounded-md border border-orange-500/30 bg-orange-500/20 px-4 py-2 text-sm font-bold text-orange-400 transition-all hover:bg-orange-500/30"
          >
            Legg til booking
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
