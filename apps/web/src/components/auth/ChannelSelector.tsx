"use client";

/**
 * ChannelSelector — dispatch-channel picker for invitation workflows.
 *
 * Surfaces four channels as toggle chips; admins multi-select which
 * dispatch surfaces should fire when an invitation is sent:
 *
 *   - link   (always available — the invite always has a URL)
 *   - email  (enabled in P1)
 *   - sms    (P2 — disabled, labelled "Kommer snart")
 *   - qr     (P2 — disabled, labelled "Kommer snart")
 *
 * Council decisions this encodes:
 *   Q6  = a   -> link + email enabled in P1; SMS + QR deferred
 *   L-0090    -> "disabled" is a display concern driven by props, not
 *                by the DB — callers pass `disabledChannels` so the
 *                deferral list can migrate channel-by-channel.
 *
 * Visual rules (Nordic Split):
 *   - `bg-muted` idle chips, warm tokens only
 *   - selected chips use `bg-brand-orange/15 text-brand-orange`
 *   - disabled chips fade to `bg-muted/30 text-muted-foreground/60`
 *   - "Kommer snart" renders as a caption *below* the chip (more
 *     discoverable than a tooltip, especially on touch surfaces)
 *   - Lucide icons only: Link2, Mail, MessageSquare, QrCode
 */

import { Link2, Mail, MessageSquare, QrCode } from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

export type Channel = "link" | "email" | "sms" | "qr";

type ChannelSelectorProps = {
  /** Channels currently selected. Multi-select: link + email can coexist. */
  selected: Channel[];
  /** Called with the next full selection when the user toggles a chip. */
  onChange: (next: Channel[]) => void;
  /**
   * Channels that should render in the "coming soon" disabled state.
   * Defaults to ["sms", "qr"] (P2 deferral per Auth Spec Council Q6=a).
   */
  disabledChannels?: Channel[];
  /** Caption under disabled chips. Defaults to "Kommer snart". */
  comingSoonLabel?: string;
};

type ChipDef = {
  id: Channel;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

// Label text is intentionally short — the chip row must not wrap awkwardly
// on the invite dialog which is narrower than the full page width.
const CHIPS: ChipDef[] = [
  { id: "link", label: "Lenke", icon: Link2 },
  { id: "email", label: "E-post", icon: Mail },
  { id: "sms", label: "SMS", icon: MessageSquare },
  { id: "qr", label: "QR", icon: QrCode },
];

const DEFAULT_DISABLED: Channel[] = ["sms", "qr"];

export function ChannelSelector({
  selected,
  onChange,
  disabledChannels = DEFAULT_DISABLED,
  comingSoonLabel = "Kommer snart",
}: ChannelSelectorProps) {
  const isDisabled = (id: Channel) => disabledChannels.includes(id);
  const isSelected = (id: Channel) => selected.includes(id);

  const toggle = (id: Channel) => {
    if (isDisabled(id)) return;
    if (isSelected(id)) {
      onChange(selected.filter((c) => c !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="flex flex-wrap items-start gap-3">
      {CHIPS.map((chip) => {
        const Icon = chip.icon;
        const disabled = isDisabled(chip.id);
        const active = isSelected(chip.id) && !disabled;

        return (
          <div key={chip.id} className="flex flex-col items-start gap-1">
            <button
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => toggle(chip.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5",
                "text-sm font-medium",
                "transition-[background-color,border-color,color] duration-200",
                "focus-visible:ring-brand-orange/40 focus-visible:ring-2 focus-visible:outline-none",
                disabled
                  ? "bg-muted/30 text-muted-foreground/60 border-border/40 cursor-not-allowed"
                  : active
                    ? "border-brand-orange/40 bg-brand-orange/15 text-brand-orange"
                    : "bg-muted text-foreground border-border hover:bg-muted/80",
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              <span>{chip.label}</span>
            </button>
            {disabled && (
              <span className="text-muted-foreground/70 px-1 text-[0.6875rem] tracking-wide">
                {comingSoonLabel}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
