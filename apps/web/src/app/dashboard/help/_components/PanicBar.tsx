"use client";

/**
 * PanicBar.tsx — Tier 0: Sticky emergency-exit bar for /dashboard/help.
 *
 * WHY sticky and first: "Ingen skal besøke uten å føle 100% trygghet og support."
 * Panic states (locked out, wrong shift, need human) are time-critical. WCAG 2.2
 * Consistent Help requires the emergency mechanism to be in the same place every
 * time. This bar sits above ALL content, sticky at top, 56px tall.
 *
 * WHY a confirmation drawer, not one-click: design spec §Tier 0 explicitly rejects
 * one-tap-destructive for high-stakes mutations. The drawer (PanicConfirmDrawer)
 * carries the two-step confirm + loading state. This component owns ONLY the three
 * trigger buttons.
 *
 * Fallback when helpdeskChannelId = null (no helpdesk configured):
 *   Buttons still show. The drawer degrades to a mailto: link. This avoids hiding
 *   the panic affordance just because infrastructure is missing.
 *
 * Orb dismissal: clicking a panic button fires a CustomEvent("panic-bar:activated")
 * so the corner orb (Runtime B) can dismiss itself for 30s per design spec
 * §Botsson dual-surface composition. The orb bridge listens for this event.
 *
 * Design spec: docs/superpowers/specs/2026-04-28-dashboard-help-design.md §Tier 0
 * ADR-0219: /dashboard/help as Multi-Tier Hub
 * WCAG 2.2 Consistent Help (3.2.6)
 */

import { useState } from "react";
import { KeyRound, CalendarX, MessageCircleHeart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PanicConfirmDrawer, type PanicItem } from "./PanicConfirmDrawer";

// ── Panic item definitions ────────────────────────────────────────────────
// Each item maps to one button and one confirmation drawer. The summary
// string becomes the helpdesk ticket summary (max 200 chars per schema).

const PANIC_ITEMS: PanicItem[] = [
  {
    category: "locked_out",
    label: "Jeg er låst ute",
    description:
      "Problemer med å logge inn, tilbakestille passord, eller MFA som ikke fungerer. Vi hjelper deg raskt.",
    summary: "Bruker er låst ute og trenger hjelp med tilgang",
  },
  {
    category: "shift_wrong",
    label: "Noe er feil med vakta",
    description:
      "Feil tid, feil dato, feil stilling, eller en vakt som ikke stemmer med det du ble fortalt.",
    summary: "Bruker rapporterer feil på vakt — krever gjennomgang",
  },
  {
    category: "human",
    label: "Jeg trenger et menneske",
    description:
      "Du trenger å snakke med en person, ikke en chatbot. Vi kobler deg til en representant.",
    summary: "Bruker ber om menneskelig kontakt — ingen robot",
  },
];

// ── Icon lookup ───────────────────────────────────────────────────────────
// Defined outside render to avoid re-creating on each render pass.

const ICONS: Record<PanicItem["category"], React.ElementType> = {
  locked_out: KeyRound,
  shift_wrong: CalendarX,
  human: MessageCircleHeart,
};

// ── Component ─────────────────────────────────────────────────────────────

export function PanicBar({
  helpdeskChannelId,
  helpdeskChannelName,
}: {
  helpdeskChannelId: string | null;
  helpdeskChannelName: string | null;
}) {
  const [activeItem, setActiveItem] = useState<PanicItem | null>(null);

  function openDrawer(item: PanicItem) {
    setActiveItem(item);
    // Notify corner orb to dismiss for 30s (non-blocking, best-effort).
    // The orb bridge (HelpVoiceToolsBridge) listens for this event.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("panic-bar:activated"));
    }
  }

  return (
    <>
      {/*
       * Sticky bar — z-40 so it sits above page content but below modal overlays (z-50).
       * h-14 = 56px per spec. border-b separates visually from page content below.
       * bg-background/95 + backdrop-blur: stays readable as content scrolls under it.
       */}
      <div
        className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 flex h-14 items-center justify-center gap-2 border-b px-4 backdrop-blur"
        role="navigation"
        aria-label="Nødhjelp-meny"
      >
        {PANIC_ITEMS.map((item) => {
          const Icon = ICONS[item.category];
          // M3.2 page-takeover: only the "human" target is in the v1 allow-list
          // (per ADR-0228). Other panic categories require their own ADR + seed
          // before they become takeover-addressable.
          const takeoverHandle = item.category === "human" ? "panic_bar_human" : undefined;
          return (
            <Button
              key={item.category}
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs font-medium"
              onClick={() => openDrawer(item)}
              aria-label={item.label}
              data-takeover={takeoverHandle}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">{item.label}</span>
              {/* Icon-only on xs; full label from sm */}
            </Button>
          );
        })}
      </div>

      {/* Two-step confirmation drawer — mounts once, item drives content */}
      <PanicConfirmDrawer
        open={activeItem !== null}
        onOpenChange={(open) => {
          if (!open) setActiveItem(null);
        }}
        item={activeItem}
        helpdeskChannelId={helpdeskChannelId}
        helpdeskChannelName={helpdeskChannelName}
      />
    </>
  );
}
