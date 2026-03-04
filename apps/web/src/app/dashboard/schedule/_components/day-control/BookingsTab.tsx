// ============================================
// day-control/BookingsTab.tsx
// Reservations tab — view and manage day bookings.
// ============================================
"use client";

import { useContext, useState } from "react";
import { Clock, Users, MapPin, Plus, Star } from "lucide-react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import type { DayBooking } from "../schedule-types";
import { useDayBookings } from "../../_hooks/use-day-content";
import { useWeekRange } from "../../_hooks/use-week-range";
import { BookingDialog } from "../booking-dialog";

export function BookingsTab({ dateId }: { dateId: string | null }) {
  const { isDark } = useContext(DashboardContext);
  const { weekStart, weekEnd } = useWeekRange();
  const { data: dayBookingsData = [] as DayBooking[] } = useDayBookings(weekStart, weekEnd);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);

  const bookings = dateId ? dayBookingsData.filter((b: DayBooking) => b.dateId === dateId) : [];

  // Total guests
  const totalGuests = bookings
    .filter((b) => b.status !== "cancelled")
    .reduce((sum, b) => sum + b.guestCount, 0);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-5 duration-200">
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h4 className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
            Reservasjoner ({bookings.length})
          </h4>
          {totalGuests > 0 && (
            <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold text-orange-400">
              {totalGuests} gjester
            </span>
          )}
        </div>
        <button
          onClick={() => setBookingDialogOpen(true)}
          className="flex items-center gap-1 text-[10px] font-bold text-orange-400 hover:text-orange-300"
        >
          <Plus className="h-3.5 w-3.5" /> Legg til
        </button>
      </div>

      {bookings.length === 0 ? (
        <div className="flex flex-col items-center py-8">
          <div className="bg-muted mb-3 rounded-xl p-3">
            <Users className="text-muted-foreground h-6 w-6" />
          </div>
          <p className="text-muted-foreground text-xs">Ingen bookinger for denne dagen</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking: DayBooking) => {
            const isExpanded = expandedBookingId === booking.id;

            return (
              <div
                key={booking.id}
                className={`rounded-xl border p-4 transition-colors ${isDark ? "border-border bg-muted/20 hover:border-border/80" : "border-border bg-card hover:border-border/80 shadow-sm"}`}
              >
                <div className="mb-2 flex justify-between">
                  <span className="text-foreground flex items-center gap-2 text-sm font-bold">
                    <Users className="h-4 w-4 text-orange-400" /> {booking.title}
                    {booking.isVip && <Star className="h-3.5 w-3.5 text-amber-400" />}
                  </span>
                  <StatusBadge status={booking.status} isVip={booking.isVip} />
                </div>
                <p className="text-muted-foreground mb-3 text-xs font-medium">
                  {booking.guestCount} Personer &bull; {booking.menu}
                </p>
                <div className="border-border/50 flex items-center justify-between border-t pt-3">
                  <div className="text-muted-foreground flex gap-4 text-[10px] font-bold">
                    <span className="flex items-center gap-1.5">
                      <Clock className="text-muted-foreground h-3.5 w-3.5" /> {booking.time}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="text-muted-foreground h-3.5 w-3.5" /> {booking.location}
                    </span>
                  </div>
                  <button
                    onClick={() => setExpandedBookingId(isExpanded ? null : booking.id)}
                    className="text-[10px] font-bold text-blue-400 hover:text-blue-300"
                  >
                    {isExpanded ? "Skjul detaljer" : "Se detaljer"}
                  </button>
                </div>

                {isExpanded && (
                  <div className="border-border/50 mt-3 space-y-2 border-t pt-3">
                    {booking.contactPerson && (
                      <div className="text-muted-foreground text-[10px]">
                        <span className="text-muted-foreground font-bold">Kontakt:</span>{" "}
                        {booking.contactPerson}
                      </div>
                    )}
                    {booking.notes && (
                      <div className="text-muted-foreground text-[10px]">
                        <span className="text-muted-foreground font-bold">Notater:</span>{" "}
                        {booking.notes}
                      </div>
                    )}
                    {!booking.contactPerson && !booking.notes && (
                      <p className="text-muted-foreground text-[10px]">Ingen tilleggsinformasjon</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {dateId && (
        <BookingDialog
          dateId={dateId}
          open={bookingDialogOpen}
          onOpenChange={setBookingDialogOpen}
        />
      )}
    </div>
  );
}

// ── Status Badge ─────────────────────────────────────────────

function StatusBadge({ status, isVip }: { status: string; isVip: boolean }) {
  const vipSuffix = isVip ? " \u2022 VIP" : "";
  switch (status) {
    case "confirmed":
      return (
        <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
          Bekreftet{vipSuffix}
        </span>
      );
    case "pending":
      return (
        <span className="bg-muted text-muted-foreground border-border rounded-lg border px-2 py-0.5 text-[10px] font-bold">
          Avventer{vipSuffix}
        </span>
      );
    case "cancelled":
      return (
        <span className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-400">
          Kansellert{vipSuffix}
        </span>
      );
    default:
      return null;
  }
}
