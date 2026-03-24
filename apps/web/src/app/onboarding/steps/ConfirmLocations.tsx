"use client";

/**
 * ConfirmLocations — Step 3 of onboarding confirmation wizard.
 *
 * Shows location cards with zones. Pre-filled from scraping.
 * User can add/remove locations and zones.
 * Reuses patterns from the existing LocationsSection.
 */

import { useState } from "react";
import { MapPin, Plus, X, Layers } from "lucide-react";
import type { WizardStepProps } from "@smartout/ui";
import type { OnboardingConfirmState } from "../types-v2";
import type { LocationData } from "../types";

const TYPE_LABELS: Record<string, string> = {
  main: "Hovedlokale",
  outdoor: "Uteservering",
  satellite: "Filial",
  other: "Annet",
};

export function ConfirmLocations({
  state,
  updateState,
  next,
  t,
}: WizardStepProps<OnboardingConfirmState>) {
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [locationName, setLocationName] = useState("");
  const [locationType, setLocationType] = useState<LocationData["type"]>("main");
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
          type: locationType,
          zones: [],
        },
      ],
    });
    setLocationName("");
    setShowLocationInput(false);
    setLocationType("main");
  }

  function removeLocation(id: string) {
    updateState({
      locations: locations.filter((l) => l.id !== id),
    });
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

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-12">
      <div>
        <h2 className="font-heading text-foreground text-3xl tracking-tight">
          {t("confirm.locations_title")}
        </h2>
        <p className="text-muted-foreground mt-2 text-base">{t("confirm.locations_description")}</p>
      </div>

      {/* Location cards */}
      <div className="flex flex-col gap-4">
        {locations.map((loc) => (
          <div key={loc.id} className="border-border bg-card rounded-2xl border p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MapPin className="text-muted-foreground size-4" />
                <span className="text-foreground text-lg font-medium">{loc.name}</span>
                <span className="text-muted-foreground text-sm">{TYPE_LABELS[loc.type]}</span>
              </div>
              <button
                type="button"
                onClick={() => removeLocation(loc.id)}
                className="text-muted-foreground/50 hover:text-foreground p-1 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Zones */}
            <div className="mt-4">
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <Layers className="size-3" />
                <span>Soner</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {loc.zones.map((zone) => (
                  <span
                    key={zone.id}
                    className="group border-border bg-muted/50 text-foreground flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm"
                  >
                    {zone.name}
                    <button
                      type="button"
                      onClick={() => removeZone(loc.id, zone.id)}
                      className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}

                {activeZoneInput === loc.id ? (
                  <div className="flex items-center gap-2">
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
                      placeholder="Sonenavn"
                      className="border-border bg-background text-foreground placeholder:text-muted-foreground/40 focus:border-primary rounded-xl border px-3 py-1.5 text-sm outline-none"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => addZone(loc.id)}
                      className="bg-primary/10 text-foreground hover:bg-primary/20 rounded-xl px-2.5 py-1.5 text-sm"
                    >
                      Legg til
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveZoneInput(null);
                        setZoneName("");
                      }}
                      className="text-muted-foreground hover:text-foreground p-1"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveZoneInput(loc.id)}
                    className="border-border text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-xl border border-dashed px-3 py-1.5 text-sm transition-colors"
                  >
                    <Plus className="size-3" />
                    Sone
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Add location */}
        {showLocationInput ? (
          <div className="border-border bg-card rounded-2xl border p-6">
            <div className="flex flex-col gap-4">
              <input
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addLocation()}
                placeholder="Navn pa lokasjon"
                className="border-border bg-background text-foreground placeholder:text-muted-foreground/40 focus:border-primary rounded-xl border px-4 py-3 outline-none"
                autoFocus
              />
              <div className="flex flex-wrap gap-2">
                {(["main", "outdoor", "satellite", "other"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setLocationType(type)}
                    className={`rounded-xl px-3 py-2 text-sm transition-colors ${
                      locationType === type
                        ? "bg-primary/15 text-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={addLocation}
                  className="bg-primary/10 text-foreground hover:bg-primary/20 flex-1 rounded-xl py-3 transition-colors"
                >
                  Legg til
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLocationInput(false);
                    setLocationName("");
                  }}
                  className="text-muted-foreground hover:text-foreground px-4 py-3 transition-colors"
                >
                  Avbryt
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowLocationInput(true)}
            className="border-border text-muted-foreground hover:border-border/80 hover:text-foreground flex items-center justify-center gap-2 rounded-2xl border border-dashed py-5 transition-colors"
          >
            <Plus className="size-4" />
            Legg til lokasjon
          </button>
        )}
      </div>

      {/* Continue button */}
      <button
        type="button"
        onClick={next}
        className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold transition-colors"
      >
        {t("confirm.procedures_title")} &rarr;
      </button>
    </div>
  );
}
