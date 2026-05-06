// apps/journey-control/src/components/speed-picker.tsx
"use client";

import type { SpeedProfile } from "@smartout/journey-ir";
import { cn } from "@/lib/utils";

const PROFILES: Array<{ value: SpeedProfile; label: string; hint: string }> = [
  { value: "full", label: "Full", hint: "CI speed, no scaling" },
  { value: "normal", label: "Normal", hint: "Human-watch, ~3x slower" },
  { value: "ai_companion", label: "AI Companion", hint: "Botsson-narrate, ~8x slower" },
];

type Props = {
  value: SpeedProfile;
  onChange: (next: SpeedProfile) => void;
  disabled?: boolean;
};

export function SpeedPicker({ value, onChange, disabled }: Props) {
  return (
    <div className="border-border bg-muted inline-flex rounded-lg border p-1" role="radiogroup">
      {PROFILES.map((p) => (
        <button
          key={p.value}
          type="button"
          role="radio"
          aria-checked={value === p.value}
          disabled={disabled}
          onClick={() => onChange(p.value)}
          title={p.hint}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm transition-colors",
            value === p.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
