"use client";

// DataTable + Sheet editor for payroll.meal_rule (måltidsregler).
// Admins can create, edit, toggle active status, and delete meal rules.
// The Sheet slides in from the right for both create and edit flows.
//
// UI Events:
// - action: openSheet(null) — "Legg til" button opens Sheet in create mode
// - action: openSheet(row) — table row click opens Sheet in edit mode
// - action: useCreateMealRule().mutate(values) — Sheet save (create)
// - action: useUpdateMealRule().mutate({ id, values }) — Sheet save (edit)
// - action: useDeleteMealRule().mutate({ id, name }) — delete button in Sheet footer
// - action: useUpdateMealRule().mutate({ id, values: { is_active: !current } }) — inline Switch
// - color-regime: meal_type badge (deduction=destructive, contribution=default)

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Loader2, Trash2 } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { createClient } from "@smartout/supabase/client";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import {
  useMealRules,
  useCreateMealRule,
  useUpdateMealRule,
  useDeleteMealRule,
  mealRuleSchema,
  type MealRuleRow,
  type MealRuleInput,
  type MealType,
} from "../_hooks/use-meal-rules";

// ─── Lookup types ─────────────────────────────────────────────────────────────

type LookupItem = { id: string; name: string };
type SalaryCodeItem = { id: string; code: string; name: string };

// ─── Inline lookup hooks ──────────────────────────────────────────────────────
// Each fetches only the fields needed for checkboxes/selects — not full rows.

function useDepartmentLookup() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  return useQuery({
    queryKey: ["lookup", "departments", wsId ?? "none"],
    queryFn: async (): Promise<LookupItem[]> => {
      const { data, error } = await supabase
        .from("department")
        .select("department_id, name")
        .eq("workspace_id", wsId!)
        .order("name", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map((d) => ({ id: d.department_id, name: d.name }));
    },
    enabled: !!wsId,
    staleTime: 10 * 60 * 1000,
  });
}

function useEmployeeGroupLookup() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  return useQuery({
    queryKey: ["lookup", "employee-groups", wsId ?? "none"],
    queryFn: async (): Promise<LookupItem[]> => {
      const { data, error } = await supabase
        .schema("payroll")
        .from("employee_group")
        .select("id, name")
        .eq("workspace_id", wsId!)
        .order("name", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as LookupItem[];
    },
    enabled: !!wsId,
    staleTime: 10 * 60 * 1000,
  });
}

function useShiftTypeLookup() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  return useQuery({
    queryKey: ["lookup", "shift-types", wsId ?? "none"],
    queryFn: async (): Promise<LookupItem[]> => {
      const { data, error } = await supabase
        .schema("payroll")
        .from("shift_type")
        .select("id, name")
        .eq("workspace_id", wsId!)
        .order("name", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as LookupItem[];
    },
    enabled: !!wsId,
    staleTime: 10 * 60 * 1000,
  });
}

function useSalaryCodeLookup() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  return useQuery({
    queryKey: ["lookup", "salary-codes-active", wsId ?? "none"],
    queryFn: async (): Promise<SalaryCodeItem[]> => {
      const { data, error } = await supabase
        .schema("payroll")
        .from("salary_code")
        .select("id, code, name")
        .eq("workspace_id", wsId!)
        .eq("is_active", true)
        .order("code", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as SalaryCodeItem[];
    },
    enabled: !!wsId,
    staleTime: 10 * 60 * 1000,
  });
}

// ─── Multi-select checkbox list ───────────────────────────────────────────────
// Reusable for departments, employee groups, and shift types in the Sheet.

type MultiCheckboxProps = {
  items: LookupItem[];
  selected: string[];
  onChange: (next: string[]) => void;
  emptyLabel: string;
};

function MultiCheckboxList({ items, selected, onChange, emptyLabel }: MultiCheckboxProps) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyLabel}</p>;
  }

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-2">
          <Checkbox
            id={`mc-${item.id}`}
            checked={selected.includes(item.id)}
            onCheckedChange={() => toggle(item.id)}
          />
          <Label htmlFor={`mc-${item.id}`} className="cursor-pointer text-sm font-normal">
            {item.name}
          </Label>
        </div>
      ))}
    </div>
  );
}

// ─── Loading skeleton ────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3">
            <Skeleton className="h-4 w-40 flex-1" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-5 w-9 rounded-full" />
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Sheet form ───────────────────────────────────────────────────────────────

type SheetMode = "create" | "edit";

type MealRuleSheetProps = {
  open: boolean;
  onClose: () => void;
  mode: SheetMode;
  initialValues?: MealRuleRow;
};

const DEFAULT_VALUES: MealRuleInput = {
  name: "",
  meal_type: "deduction",
  salary_code: null,
  amount: 0,
  min_shift_hours: 0,
  department_ids: [],
  employee_group_ids: [],
  shift_type_ids: [],
  is_active: true,
};

function MealRuleSheet({ open, onClose, mode, initialValues }: MealRuleSheetProps) {
  const createRule = useCreateMealRule();
  const updateRule = useUpdateMealRule();
  const deleteRule = useDeleteMealRule();

  const { data: departments = [] } = useDepartmentLookup();
  const { data: employeeGroups = [] } = useEmployeeGroupLookup();
  const { data: shiftTypes = [] } = useShiftTypeLookup();
  const { data: salaryCodes = [] } = useSalaryCodeLookup();

  const isEdit = mode === "edit";
  const isPending = createRule.isPending || updateRule.isPending;

  const form = useForm<MealRuleInput>({
    resolver: zodResolver(mealRuleSchema),
    defaultValues: DEFAULT_VALUES,
  });

  // Populate form on open — different values for create vs edit
  useEffect(() => {
    if (!open) return;
    if (isEdit && initialValues) {
      form.reset({
        name: initialValues.name,
        meal_type: initialValues.meal_type,
        salary_code: initialValues.salary_code,
        amount: initialValues.amount,
        min_shift_hours: initialValues.min_shift_hours,
        department_ids: initialValues.department_ids ?? [],
        employee_group_ids: initialValues.employee_group_ids ?? [],
        shift_type_ids: initialValues.shift_type_ids ?? [],
        is_active: initialValues.is_active,
      });
    } else {
      form.reset(DEFAULT_VALUES);
    }
  }, [open, isEdit, initialValues, form]);

  function onSubmit(values: MealRuleInput) {
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
        `Er du sikker på at du vil slette måltidsregelen "${initialValues.name}"? Dette kan ikke angres.`,
      )
    ) {
      return;
    }
    deleteRule.mutate({ id: initialValues.id, name: initialValues.name }, { onSuccess: onClose });
  }

  const errors = form.formState.errors;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Rediger måltidsregel" : "Ny måltidsregel"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Oppdater detaljene for denne måltidsregelen."
              : "Legg til en ny måltidsregel for arbeidsplassen."}
          </SheetDescription>
        </SheetHeader>

        <form
          id="meal-rule-form"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="flex-1 space-y-5 overflow-y-auto py-4"
        >
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="mr-name" className="text-sm font-medium">
              Navn
            </Label>
            <Input
              id="mr-name"
              placeholder="f.eks. Matpengefradrag kveldsvakt"
              {...form.register("name")}
            />
            {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
          </div>

          {/* Type — radio group: Fradrag or Bidrag */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Type</Label>
            <Controller
              control={form.control}
              name="meal_type"
              render={({ field }) => (
                <RadioGroup
                  value={field.value}
                  onValueChange={(v) => field.onChange(v as MealType)}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="deduction" id="mr-type-deduction" />
                    <Label htmlFor="mr-type-deduction" className="cursor-pointer font-normal">
                      Fradrag
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="contribution" id="mr-type-contribution" />
                    <Label htmlFor="mr-type-contribution" className="cursor-pointer font-normal">
                      Bidrag
                    </Label>
                  </div>
                </RadioGroup>
              )}
            />
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="mr-amount" className="text-sm font-medium">
              Beløp (kr)
            </Label>
            <Input
              id="mr-amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              {...form.register("amount")}
            />
            {errors.amount && <p className="text-destructive text-xs">{errors.amount.message}</p>}
          </div>

          {/* Min shift hours */}
          <div className="space-y-1.5">
            <Label htmlFor="mr-min-hours" className="text-sm font-medium">
              Minimum vakttimer
            </Label>
            <Input
              id="mr-min-hours"
              type="number"
              step="0.5"
              min="0"
              placeholder="0"
              {...form.register("min_shift_hours")}
            />
            {errors.min_shift_hours && (
              <p className="text-destructive text-xs">{errors.min_shift_hours.message}</p>
            )}
            <p className="text-muted-foreground text-xs">
              Regelen gjelder kun for vakter som er minst så lange.
            </p>
          </div>

          {/* Salary code */}
          <div className="space-y-1.5">
            <Label htmlFor="mr-salary-code" className="text-sm font-medium">
              Lønnart
            </Label>
            <Controller
              control={form.control}
              name="salary_code"
              render={({ field }) => (
                <Select
                  value={field.value ?? "__none__"}
                  onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                >
                  <SelectTrigger id="mr-salary-code" className="w-full">
                    <SelectValue placeholder="Ingen lønnart valgt" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Ingen</SelectItem>
                    {salaryCodes.map((sc) => (
                      <SelectItem key={sc.id} value={sc.id}>
                        {sc.code} — {sc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Departments — empty array means rule applies to all */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Avdelinger (tom = alle)</Label>
            <Controller
              control={form.control}
              name="department_ids"
              render={({ field }) => (
                <MultiCheckboxList
                  items={departments}
                  selected={field.value}
                  onChange={field.onChange}
                  emptyLabel="Ingen avdelinger opprettet ennå."
                />
              )}
            />
          </div>

          {/* Employee groups — empty array means rule applies to all */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Lønnsgrupper (tom = alle)</Label>
            <Controller
              control={form.control}
              name="employee_group_ids"
              render={({ field }) => (
                <MultiCheckboxList
                  items={employeeGroups}
                  selected={field.value}
                  onChange={field.onChange}
                  emptyLabel="Ingen lønnsgrupper opprettet ennå."
                />
              )}
            />
          </div>

          {/* Shift types — empty array means rule applies to all */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Vakttyper (tom = alle)</Label>
            <Controller
              control={form.control}
              name="shift_type_ids"
              render={({ field }) => (
                <MultiCheckboxList
                  items={shiftTypes}
                  selected={field.value}
                  onChange={field.onChange}
                  emptyLabel="Ingen vakttyper opprettet ennå."
                />
              )}
            />
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="mr-active" className="text-sm font-medium">
                Aktiv
              </Label>
              <p className="text-muted-foreground text-xs">
                Inaktive regler inkluderes ikke i lønnskjøringen.
              </p>
            </div>
            <Controller
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <Switch id="mr-active" checked={field.value} onCheckedChange={field.onChange} />
              )}
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
          <Button type="submit" form="meal-rule-form" disabled={isPending}>
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

// ─── Main component ───────────────────────────────────────────────────────────

export function MealRulesSettings() {
  const { data: rules = [], isLoading } = useMealRules();
  const updateRule = useUpdateMealRule();

  // Sheet state: undefined = closed, null = create mode, MealRuleRow = edit mode
  const [sheetRow, setSheetRow] = useState<MealRuleRow | null | undefined>(undefined);
  const sheetOpen = sheetRow !== undefined;

  function openCreate() {
    setSheetRow(null);
  }

  function openEdit(row: MealRuleRow) {
    setSheetRow(row);
  }

  function closeSheet() {
    setSheetRow(undefined);
  }

  // Inline active toggle — fires without opening the Sheet
  function handleToggleActive(row: MealRuleRow, checked: boolean) {
    updateRule.mutate({ id: row.id, values: { ...row, is_active: checked } });
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-6 w-40" />
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
          <h3 className="text-foreground text-lg font-semibold">Måltidsregler</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Definer regler for matpengefradrag og matpengebidrag som gjelder under lønnskjøringen.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          Legg til
        </Button>
      </div>

      {/* Table or empty state */}
      {rules.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16">
          <p className="text-muted-foreground text-sm">Ingen måltidsregler opprettet ennå.</p>
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
                <TableHead className="w-28">Type</TableHead>
                <TableHead className="w-24">Beløp</TableHead>
                <TableHead className="w-36">Lønnart</TableHead>
                <TableHead className="w-36">Min. vakttimer</TableHead>
                <TableHead className="w-16 text-right">Aktiv</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((row) => (
                <TableRow key={row.id} className="cursor-pointer" onClick={() => openEdit(row)}>
                  <TableCell className="text-sm font-medium">{row.name}</TableCell>
                  <TableCell>
                    {row.meal_type === "deduction" ? (
                      <Badge variant="destructive" className="text-xs">
                        Fradrag
                      </Badge>
                    ) : (
                      <Badge variant="default" className="text-xs">
                        Bidrag
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">kr {Number(row.amount).toFixed(2)}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-sm">
                    {row.salary_code ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {row.min_shift_hours > 0 ? `${row.min_shift_hours} t` : "—"}
                  </TableCell>
                  <TableCell
                    className="text-right"
                    // Stop row-click from opening the Sheet when toggling active
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
      <MealRuleSheet
        open={sheetOpen}
        onClose={closeSheet}
        mode={sheetRow === null ? "create" : "edit"}
        initialValues={sheetRow ?? undefined}
      />
    </div>
  );
}
