"use client";

// EntityFormDialog — the canonical create/edit overlay per ADR-0151.
// Framework-agnostic chrome. Caller brings their own form state (react-hook-form,
// plain useState, whatever) and passes `onSubmit` as the form handler.

import * as React from "react";
import { Loader2 } from "lucide-react";

import { cn } from "../lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { Button } from "./button";

export type EntityFormDialogMode = "create" | "edit";

export type EntityFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: EntityFormDialogMode;
  title: string;
  description?: string;
  /**
   * Form fields. Rendered inside a <form> element so Enter submits.
   */
  children: React.ReactNode;
  /**
   * Fires when the form is submitted (Enter key or Submit button).
   * Typically `form.handleSubmit(onValid)` from react-hook-form.
   */
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  /**
   * Disabled = true when the form is invalid or no changes pending.
   * Overridden to true while `saving` is true.
   */
  canSubmit?: boolean;
  /**
   * Submit button shows spinner + both buttons disabled when true.
   */
  saving?: boolean;
  /**
   * Override the submit button label. Defaults by mode:
   * create -> "Create", edit -> "Save".
   */
  submitLabel?: string;
  cancelLabel?: string;
  /**
   * Dialog width. Defaults to max-w-lg (matches current dialogs).
   */
  className?: string;
};

export function EntityFormDialog({
  open,
  onOpenChange,
  mode,
  title,
  description,
  children,
  onSubmit,
  canSubmit = true,
  saving = false,
  submitLabel,
  cancelLabel = "Cancel",
  className,
}: EntityFormDialogProps) {
  const defaultLabel = mode === "create" ? "Create" : "Save";
  const effectiveSubmitLabel = submitLabel ?? defaultLabel;
  const isSubmitDisabled = !canSubmit || saving;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(className)}>
        <form onSubmit={onSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>

          <div className="space-y-4 py-4">{children}</div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              {cancelLabel}
            </Button>
            <Button type="submit" disabled={isSubmitDisabled}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  {mode === "create" ? "Creating…" : "Saving…"}
                </>
              ) : (
                effectiveSubmitLabel
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
