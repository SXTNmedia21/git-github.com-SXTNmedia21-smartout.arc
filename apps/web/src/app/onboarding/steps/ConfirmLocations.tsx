"use client";

/**
 * ConfirmLocations — Step 3 of onboarding confirmation wizard.
 *
 * Shows location cards with zones. Pre-filled from scraping.
 * User can add/remove locations and zones.
 * Design matches the Join wizard pattern (Nordic Split, max-w-lg for card layouts).
 */

import { useState } from "react";
import { Label } from "@/components/ui/label";
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
    <div className="mx-auto w-full max-w-lg space-y-6">
      <div>
        <h2 className="text-foreground text-2xl font-bold">{t("confirm.locations_title")}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("confirm.locations_description")}</p>
      </div>

      {/* Location cards */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">Lokasjoner</Label>
        <div className="space-y-2">
          {locations.map((loc) => (
            <div key={loc.id} className="border-border bg-card rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="text-muted-foreground size-4" />
                  <span className="text-foreground text-sm font-medium">{loc.name}</span>
                  <span className="text-muted-foreground text-xs">{TYPE_LABELS[loc.type]}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeLocation(loc.id)}
                  className="text-muted-foreground/50 hover:text-foreground p-1 transition-colors"
                >
                  <X className="size-3.5" />
                </button>
              </div>

              {/* Zones */}
              <div className="mt-3">
                <div className="text-muted-foreground flex items-center gap-1.5 text-[10px]">
                  <Layers className="size-2.5" />
                  <span>Soner</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {loc.zones.map((zone) => (
                    <span
                      key={zone.id}
                      className="group border-border bg-muted/50 text-foreground flex items-center gap-1 rounded-md border px-2 py-1 text-xs"
                    >
                      {zone.name}
                      <button
                        type="button"
                        onClick={() => removeZone(loc.id, zone.id)}
                        className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X className="size-2.5" />
                      </button>
                    </span>
                  ))}

                  {activeZoneInput === loc.id ? (
                    <div className="flex items-center gap-1.5">
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
                        className="border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-brand-orange/40 rounded-md border px-2 py-1 text-xs focus-visible:ring-2 focus-visible:outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => addZone(loc.id)}
                        className="bg-brand-orange/10 text-foreground hover:bg-brand-orange/20 rounded-md px-2 py-1 text-xs"
                      >
                        Legg til
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveZoneInput(null);
                          setZoneName("");
                        }}
                        className="text-muted-foreground hover:text-foreground p-0.5"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveZoneInput(loc.id)}
                      className="border-border text-muted-foreground hover:text-foreground flex items-center gap-1 rounded-md border border-dashed px-2 py-1 text-xs transition-colors"
                    >
                      <Plus className="size-2.5" />
                      Sone
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Add location */}
          {showLocationInput ? (
            <div className="border-border bg-card rounded-lg border p-4">
              <div className="space-y-3">
                <input
                  type="text"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addLocation()}
                  placeholder="Navn pa lokasjon"
                  className="border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-brand-orange/40 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                  autoFocus
                />
                <div className="flex flex-wrap gap-1.5">
                  {(["main", "outdoor", "satellite", "other"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setLocationType(type)}
                      className={`rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                        locationType === type
                          ? "bg-brand-orange/10 text-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={addLocation}
                    className="bg-brand-orange/10 text-foreground hover:bg-brand-orange/20 flex-1 rounded-md py-2 text-sm transition-colors"
                  >
                    Legg til
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowLocationInput(false);
                      setLocationName("");
                    }}
                    className="text-muted-foreground hover:text-foreground px-3 py-2 text-sm transition-colors"
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
              className="border-border text-muted-foreground hover:bg-accent flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-3 text-sm transition-colors"
            >
              <Plus className="size-3.5" />
              Legg til lokasjon
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
