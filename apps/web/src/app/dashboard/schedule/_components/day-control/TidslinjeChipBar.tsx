/**
 * TidslinjeChipBar.tsx
 *
 * Chip-bar for the TidslinjeTab — multi-select location filter.
 * Renders an "Alle" reset chip plus one chip per location.
 *
 * State contract: parent owns selectedLocations (a Set<string>). This
 * component is stateless — no local useState. URL is intentionally NOT
 * used for this ephemeral filter (browser-back surprise; see L-0339).
 *
 * Visual recipe: Manager Timeline artifact `.chip` (lines 450-468)
 *   docs/domains/day-session/day-planner/project/Manager Timeline.html
 *   - Shape:    pill (rounded-full), height 28px (h-7), padding px-2.5
 *   - Type:     text-xs font-medium
 *   - Border:   1px border-border (inactive), border-foreground (active)
 *   - Inactive: bg-transparent + border-border + text-foreground + hover:bg-muted
 *   - Active:   bg-foreground + border-foreground + text-background (fg/bg INVERT)
 *
 * NOTE: Active state inverts foreground/background — NOT brand-orange.
 * This is the canonical Manager Timeline filter chip recipe.
 *
 * ADR compliance:
 *   - ADR-0361: no hardcoded palette tokens (zinc-*, orange-*, gray-*)
 *   - ADR-0366: no OKLCH literals in arbitrary values
 *   - WCAG 2.4.7: focus-visible:ring-2 + focus-visible:ring-ring on every button
 */
"use client";

import { useTranslation } from "@smartout/i18n";
import { cn } from "@smartout/ui";

export type LocationChip = { id: string; name: string };

type Props = {
  locations: ReadonlyArray<LocationChip>;
  selectedLocations: ReadonlySet<string>;
  onToggleLocation: (locationId: string) => void;
  onClearAll?: () => void;
};

/**
 * TidslinjeChipBar — multi-select location filter for slim TidslinjeTab.
 *
 * Visual contract: Manager Timeline artifact `.chip` recipe
 * (docs/domains/day-session/day-planner/project/Manager Timeline.html:450-468).
 * Inverts fg/bg on active state — NOT brand-orange. Local useState only
 * (URL = wrong state container for ephemeral bottom-sheet per L-0339).
 *
 * a11y: each chip is a button with aria-pressed; focus ring is mandatory
 * (added beyond artifact CSS) per WCAG 2.4.7.
 */
const CHIP_BASE =
  "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors duration-200 cursor-pointer select-none whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const CHIP_INACTIVE = "bg-transparent border-border text-foreground hover:bg-muted";
const CHIP_ACTIVE = "bg-foreground border-foreground text-background";

export function TidslinjeChipBar({
  locations,
  selectedLocations,
  onToggleLocation,
  onClearAll,
}: Props) {
  const { t } = useTranslation("dashboard");
  const allActive = selectedLocations.size === 0;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* "Alle" resets the filter — active when no location is selected */}
      <button
        type="button"
        aria-pressed={allActive}
        onClick={onClearAll}
        className={cn(CHIP_BASE, allActive ? CHIP_ACTIVE : CHIP_INACTIVE)}
      >
        {t("tidslinje.chip_all")}
      </button>

      {locations.map((loc) => {
        const isActive = selectedLocations.has(loc.id);
        return (
          <button
            key={loc.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onToggleLocation(loc.id)}
            className={cn(CHIP_BASE, isActive ? CHIP_ACTIVE : CHIP_INACTIVE)}
          >
            {loc.name}
          </button>
        );
      })}
    </div>
  );
}
