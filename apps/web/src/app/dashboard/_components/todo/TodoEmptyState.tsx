"use client";

/**
 * Empty state shown when all cascade tasks are complete.
 * Displays a success icon with ambient orb glow and congratulatory message.
 */

import { CircleCheck } from "lucide-react";
import { useTranslation } from "@smartout/i18n";

export function TodoEmptyState() {
  const { t } = useTranslation("dashboard");
  return (
    <div
      className="flex flex-col items-center justify-center py-20 text-center"
      role="status"
      aria-live="polite"
    >
      {/* Ambient orb glow behind the icon — radial-gradient per Nordic Split */}
      <div className="relative">
        <div
          className="absolute inset-0 -m-12 rounded-full"
          style={{
            background:
              "radial-gradient(ellipse at center, oklch(0.75 0.15 145 / 0.12), transparent 70%)",
          }}
        />
        <div className="bg-success/20 relative flex h-20 w-20 items-center justify-center rounded-full">
          <CircleCheck className="text-success h-12 w-12" />
        </div>
      </div>

      <h2 className="font-heading text-foreground mt-6 text-lg">{t("todo.empty_title")}</h2>
      <p className="text-muted-foreground mt-1 text-sm">{t("todo.empty_description")}</p>
    </div>
  );
}
