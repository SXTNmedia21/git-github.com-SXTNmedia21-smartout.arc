"use client";

import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type Booking } from "../_lib/types";

type BookingsTabProps = {
  bookings: Booking[];
  onAdd: () => void;
  onOpen: (booking: Booking) => void;
};

export function BookingsTab({ bookings, onAdd, onOpen }: BookingsTabProps) {
  const sorted = [...bookings].sort((a, b) => {
    const cmp = a.date.localeCompare(b.date);
    if (cmp !== 0) return cmp;
    return a.time.localeCompare(b.time);
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-foreground text-base font-semibold">Bookinger</h2>
          <p className="text-muted-foreground text-xs">
            {bookings.length} bookinger · klikk for å åpne
          </p>
        </div>
        <Button size="sm" onClick={onAdd} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Ny booking
        </Button>
      </div>

      {sorted.length === 0 ? (
        <div className="border-border bg-muted/30 text-muted-foreground rounded-xl border border-dashed p-10 text-center text-sm">
          Ingen bookinger ennå.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((booking) => (
            <button
              key={booking.id}
              onClick={() => onOpen(booking)}
              className="border-border bg-card hover:border-foreground/20 flex items-center justify-between rounded-xl border p-4 text-left transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-lg">
                  <Users className="text-muted-foreground h-5 w-5" />
                </div>
                <div>
                  <div className="text-foreground text-sm font-semibold">{booking.guest}</div>
                  <div className="text-muted-foreground text-xs">
                    {booking.date} · {booking.time}
                  </div>
                </div>
              </div>
              <div className="text-muted-foreground text-xs font-medium">{booking.seats} pers.</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
