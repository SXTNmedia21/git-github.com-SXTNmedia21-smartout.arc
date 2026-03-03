"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Users, Calendar, ClipboardList, ArrowRight, Loader2 } from "lucide-react";
import { useOnboarding } from "../WizardContext";
import { SectionReveal, RevealItem } from "../components/SectionReveal";

function formatDateRange(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  };
  return `${start.toLocaleDateString("nb-NO", opts)} – ${end.toLocaleDateString("nb-NO", opts)}`;
}

export function DoneSection() {
  const {
    business,
    season,
    departments,
    finalize,
    activatedWorkspaceSlug,
    activeSection,
    botsson,
  } = useOnboarding();
  const router = useRouter();
  const [isActivating, setIsActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeSection === "done") botsson.triggerSection("done", "enter");
  }, [activeSection, botsson]);

  const selectedDepartments = departments.filter((d) => d.selected);
  const totalPositions = selectedDepartments.reduce(
    (sum, dept) => sum + (dept.positions?.length ?? 0),
    0,
  );

  async function handleGoToDashboard() {
    setIsActivating(true);
    setError(null);
    try {
      await finalize();
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Noe gikk galt. Prov igjen.");
      setIsActivating(false);
    }
  }

  const nextSteps = [
    { icon: Users, label: "Inviter ansatte" },
    { icon: Calendar, label: "Sett opp vaktplan" },
    { icon: ClipboardList, label: "Konfigurer prosedyrer" },
  ];

  return (
    <SectionReveal>
      <div className="flex flex-col gap-8">
        <RevealItem>
          <h1 className="font-[family-name:var(--font-display)] text-5xl text-white">
            Alt er klart!
          </h1>
          <p className="mt-3 text-white/50">Her er en oppsummering av det vi har satt opp.</p>
        </RevealItem>

        <RevealItem>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/5 py-3">
              <span className="text-sm text-white/50">Sesong</span>
              <span className="font-medium text-white">
                {season.name}
                {season.startDate && season.endDate && (
                  <span className="ml-2 text-sm text-white/50">
                    ({formatDateRange(season.startDate, season.endDate)})
                  </span>
                )}
              </span>
            </div>

            <div className="border-b border-white/5 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/50">Avdelinger</span>
                <span className="font-medium text-white">{selectedDepartments.length}</span>
              </div>
              {selectedDepartments.length > 0 && (
                <div className="mt-2 flex flex-col gap-1">
                  {selectedDepartments.map((dept) => (
                    <div key={dept.name} className="flex items-center justify-between pl-4">
                      <span className="text-sm text-white/40">{dept.name}</span>
                      <span className="text-sm text-white/40">
                        {dept.positions?.length ?? 0} stillinger
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-white/50">Totalt stillinger</span>
              <span className="font-medium text-white">{totalPositions}</span>
            </div>
          </div>
        </RevealItem>

        <RevealItem>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
            <h3 className="mb-4 font-medium text-white">Neste steg</h3>
            <div className="flex flex-col gap-3">
              {nextSteps.map((step) => (
                <div key={step.label} className="flex items-center gap-3">
                  <step.icon className="size-4 text-white/30" />
                  <span className="text-sm text-white/50">{step.label}</span>
                </div>
              ))}
            </div>
          </div>
        </RevealItem>

        <RevealItem>
          <button
            onClick={handleGoToDashboard}
            disabled={isActivating}
            className={
              isActivating
                ? "flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-white/50 py-3 font-semibold text-black/50"
                : "flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 font-semibold text-black transition-colors hover:bg-white/90"
            }
          >
            {isActivating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Aktiverer...
              </>
            ) : (
              <>
                Ga til dashboardet
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
