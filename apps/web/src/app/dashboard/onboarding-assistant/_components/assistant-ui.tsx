"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Mic, MicOff, Send, Volume2 } from "lucide-react";

// Mock data to simulate the Pydantic AI state
const STAGES = [
  { id: "stage-1", title: "Identitet & Nyckelroller", status: "completed" },
  { id: "stage-2", title: "Avdelningar (Departments)", status: "current" },
  { id: "stage-3", title: "Team (per avdelning)", status: "pending" },
  { id: "stage-4", title: "Lokationer (Huvudbyggnader)", status: "pending" },
  { id: "stage-5", title: "Zoner inom lokationerna", status: "pending" },
  { id: "stage-6", title: "Assets, HACCP & Rutiner", status: "pending" },
  { id: "stage-7", title: "Sesonger & Årshjul", status: "pending" },
];

const INITIAL_TRANSCRIPT = [
  {
    id: 1,
    speaker: "AGENT",
    text: "Hei! Jeg er Mr. Botsson. Hva heter hotellet ditt, og hvordan vil du beskrive atmosfæren her?",
    timestamp: "10:00:05",
  },
  {
    id: 2,
    speaker: "USER",
    text: "Vi heter Hotell Spåtind. Det er et høyfjellshotell med fokus på familie og skiopplevelser, veldig avslappet stemning.",
    timestamp: "10:00:20",
  },
  {
    id: 3,
    speaker: "AGENT",
    text: "Flott. Et avslappet høyfjellshotell høres fantastisk ut. Hvem er det som sitter som daglig leder hos dere?",
    timestamp: "10:00:25",
  },
  {
    id: 4,
    speaker: "USER",
    text: "Det er Kari Nordmann som er daglig leder, og Per Olsen har ansvar for HR og personal.",
    timestamp: "10:00:40",
  },
  {
    id: 5,
    speaker: "AGENT",
    text: "Da har jeg notert Kari og Per. Hvem er det som er satt som brannansvarig?",
    timestamp: "10:00:45",
  },
  {
    id: 6,
    speaker: "USER",
    text: "Det er faktisk også Per Olsen.",
    timestamp: "10:00:50",
  },
  {
    id: 7,
    speaker: "AGENT",
    text: "Skjønner. Da vet vi hvem som har de viktigste rollene! La oss gå videre. Hvilke hovedavdelinger har dere fast på hotellet?",
    timestamp: "10:00:55",
  },
];

type ExtractedData = {
  company_name: string | null;
  vibe: string | null;
  general_manager: string | null;
  hr_manager: string | null;
  fire_safety_manager: string | null;
  departments: string[];
  teams: string[];
  locations: string[];
  zones: string[];
  assets_with_haccp: string[];
  current_season: string | null;
};

const INITIAL_EXTRACTED_DATA: ExtractedData = {
  company_name: "Hotell Spåtind",
  vibe: "Høyfjellshotell, familie og ski, avslappet",
  general_manager: "Kari Nordmann",
  hr_manager: "Per Olsen",
  fire_safety_manager: "Per Olsen",
  departments: [],
  teams: [],
  locations: [],
  zones: [],
  assets_with_haccp: [],
  current_season: null,
};

export function AssistantUI() {
  const [transcripts, setTranscripts] = useState(INITIAL_TRANSCRIPT);
  const [extractedData, setExtractedData] = useState<ExtractedData>(INITIAL_EXTRACTED_DATA);
  const [isRecording, setIsRecording] = useState(false);
  const [inputText, setInputText] = useState("");

  const handleSend = () => {
    if (!inputText.trim()) return;

    // Add user message
    const newMessage = {
      id: Date.now(),
      speaker: "USER",
      text: inputText,
      timestamp: new Date().toLocaleTimeString("no-NO", { hour12: false }).substring(0, 8),
    };

    setTranscripts((prev) => [...prev, newMessage]);
    setInputText("");

    // Simulate Agent response after a short delay
    setTimeout(() => {
      setTranscripts((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          speaker: "AGENT",
          text: "Supert, det har jeg lagt til. Hva med kjøkken og servering?",
          timestamp: new Date().toLocaleTimeString("no-NO", { hour12: false }).substring(0, 8),
        },
      ]);

      // Update extracted data
      setExtractedData((prev) => ({
        ...prev,
        departments: ["Resepsjon", "Renhold"],
      }));
    }, 1500);
  };

  return (
    <div className="grid h-[800px] grid-cols-1 gap-6 md:grid-cols-3">
      {/* LEFT PANE: Conversation & Input */}
      <div className="bg-card flex flex-col overflow-hidden rounded-xl border shadow-sm md:col-span-2">
        <div className="bg-muted/30 flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 text-primary rounded-full p-2">
              <Volume2 size={20} />
            </div>
            <div>
              <h3 className="text-card-foreground font-semibold">Mr. Botsson Voice Session</h3>
              <p className="text-muted-foreground flex items-center gap-2 text-xs">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </span>
                Active Connection
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsRecording(!isRecording)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              isRecording
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
            {isRecording ? "Stop Listening" : "Start Voice"}
          </button>
        </div>

        {/* Transcripts List */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {transcripts.map((msg) => (
            <div
              key={msg.id}
              className={`flex max-w-[80%] flex-col ${msg.speaker === "USER" ? "ml-auto items-end" : "mr-auto items-start"}`}
            >
              <span className="text-muted-foreground mb-1 ml-1 text-[10px]">{msg.timestamp}</span>
              <div
                className={`rounded-2xl p-3 ${
                  msg.speaker === "USER"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-muted text-foreground rounded-tl-sm border"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        {/* Input Area (Fallback for Voice) */}
        <div className="bg-muted/10 border-t p-4">
          <div className="relative flex items-center">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Skriv et svar for å simulere..."
              className="bg-background focus:ring-primary/50 w-full rounded-xl border py-3 pr-12 pl-4 focus:ring-2 focus:outline-none"
            />
            <button
              onClick={handleSend}
              className="bg-primary text-primary-foreground hover:bg-primary/90 absolute right-2 rounded-lg p-2 transition"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT PANE: Progress & Data Extraction */}
      <div className="flex h-full flex-col space-y-6 overflow-hidden">
        {/* Progression tracker */}
        <div className="bg-card rounded-xl border p-5 shadow-sm">
          <h3 className="text-muted-foreground mb-4 text-sm font-semibold tracking-wider uppercase">
            Intervju-Progresjon
          </h3>
          <div className="space-y-4">
            {STAGES.map((stage, idx) => (
              <div key={stage.id} className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  {stage.status === "completed" ? (
                    <CheckCircle2 size={20} className="text-emerald-500" />
                  ) : stage.status === "current" ? (
                    <div className="border-primary flex h-5 w-5 items-center justify-center rounded-full border-2">
                      <div className="bg-primary h-2 w-2 animate-pulse rounded-full" />
                    </div>
                  ) : (
                    <Circle size={20} className="text-muted-foreground/30" />
                  )}
                </div>
                <div
                  className={`text-sm ${
                    stage.status === "completed"
                      ? "text-foreground font-medium"
                      : stage.status === "current"
                        ? "text-primary font-bold"
                        : "text-muted-foreground"
                  }`}
                >
                  {idx + 1}. {stage.title}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Extracted Data Visualizer */}
        <div className="bg-card flex-1 overflow-y-auto rounded-xl border p-5 shadow-sm">
          <h3 className="text-muted-foreground mb-4 text-sm font-semibold tracking-wider uppercase">
            Smartout Workspace Data
          </h3>

          <div className="space-y-4">
            <div className="bg-muted/50 space-y-1 rounded-md p-3">
              <span className="text-muted-foreground text-xs font-semibold">Company Name</span>
              <p className="text-sm font-medium">{extractedData.company_name || "—"}</p>
            </div>

            <div className="bg-muted/50 space-y-1 rounded-md p-3">
              <span className="text-muted-foreground text-xs font-semibold">Konsept / Vibe</span>
              <p className="text-foreground/80 text-sm">{extractedData.vibe || "—"}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1 rounded-md border p-3">
                <span className="text-muted-foreground text-[10px] font-bold uppercase">
                  Daglig Leder
                </span>
                <p className="text-sm">{extractedData.general_manager || "—"}</p>
              </div>
              <div className="space-y-1 rounded-md border p-3">
                <span className="text-muted-foreground text-[10px] font-bold uppercase">
                  HR / Personal
                </span>
                <p className="text-sm">{extractedData.hr_manager || "—"}</p>
              </div>
              <div className="space-y-1 rounded-md border p-3">
                <span className="text-muted-foreground text-[10px] font-bold uppercase">
                  Brannansvarig
                </span>
                <p className="text-sm">{extractedData.fire_safety_manager || "—"}</p>
              </div>
            </div>

            <div>
              <span className="text-muted-foreground mb-2 block text-xs font-semibold">
                Oppdagede Avdelinger
              </span>
              <div className="flex flex-wrap gap-2">
                {extractedData.departments.length > 0 ? (
                  extractedData.departments.map((dep) => (
                    <span
                      key={dep}
                      className="bg-primary/10 text-primary rounded px-2 py-1 text-xs font-medium"
                    >
                      {dep}
                    </span>
                  ))
                ) : (
                  <span className="text-muted-foreground text-xs italic">Venter på data...</span>
                )}
              </div>
            </div>

            {/* This code block reveals the raw intelligence structure */}
            <div className="mt-6 border-t pt-4">
              <span className="text-muted-foreground mb-2 block text-xs font-semibold">
                Live Intelligence Payload
              </span>
              <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 text-[10px] text-emerald-400">
                {JSON.stringify(extractedData, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
