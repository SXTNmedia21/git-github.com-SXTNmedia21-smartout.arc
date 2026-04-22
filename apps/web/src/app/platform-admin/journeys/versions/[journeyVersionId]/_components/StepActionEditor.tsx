// ============================================
// StepActionEditor.tsx — THE ONE FILE that renders step.action (IR v1).
//
// ISOLATION BOUNDARY — DO NOT READ step.action ANYWHERE ELSE.
//
// The rest of the authoring surface treats this component as a black box:
// it receives (value, onChange) for a single step's action string and owns
// every render/mutation of that field. M3.5's IR-v2 upgrade (which replaces
// `step.action: string` with `step.actions: Action[]`) is a ONE-FILE SWAP
// of this component's internals — interface stays the same.
//
// How to verify the isolation: run
//   grep -rn "step\.action\|\.action" apps/web/src/app/platform-admin/journeys/versions
// The only hits in non-test code should be in THIS file plus schema-level
// pass-through in the containing editor (which treats action as opaque string).
// ============================================

"use client";

import { useId } from "react";
import type { JourneyStep } from "@smartout/journey-ir";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Minimal M4 contract. Takes the WHOLE step and returns a patch with just
 * the action-related fields. Callers never touch the action field directly
 * — they pass the step in and merge back whatever patch comes out. This
 * keeps the action-field read/write inside THIS file only (grep-gated).
 *
 * M3.5 will replace the internal rendering with an `actions[]` array
 * editor. The patch surface changes from `{ action: string }` to
 * `{ actions: Action[] }` — a single interface revision in this file,
 * and the outer editor's merge call (`{ ...step, ...patch }`) absorbs
 * the shape change transparently.
 */
export interface StepActionPatch {
  // IR v1 — single string. M3.5 → `actions: Action[]`.
  action: string;
}

export interface StepActionEditorProps {
  /** The full step — opaque to callers outside this file. */
  step: Pick<JourneyStep, "action">;
  /** Fires on blur with a patch to merge into the step. */
  onChange: (patch: StepActionPatch) => void;
  /** Read-only when the version is published/archived. */
  disabled?: boolean;
  /** Optional label suffix (e.g. step index) for screen-readers. */
  ariaLabelSuffix?: string;
}

export function StepActionEditor({
  step,
  onChange,
  disabled,
  ariaLabelSuffix,
}: StepActionEditorProps) {
  const inputId = useId();
  // The ONLY read of the action field — by design. M3.5 replaces with
  // `step.actions` + a repeater component below.
  const currentAction = step.action;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId} className="text-foreground text-xs font-medium">
        Action{" "}
        {ariaLabelSuffix ? (
          <span className="text-muted-foreground">· {ariaLabelSuffix}</span>
        ) : null}
      </Label>
      <Textarea
        id={inputId}
        defaultValue={currentAction}
        disabled={disabled}
        onBlur={(e) => {
          const next = e.currentTarget.value;
          if (next !== currentAction) onChange({ action: next });
        }}
        rows={2}
        className="bg-background border-border text-foreground min-h-11 resize-y font-mono text-sm"
        placeholder="What does the actor do in this step?"
        aria-label={`Step action${ariaLabelSuffix ? ` — ${ariaLabelSuffix}` : ""}`}
      />
      <p className="text-muted-foreground text-xs">
        Free-form imperative string. M3.5 replaces this with a typed{" "}
        <code className="font-mono">actions[]</code> editor.
      </p>
    </div>
  );
}
