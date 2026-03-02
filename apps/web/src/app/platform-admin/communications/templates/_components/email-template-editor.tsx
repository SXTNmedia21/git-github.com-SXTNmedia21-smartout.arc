"use client";

import { useState, useCallback, useEffect } from "react";
import {
  ArrowLeft,
  Save,
  Loader2,
  Upload,
  Plus,
  GripVertical,
  Trash2,
  Type,
  AlignLeft,
  ImageIcon,
  List,
  Code,
  Minus,
  MousePointerClick,
  PanelBottom,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type {
  SaveEmailTemplateData,
  EmailTemplateSection,
  EmailTemplatePlaceholder,
} from "../[id]/edit/save-action";
import { SectionBlock } from "./section-block";
import { EmailTemplatePreview } from "./email-template-preview";

type EmailTemplateEditorProps = {
  templateId: string;
  initialData: {
    name: string;
    category: string;
    subject: string;
    sections: EmailTemplateSection[];
    placeholders: EmailTemplatePlaceholder[];
    status: string;
  };
  onSave: (data: SaveEmailTemplateData) => Promise<{ templateId: string }>;
};

const SECTION_TYPES = [
  { type: "title" as const, label: "Title", icon: Type, placeholder: "Section title..." },
  {
    type: "message" as const,
    label: "Message",
    icon: AlignLeft,
    placeholder: "<p>Write your message...</p>",
  },
  { type: "image" as const, label: "Image", icon: ImageIcon, placeholder: "" },
  { type: "list" as const, label: "List", icon: List, placeholder: "" },
  { type: "html" as const, label: "HTML", icon: Code, placeholder: "<div>Custom HTML...</div>" },
  { type: "button" as const, label: "Button", icon: MousePointerClick, placeholder: "" },
  { type: "divider" as const, label: "Divider", icon: Minus, placeholder: "" },
  {
    type: "footer" as const,
    label: "Footer",
    icon: PanelBottom,
    placeholder: "<p>Footer content...</p>",
  },
] as const;

const CATEGORIES = [
  { value: "trial", label: "Trial" },
  { value: "newsletter", label: "Newsletter" },
  { value: "alert", label: "Alert" },
  { value: "announcement", label: "Announcement" },
  { value: "custom", label: "Custom" },
];

export function EmailTemplateEditor({ templateId, initialData, onSave }: EmailTemplateEditorProps) {
  const [name, setName] = useState(initialData.name);
  const [category, setCategory] = useState(initialData.category);
  const [subject, setSubject] = useState(initialData.subject);
  const [sections, setSections] = useState<EmailTemplateSection[]>(initialData.sections);
  const [placeholders, setPlaceholders] = useState<EmailTemplatePlaceholder[]>(
    initialData.placeholders,
  );
  const [status, setStatus] = useState(initialData.status);

  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [showPreview, setShowPreview] = useState(true);

  // Placeholder management
  const [newPlaceholderKey, setNewPlaceholderKey] = useState("");

  const markDirty = useCallback(() => setIsDirty(true), []);

  const handleSave = useCallback(
    async (newStatus?: string) => {
      setIsSaving(true);
      try {
        await onSave({
          name: name.trim() || "Untitled Template",
          category,
          subject,
          sections,
          placeholders,
          status: newStatus ?? status,
        });
        if (newStatus) setStatus(newStatus);
        setIsDirty(false);
        setLastSavedAt(new Date());
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not save template";
        if (message.includes("NEXT_REDIRECT")) return;
        alert(message);
      } finally {
        setIsSaving(false);
      }
    },
    [name, category, subject, sections, placeholders, status, onSave],
  );

  // Ctrl+S
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave]);

  // Section operations
  function addSection(type: EmailTemplateSection["type"]) {
    const config = SECTION_TYPES.find((s) => s.type === type);
    const newSection: EmailTemplateSection = {
      id: crypto.randomUUID(),
      type,
      content: config?.placeholder ?? "",
    };
    if (type === "list") newSection.items = ["Item 1", "Item 2"];
    if (type === "button") {
      newSection.buttonText = "Click here";
      newSection.buttonUrl = "https://";
    }
    if (type === "image") {
      newSection.imageUrl = "";
      newSection.imageAlt = "";
    }
    setSections((prev) => [...prev, newSection]);
    markDirty();
  }

  function updateSection(id: string, updates: Partial<EmailTemplateSection>) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    markDirty();
  }

  function removeSection(id: string) {
    setSections((prev) => prev.filter((s) => s.id !== id));
    markDirty();
  }

  function moveSection(id: string, direction: "up" | "down") {
    setSections((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx === -1) return prev;
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      const temp = next[idx]!;
      next[idx] = next[newIdx]!;
      next[newIdx] = temp;
      return next;
    });
    markDirty();
  }

  function addPlaceholder() {
    const key = newPlaceholderKey.trim().replace(/\s+/g, "_").toLowerCase();
    if (!key || placeholders.some((p) => p.key === key)) return;
    setPlaceholders((prev) => [...prev, { key, label: key, defaultValue: "" }]);
    setNewPlaceholderKey("");
    markDirty();
  }

  function removePlaceholder(key: string) {
    setPlaceholders((prev) => prev.filter((p) => p.key !== key));
    markDirty();
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-border bg-background flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-3">
          <Link
            href="/platform-admin/communications/templates"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Badge variant="outline" className="text-xs">
            {status === "draft" ? "Draft" : status === "active" ? "Active" : "Archived"}
          </Badge>
          {lastSavedAt && (
            <span className="text-muted-foreground text-xs">
              Saved{" "}
              {lastSavedAt.toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowPreview((p) => !p)}>
            {showPreview ? "Hide Preview" : "Show Preview"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleSave()}
            disabled={isSaving || !isDirty}
          >
            {isSaving ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1 h-3.5 w-3.5" />
            )}
            Save
          </Button>
          {status === "draft" && (
            <Button size="sm" onClick={() => handleSave("active")} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="mr-1 h-3.5 w-3.5" />
              )}
              Publish
            </Button>
          )}
        </div>
      </div>

      {/* Metadata bar */}
      <div className="border-border flex items-center gap-4 border-b px-4 py-2">
        <div className="flex-1">
          <Input
            placeholder="Template name..."
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              markDirty();
            }}
            className="h-8 border-0 bg-transparent px-0 text-sm font-medium shadow-none focus-visible:ring-0"
          />
        </div>
        <Select
          value={category}
          onValueChange={(v) => {
            setCategory(v);
            markDirty();
          }}
        >
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Main content */}
      <div className="flex min-h-0 flex-1">
        {/* Editor side */}
        <div className={`flex flex-col overflow-y-auto ${showPreview ? "w-[60%]" : "w-full"}`}>
          <div className="space-y-4 p-4">
            {/* Subject */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium tracking-wider uppercase">Subject</Label>
              <Input
                placeholder="Email subject line... Use {{placeholder}} for dynamic values"
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  markDirty();
                }}
              />
            </div>

            {/* Sections */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium tracking-wider uppercase">Sections</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 text-xs">
                      <Plus className="mr-1 h-3 w-3" />
                      Add Section
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {SECTION_TYPES.map((s) => {
                      const Icon = s.icon;
                      return (
                        <DropdownMenuItem key={s.type} onClick={() => addSection(s.type)}>
                          <Icon className="mr-2 h-3.5 w-3.5" />
                          {s.label}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {sections.length === 0 ? (
                <div className="border-border rounded-md border border-dashed py-8 text-center">
                  <p className="text-muted-foreground text-sm">No sections yet. Add one above.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sections.map((section, idx) => (
                    <SectionBlock
                      key={section.id}
                      section={section}
                      index={idx}
                      total={sections.length}
                      onUpdate={(updates) => updateSection(section.id, updates)}
                      onRemove={() => removeSection(section.id)}
                      onMove={(dir) => moveSection(section.id, dir)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Placeholders */}
            <div className="space-y-2">
              <Label className="text-xs font-medium tracking-wider uppercase">Placeholders</Label>
              <p className="text-muted-foreground text-xs">
                Use {"{{key}}"} in subject or content. Available in all sections.
              </p>
              <div className="flex flex-wrap gap-2">
                {placeholders.map((p) => (
                  <Badge key={p.key} variant="secondary" className="gap-1 text-xs">
                    {`{{${p.key}}}`}
                    <button
                      onClick={() => removePlaceholder(p.key)}
                      className="text-muted-foreground hover:text-foreground ml-0.5"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="new_placeholder_key"
                  value={newPlaceholderKey}
                  onChange={(e) => setNewPlaceholderKey(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addPlaceholder()}
                  className="h-8 flex-1 text-xs"
                />
                <Button variant="outline" size="sm" className="h-8" onClick={addPlaceholder}>
                  <Plus className="mr-1 h-3 w-3" />
                  Add
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Preview side */}
        {showPreview && (
          <div className="border-border w-[40%] border-l">
            <EmailTemplatePreview
              subject={subject}
              sections={sections}
              placeholders={placeholders}
            />
          </div>
        )}
      </div>
    </div>
  );
}
