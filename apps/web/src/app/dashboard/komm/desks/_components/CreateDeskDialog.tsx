"use client";

/**
 * CreateDeskDialog — Spec §1.2.
 *
 * Glass shell over shadcn Dialog. Fields: name, description (optional),
 * responsible_profile_id. All validation mirrors the server schema —
 * server re-validates, client is UX only.
 */

import * as React from "react";
import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@smartout/i18n";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ResponsibleRepCombobox, type ResponsibleRep } from "./ResponsibleRepCombobox";
import { createDesk } from "../_actions/desk-actions";

export type CreateDeskDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reps: ResponsibleRep[];
  onCreated?: (deskId: string) => void;
};

export function CreateDeskDialog({ open, onOpenChange, reps, onCreated }: CreateDeskDialogProps) {
  const { t } = useTranslation("helpdesk");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [responsibleId, setResponsibleId] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ name?: string; responsible?: string }>({});
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setName("");
    setDescription("");
    setResponsibleId(null);
    setErrors({});
  };

  const handleSubmit = () => {
    const nextErrors: typeof errors = {};
    if (name.trim().length < 2) nextErrors.name = "Navnet må være minst 2 tegn.";
    if (name.trim().length > 40) nextErrors.name = "Maks 40 tegn.";
    if (!responsibleId) nextErrors.responsible = "Velg en ansvarlig.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    startTransition(async () => {
      const result = await createDesk({
        name: name.trim(),
        description: description.trim() || undefined,
        responsible_profile_id: responsibleId!,
      });
      if (result.ok) {
        toast.success(t("toast.desk_created", { name: name.trim() }));
        onCreated?.(result.deskId);
        reset();
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) {
          if (!next) reset();
          onOpenChange(next);
        }
      }}
    >
      <DialogContent className="bg-background/80 border-border/60 max-w-[480px] overflow-hidden border p-0 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_24px_60px_-20px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 34, damping: 22, mass: 2.3 }}
          className="relative"
        >
          <div className="via-border h-px bg-gradient-to-r from-transparent to-transparent" />
          <div className="p-8">
            <DialogHeader>
              <DialogTitle className="font-heading text-foreground text-2xl">
                {t("desk_dialog.title")}
              </DialogTitle>
            </DialogHeader>

            <form
              className="mt-6 space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="desk-name">{t("desk_dialog.field_name")}</Label>
                <Input
                  id="desk-name"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("desk_dialog.field_name_placeholder")}
                  maxLength={40}
                  disabled={pending}
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? "desk-name-error" : undefined}
                />
                {errors.name ? (
                  <p id="desk-name-error" className="text-destructive mt-1 text-xs">
                    {errors.name}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="desk-description">{t("desk_dialog.field_description")}</Label>
                <Textarea
                  id="desk-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={140}
                  rows={2}
                  disabled={pending}
                />
              </div>

              <div className="space-y-1.5">
                <Label>{t("desk_dialog.field_responsible")}</Label>
                <ResponsibleRepCombobox
                  reps={reps}
                  value={responsibleId}
                  onChange={(id) => {
                    setResponsibleId(id);
                    setErrors((prev) => ({ ...prev, responsible: undefined }));
                  }}
                  disabled={pending}
                />
                {errors.responsible ? (
                  <p className="text-destructive mt-1 text-xs">{errors.responsible}</p>
                ) : null}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  disabled={pending}
                >
                  {t("desk_dialog.cancel")}
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? t("desk_dialog.submit_pending") : t("desk_dialog.submit")}
                </Button>
              </div>
            </form>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
