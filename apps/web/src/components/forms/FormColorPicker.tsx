"use client";

import type { FieldValues, Path } from "react-hook-form";
import { Controller, useFormContext } from "react-hook-form";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FormColorPickerProps<T extends FieldValues> = {
  name: Path<T>;
  label: string;
  presets: readonly string[];
  helperText?: string;
  className?: string;
};

export function FormColorPicker<T extends FieldValues>({
  name,
  label,
  presets,
  helperText,
  className,
}: FormColorPickerProps<T>) {
  const { control } = useFormContext<T>();

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <div className="flex flex-wrap gap-2">
            {presets.map((color) => {
              const isSelected = field.value === color;
              return (
                <button
                  key={color}
                  type="button"
                  onClick={() => field.onChange(isSelected ? null : color)}
                  aria-label={color}
                  aria-pressed={isSelected}
                  className={cn(
                    "h-7 w-7 rounded-full transition-all",
                    "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                    isSelected
                      ? "ring-foreground ring-offset-background ring-2 ring-offset-2"
                      : "hover:scale-110",
                  )}
                  style={{ backgroundColor: color }}
                />
              );
            })}
          </div>
        )}
      />
      {helperText ? <p className="text-muted-foreground text-xs">{helperText}</p> : null}
    </div>
  );
}
