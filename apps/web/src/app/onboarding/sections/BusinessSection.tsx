"use client";

import { useState } from "react";
import { Globe, Hash, Pencil, Check, ArrowRight, Star, MapPin, ExternalLink } from "lucide-react";
import { useOnboarding } from "../WizardContext";
import { SectionReveal, RevealItem } from "../components/SectionReveal";
import { DataMaterializer } from "../components/DataMaterializer";

export function BusinessSection() {
  const { business, scrapeStatus, triggerScrape, updateBusiness, completeSection } =
    useOnboarding();

  const [urlInput, setUrlInput] = useState(business.website ?? "");
  const [orgInput, setOrgInput] = useState(business.orgNumber ?? "");
  const [activeTab, setActiveTab] = useState<"url" | "org">("url");
  const [isEditing, setIsEditing] = useState(false);

  async function handleScrape() {
    const url = activeTab === "url" ? urlInput.trim() : "";
    const org = activeTab === "org" ? orgInput.trim() : "";
    if (!url && !org) return;
    await triggerScrape(url, org);
  }

  const materializerFields = [
    { icon: "\u{1F3E2}", label: "Bedriftsnavn", value: business.name ?? "" },
    {
      icon: "\u{1F4CD}",
      label: "Adresse",
      value: [business.address, business.postalCode, business.city].filter(Boolean).join(", "),
    },
    { icon: "\u{1F4DE}", label: "Telefon", value: business.phone ?? "" },
    { icon: "\u{2709}\u{FE0F}", label: "E-post", value: business.email ?? "" },
    { icon: "\u{1F37D}\u{FE0F}", label: "Bransje", value: business.industry ?? "" },
    { icon: "\u{23F0}", label: "Åpningstider", value: business.openingHours ?? "" },
    {
      icon: "\u{1F465}",
      label: "Ansatte",
      value: business.employeeCount ? String(business.employeeCount) : "",
    },
  ].filter((f) => f.value.length > 0);

  // State 1 - Input form
  if (scrapeStatus === "idle" || scrapeStatus === "error") {
    return (
      <SectionReveal>
        <RevealItem>
          <h2 className="font-[family-name:var(--font-display)] text-6xl leading-[1.1] tracking-tight text-white">
            Fortell oss om bedriften din
          </h2>
        </RevealItem>

        <RevealItem>
          <p className="mt-4 text-xl leading-relaxed text-white/50">
            Skriv inn nettsiden eller org.nr — vi finner resten.
          </p>
        </RevealItem>

        <RevealItem>
          <div className="mt-10 rounded-2xl border border-white/[0.06] bg-white/[0.07] p-8 shadow-lg shadow-black/20">
            {/* Tabs */}
            <div className="mb-6 flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("url")}
                className={`rounded-lg px-4 py-2 text-base font-medium transition-colors ${
                  activeTab === "url"
                    ? "bg-white/10 text-white"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                Nettside
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("org")}
                className={`rounded-lg px-4 py-2 text-base font-medium transition-colors ${
                  activeTab === "org"
                    ? "bg-white/10 text-white"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                Org.nummer
              </button>
            </div>

            {/* Input fields */}
            {activeTab === "url" ? (
              <div className="relative">
                <Globe className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-white/40" />
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://dinbedrift.no"
                  className="w-full rounded-xl border border-white/[0.06] bg-white/5 py-3 pr-4 pl-12 text-white placeholder:text-white/30 focus:ring-2 focus:ring-white/20 focus:outline-none"
                />
              </div>
            ) : (
              <div className="relative">
                <Hash className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  value={orgInput}
                  onChange={(e) => setOrgInput(e.target.value)}
                  placeholder="123 456 789"
                  className="w-full rounded-xl border border-white/[0.06] bg-white/5 py-3 pr-4 pl-12 text-white placeholder:text-white/30 focus:ring-2 focus:ring-white/20 focus:outline-none"
                />
              </div>
            )}

            {scrapeStatus === "error" && (
              <p className="mt-3 text-sm text-red-400">
                Noe gikk galt. Sjekk adressen og prøv igjen.
              </p>
            )}

            <button
              type="button"
              onClick={handleScrape}
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl bg-white py-4 text-lg font-semibold text-black transition-colors hover:bg-white/90"
            >
              Skann bedriften
              <ArrowRight className="h-4 w-4" />
            </button>

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

  // State 2 - Scraping in progress
  if (scrapeStatus === "scraping") {
    return (
      <SectionReveal>
        <RevealItem>
          <h2 className="font-[family-name:var(--font-display)] text-6xl leading-[1.1] tracking-tight text-white">
            Fortell oss om bedriften din
          </h2>
        </RevealItem>

        <RevealItem>
          <p className="mt-4 text-xl leading-relaxed text-white/50">Vi henter informasjon...</p>
        </RevealItem>

        <RevealItem>
          <div className="mt-10">
            <DataMaterializer fields={materializerFields} />
          </div>
        </RevealItem>
      </SectionReveal>
    );
  }

  // State 3 - Review
  return (
    <SectionReveal>
      <RevealItem>
        <h2 className="font-[family-name:var(--font-display)] text-6xl leading-[1.1] tracking-tight text-white">
          Fortell oss om bedriften din
        </h2>
      </RevealItem>

      <RevealItem>
        <p className="mt-4 text-xl leading-relaxed text-white/50">
          Stemmer dette? Rediger det som er feil.
        </p>
      </RevealItem>

      <RevealItem>
        <div className="mt-10 rounded-2xl border border-white/[0.06] bg-white/[0.07] p-8 shadow-lg shadow-black/20">
          {/* Review header */}
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-white">{business.name}</h3>
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="flex items-center gap-1.5 text-sm text-white/50 transition-colors hover:text-white"
            >
              {isEditing ? (
                <>
                  <Check className="h-4 w-4" />
                  Ferdig
                </>
              ) : (
                <>
                  <Pencil className="h-4 w-4" />
                  Rediger
                </>
              )}
            </button>
          </div>

          {/* Review fields */}
          <div className="space-y-4">
            <ReviewField
              label="Juridisk navn"
              value={business.legalName ?? ""}
              isEditing={isEditing}
              onChange={(v) => updateBusiness({ legalName: v })}
            />
            <ReviewField
              label="Org.nummer"
              value={business.orgNumber ?? ""}
              isEditing={isEditing}
              onChange={(v) => updateBusiness({ orgNumber: v })}
              mono
            />
            <ReviewField
              label="Nettside"
              value={business.website ?? ""}
              isEditing={isEditing}
              onChange={(v) => updateBusiness({ website: v })}
            />
            <ReviewField
              label="E-post"
              value={business.email ?? ""}
              isEditing={isEditing}
              onChange={(v) => updateBusiness({ email: v })}
            />
            <ReviewField
              label="Telefon"
              value={business.phone ?? ""}
              isEditing={isEditing}
              onChange={(v) => updateBusiness({ phone: v })}
            />
            <ReviewField
              label="Adresse"
              value={business.address ?? ""}
              isEditing={isEditing}
              onChange={(v) => updateBusiness({ address: v })}
            />
            <div className="grid grid-cols-2 gap-4">
              <ReviewField
                label="Postnummer"
                value={business.postalCode ?? ""}
                isEditing={isEditing}
                onChange={(v) => updateBusiness({ postalCode: v })}
                mono
              />
              <ReviewField
                label="Sted"
                value={business.city ?? ""}
                isEditing={isEditing}
                onChange={(v) => updateBusiness({ city: v })}
              />
            </div>
            <ReviewField
              label="Bransje"
              value={business.industry ?? ""}
              isEditing={isEditing}
              onChange={(v) => updateBusiness({ industry: v })}
            />
            <ReviewField
              label="Bransjekode"
              value={business.industryCode ?? ""}
              isEditing={isEditing}
              onChange={(v) => updateBusiness({ industryCode: v })}
              mono
            />
            <ReviewField
              label="Antall ansatte"
              value={business.employeeCount ? String(business.employeeCount) : ""}
              isEditing={isEditing}
              onChange={(v) =>
                updateBusiness({
                  employeeCount: v,
                })
              }
              mono
            />
            <ReviewField
              label="Åpningstider"
              value={business.openingHours ?? ""}
              isEditing={isEditing}
              onChange={(v) => updateBusiness({ openingHours: v })}
            />
            <ReviewField
              label="Beskrivelse"
              value={business.description ?? ""}
              isEditing={isEditing}
              onChange={(v) => updateBusiness({ description: v })}
              multiline
            />
          </div>

          {/* Google Places data */}
          {(business.googleRating != null || business.googleMapsUrl) && (
            <div className="mt-6 rounded-xl border border-white/[0.04] bg-white/[0.03] p-5">
              <div className="mb-3 flex items-center gap-2 text-xs font-medium tracking-wide text-white/30 uppercase">
                <MapPin className="h-3.5 w-3.5" />
                Google
              </div>

              <div className="space-y-3">
                {business.googleRating != null && (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${
                            i < Math.round(business.googleRating!)
                              ? "fill-amber-400 text-amber-400"
                              : "text-white/20"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-sm text-white">
                      {business.googleRating}
                      {business.googleRatingCount != null && (
                        <span className="text-white/40">
                          {" "}
                          ({business.googleRatingCount} anmeldelser)
                        </span>
                      )}
                    </span>
                  </div>
                )}

                {business.priceLevel && (
                  <div>
                    <span className="text-xs text-white/40">Prisnivå</span>
                    <span className="ml-2 text-sm text-white">{business.priceLevel}</span>
                  </div>
                )}

                {business.googleMapsUrl && (
                  <a
                    href={business.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-blue-400 transition-colors hover:text-blue-300"
                  >
                    Se på Google Maps
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Confirm button */}
          <button
            type="button"
            onClick={() => completeSection("business")}
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl bg-white py-4 text-lg font-semibold text-black transition-colors hover:bg-white/90"
          >
            Ser riktig ut
            <Check className="h-4 w-4" />
          </button>
        </div>
      </RevealItem>
    </SectionReveal>
  );
}

// Internal sub-component for review fields
function ReviewField({
  label,
  value,
  isEditing,
  onChange,
  mono = false,
  multiline = false,
}: {
  label: string;
  value: string;
  isEditing: boolean;
  onChange: (value: string) => void;
  mono?: boolean;
  multiline?: boolean;
}) {
  if (isEditing) {
    if (multiline) {
      return (
        <div>
          <label className="mb-1 block text-xs text-white/40">{label}</label>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-lg border border-white/[0.06] bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:ring-2 focus:ring-white/20 focus:outline-none"
          />
        </div>
      );
    }

    return (
      <div>
        <label className="mb-1 block text-xs text-white/40">{label}</label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-lg border border-white/[0.06] bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:ring-2 focus:ring-white/20 focus:outline-none ${
            mono ? "font-mono" : ""
          }`}
        />
      </div>
    );
  }

  if (!value) return null;

  return (
    <div>
      <span className="block text-xs text-white/40">{label}</span>
      <span className={`text-sm text-white ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
