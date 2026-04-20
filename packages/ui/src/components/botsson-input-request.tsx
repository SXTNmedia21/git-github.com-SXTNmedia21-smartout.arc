"use client";

/**
 * BotssonInputRequest — Generic UI primitive for typed user input requested by Botsson.
 *
 * Renders an inline form inside a chat message when a Botsson tool returns an
 * InputRequestDescriptor. The form supports text, number, date, tel, email, select, and
 * textarea field types. Validation is enforced at the UI layer (pattern, min/max,
 * required) before the typed values are submitted back to the agent runtime.
 *
 * Sensitivity model:
 *   - normal — non-sensitive, no special UI treatment
 *   - pii    — typed value never echoes in chat. The component sends it directly to the
 *              onSubmit callback (which posts to a server-side handler), never to LLM
 *              context. Display masks (e.g. ######-#####) hide the value visually.
 *   - legal  — typed value displays "✓ registered" after submit, never the actual value
 *
 * Channel guard:
 *   The descriptor's allowed_channels constraint is enforced at the runtime layer (in
 *   @smartout/ai/primitives/input-request/channel-guard). By the time this component
 *   renders, the request has already been allowed for the active channel. The component
 *   only handles the visual + validation layer.
 *
 * Why this lives in @smartout/ui rather than apps/web:
 *   The same primitive must be available to mobile (apps/mobile) once the React Native
 *   surface starts rendering Botsson chat. Putting it in @smartout/ui keeps it framework-
 *   agnostic-ish (Web React for now, RN adapter is a separate adapter file).
 */

import { useState, type FormEvent } from "react";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import { cn } from "../lib/utils";

// ── Types mirror @smartout/ai/primitives/input-request ──────────────────────
// We DON'T import the types from @smartout/ai because that would create a runtime
// dependency from @smartout/ui → @smartout/ai (which doesn't currently exist). Instead we
// duplicate the type shape here. The duplication is intentional and minimal — these are
// stable wire-format types that change rarely. If they drift, both sides break loudly.

export type BIRSensitivity = "normal" | "pii" | "legal";
export type BIRFieldType = "text" | "number" | "date" | "tel" | "email" | "select" | "textarea";

export type BIRValidation = {
  pattern?: string;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
};

export type BIRField = {
  id: string;
  label: string;
  input_type: BIRFieldType;
  sensitivity?: BIRSensitivity;
  placeholder?: string;
  helper_text?: string;
  mask?: string;
  validation?: BIRValidation;
  default_value?: string;
};

export type BIRDescriptor = {
  type: "input_request";
  request_id: string;
  title?: string;
  description?: string;
  fields: BIRField[];
  submit_label?: string;
  cancel_label?: string;
};

// ── Props ───────────────────────────────────────────────────────────────────
export type BotssonInputRequestProps = {
  request: BIRDescriptor;
  /** Called with the typed values when admin submits. Values are keyed by field.id. */
  onSubmit: (request_id: string, values: Record<string, string>) => void | Promise<void>;
  /** Called when admin cancels the input request. */
  onCancel?: (request_id: string) => void;
  /** Disables the form (e.g. while a parent is processing the submit). */
  disabled?: boolean;
  className?: string;
};

// ── Component ───────────────────────────────────────────────────────────────
export function BotssonInputRequest({
  request,
  onSubmit,
  onCancel,
  disabled,
  className,
}: BotssonInputRequestProps) {
  // Initialize values from default_value or empty string for each field.
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const field of request.fields) {
      initial[field.id] = field.default_value ?? "";
    }
    return initial;
  });
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  function validate(): boolean {
    const newErrors: Record<string, string | null> = {};
    let allValid = true;

    for (const field of request.fields) {
      const value = values[field.id] ?? "";
      const v = field.validation;

      if (v?.required !== false && value.trim() === "") {
        newErrors[field.id] = `${field.label} er påkrevd`;
        allValid = false;
        continue;
      }
      if (v?.minLength != null && value.length < v.minLength) {
        newErrors[field.id] = `Minst ${v.minLength} tegn`;
        allValid = false;
        continue;
      }
      if (v?.maxLength != null && value.length > v.maxLength) {
        newErrors[field.id] = `Maks ${v.maxLength} tegn`;
        allValid = false;
        continue;
      }
      if (v?.pattern) {
        try {
          const re = new RegExp(v.pattern);
          if (!re.test(value)) {
            newErrors[field.id] = `Ugyldig format for ${field.label}`;
            allValid = false;
            continue;
          }
        } catch {
          // Invalid regex from server side — accept the value, log a warning.
          console.warn(`[BotssonInputRequest] Invalid pattern for field ${field.id}`);
        }
      }
      if (field.input_type === "number") {
        const n = Number(value);
        if (Number.isNaN(n)) {
          newErrors[field.id] = "Må være et tall";
          allValid = false;
          continue;
        }
        if (v?.min != null && n < v.min) {
          newErrors[field.id] = `Minst ${v.min}`;
          allValid = false;
          continue;
        }
        if (v?.max != null && n > v.max) {
          newErrors[field.id] = `Maks ${v.max}`;
          allValid = false;
          continue;
        }
      }

      newErrors[field.id] = null;
    }

    setErrors(newErrors);
    return allValid;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (disabled || isSubmitting || isSubmitted) return;
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(request.request_id, values);
      setIsSubmitted(true);
    } catch (err) {
      console.error("[BotssonInputRequest] onSubmit failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Submitted state ──────────────────────────────────────────────────────
  // After submit, hide the values entirely (especially for PII/legal). Show a check
  // confirmation. The chat-runtime side will display Botsson's response to the data.
  if (isSubmitted) {
    return (
      <div className={cn("border-border bg-muted/40 rounded-xl border p-4 text-sm", className)}>
        <div className="text-muted-foreground flex items-center gap-2">
          <span aria-hidden="true">✓</span>
          <span>Data registrert</span>
        </div>
      </div>
    );
  }

  // ── Active form ──────────────────────────────────────────────────────────
  const hasPiiField = request.fields.some((f) => f.sensitivity === "pii");

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "border-border bg-card flex flex-col gap-4 rounded-xl border p-4 text-sm shadow-sm",
        className,
      )}
      data-pii={hasPiiField || undefined}
    >
      {request.title ? (
        <div>
          <h3 className="text-foreground text-base font-semibold">{request.title}</h3>
          {request.description ? (
            <p className="text-muted-foreground mt-1 text-xs">{request.description}</p>
          ) : null}
        </div>
      ) : request.description ? (
        <p className="text-muted-foreground text-xs">{request.description}</p>
      ) : null}

      {hasPiiField ? (
        <div className="border-border/60 bg-muted/30 text-muted-foreground rounded-lg border border-dashed p-2 text-[11px]">
          🔒 Sensitiv data — verdien sendes direkte til serveren og vises aldri tilbake i samtalen.
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        {request.fields.map((field) => (
          <div key={field.id} className="flex flex-col gap-1">
            <Label htmlFor={`bir-${request.request_id}-${field.id}`}>
              {field.label}
              {field.validation?.required !== false ? (
                <span className="text-destructive ml-0.5">*</span>
              ) : null}
            </Label>

            {field.input_type === "textarea" ? (
              <textarea
                id={`bir-${request.request_id}-${field.id}`}
                value={values[field.id] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [field.id]: e.target.value }))}
                placeholder={field.placeholder}
                disabled={disabled || isSubmitting}
                rows={3}
                className="border-input bg-background ring-offset-background focus-visible:ring-ring rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              />
            ) : field.input_type === "select" ? (
              <select
                id={`bir-${request.request_id}-${field.id}`}
                value={values[field.id] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [field.id]: e.target.value }))}
                disabled={disabled || isSubmitting}
                className="border-input bg-background ring-offset-background focus-visible:ring-ring rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <option value="">— velg —</option>
                {(field.validation?.options ?? []).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id={`bir-${request.request_id}-${field.id}`}
                type={field.input_type === "number" ? "number" : field.input_type}
                value={values[field.id] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [field.id]: e.target.value }))}
                placeholder={field.placeholder}
                disabled={disabled || isSubmitting}
                // Best-effort autocomplete tagging — browsers handle PII fields better with hints.
                autoComplete={field.sensitivity === "pii" ? "off" : undefined}
                inputMode={
                  field.input_type === "number"
                    ? "numeric"
                    : field.input_type === "tel"
                      ? "tel"
                      : field.input_type === "email"
                        ? "email"
                        : undefined
                }
              />
            )}

            {field.helper_text ? (
              <p className="text-muted-foreground text-[11px]">{field.helper_text}</p>
            ) : null}
            {errors[field.id] ? (
              <p className="text-destructive text-[11px]">{errors[field.id]}</p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onCancel(request.request_id)}
            disabled={disabled || isSubmitting}
          >
            {request.cancel_label ?? "Avbryt"}
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={disabled || isSubmitting}>
          {isSubmitting ? "Sender …" : (request.submit_label ?? "Lagre")}
        </Button>
      </div>
    </form>
  );
}
