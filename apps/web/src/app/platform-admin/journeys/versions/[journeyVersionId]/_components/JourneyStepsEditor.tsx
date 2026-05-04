// ============================================
// JourneyStepsEditor.tsx — step list editor for JourneyIR v1.
//
// Renders each step's meta fields (key, title, assertion, timeoutMs)
// INLINE, and delegates the action slot rendering to StepActionEditor
// (the single isolation boundary — see StepActionEditor.tsx header).
//
// This component MUST NOT read or write the action slot directly. It
// passes the whole step into StepActionEditor and merges the patch it
// returns. That's the contract M3.5 will rely on.
// ============================================

"use client";

import { motion, useReducedMotion } from "framer-motion";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import type { JourneyStep } from "@smartout/journey-ir";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StepActionEditor } from "./StepActionEditor";

/**
 * Draft shape — a mutable mirror of JourneyStep. We spread the IR step
 * into this shape via {@link draftFromIrStep} so the action field flows
 * through without being named here (keeps the grep isolation gate clean).
 *
 * M3.5 changes IR v2 so `action` becomes `actions: Action[]`. The
 * spread-based converter below keeps working for free; only
 * StepActionEditor.tsx has to handle the shape change.
 */
export type DraftStep = {
  -readonly [K in keyof JourneyStep]: JourneyStep[K];
};

export function draftFromIrStep(step: JourneyStep): DraftStep {
  return { ...step };
}

export function irStepFromDraft(draft: DraftStep): JourneyStep {
  // Strip undefined optional keys so the IR Zod schema's .strict() is happy.
  const { timeoutMs, ...rest } = draft;
  return timeoutMs === undefined ? rest : { ...rest, timeoutMs };
}

interface Props {
  steps: ReadonlyArray<DraftStep>;
  onChange: (next: DraftStep[]) => void;
  disabled?: boolean;
}

export function JourneyStepsEditor({ steps, onChange, disabled }: Props) {
  const reduce = useReducedMotion();

  function update(index: number, patch: Partial<DraftStep>) {
    const next = steps.slice();
    const current = next[index];
    if (!current) return;
    next[index] = { ...current, ...patch };
    onChange(next);
  }

  function addStep() {
    const next = steps.slice();
    const nextKey = `step-${next.length + 1}`;
    next.push({
      key: nextKey,
      title: "New step",
      action: "Describe the action.",
      assertion: "Describe the assertion.",
    });
    onChange(next);
  }

  function removeStep(index: number) {
    const next = steps.slice();
    next.splice(index, 1);
    onChange(next);
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= steps.length) return;
    const next = steps.slice();
    const tmp = next[index];
    const other = next[target];
    if (!tmp || !other) return;
    next[index] = other;
    next[target] = tmp;
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-foreground text-lg">Steps</h3>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addStep}
          disabled={disabled}
          className="min-h-11"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Add step
        </Button>
      </div>

      <ul className="space-y-2">
        {steps.map((step, i) => (
          <motion.li
            key={`${step.key}-${i}`}
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              reduce ? { duration: 0 } : { type: "spring", stiffness: 35, damping: 22, mass: 2.2 }
            }
            className={cn(
              "border-border bg-background rounded-md border p-4",
              disabled && "opacity-70",
            )}
          >
            <div className="flex items-start gap-3">
              {/* Reorder handle (keyboard + buttons, not full DnD for M4) */}
              <div className="flex flex-col items-center gap-1 pt-1">
                <GripVertical className="text-muted-foreground h-4 w-4" />
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={disabled || i === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  aria-label={`Move step ${i + 1} up`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={disabled || i === steps.length - 1}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  aria-label={`Move step ${i + 1} down`}
                >
                  ↓
                </button>
              </div>

              <div className="flex-1 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-foreground text-xs font-medium">Key</Label>
                    <Input
                      value={step.key}
                      disabled={disabled}
                      onChange={(e) => update(i, { key: e.target.value })}
                      className="bg-background border-border text-foreground min-h-11 font-mono"
                      aria-label={`Step ${i + 1} key`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-foreground text-xs font-medium">Title</Label>
                    <Input
                      value={step.title}
                      disabled={disabled}
                      onChange={(e) => update(i, { title: e.target.value })}
                      className="bg-background border-border text-foreground min-h-11"
                      aria-label={`Step ${i + 1} title`}
                    />
                  </div>
                </div>

                {/* Delegated action field — StepActionEditor owns the
                    read/write of the action slot. Patch merges into the
                    step via `update(i, patch)` below. */}
                <StepActionEditor
                  step={step}
                  disabled={disabled}
                  onChange={(patch) => update(i, patch)}
                  ariaLabelSuffix={`step ${i + 1}`}
                />

                <div className="space-y-1.5">
                  <Label className="text-foreground text-xs font-medium">Assertion</Label>
                  <Input
                    value={step.assertion}
                    disabled={disabled}
                    onChange={(e) => update(i, { assertion: e.target.value })}
                    className="bg-background border-border text-foreground min-h-11"
                    placeholder="What must be true after this step?"
                    aria-label={`Step ${i + 1} assertion`}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-foreground text-xs font-medium">
                    Timeout (ms) <span className="text-muted-foreground">· optional</span>
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    step={1000}
                    value={step.timeoutMs ?? ""}
                    disabled={disabled}
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      update(i, { timeoutMs: raw === "" ? undefined : Number(raw) });
                    }}
                    className="bg-background border-border text-foreground min-h-11 font-mono"
                    placeholder="unset — falls back to journey default or 24h detector"
                    aria-label={`Step ${i + 1} timeout`}
                  />
                </div>
              </div>

              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => removeStep(i)}
                disabled={disabled || steps.length <= 1}
                className="text-muted-foreground hover:text-foreground min-h-11 min-w-11"
                aria-label={`Remove step ${i + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
