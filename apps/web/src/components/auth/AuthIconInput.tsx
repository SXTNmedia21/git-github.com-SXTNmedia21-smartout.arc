"use client";

import { forwardRef, useId, useState } from "react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = Omit<ComponentPropsWithoutRef<"input">, "size"> & {
  /** Field label rendered above the input. */
  label?: string;
  /** Optional icon rendered inside the input on the left. */
  icon?: ReactNode;
  /** Optional slot rendered inside the input on the right. */
  right?: ReactNode;
  /** Helper text shown below the field when there's no error. */
  hint?: string;
  /** Error message — overrides hint and switches border to destructive. */
  error?: string;
  /** Render as read-only / locked (dimmer background). */
  locked?: boolean;
  /** Use monospace font (emails-as-data, tokens, etc.). */
  mono?: boolean;
  /** For type="password": show a built-in eye toggle in the right slot. */
  withPasswordToggle?: boolean;
};

/**
 * Labeled input used across auth screens. 44px tall, rounded-xl, warm focus ring.
 * Matches Nordic Split design spec: icon inside on the left, optional right slot
 * for eye toggle, strength indicator, etc.
 */
export const AuthIconInput = forwardRef<HTMLInputElement, Props>(function AuthIconInput(
  {
    label,
    icon,
    right,
    hint,
    error,
    locked,
    mono,
    withPasswordToggle,
    type = "text",
    className,
    id: idProp,
    ...rest
  },
  ref,
) {
  const reactId = useId();
  const id = idProp ?? reactId;

  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const effectiveType = isPassword && withPasswordToggle && revealed ? "text" : type;

  const rightSlot =
    right ??
    (isPassword && withPasswordToggle ? (
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setRevealed((v) => !v)}
        className="text-muted-foreground hover:text-foreground -mr-1 rounded p-1 transition-colors"
        aria-label={revealed ? "Skjul passord" : "Vis passord"}
      >
        {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    ) : null);

  return (
    <div>
      {label && (
        <label htmlFor={id} className="text-foreground mb-1.5 block text-[0.8125rem] font-medium">
          {label}
        </label>
      )}
      <div
        className={cn(
          "border-border flex h-11 items-center gap-2.5 rounded-xl border px-3 transition-[border-color,box-shadow] duration-200",
          "focus-within:border-brand-orange focus-within:shadow-[0_0_0_3px_oklch(0.65_0.22_40/0.15)]",
          locked ? "bg-muted/50" : "bg-background",
          error &&
            "border-destructive focus-within:border-destructive focus-within:shadow-[0_0_0_3px_oklch(0.55_0.22_25/0.15)]",
        )}
      >
        {icon && <span className="text-muted-foreground flex shrink-0 items-center">{icon}</span>}
        <input
          ref={ref}
          id={id}
          type={effectiveType}
          readOnly={locked || rest.readOnly}
          className={cn(
            "text-foreground placeholder:text-muted-foreground/50 h-full flex-1 border-0 bg-transparent text-sm outline-none",
            mono && "font-mono",
            className,
          )}
          {...rest}
        />
        {rightSlot && <span className="flex shrink-0 items-center">{rightSlot}</span>}
      </div>
      {error ? (
        <p className="text-destructive mt-1.5 text-xs">{error}</p>
      ) : hint ? (
        <p className="text-muted-foreground mt-1.5 text-xs">{hint}</p>
      ) : null}
    </div>
  );
});
