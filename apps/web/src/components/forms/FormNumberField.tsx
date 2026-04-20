"use client";

import type { FieldValues, Path } from "react-hook-form";
import { Controller, useFormContext } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Stores `number | null` in form state. Native number inputs surface empty
// strings / NaN, which breaks zod `.number().nullable()` inference — this
// primitive normalises both to `null` via Controller instead of `register`.

type FormNumberFieldProps<T extends FieldValues> = {
  name: Path<T>;
  label: string;
  placeholder?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  helperText?: string;
  className?: string;
};

export function FormNumberField<T extends FieldValues>({
  name,
  label,
  placeholder,
  required,
  min,
  max,
  step,
  helperText,
  className,
}: FormNumberFieldProps<T>) {
  const {
    control,
    formState: { errors },
  } = useFormContext<T>();
  const fieldError = errors[name];
  const errorMessage = typeof fieldError?.message === "string" ? fieldError.message : undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={name}>
        {label}
        {required ? <span className="text-destructive ml-0.5">*</span> : null}
      </Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Input
            id={name}
            type="number"
            min={min}
            max={max}
            step={step}
            placeholder={placeholder}
            aria-invalid={errorMessage ? true : undefined}
            value={field.value === null || field.value === undefined ? "" : String(field.value)}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                field.onChange(null);
                return;
              }
              const parsed = Number(raw);
              field.onChange(Number.isFinite(parsed) ? parsed : null);
            }}
            onBlur={field.onBlur}
            ref={field.ref}
          />
        )}
      />
      {errorMessage ? (
        <p className="text-destructive text-xs">{errorMessage}</p>
      ) : helperText ? (
        <p className="text-muted-foreground text-xs">{helperText}</p>
      ) : null}
    </div>
  );
}
