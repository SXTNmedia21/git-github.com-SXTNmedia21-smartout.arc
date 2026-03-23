"use client";

// Card grid + Sheet editor for payroll.shift_type (vakttyper).
// Each shift type renders as a card with a colored left-edge stripe,
// rate adjustment description, active badge, and feature flag icons.
// Admins can create, edit, and delete types via a right-side Sheet.
//
// UI Events:
// - action: openCreate() — "Legg til" button opens Sheet in create mode
// - action: openEdit(row) — card click opens Sheet in edit mode
// - action: useCreateShiftType().mutate(values) — Sheet save (create)
// - action: useUpdateShiftType().mutate({ id, values }) — Sheet save (edit)
// - action: useDeleteShiftType().mutate({ id, name }) — delete button in Sheet footer
// - color-regime: user-chosen hex color → left-edge stripe on each card

import { useState, useEffect, useContext } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Plus,
  Loader2,
  Trash2,
  Banknote,
  Coffee,
  Clock,
  Utensils,
  Users,
  CalendarRange,
  FileText,
  RefreshCw,
} from "lucide-react";
import { Button, Badge, Card, Skeleton, Label, Input } from "@smartout/ui";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  useShiftTypes,
  useCreateShiftType,
  useUpdateShiftType,
  useDeleteShiftType,
  shiftTypeSchema,
  RATE_ADJUSTMENT_TYPES,
  RATE_ADJUSTMENT_LABELS,
  type ShiftTypeRow,
  type ShiftTypeInput,
  type RateAdjustmentType,
} from "../_hooks/use-shift-types";
import { useSalaryCodes as useSalaryCodeDropdown } from "../_hooks/use-salary-codes";

// ─── Rate adjustment description ─────────────────────────────────────────────
// Produces a short human-readable string shown inside the card body.

function rateAdjustmentDescription(type: RateAdjustmentType, value: number): string {
  switch (type) {
    case "replace":
      return `Erstatter: kr ${value.toFixed(0)}/t`;
    case "add":
      return `+kr ${value.toFixed(0)}/t`;
    case "percentage":
      return `+${value.toFixed(0)} %`;
    case "none":
    default:
      return "Ingen justering";
  }
}

// ─── Feature flag icon map ────────────────────────────────────────────────────
// Each flag gets a small Lucide icon. The icon only renders when the flag is true,
// giving admins a quick visual scan of what each shift type supports.

type FlagConfig = {
  key: keyof Pick<
    ShiftTypeRow,
    | "count_in_payroll"
    | "allow_supplements"
    | "allow_breaks"
    | "allow_meal_deduction"
    | "affects_salaried"
    | "allow_conflicting_shifts"
    | "include_in_schedule_print"
    | "overwrite_on_template"
  >;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
};

const FLAG_CONFIGS: FlagConfig[] = [
  { key: "count_in_payroll", icon: Banknote, label: "Tell med i lønn" },
  { key: "allow_supplements", icon: Clock, label: "Tillat tillegg" },
  { key: "allow_breaks", icon: Coffee, label: "Tillat pauser" },
  { key: "allow_meal_deduction", icon: Utensils, label: "Tillat matfradrag" },
  { key: "affects_salaried", icon: Users, label: "Gjelder fastlønnede" },
  { key: "allow_conflicting_shifts", icon: CalendarRange, label: "Tillat overlapp" },
  { key: "include_in_schedule_print", icon: FileText, label: "Vis i utskrift" },
  { key: "overwrite_on_template", icon: RefreshCw, label: "Overskriv ved mal" },
];

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <div className="flex h-full">
            <div className="bg-muted w-1 shrink-0 animate-pulse" />
            <div className="flex-1 space-y-3 p-4">
              <div className="flex items-start justify-between">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
              <Skeleton className="h-4 w-24" />
              <div className="flex gap-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-4 rounded" />
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─── Shift type card ──────────────────────────────────────────────────────────

type ShiftTypeCardProps = {
  row: ShiftTypeRow;
  onClick: () => void;
};

function ShiftTypeCard({ row, onClick }: ShiftTypeCardProps) {
  const activeFlags = FLAG_CONFIGS.filter((f) => row[f.key]);
  const adjustmentText = rateAdjustmentDescription(
    row.rate_adjustment_type as RateAdjustmentType,
    Number(row.rate_adjustment_value),
  );

  return (
    <Card
      className="group hover:bg-accent/50 cursor-pointer overflow-hidden transition-colors"
      onClick={onClick}
    >
      <div className="flex h-full">
        {/* Color stripe — the only place we use a user-supplied hex value directly */}
        <div
          className="w-1 shrink-0 transition-opacity group-hover:opacity-80"
          style={{ backgroundColor: row.color }}
          aria-hidden="true"
        />

        <div className="flex flex-1 flex-col gap-3 p-4">
          {/* Header: name + active badge */}
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm leading-tight font-semibold">{row.name}</span>
            {row.is_active ? (
              <Badge variant="secondary" className="shrink-0 text-xs">
                Aktiv
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground shrink-0 text-xs">
                Inaktiv
              </Badge>
            )}
          </div>

          {/* Rate adjustment summary */}
          <p className="text-muted-foreground text-xs">{adjustmentText}</p>

          {/* Feature flag icons — only enabled flags show */}
          {activeFlags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {activeFlags.map(({ key, icon: Icon, label }) => (
                <span key={key} title={label} className="text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ─── Sheet form ───────────────────────────────────────────────────────────────

type SheetMode = "create" | "edit";

type ShiftTypeSheetProps = {
  open: boolean;
  onClose: () => void;
  mode: SheetMode;
  initialValues?: ShiftTypeRow;
};

const SHEET_DEFAULTS: ShiftTypeInput = {
  name: "",
  color: "#6B7280",
  salary_code: null,
  rate_adjustment_type: "none",
  rate_adjustment_value: 0,
  count_in_payroll: true,
  allow_supplements: true,
  allow_breaks: true,
  allow_meal_deduction: true,
  affects_salaried: false,
  allow_conflicting_shifts: false,
  include_in_schedule_print: true,
  overwrite_on_template: true,
  is_active: true,
  sort_order: 0,
};

// Toggle row used for all the boolean feature flags in the "Funksjoner" section.
type ToggleRowProps = {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
};

function ToggleRow({ id, label, description, checked, onCheckedChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border p-3">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        {description && <p className="text-muted-foreground text-xs">{description}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function ShiftTypeSheet({ open, onClose, mode, initialValues }: ShiftTypeSheetProps) {
  const createType = useCreateShiftType();
  const updateType = useUpdateShiftType();
  const deleteType = useDeleteShiftType();

  // Salary codes for the optional link selector
  const { data: salaryCodes = [] } = useSalaryCodeDropdown();

  const isEdit = mode === "edit";
  const isPending = createType.isPending || updateType.isPending;

  const form = useForm<ShiftTypeInput>({
    resolver: zodResolver(shiftTypeSchema),
    defaultValues: SHEET_DEFAULTS,
  });

  const watchedAdjustmentType = form.watch("rate_adjustment_type");

  // Populate form when editing an existing row, reset to defaults for create.
  useEffect(() => {
    if (!open) return;

    if (isEdit && initialValues) {
      form.reset({
        name: initialValues.name,
        color: initialValues.color,
        salary_code: initialValues.salary_code,
        rate_adjustment_type: initialValues.rate_adjustment_type as RateAdjustmentType,
        rate_adjustment_value: Number(initialValues.rate_adjustment_value),
        count_in_payroll: initialValues.count_in_payroll,
        allow_supplements: initialValues.allow_supplements,
        allow_breaks: initialValues.allow_breaks,
        allow_meal_deduction: initialValues.allow_meal_deduction,
        affects_salaried: initialValues.affects_salaried,
        allow_conflicting_shifts: initialValues.allow_conflicting_shifts,
        include_in_schedule_print: initialValues.include_in_schedule_print,
        overwrite_on_template: initialValues.overwrite_on_template,
        is_active: initialValues.is_active,
        sort_order: initialValues.sort_order,
      });
    } else {
      form.reset(SHEET_DEFAULTS);
    }
  }, [open, isEdit, initialValues, form]);

  function onSubmit(values: ShiftTypeInput) {
    if (isEdit && initialValues) {
      updateType.mutate({ id: initialValues.id, values }, { onSuccess: onClose });
    } else {
      createType.mutate(values, { onSuccess: onClose });
    }
  }

  function handleDelete() {
    if (!initialValues) return;
    if (
      !window.confirm(
        `Er du sikker på at du vil slette vakttypen "${initialValues.name}"? Dette kan ikke angres.`,
      )
    ) {
      return;
    }
    deleteType.mutate({ id: initialValues.id, name: initialValues.name }, { onSuccess: onClose });
  }

  const errors = form.formState.errors;

  // Helper so flag toggles don't need verbose setValue calls at each site
  function setFlag(field: keyof ShiftTypeInput, value: boolean) {
    form.setValue(field, value, { shouldDirty: true });
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Rediger vakttype" : "Ny vakttype"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Oppdater detaljene for denne vakttypen."
              : "Legg til en ny vakttype for arbeidsplassen."}
          </SheetDescription>
        </SheetHeader>

        <form
          id="shift-type-form"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="flex-1 space-y-5 overflow-y-auto py-4"
        >
          {/* ── Grunnleggende ── */}
          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="st-name" className="text-sm font-medium">
                Navn
              </Label>
              <Input id="st-name" placeholder="f.eks. Kveldsvakt" {...form.register("name")} />
              {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
            </div>

            {/* Color + preview */}
            <div className="space-y-1.5">
              <Label htmlFor="st-color" className="text-sm font-medium">
                Farge
              </Label>
              <div className="flex items-center gap-3">
                {/* Native color picker — browser renders the swatch */}
                <input
                  id="st-color"
                  type="color"
                  className="border-input h-9 w-12 cursor-pointer rounded border bg-transparent p-0.5"
                  {...form.register("color")}
                />
                {/* Editable hex text field for precision input */}
                <Input
                  placeholder="#6B7280"
                  className="font-mono"
                  value={form.watch("color")}
                  onChange={(e) => form.setValue("color", e.target.value, { shouldDirty: true })}
                />
              </div>
              {errors.color && <p className="text-destructive text-xs">{errors.color.message}</p>}
            </div>

            {/* Salary code (optional) */}
            <div className="space-y-1.5">
              <Label htmlFor="st-salary-code" className="text-sm font-medium">
                Lønnsart (valgfri)
              </Label>
              <Select
                value={form.watch("salary_code") ?? "none"}
                onValueChange={(v) =>
                  form.setValue("salary_code", v === "none" ? null : v, {
                    shouldDirty: true,
                  })
                }
              >
                <SelectTrigger id="st-salary-code" className="w-full">
                  <SelectValue placeholder="Ingen lønnsart valgt" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ingen lønnsart</SelectItem>
                  {salaryCodes.map((sc) => (
                    <SelectItem key={sc.id} value={sc.id}>
                      {sc.code} — {sc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort order */}
            <div className="space-y-1.5">
              <Label htmlFor="st-sort-order" className="text-sm font-medium">
                Sorteringsrekkefølge
              </Label>
              <Input
                id="st-sort-order"
                type="number"
                min={0}
                className="w-24"
                {...form.register("sort_order")}
              />
            </div>
          </div>

          {/* ── Lønnsjustering ── */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">Lønnsjustering</p>

            <div className="space-y-1.5">
              <Label htmlFor="st-adj-type" className="text-sm font-medium">
                Type
              </Label>
              <Select
                value={form.watch("rate_adjustment_type")}
                onValueChange={(v) =>
                  form.setValue("rate_adjustment_type", v as RateAdjustmentType, {
                    shouldDirty: true,
                  })
                }
              >
                <SelectTrigger id="st-adj-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RATE_ADJUSTMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {RATE_ADJUSTMENT_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Value field — hidden when adjustment type is "none" */}
            {watchedAdjustmentType !== "none" && (
              <div className="space-y-1.5">
                <Label htmlFor="st-adj-value" className="text-sm font-medium">
                  {watchedAdjustmentType === "percentage" ? "Prosent (%)" : "Beløp (kr)"}
                </Label>
                <Input
                  id="st-adj-value"
                  type="number"
                  min={0}
                  step={watchedAdjustmentType === "percentage" ? "0.1" : "1"}
                  className="w-32"
                  {...form.register("rate_adjustment_value")}
                />
                {errors.rate_adjustment_value && (
                  <p className="text-destructive text-xs">{errors.rate_adjustment_value.message}</p>
                )}
              </div>
            )}
          </div>

          {/* ── Funksjoner ── */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">Funksjoner</p>

            <ToggleRow
              id="st-count-payroll"
              label="Tell med i lønn"
              description="Vakter av denne typen inngår i lønnskjøringen."
              checked={form.watch("count_in_payroll")}
              onCheckedChange={(v) => setFlag("count_in_payroll", v)}
            />
            <ToggleRow
              id="st-allow-supplements"
              label="Tillat tillegg"
              description="Tillater at tilleggsregler aktiveres for denne vakten."
              checked={form.watch("allow_supplements")}
              onCheckedChange={(v) => setFlag("allow_supplements", v)}
            />
            <ToggleRow
              id="st-allow-breaks"
              label="Tillat pauser"
              description="Pauser trekkes fra arbeidstiden."
              checked={form.watch("allow_breaks")}
              onCheckedChange={(v) => setFlag("allow_breaks", v)}
            />
            <ToggleRow
              id="st-allow-meal"
              label="Tillat matfradrag"
              description="Matfradrag beregnes for denne vakttypen."
              checked={form.watch("allow_meal_deduction")}
              onCheckedChange={(v) => setFlag("allow_meal_deduction", v)}
            />
            <ToggleRow
              id="st-affects-salaried"
              label="Gjelder fastlønnede"
              description="Inkluder fastlønnede ansatte i beregningen."
              checked={form.watch("affects_salaried")}
              onCheckedChange={(v) => setFlag("affects_salaried", v)}
            />
            <ToggleRow
              id="st-allow-conflict"
              label="Tillat overlappende vakter"
              description="Ansatte kan ha samtidige vakter av denne typen."
              checked={form.watch("allow_conflicting_shifts")}
              onCheckedChange={(v) => setFlag("allow_conflicting_shifts", v)}
            />
            <ToggleRow
              id="st-schedule-print"
              label="Vis i vaktutskrift"
              description="Vakttypen vises på utskrevne vaktlister."
              checked={form.watch("include_in_schedule_print")}
              onCheckedChange={(v) => setFlag("include_in_schedule_print", v)}
            />
            <ToggleRow
              id="st-overwrite-template"
              label="Overskriv ved mal"
              description="Eksisterende vakttype overskrives når en mal brukes."
              checked={form.watch("overwrite_on_template")}
              onCheckedChange={(v) => setFlag("overwrite_on_template", v)}
            />
          </div>

          {/* ── Aktiv ── */}
          <ToggleRow
            id="st-active"
            label="Aktiv"
            description="Inaktive vakttyper er skjult fra valglister."
            checked={form.watch("is_active")}
            onCheckedChange={(v) => setFlag("is_active", v)}
          />
        </form>

        <SheetFooter className="flex-row gap-2 pt-4">
          {isEdit && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={deleteType.isPending}
              onClick={handleDelete}
              className="mr-auto"
            >
              {deleteType.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              <span className="ml-1.5">Slett</span>
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Avbryt
          </Button>
          <Button type="submit" form="shift-type-form" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Lagrer...
              </>
            ) : isEdit ? (
              "Lagre endringer"
            ) : (
              "Opprett vakttype"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ShiftTypesSettings() {
  const { data: shiftTypes = [], isLoading } = useShiftTypes();

  // Sheet state: undefined = closed, null = create mode, ShiftTypeRow = edit mode
  const [sheetRow, setSheetRow] = useState<ShiftTypeRow | null | undefined>(undefined);
  const sheetOpen = sheetRow !== undefined;

  function openCreate() {
    setSheetRow(null);
  }

  function openEdit(row: ShiftTypeRow) {
    setSheetRow(row);
  }

  function closeSheet() {
    setSheetRow(undefined);
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-foreground text-lg font-semibold">Vakttyper</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Definer vakttyper med farge, lønnsjustering og funksjonsflagg. Vakttypen vises som en
            fargestripe i vaktplanen.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          Legg til
        </Button>
      </div>

      {/* Card grid or empty state */}
      {shiftTypes.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16">
          <p className="text-muted-foreground text-sm">Ingen vakttyper opprettet ennå.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            Opprett den første
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {shiftTypes.map((row) => (
            <ShiftTypeCard key={row.id} row={row} onClick={() => openEdit(row)} />
          ))}
        </div>
      )}

      {/* Sheet — shared for create and edit */}
      <ShiftTypeSheet
        open={sheetOpen}
        onClose={closeSheet}
        mode={sheetRow === null ? "create" : "edit"}
        initialValues={sheetRow ?? undefined}
      />
    </div>
  );
}
