"use client";

import type { FieldValues, Path } from "react-hook-form";
import { Controller, useFormContext } from "react-hook-form";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FormCheckboxProps<T extends FieldValues> = {
  name: Path<T>;
  label: string;
  helperText?: string;
  className?: string;
};

export function FormCheckbox<T extends FieldValues>({
  name,
  label,
  helperText,
  className,
}: FormCheckboxProps<T>) {
  const { control } = useFormContext<T>();

  return (
    <div className={cn("flex items-start gap-2", className)}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Checkbox
            id={name}
            checked={Boolean(field.value)}
            onCheckedChange={(checked) => field.onChange(checked === true)}
            className="mt-0.5"
          />
        )}
      />
      <div className="space-y-0.5">
        <Label htmlFor={name} className="cursor-pointer">
          {label}
        </Label>
        {helperText ? <p className="text-muted-foreground text-xs">{helperText}</p> : null}
      </div>
    </div>
  );
}
