"use client";

/**
 * BotssonAmbientChip — ambient "Spør Botsson" entry point.
 *
 * Fixed to the bottom-right of the hub only (caller decides placement; we
 * just absolute-position within a relatively-positioned hub container).
 * Uses CSS variables + warm hue (hue 40 glow) for brand feel. A subtle
 * every-4s pulse signals Botsson is available without being distracting.
 *
 * On click:
 *  - Dispatches the global `botsson:open` CustomEvent with `primeContext`
 *    `{ module: "contracts", scope }`. `BotssonProvider` listens and forwards
 *    the primeContext into the admin-chat view (see BotssonProvider.tsx:874).
 *  - Emits `contract.botsson_chip_invoked` telemetry with `surface=<scope>`.
 *
 * Respects `prefers-reduced-motion` via `useReducedMotion()` — no pulse
 * animation if the user has it disabled.
 */

import { motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { emit, nonEmpty } from "@smartout/telemetry";
type Props = {
  /** Workspace for the telemetry event. */
  workspaceId: string;
  /** Acting profile id for the telemetry event — non-null in practice; empty string is accepted by emit. */
  actorProfileId: string | null;
  /** Sub-surface the chip is rendered on (e.g. "hub" | "kontrakter" | "maler" | "bindinger"). */
  scope: string;
};

export function BotssonAmbientChip({ workspaceId, actorProfileId, scope }: Props) {
  const { t } = useTranslation("contracts");
  const reduceMotion = useReducedMotion();

  function handleClick() {
    window.dispatchEvent(
      new CustomEvent("botsson:open", {
        detail: {
          view: "admin-chat",
          primeContext: {
            module: "contracts",
            scope,
          },
        },
      }),
    );

    void emit({
      event: "contract.botsson_chip_invoked",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(actorProfileId, "actor_id"),
      properties: {
        entity: {
          entity_type: "workspace",
          entity_id: workspaceId,
          entity_label: "Contracts Hub",
        },
        data: {
          surface: scope,
        },
      },
    });
  }

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      // Entrance: spring envelope per Nordic Split (stiffness 35, damping 22, mass 2.2)
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 35, damping: 22, mass: 2.2 }}
      // Press: subtle scale per design doctrine
      whileTap={{ scale: 0.96 }}
      className="group bg-muted/80 text-foreground ring-border hover:bg-muted focus-visible:ring-ring fixed right-6 bottom-6 z-40 flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium ring-1 backdrop-blur-xl transition-colors duration-250 focus-visible:ring-2 focus-visible:outline-none"
      // Warm hue 40 glow — hand-tuned OKLCH value to match the brand palette
      // without pulling a token (this is a one-off ambient surface).
      style={{ boxShadow: "0 0 24px color-mix(in oklch, var(--brand-glow-warm) 22%, transparent)" }}
      aria-label={t("hub.ask_botsson")}
    >
      {/* Icon layer — pulses every 4s unless reduced-motion is requested */}
      <motion.span
        className="flex items-center justify-center"
        animate={
          reduceMotion
            ? undefined
            : {
                scale: [1, 1.12, 1],
                opacity: [0.85, 1, 0.85],
              }
        }
        transition={
          reduceMotion
            ? undefined
            : {
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }
        }
      >
        <Sparkles className="h-4 w-4" aria-hidden="true" />
      </motion.span>
      <span>{t("hub.ask_botsson")}</span>
    </motion.button>
  );
}
