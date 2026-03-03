"use client";

import { useEffect } from "react";
import { Calendar, TrendingUp } from "lucide-react";
import { SectionReveal, RevealItem } from "../components/SectionReveal";
import { useOnboarding } from "../WizardContext";

export function SeasonSection() {
  const { season, updateSeason, completeSection, activeSection, botsson } = useOnboarding();

  useEffect(() => {
    if (activeSection === "season") botsson.triggerSection("season", "enter");
  }, [activeSection, botsson]);

  return (
    <SectionReveal>
      <RevealItem>
        <h2 className="font-[family-name:var(--font-display)] text-5xl text-white">
          Din forste sesong
        </h2>
        <p className="mt-3 text-white/50">
          Sesonger organiserer drift, mal og bemanning i perioder.
        </p>
      </RevealItem>

      <RevealItem>
        <div className="space-y-6 rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
          {/* Sesongnavn */}
          <div>
            <label className="mb-1.5 block text-sm text-white/50">Sesongnavn</label>
            <input
              type="text"
              value={season.name}
              onChange={(e) => updateSeason({ name: e.target.value })}
              placeholder="F.eks. Var 2026"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30"
            />
          </div>

          {/* Startdato / Sluttdato */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm text-white/50">
                <Calendar className="h-3.5 w-3.5" />
                Startdato
              </label>
              <input
                type="date"
                value={season.startDate}
                onChange={(e) => updateSeason({ startDate: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30"
              />
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm text-white/50">
                <Calendar className="h-3.5 w-3.5" />
                Sluttdato
              </label>
              <input
                type="date"
                value={season.endDate}
                onChange={(e) => updateSeason({ endDate: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30"
              />
            </div>
          </div>

          {/* Forventet omsetning / Onsket bunnlinje */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm text-white/50">
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
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-12 text-white placeholder:text-white/30"
                />
                <span className="absolute top-1/2 right-4 -translate-y-1/2 text-sm text-white/30">
                  kr
                </span>
              </div>
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm text-white/50">
                <TrendingUp className="h-3.5 w-3.5" />
                Onsket bunnlinje
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={season.targetMargin ?? ""}
                  onChange={(e) =>
                    updateSeason({
                      targetMargin: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="Valgfritt"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-12 text-white placeholder:text-white/30"
                />
                <span className="absolute top-1/2 right-4 -translate-y-1/2 text-sm text-white/30">
                  %
                </span>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={() => completeSection("season")}
              className="w-full rounded-xl bg-white py-3 font-semibold text-black"
            >
              Bekreft sesong
            </button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => completeSection("season")}
                className="text-sm text-white/40 hover:text-white/60"
              >
                Hopp over
              </button>
            </div>
          </div>
        </div>
      </RevealItem>
    </SectionReveal>
  );
}
