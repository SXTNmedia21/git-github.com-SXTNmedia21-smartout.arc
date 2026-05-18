"use client";

/**
 * SlotPicker — 3-lane popover for adding items to a time slot on the Dagslinjen.
 *
 * Replaces SlotQuickAddPopover at the mount site in TimelineTab (T5).
 * The old SlotQuickAddPopover.tsx is retained for the T7 E2E green gate; T7
 * will remove it after E2E is green.
 *
 * Lanes (per Frame 2 mockup):
 *   PRODUKSJON (D6): Hook, Oppgave, Notat, Avvik
 *   BEMANNING  (D2): Vakt
 *   FRI TEKST      : Fri tekst (opens FreeFormChipDialog)
 *
 * Location scope variant: Bemanning stays enabled; Produksjon + FRI TEKST items
 * are disabled with tooltip "Lokasjons-malt godtar kun vakter".
 *
 * Keyboard nav: chips tabIndex=0, arrow-key within lanes, Tab between lanes.
 * ARIA: dialog-labelled popover with role="listbox" per lane.
 *
 * Spec ref: docs/superpowers/specs/2026-05-16-timeline-templates-design.md §Build
 * ADR ref:  ADR-0334
 */

import { useRef } from "react";
import { Anchor, AlertTriangle, CheckCircle2, LogIn, StickyNote, Type, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { motion as motionTokens } from "@smartout/design-tokens";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@smartout/ui";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SlotPickerAction = "hook" | "task" | "note" | "deviation" | "shift" | "free_form";

type WorkspaceRole = "employee" | "manager" | "admin" | "owner";

export type SlotPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** HH:MM anchor time. */
  time: string;
  /** Scoped to location — disables all non-shift lanes. */
  isLocationScope?: boolean;
  /** Current user role — employees see nothing. */
  role: WorkspaceRole | null;
  /** Called when user picks an action (caller opens the corresponding dialog). */
  onAction: (action: SlotPickerAction, time: string) => void;
  /**
   * Anchor element — invisible 1×1 span positioned at the click coordinate
   * by the caller. Popover content positions relative to this anchor so the
   * menu opens at the click point rather than at the strip wrapper.
   */
  anchor?: React.ReactNode;
  /**
   * day_line_id that owns this slot picker context.
   * Added in ADR-0367 C-T1 — forwarded to action handlers so multi-strip
   * TimelineTab knows which line an action targets.
   */
  dayLineId?: string;
  /** Planned open time for the owning day_line (HH:MM:SS). Context for action handlers. */
  plannedOpen?: string;
  /** Planned close time for the owning day_line (HH:MM:SS). Context for action handlers. */
  plannedClose?: string;
};

// ── Lane item definitions ──────────────────────────────────────────────────────

type LaneItem = {
  action: SlotPickerAction;
  label: string;
  Icon: typeof CheckCircle2;
  description: string;
  iconClass: string;
};

const D6_ITEMS: LaneItem[] = [
  {
    action: "hook",
    label: "Hook",
    Icon: Anchor,
    description: "Åpnings-, lukke- eller planlagt hook",
    iconClass:
      "bg-[oklch(0.90_0.04_250)] border-[oklch(0.80_0.08_250)] text-[oklch(0.30_0.14_250)]",
  },
  {
    action: "task",
    label: "Oppgave",
    Icon: CheckCircle2,
    description: "Frittstående oppgave for sesjonen",
    iconClass:
      "bg-[oklch(0.90_0.04_145)] border-[oklch(0.78_0.10_145)] text-[oklch(0.28_0.14_145)]",
  },
  {
    action: "note",
    label: "Notat",
    Icon: StickyNote,
    description: "Sesjonsnotat for dagen",
    iconClass: "bg-[oklch(0.90_0.04_55)] border-[oklch(0.80_0.08_55)] text-[oklch(0.30_0.10_55)]",
  },
  {
    action: "deviation",
    label: "Avvik",
    Icon: AlertTriangle,
    description: "Registrer et avvik",
    iconClass: "bg-[oklch(0.90_0.04_25)] border-[oklch(0.78_0.10_25)] text-[oklch(0.32_0.14_25)]",
  },
];

const D2_ITEMS: LaneItem[] = [
  {
    action: "shift",
    label: "Vakt",
    Icon: LogIn,
    description: "Legg til et vaktslot",
    iconClass:
      "bg-[oklch(0.90_0.04_310)] border-[oklch(0.78_0.10_310)] text-[oklch(0.30_0.14_310)]",
  },
];

const FREE_ITEMS: LaneItem[] = [
  {
    action: "free_form",
    label: "Fri tekst",
    Icon: Type,
    description: "Tekstlapp — materialiseres ved bruk av mal",
    iconClass: "bg-[oklch(0.92_0.01_58)] border-[oklch(0.84_0.01_58)] text-[oklch(0.40_0.02_55)]",
  },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

type ItemButtonProps = {
  item: LaneItem;
  disabled?: boolean;
  disabledReason?: string;
  onAction: (action: SlotPickerAction) => void;
  laneRef: React.RefObject<HTMLDivElement | null>;
};

function ItemButton({ item, disabled, disabledReason, onAction, laneRef }: ItemButtonProps) {
  const { action, label, Icon, description, iconClass } = item;

  const btn = (
    <button
      type="button"
      disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onAction(action)}
      onKeyDown={(e) => {
        // Arrow key navigation within lane
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          const lane = laneRef.current;
          if (!lane) return;
          const btns = Array.from(
            lane.querySelectorAll<HTMLButtonElement>("button:not([disabled])"),
          );
          const idx = btns.indexOf(e.currentTarget as HTMLButtonElement);
          const next = e.key === "ArrowDown" ? btns[idx + 1] : btns[idx - 1];
          next?.focus();
        }
      }}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-2 text-left",
        "text-foreground transition-colors",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
        disabled ? "cursor-not-allowed opacity-45" : "hover:bg-muted cursor-pointer",
      )}
      aria-label={`${label}${disabled ? " (ikke tilgjengelig for lokasjonsmal)" : ""}`}
      data-testid={`slot-picker-action-${action}`}
    >
      <span
        className={cn(
          "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[calc(var(--radius)-2px)] border",
          iconClass,
        )}
        aria-hidden
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[13px] leading-tight font-medium">{label}</span>
        <span className="text-muted-foreground mt-0.5 text-[11px] leading-tight">
          {description}
        </span>
      </span>
    </button>
  );

  if (disabled && disabledReason) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {/* Wrapper span needed: disabled button can't trigger tooltip */}
            <span className="block">{btn}</span>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            {disabledReason}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return btn;
}

type LaneSectionProps = {
  label: string;
  items: LaneItem[];
  disabled?: boolean;
  disabledReason?: string;
  onAction: (action: SlotPickerAction) => void;
};

function LaneSection({ label, items, disabled, disabledReason, onAction }: LaneSectionProps) {
  const laneRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={laneRef}
      className="border-border border-b py-1 last:border-b-0"
      role="group"
      aria-label={label}
    >
      <p className="text-muted-foreground px-3 pt-1 pb-1 font-mono text-[10px] font-medium tracking-wider uppercase">
        {label}
      </p>
      {items.map((item) => (
        <ItemButton
          key={item.action}
          item={item}
          disabled={disabled}
          disabledReason={disabledReason}
          onAction={onAction}
          laneRef={laneRef}
        />
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function SlotPicker({
  open,
  onOpenChange,
  time,
  isLocationScope = false,
  role,
  onAction,
  anchor,
  dayLineId: _dayLineId,
  plannedOpen: _plannedOpen,
  plannedClose: _plannedClose,
}: SlotPickerProps) {
  const canWrite = role !== null && role !== "employee";
  const locationDisabledReason = "Lokasjons-malt godtar kun vakter";

  function handleAction(action: SlotPickerAction) {
    onAction(action, time);
    onOpenChange(false);
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {anchor ? <PopoverAnchor asChild>{anchor}</PopoverAnchor> : null}
      <PopoverContent
        className="w-[300px] p-0"
        align="center"
        side="bottom"
        sideOffset={6}
        collisionPadding={12}
        onInteractOutside={() => onOpenChange(false)}
        data-testid="slot-picker-popover"
      >
        <AnimatePresence>
          {open && canWrite && (
            <motion.div
              key="slot-picker-content"
              initial={{ opacity: 0, scale: 0.96, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -4 }}
              transition={{
                type: "spring",
                stiffness: motionTokens.springSnappy.stiffness,
                damping: motionTokens.springSnappy.damping,
                mass: motionTokens.springSnappy.mass,
              }}
              className="overflow-hidden rounded-[inherit]"
            >
              {/* Header */}
              <div className="border-border flex items-center justify-between border-b px-3 py-2.5">
                <p className="font-heading text-foreground text-sm">
                  Legg til kl <span className="font-mono font-medium">{time}</span>
                </p>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring flex h-5 w-5 items-center justify-center rounded focus-visible:ring-2 focus-visible:outline-none"
                  aria-label="Lukk"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>

              {/* Lane: PRODUKSJON */}
              <LaneSection
                label="PRODUKSJON"
                items={D6_ITEMS}
                disabled={isLocationScope}
                disabledReason={isLocationScope ? locationDisabledReason : undefined}
                onAction={handleAction}
              />

              {/* Lane: BEMANNING */}
              <LaneSection label="BEMANNING" items={D2_ITEMS} onAction={handleAction} />

              {/* Lane: FRI TEKST */}
              <LaneSection
                label="FRI TEKST"
                items={FREE_ITEMS}
                disabled={isLocationScope}
                disabledReason={isLocationScope ? locationDisabledReason : undefined}
                onAction={handleAction}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {open && !canWrite && (
          <div className="text-muted-foreground p-3 text-[12px]">
            Ingen tilgang — kun ledere kan legge til.
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
