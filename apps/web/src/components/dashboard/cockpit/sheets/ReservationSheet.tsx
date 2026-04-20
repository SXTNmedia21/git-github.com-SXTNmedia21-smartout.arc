"use client";

// ============================================
// ReservationSheet.tsx
// Creates a row in schedule_day_booking for the
// cockpit anchor date. Defaults to anchor but lets
// operator pick any future date via the form.
// ============================================

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "@smartout/i18n";
import { createClient } from "@smartout/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useWorkspace } from "@/lib/workspace-context";

type ReservationSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorDate: string;
};

type FormState = {
  title: string;
  shiftDate: string;
  bookingTime: string;
  guestCount: string;
  contactPerson: string;
  location: string;
  notes: string;
  isVip: boolean;
};

const EMPTY_STATE: FormState = {
  title: "",
  shiftDate: "",
  bookingTime: "19:00",
  guestCount: "2",
  contactPerson: "",
  location: "",
  notes: "",
  isVip: false,
};

export function ReservationSheet({ open, onOpenChange, anchorDate }: ReservationSheetProps) {
  const { t } = useTranslation("dashboard");
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>({ ...EMPTY_STATE, shiftDate: anchorDate });

  // Reset form each time the sheet opens, defaulting date to current anchor.
  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY_STATE, shiftDate: anchorDate });
    }
  }, [open, anchorDate]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("title required");
      if (!form.shiftDate) throw new Error("date required");
      if (!form.bookingTime) throw new Error("time required");

      const supabase = createClient();
      const guestCount = Number.parseInt(form.guestCount, 10);
      const payload = {
        workspace_id: workspace.workspace_id,
        shift_date: form.shiftDate,
        title: form.title.trim(),
        booking_time: form.bookingTime,
        guest_count: Number.isFinite(guestCount) && guestCount > 0 ? guestCount : 0,
        location: form.location.trim() || null,
        contact_person: form.contactPerson.trim() || null,
        notes: form.notes.trim() || null,
        is_vip: form.isVip,
      };
      const { data, error } = await supabase
        .from("schedule_day_booking")
        .insert(payload)
        .select("schedule_day_booking_id")
        .single();
      if (error) throw error;
      return data as { schedule_day_booking_id: string };
    },
    onSuccess: () => {
      toast.success(t("cockpit.reservation_saved"));
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "prep-reservations"] });
      void queryClient.invalidateQueries({ queryKey: ["schedule", "day-bookings"] });
      onOpenChange(false);
    },
    onError: (err) => {
      console.error("[ReservationSheet] save failed", err);
      toast.error(t("cockpit.reservation_save_failed"));
    },
  });

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full max-w-md flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{t("cockpit.reservation_title")}</SheetTitle>
          <SheetDescription>{t("cockpit.reservation_description")}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label htmlFor="res-title">{t("cockpit.reservation_field_title")}</Label>
            <Input
              id="res-title"
              value={form.title}
              onChange={(e) => setField("title", e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="res-date">{t("cockpit.anchor_pick")}</Label>
              <Input
                id="res-date"
                type="date"
                value={form.shiftDate}
                onChange={(e) => setField("shiftDate", e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-time">{t("cockpit.reservation_field_time")}</Label>
              <Input
                id="res-time"
                type="time"
                value={form.bookingTime}
                onChange={(e) => setField("bookingTime", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="res-guests">{t("cockpit.reservation_field_guests")}</Label>
              <Input
                id="res-guests"
                type="number"
                min={1}
                value={form.guestCount}
                onChange={(e) => setField("guestCount", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-location">{t("cockpit.reservation_field_location")}</Label>
              <Input
                id="res-location"
                value={form.location}
                onChange={(e) => setField("location", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="res-contact">{t("cockpit.reservation_field_contact")}</Label>
            <Input
              id="res-contact"
              value={form.contactPerson}
              onChange={(e) => setField("contactPerson", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="res-notes">{t("cockpit.reservation_field_notes")}</Label>
            <Textarea
              id="res-notes"
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="res-vip"
              checked={form.isVip}
              onCheckedChange={(checked) => setField("isVip", checked === true)}
            />
            <Label htmlFor="res-vip" className="cursor-pointer">
              {t("cockpit.reservation_field_vip")}
            </Label>
          </div>
        </div>

        <SheetFooter className="mt-4">
          <Button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={!form.title.trim() || saveMutation.isPending}
          >
            {t("cockpit.reservation_save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
