"use client";

import type { FieldValues, Path, PathValue } from "react-hook-form";
import { Controller, useFormContext } from "react-hook-form";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type SelectOption = {
  value: string;
  label: string;
};

type FormSelectProps<T extends FieldValues> = {
  name: Path<T>;
  label: string;
  options: readonly SelectOption[];
  placeholder?: string;
  required?: boolean;
  helperText?: string;
  className?: string;
  /**
   * Optional. When set, an empty/"none" option is prepended with this label
   * and stores `null` in form state (for nullable foreign keys).
   */
  emptyLabel?: string;
};

const EMPTY_SENTINEL = "__empty__";

export function FormSelect<T extends FieldValues>({
  name,
  label,
  options,
  placeholder,
  required,
  helperText,
  className,
  emptyLabel,
}: FormSelectProps<T>) {
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
        render={({ field }) => {
          const currentValue =
            field.value === null || field.value === undefined || field.value === ""
              ? emptyLabel
                ? EMPTY_SENTINEL
                : undefined
              : String(field.value);
          return (
            <Select
              value={currentValue}
              onValueChange={(v) => {
                if (v === EMPTY_SENTINEL) {
                  field.onChange(null as unknown as PathValue<T, Path<T>>);
                } else {
                  field.onChange(v as unknown as PathValue<T, Path<T>>);
                }
              }}
            >
              <SelectTrigger id={name} aria-invalid={errorMessage ? true : undefined}>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent>
                {emptyLabel ? <SelectItem value={EMPTY_SENTINEL}>{emptyLabel}</SelectItem> : null}
                {options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        }}
      />
      {errorMessage ? (
        <p className="text-destructive text-xs">{errorMessage}</p>
      ) : helperText ? (
        <p className="text-muted-foreground text-xs">{helperText}</p>
      ) : null}
    </div>
  );
}
