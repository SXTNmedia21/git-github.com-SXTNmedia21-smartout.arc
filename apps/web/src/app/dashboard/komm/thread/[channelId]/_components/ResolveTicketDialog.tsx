"use client";

/**
 * ResolveTicketDialog — Spec §2.4.
 *
 * Glass dialog with an optional 4-line Textarea for a resolution note.
 * Submits via the resolveTicketAction Server Action. On success the
 * parent swaps the header status orb → complete and the button → badge.
 *
 * Phase 2 polish (prototype-aligned): heading in Instrument Serif, primary
 * button in brand-orange to match the [Løs sak] button in the new header
 * bar. Spring physics respect useReducedMotion.
 */

import * as React from "react";
import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "@smartout/i18n";
import { resolveTicketAction } from "../_actions/resolve-ticket";

export type ResolveTicketDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string;
  currentUserName: string;
  requesterName: string;
  onResolved: () => void;
};

export function ResolveTicketDialog({
  open,
  onOpenChange,
  ticketId,
  currentUserName,
  requesterName,
  onResolved,
}: ResolveTicketDialogProps) {
  const { t } = useTranslation("helpdesk");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const prefersReducedMotion = useReducedMotion();

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await resolveTicketAction({
        ticket_id: ticketId,
        resolution_note: note.trim() || undefined,
      });
      if (result.ok) {
        toast.success(t("toast.ticket_resolved", { requester: requesterName }));
        onResolved();
        setNote("");
        onOpenChange(false);
      } else {
        toast.error(t("toast.ticket_resolve_failed"));
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="bg-background/80 border-border max-w-[440px] overflow-hidden border p-0 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_24px_60px_-20px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
          transition={
            prefersReducedMotion
              ? { duration: 0.2 }
              : { type: "spring", stiffness: 34, damping: 22, mass: 2.3 }
          }
        >
          <div className="via-border h-px bg-gradient-to-r from-transparent to-transparent" />
          <div className="p-8">
            <DialogHeader>
              <DialogTitle
                className="font-heading text-foreground text-2xl"
                style={{ letterSpacing: "-0.01em" }}
              >
                {t("ticket_resolve_dialog.title")}
              </DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground mt-2 text-sm">
              {t("ticket_resolve_dialog.lede", {
                name: currentUserName,
                requester: requesterName,
              })}
            </p>
            <form
              className="mt-5 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="resolution-note">{t("ticket_resolve_dialog.field_label")}</Label>
                <Textarea
                  id="resolution-note"
                  autoFocus
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t("ticket_resolve_dialog.field_placeholder")}
                  rows={4}
                  maxLength={280}
                  disabled={pending}
                />
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
                <Button
                  type="submit"
                  disabled={pending}
                  className="gap-1.5 text-white"
                  style={{
                    background: "var(--brand-orange)",
                    boxShadow: "0 2px 12px oklch(0.65 0.22 40 / 0.25)",
                  }}
                >
                  {!pending ? <Check size={14} strokeWidth={2.25} aria-hidden="true" /> : null}
                  {pending ? t("ticket_action.resolve_pending") : t("ticket_resolve_dialog.submit")}
                </Button>
              </div>
            </form>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
