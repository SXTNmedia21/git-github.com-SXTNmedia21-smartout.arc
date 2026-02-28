"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { Plus, Trash2, Copy, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type PlaceholderItem = {
  key: string;
  label: string;
  source: string;
  default_value?: string;
  required: boolean;
};

const SOURCE_OPTIONS = [
  { value: "manual", label: "Manuell" },
  { value: "workspace", label: "Workspace" },
  { value: "company", label: "Bedrift" },
  { value: "employee", label: "Ansatt" },
];

type PlaceholderPanelProps = {
  placeholders: PlaceholderItem[];
  onChange: (placeholders: PlaceholderItem[]) => void;
  editor: Editor | null;
  contentHtml: string;
};

/**
 * Auto-detect {{...}} placeholder patterns from HTML content
 * and return keys not already in the placeholders list.
 */
function detectNewPlaceholders(html: string, existing: PlaceholderItem[]): string[] {
  const matches = html.matchAll(/\{\{(\w+)\}\}/g);
  const existingKeys = new Set(existing.map((p) => p.key));
  const detected = new Set<string>();

  for (const match of matches) {
    const key = match[1];
    if (key && !existingKeys.has(key)) {
      detected.add(key);
    }
  }

  return Array.from(detected);
}

export function PlaceholderPanel({
  placeholders,
  onChange,
  editor,
  contentHtml,
}: PlaceholderPanelProps) {
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const detectedKeys = detectNewPlaceholders(contentHtml, placeholders);

  function handleAdd() {
    const key = newKey.trim().toLowerCase().replace(/\s+/g, "_");
    if (!key) return;
    if (placeholders.some((p) => p.key === key)) return;

    onChange([
      ...placeholders,
      {
        key,
        label: newLabel.trim() || key,
        source: "manual",
        required: false,
      },
    ]);
    setNewKey("");
    setNewLabel("");
  }

  function handleAddDetected(key: string) {
    onChange([
      ...placeholders,
      {
        key,
        label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        source: "manual",
        required: false,
      },
    ]);
  }

  function handleRemove(key: string) {
    onChange(placeholders.filter((p) => p.key !== key));
  }

  function handleToggleRequired(key: string) {
    onChange(placeholders.map((p) => (p.key === key ? { ...p, required: !p.required } : p)));
  }

  function handleSourceChange(key: string, source: string) {
    onChange(placeholders.map((p) => (p.key === key ? { ...p, source } : p)));
  }

  function handleInsert(key: string) {
    if (!editor) return;
    editor.chain().focus().insertContent(`{{${key}}}`).run();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-border border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Plassholdere</h3>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Variabler som fylles inn ved kontraktopprettelse
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-3 p-4">
          {/* Add new placeholder */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder="Nokkel (f.eks. navn)"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                className="h-8 text-xs"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
              <Button size="sm" variant="outline" onClick={handleAdd} className="h-8 shrink-0">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Input
              placeholder="Visningsnavn (valgfritt)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="h-8 text-xs"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
          </div>

          <Separator />

          {/* Detected placeholders from HTML */}
          {detectedKeys.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Search className="text-muted-foreground h-3.5 w-3.5" />
                <span className="text-muted-foreground text-xs font-medium">Oppdaget i tekst</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {detectedKeys.map((key) => (
                  <Badge
                    key={key}
                    variant="outline"
                    className="cursor-pointer text-xs"
                    onClick={() => handleAddDetected(key)}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    {`{{${key}}}`}
                  </Badge>
                ))}
              </div>
              <Separator />
            </div>
          )}

          {/* Placeholder list */}
          {placeholders.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-xs">
              Ingen plassholdere lagt til enda.
            </p>
          ) : (
            <div className="space-y-2">
              {placeholders.map((p) => (
                <div key={p.key} className="bg-muted/50 rounded-md border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <code className="text-xs font-medium">{`{{${p.key}}}`}</code>
                      <p className="text-muted-foreground mt-0.5 truncate text-xs">{p.label}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => handleInsert(p.key)}
                        title="Sett inn i tekst"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive h-7 w-7 p-0"
                        onClick={() => handleRemove(p.key)}
                        title="Fjern"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <Select
                      value={p.source}
                      onValueChange={(val) => handleSourceChange(p.key, val)}
                    >
                      <SelectTrigger className="h-6 w-28 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SOURCE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground text-xs">Pakrevd</span>
                      <Switch
                        checked={p.required}
                        onCheckedChange={() => handleToggleRequired(p.key)}
                        className="scale-75"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
