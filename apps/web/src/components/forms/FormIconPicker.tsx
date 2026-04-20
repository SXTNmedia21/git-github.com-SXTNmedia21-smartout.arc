"use client";

import type { ElementType } from "react";
import type { FieldValues, Path } from "react-hook-form";
import { Controller, useFormContext } from "react-hook-form";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type IconPreset = {
  key: string;
  label: string;
};

type FormIconPickerProps<T extends FieldValues> = {
  name: Path<T>;
  label: string;
  presets: readonly IconPreset[];
  /** Map of preset.key → lucide icon component. Unknown keys are skipped. */
  icons: Record<string, ElementType>;
  helperText?: string;
  className?: string;
};

export function FormIconPicker<T extends FieldValues>({
  name,
  label,
  presets,
  icons,
  helperText,
  className,
}: FormIconPickerProps<T>) {
  const { control } = useFormContext<T>();

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <div className="grid grid-cols-6 gap-2">
            {presets.map((preset) => {
              const Icon = icons[preset.key];
              if (!Icon) return null;
              const isSelected = field.value === preset.key;
              return (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => field.onChange(isSelected ? null : preset.key)}
                  title={preset.label}
                  aria-label={preset.label}
                  aria-pressed={isSelected}
                  className={cn(
                    "flex h-9 w-full items-center justify-center rounded-lg border transition-all",
                    "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                    isSelected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted text-muted-foreground hover:border-foreground/20 hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        )}
      />
      {helperText ? <p className="text-muted-foreground text-xs">{helperText}</p> : null}
    </div>
  );
}
