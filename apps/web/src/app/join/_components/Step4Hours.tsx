"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useSignupWizard } from "../_hooks/useSignupWizard";
import { step4Schema } from "../_lib/validation";

const DAY_LABELS = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lordag", "Sondag"];

/** Maps ISO day abbreviations (Mo, Tu, ...) to our 0-indexed weekday (Mon=0 … Sun=6) */
const ISO_DAY_MAP: Record<string, number> = {
  Mo: 0,
  Tu: 1,
  We: 2,
  Th: 3,
  Fr: 4,
  Sa: 5,
  Su: 6,
};

interface DayHours {
  dayOfWeek: number;
  isClosed: boolean;
  openTime: string;
  closeTime: string;
}

function getDefaultHours(): DayHours[] {
  return Array.from({ length: 7 }, (_, i) => ({
    dayOfWeek: i,
    isClosed: true, // Start closed, animation will open Mon-Sat
    openTime: "10:00",
    closeTime: "22:00",
  }));
}

/**
 * Parses ISO opening hours strings like "Mo-Fr 11:00-22:00" or "Sa 12:00-23:00"
 * into our DayHours[] format. Returns null if nothing could be parsed.
 */
function parseIsoOpeningHours(isoHours: string[]): DayHours[] | null {
  const result = getDefaultHours();
  let parsed = false;

  for (const entry of isoHours) {
    // Match patterns like "Mo-Fr 11:00-22:00" or "Sa 12:00-23:00"
    const match = entry.match(/^([A-Za-z,-]+)\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);
    if (!match) continue;

    const [, daysPart, openTime, closeTime] = match;
    const normalizedOpen = openTime.padStart(5, "0");
    const normalizedClose = closeTime.padStart(5, "0");

    // Expand day ranges like "Mo-Fr" or single days like "Sa"
    const dayIndices: number[] = [];
    for (const segment of daysPart.split(",")) {
      const rangeParts = segment.split("-");
      if (rangeParts.length === 2) {
        const start = ISO_DAY_MAP[rangeParts[0]];
        const end = ISO_DAY_MAP[rangeParts[1]];
        if (start !== undefined && end !== undefined) {
          for (let i = start; i <= end; i++) dayIndices.push(i);
        }
      } else {
        const idx = ISO_DAY_MAP[rangeParts[0]];
        if (idx !== undefined) dayIndices.push(idx);
      }
    }

    for (const idx of dayIndices) {
      result[idx] = {
        dayOfWeek: idx,
        isClosed: false,
        openTime: normalizedOpen,
        closeTime: normalizedClose,
      };
      parsed = true;
    }
  }

  return parsed ? result : null;
}

export function Step4Hours() {
  const { state, updateStep, nextStep, prevStep, scrapedData } = useSignupWizard();

  const [hours, setHours] = useState<DayHours[]>(() => {
    if (state.step4.openingHours && state.step4.openingHours.length === 7) {
      return state.step4.openingHours.map((h) => ({
        dayOfWeek: h.dayOfWeek,
        isClosed: h.isClosed,
        openTime: h.openTime ?? "10:00",
        closeTime: h.closeTime ?? "22:00",
      }));
    }
    return getDefaultHours();
  });

  const [phone, setPhone] = useState(state.step4.phone ?? "");
  const [instagram, setInstagram] = useState(state.step4.instagram ?? "");
  const [facebook, setFacebook] = useState(state.step4.facebook ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Cascade animation: open Mon-Sat one by one
  const hasAnimated = useRef(false);
  useEffect(() => {
    if (hasAnimated.current) return;
    // Only animate if all days are currently closed (fresh state)
    const allClosed = hours.every((h) => h.isClosed);
    if (!allClosed) {
      hasAnimated.current = true;
      return;
    }

    hasAnimated.current = true;
    // Open Mon(0) through Sat(5) with staggered delay
    const DAYS_TO_OPEN = [0, 1, 2, 3, 4, 5]; // Mon-Sat, Sunday(6) stays closed
    const STAGGER_MS = 120;

    DAYS_TO_OPEN.forEach((dayIndex, i) => {
      setTimeout(
        () => {
          setHours((prev) =>
            prev.map((day, idx) => (idx === dayIndex ? { ...day, isClosed: false } : day)),
          );
        },
        400 + i * STAGGER_MS,
      );
    });
  }, []); // intentional: run once on mount only

  // Apply scraped data (opening hours + contact) — re-check when scrapedData arrives
  const appliedFieldsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!scrapedData) return;

    // Opening hours from ISO strings like "Mo-Fr 11:00-22:00"
    const isoHours = scrapedData.openingHours as string[] | undefined;
    if (isoHours?.length && !appliedFieldsRef.current.has("openingHours")) {
      const parsed = parseIsoOpeningHours(isoHours);
      if (parsed) {
        appliedFieldsRef.current.add("openingHours");
        hasAnimated.current = true; // skip cascade animation when pre-filling
        setHours(parsed);
      }
    }

    if (scrapedData.phone && !phone && !appliedFieldsRef.current.has("phone")) {
      appliedFieldsRef.current.add("phone");
      setPhone(scrapedData.phone as string);
    }
    const social = scrapedData.socialLinks as Record<string, string> | undefined;
    if (social?.instagram && !instagram && !appliedFieldsRef.current.has("instagram")) {
      appliedFieldsRef.current.add("instagram");
      setInstagram(social.instagram);
    }
    if (social?.facebook && !facebook && !appliedFieldsRef.current.has("facebook")) {
      appliedFieldsRef.current.add("facebook");
      setFacebook(social.facebook);
    }
  }, [scrapedData]); // intentional: only track scrapedData changes

  const updateDay = (index: number, updates: Partial<DayHours>) => {
    setHours((prev) => prev.map((day, i) => (i === index ? { ...day, ...updates } : day)));
  };

  const handleNext = () => {
    const result = step4Schema.safeParse({
      openingHours: hours.map((h) => ({
        dayOfWeek: h.dayOfWeek,
        isClosed: h.isClosed,
        openTime: h.isClosed ? undefined : h.openTime,
        closeTime: h.isClosed ? undefined : h.closeTime,
      })),
      phone,
      instagram: instagram || "",
      facebook: facebook || "",
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as string;
        fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    updateStep("step4", result.data);
    nextStep();
  };

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <div>
        <h2 className="text-foreground text-2xl font-bold">Drift</h2>
        <p className="text-muted-foreground mt-1 text-sm">Åpningstider og kontaktinformasjon.</p>
      </div>

      {/* Opening hours grid */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">Åpningstider</Label>
        <div className="space-y-2">
          {hours.map((day, index) => (
            <div
              key={day.dayOfWeek}
              className="flex items-center gap-3 rounded-lg border p-3 transition-colors duration-300"
              style={{
                borderColor: day.isClosed ? "var(--border)" : "oklch(0.75 0.18 145 / 0.4)",
                backgroundColor: day.isClosed ? "var(--card)" : "oklch(0.75 0.18 145 / 0.05)",
              }}
            >
              <span className="text-foreground w-20 text-sm font-medium">{DAY_LABELS[index]}</span>

              <button
                type="button"
                onClick={() => updateDay(index, { isClosed: !day.isClosed })}
                className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-300"
                style={{
                  backgroundColor: day.isClosed
                    ? "oklch(0.55 0.01 0 / 0.1)"
                    : "oklch(0.75 0.18 145 / 0.15)",
                  color: day.isClosed ? "oklch(0.55 0.01 0)" : "oklch(0.45 0.18 145)",
                }}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full transition-colors duration-300"
                  style={{
                    backgroundColor: day.isClosed
                      ? "oklch(0.55 0.01 0 / 0.4)"
                      : "oklch(0.65 0.2 145)",
                  }}
                />
                {day.isClosed ? "Stengt" : "Åpent"}
              </button>

              {!day.isClosed && (
                <div className="ml-auto flex items-center gap-2">
                  <Input
                    type="time"
                    value={day.openTime}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      updateDay(index, { openTime: e.target.value })
                    }
                    className="h-8 w-28 text-sm"
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    type="time"
                    value={day.closeTime}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      updateDay(index, { closeTime: e.target.value })
                    }
                    className="h-8 w-28 text-sm"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Contact fields */}
      <div className="space-y-4">
        <Label className="text-sm font-semibold">Kontaktinformasjon</Label>

        <div className="space-y-2">
          <Label htmlFor="phone">Telefon</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="+47 12 34 56 78"
            value={phone}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setPhone(e.target.value);
              setErrors((prev) => ({ ...prev, phone: "" }));
            }}
            aria-invalid={!!errors.phone}
          />
          {errors.phone && <p className="text-destructive text-xs">{errors.phone}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="instagram">
            Instagram URL <span className="text-muted-foreground">(valgfritt)</span>
          </Label>
          <Input
            id="instagram"
            type="url"
            placeholder="https://instagram.com/dinbedrift"
            value={instagram}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInstagram(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="facebook">
            Facebook URL <span className="text-muted-foreground">(valgfritt)</span>
          </Label>
          <Input
            id="facebook"
            type="url"
            placeholder="https://facebook.com/dinbedrift"
            value={facebook}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFacebook(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={prevStep} className="flex-1">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Tilbake
        </Button>
        <Button
          type="button"
          onClick={handleNext}
          className="flex-1 bg-orange-500 text-white hover:bg-orange-600"
        >
          Neste
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
