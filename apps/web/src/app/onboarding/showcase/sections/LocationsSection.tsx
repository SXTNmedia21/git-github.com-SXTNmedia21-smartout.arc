"use client";

import { useState } from "react";
import { MapPin, Plus, X, Layers, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";
import { useOnboarding } from "../WizardContext";

const CRITICAL_EQUIPMENT_KEYWORDS = [
  "defibrillator",
  "hjertestarter",
  "førstehjelpsskrin",
  "førstehjelp",
  "first aid",
  "brannslukker",
  "brannslokker",
  "brannskap",
  "nødutgang",
  "øyedusj",
  "brannteppe",
];

function isCriticalEquipment(name: string): boolean {
  const lower = name.toLowerCase();
  return CRITICAL_EQUIPMENT_KEYWORDS.some((kw) => lower.includes(kw));
}

const TYPE_LABELS: Record<string, string> = {
  main: "Hovedlokale",
  outdoor: "Uteservering",
  satellite: "Filial",
  other: "Annet",
};

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

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Left: Agent voice */}
      <div className="flex flex-col justify-center border-r border-white/[0.04] px-10 py-20 lg:w-[38%] lg:px-16">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-xs font-semibold tracking-[0.25em] text-white/20 uppercase">
            Lokasjoner
          </p>
          <h2 className="font-heading mt-6 text-[clamp(3.5rem,7vw,6rem)] leading-[0.9] tracking-tight text-white">
            Hvor
            <br />
            holder
            <br />
            <span className="text-white/25">dere til?</span>
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-white/35">
            Legg til lokaler og definer soner. Brukes til å knytte rutiner til riktig sted.
          </p>

          <div className="mt-10 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => completeSection("locations")}
              className="flex items-center justify-center gap-3 rounded-2xl bg-white py-4 text-lg font-semibold text-black transition-colors hover:bg-white/90"
            >
              {locations.length > 0 ? "Bekreft lokasjoner →" : "Hopp over →"}
            </button>
          </div>
        </motion.div>
      </div>

      {/* Right: Location cards */}
      <div className="flex flex-col justify-start overflow-y-auto px-10 py-20 lg:w-[62%] lg:px-16">
        <div className="flex flex-col gap-4">
          {locations.map((loc, i) => {
            const hasCriticalZones = loc.zones.some((z) => isCriticalEquipment(z.name));
            return (
              <motion.div
                key={loc.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.05] p-6"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MapPin className="size-4 text-white/30" />
                    <span className="text-lg font-medium text-white">{loc.name}</span>
                    <span className="text-sm text-white/35">{TYPE_LABELS[loc.type]}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLocation(loc.id)}
                    className="p-1 text-white/25 transition-colors hover:text-white/55"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div className="mt-4">
                  <div className="flex items-center gap-2 text-xs text-white/30">
                    <Layers className="size-3" />
                    <span>Soner</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {loc.zones.map((zone) => {
                      const isCritical = isCriticalEquipment(zone.name);
                      return (
                        <span
                          key={zone.id}
                          className={`group flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm ${
                            isCritical
                              ? "border-destructive/20 bg-destructive/10 text-destructive"
                              : "border-white/[0.06] bg-white/[0.06] text-white/60"
                          }`}
                        >
                          {isCritical && <ShieldAlert className="text-destructive size-3" />}
                          {zone.name}
                          <button
                            type="button"
                            onClick={() => removeZone(loc.id, zone.id)}
                            className="text-white/25 opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            <X className="size-3" />
                          </button>
                        </span>
                      );
                    })}

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
                          className="rounded-xl border border-white/[0.08] bg-white/5 px-3 py-1.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/20"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleAddZone(loc.id)}
                          className="rounded-xl bg-white/10 px-2.5 py-1.5 text-sm text-white hover:bg-white/15"
                        >
                          Legg til
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveZoneInput(null);
                            setZoneName("");
                          }}
                          className="p-1 text-white/25 hover:text-white/55"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveZoneInput(loc.id)}
                        className="flex items-center gap-1.5 rounded-xl border border-dashed border-white/[0.08] px-3 py-1.5 text-sm text-white/30 transition-colors hover:text-white/55"
                      >
                        <Plus className="size-3" />
                        Sone
                      </button>
                    )}
                  </div>

                  {!hasCriticalZones && (
                    <p className="mt-2 text-xs text-white/15">
                      Tips: Legg til hjertestarter, brannslukker osv. som soner
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}

          {showLocationInput ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.05] p-6"
            >
              <div className="flex flex-col gap-4">
                <input
                  type="text"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddLocation()}
                  placeholder="Navn på lokasjon"
                  className="rounded-xl border border-white/[0.06] bg-white/5 px-4 py-3 text-white outline-none placeholder:text-white/25 focus:border-white/20"
                  autoFocus
                />
                <div className="flex flex-wrap gap-2">
                  {(["main", "outdoor", "satellite", "other"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setLocationType(t)}
                      className={`rounded-xl px-3 py-2 text-sm transition-colors ${
                        locationType === t
                          ? "bg-white/15 text-white"
                          : "bg-white/[0.04] text-white/35 hover:text-white/55"
                      }`}
                    >
                      {TYPE_LABELS[t]}
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
                    className="px-4 py-3 text-white/35 transition-colors hover:text-white/55"
                  >
                    Avbryt
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <button
              type="button"
              onClick={() => setShowLocationInput(true)}
              className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.08] py-5 text-white/30 transition-colors hover:border-white/15 hover:text-white/50"
            >
              <Plus className="size-4" />
              Legg til lokasjon
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
