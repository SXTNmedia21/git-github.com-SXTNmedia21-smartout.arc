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
            setExtractedData(prev => ({
                ...prev,
                departments: ["Resepsjon", "Renhold"]
            }));
        }, 1500);
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[800px]">

            {/* LEFT PANE: Conversation & Input */}
            <div className="md:col-span-2 flex flex-col bg-card border rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-full text-primary">
                            <Volume2 size={20} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-card-foreground">Mr. Botsson Voice Session</h3>
                            <p className="text-xs text-muted-foreground flex items-center gap-2">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                Active Connection
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsRecording(!isRecording)}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${isRecording ? "bg-red-500 text-white hover:bg-red-600" : "bg-primary text-primary-foreground hover:bg-primary/90"
                            }`}
                    >
                        {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
                        {isRecording ? "Stop Listening" : "Start Voice"}
                    </button>
                </div>

                {/* Transcripts List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {transcripts.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex flex-col max-w-[80%] ${msg.speaker === "USER" ? "ml-auto items-end" : "mr-auto items-start"}`}
                        >
                            <span className="text-[10px] text-muted-foreground mb-1 ml-1">{msg.timestamp}</span>
                            <div
                                className={`p-3 rounded-2xl ${msg.speaker === "USER"
                                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                                    : "bg-muted text-foreground border rounded-tl-sm"
                                    }`}
                            >
                                {msg.text}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Input Area (Fallback for Voice) */}
                <div className="p-4 border-t bg-muted/10">
                    <div className="relative flex items-center">
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSend()}
                            placeholder="Skriv et svar for å simulere..."
                            className="w-full pl-4 pr-12 py-3 rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                        <button
                            onClick={handleSend}
                            className="absolute right-2 p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition"
                        >
                            <Send size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* RIGHT PANE: Progress & Data Extraction */}
            <div className="space-y-6 flex flex-col h-full overflow-hidden">

                {/* Progression tracker */}
                <div className="bg-card border rounded-xl p-5 shadow-sm">
                    <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Intervju-Progresjon</h3>
                    <div className="space-y-4">
                        {STAGES.map((stage, idx) => (
                            <div key={stage.id} className="flex items-center gap-3">
                                <div className="flex-shrink-0">
                                    {stage.status === "completed" ? (
                                        <CheckCircle2 size={20} className="text-emerald-500" />
                                    ) : stage.status === "current" ? (
                                        <div className="h-5 w-5 rounded-full border-2 border-primary flex items-center justify-center">
                                            <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
                                        </div>
                                    ) : (
                                        <Circle size={20} className="text-muted-foreground/30" />
                                    )}
                                </div>
                                <div className={`text-sm ${stage.status === "completed" ? "text-foreground font-medium" :
                                    stage.status === "current" ? "text-primary font-bold" :
                                        "text-muted-foreground"
                                    }`}>
                                    {idx + 1}. {stage.title}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Extracted Data Visualizer */}
                <div className="bg-card border rounded-xl p-5 shadow-sm flex-1 overflow-y-auto">
                    <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Smartout Workspace Data</h3>

                    <div className="space-y-4">
                        <div className="space-y-1 rounded-md bg-muted/50 p-3">
                            <span className="text-xs font-semibold text-muted-foreground">Company Name</span>
                            <p className="text-sm font-medium">{extractedData.company_name || "—"}</p>
                        </div>

                        <div className="space-y-1 rounded-md bg-muted/50 p-3">
                            <span className="text-xs font-semibold text-muted-foreground">Konsept / Vibe</span>
                            <p className="text-sm text-foreground/80">{extractedData.vibe || "—"}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1 rounded-md border p-3">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground">Daglig Leder</span>
                                <p className="text-sm">{extractedData.general_manager || "—"}</p>
                            </div>
                            <div className="space-y-1 rounded-md border p-3">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground">HR / Personal</span>
                                <p className="text-sm">{extractedData.hr_manager || "—"}</p>
                            </div>
                            <div className="space-y-1 rounded-md border p-3">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground">Brannansvarig</span>
                                <p className="text-sm">{extractedData.fire_safety_manager || "—"}</p>
                            </div>
                        </div>

                        <div>
                            <span className="text-xs font-semibold text-muted-foreground mb-2 block">Oppdagede Avdelinger</span>
                            <div className="flex flex-wrap gap-2">
                                {extractedData.departments.length > 0 ? (
                                    extractedData.departments.map(dep => (
                                        <span key={dep} className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium">
                                            {dep}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-xs text-muted-foreground italic">Venter på data...</span>
                                )}
                            </div>
                        </div>

                        {/* This code block reveals the raw intelligence structure */}
                        <div className="mt-6 pt-4 border-t">
                            <span className="text-xs font-semibold text-muted-foreground mb-2 block">Live Intelligence Payload</span>
                            <pre className="bg-slate-950 text-emerald-400 p-3 rounded-lg text-[10px] overflow-x-auto">
                                {JSON.stringify(extractedData, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
