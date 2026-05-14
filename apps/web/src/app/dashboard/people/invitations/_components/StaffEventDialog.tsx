"use client";

/**
 * StaffEventDialog.tsx — Modal for creating a new staff_event (innkalling).
 *
 * Structural pattern mirrors invite-member-dialog.tsx:
 *   glass card + overlay + DialogHeader + DialogFooter.
 *
 * Fields: type toggle, tittel, melding (optional), dato, tid (fra/til),
 *         lokasjon (optional), deltakere multi-select with search.
 *
 * Submit calls createStaffEvent server action.
 * Spring physics: stiffness 35, damping 22, mass 2.2 (motionTokens.spring).
 */

import { useState, useCallback, useMemo, type ChangeEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { motion as motionTokens } from "@smartout/design-tokens";
import { toast } from "sonner";
import {
  CalendarDays,
  Clock,
  Loader2,
  MapPin,
  MessageSquare,
  Search,
  Send,
  Users,
  X,
} from "lucide-react";
import { DialogHeader } from "@/components/dashboard/DialogHeader";
import { DialogFooter } from "@/components/dashboard/DialogFooter";
import { createStaffEvent } from "../_actions/staff-event-actions";
import type { CreateStaffEventInput, EmployeePickerRow } from "../_actions/staff-event-actions";

// ─── Shared styles ────────────────────────────────

const inputClass =
  "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:border-brand-orange/50 focus:ring-2 focus:ring-brand-orange/20 focus:outline-none";

const labelClass = "text-xs font-semibold tracking-wider uppercase text-muted-foreground";

// ─── Event type config ────────────────────────────

type StaffEventType = "utviklingssamtale" | "personalmote" | "personalfest" | "annet";

const EVENT_TYPES: Array<{ value: StaffEventType; label: string }> = [
  { value: "utviklingssamtale", label: "Utviklingssamtale" },
  { value: "personalmote", label: "Personalmøte" },
  { value: "personalfest", label: "Personalfest" },
  { value: "annet", label: "Annet" },
];

// ─── Helpers ─────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/**
 * Combines a date string ("YYYY-MM-DD") and time string ("HH:MM") into an
 * ISO 8601 datetime string. Returns null if either part is empty.
 */
function combineDateTime(date: string, time: string): string | null {
  if (!date || !time) return null;
  return `${date}T${time}:00.000Z`;
}

// ─── Employee chip ────────────────────────────────

function EmployeeChip({
  employee,
  onRemove,
}: {
  employee: EmployeePickerRow;
  onRemove: (id: string) => void;
}) {
  return (
    <span className="bg-brand-orange/10 text-brand-orange ring-brand-orange/20 flex items-center gap-1.5 rounded-full py-0.5 pr-2 pl-1 text-xs font-medium ring-1">
      {employee.avatar_url ? (
        <img
          src={employee.avatar_url}
          alt={employee.display_name}
          className="h-5 w-5 rounded-full object-cover"
        />
      ) : (
        <span className="bg-brand-orange/20 flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold">
          {getInitials(employee.display_name)}
        </span>
      )}
      {employee.display_name}
      <button
        type="button"
        onClick={() => onRemove(employee.profile_id)}
        className="hover:bg-brand-orange/20 ml-0.5 rounded-full p-0.5 transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

// ─── Props ────────────────────────────────────────

export type StaffEventDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  employees: EmployeePickerRow[];
};

// ─── Component ───────────────────────────────────

export function StaffEventDialog({ isOpen, onClose, employees }: StaffEventDialogProps) {
  // Form state
  const [eventType, setEventType] = useState<StaffEventType>("utviklingssamtale");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Employee lookup map for chip rendering
  const employeeMap = useMemo(() => new Map(employees.map((e) => [e.profile_id, e])), [employees]);

  // Filtered employee list for the picker
  const filteredEmployees = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.display_name.toLowerCase().includes(q) ||
        (e.department_name?.toLowerCase().includes(q) ?? false),
    );
  }, [employees, search]);

  // Selected employees for chip display
  const selectedEmployees = useMemo(
    () =>
      Array.from(selectedIds)
        .map((id) => employeeMap.get(id))
        .filter((e): e is EmployeePickerRow => Boolean(e)),
    [selectedIds, employeeMap],
  );

  const toggleEmployee = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const removeEmployee = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Computed ISO datetimes
  const startsAtIso = combineDateTime(date, startTime);
  const endsAtIso = combineDateTime(date, endTime);

  // Validate for submit enabled
  const timeRangeValid =
    startsAtIso !== null && endsAtIso !== null && new Date(endsAtIso) > new Date(startsAtIso);

  const canSubmit =
    title.trim().length > 0 && selectedIds.size >= 1 && timeRangeValid && !isSubmitting;

  const resetForm = useCallback(() => {
    setEventType("utviklingssamtale");
    setTitle("");
    setMessage("");
    setDate("");
    setStartTime("");
    setEndTime("");
    setLocation("");
    setSelectedIds(new Set());
    setSearch("");
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !startsAtIso || !endsAtIso) return;

    setIsSubmitting(true);
    try {
      const input: CreateStaffEventInput = {
        event_type: eventType,
        title: title.trim(),
        message: message.trim() || undefined,
        starts_at: startsAtIso,
        ends_at: endsAtIso,
        location: location.trim() || undefined,
        attendee_profile_ids: Array.from(selectedIds),
      };

      const result = await createStaffEvent(input);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      const count = selectedIds.size;
      toast.success(count === 1 ? "Innkalling sendt" : `Innkalling sendt til ${count}`);
      resetForm();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Kunne ikke lagre — prøv igjen");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    canSubmit,
    startsAtIso,
    endsAtIso,
    eventType,
    title,
    message,
    location,
    selectedIds,
    resetForm,
    onClose,
  ]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="staff-event-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
          style={{
            background:
              "radial-gradient(circle at 50% 30%, oklch(0.18 0.04 55 / 0.55), oklch(0.08 0.02 50 / 0.78))",
            backdropFilter: "blur(8px)",
          }}
        >
          <motion.div
            key="staff-event-shell"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", ...motionTokens.spring }}
            className="bg-background/80 ring-border/60 relative flex w-full max-w-lg flex-col overflow-hidden rounded-3xl shadow-[0_32px_120px_-24px_rgba(0,0,0,0.55)] ring-1 backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Glare overlay */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-3xl"
              style={{
                background:
                  "linear-gradient(135deg, oklch(1 0 0 / 0.10) 0%, oklch(1 0 0 / 0.02) 35%, transparent 60%)",
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -top-32 -right-24 h-64 w-64 rounded-full opacity-40 blur-3xl"
              style={{
                background: "radial-gradient(circle, oklch(0.78 0.18 55 / 0.45), transparent 70%)",
              }}
            />

            <div className="relative flex flex-col">
              {/* Header */}
              <DialogHeader
                title="Ny innkalling"
                subtitle="Kall inn ansatte til et arrangement"
                icon={<Send className="text-brand-orange h-5 w-5" />}
                onClose={handleClose}
              />

              {/* Scrollable content */}
              <div className="max-h-[65vh] space-y-5 overflow-y-auto px-7 pb-2">
                {/* Event type toggle */}
                <div className="space-y-2">
                  <label className={labelClass}>Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {EVENT_TYPES.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setEventType(value)}
                        className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                          eventType === value
                            ? "bg-brand-orange/15 text-brand-orange ring-brand-orange/30 shadow-[0_0_24px_-4px_oklch(0.78_0.18_55_/_0.35)] ring-1"
                            : "border-border/60 bg-background/40 text-muted-foreground hover:text-foreground hover:border-border border"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tittel */}
                <div className="space-y-1.5">
                  <label className={labelClass}>Tittel</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                    placeholder="F.eks. 1:1 Q2"
                    className={inputClass}
                    autoFocus
                  />
                </div>

                {/* Melding */}
                <div className="space-y-1.5">
                  <label className={labelClass}>
                    <span className="flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Melding
                      <span className="text-muted-foreground/60 font-normal tracking-normal normal-case">
                        — valgfri
                      </span>
                    </span>
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Kort beskjed til deltakerne..."
                    rows={3}
                    className={`${inputClass} resize-none`}
                  />
                </div>

                {/* Dato */}
                <div className="space-y-1.5">
                  <label className={labelClass}>
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Dato
                    </span>
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setDate(e.target.value)}
                    className={inputClass}
                  />
                </div>

                {/* Tid — fra / til */}
                <div className="space-y-1.5">
                  <label className={labelClass}>
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      Tid
                    </span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-muted-foreground text-xs">Fra</span>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          setStartTime(e.target.value)
                        }
                        className={inputClass}
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground text-xs">Til</span>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setEndTime(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>
                  {/* Time validation hint */}
                  {startsAtIso && endsAtIso && !timeRangeValid && (
                    <p className="text-destructive text-xs">Sluttid må være etter starttid</p>
                  )}
                </div>

                {/* Lokasjon */}
                <div className="space-y-1.5">
                  <label className={labelClass}>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      Lokasjon
                      <span className="text-muted-foreground/60 font-normal tracking-normal normal-case">
                        — valgfri
                      </span>
                    </span>
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setLocation(e.target.value)}
                    placeholder="F.eks. møterommet"
                    className={inputClass}
                  />
                </div>

                {/* Deltakere */}
                <div className="space-y-2">
                  <label className={labelClass}>
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      Deltakere
                    </span>
                  </label>

                  {/* Selected chips */}
                  {selectedEmployees.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedEmployees.map((emp) => (
                        <EmployeeChip
                          key={emp.profile_id}
                          employee={emp}
                          onRemove={removeEmployee}
                        />
                      ))}
                    </div>
                  )}

                  {/* Search input */}
                  <div className="relative">
                    <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                      placeholder="Søk etter navn eller avdeling..."
                      className={`${inputClass} pl-10`}
                    />
                  </div>

                  {/* Employee list */}
                  <div className="border-border bg-background max-h-44 overflow-y-auto rounded-xl border">
                    {filteredEmployees.length === 0 ? (
                      <p className="text-muted-foreground px-4 py-6 text-center text-sm">
                        Ingen ansatte funnet
                      </p>
                    ) : (
                      filteredEmployees.map((emp) => {
                        const isSelected = selectedIds.has(emp.profile_id);
                        return (
                          <button
                            key={emp.profile_id}
                            type="button"
                            onClick={() => toggleEmployee(emp.profile_id)}
                            className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                              isSelected ? "bg-brand-orange/10" : "hover:bg-accent"
                            }`}
                          >
                            {/* Checkbox indicator */}
                            <span
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-all ${
                                isSelected ? "bg-brand-orange border-brand-orange" : "border-border"
                              }`}
                            >
                              {isSelected && (
                                <span className="text-primary-foreground text-[10px] leading-none">
                                  ✓
                                </span>
                              )}
                            </span>

                            {/* Avatar */}
                            {emp.avatar_url ? (
                              <img
                                src={emp.avatar_url}
                                alt={emp.display_name}
                                className="h-7 w-7 shrink-0 rounded-full object-cover"
                              />
                            ) : (
                              <div className="bg-muted text-muted-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold">
                                {getInitials(emp.display_name)}
                              </div>
                            )}

                            {/* Name + department */}
                            <div className="min-w-0 flex-1">
                              <p className="text-foreground truncate text-sm font-medium">
                                {emp.display_name}
                              </p>
                              {emp.department_name && (
                                <p className="text-muted-foreground truncate text-[11px]">
                                  {emp.department_name}
                                </p>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <DialogFooter
                leftContent={
                  <button
                    type="button"
                    onClick={handleClose}
                    className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
                    disabled={isSubmitting}
                  >
                    Avbryt
                  </button>
                }
                rightContent={
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="bg-brand-orange hover:bg-brand-orange/90 ring-brand-orange/30 text-primary-foreground flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold shadow-[0_8px_24px_-8px_oklch(0.78_0.18_55_/_0.55)] ring-1 transition-all hover:scale-[1.02] hover:shadow-[0_12px_32px_-8px_oklch(0.78_0.18_55_/_0.65)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {isSubmitting ? "Sender..." : "Send innkalling"}
                  </button>
                }
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
