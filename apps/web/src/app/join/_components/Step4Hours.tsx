"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useSignupWizard } from "../_hooks/useSignupWizard";
import { step4Schema } from "../_lib/validation";
import { AutoFillField } from "./AutoFillField";

const DAY_LABELS = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lordag", "Sondag"];

interface ScrapedDataInput {
  opening_hours?: Array<{
    dayOfWeek: number;
    isClosed: boolean;
    openTime?: string;
    closeTime?: string;
  }>;
  phone?: string;
  instagram?: string;
  facebook?: string;
  [key: string]: unknown;
}

interface Step4HoursProps {
  scrapedData: ScrapedDataInput | null;
}

interface DayHours {
  dayOfWeek: number;
  isClosed: boolean;
  openTime: string;
  closeTime: string;
}

function getDefaultHours(): DayHours[] {
  return Array.from({ length: 7 }, (_, i) => ({
    dayOfWeek: i,
    isClosed: false,
    openTime: "10:00",
    closeTime: "22:00",
  }));
}

export function Step4Hours({ scrapedData }: Step4HoursProps) {
  const { state, updateStep, nextStep, prevStep } = useSignupWizard();

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

  const [phoneAutoFilled, setPhoneAutoFilled] = useState(false);
  const [instagramAutoFilled, setInstagramAutoFilled] = useState(false);
  const [facebookAutoFilled, setFacebookAutoFilled] = useState(false);
  const [_hoursAutoFilled, setHoursAutoFilled] = useState(false);

  const hasAppliedScraped = useRef(false);

  // Apply scraped data
  useEffect(() => {
    if (hasAppliedScraped.current || !scrapedData) return;
    hasAppliedScraped.current = true;

    if (scrapedData.opening_hours && scrapedData.opening_hours.length === 7) {
      setHours(
        scrapedData.opening_hours.map((h) => ({
          dayOfWeek: h.dayOfWeek,
          isClosed: h.isClosed,
          openTime: h.openTime ?? "10:00",
          closeTime: h.closeTime ?? "22:00",
        })),
      );
      setHoursAutoFilled(true);
    }

    if (scrapedData.phone && !phone) {
      setPhone(scrapedData.phone);
      setPhoneAutoFilled(true);
    }
    if (scrapedData.instagram && !instagram) {
      setInstagram(scrapedData.instagram);
      setInstagramAutoFilled(true);
    }
    if (scrapedData.facebook && !facebook) {
      setFacebook(scrapedData.facebook);
      setFacebookAutoFilled(true);
    }
  }, [scrapedData]);

  const updateDay = (index: number, updates: Partial<DayHours>) => {
    setHours((prev) => prev.map((day, i) => (i === index ? { ...day, ...updates } : day)));
    setHoursAutoFilled(false);
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
              className="border-border bg-card flex items-center gap-3 rounded-lg border p-3"
            >
              <span className="text-foreground w-20 text-sm font-medium">{DAY_LABELS[index]}</span>

              <div className="flex items-center gap-2">
                <Checkbox
                  id={`closed-${index}`}
                  checked={day.isClosed}
                  onCheckedChange={(checked) => updateDay(index, { isClosed: !!checked })}
                />
                <Label htmlFor={`closed-${index}`} className="text-muted-foreground text-xs">
                  Stengt
                </Label>
              </div>

              {!day.isClosed && (
                <>
                  <Input
                    type="time"
                    value={day.openTime}
                    onChange={(e) => updateDay(index, { openTime: e.target.value })}
                    className="h-8 w-28 text-sm"
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    type="time"
                    value={day.closeTime}
                    onChange={(e) => updateDay(index, { closeTime: e.target.value })}
                    className="h-8 w-28 text-sm"
                  />
                </>
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
          <AutoFillField
            id="phone"
            type="tel"
            placeholder="+47 12 34 56 78"
            value={phone}
            autoFilled={phoneAutoFilled}
            onChange={(e) => {
              setPhone(e.target.value);
              setPhoneAutoFilled(false);
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
          <AutoFillField
            id="instagram"
            type="url"
            placeholder="https://instagram.com/dinbedrift"
            value={instagram}
            autoFilled={instagramAutoFilled}
            onChange={(e) => {
              setInstagram(e.target.value);
              setInstagramAutoFilled(false);
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="facebook">
            Facebook URL <span className="text-muted-foreground">(valgfritt)</span>
          </Label>
          <AutoFillField
            id="facebook"
            type="url"
            placeholder="https://facebook.com/dinbedrift"
            value={facebook}
            autoFilled={facebookAutoFilled}
            onChange={(e) => {
              setFacebook(e.target.value);
              setFacebookAutoFilled(false);
            }}
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
