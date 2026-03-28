"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WizardStepProps } from "@smartout/ui";
import type { JoinState } from "../types";
import { useJoinScraping } from "../_context/JoinScrapingProvider";
import { DevAutoFill } from "./DevAutoFill";

const INDUSTRY_KEYS = [
  { value: "restaurant", nace: "56.101" },
  { value: "cafe", nace: "56.102" },
  { value: "bar", nace: "56.301" },
  { value: "hotel", nace: "55.101" },
  { value: "catering", nace: "56.210" },
  { value: "fast_food", nace: "56.102" },
  { value: "retail", nace: "47.110" },
  { value: "other", nace: "" },
] as const;

export function Step1Account({ state, updateState, attempted, t }: WizardStepProps<JoinState>) {
  const { lookupBrreg, prefetchContent, prefetchStatus } = useJoinScraping();

  const [email, setEmail] = useState(state.account.email ?? "");
  const [firstName, setFirstName] = useState(state.account.firstName ?? "");
  const [lastName, setLastName] = useState(state.account.lastName ?? "");
  const [companyName, setCompanyName] = useState(state.account.companyName ?? "");
  const [industry, setIndustry] = useState(state.account.industry ?? "");
  const [city, setCity] = useState(state.account.city ?? "");

  useEffect(() => {
    updateState({
      account: { ...state.account, email, firstName, lastName, companyName, industry, city },
    });
  }, [email, firstName, lastName, companyName, industry, city]);

  // BRREG lookup + intelligence pre-fetch — both fire when name+city stabilize
  const brregDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!companyName || companyName.length < 2 || !city || city.length < 2) return;
    if (brregDebounceRef.current) clearTimeout(brregDebounceRef.current);
    brregDebounceRef.current = setTimeout(() => {
      lookupBrreg(companyName, city);
      if (prefetchStatus === "idle") {
        prefetchContent({ companyName, city });
      }
    }, 800);
    return () => {
      if (brregDebounceRef.current) clearTimeout(brregDebounceRef.current);
    };
  }, [companyName, city, lookupBrreg, prefetchContent, prefetchStatus]);

  const devFill = () => {
    setFirstName("Pontus");
    setLastName("Lindroth");
    setEmail("pontus@smartout.ai");
    setCompanyName("Strøm Mat & Bar");
    setIndustry("restaurant");
    setCity("Skien");
    // Fill all steps at once so you can click through without per-step devFill
    updateState({
      account: {
        email: "pontus@smartout.ai",
        firstName: "Pontus",
        lastName: "Lindroth",
        companyName: "Strøm Mat & Bar",
        industry: "restaurant",
        city: "Skien",
        websiteUrl: "strombar.no",
      },
      business: {
        street: "Langbrygga 5",
        postalCode: "3724",
        city: "Skien",
        orgNumber: "911 722 267",
      },
      about: {
        aboutUs:
          "Strøm Mat & Bar er en moderne restaurant i hjertet av Skien med fokus på lokale råvarer og sesongbasert meny.",
        ourHistory:
          "Åpnet i 2019. Startet som en liten matbar, vokst til et populært spisested med vinbar.",
        ourConcept:
          "Nordisk bistro med vinbar. Avslappet atmosfære, høy kvalitet på mat og drikke.",
      },
      hours: {
        phone: "+47 35 52 61 00",
        instagram: "https://instagram.com/strommatogbar",
        facebook: "https://facebook.com/strommatogbar",
        openingHours: [
          { dayOfWeek: 0, isClosed: false, openTime: "11:00", closeTime: "23:00" },
          { dayOfWeek: 1, isClosed: false, openTime: "11:00", closeTime: "23:00" },
          { dayOfWeek: 2, isClosed: false, openTime: "11:00", closeTime: "23:00" },
          { dayOfWeek: 3, isClosed: false, openTime: "11:00", closeTime: "23:00" },
          { dayOfWeek: 4, isClosed: false, openTime: "11:00", closeTime: "01:00" },
          { dayOfWeek: 5, isClosed: false, openTime: "12:00", closeTime: "01:00" },
          { dayOfWeek: 6, isClosed: true, openTime: "10:00", closeTime: "22:00" },
        ],
      },
      menu: {
        restaurantType: "Restaurant",
        cuisineTypes: ["Norsk/Nordisk", "Sjomat", "Internasjonal"],
        priceCategory: "moderate",
        menuDescription: "Sesongbasert nordisk meny med fokus på lokale råvarer.",
      },
    });
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <DevAutoFill onFill={devFill} label="Fyll steg 1" />
      <div>
        <h2 className="text-foreground text-2xl font-bold">{t("step1.heading")}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("step1.description")}</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="companyName">{t("step1.companyName")}</Label>
          <Input
            id="companyName"
            type="text"
            placeholder={t("step1.companyName_placeholder")}
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            aria-invalid={attempted && companyName.length < 2}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="industry">{t("step1.industry")}</Label>
            <Select value={industry} onValueChange={setIndustry}>
              <SelectTrigger id="industry" aria-invalid={attempted && !industry}>
                <SelectValue placeholder={t("step1.industry_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRY_KEYS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {t(`industries.${opt.value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">{t("step1.city")}</Label>
            <Input
              id="city"
              type="text"
              placeholder={t("step1.city_placeholder")}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              aria-invalid={attempted && city.length < 2}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">{t("step1.email")}</Label>
          <Input
            id="email"
            type="email"
            placeholder={t("step1.email_placeholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={attempted && !email.includes("@")}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">{t("step1.firstName")}</Label>
            <Input
              id="firstName"
              type="text"
              placeholder={t("step1.firstName_placeholder")}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              aria-invalid={attempted && firstName.length < 2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">{t("step1.lastName")}</Label>
            <Input
              id="lastName"
              type="text"
              placeholder={t("step1.lastName_placeholder")}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              aria-invalid={attempted && lastName.length < 2}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
