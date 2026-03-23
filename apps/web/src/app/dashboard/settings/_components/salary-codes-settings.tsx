"use client";

// DataTable + Sheet editor for payroll.salary_code (lønnsarter).
// Admins can create, edit, toggle active status, and delete codes.
// The Sheet slides in from the right for both create and edit flows.
//
// UI Events:
// - action: openSheet(null) — "Legg til" button opens Sheet in create mode
// - action: openSheet(row) — table row click opens Sheet in edit mode
// - action: useCreateSalaryCode().mutate(values) — Sheet save (create)
// - action: useUpdateSalaryCode().mutate({ id, values }) — Sheet save (edit)
// - action: useDeleteSalaryCode().mutate({ id, code }) — delete button in Sheet footer
// - action: useUpdateSalaryCode().mutate({ id, values: { is_active: !current } }) — inline Switch toggle

import { useState, useEffect, useContext } from "react";
import { useForm } from "react-hook-form";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  useSalaryCodes,
  useCreateSalaryCode,
  useUpdateSalaryCode,
  useDeleteSalaryCode,
  salaryCodeSchema,
  SALARY_CODE_CATEGORIES,
  type SalaryCodeRow,
  type SalaryCodeInput,
  type SalaryCodeCategory,
} from "../_hooks/use-salary-codes";

// ─── Category display config ──────────────────────────────────────────────────
// Maps DB enum values to Norwegian labels and badge variant names.
// Badge variants match shadcn/ui: default | secondary | destructive | outline

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const CATEGORY_CONFIG: Record<SalaryCodeCategory, { label: string; variant: BadgeVariant }> = {
  worked_hours: { label: "Ordinær timelønn", variant: "secondary" },
  supplement: { label: "Tillegg", variant: "outline" },
  overtime: { label: "Overtid", variant: "default" },
  absence: { label: "Fravær", variant: "secondary" },
  deduction: { label: "Trekk", variant: "destructive" },
  monthly_salary: { label: "Månedslønn", variant: "secondary" },
};

// ─── Loading skeleton ────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-40 flex-1" />
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-9 rounded-full" />
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Sheet form ───────────────────────────────────────────────────────────────

type SheetMode = "create" | "edit";

type SalaryCodeSheetProps = {
  open: boolean;
  onClose: () => void;
  mode: SheetMode;
  initialValues?: SalaryCodeRow;
};

function SalaryCodeSheet({ open, onClose, mode, initialValues }: SalaryCodeSheetProps) {
  const createCode = useCreateSalaryCode();
  const updateCode = useUpdateSalaryCode();
  const deleteCode = useDeleteSalaryCode();

  const isEdit = mode === "edit";
  const isPending = createCode.isPending || updateCode.isPending;

  const form = useForm<SalaryCodeInput>({
    resolver: zodResolver(salaryCodeSchema),
    defaultValues: {
      code: "",
      name: "",
      description: null,
      external_code: null,
      category: "worked_hours",
      a_melding_code: null,
      is_active: true,
    },
  });

  // Populate form when editing an existing row
  useEffect(() => {
    if (open) {
      if (isEdit && initialValues) {
        form.reset({
          code: initialValues.code,
          name: initialValues.name,
          description: initialValues.description,
          external_code: initialValues.external_code,
          category: initialValues.category as SalaryCodeCategory,
          a_melding_code: initialValues.a_melding_code,
          is_active: initialValues.is_active,
        });
      } else {
        form.reset({
          code: "",
          name: "",
          description: null,
          external_code: null,
          category: "worked_hours",
          a_melding_code: null,
          is_active: true,
        });
      }
    }
  }, [open, isEdit, initialValues, form]);

  function onSubmit(values: SalaryCodeInput) {
    if (isEdit && initialValues) {
      updateCode.mutate({ id: initialValues.id, values }, { onSuccess: onClose });
    } else {
      createCode.mutate(values, { onSuccess: onClose });
    }
  }

  function handleDelete() {
    if (!initialValues) return;
    if (
      !window.confirm(
        `Er du sikker på at du vil slette lønnsart "${initialValues.code} — ${initialValues.name}"? Dette kan ikke angres.`,
      )
    ) {
      return;
    }
    deleteCode.mutate({ id: initialValues.id, code: initialValues.code }, { onSuccess: onClose });
  }

  const errors = form.formState.errors;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Rediger lønnsart" : "Ny lønnsart"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Oppdater detaljene for denne lønnsarten."
              : "Legg til en ny lønnsart for arbeidsplassen."}
          </SheetDescription>
        </SheetHeader>

        <form
          id="salary-code-form"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="flex-1 space-y-4 overflow-y-auto py-4"
        >
          {/* Code */}
          <div className="space-y-1.5">
            <Label htmlFor="sc-code" className="text-sm font-medium">
              Kode
            </Label>
            <Input
              id="sc-code"
              placeholder="f.eks. 100"
              className="font-mono"
              {...form.register("code")}
            />
            {errors.code && <p className="text-destructive text-xs">{errors.code.message}</p>}
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="sc-name" className="text-sm font-medium">
              Navn
            </Label>
            <Input id="sc-name" placeholder="f.eks. Ordinær timelønn" {...form.register("name")} />
            {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="sc-description" className="text-sm font-medium">
              Beskrivelse
            </Label>
            <Textarea
              id="sc-description"
              placeholder="Valgfri beskrivelse..."
              rows={3}
              {...form.register("description")}
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label htmlFor="sc-category" className="text-sm font-medium">
              Kategori
            </Label>
            <Select
              value={form.watch("category")}
              onValueChange={(v) =>
                form.setValue("category", v as SalaryCodeCategory, { shouldDirty: true })
              }
            >
              <SelectTrigger id="sc-category" className="w-full">
                <SelectValue placeholder="Velg kategori" />
              </SelectTrigger>
              <SelectContent>
                {SALARY_CODE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {CATEGORY_CONFIG[cat].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && (
              <p className="text-destructive text-xs">{errors.category.message}</p>
            )}
          </div>

          {/* External code (Tripletex) */}
          <div className="space-y-1.5">
            <Label htmlFor="sc-external" className="text-sm font-medium">
              Ekstern kode (Tripletex)
            </Label>
            <Input
              id="sc-external"
              placeholder="f.eks. 1001"
              className="font-mono"
              {...form.register("external_code")}
            />
          </div>

          {/* A-melding code */}
          <div className="space-y-1.5">
            <Label htmlFor="sc-amelding" className="text-sm font-medium">
              A-melding kode
            </Label>
            <Input
              id="sc-amelding"
              placeholder="f.eks. timeloenn"
              className="font-mono"
              {...form.register("a_melding_code")}
            />
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="sc-active" className="text-sm font-medium">
                Aktiv
              </Label>
              <p className="text-muted-foreground text-xs">
                Inaktive lønnsarter er skjult fra valglister.
              </p>
            </div>
            <Switch
              id="sc-active"
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
              disabled={deleteCode.isPending}
              onClick={handleDelete}
              className="mr-auto"
            >
              {deleteCode.isPending ? (
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
          <Button type="submit" form="salary-code-form" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Lagrer...
              </>
            ) : isEdit ? (
              "Lagre endringer"
            ) : (
              "Opprett lønnsart"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SalaryCodesSettings() {
  const { data: codes = [], isLoading } = useSalaryCodes();
  const updateCode = useUpdateSalaryCode();

  // Sheet state: null = closed, undefined = create mode, SalaryCodeRow = edit mode
  const [sheetRow, setSheetRow] = useState<SalaryCodeRow | null | undefined>(undefined);
  const sheetOpen = sheetRow !== undefined;

  function openCreate() {
    setSheetRow(null);
  }

  function openEdit(row: SalaryCodeRow) {
    setSheetRow(row);
  }

  function closeSheet() {
    setSheetRow(undefined);
  }

  // Inline active toggle — fires without opening the Sheet
  function handleToggleActive(row: SalaryCodeRow, checked: boolean) {
    updateCode.mutate({
      id: row.id,
      values: { ...row, category: row.category as SalaryCodeCategory, is_active: checked },
    });
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
        <TableSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-foreground text-lg font-semibold">Lønnsarter</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Definer lønnsartene som brukes i lønnskjøringen. Koder kan mappes til Tripletex og
            A-melding.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          Legg til
        </Button>
      </div>

      {/* Table */}
      {codes.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16">
          <p className="text-muted-foreground text-sm">Ingen lønnsarter opprettet ennå.</p>
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
                <TableHead className="w-24">Kode</TableHead>
                <TableHead>Navn</TableHead>
                <TableHead className="w-40">Kategori</TableHead>
                <TableHead className="w-32">Ekstern kode</TableHead>
                <TableHead className="w-32">A-melding</TableHead>
                <TableHead className="w-16 text-right">Aktiv</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {codes.map((row) => {
                const category = CATEGORY_CONFIG[row.category as SalaryCodeCategory];
                return (
                  <TableRow key={row.id} className="cursor-pointer" onClick={() => openEdit(row)}>
                    <TableCell className="font-mono text-sm font-medium">{row.code}</TableCell>
                    <TableCell className="text-sm">{row.name}</TableCell>
                    <TableCell>
                      {category ? (
                        <Badge variant={category.variant} className="text-xs">
                          {category.label}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">{row.category}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {row.external_code ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {row.a_melding_code ?? "—"}
                    </TableCell>
                    <TableCell
                      className="text-right"
                      // Prevent row click from opening the Sheet when toggling active
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Switch
                        checked={row.is_active}
                        onCheckedChange={(checked) => handleToggleActive(row, checked)}
                        disabled={updateCode.isPending}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Sheet — shared for create and edit */}
      <SalaryCodeSheet
        open={sheetOpen}
        onClose={closeSheet}
        mode={sheetRow === null ? "create" : "edit"}
        initialValues={sheetRow ?? undefined}
      />
    </div>
  );
}
