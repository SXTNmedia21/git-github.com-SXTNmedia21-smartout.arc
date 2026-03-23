"use client";

// DataTable + Sheet editor for payroll.break_rule (pauseregler).
// Two trigger types: 'after_duration' (auto-pause after N minutes into shift) and
// 'time_of_day' (fixed clock pause e.g. 12:00). The Sheet conditionally shows the
// relevant trigger field and hides the other. Weekdays + department + employee group
// multi-selects default to "all" when left empty.
//
// UI Events:
// - action: openSheet(null) — "Legg til" button opens Sheet in create mode
// - action: openSheet(row) — table row click opens Sheet in edit mode
// - action: useCreateBreakRule().mutate(values) — Sheet save (create)
// - action: useUpdateBreakRule().mutate({ id, values }) — Sheet save (edit)
// - action: useDeleteBreakRule().mutate({ id, name }) — delete button in Sheet footer
// - action: useUpdateBreakRule().mutate({ id, values: { is_active: !current } }) — inline Switch toggle

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Loader2, Trash2, Check, Minus } from "lucide-react";
import { Button, Badge, Card, Skeleton, Label, Input } from "@smartout/ui";
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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  useBreakRules,
  useCreateBreakRule,
  useUpdateBreakRule,
  useDeleteBreakRule,
  useDepartmentOptions,
  useEmployeeGroupOptions,
  breakRuleSchema,
  type BreakRuleRow,
  type BreakRuleInput,
  type TriggerType,
} from "../_hooks/use-break-rules";

// ─── Constants ───────────────────────────────────────────────────────────────

// Norwegian abbreviated day labels; value matches DB convention (0=Sun … 6=Sat)
const WEEKDAY_OPTIONS = [
  { value: 1, label: "Man" },
  { value: 2, label: "Tir" },
  { value: 3, label: "Ons" },
  { value: 4, label: "Tor" },
  { value: 5, label: "Fre" },
  { value: 6, label: "Lør" },
  { value: 0, label: "Søn" },
];

// ─── Display helpers ─────────────────────────────────────────────────────────

/** Formats a trigger into a short badge label for the table. */
function formatTrigger(row: BreakRuleRow): string {
  if (row.trigger_type === "after_duration" && row.trigger_minutes) {
    return `Etter ${row.trigger_minutes} min`;
  }
  if (row.trigger_type === "time_of_day" && row.trigger_time) {
    // trigger_time comes back as "HH:MM:SS" from Postgres TIME — trim to HH:MM
    const time = String(row.trigger_time).slice(0, 5);
    return `Kl. ${time}`;
  }
  return "—";
}

/** Formats the weekdays array into abbreviated day names or "Alle dager". */
function formatWeekdays(days: number[]): string {
  if (!days || days.length === 0) return "Alle dager";
  // Sort by Mon-first display order (1-6, then 0 for Sun)
  const sorted = [...days].sort((a, b) => {
    const order = [1, 2, 3, 4, 5, 6, 0];
    return order.indexOf(a) - order.indexOf(b);
  });
  return sorted
    .map((d) => WEEKDAY_OPTIONS.find((o) => o.value === d)?.label ?? String(d))
    .join(", ");
}

// ─── Loading skeleton ────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3">
            <Skeleton className="h-4 w-40 flex-1" />
            <Skeleton className="h-5 w-28 rounded-full" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-5 w-9 rounded-full" />
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Default form values ──────────────────────────────────────────────────────

const DEFAULT_VALUES: BreakRuleInput = {
  name: "",
  trigger_type: "after_duration",
  trigger_minutes: null,
  trigger_time: null,
  duration_minutes: 30,
  min_shift_duration_minutes: 0,
  is_paid: false,
  department_ids: [],
  employee_group_ids: [],
  weekdays: [],
  is_active: true,
  valid_from: null,
  valid_until: null,
};

// ─── Sheet form ───────────────────────────────────────────────────────────────

type SheetMode = "create" | "edit";

type BreakRuleSheetProps = {
  open: boolean;
  onClose: () => void;
  mode: SheetMode;
  initialValues?: BreakRuleRow;
};

function BreakRuleSheet({ open, onClose, mode, initialValues }: BreakRuleSheetProps) {
  const createRule = useCreateBreakRule();
  const updateRule = useUpdateBreakRule();
  const deleteRule = useDeleteBreakRule();
  const { data: departments = [] } = useDepartmentOptions();
  const { data: employeeGroups = [] } = useEmployeeGroupOptions();

  const isEdit = mode === "edit";
  const isPending = createRule.isPending || updateRule.isPending;

  const form = useForm<BreakRuleInput>({
    resolver: zodResolver(breakRuleSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const triggerType = form.watch("trigger_type");

  // Populate form when editing an existing row, reset on create
  useEffect(() => {
    if (!open) return;

    if (isEdit && initialValues) {
      form.reset({
        name: initialValues.name,
        trigger_type: initialValues.trigger_type as TriggerType,
        trigger_minutes: initialValues.trigger_minutes ?? null,
        trigger_time: initialValues.trigger_time
          ? String(initialValues.trigger_time).slice(0, 5)
          : null,
        duration_minutes: initialValues.duration_minutes,
        min_shift_duration_minutes: initialValues.min_shift_duration_minutes ?? 0,
        is_paid: initialValues.is_paid ?? false,
        department_ids: initialValues.department_ids ?? [],
        employee_group_ids: initialValues.employee_group_ids ?? [],
        weekdays: initialValues.weekdays ?? [],
        is_active: initialValues.is_active,
        valid_from: initialValues.valid_from ?? null,
        valid_until: initialValues.valid_until ?? null,
      });
    } else {
      form.reset(DEFAULT_VALUES);
    }
  }, [open, isEdit, initialValues, form]);

  function onSubmit(values: BreakRuleInput) {
    if (isEdit && initialValues) {
      updateRule.mutate({ id: initialValues.id, values }, { onSuccess: onClose });
    } else {
      createRule.mutate(values, { onSuccess: onClose });
    }
  }

  function handleDelete() {
    if (!initialValues) return;
    if (
      !window.confirm(
        `Er du sikker på at du vil slette pauseregelen "${initialValues.name}"? Dette kan ikke angres.`,
      )
    ) {
      return;
    }
    deleteRule.mutate({ id: initialValues.id, name: initialValues.name }, { onSuccess: onClose });
  }

  // Helpers for array-field toggles (weekdays, department_ids, employee_group_ids)
  function toggleArrayValue<T>(field: keyof BreakRuleInput, value: T, current: T[]) {
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    form.setValue(field, next as never, { shouldDirty: true });
  }

  const errors = form.formState.errors;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Rediger pauseregel" : "Ny pauseregel"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Oppdater detaljene for denne pauseregelen."
              : "Legg til en ny automatisk pauseregel for arbeidsplassen."}
          </SheetDescription>
        </SheetHeader>

        <form
          id="break-rule-form"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="flex-1 space-y-5 overflow-y-auto py-4"
        >
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="br-name" className="text-sm font-medium">
              Navn
            </Label>
            <Input
              id="br-name"
              placeholder="f.eks. Halvtimes pause middag"
              {...form.register("name")}
            />
            {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
          </div>

          {/* Trigger type */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Utløser</Label>
            <Controller
              control={form.control}
              name="trigger_type"
              render={({ field }) => (
                <RadioGroup
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v);
                    // Clear the unused trigger field when switching type
                    if (v === "after_duration") form.setValue("trigger_time", null);
                    else form.setValue("trigger_minutes", null);
                  }}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="after_duration" id="br-trig-duration" />
                    <Label htmlFor="br-trig-duration" className="cursor-pointer font-normal">
                      Etter varighet
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="time_of_day" id="br-trig-time" />
                    <Label htmlFor="br-trig-time" className="cursor-pointer font-normal">
                      Fast tidspunkt
                    </Label>
                  </div>
                </RadioGroup>
              )}
            />
          </div>

          {/* Conditional trigger field — minutes after shift start */}
          {triggerType === "after_duration" && (
            <div className="space-y-1.5">
              <Label htmlFor="br-trigger-minutes" className="text-sm font-medium">
                Minutter etter vaktstart
              </Label>
              <Input
                id="br-trigger-minutes"
                type="number"
                min={1}
                placeholder="f.eks. 240"
                {...form.register("trigger_minutes")}
              />
              {errors.trigger_minutes && (
                <p className="text-destructive text-xs">{errors.trigger_minutes.message}</p>
              )}
            </div>
          )}

          {/* Conditional trigger field — fixed clock time */}
          {triggerType === "time_of_day" && (
            <div className="space-y-1.5">
              <Label htmlFor="br-trigger-time" className="text-sm font-medium">
                Tidspunkt
              </Label>
              <Input id="br-trigger-time" type="time" {...form.register("trigger_time")} />
              {errors.trigger_time && (
                <p className="text-destructive text-xs">{errors.trigger_time.message}</p>
              )}
            </div>
          )}

          {/* Duration */}
          <div className="space-y-1.5">
            <Label htmlFor="br-duration" className="text-sm font-medium">
              Pausevarighet (min)
            </Label>
            <Input
              id="br-duration"
              type="number"
              min={1}
              placeholder="f.eks. 30"
              {...form.register("duration_minutes")}
            />
            {errors.duration_minutes && (
              <p className="text-destructive text-xs">{errors.duration_minutes.message}</p>
            )}
          </div>

          {/* Minimum shift duration */}
          <div className="space-y-1.5">
            <Label htmlFor="br-min-shift" className="text-sm font-medium">
              Minimum vaktlengde (min)
            </Label>
            <Input
              id="br-min-shift"
              type="number"
              min={0}
              placeholder="0 = ingen minimum"
              {...form.register("min_shift_duration_minutes")}
            />
            <p className="text-muted-foreground text-xs">
              Regelen gjelder ikke for vakter kortere enn dette.
            </p>
          </div>

          {/* Paid break toggle */}
          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="br-paid" className="text-sm font-medium">
                Betalt pause
              </Label>
              <p className="text-muted-foreground text-xs">
                Betalt pause trekkes ikke fra arbeidstid.
              </p>
            </div>
            <Switch
              id="br-paid"
              checked={form.watch("is_paid")}
              onCheckedChange={(v) => form.setValue("is_paid", v, { shouldDirty: true })}
            />
          </div>

          {/* Weekdays */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Gjelder dager (tom = alle)</Label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_OPTIONS.map((day) => {
                const selected = (form.watch("weekdays") ?? []).includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() =>
                      toggleArrayValue("weekdays", day.value, form.watch("weekdays") ?? [])
                    }
                    className={`rounded border px-3 py-1 text-xs font-medium transition-colors ${
                      selected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Departments multi-select */}
          {departments.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Avdelinger (tom = alle)</Label>
              <div className="rounded-md border">
                {departments.map((dept) => {
                  const selected = (form.watch("department_ids") ?? []).includes(
                    dept.department_id,
                  );
                  return (
                    <label
                      key={dept.department_id}
                      className="hover:bg-accent flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors first:rounded-t-md last:rounded-b-md"
                    >
                      <Checkbox
                        checked={selected}
                        onCheckedChange={() =>
                          toggleArrayValue(
                            "department_ids",
                            dept.department_id,
                            form.watch("department_ids") ?? [],
                          )
                        }
                      />
                      <span className="text-sm">{dept.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Employee groups multi-select */}
          {employeeGroups.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Lønnsgrupper (tom = alle)</Label>
              <div className="rounded-md border">
                {employeeGroups.map((group) => {
                  const selected = (form.watch("employee_group_ids") ?? []).includes(group.id);
                  return (
                    <label
                      key={group.id}
                      className="hover:bg-accent flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors first:rounded-t-md last:rounded-b-md"
                    >
                      <Checkbox
                        checked={selected}
                        onCheckedChange={() =>
                          toggleArrayValue(
                            "employee_group_ids",
                            group.id,
                            form.watch("employee_group_ids") ?? [],
                          )
                        }
                      />
                      <span className="text-sm">{group.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active toggle */}
          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="br-active" className="text-sm font-medium">
                Aktiv
              </Label>
              <p className="text-muted-foreground text-xs">
                Inaktive regler brukes ikke i lønnskjøringen.
              </p>
            </div>
            <Switch
              id="br-active"
              checked={form.watch("is_active")}
              onCheckedChange={(v) => form.setValue("is_active", v, { shouldDirty: true })}
            />
          </div>
        </form>

        <SheetFooter className="flex-row gap-2 pt-4">
          {isEdit && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={deleteRule.isPending}
              onClick={handleDelete}
              className="mr-auto"
            >
              {deleteRule.isPending ? (
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
          <Button type="submit" form="break-rule-form" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Lagrer...
              </>
            ) : isEdit ? (
              "Lagre endringer"
            ) : (
              "Opprett pauseregel"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BreakRulesSettings() {
  const { data: rules = [], isLoading } = useBreakRules();
  const updateRule = useUpdateBreakRule();

  // Sheet state: undefined = closed, null = create mode, BreakRuleRow = edit mode
  const [sheetRow, setSheetRow] = useState<BreakRuleRow | null | undefined>(undefined);
  const sheetOpen = sheetRow !== undefined;

  function openCreate() {
    setSheetRow(null);
  }

  function openEdit(row: BreakRuleRow) {
    setSheetRow(row);
  }

  function closeSheet() {
    setSheetRow(undefined);
  }

  // Inline active toggle — fires without opening the Sheet
  function handleToggleActive(row: BreakRuleRow, checked: boolean) {
    updateRule.mutate({
      id: row.id,
      values: {
        name: row.name,
        trigger_type: row.trigger_type as TriggerType,
        trigger_minutes: row.trigger_minutes,
        trigger_time: row.trigger_time ? String(row.trigger_time).slice(0, 5) : null,
        duration_minutes: row.duration_minutes,
        min_shift_duration_minutes: row.min_shift_duration_minutes ?? 0,
        is_paid: row.is_paid ?? false,
        department_ids: row.department_ids ?? [],
        employee_group_ids: row.employee_group_ids ?? [],
        weekdays: row.weekdays ?? [],
        is_active: checked,
        valid_from: row.valid_from ?? null,
        valid_until: row.valid_until ?? null,
      },
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-80" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
        <TableSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-foreground text-lg font-semibold">Pauseregler</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Definer automatiske pauseregler. Regler kan knyttes til avdelinger, lønnsgrupper og
            spesifikke ukedager.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          Legg til
        </Button>
      </div>

      {/* Table */}
      {rules.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16">
          <p className="text-muted-foreground text-sm">Ingen pauseregler opprettet ennå.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            Opprett den første
          </Button>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Navn</TableHead>
                <TableHead className="w-36">Trigger</TableHead>
                <TableHead className="w-28">Varighet</TableHead>
                <TableHead className="w-36">Min. vaktlengde</TableHead>
                <TableHead className="w-20">Betalt</TableHead>
                <TableHead className="w-16 text-right">Aktiv</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((row) => (
                <TableRow key={row.id} className="cursor-pointer" onClick={() => openEdit(row)}>
                  <TableCell className="text-sm font-medium">{row.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs font-medium">
                      {formatTrigger(row)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {row.duration_minutes} min
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {row.min_shift_duration_minutes ? `${row.min_shift_duration_minutes} min` : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {row.is_paid ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Minus className="h-4 w-4" />
                    )}
                  </TableCell>
                  <TableCell
                    className="text-right"
                    // Prevent row click from opening the Sheet when toggling active
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Switch
                      checked={row.is_active}
                      onCheckedChange={(checked) => handleToggleActive(row, checked)}
                      disabled={updateRule.isPending}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Sheet — shared for create and edit */}
      <BreakRuleSheet
        open={sheetOpen}
        onClose={closeSheet}
        mode={sheetRow === null ? "create" : "edit"}
        initialValues={sheetRow ?? undefined}
      />
    </div>
  );
}
