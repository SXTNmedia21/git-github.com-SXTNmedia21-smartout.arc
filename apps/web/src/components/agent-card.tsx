"use client";

import { useState } from "react";
import { Send, Zap } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface DebugEntry {
  timestamp: number;
  type: "status" | "tool_call" | "tool_result" | "context_push" | "inference" | "event";
  content: string;
}

interface AgentCardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  description: string;
  greeting: string;
  temperature?: number;
  voice?: string;
  language?: string;
  maxDuration?: number;
  firstSpeaker?: "agent" | "user";
  status?: string;
  isConnected?: boolean;
  contextLog?: string[];
  debugLog?: DebugEntry[];
  transcript?: { role: string; text: string }[];
  instruction?: string;
  onSendContext?: (message: string) => void;
}

type TabId = "live" | "stages" | "prompt" | "settings";

const TABS: { id: TabId; label: string }[] = [
  { id: "live", label: "Live" },
  { id: "stages", label: "Stages" },
  { id: "prompt", label: "Prompt" },
  { id: "settings", label: "Settings" },
];

const STAGES = [
  {
    id: "a",
    label: "A — Bli kjent",
    description: "Navn + bedrift",
    message:
      "[Systemmelding: Fokuser på å bli kjent. Spør om navnet og bedriften. Ikke gå videre før du har begge.]",
  },
  {
    id: "b",
    label: "B — Finn bedriften",
    description: "Nettside, by, org.nr → scrape",
    message:
      "[Systemmelding: Finn bedriften på nett. Spør om nettside, by, org.nummer. Når du har nok, kall triggerScrape.]",
  },
  {
    id: "c",
    label: "C — Bekreft info",
    description: "Gå gjennom prefylt data",
    message:
      "[Systemmelding: Gå gjennom bedriftsinfo. Kall getOnboardingState, bekreft det som er fylt inn, fyll ut det som mangler med updateBusiness.]",
  },
  {
    id: "d",
    label: "D — Sesonger",
    description: "Årshjul + aktuell sesong",
    message:
      "[Systemmelding: Snakk om sesonger. Kartlegg årshjulet. Gå i dybden på den aktuelle sesongen: navn, start, slutt, omsetning, margin. Bruk updateSeason.]",
  },
  {
    id: "e",
    label: "E — Avdelinger + team",
    description: "Avdelinger, ledere, team",
    message:
      "[Systemmelding: Snakk om avdelinger. Hvilke avdelinger? Hvem leder dem? Er det flere team? Bruk addDepartments.]",
  },
  {
    id: "f",
    label: "F — Lokationer",
    description: "Hvor holder de til?",
    message: "[Systemmelding: Spør om lokationer. Hvor holder de til? Har de flere steder?]",
  },
  {
    id: "g",
    label: "G — Prosedyrer",
    description: "Rutiner, HACCP, regler",
    message:
      "[Systemmelding: Spør om viktige rutiner og prosedyrer. Åpningsrutiner, HACCP, viktige regler. Ikke gå i dybden, bare kartlegg.]",
  },
];

const REFERRALS = [
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
      "[Systemmelding: Brukeren forstod ikke. Gjenta det du nettopp sa, saktere og enklere.]",
  },
];

function ConfigItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium tracking-wider text-white/40 uppercase">
        {label}
      </span>
      <span className="text-sm text-white/80">{value}</span>
    </div>
  );
}

export function AgentCard({
  open,
  onOpenChange,
  name,
  description,
  greeting,
  temperature,
  voice,
  language,
  maxDuration,
  firstSpeaker,
  status,
  isConnected,
  contextLog,
  debugLog,
  transcript,
  instruction,
  onSendContext,
}: AgentCardProps) {
  const [activeTab, setActiveTab] = useState<TabId>("live");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto border-white/10 bg-black/90 p-0 backdrop-blur-xl sm:max-w-md"
      >
        {/* Header */}
        <SheetHeader className="border-b border-white/[0.06] px-6 py-5">
          <div className="flex items-center gap-3">
            <SheetTitle className="text-lg font-semibold text-white">{name}</SheetTitle>
            {isConnected !== undefined && (
              <span
                className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-400" : "bg-white/20"}`}
              />
            )}
            {status && status !== "idle" && (
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium tracking-wider text-white/40 uppercase">
                {status}
              </span>
            )}
          </div>
          <SheetDescription className="text-sm text-white/50">{greeting}</SheetDescription>
        </SheetHeader>

        {/* Tabs */}
        <div className="flex border-b border-white/[0.06]">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2.5 text-[11px] font-medium tracking-wider uppercase transition-colors ${
                activeTab === tab.id
                  ? "border-b-2 border-white/60 text-white"
                  : "text-white/30 hover:text-white/50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {/* Live tab — transcript + referrals */}
          {activeTab === "live" && (
            <div className="flex flex-col gap-4 px-6 py-4">
              {/* Referral buttons */}
              {onSendContext && (
                <div>
                  <h3 className="mb-2 text-[10px] font-medium tracking-wider text-white/40 uppercase">
                    Hurtigkommandoer
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {REFERRALS.map((ref) => (
                      <button
                        key={ref.id}
                        type="button"
                        onClick={() => onSendContext(ref.message)}
                        className="flex items-center gap-1 rounded-full bg-white/[0.06] px-3 py-1.5 text-[11px] text-white/60 transition-colors hover:bg-white/[0.12] hover:text-white/80"
                      >
                        <Zap className="h-3 w-3" />
                        {ref.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Transcript */}
              {transcript && transcript.length > 0 && (
                <div>
                  <h3 className="mb-2 text-[10px] font-medium tracking-wider text-white/40 uppercase">
                    Transcript ({transcript.length})
                  </h3>
                  <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
                    {transcript.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex flex-col gap-0.5 ${msg.role === "user" ? "items-end" : "items-start"}`}
                      >
                        <span className="text-[10px] font-medium tracking-wider text-white/30 uppercase">
                          {msg.role}
                        </span>
                        <p
                          className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                            msg.role === "user"
                              ? "bg-white/[0.08] text-white/70"
                              : "bg-white/[0.04] text-white/60"
                          }`}
                        >
                          {msg.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Context log */}
              {contextLog && contextLog.length > 0 && (
                <div>
                  <h3 className="mb-2 text-[10px] font-medium tracking-wider text-white/40 uppercase">
                    Context pushed ({contextLog.length})
                  </h3>
                  <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto">
                    {contextLog.map((msg, i) => (
                      <p
                        key={i}
                        className="rounded-md bg-white/[0.04] px-3 py-1.5 text-xs leading-relaxed text-white/60"
                      >
                        {msg}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Debug log */}
              {debugLog && debugLog.length > 0 && (
                <div>
                  <h3 className="mb-2 text-[10px] font-medium tracking-wider text-white/40 uppercase">
                    Debug ({debugLog.length})
                  </h3>
                  <div className="flex max-h-60 flex-col gap-1 overflow-y-auto font-mono text-[11px]">
                    {debugLog.map((entry, i) => {
                      const time = new Date(entry.timestamp).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      });
                      const colors: Record<string, string> = {
                        status: "text-blue-400/70",
                        tool_call: "text-amber-400/80",
                        tool_result: "text-emerald-400/60",
                        context_push: "text-purple-400/70",
                        inference: "text-rose-400/70",
                        event: "text-white/30",
                      };
                      return (
                        <div key={i} className="flex gap-2 leading-tight">
                          <span className="shrink-0 text-white/20">{time}</span>
                          <span className={`shrink-0 ${colors[entry.type] ?? "text-white/40"}`}>
                            {entry.type}
                          </span>
                          <span className="truncate text-white/50">{entry.content}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Stages tab */}
          {activeTab === "stages" && (
            <div className="flex flex-col gap-1.5 px-6 py-4">
              <h3 className="mb-1 text-[10px] font-medium tracking-wider text-white/40 uppercase">
                Onboarding stages
              </h3>
              {STAGES.map((stage) => (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => onSendContext?.(stage.message)}
                  disabled={!onSendContext}
                  className="flex items-center gap-3 rounded-lg bg-white/[0.04] px-4 py-3 text-left transition-colors hover:bg-white/[0.08] disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5 shrink-0 text-white/30" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-white/80">{stage.label}</span>
                    <span className="text-[11px] text-white/40">{stage.description}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Prompt tab */}
          {activeTab === "prompt" && (
            <div className="px-6 py-4">
              <h3 className="mb-3 text-[10px] font-medium tracking-wider text-white/40 uppercase">
                System prompt
              </h3>
              {instruction ? (
                <pre className="max-h-[60vh] overflow-y-auto rounded-lg bg-white/[0.04] p-4 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-white/50">
                  {instruction}
                </pre>
              ) : (
                <p className="text-sm text-white/30">No system prompt loaded.</p>
              )}
            </div>
          )}

          {/* Settings tab */}
          {activeTab === "settings" && (
            <div className="px-6 py-4">
              <h3 className="mb-3 text-[10px] font-medium tracking-wider text-white/40 uppercase">
                Config
              </h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {temperature !== undefined && (
                  <ConfigItem label="Temperature" value={String(temperature)} />
                )}
                {voice && (
                  <ConfigItem
                    label="Voice"
                    value={voice.length > 12 ? `${voice.slice(0, 12)}...` : voice}
                  />
                )}
                {language && <ConfigItem label="Language" value={language} />}
                {maxDuration !== undefined && (
                  <ConfigItem label="Max duration" value={`${Math.round(maxDuration / 60)} min`} />
                )}
                {firstSpeaker && <ConfigItem label="First speaker" value={firstSpeaker} />}
              </div>
              <div className="mt-6">
                <p className="text-xs leading-relaxed text-white/30">{description}</p>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
