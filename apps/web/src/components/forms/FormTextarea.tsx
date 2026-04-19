"use client";

import type { FieldValues, Path } from "react-hook-form";
import { useFormContext } from "react-hook-form";

import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FormTextareaProps<T extends FieldValues> = {
  name: Path<T>;
  label: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  helperText?: string;
  className?: string;
};

export function FormTextarea<T extends FieldValues>({
  name,
  label,
  placeholder,
  required,
  rows = 2,
  helperText,
  className,
}: FormTextareaProps<T>) {
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
      <Textarea
        id={name}
        placeholder={placeholder}
        rows={rows}
        aria-invalid={errorMessage ? true : undefined}
        {...register(name)}
      />
      {errorMessage ? (
        <p className="text-destructive text-xs">{errorMessage}</p>
      ) : helperText ? (
        <p className="text-muted-foreground text-xs">{helperText}</p>
      ) : null}
    </div>
  );
}
