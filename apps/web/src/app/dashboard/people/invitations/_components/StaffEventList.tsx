/**
 * StaffEventList.tsx — Server-prop-driven list of staff events.
 *
 * Renders each event as a card row with type badge, title, date/time range,
 * and first 3 attendee avatars + count. Empty state includes the new-event CTA.
 *
 * Pure display — no client state. All data comes from server-fetched props.
 */

import { CalendarDays, MapPin, Users } from "lucide-react";
import type { StaffEventRow } from "../_actions/staff-event-actions";
import type { ReactNode } from "react";

// ─── Type badge config ────────────────────────────

const EVENT_TYPE_CONFIG = {
  utviklingssamtale: {
    label: "Utviklingssamtale",
    className: "bg-brand-orange/10 text-brand-orange ring-brand-orange/20 ring-1",
  },
  personalmote: {
    label: "Personalmøte",
    className:
      "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 ring-1 dark:text-emerald-400",
  },
  personalfest: {
    label: "Personalfest",
    className: "bg-purple-500/10 text-purple-600 ring-purple-500/20 ring-1 dark:text-purple-400",
  },
  annet: {
    label: "Annet",
    className: "bg-muted text-muted-foreground ring-border ring-1",
  },
} as const satisfies Record<
  "utviklingssamtale" | "personalmote" | "personalfest" | "annet",
  { label: string; className: string }
>;

// ─── Helpers ─────────────────────────────────────

function formatDateRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  const dateStr = start.toLocaleDateString("nb-NO", {
    weekday: "short",
    day: "numeric",
    month: "long",
  });

  const startTime = start.toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const endTime = end.toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${dateStr} • fra ${startTime} til ${endTime}`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// ─── Attendee avatars ─────────────────────────────

function AttendeeAvatars({ attendees }: { attendees: StaffEventRow["attendees"] }) {
  const preview = attendees.slice(0, 3);
  const remaining = attendees.length - preview.length;

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {preview.map((a) =>
          a.profile?.avatar_url ? (
            <img
              key={a.profile_id}
              src={a.profile.avatar_url}
              alt={a.profile.display_name}
              className="ring-background h-7 w-7 rounded-full object-cover ring-2"
            />
          ) : (
            <div
              key={a.profile_id}
              className="ring-background bg-muted text-muted-foreground flex h-7 w-7 items-center justify-center rounded-full text-[9px] font-semibold ring-2"
            >
              {getInitials(a.profile?.display_name ?? "?")}
            </div>
          ),
        )}
        {remaining > 0 && (
          <div className="ring-background bg-accent text-muted-foreground flex h-7 w-7 items-center justify-center rounded-full text-[9px] font-semibold ring-2">
            +{remaining}
          </div>
        )}
      </div>
      <span className="text-muted-foreground text-sm">
        {attendees.length} {attendees.length === 1 ? "deltaker" : "deltakere"}
      </span>
    </div>
  );
}

// ─── Event card row ───────────────────────────────

function StaffEventCard({ event }: { event: StaffEventRow }) {
  const typeConfig = EVENT_TYPE_CONFIG[event.event_type];

  return (
    <div className="bg-card ring-border/60 hover:ring-border flex flex-col gap-3 rounded-2xl px-5 py-4 ring-1 transition-all sm:flex-row sm:items-center sm:justify-between">
      {/* Left: badge + title + meta */}
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${typeConfig.className}`}
          >
            {typeConfig.label}
          </span>
        </div>

        <h3 className="font-heading text-foreground truncate text-lg leading-snug">
          {event.title}
        </h3>

        <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            {formatDateRange(event.starts_at, event.ends_at)}
          </span>
          {event.location && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {event.location}
            </span>
          )}
        </div>
      </div>

      {/* Right: attendee avatars */}
      <div className="shrink-0">
        {event.attendees.length > 0 ? (
          <AttendeeAvatars attendees={event.attendees} />
        ) : (
          <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <Users className="h-3.5 w-3.5" />
            <span>Ingen deltakere</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────

function EmptyState({ cta }: { cta: ReactNode }) {
  return (
    <div
      className="ring-border/40 flex flex-col items-center gap-4 rounded-3xl px-8 py-14 text-center ring-1"
      style={{
        background:
          "linear-gradient(160deg, oklch(0.14 0.02 55 / 0.15), oklch(0.10 0.01 50 / 0.05))",
      }}
    >
      <div className="bg-brand-orange/10 ring-brand-orange/20 rounded-2xl p-4 ring-1">
        <CalendarDays className="text-brand-orange h-8 w-8" />
      </div>
      <div>
        <p className="text-foreground font-semibold">Ingen innkallinger ennå</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Kall inn ansatte til samtaler, møter og tilstelninger.
        </p>
      </div>
      {cta}
    </div>
  );
}

// ─── Main component ───────────────────────────────

export type StaffEventListProps = {
  events: StaffEventRow[];
  /** Rendered into the empty state CTA slot. Pass <NewStaffEventButton> from the page. */
  newEventButton: ReactNode;
};

export function StaffEventList({ events, newEventButton }: StaffEventListProps) {
  if (events.length === 0) {
    return <EmptyState cta={newEventButton} />;
  }

  return (
    <div className="flex flex-col gap-3">
      {events.map((event) => (
        <StaffEventCard key={event.event_id} event={event} />
      ))}
    </div>
  );
}
