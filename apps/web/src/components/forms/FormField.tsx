"use client";

// FormField — text input bound to react-hook-form. Shows label, input, and
// validation error. Theming flows from shadcn `Input` via Nordic Split CSS vars.

import type { FieldValues, Path } from "react-hook-form";
import { useFormContext } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FormFieldProps<T extends FieldValues> = {
  name: Path<T>;
  label: string;
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
  type?: "text" | "number" | "email" | "tel";
  helperText?: string;
  className?: string;
};

export function FormField<T extends FieldValues>({
  name,
  label,
  placeholder,
  required,
  autoFocus,
  type = "text",
  helperText,
  className,
}: FormFieldProps<T>) {
  const {
    register,
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
      <Input
        id={name}
        type={type}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-invalid={errorMessage ? true : undefined}
        {...register(name, type === "number" ? { valueAsNumber: true } : undefined)}
      />
      {errorMessage ? (
        <p className="text-destructive text-xs">{errorMessage}</p>
      ) : helperText ? (
        <p className="text-muted-foreground text-xs">{helperText}</p>
      ) : null}
    </div>
  );
}
