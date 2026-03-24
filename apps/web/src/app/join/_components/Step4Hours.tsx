"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WizardStepProps } from "@smartout/ui";
import type { JoinState } from "../types";
import { useJoinScraping } from "../_context/JoinScrapingProvider";

const DAY_LABELS = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lordag", "Sondag"];

/** Maps ISO day abbreviations (Mo, Tu, ...) to our 0-indexed weekday (Mon=0 ... Sun=6) */
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

    const daysPart = match[1];
    const openTime = match[2];
    const closeTime = match[3];
    if (!daysPart || !openTime || !closeTime) continue;

    const normalizedOpen = openTime.padStart(5, "0");
    const normalizedClose = closeTime.padStart(5, "0");

    // Expand day ranges like "Mo-Fr" or single days like "Sa"
    const dayIndices: number[] = [];
    for (const segment of daysPart.split(",")) {
      const rangeParts = segment.split("-");
      if (rangeParts.length === 2 && rangeParts[0] && rangeParts[1]) {
        const start = ISO_DAY_MAP[rangeParts[0]];
        const end = ISO_DAY_MAP[rangeParts[1]];
        if (start !== undefined && end !== undefined) {
          for (let i = start; i <= end; i++) dayIndices.push(i);
        }
      } else if (rangeParts[0]) {
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

export function Step4Hours({ state, updateState }: WizardStepProps<JoinState>) {
  const { scrapedData } = useJoinScraping();

  const [hours, setHours] = useState<DayHours[]>(() => {
    if (state.hours.openingHours && state.hours.openingHours.length === 7) {
      return state.hours.openingHours.map((h) => ({
        dayOfWeek: h.dayOfWeek,
        isClosed: h.isClosed,
        openTime: h.openTime ?? "10:00",
        closeTime: h.closeTime ?? "22:00",
      }));
    }
    return getDefaultHours();
  });

  const [phone, setPhone] = useState(state.hours.phone ?? "");
  const [instagram, setInstagram] = useState(state.hours.instagram ?? "");
  const [facebook, setFacebook] = useState(state.hours.facebook ?? "");
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

  // Sync local fields to wizard state so WizardNavBar validation sees current data
  useEffect(() => {
    updateState({
      hours: {
        ...state.hours,
        openingHours: hours.map((h) => ({
          dayOfWeek: h.dayOfWeek,
          isClosed: h.isClosed,
          openTime: h.isClosed ? undefined : h.openTime,
          closeTime: h.isClosed ? undefined : h.closeTime,
        })),
        phone,
        instagram: instagram || "",
        facebook: facebook || "",
      },
    });
  }, [hours, phone, instagram, facebook]);

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <div>
        <h2 className="font-heading text-foreground text-2xl font-bold">Drift</h2>
        <p className="text-muted-foreground mt-1 text-sm">Apningstider og kontaktinformasjon.</p>
      </div>

      {/* Opening hours grid */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">Apningstider</Label>
        <div className="space-y-2">
          {hours.map((day, index) => (
            <div
              key={day.dayOfWeek}
              className="flex items-center gap-3 rounded-lg border p-3 transition-colors duration-300"
              style={{
                borderColor: day.isClosed ? "var(--border)" : "var(--join-open-border)",
                backgroundColor: day.isClosed ? "var(--card)" : "var(--join-open-bg)",
              }}
            >
              <span className="text-foreground w-20 text-sm font-medium">{DAY_LABELS[index]}</span>

              <button
                type="button"
                onClick={() => updateDay(index, { isClosed: !day.isClosed })}
                className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-300"
                style={{
                  backgroundColor: day.isClosed
                    ? "var(--join-closed-btn-bg)"
                    : "var(--join-open-btn-bg)",
                  color: day.isClosed ? "var(--join-closed-btn-text)" : "var(--join-open-btn-text)",
                }}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full transition-colors duration-300"
                  style={{
                    backgroundColor: day.isClosed ? "var(--join-closed-dot)" : "var(--success)",
                  }}
                />
                {day.isClosed ? "Stengt" : "Apent"}
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
                  <span className="text-muted-foreground">-</span>
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
    </div>
  );
}
