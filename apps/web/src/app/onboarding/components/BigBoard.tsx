"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { EASE_EXPO } from "../lib/motion";
import {
  Building2,
  Globe,
  Calendar,
  Users,
  MapPin,
  ClipboardCheck,
  Check,
  Loader2,
} from "lucide-react";
import { useOnboarding } from "../WizardContext";
import { suggestSeason } from "../lib/season-suggestions";
import {
  getDepartmentsForIndustry,
  getProceduresForIndustry,
  resolveNaceCode,
} from "../lib/industry-defaults";

interface PanelField {
  label: string;
  value: string;
}

interface PanelConfig {
  id: string;
  title: string;
  icon: React.ReactNode;
  fields: PanelField[];
  chips?: string[];
}

const PANEL_STAGGER_MS = 300;
const FIELD_STAGGER_MS = 400;

export function BigBoard() {
  const { business, season, departments, locations, procedures, scrapeStatus } = useOnboarding();

  const [visiblePanels, setVisiblePanels] = useState(0);
  const [fieldsRevealed, setFieldsRevealed] = useState<Record<string, number>>({});

  // Build panel configs from current state
  const panels: PanelConfig[] = buildPanels(business, season, departments, locations, procedures);

  // Stagger panel reveals
  useEffect(() => {
    if (visiblePanels >= panels.length) return;
    const timeout = setTimeout(() => {
      setVisiblePanels((c) => c + 1);
    }, PANEL_STAGGER_MS);
    return () => clearTimeout(timeout);
  }, [visiblePanels, panels.length]);

  // Stagger field reveals within each panel when data arrives (scrapeStatus === "done")
  useEffect(() => {
    if (scrapeStatus !== "done") return;

    panels.forEach((panel, panelIdx) => {
      if (panelIdx >= visiblePanels) return;
      const currentRevealed = fieldsRevealed[panel.id] ?? 0;
      const totalFields = panel.fields.length + (panel.chips ? 1 : 0);
      if (currentRevealed >= totalFields) return;

      const delay = panelIdx * 200 + currentRevealed * FIELD_STAGGER_MS;
      const timeout = setTimeout(() => {
        setFieldsRevealed((prev) => ({
          ...prev,
          [panel.id]: (prev[panel.id] ?? 0) + 1,
        }));
      }, delay);

      return () => clearTimeout(timeout);
    });
  }, [scrapeStatus, visiblePanels, fieldsRevealed, panels]);

  return (
    <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
      <AnimatePresence>
        {panels.slice(0, visiblePanels).map((panel, idx) => {
          const revealed = fieldsRevealed[panel.id] ?? 0;
          const totalFields = panel.fields.length + (panel.chips ? 1 : 0);
          const isDone = scrapeStatus === "done" && revealed >= totalFields;

          return (
            <motion.div
              key={panel.id}
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                duration: 0.6,
                ease: EASE_EXPO,
                delay: idx * 0.05,
              }}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-5"
            >
              {/* Panel header */}
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-white/60">
                    {panel.icon}
                  </div>
                  <h3 className="text-sm font-semibold tracking-wide text-white/80">
                    {panel.title}
                  </h3>
                </div>
                {isDone ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  >
                    <Check className="text-success h-4 w-4" />
                  </motion.div>
                ) : scrapeStatus === "scraping" ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white/30" />
                ) : null}
              </div>

              {/* Fields */}
              <div className="space-y-2">
                {panel.fields.map((field, fieldIdx) => {
                  const isVisible = scrapeStatus === "done" && fieldIdx < revealed;
                  return (
                    <AnimatePresence key={field.label}>
                      {isVisible && field.value ? (
                        <motion.div
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.5, ease: EASE_EXPO }}
                          className="flex items-baseline justify-between gap-3"
                        >
                          <span className="shrink-0 text-xs text-white/35">{field.label}</span>
                          <span className="truncate text-right text-sm text-white/80">
                            {field.value}
                          </span>
                        </motion.div>
                      ) : !isVisible && scrapeStatus === "scraping" ? (
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-xs text-white/20">{field.label}</span>
                          <div className="h-3 w-20 animate-pulse rounded bg-white/[0.04]" />
                        </div>
                      ) : null}
                    </AnimatePresence>
                  );
                })}

                {/* Chips (departments, procedures, locations) */}
                {panel.chips && panel.chips.length > 0 && (
                  <AnimatePresence>
                    {scrapeStatus === "done" && revealed >= panel.fields.length ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5 }}
                        className="mt-2 flex flex-wrap gap-1.5"
                      >
                        {panel.chips.map((chip) => (
                          <span
                            key={chip}
                            className="rounded-full border border-white/[0.06] bg-white/[0.05] px-2.5 py-0.5 text-xs text-white/60"
                          >
                            {chip}
                          </span>
                        ))}
                      </motion.div>
                    ) : scrapeStatus === "scraping" ? (
                      <div className="mt-2 flex gap-1.5">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="h-5 w-16 animate-pulse rounded-full bg-white/[0.04]"
                          />
                        ))}
                      </div>
                    ) : null}
                  </AnimatePresence>
                )}
              </div>

              {/* Empty state when scraping hasn't started */}
              {scrapeStatus !== "scraping" && scrapeStatus !== "done" && (
                <div className="py-4 text-center text-xs text-white/20">Venter på data...</div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function buildPanels(
  business: ReturnType<typeof useOnboarding>["business"],
  season: ReturnType<typeof useOnboarding>["season"],
  departments: ReturnType<typeof useOnboarding>["departments"],
  locations: ReturnType<typeof useOnboarding>["locations"],
  procedures: ReturnType<typeof useOnboarding>["procedures"],
): PanelConfig[] {
  const nace = business.industryCode || resolveNaceCode(business.industry);
  const suggestedSeason = season.name ? season : suggestSeason();
  const suggestedDepts = departments.length > 0 ? departments : getDepartmentsForIndustry(nace);
  const suggestedProcs = procedures.length > 0 ? procedures : getProceduresForIndustry(nace);

  return [
    {
      id: "bedrift",
      title: "Bedrift",
      icon: <Building2 className="h-4 w-4" />,
      fields: [
        { label: "Navn", value: business.name },
        { label: "Juridisk", value: business.legalName },
        { label: "Org.nr", value: business.orgNumber },
        { label: "Adresse", value: [business.address, business.city].filter(Boolean).join(", ") },
        { label: "Bransje", value: business.industry },
        { label: "Ansatte", value: business.employeeCount ? String(business.employeeCount) : "" },
      ],
    },
    {
      id: "online",
      title: "Online",
      icon: <Globe className="h-4 w-4" />,
      fields: [
        { label: "Nettside", value: business.website },
        {
          label: "Google",
          value: business.googleRating
            ? `${business.googleRating}/5${business.googleRatingCount ? ` (${business.googleRatingCount})` : ""}`
            : "",
        },
        { label: "Åpningstider", value: business.openingHours },
        { label: "Telefon", value: business.phone },
        { label: "E-post", value: business.email },
      ],
    },
    {
      id: "sesong",
      title: "Sesong",
      icon: <Calendar className="h-4 w-4" />,
      fields: [
        { label: "Navn", value: suggestedSeason.name },
        { label: "Start", value: suggestedSeason.startDate },
        { label: "Slutt", value: suggestedSeason.endDate },
      ],
    },
    {
      id: "avdelinger",
      title: "Avdelinger",
      icon: <Users className="h-4 w-4" />,
      fields: [],
      chips: suggestedDepts.filter((d) => d.selected).map((d) => d.name),
    },
    {
      id: "lokasjoner",
      title: "Lokasjoner",
      icon: <MapPin className="h-4 w-4" />,
      fields: locations.map((l) => ({ label: l.type, value: l.name })),
      chips: locations.length === 0 ? [] : undefined,
    },
    {
      id: "prosedyrer",
      title: "Prosedyrer",
      icon: <ClipboardCheck className="h-4 w-4" />,
      fields: [],
      chips: suggestedProcs.filter((p) => p.selected).map((p) => p.name),
    },
  ];
}
