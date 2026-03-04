"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Calendar,
  Users,
  MapPin,
  ClipboardCheck,
  FileText,
  ArrowRight,
  Sparkles,
  Loader2,
} from "lucide-react";
import { useOnboarding } from "../WizardContext";
import { SectionReveal, RevealItem } from "../components/SectionReveal";

function formatDateRange(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${start.toLocaleDateString("nb-NO", opts)} \u2013 ${end.toLocaleDateString("nb-NO", opts)}`;
}

export function WelcomeSection() {
  const { business, season, departments, locations, procedures, finalize } = useOnboarding();
  const router = useRouter();
  const [isActivating, setIsActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedDepts = departments.filter((d) => d.selected);
  const selectedProcs = procedures.filter((p) => p.selected);
  const totalZones = locations.reduce((sum, loc) => sum + loc.zones.length, 0);

  async function handleGoToDashboard() {
    setIsActivating(true);
    setError(null);
    try {
      await finalize();
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Noe gikk galt. Pr\u00f8v igjen.");
      setIsActivating(false);
    }
  }

  const summaryItems = [
    {
      icon: Building2,
      label: business.name || "Bedrift",
      detail: [business.industry, business.city].filter(Boolean).join(" \u2022 ") || undefined,
    },
    {
      icon: Calendar,
      label: season.name || "Sesong",
      detail:
        season.startDate && season.endDate
          ? formatDateRange(season.startDate, season.endDate)
          : undefined,
    },
    {
      icon: Users,
      label: `${selectedDepts.length} avdelinger`,
      detail: selectedDepts.length > 0 ? selectedDepts.map((d) => d.name).join(", ") : undefined,
    },
    {
      icon: MapPin,
      label: `${locations.length} lokasjon${locations.length !== 1 ? "er" : ""}`,
      detail:
        totalZones > 0
          ? `${totalZones} sone${totalZones !== 1 ? "r" : ""}`
          : locations.length > 0
            ? locations.map((l) => l.name).join(", ")
            : undefined,
    },
    {
      icon: ClipboardCheck,
      label: `${selectedProcs.length} prosedyrer`,
      detail:
        selectedProcs.length > 0
          ? selectedProcs
              .slice(0, 3)
              .map((p) => p.name)
              .join(", ") + (selectedProcs.length > 3 ? ` +${selectedProcs.length - 3}` : "")
          : undefined,
    },
  ];

  return (
    <SectionReveal>
      <div className="flex flex-col gap-8">
        <RevealItem>
          <div className="flex items-center gap-3">
            <Sparkles className="size-6 text-white/30" />
            <h1 className="font-heading text-6xl leading-[1.1] tracking-tight text-white">
              Alt er klart!
            </h1>
          </div>
          <p className="mt-4 text-xl leading-relaxed text-white/50">
            Her er en oppsummering av det vi har satt opp sammen.
          </p>
        </RevealItem>

        {/* Summary card */}
        <RevealItem>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.07] p-8 shadow-lg shadow-black/20">
            <div className="flex flex-col gap-4">
              {summaryItems.map((item) => (
                <div key={item.label} className="flex items-start gap-3">
                  <item.icon className="mt-0.5 size-5 shrink-0 text-white/30" />
                  <div>
                    <span className="font-medium text-white">{item.label}</span>
                    {item.detail && <p className="text-sm text-white/40">{item.detail}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </RevealItem>

        {/* Contract preview */}
        <RevealItem>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.07] p-6 shadow-lg shadow-black/20">
            <div className="flex items-center gap-3">
              <FileText className="size-5 text-white/40" />
              <div>
                <span className="font-medium text-white">Kontraktmal klar</span>
                <p className="text-sm text-white/40">
                  Basert p&aring; norsk arbeidsmilj&oslash;lov og din bedrift
                </p>
              </div>
            </div>
          </div>
        </RevealItem>

        {/* CTA */}
        <RevealItem>
          <button
            onClick={handleGoToDashboard}
            disabled={isActivating}
            className={
              isActivating
                ? "flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-2xl bg-white/50 py-4 text-lg font-semibold text-black/50"
                : "flex w-full items-center justify-center gap-3 rounded-2xl bg-white py-4 text-lg font-semibold text-black transition-colors hover:bg-white/90"
            }
          >
            {isActivating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Aktiverer...
              </>
            ) : (
              <>
                G&aring; til dashboardet
                <ArrowRight className="size-4" />
              </>
            )}
          </button>
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        </RevealItem>
      </div>
    </SectionReveal>
  );
}
