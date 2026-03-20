"use client";

import { useState } from "react";
import { useWalkAi } from "./WalkAiProvider";
import { PERSONAS, RANKS } from "./persona-engine";
import { VOICE_OPTIONS, LISA_PERSONALITIES } from "./types";
import type { AgentPersona, AgentRank, PersonaRankBlend } from "./types";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  Emma — Agent Settings & Identity          */
/*                                             */
/*  Controls who she is and how she speaks.    */
/*  Settings persist across sessions via       */
/*  localStorage and take effect on next call. */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

type Tab = "overview" | "identity" | "voice" | "prompts";

export function EmmaProfile() {
  const {
    identity,
    identityDisplay,
    voiceTuning,
    selectedVoice,
    agent,
    setIdentity,
    setVoiceTuning,
    setSelectedVoice,
    customPrompt,
    setCustomPrompt,
    personaPrompt,
  } = useWalkAi();

  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const persona = PERSONAS[identity.persona];
  const rank = RANKS[identity.rank];
  const voice = VOICE_OPTIONS.find((v) => v.id === selectedVoice);

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Oversikt" },
    { id: "identity", label: "Personlighet" },
    { id: "voice", label: "Stemme" },
    { id: "prompts", label: "Prompt" },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* ━━━ Compact header ━━━ */}
      <div className="flex items-center gap-3 px-1 pb-2">
        <div className="relative flex-shrink-0">
          <div className="from-brand-orange/20 to-brand-orange/5 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br">
            <div className="bg-brand-orange h-2.5 w-2.5 rounded-full" />
          </div>
          {agent.isConnected && (
            <div className="border-card absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 bg-emerald-500" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h2 className="text-foreground text-base font-semibold">Emma</h2>
            <span className="text-muted-foreground/40 font-mono text-[9px]">{identityDisplay}</span>
          </div>
          <p className="text-muted-foreground/60 text-[11px]">
            {voice?.name ?? "Ukjent"} · {persona.name} · {rank.name}
          </p>
        </div>
      </div>

      {/* ━━━ Tab bar ━━━ */}
      <div className="border-border/20 flex gap-0.5 border-b px-1 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              "rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all duration-150",
              activeTab === tab.id
                ? "bg-brand-orange/10 text-brand-orange"
                : "text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent/40",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ━━━ Tab content ━━━ */}
      <div className="flex-1 space-y-4 overflow-y-auto px-1 py-3">
        {activeTab === "overview" && (
          <OverviewTab
            identity={identity}
            voiceTuning={voiceTuning}
            selectedVoice={selectedVoice}
            customPrompt={customPrompt}
            personaPrompt={personaPrompt}
            isConnected={agent.isConnected}
            setActiveTab={setActiveTab}
          />
        )}
        {activeTab === "identity" && <IdentityTab identity={identity} setIdentity={setIdentity} />}
        {activeTab === "voice" && (
          <VoiceTab
            selectedVoice={selectedVoice}
            setSelectedVoice={setSelectedVoice}
            voiceTuning={voiceTuning}
            setVoiceTuning={setVoiceTuning}
          />
        )}
        {activeTab === "prompts" && (
          <PromptsTab
            personaPrompt={personaPrompt}
            customPrompt={customPrompt}
            setCustomPrompt={setCustomPrompt}
          />
        )}
      </div>
    </div>
  );
}

/* ━━━ Overview Tab (new) ━━━━━━━━━━━━━━━━━━ */

function OverviewTab({
  identity,
  voiceTuning,
  selectedVoice,
  customPrompt,
  personaPrompt,
  isConnected,
  setActiveTab,
}: {
  identity: { rank: AgentRank; persona: AgentPersona; blend: PersonaRankBlend };
  voiceTuning: { temperature: number; firstSpeaker: "user" | "agent"; greeting: string; maxDuration: string; inactivityTimeout: string };
  selectedVoice: string;
  customPrompt: string;
  personaPrompt: string;
  isConnected: boolean;
  setActiveTab: (tab: Tab) => void;
}) {
  const persona = PERSONAS[identity.persona];
  const rank = RANKS[identity.rank];
  const voice = VOICE_OPTIONS.find((v) => v.id === selectedVoice);
  const promptLength = (personaPrompt + (customPrompt ? `\n\n${customPrompt}` : "")).length;

  return (
    <>
      {/* Status */}
      <div className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 ${isConnected ? "border-emerald-500/20 bg-emerald-500/5" : "border-border/20 bg-card/30"}`}>
        <div className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/20"}`} />
        <span className="text-[11px] font-medium">{isConnected ? "Tilkoblet" : "Ikke tilkoblet"}</span>
        <span className="text-muted-foreground/40 ml-auto text-[10px]">Innstillinger lagres automatisk</span>
      </div>

      {/* What gets sent — summary cards */}
      <Section label="Hva sendes til agenten">
        <div className="space-y-2">
          {/* Personality card */}
          <OverviewCard
            title="Personlighet"
            onClick={() => setActiveTab("identity")}
            rows={[
              { label: "Persona", value: `${persona.name} — "${persona.angle}"` },
              { label: "Autoritet", value: `${rank.name} — ${rank.authority}` },
              { label: "Balanse", value: identity.blend <= 3 ? "Personlighet dominerer" : identity.blend >= 7 ? "Autoritet dominerer" : "Balansert" },
            ]}
          />

          {/* Voice card */}
          <OverviewCard
            title="Stemme"
            onClick={() => setActiveTab("voice")}
            rows={[
              { label: "Stemme", value: voice?.name ?? "Ukjent" },
              { label: "Temperatur", value: `${voiceTuning.temperature.toFixed(1)} (${voiceTuning.temperature <= 0.3 ? "presis" : voiceTuning.temperature >= 0.7 ? "kreativ" : "balansert"})` },
              { label: "Starter", value: voiceTuning.firstSpeaker === "agent" ? "Emma snakker forst" : "Bruker snakker forst" },
              ...(voiceTuning.greeting ? [{ label: "Hilsen", value: voiceTuning.greeting.slice(0, 50) + (voiceTuning.greeting.length > 50 ? "..." : "") }] : []),
            ]}
          />

          {/* Prompt card */}
          <OverviewCard
            title="Prompt"
            onClick={() => setActiveTab("prompts")}
            rows={[
              { label: "Systemprompt", value: `${personaPrompt.split("\n").length} linjer` },
              { label: "Egendefinert", value: customPrompt ? `${customPrompt.length} tegn` : "Ingen" },
              { label: "Totalt", value: `${promptLength} tegn sendt` },
            ]}
          />
        </div>
      </Section>

      {/* Persistence notice */}
      <div className="border-border/10 rounded-xl border px-3.5 py-2.5">
        <p className="text-muted-foreground/40 text-[10px] leading-relaxed">
          Alle innstillinger lagres automatisk og gjenopprettes neste gang du aper dashboardet.
          Endringer i personlighet og stemme tar effekt ved neste samtale.
        </p>
      </div>
    </>
  );
}

function OverviewCard({
  title,
  rows,
  onClick,
}: {
  title: string;
  rows: { label: string; value: string }[];
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="border-border/20 bg-card/30 hover:border-border/40 hover:bg-accent/20 w-full rounded-xl border px-3.5 py-3 text-left transition-all duration-150"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-foreground text-[12px] font-semibold">{title}</span>
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-muted-foreground/30">
          <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-2">
            <span className="text-muted-foreground/50 flex-shrink-0 text-[10px]">{row.label}</span>
            <span className="text-foreground/70 truncate text-right text-[11px]">{row.value}</span>
          </div>
        ))}
      </div>
    </button>
  );
}

/* ━━━ Identity Tab ━━━━━━━━━━━━━━━━━━━━━━━ */

function IdentityTab({
  identity,
  setIdentity,
}: {
  identity: { rank: AgentRank; persona: AgentPersona; blend: PersonaRankBlend };
  setIdentity: (partial: Partial<typeof identity>) => void;
}) {
  const personaKeys = Object.keys(PERSONAS) as AgentPersona[];
  const rankKeys = Object.keys(RANKS) as AgentRank[];

  return (
    <>
      {/* Quick presets */}
      <Section label="Hurtigvalg">
        <div className="grid grid-cols-2 gap-2">
          {LISA_PERSONALITIES.map((preset) => {
            const isActive =
              identity.persona === preset.identity.persona &&
              identity.rank === preset.identity.rank &&
              identity.blend === preset.identity.blend;
            return (
              <button
                key={preset.name}
                onClick={() => setIdentity(preset.identity)}
                className={[
                  "rounded-xl border px-3 py-2.5 text-left transition-all duration-150",
                  isActive
                    ? "border-brand-orange/30 bg-brand-orange/8 shadow-[0_0_12px_rgba(255,140,50,0.15)]"
                    : "border-border/30 bg-card/50 hover:border-border/50 hover:bg-accent/30",
                ].join(" ")}
              >
                <p
                  className={`text-[12px] font-semibold ${isActive ? "text-brand-orange" : "text-foreground"}`}
                >
                  {preset.name}
                </p>
                <p className="text-muted-foreground/50 mt-0.5 text-[10px]">{preset.description}</p>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Persona selector */}
      <Section label="Persona">
        <div className="space-y-1.5">
          {personaKeys.map((key) => {
            const p = PERSONAS[key];
            const active = identity.persona === key;
            return (
              <button
                key={key}
                onClick={() => setIdentity({ persona: key })}
                className={[
                  "flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-all duration-150",
                  active
                    ? "border-brand-orange/25 bg-brand-orange/5"
                    : "border-border/20 hover:border-border/40 hover:bg-accent/20",
                ].join(" ")}
              >
                <div
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${active ? "bg-brand-orange/15 text-brand-orange" : "bg-accent text-muted-foreground"}`}
                >
                  <span className="text-xs font-bold">{p.name[0]}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-medium ${active ? "text-brand-orange" : "text-foreground"}`}
                  >
                    {p.name}
                  </p>
                  <p className="text-muted-foreground/60 text-[11px]">{p.traits}</p>
                  <p className="text-muted-foreground/40 mt-0.5 text-[10px]">
                    Vinkel: {p.angle} · Stemme: {p.voice}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Rank selector */}
      <Section label="Autoritet">
        <div className="grid grid-cols-2 gap-2">
          {rankKeys.map((key) => {
            const r = RANKS[key];
            const active = identity.rank === key;
            return (
              <button
                key={key}
                onClick={() => setIdentity({ rank: key })}
                className={[
                  "rounded-xl border px-3 py-2.5 text-left transition-all duration-150",
                  active
                    ? "border-brand-orange/25 bg-brand-orange/5"
                    : "border-border/20 hover:border-border/40 hover:bg-accent/20",
                ].join(" ")}
              >
                <p
                  className={`text-[12px] font-semibold ${active ? "text-brand-orange" : "text-foreground"}`}
                >
                  {r.name}
                </p>
                <p className="text-muted-foreground/50 text-[10px]">{r.authority}</p>
                <p className="text-muted-foreground/35 mt-0.5 text-[9px]">Tone: {r.tone}</p>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Blend slider */}
      <Section label="Balanse">
        <div className="space-y-2">
          <div className="text-muted-foreground/50 flex items-center justify-between text-[10px]">
            <span>Personlighet</span>
            <span className="text-foreground/60 font-mono">{identity.blend}</span>
            <span>Autoritet</span>
          </div>
          <input
            type="range"
            min={0}
            max={10}
            step={1}
            value={identity.blend}
            onChange={(e) => setIdentity({ blend: Number(e.target.value) as PersonaRankBlend })}
            className="h-1.5 w-full accent-[var(--brand-orange)]"
          />
          <p className="text-muted-foreground/40 text-center text-[10px]">
            {identity.blend <= 3
              ? "Personlighet dominerer — Emma er mer seg selv"
              : identity.blend >= 7
                ? "Autoritet dominerer — Emma er mer formell og besluttsom"
                : "Balansert — personlighet og autoritet i harmoni"}
          </p>
        </div>
      </Section>
    </>
  );
}

/* ━━━ Voice Tab ━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function VoiceTab({
  selectedVoice,
  setSelectedVoice,
  voiceTuning,
  setVoiceTuning,
}: {
  selectedVoice: string;
  setSelectedVoice: (id: string) => void;
  voiceTuning: {
    temperature: number;
    maxDuration: string;
    firstSpeaker: "user" | "agent";
    greeting: string;
    inactivityTimeout: string;
    inactivityMessage: string;
    timeExceededMessage: string;
  };
  setVoiceTuning: (partial: Partial<typeof voiceTuning>) => void;
}) {
  return (
    <>
      {/* Voice selection */}
      <Section label="Stemme">
        <div className="space-y-1.5">
          {VOICE_OPTIONS.map((v) => {
            const active = selectedVoice === v.id;
            return (
              <button
                key={v.id}
                onClick={() => setSelectedVoice(v.id)}
                className={[
                  "flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-all duration-150",
                  active
                    ? "border-brand-orange/25 bg-brand-orange/5"
                    : "border-border/20 hover:border-border/40 hover:bg-accent/20",
                ].join(" ")}
              >
                <div
                  className={`h-2 w-2 flex-shrink-0 rounded-full ${active ? "bg-brand-orange" : "bg-muted-foreground/20"}`}
                />
                <div>
                  <p
                    className={`text-sm font-medium ${active ? "text-brand-orange" : "text-foreground"}`}
                  >
                    {v.name}
                  </p>
                  <p className="text-muted-foreground/50 text-[10px]">{v.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Temperature */}
      <Section label="Temperatur">
        <div className="space-y-2">
          <div className="text-muted-foreground/50 flex items-center justify-between text-[10px]">
            <span>Presis</span>
            <span className="text-foreground/60 font-mono">
              {voiceTuning.temperature.toFixed(1)}
            </span>
            <span>Kreativ</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={voiceTuning.temperature}
            onChange={(e) => setVoiceTuning({ temperature: Number(e.target.value) })}
            className="h-1.5 w-full accent-[var(--brand-orange)]"
          />
        </div>
      </Section>

      {/* First speaker */}
      <Section label="Hvem snakker først">
        <div className="flex gap-2">
          {(["user", "agent"] as const).map((speaker) => {
            const active = voiceTuning.firstSpeaker === speaker;
            return (
              <button
                key={speaker}
                onClick={() => setVoiceTuning({ firstSpeaker: speaker })}
                className={[
                  "flex-1 rounded-xl border px-3 py-2.5 text-center text-[12px] font-medium transition-all duration-150",
                  active
                    ? "border-brand-orange/25 bg-brand-orange/8 text-brand-orange"
                    : "border-border/20 text-muted-foreground/50 hover:border-border/40 hover:bg-accent/20",
                ].join(" ")}
              >
                {speaker === "user" ? "Bruker" : "Emma"}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Greeting */}
      {voiceTuning.firstSpeaker === "agent" && (
        <Section label="Hilsen">
          <textarea
            value={voiceTuning.greeting}
            onChange={(e) => setVoiceTuning({ greeting: e.target.value })}
            placeholder="Hei! Hva kan jeg hjelpe deg med?"
            rows={2}
            className="border-border/30 bg-card/50 text-foreground placeholder:text-muted-foreground/30 focus:border-brand-orange/30 w-full resize-none rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none"
          />
        </Section>
      )}

      {/* Inactivity */}
      <Section label="Inaktivitet">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-muted-foreground/40 mb-1 block text-[10px]">Timeout</label>
            <input
              value={voiceTuning.inactivityTimeout}
              onChange={(e) => setVoiceTuning({ inactivityTimeout: e.target.value })}
              className="border-border/30 bg-card/50 text-foreground focus:border-brand-orange/30 w-full rounded-lg border px-3 py-2 font-mono text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="text-muted-foreground/40 mb-1 block text-[10px]">Maks varighet</label>
            <input
              value={voiceTuning.maxDuration}
              onChange={(e) => setVoiceTuning({ maxDuration: e.target.value })}
              className="border-border/30 bg-card/50 text-foreground focus:border-brand-orange/30 w-full rounded-lg border px-3 py-2 font-mono text-sm focus:outline-none"
            />
          </div>
        </div>
      </Section>

      <Section label="Meldinger">
        <div className="space-y-2">
          <div>
            <label className="text-muted-foreground/40 mb-1 block text-[10px]">
              Ved inaktivitet
            </label>
            <input
              value={voiceTuning.inactivityMessage}
              onChange={(e) => setVoiceTuning({ inactivityMessage: e.target.value })}
              className="border-border/30 bg-card/50 text-foreground focus:border-brand-orange/30 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="text-muted-foreground/40 mb-1 block text-[10px]">
              Ved tidsgrense
            </label>
            <input
              value={voiceTuning.timeExceededMessage}
              onChange={(e) => setVoiceTuning({ timeExceededMessage: e.target.value })}
              className="border-border/30 bg-card/50 text-foreground focus:border-brand-orange/30 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
            />
          </div>
        </div>
      </Section>
    </>
  );
}

/* ━━━ Prompts Tab ━━━━━━━━━━━━━━━━━━━━━━━━ */

function PromptsTab({
  personaPrompt,
  customPrompt,
  setCustomPrompt,
}: {
  personaPrompt: string;
  customPrompt: string;
  setCustomPrompt: (prompt: string) => void;
}) {
  const [showSystem, setShowSystem] = useState(false);

  return (
    <>
      {/* System prompt (read-only, collapsible) */}
      <Section label="Systemprompt">
        <p className="text-muted-foreground/40 mb-2 text-[10px]">
          Generert automatisk fra persona og autoritet. Les-bare.
        </p>
        <button
          onClick={() => setShowSystem(!showSystem)}
          className="text-brand-orange/70 hover:text-brand-orange mb-2 flex items-center gap-1.5 text-[11px] transition-colors"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 16 16"
            fill="none"
            className={`transition-transform duration-150 ${showSystem ? "rotate-90" : ""}`}
          >
            <path
              d="M6 4L10 8L6 12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {showSystem ? "Skjul" : "Vis"} systemprompt
        </button>
        {showSystem && (
          <div className="border-border/20 bg-accent/20 max-h-[300px] overflow-y-auto rounded-xl border p-3.5">
            <pre className="text-foreground/70 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
              {personaPrompt}
            </pre>
          </div>
        )}
      </Section>

      {/* Custom agent prompt (editable) */}
      <Section label="Egendefinert instruks">
        <p className="text-muted-foreground/40 mb-2 text-[10px]">
          Legg til egne instrukser som blir lagt til etter systemprompt. Endringer påvirker neste
          samtale.
        </p>
        <textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder="F.eks: Svar alltid på norsk. Fokuser på HMS-rutiner. Bruk korte setninger."
          rows={6}
          className="border-border/30 bg-card/50 text-foreground placeholder:text-muted-foreground/25 focus:border-brand-orange/30 w-full resize-none rounded-xl border px-3.5 py-3 font-mono text-sm leading-relaxed focus:outline-none"
        />
        {customPrompt && (
          <div className="mt-2 flex items-center justify-between">
            <p className="text-muted-foreground/40 text-[10px]">{customPrompt.length} tegn</p>
            <button
              onClick={() => setCustomPrompt("")}
              className="text-destructive/60 hover:text-destructive text-[10px] transition-colors"
            >
              Tøm
            </button>
          </div>
        )}
      </Section>

      {/* Preview */}
      <Section label="Forhåndsvisning">
        <p className="text-muted-foreground/40 mb-2 text-[10px]">
          Slik ser hele prompten ut som sendes til agenten.
        </p>
        <div className="border-border/20 bg-accent/10 max-h-[250px] overflow-y-auto rounded-xl border p-3.5">
          <pre className="text-foreground/60 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
            {customPrompt
              ? `${personaPrompt}\n\n## Egendefinert instruks\n${customPrompt}`
              : personaPrompt}
          </pre>
        </div>
      </Section>
    </>
  );
}

/* ━━━ Helpers ━━━ */

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-muted-foreground mb-2 block text-[10px] tracking-wider uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}
