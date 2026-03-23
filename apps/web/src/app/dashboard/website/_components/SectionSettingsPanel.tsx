"use client";

import { useState, useEffect, useRef } from "react";
import type { SectionSettingsFromSchema } from "@smartout/website";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronRight, Settings2 } from "lucide-react";

const bgOptions = [
  { value: "default", label: "Standard" },
  { value: "muted", label: "Dempet" },
  { value: "accent", label: "Aksent" },
  { value: "dark", label: "Mørk" },
  { value: "image", label: "Bilde" },
] as const;

const widthOptions = [
  { value: "narrow", label: "Smal" },
  { value: "default", label: "Standard" },
  { value: "wide", label: "Bred" },
  { value: "full", label: "Full bredde" },
] as const;

const spacingOptions = [
  { value: "none", label: "Ingen" },
  { value: "sm", label: "Liten" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Stor" },
  { value: "xl", label: "Ekstra stor" },
] as const;

type Props = {
  settings: SectionSettingsFromSchema;
  onChange: (settings: SectionSettingsFromSchema) => void;
};

/**
 * Collapsible panel showing visual settings for a section (background, container width, spacing).
 * Debounces changes 500ms before calling onChange to avoid hammering the server.
 */
export default function SectionSettingsPanel({ settings, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [local, setLocal] = useState(settings);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setLocal(settings);
  }, [settings]);

  const handleChange = (key: keyof SectionSettingsFromSchema, value: string) => {
    const next = { ...local, [key]: value } as SectionSettingsFromSchema;
    setLocal(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(next), 500);
  };

  return (
    <div className="border-t">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-sm font-medium transition-colors"
      >
        <Settings2 className="h-4 w-4" />
        Innstillinger
        {isOpen ? (
          <ChevronDown className="ml-auto h-4 w-4" />
        ) : (
          <ChevronRight className="ml-auto h-4 w-4" />
        )}
      </button>

      {isOpen && (
        <div className="space-y-3 px-3 pb-3">
          <div>
            <Label className="text-xs">Bakgrunn</Label>
            <Select
              value={local.backgroundVariant}
              onValueChange={(v) => handleChange("backgroundVariant", v)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {bgOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Bredde</Label>
            <Select
              value={local.containerWidth}
              onValueChange={(v) => handleChange("containerWidth", v)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {widthOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Mellomrom</Label>
            <Select value={local.spacing} onValueChange={(v) => handleChange("spacing", v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {spacingOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
