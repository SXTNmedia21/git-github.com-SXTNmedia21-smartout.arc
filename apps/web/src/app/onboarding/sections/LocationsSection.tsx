"use client";

import { useState } from "react";
import { MapPin, Plus, X, Layers } from "lucide-react";
import { useOnboarding } from "../WizardContext";
import { SectionReveal, RevealItem } from "../components/SectionReveal";

export function LocationsSection() {
  const { locations, addLocation, removeLocation, addZone, removeZone, completeSection } =
    useOnboarding();

  const [showLocationInput, setShowLocationInput] = useState(false);
  const [locationName, setLocationName] = useState("");
  const [locationType, setLocationType] = useState<"main" | "outdoor" | "satellite" | "other">(
    "main",
  );

  const [activeZoneInput, setActiveZoneInput] = useState<string | null>(null);
  const [zoneName, setZoneName] = useState("");

  function handleAddLocation() {
    const trimmed = locationName.trim();
    if (!trimmed) return;
    addLocation(trimmed, locationType);
    setLocationName("");
    setShowLocationInput(false);
    setLocationType("main");
  }

  function handleAddZone(locationId: string) {
    const trimmed = zoneName.trim();
    if (!trimmed) return;
    addZone(locationId, trimmed);
    setZoneName("");
    setActiveZoneInput(null);
  }

  const typeLabels: Record<string, string> = {
    main: "Hovedlokale",
    outdoor: "Uteservering",
    satellite: "Filial",
    other: "Annet",
  };

  return (
    <SectionReveal>
      <RevealItem>
        <h2 className="font-heading text-6xl leading-[1.1] tracking-tight text-white">
          Lokasjoner
        </h2>
      </RevealItem>

      <RevealItem>
        <p className="mt-4 text-xl leading-relaxed text-white/50">
          Hvor holder dere til? Legg til lokaler og definer soner innenfor hvert sted.
        </p>
      </RevealItem>

      <RevealItem>
        <div className="mt-8 flex flex-col gap-4">
          {locations.map((loc) => (
            <div
              key={loc.id}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.07] p-6 shadow-lg shadow-black/20"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MapPin className="size-5 text-white/40" />
                  <div>
                    <span className="text-lg font-medium text-white">{loc.name}</span>
                    <span className="ml-2 text-sm text-white/40">{typeLabels[loc.type]}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeLocation(loc.id)}
                  className="p-1 text-white/30 transition-colors hover:text-white/60"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Zones */}
              <div className="mt-4">
                <div className="flex items-center gap-2 text-sm text-white/40">
                  <Layers className="size-3.5" />
                  <span>Soner</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {loc.zones.map((zone) => (
                    <span
                      key={zone.id}
                      className="group flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/10 px-3 py-1.5 text-sm text-white/70"
                    >
                      {zone.name}
                      <button
                        type="button"
                        onClick={() => removeZone(loc.id, zone.id)}
                        className="text-white/30 opacity-0 transition-opacity group-hover:opacity-100"
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
                          if (e.key === "Enter") handleAddZone(loc.id);
                          if (e.key === "Escape") {
                            setActiveZoneInput(null);
                            setZoneName("");
                          }
                        }}
                        placeholder="Sonenavn"
                        className="rounded-lg border border-white/[0.08] bg-white/5 px-3 py-1.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/20"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleAddZone(loc.id)}
                        className="rounded-lg bg-white/10 px-2.5 py-1.5 text-sm text-white transition-colors hover:bg-white/15"
                      >
                        Legg til
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveZoneInput(null);
                          setZoneName("");
                        }}
                        className="p-1 text-white/30 hover:text-white/60"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveZoneInput(loc.id)}
                      className="flex items-center gap-1.5 rounded-lg border border-dashed border-white/[0.1] px-3 py-1.5 text-sm text-white/40 transition-colors hover:text-white/60"
                    >
                      <Plus className="size-3" />
                      Sone
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {showLocationInput ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.07] p-6 shadow-lg shadow-black/20">
              <div className="flex flex-col gap-4">
                <input
                  type="text"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddLocation();
                  }}
                  placeholder="Navn p&aring; lokasjon"
                  className="rounded-xl border border-white/[0.06] bg-white/5 px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-white/20"
                  autoFocus
                />
                <div className="flex flex-wrap gap-2">
                  {(["main", "outdoor", "satellite", "other"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setLocationType(t)}
                      className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                        locationType === t
                          ? "bg-white/15 text-white"
                          : "bg-white/5 text-white/40 hover:text-white/60"
                      }`}
                    >
                      {typeLabels[t]}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleAddLocation}
                    className="flex-1 rounded-xl bg-white/10 py-3 text-white transition-colors hover:bg-white/15"
                  >
                    Legg til
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowLocationInput(false);
                      setLocationName("");
                    }}
                    className="px-4 py-3 text-white/40 transition-colors hover:text-white/60"
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
              className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.12] py-4 text-white/40 transition-colors hover:text-white/60"
            >
              <Plus className="size-4" />
              Legg til lokasjon
            </button>
          )}
        </div>
      </RevealItem>

      <RevealItem>
        <button
          type="button"
          onClick={() => completeSection("locations")}
          className="mt-6 w-full cursor-pointer rounded-2xl bg-white py-4 text-lg font-semibold text-black transition-colors hover:bg-white/90"
        >
          {locations.length > 0 ? "Bekreft lokasjoner" : "Hopp over"}
        </button>
      </RevealItem>
    </SectionReveal>
  );
}
