"use client";

/**
 * TemplateBindingsPanel — Displays and manages contract template bindings
 * for a specific employee group. Rendered inside expanded GroupCard.
 *
 * Shows one binding per employment_category. Admin picks a template from
 * workspace or system templates and binds it to the group.
 */

import { useState } from "react";
import { FileText, Plus, Trash2, Loader2, Copy } from "lucide-react";
import { Button, Badge, Label, Input } from "@smartout/ui";
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
  useTemplateBindings,
  useWorkspaceTemplates,
  useCreateTemplateBinding,
  useDeleteTemplateBinding,
  useUpdateTemplateBinding,
  useCopySystemTemplate,
  type TemplateBindingRow,
  type WorkspaceTemplate,
} from "../_hooks/use-template-bindings";
import { useTranslation } from "@smartout/i18n";
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
// Bind Sheet
// ---------------------------------------------------------------------------

type BindSheetProps = {
  open: boolean;
  onClose: () => void;
  groupId: string;
  templates: WorkspaceTemplate[];
  existingCategories: Set<string>;
};

function BindSheet({ open, onClose, groupId, templates, existingCategories }: BindSheetProps) {
  const { t } = useTranslation("dashboard");
  const createBinding = useCreateTemplateBinding();
  const [category, setCategory] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("");
  const [priority, setPriority] = useState<number>(0);

  const availableCategories = CATEGORIES.filter((c) => !existingCategories.has(c));
  const filteredTemplates = templates.filter(
    (tpl) => !category || !tpl.employment_category || tpl.employment_category === category,
  );

  function handleSubmit() {
    if (!category || !templateId) return;
    createBinding.mutate(
      {
        template_id: templateId,
        employment_category: category,
        employee_group_id: groupId,
        priority,
      },
      {
        onSuccess: () => {
          toast.success(t("template_bindings.toast_created"));
          setCategory("");
          setTemplateId("");
          setPriority(0);
          onClose();
        },
      },
    );
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("template_bindings.sheet_title_create")}</SheetTitle>
          <SheetDescription>
            {t("template_bindings.description")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 py-4">
          <div className="space-y-1.5">
            <Label>{t("template_bindings.category_label")}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="..." />
              </SelectTrigger>
              <SelectContent>
                {availableCategories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {t(CATEGORY_I18N_MAP[c])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
        </div>

        <SheetFooter className="flex-row gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            {t("template_bindings.cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!category || !templateId || createBinding.isPending}
          >
            {createBinding.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : null}
            {createBinding.isPending
              ? t("template_bindings.saving")
              : t("template_bindings.save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Copy Template Sheet
// ---------------------------------------------------------------------------

type CopySheetProps = {
  open: boolean;
  onClose: () => void;
  template: WorkspaceTemplate | null;
};

function CopyTemplateSheet({ open, onClose, template }: CopySheetProps) {
  const { t } = useTranslation("dashboard");
  const copyTemplate = useCopySystemTemplate();
  const [name, setName] = useState("");

  function handleCopy() {
    if (!template || !name) return;
    copyTemplate.mutate(
      { system_template_id: template.template_id, name },
      {
        onSuccess: () => {
          setName("");
          onClose();
        },
      },
    );
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("template_bindings.sheet_title_create")}</SheetTitle>
          <SheetDescription>
            {template?.name}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-4 py-4">
          <div className="space-y-1.5">
            <Label>{t("template_bindings.template_label")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={template ? `${template.name} (kopi)` : ""}
            />
          </div>
        </div>
        <SheetFooter className="flex-row gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            {t("template_bindings.cancel")}
          </Button>
          <Button onClick={handleCopy} disabled={!name || copyTemplate.isPending}>
            {copyTemplate.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : null}
            {t("template_bindings.save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Main Panel
// ---------------------------------------------------------------------------

type TemplateBindingsPanelProps = {
  groupId: string;
};

export function TemplateBindingsPanel({ groupId }: TemplateBindingsPanelProps) {
  const { t } = useTranslation("dashboard");
  const { data: bindings = [], isLoading } = useTemplateBindings(groupId);
  const { data: templates = [] } = useWorkspaceTemplates();
  const deleteBinding = useDeleteTemplateBinding();
  const updateBinding = useUpdateTemplateBinding();
  const [bindSheetOpen, setBindSheetOpen] = useState(false);
  const [copyTarget, setCopyTarget] = useState<WorkspaceTemplate | null>(null);

  const existingCategories = new Set(bindings.map((b) => b.employment_category));
  const systemTemplates = templates.filter((tpl) => tpl.is_system);

  function handleToggleActive(binding: TemplateBindingRow) {
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
  }

  if (isLoading) {
    return (
      <div className="text-muted-foreground px-4 py-3 text-sm">
        {t("template_bindings.loading")}
      </div>
    );
  }

  return (
    <div className="border-t px-4 py-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="text-muted-foreground h-4 w-4" />
          <span className="text-sm font-medium">{t("template_bindings.title")}</span>
        </div>
        <div className="flex gap-1.5">
          {systemTemplates.length > 0 && (
            <Select
              onValueChange={(id) =>
                setCopyTarget(systemTemplates.find((tpl) => tpl.template_id === id) ?? null)
              }
            >
              <SelectTrigger className="h-7 w-auto gap-1.5 text-xs">
                <Copy className="h-3 w-3" />
                <SelectValue placeholder="..." />
              </SelectTrigger>
              <SelectContent>
                {systemTemplates.map((tpl) => (
                  <SelectItem key={tpl.template_id} value={tpl.template_id}>
                    {tpl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setBindSheetOpen(true)}
          >
            <Plus className="mr-1 h-3 w-3" />
            {t("template_bindings.bind_template")}
          </Button>
        </div>
      </div>

      {bindings.length === 0 ? (
        <p className="text-muted-foreground py-2 text-xs">
          {t("template_bindings.system_fallback_hint")}
        </p>
      ) : (
        <div className="space-y-1.5">
          {bindings.map((b) => (
            <div
              key={b.id}
              className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                b.is_active ? "" : "opacity-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {t(CATEGORY_I18N_MAP[b.employment_category as EmploymentCategory] ?? b.employment_category)}
                </Badge>
                <span className="text-sm">{b.contract_template?.name ?? "?"}</span>
                {b.contract_template?.is_system && (
                  <Badge variant="outline" className="text-xs">
                    System
                  </Badge>
                )}
                {b.priority > 0 && (
                  <span className="text-muted-foreground text-xs">P{b.priority}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={b.is_active}
                  onCheckedChange={() => handleToggleActive(b)}
                  disabled={updateBinding.isPending}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() =>
                    deleteBinding.mutate(
                      { id: b.id, groupId },
                      {
                        onSuccess: () => {
                          toast.success(t("template_bindings.toast_deleted"));
                        },
                      },
                    )
                  }
                  disabled={deleteBinding.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <BindSheet
        open={bindSheetOpen}
        onClose={() => setBindSheetOpen(false)}
        groupId={groupId}
        templates={templates}
        existingCategories={existingCategories}
      />

      <CopyTemplateSheet
        open={!!copyTarget}
        onClose={() => setCopyTarget(null)}
        template={copyTarget}
      />
    </div>
  );
}
