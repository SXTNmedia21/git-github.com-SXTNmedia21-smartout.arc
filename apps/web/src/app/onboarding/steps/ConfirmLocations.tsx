"use client";

/**
 * ConfirmLocations — compact 2-column layout.
 *
 * Lighter design than the full card pattern. Each location is a
 * small row with zones as inline tags. Suggestions appear as
 * quick-add buttons below.
 */

import { useState } from "react";
import { MapPin, Plus, X, Layers } from "lucide-react";
import type { WizardStepProps } from "@smartout/ui";
import type { OnboardingConfirmState } from "../types-v2";
import type { LocationData } from "../types";
import { useRegisterTools } from "@/app/walkAi/_components/tool-registry";
import { useLocationsTools } from "./tools/locations-tools";

const TYPE_LABELS: Record<string, string> = {
  main: "Hovedlokale",
  outdoor: "Uteservering",
  kitchen: "Kjøkken",
  satellite: "Filial",
  other: "Annet",
};

const SUGGESTED_LOCATIONS: Array<{ name: string; type: LocationData["type"] }> = [
  { name: "Uteservering", type: "outdoor" },
  { name: "Lager", type: "other" },
  { name: "Personalrom", type: "other" },
];

export function ConfirmLocations({
  state,
  updateState,
  next,
  back,
  t,
}: WizardStepProps<OnboardingConfirmState>) {
  const tools = useLocationsTools(state, updateState, next, back);
  useRegisterTools("wizard-onboarding-locations", tools);

  const [showInput, setShowInput] = useState(false);
  const [locationName, setLocationName] = useState("");
  const [locationType, setLocationType] = useState<string>("main");
  const [activeZoneInput, setActiveZoneInput] = useState<string | null>(null);
  const [zoneName, setZoneName] = useState("");

  const locations = state.locations;

  function addLocation() {
    const trimmed = locationName.trim();
    if (!trimmed) return;
    updateState({
      locations: [
        ...locations,
        {
          id: `loc-${Date.now()}-${locations.length}`,
          name: trimmed,
          type: locationType as LocationData["type"],
          zones: [],
        },
      ],
    });
    setLocationName("");
    setShowInput(false);
    setLocationType("main");
  }

  function removeLocation(id: string) {
    updateState({ locations: locations.filter((l) => l.id !== id) });
  }

  function addZone(locationId: string) {
    const trimmed = zoneName.trim();
    if (!trimmed) return;
    updateState({
      locations: locations.map((loc) =>
        loc.id === locationId
          ? {
              ...loc,
              zones: [
                ...loc.zones,
                { id: `zone-${Date.now()}-${loc.zones.length}`, name: trimmed },
              ],
            }
          : loc,
      ),
    });
    setZoneName("");
    setActiveZoneInput(null);
  }

  function removeZone(locationId: string, zoneId: string) {
    updateState({
      locations: locations.map((loc) =>
        loc.id === locationId ? { ...loc, zones: loc.zones.filter((z) => z.id !== zoneId) } : loc,
      ),
    });
  }

  const unusedSuggestions = SUGGESTED_LOCATIONS.filter(
    (s) => !locations.some((l) => l.name === s.name),
  );

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div>
        <h2 className="text-foreground text-2xl font-bold">{t("confirm.locations_title")}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("confirm.locations_description")}</p>
      </div>

      {/* Location grid — 2 columns */}
      <div className="grid grid-cols-2 gap-2">
        {locations.map((loc) => (
          <div key={loc.id} className="border-border rounded-lg border px-3 py-2.5">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-1.5">
                <MapPin className="text-muted-foreground size-3.5 shrink-0" />
                <div>
                  <span className="text-foreground text-xs leading-tight font-medium">
                    {loc.name}
                  </span>
                  <span className="text-muted-foreground ml-1 text-[10px]">
                    {TYPE_LABELS[loc.type]}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeLocation(loc.id)}
                className="text-muted-foreground/40 hover:text-foreground -mt-0.5 -mr-1 p-0.5 transition-colors"
              >
                <X className="size-3" />
              </button>
            </div>

            {/* Zones */}
            <div className="mt-2">
              <div className="text-muted-foreground flex items-center gap-1 text-[9px]">
                <Layers className="size-2" />
                Soner
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {loc.zones.map((zone) => (
                  <span
                    key={zone.id}
                    className="group border-border bg-muted/50 text-foreground flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px]"
                  >
                    {zone.name}
                    <button
                      type="button"
                      onClick={() => removeZone(loc.id, zone.id)}
                      className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X className="size-2" />
                    </button>
                  </span>
                ))}

                {activeZoneInput === loc.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={zoneName}
                      onChange={(e) => setZoneName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addZone(loc.id);
                        if (e.key === "Escape") {
                          setActiveZoneInput(null);
                          setZoneName("");
                        }
                      }}
                      placeholder="Sone"
                      className="border-border bg-background text-foreground placeholder:text-muted-foreground w-16 rounded border px-1.5 py-0.5 text-[10px] focus-visible:outline-none"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => addZone(loc.id)}
                      className="text-[10px] font-medium text-[var(--brand-orange)]"
                    >
                      OK
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveZoneInput(loc.id)}
                    className="border-border text-muted-foreground hover:text-foreground flex items-center gap-0.5 rounded border border-dashed px-1.5 py-0.5 text-[10px] transition-colors"
                  >
                    <Plus className="size-2" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick-add suggestions */}
      {unusedSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {unusedSuggestions.map((s) => (
            <button
              key={s.name}
              type="button"
              onClick={() => {
                updateState({
                  locations: [
                    ...locations,
                    {
                      id: `loc-${Date.now()}-${locations.length}`,
                      name: s.name,
                      type: s.type,
                      zones: [],
                    },
                  ],
                });
              }}
              className="border-border text-muted-foreground hover:text-foreground flex items-center gap-1 rounded-lg border border-dashed px-2.5 py-1.5 text-xs transition-colors hover:border-[var(--brand-orange)]/30 hover:bg-[var(--brand-orange)]/5"
            >
              <Plus className="size-3" />
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* Custom location */}
      {showInput ? (
        <div className="border-border rounded-lg border p-3">
          <input
            type="text"
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addLocation()}
            placeholder="Navn på lokasjon"
            className="border-border bg-background text-foreground placeholder:text-muted-foreground w-full rounded-md border px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/40 focus-visible:outline-none"
            autoFocus
          />
          <div className="mt-2 flex flex-wrap gap-1">
            {(["main", "outdoor", "kitchen", "other"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setLocationType(type)}
                className={`rounded px-2 py-1 text-[10px] transition-colors ${
                  locationType === type
                    ? "text-foreground bg-[var(--brand-orange)]/10"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {TYPE_LABELS[type]}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={addLocation}
              className="text-foreground flex-1 rounded-md bg-[var(--brand-orange)]/10 py-1.5 text-xs transition-colors hover:bg-[var(--brand-orange)]/20"
            >
              Legg til
            </button>
            <button
              type="button"
              onClick={() => {
                setShowInput(false);
                setLocationName("");
              }}
              className="text-muted-foreground hover:text-foreground px-3 py-1.5 text-xs transition-colors"
            >
              Avbryt
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowInput(true)}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-1 text-xs transition-colors"
        >
          <Plus className="size-3.5" />
          Egendefinert lokasjon
        </button>
      )}
    </div>
  );
}
