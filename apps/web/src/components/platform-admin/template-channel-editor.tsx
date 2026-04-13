"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";

import { SmsCompose } from "@/components/platform-admin/sms-compose";
import { PushCompose } from "@/components/platform-admin/push-compose";
import { InAppCompose } from "@/components/platform-admin/in-app-compose";

import type {
  EmailTemplateSection,
  EmailTemplatePlaceholder,
} from "@/app/platform-admin/communications/templates/[id]/edit/save-action";

import {
  Type,
  AlignLeft,
  ImageIcon,
  List,
  Code,
  Minus,
  MousePointerClick,
  PanelBottom,
  LayoutGrid,
  RectangleHorizontal,
  Megaphone,
  Video,
} from "lucide-react";

import { SectionBlock } from "@/app/platform-admin/communications/templates/_components/section-block";

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
  { type: "card" as const, label: "Card", icon: LayoutGrid, placeholder: "" },
  { type: "hero_card" as const, label: "Hero Card", icon: RectangleHorizontal, placeholder: "" },
  { type: "cta" as const, label: "Call to Action", icon: Megaphone, placeholder: "" },
  { type: "video" as const, label: "Video", icon: Video, placeholder: "" },
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

type TemplateChannelEditorProps = {
  channel: "email" | "sms" | "push" | "in_app";
  // Email fields
  subject?: string;
  sections?: EmailTemplateSection[];
  placeholders?: EmailTemplatePlaceholder[];
  onSubjectChange?: (v: string) => void;
  onSectionsChange?: (v: EmailTemplateSection[]) => void;
  onPlaceholdersChange?: (v: EmailTemplatePlaceholder[]) => void;
  // SMS fields
  smsBody?: string;
  onSmsBodyChange?: (v: string) => void;
  // Push fields
  pushTitle?: string;
  pushBody?: string;
  pushActionUrl?: string;
  onPushTitleChange?: (v: string) => void;
  onPushBodyChange?: (v: string) => void;
  onPushActionUrlChange?: (v: string) => void;
  // In-app fields
  inAppTitle?: string;
  inAppBody?: string;
  inAppActionUrl?: string;
  inAppMode?: string;
  inAppPriority?: string;
  inAppIconType?: string;
  onInAppTitleChange?: (v: string) => void;
  onInAppBodyChange?: (v: string) => void;
  onInAppActionUrlChange?: (v: string) => void;
  onInAppModeChange?: (v: string) => void;
  onInAppPriorityChange?: (v: string) => void;
  onInAppIconTypeChange?: (v: string) => void;
};

/**
 * Renders the channel-specific editor fields for a template.
 * For email: subject + section builder + placeholders.
 * For SMS: SmsCompose wrapper.
 * For Push: PushCompose wrapper.
 * For In-App: InAppCompose wrapper.
 */
export function TemplateChannelEditor({
  channel,
  // Email
  subject = "",
  sections = [],
  placeholders = [],
  onSubjectChange,
  onSectionsChange,
  onPlaceholdersChange,
  // SMS
  smsBody = "",
  onSmsBodyChange,
  // Push
  pushTitle = "",
  pushBody = "",
  pushActionUrl = "",
  onPushTitleChange,
  onPushBodyChange,
  onPushActionUrlChange,
  // In-app
  inAppTitle = "",
  inAppBody = "",
  inAppActionUrl = "",
  inAppMode = "work",
  inAppPriority = "0",
  inAppIconType = "info",
  onInAppTitleChange,
  onInAppBodyChange,
  onInAppActionUrlChange,
  onInAppModeChange,
  onInAppPriorityChange,
  onInAppIconTypeChange,
}: TemplateChannelEditorProps) {
  if (channel === "sms") {
    return <SmsCompose value={smsBody} onChange={(v) => onSmsBodyChange?.(v)} />;
  }

  if (channel === "push") {
    return (
      <PushCompose
        title={pushTitle}
        body={pushBody}
        actionUrl={pushActionUrl}
        onTitleChange={(v) => onPushTitleChange?.(v)}
        onBodyChange={(v) => onPushBodyChange?.(v)}
        onActionUrlChange={(v) => onPushActionUrlChange?.(v)}
      />
    );
  }

  if (channel === "in_app") {
    return (
      <InAppCompose
        title={inAppTitle}
        body={inAppBody}
        actionUrl={inAppActionUrl}
        mode={inAppMode as "training" | "work" | "community"}
        priority={inAppPriority as "0" | "1" | "2"}
        iconType={inAppIconType}
        onTitleChange={(v) => onInAppTitleChange?.(v)}
        onBodyChange={(v) => onInAppBodyChange?.(v)}
        onActionUrlChange={(v) => onInAppActionUrlChange?.(v)}
        onModeChange={(v) => onInAppModeChange?.(v)}
        onPriorityChange={(v) => onInAppPriorityChange?.(v)}
        onIconTypeChange={(v) => onInAppIconTypeChange?.(v)}
      />
    );
  }

  // Default: email channel — subject + sections + placeholders
  return (
    <EmailChannelFields
      subject={subject}
      sections={sections}
      placeholders={placeholders}
      onSubjectChange={onSubjectChange}
      onSectionsChange={onSectionsChange}
      onPlaceholdersChange={onPlaceholdersChange}
    />
  );
}

/* ─── Email-specific sub-component ─── */

function EmailChannelFields({
  subject,
  sections,
  placeholders,
  onSubjectChange,
  onSectionsChange,
  onPlaceholdersChange,
}: {
  subject: string;
  sections: EmailTemplateSection[];
  placeholders: EmailTemplatePlaceholder[];
  onSubjectChange?: (v: string) => void;
  onSectionsChange?: (v: EmailTemplateSection[]) => void;
  onPlaceholdersChange?: (v: EmailTemplatePlaceholder[]) => void;
}) {
  const [newPlaceholderKey, setNewPlaceholderKey] = useState("");

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
    if (type === "card") {
      newSection.content = "Card Title";
      newSection.subtitle = "Card subtitle or description";
      newSection.imageUrl = "";
    }
    if (type === "hero_card") {
      newSection.content = "Hero Title";
      newSection.subtitle = "Hero subtitle";
      newSection.imageUrl = "";
      newSection.items = ["Feature one", "Feature two", "Feature three"];
    }
    if (type === "cta") {
      newSection.content = "Ready to get started?";
      newSection.buttonText = "Get Started";
      newSection.buttonUrl = "https://";
    }
    if (type === "video") {
      newSection.videoUrl = "";
      newSection.videoThumbnailUrl = "";
      newSection.content = "Watch the video";
    }
    onSectionsChange?.([...sections, newSection]);
  }

  function updateSection(id: string, updates: Partial<EmailTemplateSection>) {
    onSectionsChange?.(sections.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  }

  function removeSection(id: string) {
    onSectionsChange?.(sections.filter((s) => s.id !== id));
  }

  function duplicateSection(id: string) {
    const idx = sections.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const clone: EmailTemplateSection = { ...sections[idx]!, id: crypto.randomUUID() };
    const next = [...sections];
    next.splice(idx + 1, 0, clone);
    onSectionsChange?.(next);
  }

  function moveSection(id: string, direction: "up" | "down") {
    const idx = sections.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= sections.length) return;
    const next = [...sections];
    const temp = next[idx]!;
    next[idx] = next[newIdx]!;
    next[newIdx] = temp;
    onSectionsChange?.(next);
  }

  function addPlaceholder() {
    const key = newPlaceholderKey.trim().replace(/\s+/g, "_").toLowerCase();
    if (!key || placeholders.some((p) => p.key === key)) return;
    onPlaceholdersChange?.([...placeholders, { key, label: key, defaultValue: "" }]);
    setNewPlaceholderKey("");
  }

  function removePlaceholder(key: string) {
    onPlaceholdersChange?.(placeholders.filter((p) => p.key !== key));
  }

  return (
    <div className="space-y-4">
      {/* Subject */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium tracking-wider uppercase">Subject</Label>
        <Input
          placeholder="Email subject line... Use {{placeholder}} for dynamic values"
          value={subject}
          onChange={(e) => onSubjectChange?.(e.target.value)}
        />
      </div>

      {/* Sections */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium tracking-wider uppercase">
            Sections ({sections.length})
          </Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs">
                <Plus className="mr-1 h-3 w-3" />
                Add Section
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {SECTION_TYPES.map((s) => {
                const SIcon = s.icon;
                return (
                  <DropdownMenuItem key={s.type} onClick={() => addSection(s.type)}>
                    <SIcon className="mr-2 h-3.5 w-3.5" />
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
                onDuplicate={() => duplicateSection(section.id)}
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
                <X className="h-2.5 w-2.5" />
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
  );
}
