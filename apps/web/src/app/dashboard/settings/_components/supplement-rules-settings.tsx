"use client";

// DataTable + Sheet editor for payroll.supplement_rule (tilleggsregler).
// The most complex payroll settings screen — 6 supplement types with type-specific
// fields, all backed by a single wide DB table. Tabs filter by supplement_type,
// the Sheet conditionally shows/hides fields based on the active type.
//
// UI Events:
// - action: setActiveTab(type) — tab switch filters table
// - action: openSheet(null) — "Legg til" button opens Sheet in create mode
// - action: openSheet(row) — table row click opens Sheet in edit mode
// - action: useCreateSupplementRule().mutate(values) — Sheet save (create)
// - action: useUpdateSupplementRule().mutate({ id, values }) — Sheet save (edit)
// - action: useDeleteSupplementRule().mutate({ id, name }) — delete button in Sheet footer
// - action: useUpdateSupplementRule().mutate({ id, values: { is_active: !current } }) — inline Switch toggle

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Loader2, Trash2, FlaskConical } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { PageTabNav } from "@/components/dashboard/PageTabNav";
import {
  useSupplementRules,
  useCreateSupplementRule,
  useUpdateSupplementRule,
  useDeleteSupplementRule,
  useEmployeeGroupOptions,
  useShiftTypeOptions,
  useSalaryCodeOptions,
  supplementRuleSchema,
  getDefaultValues,
  SUPPLEMENT_TYPES,
  SUPPLEMENT_TYPE_LABELS,
  RATE_TYPES,
  RATE_TYPE_LABELS,
  START_TYPES,
  type SupplementType,
  type RateType,
  type StartType,
  type SupplementRuleRow,
  type SupplementRuleInput,
} from "../_hooks/use-supplement-rules";

// ─── Display helpers ────────────────────────────────────────────────────────

const START_TYPE_LABELS: Record<StartType, string> = {
  time_of_day: "Klokkeslett",
  after_shift_start: "Etter vaktstart",
};

const WEEKDAY_LABELS = [
  { value: 1, label: "Man" },
  { value: 2, label: "Tir" },
  { value: 3, label: "Ons" },
  { value: 4, label: "Tor" },
  { value: 5, label: "Fre" },
  { value: 6, label: "Lør" },
  { value: 0, label: "Søn" },
];

/** Formats rate_type + rate_value into a human-readable string. */
function formatRate(rateType: RateType, rateValue: number): string {
  switch (rateType) {
    case "fixed_per_hour":
      return `${rateValue} kr/t`;
    case "percentage":
      return `${rateValue}%`;
    case "fixed_per_shift":
      return `${rateValue} kr/vakt`;
  }
}

/** Formats weekday numbers into abbreviated Norwegian day names. */
function formatWeekdays(days: number[]): string {
  if (days.length === 0) return "Alle dager";
  if (days.length === 7) return "Alle dager";
  return WEEKDAY_LABELS.filter((d) => days.includes(d.value))
    .map((d) => d.label)
    .join(", ");
}

// ─── Loading skeleton ───────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3">
            <Skeleton className="h-4 w-40 flex-1" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-9 rounded-full" />
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Multi-select checkbox list ─────────────────────────────────────────────
// Simple scrollable list of checkboxes. Used for employee_group_ids and
// shift_type_ids. Empty selection = applies to all (hint text shown).

type CheckboxListProps = {
  label: string;
  hint: string;
  options: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  isLoading?: boolean;
};

function CheckboxList({ label, hint, options, selected, onChange, isLoading }: CheckboxListProps) {
  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      <p className="text-muted-foreground text-xs">{hint}</p>
      {isLoading ? (
        <div className="space-y-2 py-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-32" />
          ))}
        </div>
      ) : options.length === 0 ? (
        <p className="text-muted-foreground py-2 text-xs italic">Ingen tilgjengelige</p>
      ) : (
        <div className="max-h-36 space-y-1.5 overflow-y-auto rounded-md border p-2">
          {options.map((opt) => (
            <label
              key={opt.id}
              className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 transition-colors"
            >
              <Checkbox
                checked={selected.includes(opt.id)}
                onCheckedChange={() => toggle(opt.id)}
              />
              <span className="text-sm">{opt.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Rule preview panel ─────────────────────────────────────────────────────
// Shows a human-readable summary of when the rule will fire.
// T7.2: "Test-rule preview" — no engine call needed; pure formatting of form state.

type RulePreviewProps = {
  values: Partial<SupplementRuleInput>;
};

const WEEKDAY_ABBR = ["Søn", "Man", "Tir", "Ons", "Tor", "Fre", "Lør"];

function RulePreviewPanel({ values }: RulePreviewProps) {
  const lines: string[] = [];

  // Supplement type + rate
  const rateDisplay =
    values.rate_type === "fixed_per_hour"
      ? `${values.rate_value ?? 0} kr/t`
      : values.rate_type === "percentage"
        ? `${((values.rate_value ?? 0) * 100).toFixed(1)} % av grunnlønn`
        : `${values.rate_value ?? 0} kr/vakt`;

  lines.push(`Sats: ${rateDisplay}`);

  // Supplement type conditions
  switch (values.supplement_type) {
    case "normal": {
      if (
        values.start_type === "time_of_day" &&
        values.time_window_start &&
        values.time_window_end
      ) {
        lines.push(`Aktiv mellom kl. ${values.time_window_start} – ${values.time_window_end}`);
      } else if (values.start_type === "after_shift_start" && values.after_minutes != null) {
        lines.push(`Aktiv etter ${values.after_minutes} min fra vaktstart`);
      }
      const weekdays = values.weekdays ?? [];
      if (weekdays.length > 0 && weekdays.length < 7) {
        lines.push(`Ukedager: ${weekdays.map((d) => WEEKDAY_ABBR[d] ?? d).join(", ")}`);
      } else {
        lines.push("Ukedager: Alle");
      }
      break;
    }
    case "week_based":
      if (values.weekly_threshold_hours != null) {
        lines.push(`Fyres etter ${values.weekly_threshold_hours} timer per uke`);
      }
      break;
    case "day_based":
      if (values.daily_threshold_hours != null) {
        lines.push(`Fyres etter ${values.daily_threshold_hours} timer per dag`);
      }
      break;
    case "manual":
      lines.push("Manuelt lagt til per vakt");
      if (values.allow_rate_override) lines.push("Lederen kan overstyre sats");
      break;
    case "holiday":
      lines.push("Fyres på helligdager iht. kalender");
      break;
    case "contract_rule":
      if (values.evaluation_field) {
        lines.push(`Evaluerer felt: ${values.evaluation_field}`);
      }
      if (values.threshold_value != null) {
        lines.push(`Terskelverdi: ${values.threshold_value}`);
      }
      break;
  }

  // Scope
  if ((values.employee_group_ids?.length ?? 0) > 0) {
    lines.push(`Begrenses til ${values.employee_group_ids!.length} lønnsgruppe(r)`);
  }
  if ((values.shift_type_ids?.length ?? 0) > 0) {
    lines.push(`Begrenses til ${values.shift_type_ids!.length} vakttype(r)`);
  }

  // Flags
  if (values.affected_by_breaks === false) lines.push("Pauser påvirker ikke");
  if (values.enforced_payment) lines.push("Tvungen utbetaling (kan ikke blokkeres av stacking)");

  // Validity
  if (values.valid_from) lines.push(`Gyldig fra: ${values.valid_from}`);
  if (values.valid_until) lines.push(`Gyldig til: ${values.valid_until}`);

  return (
    <div className="bg-muted/30 rounded-md border p-3 text-xs">
      <div className="text-muted-foreground mb-2 flex items-center gap-1.5">
        <FlaskConical className="h-3.5 w-3.5" />
        <span className="font-medium tracking-wider uppercase">Regelforskrift</span>
      </div>
      {lines.length === 0 ? (
        <p className="text-muted-foreground italic">Fyll inn feltene for å se regelpreview</p>
      ) : (
        <ul className="space-y-0.5">
          {lines.map((line, i) => (
            <li key={i} className="text-foreground">
              {line}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Type-specific table columns ────────────────────────────────────────────
// Each supplement type shows different extra columns beyond the shared set.

function TypeSpecificColumns({ type }: { type: SupplementType }) {
  switch (type) {
    case "normal":
      return (
        <>
          <TableHead className="w-36">Tidsvindu</TableHead>
          <TableHead className="w-32">Ukedager</TableHead>
        </>
      );
    case "week_based":
      return <TableHead className="w-32">Terskel</TableHead>;
    case "day_based":
      return <TableHead className="w-32">Terskel</TableHead>;
    case "manual":
      return <TableHead className="w-28">Standardsats</TableHead>;
    case "holiday":
      return <TableHead className="w-32">Kalender</TableHead>;
    case "contract_rule":
      return (
        <>
          <TableHead className="w-28">Felt</TableHead>
          <TableHead className="w-28">Terskel</TableHead>
        </>
      );
  }
}

function TypeSpecificCells({ row }: { row: SupplementRuleRow }) {
  switch (row.supplement_type) {
    case "normal":
      return (
        <>
          <TableCell className="text-muted-foreground text-sm">
            {row.time_window_start && row.time_window_end
              ? `${row.time_window_start}–${row.time_window_end}`
              : row.after_minutes != null
                ? `Etter ${row.after_minutes} min`
                : "—"}
          </TableCell>
          <TableCell className="text-muted-foreground text-sm">
            {formatWeekdays(row.weekdays)}
          </TableCell>
        </>
      );
    case "week_based":
      return (
        <TableCell className="text-muted-foreground text-sm">
          {row.weekly_threshold_hours != null ? `>${row.weekly_threshold_hours}t/uke` : "—"}
        </TableCell>
      );
    case "day_based":
      return (
        <TableCell className="text-muted-foreground text-sm">
          {row.daily_threshold_hours != null ? `>${row.daily_threshold_hours}t/dag` : "—"}
        </TableCell>
      );
    case "manual":
      return (
        <TableCell className="text-muted-foreground text-sm">
          {row.default_rate != null ? `${row.default_rate} kr` : "—"}
        </TableCell>
      );
    case "holiday":
      return (
        <TableCell className="text-muted-foreground text-sm">
          {row.holiday_calendar_id ? "Tilknyttet" : "—"}
        </TableCell>
      );
    case "contract_rule":
      return (
        <>
          <TableCell className="text-muted-foreground text-sm">
            {row.evaluation_field ?? "—"}
          </TableCell>
          <TableCell className="text-muted-foreground text-sm">
            {row.threshold_value != null ? String(row.threshold_value) : "—"}
          </TableCell>
        </>
      );
    default:
      return null;
  }
}

// ─── Rules table for a single type ──────────────────────────────────────────

type RulesTableProps = {
  type: SupplementType;
  onEdit: (row: SupplementRuleRow) => void;
  onCreate: () => void;
};

function RulesTable({ type, onEdit, onCreate }: RulesTableProps) {
  const { data: rules = [], isLoading } = useSupplementRules(type);
  const updateRule = useUpdateSupplementRule();

  function handleToggleActive(row: SupplementRuleRow, checked: boolean) {
    updateRule.mutate({
      id: row.id,
      values: { ...(row as SupplementRuleInput), is_active: checked },
    });
  }

  if (isLoading) return <TableSkeleton />;

  if (rules.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center py-16">
        <p className="text-muted-foreground text-sm">Ingen tilleggsregler av denne typen</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={onCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          Opprett den første
        </Button>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Navn</TableHead>
            <TableHead className="w-28">Sats</TableHead>
            <TableHead className="w-28">Lønnart</TableHead>
            <TypeSpecificColumns type={type} />
            <TableHead className="w-16 text-right">Aktiv</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.map((row) => (
            <TableRow key={row.id} className="cursor-pointer" onClick={() => onEdit(row)}>
              <TableCell className="text-sm font-medium">{row.name}</TableCell>
              <TableCell className="text-sm">
                <Badge variant="secondary" className="text-xs">
                  {formatRate(row.rate_type as RateType, row.rate_value)}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground font-mono text-sm">
                {row.salary_code ?? "—"}
              </TableCell>
              <TypeSpecificCells row={row} />
              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
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
  );
}

// ─── Sheet form ─────────────────────────────────────────────────────────────
// The Sheet adapts its visible fields based on the selected supplement_type.
// In edit mode the type selector is disabled — you can't change the type
// of an existing rule.

type SheetMode = "create" | "edit";

type SupplementRuleSheetProps = {
  open: boolean;
  onClose: () => void;
  mode: SheetMode;
  activeType: SupplementType;
  initialValues?: SupplementRuleRow;
};

function SupplementRuleSheet({
  open,
  onClose,
  mode,
  activeType,
  initialValues,
}: SupplementRuleSheetProps) {
  const createRule = useCreateSupplementRule();
  const updateRule = useUpdateSupplementRule();
  const deleteRule = useDeleteSupplementRule();

  const { data: groupOptions = [], isLoading: groupsLoading } = useEmployeeGroupOptions();
  const { data: shiftTypeOptions = [], isLoading: shiftTypesLoading } = useShiftTypeOptions();
  const { data: salaryCodeOptions = [] } = useSalaryCodeOptions();

  const isEdit = mode === "edit";
  const isPending = createRule.isPending || updateRule.isPending;

  const form = useForm<SupplementRuleInput>({
    resolver: zodResolver(supplementRuleSchema),
    defaultValues: getDefaultValues(activeType),
  });

  const watchedType = form.watch("supplement_type");
  const watchedStartType = form.watch("start_type");

  // Populate form when opening
  useEffect(() => {
    if (open) {
      if (isEdit && initialValues) {
        form.reset({
          ...initialValues,
          supplement_type: initialValues.supplement_type as SupplementType,
          rate_type: initialValues.rate_type as RateType,
          start_type: initialValues.start_type as StartType | null,
          employee_group_ids: initialValues.employee_group_ids ?? [],
          employee_types: initialValues.employee_types ?? [],
          shift_type_ids: initialValues.shift_type_ids ?? [],
          weekdays: initialValues.weekdays ?? [],
        });
      } else {
        form.reset(getDefaultValues(activeType));
      }
    }
  }, [open, isEdit, initialValues, activeType, form]);

  function onSubmit(values: SupplementRuleInput) {
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
        `Er du sikker på at du vil slette tilleggsregelen "${initialValues.name}"? Dette kan ikke angres.`,
      )
    ) {
      return;
    }
    deleteRule.mutate({ id: initialValues.id, name: initialValues.name }, { onSuccess: onClose });
  }

  const errors = form.formState.errors;

  // Memoize selected arrays to avoid unnecessary re-renders in CheckboxList
  const selectedGroups = form.watch("employee_group_ids");
  const selectedShiftTypes = form.watch("shift_type_ids");
  const selectedWeekdays = form.watch("weekdays");

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Rediger tilleggsregel" : "Ny tilleggsregel"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Oppdater detaljene for denne tilleggsregelen."
              : `Opprett en ny ${SUPPLEMENT_TYPE_LABELS[activeType].toLowerCase()}-regel.`}
          </SheetDescription>
        </SheetHeader>

        <form
          id="supplement-rule-form"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="flex-1 space-y-4 overflow-y-auto py-4"
        >
          {/* Supplement type — disabled in edit mode */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Type</Label>
            <Select
              value={watchedType}
              onValueChange={(v) =>
                form.setValue("supplement_type", v as SupplementType, { shouldDirty: true })
              }
              disabled={isEdit}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPLEMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {SUPPLEMENT_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="sr-name" className="text-sm font-medium">
              Navn
            </Label>
            <Input id="sr-name" placeholder="f.eks. Kveldstillegg" {...form.register("name")} />
            {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
          </div>

          {/* Rate type + value side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Satstype</Label>
              <Select
                value={form.watch("rate_type")}
                onValueChange={(v) =>
                  form.setValue("rate_type", v as RateType, { shouldDirty: true })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RATE_TYPES.map((rt) => (
                    <SelectItem key={rt} value={rt}>
                      {RATE_TYPE_LABELS[rt]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sr-rate-value" className="text-sm font-medium">
                Satsverdi
              </Label>
              <Input
                id="sr-rate-value"
                type="number"
                step="0.01"
                min="0"
                {...form.register("rate_value")}
              />
              {errors.rate_value && (
                <p className="text-destructive text-xs">{errors.rate_value.message}</p>
              )}
            </div>
          </div>

          {/* Salary code */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Lønnart</Label>
            <Select
              value={form.watch("salary_code") ?? ""}
              onValueChange={(v) => form.setValue("salary_code", v || null, { shouldDirty: true })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Velg lønnart (valgfri)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Ingen</SelectItem>
                {salaryCodeOptions.map((sc) => (
                  <SelectItem key={sc.id} value={sc.code}>
                    {sc.code} — {sc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ── Type 1: Normal ─────────────────────────────────── */}
          {watchedType === "normal" && (
            <div className="space-y-4 rounded-md border p-3">
              <p className="text-sm font-semibold">Normal-spesifikke felt</p>

              {/* Start type */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Starttype</Label>
                <Select
                  value={watchedStartType ?? "time_of_day"}
                  onValueChange={(v) =>
                    form.setValue("start_type", v as StartType, { shouldDirty: true })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {START_TYPES.map((st) => (
                      <SelectItem key={st} value={st}>
                        {START_TYPE_LABELS[st]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Time window (only for time_of_day) */}
              {watchedStartType === "time_of_day" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="sr-tw-start" className="text-sm font-medium">
                      Fra kl.
                    </Label>
                    <Input id="sr-tw-start" type="time" {...form.register("time_window_start")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sr-tw-end" className="text-sm font-medium">
                      Til kl.
                    </Label>
                    <Input id="sr-tw-end" type="time" {...form.register("time_window_end")} />
                  </div>
                </div>
              )}

              {/* After minutes (only for after_shift_start) */}
              {watchedStartType === "after_shift_start" && (
                <div className="space-y-1.5">
                  <Label htmlFor="sr-after-min" className="text-sm font-medium">
                    Etter minutter
                  </Label>
                  <Input
                    id="sr-after-min"
                    type="number"
                    min="0"
                    placeholder="f.eks. 480"
                    {...form.register("after_minutes")}
                  />
                </div>
              )}

              {/* Weekdays */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Ukedager</Label>
                <p className="text-muted-foreground text-xs">Tom = gjelder alle dager</p>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_LABELS.map((day) => {
                    const isSelected = selectedWeekdays.includes(day.value);
                    return (
                      <label
                        key={day.value}
                        className="hover:bg-accent flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 transition-colors"
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => {
                            const next = isSelected
                              ? selectedWeekdays.filter((d) => d !== day.value)
                              : [...selectedWeekdays, day.value];
                            form.setValue("weekdays", next, { shouldDirty: true });
                          }}
                        />
                        <span className="text-sm">{day.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Type 2: Week-based ─────────────────────────────── */}
          {watchedType === "week_based" && (
            <div className="space-y-4 rounded-md border p-3">
              <p className="text-sm font-semibold">Ukesbasert-spesifikke felt</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sr-weekly-threshold" className="text-sm font-medium">
                    Terskel (timer/uke)
                  </Label>
                  <Input
                    id="sr-weekly-threshold"
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="f.eks. 37.5"
                    {...form.register("weekly_threshold_hours")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sr-weekly-max" className="text-sm font-medium">
                    Maks timer/uke
                  </Label>
                  <Input
                    id="sr-weekly-max"
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="Valgfri"
                    {...form.register("weekly_max_hours")}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Type 3: Day-based ──────────────────────────────── */}
          {watchedType === "day_based" && (
            <div className="space-y-4 rounded-md border p-3">
              <p className="text-sm font-semibold">Dagbasert-spesifikke felt</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sr-daily-threshold" className="text-sm font-medium">
                    Terskel (timer/dag)
                  </Label>
                  <Input
                    id="sr-daily-threshold"
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="f.eks. 9"
                    {...form.register("daily_threshold_hours")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sr-daily-max" className="text-sm font-medium">
                    Maks timer/dag
                  </Label>
                  <Input
                    id="sr-daily-max"
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="Valgfri"
                    {...form.register("daily_max_hours")}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Type 4: Manual ─────────────────────────────────── */}
          {watchedType === "manual" && (
            <div className="space-y-4 rounded-md border p-3">
              <p className="text-sm font-semibold">Manuelt-spesifikke felt</p>
              <div className="space-y-1.5">
                <Label htmlFor="sr-default-rate" className="text-sm font-medium">
                  Standardsats (kr)
                </Label>
                <Input
                  id="sr-default-rate"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0"
                  {...form.register("default_rate")}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="sr-allow-override" className="text-sm font-medium">
                    Tillat satsendring
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    Kan leder overstyre satsen per vakt?
                  </p>
                </div>
                <Switch
                  id="sr-allow-override"
                  checked={form.watch("allow_rate_override")}
                  onCheckedChange={(v) =>
                    form.setValue("allow_rate_override", v, { shouldDirty: true })
                  }
                />
              </div>
            </div>
          )}

          {/* ── Type 5: Holiday ────────────────────────────────── */}
          {watchedType === "holiday" && (
            <div className="space-y-4 rounded-md border p-3">
              <p className="text-sm font-semibold">Helligdag-spesifikke felt</p>
              <div className="space-y-1.5">
                <Label htmlFor="sr-holiday-cal" className="text-sm font-medium">
                  Kalender-ID
                </Label>
                <Input
                  id="sr-holiday-cal"
                  placeholder="UUID til helligdagskalender"
                  {...form.register("holiday_calendar_id")}
                />
                <p className="text-muted-foreground text-xs">
                  Kobles til en helligdagskalender. Settes opp under Helligdager-fanen.
                </p>
              </div>
            </div>
          )}

          {/* ── Type 6: Contract rule ──────────────────────────── */}
          {watchedType === "contract_rule" && (
            <div className="space-y-4 rounded-md border p-3">
              <p className="text-sm font-semibold">Kontraktsregel-spesifikke felt</p>
              <div className="space-y-1.5">
                <Label htmlFor="sr-contract-rule-id" className="text-sm font-medium">
                  Kontraktsregel-ID
                </Label>
                <Input
                  id="sr-contract-rule-id"
                  placeholder="UUID"
                  {...form.register("contract_rule_id")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sr-eval-field" className="text-sm font-medium">
                  Evalueringsfelt
                </Label>
                <Input
                  id="sr-eval-field"
                  placeholder="f.eks. weekly_hours"
                  {...form.register("evaluation_field")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sr-threshold" className="text-sm font-medium">
                  Terskelverdi
                </Label>
                <Input
                  id="sr-threshold"
                  type="number"
                  step="0.01"
                  min="0"
                  {...form.register("threshold_value")}
                />
              </div>
            </div>
          )}

          {/* ── Scope: Employee groups ─────────────────────────── */}
          <CheckboxList
            label="Lønnsgrupper"
            hint="Tom = gjelder alle grupper"
            options={groupOptions}
            selected={selectedGroups}
            onChange={(ids) => form.setValue("employee_group_ids", ids, { shouldDirty: true })}
            isLoading={groupsLoading}
          />

          {/* ── Scope: Shift types ─────────────────────────────── */}
          <CheckboxList
            label="Vakttyper"
            hint="Tom = gjelder alle vakttyper"
            options={shiftTypeOptions}
            selected={selectedShiftTypes}
            onChange={(ids) => form.setValue("shift_type_ids", ids, { shouldDirty: true })}
            isLoading={shiftTypesLoading}
          />

          {/* ── Boolean flags ──────────────────────────────────── */}
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-sm font-semibold">Innstillinger</p>

            <div className="flex items-center justify-between py-1">
              <Label htmlFor="sr-breaks" className="text-sm">
                Påvirkes av pauser
              </Label>
              <Switch
                id="sr-breaks"
                checked={form.watch("affected_by_breaks")}
                onCheckedChange={(v) =>
                  form.setValue("affected_by_breaks", v, { shouldDirty: true })
                }
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <Label htmlFor="sr-salaried" className="text-sm">
                Gjelder fastlønn
              </Label>
              <Switch
                id="sr-salaried"
                checked={form.watch("affects_salaried")}
                onCheckedChange={(v) => form.setValue("affects_salaried", v, { shouldDirty: true })}
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <Label htmlFor="sr-enforced" className="text-sm">
                Tvungen utbetaling
              </Label>
              <Switch
                id="sr-enforced"
                checked={form.watch("enforced_payment")}
                onCheckedChange={(v) => form.setValue("enforced_payment", v, { shouldDirty: true })}
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <Label htmlFor="sr-midnight" className="text-sm">
                Vurder midnatt
              </Label>
              <Switch
                id="sr-midnight"
                checked={form.watch("consider_midnight")}
                onCheckedChange={(v) =>
                  form.setValue("consider_midnight", v, { shouldDirty: true })
                }
              />
            </div>
          </div>

          {/* Validity period */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sr-valid-from" className="text-sm font-medium">
                Gyldig fra
              </Label>
              <Input id="sr-valid-from" type="date" {...form.register("valid_from")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sr-valid-until" className="text-sm font-medium">
                Gyldig til
              </Label>
              <Input id="sr-valid-until" type="date" {...form.register("valid_until")} />
            </div>
          </div>

          {/* Sort order + active */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sr-sort" className="text-sm font-medium">
                Sortering
              </Label>
              <Input id="sr-sort" type="number" min="0" {...form.register("sort_order")} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="sr-active" className="text-sm font-medium">
                Aktiv
              </Label>
              <Switch
                id="sr-active"
                checked={form.watch("is_active")}
                onCheckedChange={(v) => form.setValue("is_active", v, { shouldDirty: true })}
              />
            </div>
          </div>

          {/* T7.2: Rule preview — live formatted summary of firing conditions */}
          <RulePreviewPanel values={form.watch()} />
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
          <Button type="submit" form="supplement-rule-form" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Lagrer...
              </>
            ) : isEdit ? (
              "Lagre endringer"
            ) : (
              "Opprett regel"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export function SupplementRulesSettings() {
  const [activeTab, setActiveTab] = useState<SupplementType>("normal");

  // Sheet state: undefined = closed, null = create mode, SupplementRuleRow = edit mode
  const [sheetRow, setSheetRow] = useState<SupplementRuleRow | null | undefined>(undefined);
  const sheetOpen = sheetRow !== undefined;

  function openCreate() {
    setSheetRow(null);
  }

  function openEdit(row: SupplementRuleRow) {
    setSheetRow(row);
  }

  function closeSheet() {
    setSheetRow(undefined);
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-foreground text-lg font-semibold">Tilleggsregler</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Definer tilleggsregler som beregner tillegg basert på tid, dag, uke, helligdag eller
            kontrakt.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          Legg til
        </Button>
      </div>

      {/* Tabs for each supplement type */}
      <PageTabNav
        tabs={SUPPLEMENT_TYPES.map((t) => ({ key: t, label: SUPPLEMENT_TYPE_LABELS[t] }))}
        active={activeTab}
        onChange={(v) => setActiveTab(v as SupplementType)}
        className="mb-4"
        ariaLabel="Tillegg-typer"
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SupplementType)}>
        {SUPPLEMENT_TYPES.map((type) => (
          <TabsContent key={type} value={type}>
            <RulesTable type={type} onEdit={openEdit} onCreate={openCreate} />
          </TabsContent>
        ))}
      </Tabs>

      {/* Sheet — shared for create and edit */}
      <SupplementRuleSheet
        open={sheetOpen}
        onClose={closeSheet}
        mode={sheetRow === null ? "create" : "edit"}
        activeType={sheetRow != null ? (sheetRow.supplement_type as SupplementType) : activeTab}
        initialValues={sheetRow ?? undefined}
      />
    </div>
  );
}
