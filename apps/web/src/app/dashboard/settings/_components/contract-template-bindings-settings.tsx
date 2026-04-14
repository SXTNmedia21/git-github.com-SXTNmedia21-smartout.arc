"use client";

/**
 * ContractTemplateBindingsSettings — Matrix view of contract template bindings.
 *
 * Shows a grid with columns for each employment category (fast, deltid, tilkalling)
 * and rows for workspace default + each employee group.
 * Admins can create, edit, deactivate, and delete bindings from this panel.
 */

import { useState, useMemo, useCallback, useContext } from "react";
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Info,
} from "lucide-react";
import { Button, Badge, Label, Input, Card, CardContent, CardHeader, CardTitle, CardDescription } from "@smartout/ui";
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
  useAllBindings,
  useWorkspaceTemplates,
  useCreateTemplateBinding,
  useUpdateTemplateBinding,
  useDeleteTemplateBinding,
  type TemplateBindingRow,
  type WorkspaceTemplate,
} from "../_hooks/use-template-bindings";
import { useEmployeeGroups, type EmployeeGroupRow } from "../_hooks/use-employee-groups";
import { useTranslation } from "@smartout/i18n";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { emit } from "@smartout/telemetry";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES = ["fast", "deltid", "tilkalling"] as const;
type EmploymentCategory = (typeof CATEGORIES)[number];

const CATEGORY_I18N_MAP: Record<EmploymentCategory, string> = {
  fast: "template_bindings.category_fast",
  deltid: "template_bindings.category_deltid",
  tilkalling: "template_bindings.category_tilkalling",
};

// ---------------------------------------------------------------------------
// CategoryBindSheet — create/edit binding for a cell
// ---------------------------------------------------------------------------

type SheetMode =
  | { type: "create"; groupId: string | null; category: EmploymentCategory }
  | { type: "edit"; binding: TemplateBindingRow };

type CategoryBindSheetProps = {
  open: boolean;
  onClose: () => void;
  mode: SheetMode | null;
  templates: WorkspaceTemplate[];
};

function CategoryBindSheet({ open, onClose, mode, templates }: CategoryBindSheetProps) {
  const { t } = useTranslation("dashboard");
  const createBinding = useCreateTemplateBinding();
  const updateBinding = useUpdateTemplateBinding();

  const isEdit = mode?.type === "edit";
  const existingBinding = isEdit ? mode.binding : null;

  const [templateId, setTemplateId] = useState<string>("");
  const [priority, setPriority] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(true);

  // Reset state when mode changes
  const modeKey = mode?.type === "edit" ? mode.binding.id : mode?.type === "create" ? `${mode.groupId}-${mode.category}` : "";

  useMemo(() => {
    if (mode?.type === "edit") {
      setTemplateId(mode.binding.template_id);
      setPriority(mode.binding.priority);
      setIsActive(mode.binding.is_active);
    } else {
      setTemplateId("");
      setPriority(0);
      setIsActive(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeKey]);

  const category = mode?.type === "create" ? mode.category : (existingBinding?.employment_category as EmploymentCategory | undefined);
  const filteredTemplates = useMemo(() => {
    return templates.filter(
      (tpl) => !category || !tpl.employment_category || tpl.employment_category === category,
    );
  }, [templates, category]);

  const isPending = createBinding.isPending || updateBinding.isPending;

  function handleSubmit() {
    if (!templateId || !mode) return;

    if (mode.type === "create") {
      createBinding.mutate(
        {
          template_id: templateId,
          employment_category: mode.category,
          employee_group_id: mode.groupId,
          priority,
        },
        {
          onSuccess: () => {
            toast.success(t("template_bindings.toast_created"));
            onClose();
          },
        },
      );
    } else {
      updateBinding.mutate(
        {
          id: mode.binding.id,
          template_id: templateId,
          priority,
          is_active: isActive,
        },
        {
          onSuccess: () => {
            toast.success(t("template_bindings.toast_updated"));
            onClose();
          },
        },
      );
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {isEdit
              ? t("template_bindings.sheet_title_edit")
              : t("template_bindings.sheet_title_create")}
          </SheetTitle>
          <SheetDescription>
            {category ? t(CATEGORY_I18N_MAP[category]) : null}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 py-4">
          <div className="space-y-1.5">
            <Label>{t("template_bindings.category_label")}</Label>
            <div className="text-muted-foreground text-sm">
              {category ? t(CATEGORY_I18N_MAP[category]) : "-"}
            </div>

          </div>

          <div className="space-y-1.5">
            <Label>{t("template_bindings.template_label")}</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="..." />
              </SelectTrigger>
              <SelectContent>
                {filteredTemplates.map((tpl) => (
                  <SelectItem key={tpl.template_id} value={tpl.template_id}>
                    {tpl.name}
                    {tpl.is_system && " (system)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t("template_bindings.priority_label")}</Label>
            <Input
              type="number"
              min={0}
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
            />
            <p className="text-muted-foreground text-xs">
              {t("template_bindings.priority_hint")}
            </p>
          </div>

          {isEdit && (
            <div className="flex items-center gap-3">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>{t("template_bindings.active_label")}</Label>
            </div>
          )}
        </div>

        <SheetFooter className="flex-row gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            {t("template_bindings.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={!templateId || isPending}>
            {isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            {isPending ? t("template_bindings.saving") : t("template_bindings.save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// ResolutionOrderCallout
// ---------------------------------------------------------------------------

function ResolutionOrderCallout() {
  const { t } = useTranslation("dashboard");

  return (
    <Card className="border-muted bg-muted/30">
      <CardContent className="flex items-start gap-3 p-4">
        <Info className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="text-sm font-medium">{t("template_bindings.resolution_order_title")}</p>
          <p className="text-muted-foreground text-xs">
            {t("template_bindings.resolution_order_description")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// BindingCell — single cell in the matrix
// ---------------------------------------------------------------------------

type BindingCellProps = {
  binding: TemplateBindingRow | undefined;
  category: EmploymentCategory;
  groupId: string | null;
  onEdit: (binding: TemplateBindingRow) => void;
  onCreate: (groupId: string | null, category: EmploymentCategory) => void;
  onDelete: (binding: TemplateBindingRow) => void;
  onToggleActive: (binding: TemplateBindingRow) => void;
  isDeleting: boolean;
  isUpdating: boolean;
};

function BindingCell({
  binding,
  category,
  groupId,
  onEdit,
  onCreate,
  onDelete,
  onToggleActive,
  isDeleting,
  isUpdating,
}: BindingCellProps) {
  const { t } = useTranslation("dashboard");

  if (!binding) {
    return (
      <div className="flex min-h-[56px] flex-col items-center justify-center rounded-lg border border-dashed p-2">
        <span className="text-muted-foreground mb-1 text-xs">
          {t("template_bindings.no_binding")}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs"
          onClick={() => onCreate(groupId, category)}
        >
          <Plus className="mr-1 h-3 w-3" />
          {t("template_bindings.bind_template")}
        </Button>
      </div>
    );
  }

  return (
    <div
      className={`flex min-h-[56px] flex-col justify-between rounded-lg border p-2 ${
        binding.is_active ? "" : "opacity-50"
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="text-sm leading-tight">
          {binding.contract_template?.name ?? "?"}
        </span>
        <div className="flex shrink-0 gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => onEdit(binding)}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => onDelete(binding)}
            disabled={isDeleting}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div className="mt-1 flex items-center gap-2">
        {binding.contract_template?.is_system && (
          <Badge variant="outline" className="text-[10px]">
            System
          </Badge>
        )}
        {binding.priority > 0 && (
          <span className="text-muted-foreground text-[10px]">
            P{binding.priority}
          </span>
        )}
        <button
          type="button"
          className="ml-auto text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => onToggleActive(binding)}
          disabled={isUpdating}
        >
          {binding.is_active
            ? t("template_bindings.deactivate")
            : t("template_bindings.activate")}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BindingMatrix — the full grid
// ---------------------------------------------------------------------------

function BindingMatrix({
  bindings,
  groups,
  templates,
}: {
  bindings: TemplateBindingRow[];
  groups: EmployeeGroupRow[];
  templates: WorkspaceTemplate[];
}) {
  const { t } = useTranslation("dashboard");
  const deleteBinding = useDeleteTemplateBinding();
  const updateBinding = useUpdateTemplateBinding();
  const [sheetMode, setSheetMode] = useState<SheetMode | null>(null);

  // Index bindings by groupId+category
  const bindingMap = useMemo(() => {
    const map = new Map<string, TemplateBindingRow>();
    for (const b of bindings) {
      const key = `${b.employee_group_id ?? "ws"}-${b.employment_category}`;
      map.set(key, b);
    }
    return map;
  }, [bindings]);

  const getBinding = useCallback(
    (groupId: string | null, category: EmploymentCategory) => {
      return bindingMap.get(`${groupId ?? "ws"}-${category}`);
    },
    [bindingMap],
  );

  const handleEdit = useCallback((binding: TemplateBindingRow) => {
    setSheetMode({ type: "edit", binding });
  }, []);

  const handleCreate = useCallback(
    (groupId: string | null, category: EmploymentCategory) => {
      setSheetMode({ type: "create", groupId, category });
    },
    [],
  );

  const handleDelete = useCallback(
    (binding: TemplateBindingRow) => {
      deleteBinding.mutate(
        { id: binding.id, groupId: binding.employee_group_id ?? undefined },
        {
          onSuccess: () => {
            toast.success(t("template_bindings.toast_deleted"));
          },
        },
      );
    },
    [deleteBinding, t],
  );

  const handleToggleActive = useCallback(
    (binding: TemplateBindingRow) => {
      const newActive = !binding.is_active;
      updateBinding.mutate(
        { id: binding.id, is_active: newActive },
        {
          onSuccess: () => {
            toast.success(
              newActive
                ? t("template_bindings.toast_activated")
                : t("template_bindings.toast_deactivated"),
            );
          },
        },
      );
    },
    [updateBinding, t],
  );

  // Build rows: workspace default + each group
  const rows: { id: string | null; label: string }[] = useMemo(() => {
    const result: { id: string | null; label: string }[] = [
      { id: null, label: t("template_bindings.workspace_default_row") },
    ];
    for (const g of groups) {
      result.push({ id: g.id, label: g.name });
    }
    return result;
  }, [groups, t]);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-muted-foreground w-48 p-2 text-left text-xs font-medium" />
              {CATEGORIES.map((cat) => (
                <th
                  key={cat}
                  className="text-muted-foreground p-2 text-center text-xs font-medium"
                >
                  {t(CATEGORY_I18N_MAP[cat])}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id ?? "ws"} className="border-t">
                <td className="p-2 text-sm font-medium">
                  {row.label}
                </td>
                {CATEGORIES.map((cat) => (
                  <td key={cat} className="p-2">
                    <BindingCell
                      binding={getBinding(row.id, cat)}
                      category={cat}
                      groupId={row.id}
                      onEdit={handleEdit}
                      onCreate={handleCreate}
                      onDelete={handleDelete}
                      onToggleActive={handleToggleActive}
                      isDeleting={deleteBinding.isPending}
                      isUpdating={updateBinding.isPending}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CategoryBindSheet
        open={!!sheetMode}
        onClose={() => setSheetMode(null)}
        mode={sheetMode}
        templates={templates}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function ContractTemplateBindingsSettings() {
  const { t } = useTranslation("dashboard");
  const { data: bindings = [], isLoading: bindingsLoading } = useAllBindings();
  const { data: templates = [] } = useWorkspaceTemplates();
  const { data: groups = [], isLoading: groupsLoading } = useEmployeeGroups();

  const isLoading = bindingsLoading || groupsLoading;

  if (isLoading) {
    return (
      <div className="text-muted-foreground px-1 py-6 text-sm">
        {t("template_bindings.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-foreground text-lg font-semibold">
          {t("template_bindings.title")}
        </h2>
        <p className="text-muted-foreground text-sm">
          {t("template_bindings.description")}
        </p>
      </div>

      <ResolutionOrderCallout />

      <Card>
        <CardContent className="p-0">
          <BindingMatrix
            bindings={bindings}
            groups={groups}
            templates={templates}
          />
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-xs">
        {t("template_bindings.system_fallback_hint")}
      </p>
    </div>
  );
}
