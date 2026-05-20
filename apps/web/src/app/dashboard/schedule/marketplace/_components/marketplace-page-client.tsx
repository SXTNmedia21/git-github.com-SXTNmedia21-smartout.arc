"use client";

/**
 * MarketplacePageClient — manager open-shift marketplace view.
 *
 * Three tabs: Åpne / Krav i kø / Godkjent
 * - Åpne: open offers without a claimer. Manager can cancel.
 * - Krav i kø: offers in claimed state awaiting approval.
 *   Manager can Godkjenn (approve) or Avvis (cancel with reason).
 * - Godkjent: completed approved offers (read-only history).
 *
 * Motion: motionTokens.spring card enter, motionTokens.springSnappy badge.
 * Glassmorphism: bg-background/80 backdrop-blur-xl border gradient.
 * Icons: Lucide Check, X, Clock, CheckCircle, Calendar, Users, Store.
 *
 * References:
 *   ADR-0021 (Server + Client component pattern)
 *   ADR-0306 (shift_marketplace V1)
 *   Nordic Split design system (font-heading, CSS variables, motionTokens)
 */

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { motion as motionTokens } from "@smartout/design-tokens";
import { Check, X, Clock, CheckCircle2, Store, Calendar, Users, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  useMarketplaceOffers,
  useApproveClaim,
  useCancelOffer,
  type ManagerOffer,
} from "../_hooks/use-marketplace";

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    open: { label: "Åpen", className: "bg-info/10 text-info border-info/30" },
    claimed: { label: "Krav", className: "bg-warning/10 text-warning border-warning/30" },
    approved: {
      label: "Godkjent",
      className: "bg-success/10 text-success border-success/30",
    },
  };
  const { label, className } = config[status] ?? { label: status, className: "" };

  return (
    <motion.span
      layout
      transition={{ type: "spring", ...motionTokens.springSnappy }}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </motion.span>
  );
}

// ── Format helpers ────────────────────────────────────────────────────────────

function formatShiftTime(shift: ManagerOffer["shift"]): string {
  if (!shift) return "Ukjent tidspunkt";
  const date = new Date(shift.shift_date);
  const dateStr = date.toLocaleDateString("nb-NO", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  // start_time and end_time are time strings like "08:00:00"
  const start = shift.start_time.slice(0, 5);
  const end = shift.end_time.slice(0, 5);
  return `${dateStr} · ${start}–${end}`;
}

// ── Cancel dialog ─────────────────────────────────────────────────────────────

function CancelDialog({
  offer,
  open,
  onClose,
}: {
  offer: ManagerOffer | null;
  open: boolean;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const cancelOffer = useCancelOffer();

  function handleSubmit() {
    if (!offer || reason.trim().length < 5) return;
    cancelOffer.mutate(
      { offerId: offer.schedule_shift_offer_id, reason: reason.trim() },
      {
        onSuccess: () => {
          setReason("");
          onClose();
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="border-border bg-background/90 backdrop-blur-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-foreground text-lg">
            Avvis / kanseller tilbud
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-muted-foreground text-sm">
            {offer ? formatShiftTime(offer.shift) : ""}
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="cancel-reason" className="text-sm">
              Årsak (påkrevd)
            </Label>
            <Textarea
              id="cancel-reason"
              placeholder="Forklar hvorfor tilbudet kanselleres…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="text-sm"
            />
            {reason.trim().length > 0 && reason.trim().length < 5 && (
              <p className="text-destructive text-xs">Minimum 5 tegn.</p>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={cancelOffer.isPending}>
            Avbryt
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleSubmit}
            disabled={reason.trim().length < 5 || cancelOffer.isPending}
          >
            {cancelOffer.isPending ? "Kansellerer…" : "Kanseller tilbud"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Offer card ────────────────────────────────────────────────────────────────

function OfferCard({
  offer,
  onApprove,
  onCancel,
}: {
  offer: ManagerOffer;
  onApprove?: (offerId: string) => void;
  onCancel?: (offer: ManagerOffer) => void;
}) {
  const approveClaim = useApproveClaim();

  function handleApprove() {
    if (!onApprove) return;
    approveClaim.mutate({ offerId: offer.schedule_shift_offer_id });
    onApprove(offer.schedule_shift_offer_id);
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: "spring", ...motionTokens.spring }}
      className="border-border/60 bg-background/80 group relative overflow-hidden rounded-xl border backdrop-blur-xl"
    >
      {/* Gradient edge highlight — Nordic Split glassmorphism recipe */}
      <div className="from-border/30 to-border/5 pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br" />

      <div className="relative flex items-start justify-between gap-4 p-4">
        {/* Left: shift info */}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={offer.status} />
            {offer.shift?.role && (
              <span className="text-muted-foreground text-xs font-medium">{offer.shift.role}</span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <Calendar className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
            <span className="text-foreground text-sm font-medium">
              {formatShiftTime(offer.shift)}
            </span>
          </div>

          {offer.claimed_by_profile_id && offer.status === "claimed" && (
            <div className="flex items-center gap-1.5">
              <Users className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
              <span className="text-muted-foreground text-xs">Krevd av ansatt</span>
            </div>
          )}

          {offer.approved_at && (
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="text-success h-3.5 w-3.5 shrink-0" />
              <span className="text-muted-foreground text-xs">
                Godkjent{" "}
                {new Date(offer.approved_at).toLocaleDateString("nb-NO", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          )}

          {offer.expires_at && offer.status === "open" && (
            <div className="flex items-center gap-1.5">
              <Clock className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
              <span className="text-muted-foreground text-xs">
                Utløper{" "}
                {new Date(offer.expires_at).toLocaleDateString("nb-NO", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          )}
        </div>

        {/* Right: action buttons */}
        <div className="flex shrink-0 items-center gap-1.5">
          {offer.status === "claimed" && (
            <Button
              size="sm"
              variant="outline"
              className="border-success/40 text-success hover:bg-success/10 h-8 gap-1.5 px-3 text-xs"
              onClick={handleApprove}
              disabled={approveClaim.isPending}
            >
              <Check className="h-3.5 w-3.5" />
              Godkjenn
            </Button>
          )}

          {(offer.status === "open" || offer.status === "claimed") && onCancel && (
            <Button
              size="sm"
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 h-8 gap-1.5 px-3 text-xs"
              onClick={() => onCancel(offer)}
            >
              <X className="h-3.5 w-3.5" />
              Avvis
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ label }: { label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", ...motionTokens.spring }}
      className="border-border/40 bg-background/60 flex flex-col items-center gap-3 rounded-xl border py-12 backdrop-blur-xl"
    >
      <Store className="text-muted-foreground/40 h-10 w-10" />
      <p className="text-muted-foreground text-sm">{label}</p>
    </motion.div>
  );
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

type Tab = "open" | "claimed" | "approved";

const TABS: { id: Tab; label: string }[] = [
  { id: "open", label: "Åpne" },
  { id: "claimed", label: "Krav i kø" },
  { id: "approved", label: "Godkjent" },
];

// ── Main client component ─────────────────────────────────────────────────────

export function MarketplacePageClient() {
  const [activeTab, setActiveTab] = useState<Tab>("open");
  const [cancelTarget, setCancelTarget] = useState<ManagerOffer | null>(null);

  const { data, isLoading, error } = useMarketplaceOffers();

  const tabOffers: Record<Tab, ManagerOffer[]> = {
    open: data?.open ?? [],
    claimed: data?.claimed ?? [],
    approved: data?.approved ?? [],
  };

  const tabCounts: Record<Tab, number> = {
    open: tabOffers.open.length,
    claimed: tabOffers.claimed.length,
    approved: tabOffers.approved.length,
  };

  const emptyLabels: Record<Tab, string> = {
    open: "Ingen åpne tilbud for øyeblikket.",
    claimed: "Ingen krav venter på godkjenning.",
    approved: "Ingen godkjente tilbud ennå.",
  };

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-4 md:p-6 lg:p-8">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Store className="text-muted-foreground h-6 w-6" />
        <h1 className="font-heading text-foreground text-2xl font-semibold tracking-tight">
          Vakt-markedsplass
        </h1>
      </div>

      {/* Error state */}
      {error && (
        <div className="border-destructive/30 bg-destructive/10 flex items-center gap-2 rounded-lg border px-4 py-3">
          <AlertCircle className="text-destructive h-4 w-4 shrink-0" />
          <p className="text-destructive text-sm">Kunne ikke laste markedsplassen. Prøv igjen.</p>
        </div>
      )}

      {/* Tab bar */}
      <div className="border-border/40 flex gap-1 rounded-xl border p-1" role="tablist">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const count = tabCounts[tab.id];
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={[
                "relative flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {isActive && (
                <motion.span
                  layoutId="tab-indicator"
                  className="bg-background absolute inset-0 rounded-lg shadow-sm"
                  transition={{ type: "spring", ...motionTokens.springSnappy }}
                />
              )}
              <span className="relative">{tab.label}</span>
              {count > 0 && (
                <motion.span
                  layout
                  transition={{ type: "spring", ...motionTokens.springSnappy }}
                  className={[
                    "relative min-w-5 rounded-full px-1.5 py-0.5 text-center text-xs leading-none font-semibold tabular-nums",
                    tab.id === "claimed"
                      ? "bg-warning/20 text-warning"
                      : tab.id === "open"
                        ? "bg-info/20 text-info"
                        : "bg-success/20 text-success",
                  ].join(" ")}
                >
                  {count}
                </motion.span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="border-border/40 bg-muted/20 h-20 animate-pulse rounded-xl border"
              />
            ))}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ type: "spring", ...motionTokens.spring }}
              className="space-y-3"
            >
              {tabOffers[activeTab].length === 0 ? (
                <EmptyState label={emptyLabels[activeTab]} />
              ) : (
                tabOffers[activeTab].map((offer) => (
                  <OfferCard
                    key={offer.schedule_shift_offer_id}
                    offer={offer}
                    onApprove={activeTab === "claimed" ? () => {} : undefined}
                    onCancel={activeTab !== "approved" ? (o) => setCancelTarget(o) : undefined}
                  />
                ))
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Cancel dialog */}
      <CancelDialog
        offer={cancelTarget}
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
      />
    </div>
  );
}
