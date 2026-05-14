"use client";

import { useContext, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  X,
  Loader2,
  CheckCircle2,
  RotateCcw,
  Save,
  AlertTriangle,
  Calendar,
  StickyNote,
  LogIn,
  LogOut,
  PenLine,
} from "lucide-react";
import { createClient } from "@smartout/supabase/client";
import { Button } from "@/components/ui/button";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { toggleSessionTaskAction } from "@/app/dashboard/_actions/toggle-session-task-action";
import {
  resolveDeviationAction,
  acknowledgeDeviationAction,
} from "@/app/dashboard/_actions/update-deviation-action";
import type { DayEvent } from "@/app/dashboard/_hooks/use-day-timeline-events";

type Props = {
  event: DayEvent | null;
  onClose: () => void;
  onSaved: () => void;
};

const HEADER_ICON: Record<DayEvent["type"], typeof Calendar> = {
  booking: Calendar,
  note: StickyNote,
  task: CheckCircle2,
  deviation: AlertTriangle,
  checkin: LogIn,
  checkout: LogOut,
};

const HEADER_LABEL: Record<DayEvent["type"], string> = {
  booking: "Booking",
  note: "Notat",
  task: "Oppgave",
  deviation: "Avvik",
  checkin: "Innsjekk",
  checkout: "Utsjekk",
};

/**
 * EventDetailPanel — inline editor for the selected timeline event.
 *
 * Renders type-specific quick-edit form: notes get content + sign + assign,
 * tasks get done-toggle + assignee, deviations get severity/status/notes,
 * bookings get title/time/guests, check-ins/-outs surface manual time edit.
 */
export function EventDetailPanel({ event, onClose, onSaved }: Props) {
  if (!event) return null;
  return (
    <div className="bg-card border-border relative overflow-hidden rounded-2xl border p-5 shadow-sm">
      <Header event={event} onClose={onClose} />
      <Body event={event} onSaved={onSaved} onClose={onClose} />
    </div>
  );
}

function Header({ event, onClose }: { event: DayEvent; onClose: () => void }) {
  const Icon = HEADER_ICON[event.type];
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="bg-muted border-border inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border">
          <Icon className="text-muted-foreground h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="text-muted-foreground text-[10px] font-bold tracking-[0.14em] uppercase">
            {HEADER_LABEL[event.type]} · {event.time}
            {event.endTime ? ` – ${event.endTime}` : ""}
          </div>
          <div className="text-foreground truncate text-sm font-semibold">{event.title}</div>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onClose}
        aria-label="Lukk"
        className="h-7 w-7"
      >
        <X className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  );
}

function Body({
  event,
  onSaved,
  onClose,
}: {
  event: DayEvent;
  onSaved: () => void;
  onClose: () => void;
}) {
  if (event.type === "note") {
    return <NoteForm event={event} onSaved={onSaved} onClose={onClose} />;
  }
  if (event.type === "task") {
    return <TaskForm event={event} onSaved={onSaved} />;
  }
  if (event.type === "deviation") {
    return <DeviationForm event={event} onSaved={onSaved} />;
  }
  if (event.type === "booking") {
    return <BookingForm event={event} onSaved={onSaved} />;
  }
  return <CheckpointInfo event={event} />;
}

// ── Note form ───────────────────────────────────────────────────────────────
function NoteForm({
  event,
  onSaved,
  onClose,
}: {
  event: DayEvent;
  onSaved: () => void;
  onClose: () => void;
}) {
  const ctx = useWorkspaceOptional();
  const dashCtx = useContext(DashboardContext);
  const wsId = ctx?.workspace.workspace_id;
  const profileId = dashCtx.profileId;
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("session_note")
        .select("content")
        .eq("id", event.refId)
        .single();
      if (!cancelled) {
        setContent(data?.content ?? "");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [event.refId]);

  function handleSave() {
    if (content.trim().length < 3) return;
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from("session_note")
        .update({ content: content.trim() })
        .eq("id", event.refId);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Notat oppdatert");
      onSaved();
    });
  }

  function handleSign() {
    if (!wsId || !profileId) return;
    startTransition(async () => {
      const supabase = createClient();
      // Append sign-off line
      const stamp = new Date().toLocaleString("nb-NO", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const next = `${content}\n\n— Signert ${stamp}`;
      const { error } = await supabase
        .from("session_note")
        .update({ content: next })
        .eq("id", event.refId);
      if (error) {
        toast.error(error.message);
        return;
      }
      setContent(next);
      toast.success("Notat signert");
      onSaved();
    });
  }

  return (
    <div className="space-y-3">
      <textarea
        rows={4}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={loading || isPending}
        className="bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
        placeholder="Skriv notatet…"
      />
      {event.actor ? (
        <p className="text-muted-foreground text-[11px]">
          Skrevet av <span className="text-foreground font-medium">{event.actor}</span>
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={handleSave} disabled={isPending}>
          {isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="mr-1.5 h-3.5 w-3.5" />
          )}
          Lagre
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={handleSign} disabled={isPending}>
          <PenLine className="mr-1.5 h-3.5 w-3.5" />
          Signer
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Avbryt
        </Button>
      </div>
    </div>
  );
}

// ── Task form ───────────────────────────────────────────────────────────────
function TaskForm({ event, onSaved }: { event: DayEvent; onSaved: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(!!event.done);

  function toggle() {
    const next = !done;
    setDone(next);
    startTransition(async () => {
      const res = await toggleSessionTaskAction({ taskId: event.refId, done: next });
      if (!res.ok) {
        setDone(!next);
        toast.error(res.error);
        return;
      }
      toast.success(next ? "Oppgave fullført" : "Oppgave gjenåpnet");
      onSaved();
    });
  }

  return (
    <div className="space-y-3">
      <div className="text-muted-foreground text-[12px]">
        {event.actor ? (
          <>
            Tildelt <span className="text-foreground font-medium">{event.actor}</span>
          </>
        ) : (
          "Ingen tildelt"
        )}
        {event.endTime ? ` · Fullført ${event.endTime}` : ""}
      </div>
      <Button
        type="button"
        size="sm"
        variant={done ? "outline" : "default"}
        onClick={toggle}
        disabled={isPending}
      >
        {isPending ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : done ? (
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
        ) : (
          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
        )}
        {done ? "Gjenåpne" : "Marker som ferdig"}
      </Button>
    </div>
  );
}

// ── Deviation form ──────────────────────────────────────────────────────────
function DeviationForm({ event, onSaved }: { event: DayEvent; onSaved: () => void }) {
  const [resolution, setResolution] = useState("");
  const [isPending, startTransition] = useTransition();

  function resolve() {
    if (resolution.trim().length < 5) {
      toast.error("Skriv en kort oppsummering før du løser avviket.");
      return;
    }
    startTransition(async () => {
      // F-SC-04-15: routes through Server Action (gate + emit). ADR-0156 + ADR-0204.
      const result = await resolveDeviationAction({
        deviation_id: event.refId,
        resolution_notes: resolution.trim(),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Avvik løst");
      onSaved();
    });
  }

  function acknowledge() {
    startTransition(async () => {
      // F-SC-04-15: routes through Server Action (gate + emit). ADR-0156 + ADR-0204.
      const result = await acknowledgeDeviationAction({
        deviation_id: event.refId,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Avvik bekreftet");
      onSaved();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-[11px]">
        {event.severity ? (
          <span className="rounded-full bg-rose-500/10 px-2 py-0.5 font-bold text-rose-700 uppercase dark:text-rose-300">
            {event.severity}
          </span>
        ) : null}
        {event.category ? (
          <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 font-bold uppercase">
            {event.category}
          </span>
        ) : null}
        {event.actor ? <span className="text-muted-foreground">av {event.actor}</span> : null}
      </div>
      <textarea
        rows={3}
        value={resolution}
        onChange={(e) => setResolution(e.target.value)}
        disabled={isPending}
        placeholder="Hvordan ble avviket håndtert?"
        className="bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={resolve} disabled={isPending}>
          {isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
          )}
          Løs
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={acknowledge}
          disabled={isPending}
        >
          Bekreft
        </Button>
      </div>
    </div>
  );
}

// ── Booking form (read-only first cut) ──────────────────────────────────────
function BookingForm({ event, onSaved: _onSaved }: { event: DayEvent; onSaved: () => void }) {
  return (
    <div className="space-y-2 text-[12px]">
      <div className="text-muted-foreground">
        {event.subtitle ? <p>{event.subtitle}</p> : null}
        {event.actor ? (
          <p>
            Kontakt: <span className="text-foreground font-medium">{event.actor}</span>
          </p>
        ) : null}
        {event.category ? (
          <p>
            Status: <span className="text-foreground font-medium">{event.category}</span>
          </p>
        ) : null}
      </div>
      <p className="text-muted-foreground/80 text-[11px]">
        Booking-redigering kommer i neste runde.
      </p>
    </div>
  );
}

// ── Checkin / Checkout info ────────────────────────────────────────────────
function CheckpointInfo({ event }: { event: DayEvent }) {
  return (
    <div className="space-y-1 text-[12px]">
      <div className="text-muted-foreground">
        <span className="text-foreground font-medium">{event.actor ?? event.title}</span>{" "}
        {event.type === "checkin" ? "stemplet inn" : "stemplet ut"} kl{" "}
        <span className="font-mono tabular-nums">{event.time}</span>
      </div>
      <p className="text-muted-foreground/80 text-[11px]">
        Manuell justering gjøres fra Bemanning-fanen.
      </p>
    </div>
  );
}
