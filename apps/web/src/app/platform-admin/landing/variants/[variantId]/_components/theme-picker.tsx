// ============================================
// theme-picker.tsx — Accent color swatch grid
// Shows 6 predefined accent colors and returns the accent name on select.
//
// Connected to: variant-metadata-form.tsx (theme selection)
// ============================================

"use client";

import { Check } from "lucide-react";
import { Label } from "@/components/ui/label";

const ACCENT_COLORS = [
  { name: "orange", color: "#f97316", label: "Oransje" },
  { name: "amber", color: "#f59e0b", label: "Rav" },
  { name: "emerald", color: "#10b981", label: "Smoergroen" },
  { name: "slate", color: "#64748b", label: "Skifer" },
  { name: "rose", color: "#f43f5e", label: "Rosa" },
  { name: "yellow", color: "#eab308", label: "Gul" },
] as const;

type ThemePickerProps = {
  value: string;
  onChange: (accent: string) => void;
};

export function ThemePicker({ value, onChange }: ThemePickerProps) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">Aksentfarge</Label>
      <div className="grid grid-cols-6 gap-2">
        {ACCENT_COLORS.map((accent) => (
          <button
            key={accent.name}
            type="button"
            className="group relative flex flex-col items-center gap-1"
            onClick={() => onChange(accent.name)}
            title={accent.label}
          >
            <div
              className={`h-8 w-8 rounded-full border-2 transition-all ${
                value === accent.name
                  ? "border-foreground ring-ring scale-110 ring-2 ring-offset-2"
                  : "border-transparent group-hover:scale-105"
              }`}
              style={{ backgroundColor: accent.color }}
            >
              {value === accent.name && <Check className="mx-auto mt-1.5 h-5 w-5 text-white" />}
            </div>
            <span className="text-muted-foreground text-[10px]">{accent.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
