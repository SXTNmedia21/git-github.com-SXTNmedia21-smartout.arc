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
import { createClient } from "@smartout/supabase/client";

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

  // Password fields — kept local, never persisted to wizard state
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Prevents duplicate auth attempts on repeated blur events
  const authAttemptedRef = useRef(false);

  useEffect(() => {
    updateState({
      account: { ...state.account, email, firstName, lastName, companyName, industry, city },
    });
  }, [email, firstName, lastName, companyName, industry, city]);

  /**
   * Silently signs up or signs in the user as soon as email + password are ready.
   * Fires on confirmPassword blur — by that point the user has typed both fields.
   * The access token is stored in wizard state so completeSignup can use it even
   * before the browser has forwarded the new session cookie.
   */
  async function attemptSilentAuth() {
    // Guard: only run once per session, and only when inputs look valid
    if (authAttemptedRef.current) return;
    if (!email.includes("@") || password.length < 8 || password !== confirmPassword) return;

    authAttemptedRef.current = true;
    setIsAuthenticating(true);
    setAuthError("");

    try {
      const supabase = createClient();

      // Try sign up first — works for new users
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
          },
        },
      });

      if (!signUpError) {
        // New user: session available immediately
        const accessToken = signUpData.session?.access_token;
        if (accessToken) {
          updateState({ _accessToken: accessToken } as Partial<JoinState>);
        }
        return;
      }

      // If the email is already taken or the user has no new identities, fall back to sign in.
      // "User already registered" covers exact-match conflicts.
      const isExistingUser =
        signUpError.message.toLowerCase().includes("already registered") ||
        (signUpData as { user?: { identities?: unknown[] } | null })?.user?.identities?.length ===
          0;

      if (isExistingUser) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          // Wrong password for existing account — surface error and allow retry
          setAuthError(t("step1.emailAlreadyRegistered"));
          authAttemptedRef.current = false; // allow retry after password correction
          return;
        }

        const accessToken = signInData.session?.access_token;
        if (accessToken) {
          updateState({ _accessToken: accessToken } as Partial<JoinState>);
        }
        return;
      }

      // Any other signUp error surfaces to the user
      setAuthError(signUpError.message);
      authAttemptedRef.current = false;
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Noe gikk galt. Prøv igjen.");
      authAttemptedRef.current = false;
    } finally {
      setIsAuthenticating(false);
    }
  }

  // BRREG lookup + intelligence pre-fetch — both fire when name+city stabilize
  const brregDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!companyName || companyName.length < 2 || !city || city.length < 2) return;
    if (brregDebounceRef.current) clearTimeout(brregDebounceRef.current);
    brregDebounceRef.current = setTimeout(() => {
      lookupBrreg(companyName, city, industry || undefined);
      if (prefetchStatus === "idle") {
        prefetchContent({ companyName, city });
      }
    }, 800);
    return () => {
      if (brregDebounceRef.current) clearTimeout(brregDebounceRef.current);
    };
  }, [companyName, city, industry, lookupBrreg, prefetchContent, prefetchStatus]);

  const devFill = () => {
    setFirstName("Pontus");
    setLastName("Lindroth");
    setEmail("pontus@smartout.ai");
    setPassword("test1234");
    setConfirmPassword("test1234");
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
        <h2 className="font-heading text-foreground text-[1.75rem] leading-tight tracking-tight">
          {t("step1.heading")}
        </h2>
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
            onChange={(e) => {
              setEmail(e.target.value);
              // Reset auth attempt if email changes so a new attempt fires on next blur
              authAttemptedRef.current = false;
              setAuthError("");
            }}
            aria-invalid={attempted && !email.includes("@")}
          />
        </div>

        {/* Password — collected on step 1 so auth happens silently before step 6 */}
        <div className="space-y-2">
          <Label htmlFor="password">{t("step1.password")}</Label>
          <Input
            id="password"
            type="password"
            placeholder={t("step1.passwordMinLength")}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              authAttemptedRef.current = false;
              setAuthError("");
            }}
            aria-invalid={attempted && password.length < 8}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">{t("step1.confirmPassword")}</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder={t("step1.confirmPassword")}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setAuthError("");
            }}
            onBlur={() => {
              // Fire silent auth as soon as both passwords are filled and match —
              // this way auth is done well before the user reaches step 6.
              if (password.length >= 8 && password === confirmPassword && email.includes("@")) {
                void attemptSilentAuth();
              }
            }}
            aria-invalid={attempted && password !== confirmPassword}
          />
          {authError && <p className="text-destructive text-sm">{authError}</p>}
          {isAuthenticating && <p className="text-muted-foreground text-xs">Oppretter konto...</p>}
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
