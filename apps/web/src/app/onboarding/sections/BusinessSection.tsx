"use client";

import { useState } from "react";
import { Building2, ArrowRight, Check, RotateCcw, ChevronDown, Globe, Hash } from "lucide-react";
import { useOnboarding } from "../WizardContext";
import { SectionReveal, RevealItem } from "../components/SectionReveal";
import { BigBoard } from "../components/BigBoard";

export function BusinessSection() {
  const { business, scrapeStatus, triggerScrape, completeSection, resetScrape } = useOnboarding();

  const [nameInput, setNameInput] = useState("");
  const [cityInput, setCityInput] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [orgInput, setOrgInput] = useState("");

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

  // Scraping or done — show Big Board
  if (scrapeStatus === "scraping" || scrapeStatus === "done") {
    return (
      <SectionReveal>
        <RevealItem>
          <h2 className="font-heading text-6xl leading-[1.1] tracking-tight text-white">
            {scrapeStatus === "scraping" ? "Henter informasjon..." : business.name || "Din bedrift"}
          </h2>
        </RevealItem>

        <RevealItem>
          <p className="mt-4 text-xl leading-relaxed text-white/50">
            {scrapeStatus === "scraping"
              ? "Vi scanner nettet for alt vi kan finne."
              : "Stemmer dette? Lise hjelper deg gjennom resten."}
          </p>
        </RevealItem>

        <RevealItem>
          <BigBoard />
        </RevealItem>

        {scrapeStatus === "done" && (
          <RevealItem>
            <div className="mt-8 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => completeSection("business")}
                className="flex w-full max-w-md items-center justify-center gap-3 rounded-2xl bg-white py-4 text-lg font-semibold text-black transition-colors hover:bg-white/90"
              >
                Ser riktig ut
                <Check className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={resetScrape}
                className="inline-flex items-center gap-1.5 text-sm text-white/30 transition-colors hover:text-white/50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Start på nytt
              </button>
            </div>
          </RevealItem>
        )}
      </SectionReveal>
    );
  }

  // Idle / error — name + city input (manual mode fallback)
  return (
    <SectionReveal>
      <RevealItem>
        <h2 className="font-heading text-6xl leading-[1.1] tracking-tight text-white">
          Hva heter arbeidsplassen?
        </h2>
      </RevealItem>

      <RevealItem>
        <p className="mt-4 text-xl leading-relaxed text-white/50">
          Skriv inn navn og sted — vi finner resten automatisk.
        </p>
      </RevealItem>

      <RevealItem>
        <div className="mt-10 rounded-2xl border border-white/[0.06] bg-white/[0.07] p-8 shadow-lg shadow-black/20">
          {/* Name input */}
          <div className="relative">
            <Building2 className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Bedriftsnavn (f.eks. Sjøbris)"
              className="w-full rounded-xl border border-white/[0.06] bg-white/5 py-3 pr-4 pl-12 text-white placeholder:text-white/30 focus:ring-2 focus:ring-white/20 focus:outline-none"
              onKeyDown={(e) => e.key === "Enter" && handleNameScrape()}
            />
          </div>

          {/* City input */}
          <div className="relative mt-3">
            <input
              type="text"
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              placeholder="By (f.eks. Trondheim)"
              className="w-full rounded-xl border border-white/[0.06] bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:ring-2 focus:ring-white/20 focus:outline-none"
              onKeyDown={(e) => e.key === "Enter" && handleNameScrape()}
            />
          </div>

          {scrapeStatus === "error" && (
            <p className="mt-3 text-sm text-red-400">
              Fant ikke bedriften. Prøv igjen eller bruk nettside/org.nr nedenfor.
            </p>
          )}

          <button
            type="button"
            onClick={handleNameScrape}
            disabled={!nameInput.trim()}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl bg-white py-4 text-lg font-semibold text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Finn bedriften
            <ArrowRight className="h-4 w-4" />
          </button>

          {/* Advanced: URL / Org fallback */}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="mx-auto flex items-center gap-1.5 text-sm text-white/30 transition-colors hover:text-white/50"
            >
              Har du nettside eller org.nr?
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
              />
            </button>

            {showAdvanced && (
              <div className="mt-4 space-y-3 rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
                <div className="relative">
                  <Globe className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://dinbedrift.no"
                    className="w-full rounded-lg border border-white/[0.06] bg-white/5 py-2 pr-3 pl-10 text-sm text-white placeholder:text-white/30 focus:ring-2 focus:ring-white/20 focus:outline-none"
                  />
                </div>
                <div className="relative">
                  <Hash className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <input
                    type="text"
                    value={orgInput}
                    onChange={(e) => setOrgInput(e.target.value)}
                    placeholder="123 456 789"
                    className="w-full rounded-lg border border-white/[0.06] bg-white/5 py-2 pr-3 pl-10 text-sm text-white placeholder:text-white/30 focus:ring-2 focus:ring-white/20 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAdvancedScrape}
                  disabled={!urlInput.trim() && !orgInput.trim()}
                  className="w-full rounded-lg bg-white/10 py-2 text-sm font-medium text-white transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Skann med nettside/org.nr
                </button>
              </div>
            )}
          </div>

          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={() => completeSection("business")}
              className="text-sm text-white/30 transition-colors hover:text-white/50"
            >
              Hopp over
            </button>
          </div>
        </div>
      </RevealItem>
    </SectionReveal>
  );
}
