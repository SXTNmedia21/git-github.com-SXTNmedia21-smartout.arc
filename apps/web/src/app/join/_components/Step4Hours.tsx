"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WizardStepProps } from "@smartout/ui";
import type { JoinState } from "../types";
import { useJoinScraping } from "../_context/JoinScrapingProvider";
import { DevAutoFill } from "./DevAutoFill";

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

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
    isClosed: true,
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
    const match = entry.match(/^([A-Za-z,-]+)\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);
    if (!match) continue;

    const daysPart = match[1];
    const openTime = match[2];
    const closeTime = match[3];
    if (!daysPart || !openTime || !closeTime) continue;

    const normalizedOpen = openTime.padStart(5, "0");
    const normalizedClose = closeTime.padStart(5, "0");

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

export function Step4Hours({ state, updateState, attempted, t }: WizardStepProps<JoinState>) {
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

  // Cascade animation: open Mon-Sat one by one
  const hasAnimated = useRef(false);
  useEffect(() => {
    if (hasAnimated.current) return;
    const allClosed = hours.every((h) => h.isClosed);
    if (!allClosed) {
      hasAnimated.current = true;
      return;
    }

    hasAnimated.current = true;
    const DAYS_TO_OPEN = [0, 1, 2, 3, 4, 5];
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
  }, []);

  // Apply scraped data (opening hours + contact)
  const appliedFieldsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!scrapedData) return;

    const isoHours = scrapedData.openingHours as string[] | undefined;
    if (isoHours?.length && !appliedFieldsRef.current.has("openingHours")) {
      const parsed = parseIsoOpeningHours(isoHours);
      if (parsed) {
        appliedFieldsRef.current.add("openingHours");
        hasAnimated.current = true;
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

  // Sync local fields to wizard state
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

  const devFill = () => {
    setPhone("+47 35 52 61 00");
    setInstagram("https://instagram.com/strommatogbar");
    setFacebook("https://facebook.com/strommatogbar");
    hasAnimated.current = true;
    setHours([
      { dayOfWeek: 0, isClosed: false, openTime: "11:00", closeTime: "23:00" },
      { dayOfWeek: 1, isClosed: false, openTime: "11:00", closeTime: "23:00" },
      { dayOfWeek: 2, isClosed: false, openTime: "11:00", closeTime: "23:00" },
      { dayOfWeek: 3, isClosed: false, openTime: "11:00", closeTime: "23:00" },
      { dayOfWeek: 4, isClosed: false, openTime: "11:00", closeTime: "01:00" },
      { dayOfWeek: 5, isClosed: false, openTime: "12:00", closeTime: "01:00" },
      { dayOfWeek: 6, isClosed: true, openTime: "10:00", closeTime: "22:00" },
    ]);
  };

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <DevAutoFill onFill={devFill} label="Fyll steg 4" />
      <div>
        <h2 className="font-heading text-foreground text-[1.75rem] leading-tight tracking-tight">
          {t("step4.heading")}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("step4.description")}</p>
      </div>

      {/* Phone */}
      <div className="space-y-2">
        <Label htmlFor="phone">{t("step4.phone")}</Label>
        <Input
          id="phone"
          type="tel"
          placeholder={t("step4.phone_placeholder")}
          value={phone}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
          aria-invalid={attempted && phone.length < 8}
        />
      </div>

      {/* Instagram + Facebook */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="instagram">
            {t("step4.instagram")}{" "}
            <span className="text-muted-foreground">{t("step4.optional")}</span>
          </Label>
          <Input
            id="instagram"
            type="url"
            placeholder={t("step4.instagram_placeholder")}
            value={instagram}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInstagram(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="facebook">
            {t("step4.facebook")}{" "}
            <span className="text-muted-foreground">{t("step4.optional")}</span>
          </Label>
          <Input
            id="facebook"
            type="url"
            placeholder={t("step4.facebook_placeholder")}
            value={facebook}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFacebook(e.target.value)}
          />
        </div>
      </div>

      {/* Opening hours grid */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">{t("step4.openingHours")}</Label>
        <div className="space-y-1.5">
          {hours.map((day, index) => (
            <div
              key={day.dayOfWeek}
              className="flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors duration-300"
              style={{
                borderColor: day.isClosed ? "var(--border)" : "var(--join-open-border)",
                backgroundColor: day.isClosed ? "var(--card)" : "var(--join-open-bg)",
              }}
            >
              <span className="text-foreground w-10 text-sm font-medium">
                {t(`step4.days.${DAY_KEYS[index]}`)}
              </span>

              <button
                type="button"
                onClick={() => updateDay(index, { isClosed: !day.isClosed })}
                className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-all duration-300"
                style={{
                  backgroundColor: day.isClosed
                    ? "var(--join-closed-btn-bg)"
                    : "var(--join-open-btn-bg)",
                  color: day.isClosed ? "var(--join-closed-btn-text)" : "var(--join-open-btn-text)",
                }}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full transition-colors duration-300"
                  style={{
                    backgroundColor: day.isClosed ? "var(--join-closed-dot)" : "var(--success)",
                  }}
                />
                {day.isClosed ? t("step4.closed") : t("step4.open")}
              </button>

              {!day.isClosed && (
                <div className="ml-auto flex items-center gap-2">
                  <TimeInput24h
                    value={day.openTime}
                    onChange={(val) => updateDay(index, { openTime: val })}
                  />
                  <span className="text-muted-foreground">–</span>
                  <TimeInput24h
                    value={day.closeTime}
                    onChange={(val) => updateDay(index, { closeTime: val })}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* -- 24h time input (HH:MM text input, no AM/PM) -- */

function TimeInput24h({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/[^\d:]/g, "");

    // Auto-insert colon after 2 digits
    if (raw.length === 2 && !raw.includes(":")) raw += ":";
    if (raw.length > 5) raw = raw.slice(0, 5);

    onChange(raw);
  };

  const handleBlur = () => {
    // Normalize on blur: pad and clamp
    const parts = value.split(":");
    const h = Math.min(23, Math.max(0, parseInt(parts[0] || "0", 10)));
    const m = Math.min(59, Math.max(0, parseInt(parts[1] || "0", 10)));
    onChange(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      maxLength={5}
      placeholder="00:00"
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      className="border-input text-foreground focus-visible:ring-ring h-8 w-16 rounded-md border bg-transparent px-2 text-center text-sm tabular-nums shadow-sm focus-visible:ring-1 focus-visible:outline-none"
    />
  );
}
