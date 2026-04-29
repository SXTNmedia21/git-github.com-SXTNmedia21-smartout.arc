"use client";

/**
 * PanicConfirmDrawer.tsx — Two-step confirmation sheet for Tier 0 Panic Bar.
 *
 * WHY two steps: Panic Bar buttons are high-stakes (they create helpdesk tickets
 * via openHelpdeskTicketAction). One-tap-destructive is explicitly rejected in the
 * design spec §Tier 0. The first step shows what will happen; the second step is
 * the actual submit with a loading state.
 *
 * WHY Sheet not Drawer: shadcn Drawer is not installed in this workspace.
 * Sheet has an equivalent API (same Radix Dialog primitive, just slide-in from a
 * side). We use side="bottom" to achieve the same "drawer from below" UX.
 * If Drawer is installed later, rename Sheet* → Drawer* throughout.
 *
 * Fallback when no helpdesk configured (helpdeskChannelId = null):
 *   The confirmation step degrades to a mailto: link to the workspace owner email.
 *   This preserves the "something happened, I need help" intent even when
 *   helpdesk infrastructure is not set up.
 *
 * Design spec: docs/superpowers/specs/2026-04-28-dashboard-help-design.md §Tier 0
 * ADR-0219: /dashboard/help as Multi-Tier Hub
 * G3 merge-blocker: panic bar must never side-channel insert.
 */

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  openHelpdeskTicketAction,
  type OpenHelpdeskTicketInput,
} from "../_actions/open-helpdesk-ticket-action";

// ── Types ─────────────────────────────────────────────────────────────────

export type PanicCategory = "locked_out" | "shift_wrong" | "human";

export type PanicItem = {
  /** Machine category — maps to openHelpdeskTicketInput.panic_category */
  category: PanicCategory;
  /** Short label shown in button + sheet title */
  label: string;
  /** Longer description shown in drawer body to confirm what will happen */
  description: string;
  /** Summary string sent as the helpdesk ticket summary */
  summary: string;
};

type PanicConfirmDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PanicItem | null;
  /** UUID of the helpdesk channel. Null = no helpdesk → fallback to mailto. */
  helpdeskChannelId: string | null;
  /** Display name of the helpdesk channel for confirmation copy */
  helpdeskChannelName: string | null;
};

// ── Component ─────────────────────────────────────────────────────────────

export function PanicConfirmDrawer({
  open,
  onOpenChange,
  item,
  helpdeskChannelId,
  helpdeskChannelName,
}: PanicConfirmDrawerProps) {
  const [isPending, startTransition] = useTransition();
  // Track whether the action succeeded so we can show a post-success state
  const [submitted, setSubmitted] = useState(false);

  function handleOpenChange(next: boolean) {
    if (!next) {
      // Reset submitted state when drawer closes so next open is fresh
      setSubmitted(false);
    }
    onOpenChange(next);
  }

  function handleSubmit() {
    if (!item) return;

    // Fallback: no helpdesk configured → open mailto
    if (!helpdeskChannelId) {
      window.location.href =
        "mailto:support@smartout.no?subject=" +
        encodeURIComponent(`Panikk: ${item.label}`) +
        "&body=" +
        encodeURIComponent(item.summary);
      onOpenChange(false);
      return;
    }

    const input: OpenHelpdeskTicketInput = {
      desk_channel_id: helpdeskChannelId,
      summary: item.summary,
      panic_category: item.category,
    };

    startTransition(async () => {
      const result = await openHelpdeskTicketAction(input);
      if (result.ok) {
        setSubmitted(true);
        toast.success("Meldingen er sendt!", {
          description:
            "En representant vil kontakte deg snart via " + (helpdeskChannelName ?? "Komm"),
        });
      } else {
        toast.error("Noe gikk galt", { description: result.error });
        // Keep drawer open on error so user can retry or close deliberately
      }
    });
  }

  if (!item) return null;

  const channelDisplay = helpdeskChannelName ?? "e-post";

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-lg rounded-t-2xl pb-8"
        // Prevent accidental close during pending state
        onInteractOutside={isPending ? (e) => e.preventDefault() : undefined}
      >
        {submitted ? (
          // ── Post-success state ───────────────────────────────────────
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <SheetTitle className="text-lg font-semibold">Meldingen er sendt</SheetTitle>
            <SheetDescription className="text-sm">
              Du vil høre fra en representant via {channelDisplay} snart. Du kan lukke dette
              vinduet.
            </SheetDescription>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Lukk
            </Button>
          </div>
        ) : (
          // ── Confirmation step ────────────────────────────────────────
          <>
            <SheetHeader className="mb-4">
              <SheetTitle>{item.label}</SheetTitle>
              <SheetDescription>{item.description}</SheetDescription>
            </SheetHeader>

            {/* What will happen — explicit so user knows what they are confirming */}
            <div className="bg-muted/40 text-muted-foreground mb-6 rounded-lg border px-4 py-3 text-sm">
              {helpdeskChannelId ? (
                <>
                  Dette sender en melding til{" "}
                  <span className="text-foreground font-medium">{channelDisplay}</span>. En
                  representant tar kontakt med deg snart.
                </>
              ) : (
                <>
                  Ingen helpdesk er satt opp i ditt workspace ennå. Vi åpner e-postklienten din slik
                  at du kan sende meldingen manuelt.
                </>
              )}
            </div>

            <SheetFooter className="flex gap-2 sm:flex-row-reverse">
              <Button onClick={handleSubmit} disabled={isPending} className="min-w-28">
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sender…
                  </>
                ) : (
                  "Send melding"
                )}
              </Button>
              <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={isPending}>
                Avbryt
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
