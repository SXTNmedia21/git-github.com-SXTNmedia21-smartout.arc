"use client";

import { useState, useMemo } from "react";
import {
  ArrowRight,
  Check,
  RotateCcw,
  Globe,
  Hash,
  AlertCircle,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useOnboarding } from "../WizardContext";
import { BusinessCardGrid } from "../components/BusinessCardGrid";

const DEV_SKIP_INDUSTRIES = [
  { value: "restaurant", label: "Restaurant", nace: "56.101" },
  { value: "hotel", label: "Hotell", nace: "55.101" },
  { value: "cafe", label: "Kaf\u00e9", nace: "56.101" },
  { value: "bar", label: "Bar", nace: "56.301" },
  { value: "catering", label: "Catering", nace: "56.210" },
  { value: "other", label: "Annet (ingen maler)", nace: "default" },
] as const;

// UI Events:
// - action: triggerScrape(name, city) — name input search
// - action: triggerScrape(url, org) — advanced search
// - action: completeSection("business") — confirm and advance
// - action: resetScrape() — start over

export function BusinessSection() {
  const { business, scrapeStatus, triggerScrape, completeSection, resetScrape, updateBusiness } =
    useOnboarding();

  const [nameInput, setNameInput] = useState("");
  const [cityInput, setCityInput] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [orgInput, setOrgInput] = useState("");
  const [showSkipPicker, setShowSkipPicker] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customIndustry, setCustomIndustry] = useState("");

  const canAdvance = useMemo(() => {
    const b = business;
    return (
      !!b.name &&
      !!b.legalName &&
      !!b.orgNumber &&
      !!b.address &&
      !!b.city &&
      !!b.postalCode &&
      !!b.email &&
      !!b.phone &&
      !!b.industry
    );
  }, [business]);

  const emptyMustHaveCount = useMemo(() => {
    const b = business;
    return [
      b.name,
      b.legalName,
      b.orgNumber,
      b.address,
      b.city,
      b.postalCode,
      b.email,
      b.phone,
      b.industry,
    ].filter((v) => !v).length;
  }, [business]);

  async function handleNameScrape() {
    const name = nameInput.trim();
    const city = cityInput.trim();
    if (!name) return;
    await triggerScrape("", "", name, city);
  }

  async function handleAdvancedScrape() {
    const url = urlInput.trim();
    const org = orgInput.trim();
    if (!url && !org) return;
    await triggerScrape(url, org);
  }

  function handleSkipWithIndustry(industryValue: string, industryLabel: string) {
    updateBusiness({
      name: "Testbedrift",
      legalName: "Testbedrift AS",
      orgNumber: "000000000",
      email: "test@test.no",
      phone: "00000000",
      address: "Testgate 1",
      postalCode: "0000",
      city: "Oslo",
      industry: industryLabel,
      industryCode: DEV_SKIP_INDUSTRIES.find((i) => i.value === industryValue)?.nace ?? "default",
    });
    completeSection("business");
  }

  // Scraping — left: "searching" state, right: skeleton shimmer
  if (scrapeStatus === "scraping") {
    return (
      <div className="flex min-h-dvh flex-col lg:flex-row">
        <div className="flex flex-col justify-center border-r border-white/[0.04] px-10 py-20 lg:w-[38%] lg:px-16">
          <p className="text-xs font-semibold tracking-[0.25em] text-white/20 uppercase">Bedrift</p>
          <h2 className="font-heading mt-6 text-[clamp(3.5rem,7vw,6rem)] leading-[0.9] tracking-tight text-white">
            Henter
            <br />
            informasjon
            <br />
            <span className="text-white/25">om dere...</span>
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-white/35">
            Skanner nettet, Brreg og Google.
            <br />
            Slapp av — dette tar noen sekunder.
          </p>
          <div className="mt-8 flex items-center gap-3 text-white/30">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Søker...</span>
          </div>
        </div>
        <div className="flex flex-col justify-center px-10 py-20 lg:w-[62%] lg:px-16">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <motion.div
                key={i}
                className="h-24 rounded-2xl bg-white/[0.04]"
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.12 }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Done — left: name + confirm, right: full-width card grid
  if (scrapeStatus === "done") {
    return (
      <div className="flex min-h-dvh flex-col lg:flex-row">
        <div className="flex flex-col justify-center border-r border-white/[0.04] px-10 py-20 lg:w-[38%] lg:px-16">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="text-xs font-semibold tracking-[0.25em] text-white/20 uppercase">
              Bedrift
            </p>
            <h2 className="font-heading mt-6 text-[clamp(3rem,6vw,5rem)] leading-[0.9] tracking-tight text-white">
              {business.name || "Din bedrift"}
            </h2>
            {business.industry && <p className="mt-3 text-lg text-white/40">{business.industry}</p>}
            <p className="mt-6 text-base leading-relaxed text-white/30">
              Jeg fant dette for deg. Klikk et kort for å redigere — ellers ser det bra ut.
            </p>

            <div className="mt-10 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => completeSection("business")}
                disabled={!canAdvance}
                className={`flex items-center justify-center gap-3 rounded-2xl py-4 text-lg font-semibold transition-all ${
                  canAdvance
                    ? "bg-white text-black hover:bg-white/90"
                    : "cursor-not-allowed bg-white/10 text-white/30"
                }`}
              >
                {canAdvance ? (
                  <>
                    Ser riktig ut
                    <Check className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 text-orange-400/60" />
                    {emptyMustHaveCount} felt mangler
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={resetScrape}
                className="flex items-center justify-center gap-1.5 text-sm text-white/25 transition-colors hover:text-white/50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Søk på nytt
              </button>
            </div>
          </motion.div>
        </div>

        <div className="flex flex-col justify-center px-10 py-20 lg:w-[62%] lg:px-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            <BusinessCardGrid business={business} onUpdate={updateBusiness} isScraping={false} />
          </motion.div>
        </div>
      </div>
    );
  }

  // Idle / error — search form, full screen
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Left: Context */}
      <div className="flex flex-col justify-center border-r border-white/[0.04] px-10 py-20 lg:w-[38%] lg:px-16">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-xs font-semibold tracking-[0.25em] text-white/20 uppercase">Bedrift</p>
          <h2 className="font-heading mt-6 text-[clamp(3.5rem,7vw,6rem)] leading-[0.9] tracking-tight text-white">
            Hva heter
            <br />
            arbeids-
            <br />
            <span className="text-white/25">plassen?</span>
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-white/35">
            Skriv inn navn — jeg finner resten automatisk fra Brreg og Google.
          </p>
          {scrapeStatus === "error" && (
            <p className="text-destructive/80 mt-4 text-sm">
              Fant ikke bedriften. Prøv igjen eller bruk nettside/org.nr.
            </p>
          )}
        </motion.div>
      </div>

      {/* Right: Search form */}
      <div className="flex flex-col justify-center px-10 py-20 lg:w-[62%] lg:px-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-lg"
        >
          <div className="flex flex-col gap-4">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Bedriftsnavn (f.eks. Sjøbris)"
              className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.05] px-6 py-5 text-xl text-white placeholder:text-white/25 focus:border-white/20 focus:outline-none"
              onKeyDown={(e) => e.key === "Enter" && void handleNameScrape()}
              autoFocus
            />
            <input
              type="text"
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              placeholder="By (f.eks. Trondheim)"
              className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.05] px-6 py-4 text-lg text-white placeholder:text-white/25 focus:border-white/20 focus:outline-none"
              onKeyDown={(e) => e.key === "Enter" && void handleNameScrape()}
            />

            <button
              type="button"
              onClick={() => void handleNameScrape()}
              disabled={!nameInput.trim()}
              className="flex items-center justify-center gap-3 rounded-2xl bg-white py-5 text-xl font-semibold text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Finn bedriften
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>

          {/* Advanced */}
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-white/25 transition-colors hover:text-white/45"
            >
              {showAdvanced ? "Skjul" : "Har du nettside eller org.nr?"}
            </button>

            {showAdvanced && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-4 flex flex-col gap-3"
              >
                <div className="relative">
                  <Globe className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-white/25" />
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://dinbedrift.no"
                    className="w-full rounded-xl border border-white/[0.06] bg-white/5 py-3 pr-4 pl-11 text-white placeholder:text-white/25 focus:border-white/20 focus:outline-none"
                  />
                </div>
                <div className="relative">
                  <Hash className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-white/25" />
                  <input
                    type="text"
                    value={orgInput}
                    onChange={(e) => setOrgInput(e.target.value)}
                    placeholder="123 456 789"
                    className="w-full rounded-xl border border-white/[0.06] bg-white/5 py-3 pr-4 pl-11 text-white placeholder:text-white/25 focus:border-white/20 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void handleAdvancedScrape()}
                  disabled={!urlInput.trim() && !orgInput.trim()}
                  className="rounded-xl bg-white/10 py-3 text-base font-medium text-white transition-colors hover:bg-white/15 disabled:opacity-40"
                >
                  Skann med nettside/org.nr
                </button>
              </motion.div>
            )}
          </div>

          <div className="relative mt-8">
            <button
              type="button"
              onClick={() => setShowSkipPicker(!showSkipPicker)}
              className="flex items-center gap-1.5 text-sm text-white/20 transition-colors hover:text-white/40"
            >
              Hopp over (dev)
              <ChevronDown
                className={`h-3 w-3 transition-transform ${showSkipPicker ? "rotate-180" : ""}`}
              />
            </button>

            <AnimatePresence>
              {showSkipPicker && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute bottom-full left-0 mb-2 w-64 rounded-xl border border-white/[0.08] bg-[#1a1a1a] p-2 shadow-xl"
                >
                  <p className="mb-2 px-2 text-xs text-white/30">Velg bransje for testdata:</p>
                  {DEV_SKIP_INDUSTRIES.map((ind) => (
                    <button
                      key={ind.value}
                      type="button"
                      onClick={() => {
                        if (ind.value === "other") {
                          setShowCustomInput(true);
                          setCustomIndustry("");
                          return;
                        }
                        handleSkipWithIndustry(ind.value, ind.label);
                      }}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white/90"
                    >
                      {ind.label}
                    </button>
                  ))}
                  {showCustomInput && (
                    <div className="mt-1 border-t border-white/[0.06] pt-2">
                      <input
                        type="text"
                        value={customIndustry}
                        onChange={(e) => setCustomIndustry(e.target.value)}
                        placeholder="Skriv bransjenavn..."
                        className="w-full rounded-lg border border-white/[0.06] bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-white/20 focus:outline-none"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && customIndustry.trim()) {
                            handleSkipWithIndustry("other", customIndustry.trim());
                          }
                        }}
                        autoFocus
                      />
                      {customIndustry.trim() && (
                        <button
                          type="button"
                          onClick={() => handleSkipWithIndustry("other", customIndustry.trim())}
                          className="mt-1 w-full rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white/60 transition-colors hover:bg-white/15"
                        >
                          Bruk &ldquo;{customIndustry.trim()}&rdquo;
                        </button>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
