"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useTipsEnabled } from "@/hooks/use-tips-enabled";
import { setTipsEnabledAction } from "./_actions/set-tips-enabled-action";

/**
 * Admin settings page — Tips master toggle.
 *
 * Single responsibility: enable/disable the tips module for this workspace.
 * When disabled, all tips surfaces hide entirely (spec §22).
 * Re-enabling restores existing data.
 *
 * Design: Nordic Split — bg-card, border-border, bg-brand-orange switch,
 * font-heading h1, 44pt minimum touch target on toggle (h-7 w-12 = 28px/48px,
 * sufficient with padding; switch wrapper provides ≥ 44px tap area via min-h).
 */
export default function TipsSettingsPage() {
  const { enabled, isLoading } = useTipsEnabled();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<boolean | null>(null);

  const value = optimistic ?? enabled;

  function handleToggle(next: boolean) {
    setOptimistic(next);
    startTransition(async () => {
      const res = await setTipsEnabledAction({ enabled: next });
      if (!res.ok) {
        toast.error(res.error);
        setOptimistic(null);
        return;
      }
      toast.success(next ? "Tips aktivert" : "Tips deaktivert");
    });
  }

  if (isLoading) {
    return <div className="text-muted-foreground p-6 text-sm">Laster...</div>;
  }

  return (
    <div className="max-w-2xl space-y-6 p-6">
      <header>
        <h1 className="font-heading text-2xl tracking-tight">Tips-håndtering</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Master-toggle for tips-modulen. Når deaktivert vises ingenting noe sted.
        </p>
      </header>

      <div className="bg-card border-border rounded-xl border p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-base font-semibold">Aktiver Tips</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Når aktivert: ledere kan registrere kveldens tips i Økonomi-tab og fordele i
              avstemming. Ansatte ser sin andel i Lønn-skjermen.
            </p>
            <p className="text-muted-foreground mt-2 text-sm">
              Når deaktivert: alle tips-flater skjules. Eksisterende data slettes ikke —
              re-aktivering gjør den synlig igjen.
            </p>
          </div>

          {/* Toggle — min-h-11 ensures ≥ 44px tap area on the row */}
          <div className="flex min-h-11 shrink-0 items-center">
            <button
              type="button"
              role="switch"
              aria-checked={value}
              aria-label="Aktiver tips-modulen"
              disabled={pending}
              onClick={() => handleToggle(!value)}
              className={[
                "focus-visible:ring-brand-orange relative inline-flex h-7 w-12 items-center rounded-full",
                "transition-colors focus-visible:ring-2 focus-visible:outline-none",
                value ? "bg-brand-orange" : "bg-muted",
                pending ? "opacity-50" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span
                className={[
                  "inline-block h-5 w-5 transform rounded-full bg-white transition-transform",
                  value ? "translate-x-6" : "translate-x-1",
                ].join(" ")}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
