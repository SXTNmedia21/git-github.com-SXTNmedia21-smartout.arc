/**
 * LegendChip — static visual reference for the year-wheel canvas.
 *
 * Why: the canvas packs several encodings into a small area (block status,
 * pin category, AI-suggested state, opening-hour override glyph). A single
 * always-visible chip keeps the reader oriented without per-element tooltips.
 *
 * Spec: docs/superpowers/specs/2026-04-20-year-wheel-redesign-design.md §3.6
 *
 * No state, no telemetry. Optional className for layout integration.
 */

import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

export function LegendChip({ className }: Props) {
  return (
    <div
      className={cn(
        "border-border bg-card text-muted-foreground inline-flex flex-wrap items-center gap-5 rounded-[12px] border px-4 py-2.5 text-[11px]",
        className,
      )}
      role="note"
      aria-label="Tegnforklaring for årshjulet"
    >
      {/* Block-status swatches — seasons on the canvas */}
      <div className="inline-flex items-center gap-2">
        <span
          aria-hidden="true"
          className="inline-block h-[10px] w-6 rounded-[2px] bg-[var(--brand-orange)] shadow-[0_2px_8px_color-mix(in_oklab,var(--brand-orange)_25%,transparent)]"
        />
        <span>Aktiv sesong</span>
      </div>
      <div className="inline-flex items-center gap-2">
        <span
          aria-hidden="true"
          className="inline-block h-[10px] w-6 rounded-[2px] border-[1.5px] border-dashed border-[var(--brand-orange)] bg-[color-mix(in_oklab,var(--brand-orange)_12%,var(--card))]"
        />
        <span>Utkast</span>
      </div>
      <div className="inline-flex items-center gap-2">
        <span
          aria-hidden="true"
          className="inline-block h-[10px] w-6 rounded-[2px] bg-[color-mix(in_oklab,var(--muted-foreground)_25%,var(--secondary))]"
        />
        <span>Arkivert</span>
      </div>

      {/* Vertical separator between block-status and pin-category groups */}
      <span aria-hidden="true" className="bg-border h-3.5 w-px" />

      {/* Pin-category dots — planning events on the canvas */}
      <div className="inline-flex items-center gap-2">
        <span
          aria-hidden="true"
          className="inline-block h-[10px] w-[10px] rounded-full bg-[var(--brand-orange)]"
        />
        <span>Kulturell / kommersiell</span>
      </div>
      <div className="inline-flex items-center gap-2">
        <span
          aria-hidden="true"
          className="bg-destructive inline-block h-[10px] w-[10px] rounded-full"
        />
        <span>Business-kritisk</span>
      </div>
      <div className="inline-flex items-center gap-2">
        <span
          aria-hidden="true"
          className="inline-block h-[10px] w-[10px] rounded-full bg-[var(--muted-foreground)]"
        />
        <span>Intern</span>
      </div>
      <div className="inline-flex items-center gap-2">
        <span
          aria-hidden="true"
          className="inline-block h-[10px] w-[10px] rounded-full border-2 border-dashed border-[var(--brand-orange)] bg-[color-mix(in_oklab,var(--brand-orange)_12%,var(--card))]"
        />
        <span>AI-foreslått</span>
      </div>

      {/* Opening-hour override marker — rendered inline on affected dates */}
      <div className="inline-flex items-center gap-2">
        <span aria-hidden="true" className="text-[13px] leading-none text-[var(--brand-orange)]">
          ◷
        </span>
        <span>Endrer åpningstid</span>
      </div>
    </div>
  );
}
