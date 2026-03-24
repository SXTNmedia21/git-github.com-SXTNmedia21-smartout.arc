"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
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
import { FinaleOverlay } from "../components/FinaleOverlay";

// UI Events:
// - action: handleGoToDashboard() → finalize() → finale animation → redirect to /dashboard
// - color-regime: warm brand during finale

function formatDateRange(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${start.toLocaleDateString("nb-NO", opts)} \u2013 ${end.toLocaleDateString("nb-NO", opts)}`;
}

export function WelcomeSection() {
  const { business, season, departments, locations, procedures, finalize, isAuthenticated } =
    useOnboarding();
  const router = useRouter();
  const [isActivating, setIsActivating] = useState(false);
  const [showFinale, setShowFinale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finalizeResult, setFinalizeResult] = useState<{ slug: string | null } | null>(null);

  const selectedDepts = departments.filter((d) => d.selected);
  const selectedProcs = procedures.filter((p) => p.selected);
  const totalZones = locations.reduce((sum, loc) => sum + loc.zones.length, 0);

  async function handleGoToDashboard() {
    setIsActivating(true);
    setError(null);
    try {
      const { slug } = await finalize();
      setFinalizeResult({ slug: slug ?? null });
      setShowFinale(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Noe gikk galt. Prøv igjen.");
      setIsActivating(false);
    }
  }

  const handleFinaleComplete = useCallback(() => {
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
    if (rootDomain && rootDomain !== "localhost" && finalizeResult?.slug) {
      window.location.href = `https://${finalizeResult.slug}.${rootDomain}/dashboard`;
    } else {
      router.push("/dashboard");
    }
  }, [finalizeResult, router]);

  const dataItems = [
    {
      icon: Building2,
      label: business.name || "Bedrift",
      detail: [business.industry, business.city].filter(Boolean).join(" · ") || null,
      filled: !!business.name,
    },
    {
      icon: Calendar,
      label: season.name || "Sesong",
      detail:
        season.startDate && season.endDate
          ? formatDateRange(season.startDate, season.endDate)
          : null,
      filled: !!season.name,
    },
    {
      icon: Users,
      label: `${selectedDepts.length} avdelinger`,
      detail: selectedDepts.length > 0 ? selectedDepts.map((d) => d.name).join(", ") : null,
      filled: selectedDepts.length > 0,
    },
    {
      icon: MapPin,
      label: `${locations.length} lokasjon${locations.length !== 1 ? "er" : ""}`,
      detail:
        totalZones > 0
          ? `${totalZones} sone${totalZones !== 1 ? "r" : ""}`
          : locations.length > 0
            ? locations.map((l) => l.name).join(", ")
            : null,
      filled: locations.length > 0,
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
          : null,
      filled: selectedProcs.length > 0,
    },
    {
      icon: FileText,
      label: "Kontraktmal",
      detail: "Basert på norsk arbeidsmiljølov",
      filled: true,
    },
  ];

  return (
    <>
      <FinaleOverlay active={showFinale} onComplete={handleFinaleComplete} />

      <motion.div
        animate={showFinale ? { scale: 0.95, opacity: 0.6 } : { scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="flex min-h-dvh flex-col lg:flex-row"
      >
        {/* Left: Agent voice + CTA */}
        <div className="flex flex-col justify-center border-r border-white/[0.04] px-10 py-20 lg:w-[38%] lg:px-16">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center gap-3">
              <Sparkles className="size-5 text-white/20" />
              <p className="text-xs font-semibold tracking-[0.25em] text-white/20 uppercase">
                Ferdig
              </p>
            </div>
            <h2 className="font-heading mt-6 text-[clamp(3.5rem,7vw,6rem)] leading-[0.9] tracking-tight text-white">
              Alt er
              <br />
              klart!
              <br />
              <span className="text-white/25">Bra jobba.</span>
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-white/35">
              Jeg har satt opp alt du trenger. Dashboardet venter — nå er det din tur.
            </p>

            <div className="mt-10 flex flex-col gap-3">
              {!isAuthenticated && (
                <p className="text-warning/70 text-sm">
                  Du må logge inn før du kan aktivere arbeidsplassen.
                </p>
              )}
              <button
                type="button"
                onClick={handleGoToDashboard}
                disabled={isActivating || !isAuthenticated}
                className={`flex items-center justify-center gap-3 rounded-2xl py-5 text-lg font-semibold transition-all ${
                  isActivating || !isAuthenticated
                    ? "cursor-not-allowed bg-white/20 text-white/30"
                    : "bg-white text-black hover:bg-white/90"
                }`}
              >
                {isActivating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Aktiverer...
                  </>
                ) : (
                  <>
                    Gå til dashboardet
                    <ArrowRight className="size-4" />
                  </>
                )}
              </button>
              {error && <p className="text-destructive text-sm">{error}</p>}
            </div>
          </motion.div>
        </div>

        {/* Right: Data summary — the "overwhelm" moment */}
        <div className="flex flex-col justify-center px-10 py-20 lg:w-[62%] lg:px-16">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {dataItems.map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.09, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className={`rounded-2xl border p-6 ${
                  item.filled
                    ? "border-white/[0.06] bg-white/[0.05]"
                    : "border-dashed border-white/[0.04] bg-transparent"
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon
                    className={`size-4 ${item.filled ? "text-white/30" : "text-white/15"}`}
                  />
                  <span
                    className={`text-base font-medium ${item.filled ? "text-white" : "text-white/20"}`}
                  >
                    {item.label}
                  </span>
                </div>
                {item.detail && (
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-white/35">
                    {item.detail}
                  </p>
                )}
              </motion.div>
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 1.0 }}
            className="mt-8 text-sm text-white/15"
          >
            Alt dette kan redigeres i dashboardet når som helst.
          </motion.p>
        </div>
      </motion.div>
    </>
  );
}
