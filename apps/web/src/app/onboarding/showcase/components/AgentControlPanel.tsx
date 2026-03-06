"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown, Send, Zap } from "lucide-react";
import { useOnboarding } from "../WizardContext";

const STAGES = [
  {
    id: "a",
    label: "A — Bli kjent",
    message:
      "[Systemmelding: Fokuser på å bli kjent. Spør om navnet og bedriften. Ikke gå videre før du har begge.]",
  },
  {
    id: "b",
    label: "B — Finn bedriften",
    message:
      "[Systemmelding: Finn bedriften på nett. Spør om nettside, by, org.nummer. Når du har nok, kall triggerScrape.]",
  },
  {
    id: "c",
    label: "C — Bekreft info",
    message:
      "[Systemmelding: Gå gjennom bedriftsinfo. Kall getOnboardingState, bekreft det som er fylt inn, fyll ut det som mangler med updateBusiness.]",
  },
  {
    id: "d",
    label: "D — Sesonger",
    message:
      "[Systemmelding: Snakk om sesonger. Kartlegg årshjulet. Gå i dybden på den aktuelle sesongen: navn, start, slutt, omsetning, margin. Bruk updateSeason.]",
  },
  {
    id: "e",
    label: "E — Avdelinger + team",
    message:
      "[Systemmelding: Snakk om avdelinger. Hvilke avdelinger? Hvem leder dem? Er det flere team? Bruk addDepartments.]",
  },
  {
    id: "f",
    label: "F — Lokationer",
    message: "[Systemmelding: Spør om lokationer. Hvor holder de til? Har de flere steder?]",
  },
  {
    id: "g",
    label: "G — Prosedyrer",
    message:
      "[Systemmelding: Spør om viktige rutiner og prosedyrer. Åpningsrutiner, HACCP, viktige regler. Ikke gå i dybden, bare kartlegg.]",
  },
];

const REFERRAL_MESSAGES = [
  {
    id: "ask-name",
    label: "Spør om navn",
    message: "[Systemmelding: Spør brukeren hva de heter. Vent på svar.]",
  },
  {
    id: "ask-company",
    label: "Spør om bedrift",
    message: "[Systemmelding: Spør hva bedriften heter og hvor den ligger.]",
  },
  {
    id: "summarize",
    label: "Oppsummer",
    message:
      "[Systemmelding: Oppsummer det du har lært så langt. Si hva du vet og spør om det stemmer.]",
  },
  {
    id: "move-on",
    label: "Gå videre",
    message: "[Systemmelding: Avslutt dette temaet naturlig og gå videre til neste.]",
  },
  {
    id: "slow-down",
    label: "Saktere",
    message: "[Systemmelding: Du snakker for fort. Sakk ned. Vent mer på svar. Korte setninger.]",
  },
  {
    id: "wrap-up",
    label: "Avslutt",
    message:
      "[Systemmelding: Avslutt samtalen. Oppsummer kort alt dere har satt opp og si velkommen til Smartout.]",
  },
  {
    id: "repeat",
    label: "Gjenta",
    message:
      "[Systemmelding: Brukeren hørte ikke. Gjenta det siste du sa, litt tydeligere og saktere.]",
  },
  {
    id: "scrape",
    label: "Trigger scrape",
    message: "[Systemmelding: Du har nok info. Kall triggerScrape nå med det du har.]",
  },
];

export function AgentControlPanel() {
  const { botsson } = useOnboarding();
  const [isOpen, setIsOpen] = useState(false);
  const [lastSent, setLastSent] = useState<string | null>(null);

  if (!botsson.isConnected) return null;

  const send = (message: string, label: string) => {
    botsson.sendContext(message);
    setLastSent(label);
    setTimeout(() => setLastSent(null), 2000);
  };

  return (
    <div className="fixed bottom-8 left-8 z-50">
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="mb-2 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-[11px] font-medium text-white/50 backdrop-blur-xl transition-colors hover:text-white/80"
      >
        <Zap size={12} />
        Kontroll
        {isOpen ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="flex gap-3 rounded-2xl border border-white/[0.06] bg-black/80 p-4 shadow-2xl backdrop-blur-xl">
          {/* Left: Stages */}
          <div className="flex flex-col gap-1.5">
            <p className="mb-1 font-mono text-[10px] tracking-widest text-white/30 uppercase">
              Tema
            </p>
            {STAGES.map((stage) => (
              <button
                key={stage.id}
                onClick={() => send(stage.message, stage.label)}
                className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-left text-xs text-white/60 transition-colors hover:border-white/10 hover:bg-white/[0.06] hover:text-white/90"
              >
                <Send size={10} className="shrink-0 text-white/30" />
                {stage.label}
              </button>
            ))}
          </div>

          {/* Right: Referral messages */}
          <div className="flex flex-col gap-1.5">
            <p className="mb-1 font-mono text-[10px] tracking-widest text-white/30 uppercase">
              Referral
            </p>
            {REFERRAL_MESSAGES.map((msg) => (
              <button
                key={msg.id}
                onClick={() => send(msg.message, msg.label)}
                className="flex items-center gap-1.5 rounded-lg border border-amber-500/[0.08] bg-amber-500/[0.03] px-3 py-1.5 text-left text-xs text-amber-200/60 transition-colors hover:border-amber-500/20 hover:bg-amber-500/[0.08] hover:text-amber-200/90"
              >
                <Zap size={10} className="shrink-0 text-amber-400/40" />
                {msg.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sent confirmation */}
      {lastSent && (
        <div className="mt-1 text-right text-[10px] text-emerald-400/60">Sendt: {lastSent}</div>
      )}
    </div>
  );
}
