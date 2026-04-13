"use client";

/**
 * PlanningEventsTab — Calendar + event list for season planning.
 *
 * Shows a month grid with color-coded event dots, an event list below,
 * and an inline create/edit form. Used by the season page as the
 * "Hendelser" (Events) tab.
 *
 * UI Events:
 * - nav: month navigation (prev/next via ChevronLeft/ChevronRight)
 * - action: selectDate(date) (calendar day click)
 * - action: createEvent() (form submit)
 * - action: updateEvent(id) (inline edit save)
 * - action: deleteEvent(id) (Trash2 button)
 * - action: toggleCreateForm() (Ny hendelse button / "+" on selected date)
 * - color-regime: category-based (external=blue, cultural=purple, internal=emerald, weather=amber, recurring=zinc)
 */

import { useState, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, CalendarDays, X, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { usePlanningEvents } from "../_hooks/use-planning-events";
import type { PlanningEventRow, PlanningEventCategory } from "@/lib/cascade/types";

// --------------------------------------------------------
// Props
// --------------------------------------------------------

type Props = {
  seasonId: string;
  planningCycleId: string | null;
  isDark: boolean;
};

// --------------------------------------------------------
// Constants
// --------------------------------------------------------

const CATEGORY_OPTIONS = [
  { value: "external_scraped", label: "Ekstern" },
  { value: "cultural_commercial", label: "Kulturell" },
  { value: "internal", label: "Intern" },
  { value: "weather", label: "Vær" },
  { value: "recurring", label: "Gjentakende" },
] as const;

const WEEKDAY_HEADERS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

/** Category → color tokens for dots, pills, and badges */
const CATEGORY_COLORS: Record<
  PlanningEventCategory,
  { dot: string; pill: string; pillDark: string; text: string; textDark: string }
> = {
  external_scraped: {
    dot: "bg-blue-400",
    pill: "border-blue-200 bg-blue-50 text-blue-600",
    pillDark: "border-blue-500/20 bg-blue-500/10 text-blue-400",
    text: "text-blue-600",
    textDark: "text-blue-400",
  },
  cultural_commercial: {
    dot: "bg-purple-400",
    pill: "border-purple-200 bg-purple-50 text-purple-600",
    pillDark: "border-purple-500/20 bg-purple-500/10 text-purple-400",
    text: "text-purple-600",
    textDark: "text-purple-400",
  },
  internal: {
    dot: "bg-emerald-400",
    pill: "border-emerald-200 bg-emerald-50 text-emerald-600",
    pillDark: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
    text: "text-emerald-600",
    textDark: "text-emerald-400",
  },
  weather: {
    dot: "bg-amber-400",
    pill: "border-amber-200 bg-amber-50 text-amber-600",
    pillDark: "border-amber-500/20 bg-amber-500/10 text-amber-400",
    text: "text-amber-600",
    textDark: "text-amber-400",
  },
  recurring: {
    dot: "bg-zinc-400",
    pill: "border-zinc-300 bg-zinc-100 text-zinc-600",
    pillDark: "border-zinc-500/20 bg-zinc-500/10 text-zinc-400",
    text: "text-zinc-600",
    textDark: "text-zinc-400",
  },
};

// --------------------------------------------------------
// Helpers
// --------------------------------------------------------

/** Format YYYY-MM-DD for display as "DD. MMM" */
function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
}

/** Get today as YYYY-MM-DD in local time */
function todayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** Build a grid of day-cells for a given month (Mon-start weeks) */
function buildCalendarGrid(year: number, month: number): (Date | null)[] {
  const firstOfMonth = new Date(year, month, 1);
  // JS getDay(): 0=Sun. Convert to Mon-start: Mon=0...Sun=6
  const startDow = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];

  // Leading nulls (days from previous month)
  for (let i = 0; i < startDow; i++) cells.push(null);

  // Days of the month
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  // Trailing nulls to fill the last row
  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
}

/** Convert a Date to YYYY-MM-DD */
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// --------------------------------------------------------
// Default form state
// --------------------------------------------------------

type EventFormState = {
  name: string;
  event_date: string;
  end_date: string;
  category: PlanningEventCategory;
  demand_multiplier: string;
  expected_covers: string;
  confidence: string;
  is_recurring: boolean;
};

function defaultFormState(date?: string): EventFormState {
  return {
    name: "",
    event_date: date ?? todayStr(),
    end_date: "",
    category: "internal",
    demand_multiplier: "1.0",
    expected_covers: "",
    confidence: "0.5",
    is_recurring: false,
  };
}

function formStateFromEvent(ev: PlanningEventRow): EventFormState {
  return {
    name: ev.name,
    event_date: ev.event_date,
    end_date: ev.end_date ?? "",
    category: ev.category,
    demand_multiplier: String(ev.demand_multiplier),
    expected_covers: ev.expected_covers != null ? String(ev.expected_covers) : "",
    confidence: String(ev.confidence ?? 0.5),
    is_recurring: ev.is_recurring,
  };
}

// --------------------------------------------------------
// Component
// --------------------------------------------------------

export function PlanningEventsTab({ seasonId: _seasonId, planningCycleId, isDark }: Props) {
  const { events, isLoading, createEvent, updateEvent, deleteEvent } =
    usePlanningEvents(planningCycleId);

  // Calendar navigation
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  // Selected date (click on calendar day)
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Create form visibility
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<EventFormState>(defaultFormState());

  // Inline editing
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EventFormState>(defaultFormState());

  // ---- Derived data ----

  const today = todayStr();
  const calendarGrid = useMemo(() => buildCalendarGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  /** Map date string → events on that date */
  const eventsByDate = useMemo(() => {
    const map = new Map<string, PlanningEventRow[]>();
    for (const ev of events) {
      const list = map.get(ev.event_date) ?? [];
      list.push(ev);
      map.set(ev.event_date, list);
    }
    return map;
  }, [events]);

  /** Events shown in the list: selected date, or next 30 days */
  const listEvents = useMemo(() => {
    if (selectedDate) {
      return events.filter((ev) => ev.event_date === selectedDate);
    }
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + 30);
    const cutoffStr = toDateStr(cutoff);
    return events.filter((ev) => ev.event_date >= today && ev.event_date <= cutoffStr);
  }, [events, selectedDate, today]);

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("nb-NO", {
    month: "long",
    year: "numeric",
  });

  // ---- Handlers ----

  const prevMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);

  const nextMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  const handleDayClick = (date: Date) => {
    const ds = toDateStr(date);
    if (selectedDate === ds) {
      setSelectedDate(null);
    } else {
      setSelectedDate(ds);
      // Pre-fill create form date
      setCreateForm((prev) => ({ ...prev, event_date: ds }));
    }
    // Close any open edit/create
    setShowCreateForm(false);
    setEditingEventId(null);
  };

  const openCreateForm = () => {
    setCreateForm(defaultFormState(selectedDate ?? todayStr()));
    setShowCreateForm(true);
    setEditingEventId(null);
  };

  const handleCreate = () => {
    if (!createForm.name.trim()) return;
    createEvent.mutate(
      {
        name: createForm.name.trim(),
        event_date: createForm.event_date,
        end_date: createForm.end_date || null,
        category: createForm.category,
        demand_multiplier: parseFloat(createForm.demand_multiplier) || 1.0,
        expected_covers: createForm.expected_covers
          ? parseInt(createForm.expected_covers, 10)
          : null,
        confidence: parseFloat(createForm.confidence) || 0.5,
        is_recurring: createForm.is_recurring,
      },
      {
        onSuccess: () => {
          setShowCreateForm(false);
          setCreateForm(defaultFormState(selectedDate ?? todayStr()));
        },
      },
    );
  };

  const startEdit = (ev: PlanningEventRow) => {
    setEditingEventId(ev.planning_event_id);
    setEditForm(formStateFromEvent(ev));
    setShowCreateForm(false);
  };

  const handleUpdate = () => {
    if (!editingEventId || !editForm.name.trim()) return;
    updateEvent.mutate(
      {
        planning_event_id: editingEventId,
        name: editForm.name.trim(),
        event_date: editForm.event_date,
        end_date: editForm.end_date || null,
        category: editForm.category,
        demand_multiplier: parseFloat(editForm.demand_multiplier) || 1.0,
        expected_covers: editForm.expected_covers ? parseInt(editForm.expected_covers, 10) : null,
        confidence: parseFloat(editForm.confidence) || 0.5,
        is_recurring: editForm.is_recurring,
      },
      { onSuccess: () => setEditingEventId(null) },
    );
  };

  const handleDelete = (eventId: string) => {
    deleteEvent.mutate(eventId, {
      onSuccess: () => {
        if (editingEventId === eventId) setEditingEventId(null);
      },
    });
  };

  // ---- Style tokens (matching existing season tab patterns) ----

  const cardClass = isDark
    ? "rounded-2xl border border-zinc-800 bg-[#0c0c0e] p-6"
    : "rounded-2xl border border-zinc-200 bg-white p-6";

  const inputClass = isDark
    ? "w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-blue-500"
    : "w-full rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-zinc-900 outline-none focus:border-blue-500";

  const labelClass = `mb-2 block text-xs font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`;

  // ---- Loading state ----

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className={`${cardClass} h-80 animate-pulse`} />
        <div className={`${cardClass} h-40 animate-pulse`} />
      </div>
    );
  }

  // ---- Render helpers ----

  /** Inline form for create or edit */
  function renderForm(
    form: EventFormState,
    setForm: (fn: (prev: EventFormState) => EventFormState) => void,
    onSubmit: () => void,
    onCancel: () => void,
    isPending: boolean,
    submitLabel: string,
  ) {
    return (
      <div
        className={`rounded-xl border p-5 ${
          isDark ? "border-zinc-800 bg-[#121216]" : "border-zinc-200 bg-zinc-50"
        }`}
      >
        <div className="grid gap-4 md:grid-cols-2">
          {/* Name */}
          <div className="md:col-span-2">
            <label className={labelClass}>Navn</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="f.eks. Gladmatfestivalen"
              className={inputClass}
            />
          </div>

          {/* Event date */}
          <div>
            <label className={labelClass}>Dato</label>
            <input
              type="date"
              value={form.event_date}
              onChange={(e) => setForm((prev) => ({ ...prev, event_date: e.target.value }))}
              className={inputClass}
            />
          </div>

          {/* End date */}
          <div>
            <label className={labelClass}>Sluttdato (valgfri)</label>
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => setForm((prev) => ({ ...prev, end_date: e.target.value }))}
              className={inputClass}
            />
          </div>

          {/* Category */}
          <div>
            <label className={labelClass}>Kategori</label>
            <select
              value={form.category}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  category: e.target.value as PlanningEventCategory,
                }))
              }
              className={inputClass}
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Demand multiplier */}
          <div>
            <label className={labelClass}>Etterspørselsfaktor</label>
            <input
              type="number"
              value={form.demand_multiplier}
              onChange={(e) => setForm((prev) => ({ ...prev, demand_multiplier: e.target.value }))}
              min="0.5"
              max="3.0"
              step="0.1"
              className={inputClass}
            />
            <p className={`mt-1 text-xs ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
              Multipliserer forventet trafikk (0.5 - 3.0)
            </p>
          </div>

          {/* Expected covers */}
          <div>
            <label className={labelClass}>Forventet antall (valgfri)</label>
            <input
              type="number"
              value={form.expected_covers}
              onChange={(e) => setForm((prev) => ({ ...prev, expected_covers: e.target.value }))}
              placeholder="f.eks. 200"
              min="0"
              className={inputClass}
            />
          </div>

          {/* Confidence */}
          <div>
            <label className={labelClass}>Konfidensgrad</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                value={form.confidence}
                onChange={(e) => setForm((prev) => ({ ...prev, confidence: e.target.value }))}
                min="0"
                max="1"
                step="0.1"
                className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-zinc-700 accent-blue-500"
              />
              <span
                className={`w-10 text-center text-sm font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}
              >
                {parseFloat(form.confidence).toFixed(1)}
              </span>
            </div>
          </div>

          {/* Recurring toggle */}
          <div className="flex items-center gap-3">
            <Switch
              checked={form.is_recurring}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_recurring: checked }))}
            />
            <span className={`text-sm font-medium ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
              Gjentakende
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className={`rounded-xl px-5 py-2.5 text-sm font-medium transition-colors ${
              isDark
                ? "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
            }`}
          >
            Avbryt
          </button>
          <button
            onClick={onSubmit}
            disabled={isPending || !form.name.trim()}
            className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Lagrer...
              </span>
            ) : (
              submitLabel
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------ */}
      {/* Calendar month grid                              */}
      {/* ------------------------------------------------ */}
      <div className={cardClass}>
        {/* Month header with nav */}
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={prevMonth}
            className={`rounded-lg p-2 transition-colors ${
              isDark ? "hover:bg-zinc-800" : "hover:bg-zinc-100"
            }`}
          >
            <ChevronLeft className={`h-5 w-5 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
          </button>
          <h3 className={`text-lg font-bold capitalize ${isDark ? "text-white" : "text-zinc-900"}`}>
            {monthLabel}
          </h3>
          <button
            onClick={nextMonth}
            className={`rounded-lg p-2 transition-colors ${
              isDark ? "hover:bg-zinc-800" : "hover:bg-zinc-100"
            }`}
          >
            <ChevronRight className={`h-5 w-5 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="mb-1 grid grid-cols-7 gap-1">
          {WEEKDAY_HEADERS.map((day) => (
            <div
              key={day}
              className={`py-1 text-center text-xs font-bold ${isDark ? "text-zinc-600" : "text-zinc-400"}`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1">
          {calendarGrid.map((date, idx) => {
            if (!date) {
              return (
                <div
                  key={`empty-${idx}`}
                  className={`rounded-lg p-2 ${isDark ? "bg-zinc-900/30" : "bg-zinc-50/50"}`}
                  style={{ minHeight: "56px" }}
                />
              );
            }

            const ds = toDateStr(date);
            const isToday = ds === today;
            const isSelected = ds === selectedDate;
            const dayEvents = eventsByDate.get(ds) ?? [];
            const visibleDots = dayEvents.slice(0, 3);
            const overflow = dayEvents.length - 3;

            return (
              <button
                key={ds}
                onClick={() => handleDayClick(date)}
                className={`group relative flex flex-col items-start rounded-lg p-2 text-left transition-colors ${
                  isSelected
                    ? isDark
                      ? "bg-blue-500/10 ring-1 ring-blue-500/40"
                      : "bg-blue-50 ring-1 ring-blue-300"
                    : isDark
                      ? "hover:bg-zinc-800/60"
                      : "hover:bg-zinc-100"
                }`}
                style={{ minHeight: "56px" }}
              >
                {/* Day number */}
                <span
                  className={`text-sm font-semibold ${
                    isToday
                      ? "flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white"
                      : isDark
                        ? "text-zinc-300"
                        : "text-zinc-700"
                  }`}
                >
                  {date.getDate()}
                </span>

                {/* Event dots */}
                {dayEvents.length > 0 && (
                  <div className="mt-1 flex items-center gap-0.5">
                    {visibleDots.map((ev) => (
                      <span
                        key={ev.planning_event_id}
                        className={`h-1.5 w-1.5 rounded-full ${CATEGORY_COLORS[ev.category].dot}`}
                      />
                    ))}
                    {overflow > 0 && (
                      <span
                        className={`ml-0.5 text-[10px] leading-none font-bold ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                      >
                        +{overflow}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------ */}
      {/* Event list                                       */}
      {/* ------------------------------------------------ */}
      <div className={cardClass}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className={`text-lg font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>
            {selectedDate ? (
              <>
                Hendelser {formatDateShort(selectedDate)}
                <button
                  onClick={() => setSelectedDate(null)}
                  className={`ml-2 inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium transition-colors ${
                    isDark
                      ? "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                      : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                  }`}
                >
                  <X className="mr-0.5 h-3 w-3" />
                  Vis alle
                </button>
              </>
            ) : (
              "Kommende hendelser (30 dager)"
            )}
          </h3>
          <button
            onClick={openCreateForm}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-500"
          >
            <Plus className="h-4 w-4" />
            Ny hendelse
          </button>
        </div>

        {/* Create form */}
        {showCreateForm &&
          renderForm(
            createForm,
            setCreateForm,
            handleCreate,
            () => setShowCreateForm(false),
            createEvent.isPending,
            "Opprett",
          )}

        {/* Spacer between create form and list */}
        {showCreateForm && listEvents.length > 0 && (
          <div className={`my-4 h-px w-full ${isDark ? "bg-zinc-800/50" : "bg-zinc-200"}`} />
        )}

        {/* Event rows */}
        {listEvents.length === 0 && !showCreateForm ? (
          <div
            className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-12 ${
              isDark ? "border-zinc-800 bg-zinc-900/20" : "border-zinc-300 bg-zinc-50"
            }`}
          >
            <CalendarDays
              className={`mb-3 h-8 w-8 ${isDark ? "text-zinc-700" : "text-zinc-300"}`}
            />
            <p className={`text-sm ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
              {selectedDate
                ? "Ingen hendelser denne dagen."
                : "Ingen kommende hendelser de neste 30 dagene."}
            </p>
            <button
              onClick={openCreateForm}
              className={`mt-3 text-sm font-medium transition-colors ${
                isDark ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-500"
              }`}
            >
              Legg til en hendelse
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {listEvents.map((ev) => {
              const colors = CATEGORY_COLORS[ev.category];
              const isEditing = editingEventId === ev.planning_event_id;

              if (isEditing) {
                return (
                  <div key={ev.planning_event_id}>
                    {renderForm(
                      editForm,
                      setEditForm,
                      handleUpdate,
                      () => setEditingEventId(null),
                      updateEvent.isPending,
                      "Lagre endringer",
                    )}
                  </div>
                );
              }

              return (
                <button
                  key={ev.planning_event_id}
                  onClick={() => startEdit(ev)}
                  className={`group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                    isDark
                      ? "border-zinc-800/80 bg-[#121216] hover:border-zinc-700"
                      : "border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-sm"
                  }`}
                >
                  {/* Date badge */}
                  <div
                    className={`flex h-10 w-10 flex-shrink-0 flex-col items-center justify-center rounded-lg text-center ${
                      isDark ? "bg-zinc-800" : "bg-zinc-100"
                    }`}
                  >
                    <span
                      className={`text-[10px] leading-tight font-bold uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                    >
                      {new Date(ev.event_date + "T00:00:00").toLocaleDateString("nb-NO", {
                        month: "short",
                      })}
                    </span>
                    <span
                      className={`text-sm leading-tight font-black ${isDark ? "text-zinc-300" : "text-zinc-700"}`}
                    >
                      {new Date(ev.event_date + "T00:00:00").getDate()}
                    </span>
                  </div>

                  {/* Name + category pill */}
                  <div className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}
                    >
                      {ev.name}
                    </span>
                    <span
                      className={`mt-0.5 inline-block rounded border px-1.5 py-0.5 text-[10px] font-bold ${
                        isDark ? colors.pillDark : colors.pill
                      }`}
                    >
                      {CATEGORY_OPTIONS.find((c) => c.value === ev.category)?.label ?? ev.category}
                    </span>
                  </div>

                  {/* Demand multiplier */}
                  <div className="flex-shrink-0 text-right">
                    <span
                      className={`text-sm font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}
                    >
                      {ev.demand_multiplier.toFixed(1)}x
                    </span>
                  </div>

                  {/* Confidence bar */}
                  <div className="flex w-16 flex-shrink-0 flex-col items-end gap-0.5">
                    <span
                      className={`text-[10px] font-medium ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                    >
                      {((ev.confidence ?? 0) * 100).toFixed(0)}%
                    </span>
                    <div
                      className={`h-1.5 w-full overflow-hidden rounded-full ${isDark ? "bg-zinc-800" : "bg-zinc-200"}`}
                    >
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all"
                        style={{ width: `${(ev.confidence ?? 0) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Delete button (visible on hover) */}
                  <div
                    className="flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(ev.planning_event_id);
                      }}
                      disabled={deleteEvent.isPending}
                      className={`rounded-lg p-1.5 transition-colors ${
                        isDark
                          ? "text-zinc-600 hover:bg-red-500/10 hover:text-red-400"
                          : "text-zinc-300 hover:bg-red-50 hover:text-red-500"
                      }`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
