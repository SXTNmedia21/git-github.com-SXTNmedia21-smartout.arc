"use client";

// Split-view admin panel for payroll.holiday_calendar + payroll.holiday_entry.
//
// Left panel — calendar list with entry counts. Click to select.
// Right panel — selected calendar's entries as a table, with add + import actions.
//
// Import flow: Dialog with year selector + checkbox table → bulk upsert.
// Create entry flow: Sheet form (date, name, name_no, hours, is_full_day).
//
// UI Events:
// - action: setSelectedId(id) — card click selects calendar
// - action: useCreateCalendar().mutate(values) — "Ny kalender" in empty/bottom state
// - action: useDeleteCalendar().mutate({ id, name }) — trash icon on calendar card
// - action: useCreateHolidayEntry().mutate({ calendarId, values }) — Sheet save
// - action: useDeleteHolidayEntry().mutate({ id, calendarId }) — trash icon per row
// - action: useImportHolidays().mutate({ calendarId, holidays }) — import Dialog confirm
// - color-regime: is_default calendar = star icon in orange accent

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, Star, CalendarDays, Download, Loader2, Check } from "lucide-react";
import { Button, Badge, Skeleton, Label, Input } from "@smartout/ui";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  useHolidayCalendars,
  useCreateCalendar,
  useDeleteCalendar,
  useHolidayEntries,
  useCreateHolidayEntry,
  useDeleteHolidayEntry,
  usePublicHolidays,
  useImportHolidays,
  holidayCalendarSchema,
  holidayEntrySchema,
  type HolidayCalendarRow,
  type HolidayCalendarInput,
  type HolidayEntryInput,
  type PublicHolidayRow,
} from "../_hooks/use-holiday-calendars";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  // Show as DD.MM.YYYY — Norwegian convention
  const d = new Date(iso);
  return d.toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ─── Loading skeletons ────────────────────────────────────────────────────────

function CalendarListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="border-border rounded-lg border p-3">
          <Skeleton className="mb-1.5 h-4 w-32" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

function EntryTableSkeleton() {
  return (
    <div className="space-y-2 px-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-40 flex-1" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-6 w-6 rounded" />
        </div>
      ))}
    </div>
  );
}

// ─── Create-calendar inline form (shown in left panel when no calendars exist) ─

type CreateCalendarFormProps = {
  onCreated: (id: string) => void;
};

function CreateCalendarForm({ onCreated }: CreateCalendarFormProps) {
  const createCalendar = useCreateCalendar();

  const form = useForm<HolidayCalendarInput>({
    resolver: zodResolver(holidayCalendarSchema),
    defaultValues: { name: "", is_default: false },
  });

  function onSubmit(values: HolidayCalendarInput) {
    createCalendar.mutate(values, {
      onSuccess: (created) => {
        form.reset();
        onCreated(created.id);
      },
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
      <Input placeholder="Kalendernavn" {...form.register("name")} className="h-8 text-sm" />
      {form.formState.errors.name && (
        <p className="text-destructive text-xs">{form.formState.errors.name.message}</p>
      )}
      <Button type="submit" size="sm" className="w-full" disabled={createCalendar.isPending}>
        {createCalendar.isPending ? (
          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Plus className="mr-2 h-3.5 w-3.5" />
        )}
        Opprett kalender
      </Button>
    </form>
  );
}

// ─── Calendar card ────────────────────────────────────────────────────────────

type CalendarCardProps = {
  calendar: HolidayCalendarRow;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
};

function CalendarCard({ calendar, isSelected, onSelect, onDelete }: CalendarCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={`group relative cursor-pointer rounded-lg border p-3 transition-colors ${
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border bg-card hover:border-border/80 hover:bg-accent/40"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {calendar.is_default && (
              <Star className="h-3.5 w-3.5 flex-shrink-0 fill-orange-500 text-orange-500" />
            )}
            <span className="truncate text-sm font-semibold">{calendar.name}</span>
          </div>
          <span className="text-muted-foreground text-xs">
            {calendar.entry_count ?? 0} helligdager
          </span>
        </div>

        {/* Trash — only visible on hover, never blocks card click */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-muted-foreground/40 hover:text-destructive opacity-0 transition-opacity group-hover:opacity-100"
          aria-label={`Slett ${calendar.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Create-entry Sheet ───────────────────────────────────────────────────────

type EntrySheetProps = {
  open: boolean;
  calendarId: string;
  onClose: () => void;
};

function EntrySheet({ open, calendarId, onClose }: EntrySheetProps) {
  const createEntry = useCreateHolidayEntry();

  const form = useForm<HolidayEntryInput>({
    resolver: zodResolver(holidayEntrySchema),
    defaultValues: {
      holiday_date: "",
      name: "",
      name_no: null,
      hours: 8,
      is_full_day: true,
    },
  });

  // Reset when Sheet closes
  useEffect(() => {
    if (!open) form.reset();
  }, [open, form]);

  function onSubmit(values: HolidayEntryInput) {
    createEntry.mutate({ calendarId, values }, { onSuccess: onClose });
  }

  const errors = form.formState.errors;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Legg til helligdag</SheetTitle>
          <SheetDescription>Legg til en ny helligdag i denne kalenderen.</SheetDescription>
        </SheetHeader>

        <form
          id="entry-form"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="flex-1 space-y-4 overflow-y-auto py-4"
        >
          {/* Date */}
          <div className="space-y-1.5">
            <Label htmlFor="entry-date" className="text-sm font-medium">
              Dato
            </Label>
            <Input id="entry-date" type="date" {...form.register("holiday_date")} />
            {errors.holiday_date && (
              <p className="text-destructive text-xs">{errors.holiday_date.message}</p>
            )}
          </div>

          {/* Norwegian name */}
          <div className="space-y-1.5">
            <Label htmlFor="entry-name-no" className="text-sm font-medium">
              Navn (norsk)
            </Label>
            <Input
              id="entry-name-no"
              placeholder="f.eks. 1. nyttårsdag"
              {...form.register("name_no")}
            />
          </div>

          {/* English name (the required `name` column) */}
          <div className="space-y-1.5">
            <Label htmlFor="entry-name" className="text-sm font-medium">
              Navn (engelsk)
            </Label>
            <Input id="entry-name" placeholder="f.eks. New Year's Day" {...form.register("name")} />
            {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
          </div>

          {/* Hours */}
          <div className="space-y-1.5">
            <Label htmlFor="entry-hours" className="text-sm font-medium">
              Timer
            </Label>
            <Input
              id="entry-hours"
              type="number"
              min={0}
              max={24}
              step={0.5}
              {...form.register("hours", { valueAsNumber: true })}
            />
            {errors.hours && <p className="text-destructive text-xs">{errors.hours.message}</p>}
          </div>

          {/* Full day toggle */}
          <div className="border-border flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="entry-full-day" className="text-sm font-medium">
              Hel dag
            </Label>
            <Switch
              id="entry-full-day"
              checked={form.watch("is_full_day")}
              onCheckedChange={(v) => form.setValue("is_full_day", v)}
            />
          </div>
        </form>

        <SheetFooter>
          <Button variant="outline" onClick={onClose} disabled={createEntry.isPending}>
            Avbryt
          </Button>
          <Button type="submit" form="entry-form" disabled={createEntry.isPending}>
            {createEntry.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Lagre
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── Import Dialog ────────────────────────────────────────────────────────────

const IMPORT_YEARS = [2026, 2027] as const;

type ImportDialogProps = {
  open: boolean;
  calendarId: string;
  onClose: () => void;
};

function ImportDialog({ open, calendarId, onClose }: ImportDialogProps) {
  const [year, setYear] = useState<number>(2026);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: publicHolidays, isLoading } = usePublicHolidays(year);
  const importHolidays = useImportHolidays();

  // Reset selection when year changes or dialog closes
  useEffect(() => {
    setSelected(new Set());
  }, [year, open]);

  // Pre-select all when holidays load for the first time
  useEffect(() => {
    if (publicHolidays && selected.size === 0) {
      setSelected(new Set(publicHolidays.map((h) => h.holiday_date)));
    }
  }, [publicHolidays, selected.size]);

  function toggleAll(checked: boolean) {
    if (!publicHolidays) return;
    setSelected(checked ? new Set(publicHolidays.map((h) => h.holiday_date)) : new Set());
  }

  function toggleRow(date: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(date);
      else next.delete(date);
      return next;
    });
  }

  function handleImport() {
    if (!publicHolidays) return;
    const toImport = publicHolidays.filter((h) => selected.has(h.holiday_date));
    if (toImport.length === 0) return;

    importHolidays.mutate({ calendarId, holidays: toImport }, { onSuccess: onClose });
  }

  const allChecked = publicHolidays ? selected.size === publicHolidays.length : false;
  const someChecked = selected.size > 0 && !allChecked;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Importer norske helligdager</DialogTitle>
          <DialogDescription>
            Velg helligdager å importere. Allerede eksisterende datoer overskrives ikke.
          </DialogDescription>
        </DialogHeader>

        {/* Year selector */}
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm">År:</span>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {IMPORT_YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Holidays table */}
        <div className="border-border max-h-96 overflow-y-auto rounded-lg border">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
            </div>
          ) : !publicHolidays || publicHolidays.length === 0 ? (
            <div className="flex items-center justify-center p-8">
              <p className="text-muted-foreground text-sm">Ingen helligdager funnet for {year}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allChecked}
                      // indeterminate state isn't natively supported by shadcn Checkbox,
                      // so we show checked when some are selected to give clear feedback
                      data-state={someChecked ? "indeterminate" : undefined}
                      onCheckedChange={(v) => toggleAll(!!v)}
                      aria-label="Velg alle"
                    />
                  </TableHead>
                  <TableHead>Dato</TableHead>
                  <TableHead>Navn (NO)</TableHead>
                  <TableHead>Navn (EN)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {publicHolidays.map((h: PublicHolidayRow) => (
                  <TableRow key={h.holiday_date}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(h.holiday_date)}
                        onCheckedChange={(v) => toggleRow(h.holiday_date, !!v)}
                        aria-label={h.name_no ?? h.name}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatDate(h.holiday_date)}
                    </TableCell>
                    <TableCell className="text-sm">{h.name_no ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{h.name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={importHolidays.isPending}>
            Avbryt
          </Button>
          <Button onClick={handleImport} disabled={selected.size === 0 || importHolidays.isPending}>
            {importHolidays.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Importer {selected.size > 0 ? `${selected.size} valgte` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Right panel: calendar detail view ───────────────────────────────────────

type CalendarDetailProps = {
  calendar: HolidayCalendarRow;
};

function CalendarDetail({ calendar }: CalendarDetailProps) {
  const [entrySheetOpen, setEntrySheetOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const { data: entries, isLoading } = useHolidayEntries(calendar.id);
  const deleteEntry = useDeleteHolidayEntry();

  function handleDeleteEntry(id: string) {
    if (
      !window.confirm("Er du sikker på at du vil slette denne helligdagen? Dette kan ikke angres.")
    ) {
      return;
    }
    deleteEntry.mutate({ id, calendarId: calendar.id });
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="text-muted-foreground h-4 w-4" />
          <h3 className="text-sm font-bold">{calendar.name}</h3>
          {calendar.is_default && (
            <Badge variant="outline" className="text-xs">
              Standard
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Importer norske helligdager
          </Button>
          <Button size="sm" onClick={() => setEntrySheetOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Legg til
          </Button>
        </div>
      </div>

      {/* Entries table */}
      <div className="border-border min-h-0 flex-1 overflow-auto rounded-lg border">
        {isLoading ? (
          <div className="p-4">
            <EntryTableSkeleton />
          </div>
        ) : !entries || entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-16 text-center">
            <CalendarDays className="text-muted-foreground/40 h-8 w-8" />
            <p className="text-muted-foreground text-sm">Ingen helligdager i denne kalenderen</p>
            <p className="text-muted-foreground/60 text-xs">
              Legg til manuelt eller importer norske helligdager
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dato</TableHead>
                <TableHead>Navn (NO)</TableHead>
                <TableHead>Navn (EN)</TableHead>
                <TableHead className="text-center">Hel dag</TableHead>
                <TableHead className="text-right">Timer</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id} className="group">
                  <TableCell className="font-mono text-sm">
                    {formatDate(entry.holiday_date)}
                  </TableCell>
                  <TableCell className="text-sm">{entry.name_no ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{entry.name}</TableCell>
                  <TableCell className="text-center">
                    {entry.is_full_day ? (
                      <Check className="mx-auto h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <span className="text-muted-foreground/40 text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm">{entry.hours}</TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => handleDeleteEntry(entry.id)}
                      disabled={deleteEntry.isPending}
                      className="text-muted-foreground/30 hover:text-destructive opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label="Slett helligdag"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Sheets & Dialogs */}
      <EntrySheet
        open={entrySheetOpen}
        calendarId={calendar.id}
        onClose={() => setEntrySheetOpen(false)}
      />
      <ImportDialog
        open={importDialogOpen}
        calendarId={calendar.id}
        onClose={() => setImportDialogOpen(false)}
      />
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

export function HolidayCalendarSettings() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data: calendars, isLoading } = useHolidayCalendars();
  const deleteCalendar = useDeleteCalendar();

  // Auto-select the first calendar on initial load
  useEffect(() => {
    if (calendars && calendars.length > 0 && !selectedId) {
      setSelectedId(calendars[0]!.id);
    }
  }, [calendars, selectedId]);

  const selectedCalendar = calendars?.find((c) => c.id === selectedId) ?? null;

  function handleDeleteCalendar(calendar: HolidayCalendarRow) {
    if (
      !window.confirm(
        `Er du sikker på at du vil slette kalenderen "${calendar.name}" og alle helligdager i den? Dette kan ikke angres.`,
      )
    ) {
      return;
    }
    deleteCalendar.mutate(
      { id: calendar.id, name: calendar.name },
      {
        onSuccess: () => {
          // Deselect if we deleted the currently selected calendar
          setSelectedId((prev) => (prev === calendar.id ? null : prev));
        },
      },
    );
  }

  return (
    <div className="flex h-full min-h-0 gap-4">
      {/* ── Left panel: calendar list ─────────────────── */}
      <div className="flex w-64 flex-shrink-0 flex-col gap-3">
        <h3 className="text-sm font-bold">Helligdagskalendere</h3>

        {isLoading ? (
          <CalendarListSkeleton />
        ) : !calendars || calendars.length === 0 ? (
          <div className="border-border rounded-lg border border-dashed p-4 text-center">
            <CalendarDays className="text-muted-foreground/40 mx-auto mb-2 h-6 w-6" />
            <p className="text-muted-foreground mb-3 text-xs">
              Opprett din første helligdagskalender
            </p>
            <CreateCalendarForm onCreated={(id) => setSelectedId(id)} />
          </div>
        ) : (
          <div className="space-y-2">
            {calendars.map((calendar) => (
              <CalendarCard
                key={calendar.id}
                calendar={calendar}
                isSelected={selectedId === calendar.id}
                onSelect={() => setSelectedId(calendar.id)}
                onDelete={() => handleDeleteCalendar(calendar)}
              />
            ))}
          </div>
        )}

        {/* "Ny kalender" — only shown when at least one exists */}
        {calendars && calendars.length > 0 && (
          <div className="mt-auto pt-2">
            {showCreateForm ? (
              <div className="border-border rounded-lg border p-3">
                <CreateCalendarForm
                  onCreated={(id) => {
                    setSelectedId(id);
                    setShowCreateForm(false);
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="text-muted-foreground mt-2 w-full text-xs hover:underline"
                >
                  Avbryt
                </button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setShowCreateForm(true)}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Ny kalender
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── Vertical divider ───────────────────────────── */}
      <div className="bg-border w-px flex-shrink-0" />

      {/* ── Right panel: calendar detail ──────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {!selectedCalendar ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <CalendarDays className="text-muted-foreground/30 h-10 w-10" />
            <p className="text-muted-foreground text-sm">Velg en kalender fra listen til venstre</p>
          </div>
        ) : (
          <CalendarDetail calendar={selectedCalendar} />
        )}
      </div>
    </div>
  );
}
