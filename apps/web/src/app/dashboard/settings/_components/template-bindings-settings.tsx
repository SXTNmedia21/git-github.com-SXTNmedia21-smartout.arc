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
import {
  useTemplateBindings,
  useWorkspaceTemplates,
  useCreateTemplateBinding,
  useDeleteTemplateBinding,
  useCopySystemTemplate,
  type TemplateBindingRow,
  type WorkspaceTemplate,
} from "../_hooks/use-template-bindings";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  fast: "Fast ansatt",
  deltid: "Deltid",
  tilkalling: "Tilkalling",
};

const CATEGORIES = ["fast", "deltid", "tilkalling"] as const;

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
  const createBinding = useCreateTemplateBinding();
  const [category, setCategory] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("");

  const availableCategories = CATEGORIES.filter((c) => !existingCategories.has(c));
  const filteredTemplates = templates.filter(
    (t) => !category || !t.employment_category || t.employment_category === category,
  );

  function handleSubmit() {
    if (!category || !templateId) return;
    createBinding.mutate(
      { template_id: templateId, employment_category: category, employee_group_id: groupId },
      {
        onSuccess: () => {
          setCategory("");
          setTemplateId("");
          onClose();
        },
      },
    );
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Knytt kontraktmal</SheetTitle>
          <SheetDescription>
            Velg ansettelsesform og kontraktmal for denne lønnsgruppen.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 py-4">
          <div className="space-y-1.5">
            <Label>Ansettelsesform</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Velg..." />
              </SelectTrigger>
              <SelectContent>
                {availableCategories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Kontraktmal</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Velg mal..." />
              </SelectTrigger>
              <SelectContent>
                {filteredTemplates.map((t) => (
                  <SelectItem key={t.template_id} value={t.template_id}>
                    {t.name}
                    {t.is_system && " (system)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <SheetFooter className="flex-row gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            Avbryt
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!category || !templateId || createBinding.isPending}
          >
            {createBinding.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Knytt mal
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
          <SheetTitle>Kopier systemmal</SheetTitle>
          <SheetDescription>
            Lag en redigerbar kopi av «{template?.name}» for arbeidsområdet ditt.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-4 py-4">
          <div className="space-y-1.5">
            <Label>Navn på kopi</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={template ? `${template.name} (kopi)` : ""}
            />
          </div>
        </div>
        <SheetFooter className="flex-row gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            Avbryt
          </Button>
          <Button onClick={handleCopy} disabled={!name || copyTemplate.isPending}>
            {copyTemplate.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Kopier
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
  const { data: bindings = [], isLoading } = useTemplateBindings(groupId);
  const { data: templates = [] } = useWorkspaceTemplates();
  const deleteBinding = useDeleteTemplateBinding();
  const [bindSheetOpen, setBindSheetOpen] = useState(false);
  const [copyTarget, setCopyTarget] = useState<WorkspaceTemplate | null>(null);

  const existingCategories = new Set(bindings.map((b) => b.employment_category));
  const systemTemplates = templates.filter((t) => t.is_system);

  if (isLoading) {
    return <div className="text-muted-foreground px-4 py-3 text-sm">Laster maler...</div>;
  }

  return (
    <div className="border-t px-4 py-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="text-muted-foreground h-4 w-4" />
          <span className="text-sm font-medium">Kontraktmaler</span>
        </div>
        <div className="flex gap-1.5">
          {systemTemplates.length > 0 && (
            <Select
              onValueChange={(id) =>
                setCopyTarget(systemTemplates.find((t) => t.template_id === id) ?? null)
              }
            >
              <SelectTrigger className="h-7 w-auto gap-1.5 text-xs">
                <Copy className="h-3 w-3" />
                <SelectValue placeholder="Kopier systemmal" />
              </SelectTrigger>
              <SelectContent>
                {systemTemplates.map((t) => (
                  <SelectItem key={t.template_id} value={t.template_id}>
                    {t.name}
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
            Knytt mal
          </Button>
        </div>
      </div>

      {bindings.length === 0 ? (
        <p className="text-muted-foreground py-2 text-xs">
          Ingen maler knyttet. Kontrakten vil bruke systemmalen basert på ansettelsesform.
        </p>
      ) : (
        <div className="space-y-1.5">
          {bindings.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {CATEGORY_LABELS[b.employment_category] ?? b.employment_category}
                </Badge>
                <span className="text-sm">{b.contract_template?.name ?? "Ukjent mal"}</span>
                {b.contract_template?.is_system && (
                  <Badge variant="outline" className="text-xs">
                    System
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => deleteBinding.mutate({ id: b.id, groupId })}
                disabled={deleteBinding.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
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
