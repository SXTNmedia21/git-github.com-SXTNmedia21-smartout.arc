"use client";

import { Calendar, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { useOnboarding } from "../WizardContext";
import { EASE_EXPO } from "../lib/motion";

export function SeasonSection() {
  const { season, updateSeason, completeSection } = useOnboarding();

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <div className="flex flex-col justify-center border-r border-white/[0.04] px-10 py-20 lg:w-[38%] lg:px-16">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: EASE_EXPO }}
        >
          <p className="text-xs font-semibold tracking-[0.25em] text-white/20 uppercase">Sesong</p>
          <h2 className="font-heading mt-6 text-[clamp(3.5rem,7vw,6rem)] leading-[0.9] tracking-tight text-white">
            Din
            <br />
            første
            <br />
            <span className="text-white/25">sesong.</span>
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-white/35">
            Sesonger organiserer drift, mål og bemanning. Du kan lage flere etterpå.
          </p>
          <div className="mt-10 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => completeSection("season")}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white py-4 text-lg font-semibold text-black transition-colors hover:bg-white/90"
            >
              Bekreft sesong →
            </button>
            <button
              type="button"
              onClick={() => completeSection("season")}
              className="text-sm text-white/20 hover:text-white/40"
            >
              Hopp over
            </button>
          </div>
        </motion.div>
      </div>

      <div className="flex flex-col justify-center px-10 py-20 lg:w-[62%] lg:px-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: EASE_EXPO }}
          className="flex max-w-lg flex-col gap-6"
        >
          <div>
            <label className="mb-2 block text-sm text-white/40">Sesongnavn</label>
            <input
              type="text"
              value={season.name}
              onChange={(e) => updateSeason({ name: e.target.value })}
              placeholder="F.eks. Vår 2026"
              className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.05] px-6 py-5 text-xl text-white placeholder:text-white/25 focus:border-white/20 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 flex items-center gap-1.5 text-sm text-white/40">
                <Calendar className="h-3.5 w-3.5" />
                Startdato
              </label>
              <input
                type="date"
                value={season.startDate}
                onChange={(e) => updateSeason({ startDate: e.target.value })}
                className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.05] px-5 py-4 text-base text-white focus:border-white/20 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 flex items-center gap-1.5 text-sm text-white/40">
                <Calendar className="h-3.5 w-3.5" />
                Sluttdato
              </label>
              <input
                type="date"
                value={season.endDate}
                onChange={(e) => updateSeason({ endDate: e.target.value })}
                className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.05] px-5 py-4 text-base text-white focus:border-white/20 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 flex items-center gap-1.5 text-sm text-white/40">
                <TrendingUp className="h-3.5 w-3.5" />
                Forventet omsetning
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={season.expectedRevenue ?? ""}
                  onChange={(e) =>
                    updateSeason({
                      expectedRevenue: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="Valgfritt"
                  className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.05] px-5 py-4 pr-12 text-base text-white placeholder:text-white/25 focus:border-white/20 focus:outline-none"
                />
                <span className="absolute top-1/2 right-5 -translate-y-1/2 text-sm text-white/25">
                  kr
                </span>
              </div>
            </div>
            <div>
              <label className="mb-2 flex items-center gap-1.5 text-sm text-white/40">
                <TrendingUp className="h-3.5 w-3.5" />
                Ønsket bunnlinje
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={season.targetMargin ?? ""}
                  onChange={(e) =>
                    updateSeason({ targetMargin: e.target.value ? Number(e.target.value) : null })
                  }
                  placeholder="Valgfritt"
                  className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.05] px-5 py-4 pr-12 text-base text-white placeholder:text-white/25 focus:border-white/20 focus:outline-none"
                />
                <span className="absolute top-1/2 right-5 -translate-y-1/2 text-sm text-white/25">
                  %
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
