"use client";

import { useWalkAi } from "./WalkAiProvider";
import type { AgentPersona, AgentRank, OrbStatus, PersonaRankBlend } from "./types";
import { LISA_PERSONALITIES, DEFAULT_VOICE_TUNING, VOICE_OPTIONS } from "./types";
import { PERSONAS, RANKS } from "./persona-engine";

const ORB_STATUSES: OrbStatus[] = ["idle", "listening", "thinking", "speaking", "notification"];
const PERSONA_KEYS: AgentPersona[] = ["saga", "puls", "gnist", "vakt"];
const RANK_KEYS: AgentRank[] = ["admin", "manager", "employee", "trainee"];

export function PlaygroundControls() {
  const {
    state,
    identity,
    identityDisplay,
    voiceTuning,
    agent,
    expand,
    collapse,
    goImmersive,
    switchView,
    pushView: _pushView,
    popView: _popView,
    setOrbStatus,
    selectedVoice,
    setSelectedVoice,
    setIdentity,
    setVoiceTuning,
    activeView,
  } = useWalkAi();

  return (
    <div className="space-y-4">
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  1. LISA — Session + Personligheter      */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-foreground text-sm font-medium">
              {VOICE_OPTIONS.find((v) => v.id === selectedVoice)?.name ?? "Agent"}
            </h2>
            <p className="text-muted-foreground text-[10px]">
              {VOICE_OPTIONS.find((v) => v.id === selectedVoice)?.description ?? "AI-stemme"}
            </p>
          </div>
          <div className="flex gap-2">
            {!agent.isConnected ? (
              <Btn onClick={() => void agent.startSession()} accent>
                Start samtale
              </Btn>
            ) : (
              <>
                <Btn onClick={agent.endSession}>Avslutt</Btn>
                <Btn onClick={agent.toggleMic} active={!agent.isMuted}>
                  {agent.isMuted ? "Slå på mikrofon" : "Demp"}
                </Btn>
              </>
            )}
          </div>
        </div>

        <p className="text-muted-foreground mb-2 text-[10px] tracking-wider uppercase">
          Status:{" "}
          <span className="text-foreground font-mono">
            {agent.status}
            {agent.isConnected ? " (tilkoblet)" : ""}
          </span>
        </p>

        <Label>Stemme</Label>
        <select
          value={selectedVoice}
          onChange={(e) => setSelectedVoice(e.target.value)}
          className="border-border bg-background text-foreground mb-4 w-full rounded-lg border px-3 py-1.5 text-xs"
        >
          {VOICE_OPTIONS.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} — {v.description}
            </option>
          ))}
        </select>

        <Label>Personlighet</Label>
        <div className="flex flex-wrap gap-2">
          {LISA_PERSONALITIES.map((p) => (
            <button
              key={p.name}
              onClick={() => {
                setIdentity(p.identity);
                setVoiceTuning({ ...DEFAULT_VOICE_TUNING, ...p.tuning });
              }}
              className="border-border bg-background hover:bg-accent hover:border-brand-orange/30 rounded-lg border px-3 py-2 text-left transition-colors duration-150"
            >
              <span className="text-foreground block text-xs font-medium">{p.name}</span>
              <span className="text-muted-foreground text-[10px]">{p.description}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  2. IDENTITET — Persona × Rank × Blend   */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <Card>
        <SectionHeader title="Identitet" subtitle={identityDisplay} />

        <Label>Persona</Label>
        <div className="mb-3 flex gap-2">
          {PERSONA_KEYS.map((p) => (
            <Btn
              key={p}
              onClick={() => setIdentity({ persona: p })}
              active={identity.persona === p}
            >
              {PERSONAS[p].name}
            </Btn>
          ))}
        </div>

        <Label>Rank</Label>
        <div className="mb-3 flex gap-2">
          {RANK_KEYS.map((r) => (
            <Btn key={r} onClick={() => setIdentity({ rank: r })} active={identity.rank === r}>
              {RANKS[r].name}
            </Btn>
          ))}
        </div>

        <Label>
          Blend: {identity.blend} (
          {identity.blend <= 3 ? "persona-ledet" : identity.blend >= 7 ? "rank-ledet" : "balansert"}
          )
        </Label>
        <Slider
          min={0}
          max={10}
          value={identity.blend}
          onChange={(v) => setIdentity({ blend: v as PersonaRankBlend })}
          left="Persona"
          right="Rank"
        />
      </Card>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  3. STEMME — Voice tuning                */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <Card>
        <SectionHeader title="Stemmeinnstillinger" />

        <Label>Temperatur: {voiceTuning.temperature.toFixed(1)}</Label>
        <Slider
          min={0}
          max={10}
          value={Math.round(voiceTuning.temperature * 10)}
          onChange={(v) => setVoiceTuning({ temperature: v / 10 })}
          left="Presis"
          right="Kreativ"
        />

        <Label>Hvem snakker først</Label>
        <div className="mb-3 flex gap-2">
          <Btn
            onClick={() => setVoiceTuning({ firstSpeaker: "user" })}
            active={voiceTuning.firstSpeaker === "user"}
          >
            Bruker
          </Btn>
          <Btn
            onClick={() => setVoiceTuning({ firstSpeaker: "agent" })}
            active={voiceTuning.firstSpeaker === "agent"}
          >
            Emma
          </Btn>
        </div>

        {voiceTuning.firstSpeaker === "agent" && (
          <>
            <Label>Hilsen</Label>
            <input
              type="text"
              value={voiceTuning.greeting}
              onChange={(e) => setVoiceTuning({ greeting: e.target.value })}
              placeholder="Hei! Hva kan jeg hjelpe med?"
              className="border-border bg-background text-foreground placeholder:text-muted-foreground mb-3 w-full rounded-lg border px-3 py-1.5 text-xs"
            />
          </>
        )}

        <Label>Maks varighet</Label>
        <div className="mb-3 flex gap-2">
          {(
            [
              ["300s", "5m"],
              ["900s", "15m"],
              ["1800s", "30m"],
              ["3600s", "60m"],
            ] as [string, string][]
          ).map(([val, label]) => (
            <Btn
              key={val}
              onClick={() => setVoiceTuning({ maxDuration: val })}
              active={voiceTuning.maxDuration === val}
            >
              {label}
            </Btn>
          ))}
        </div>

        <Label>Inaktivitet</Label>
        <div className="mb-3 flex gap-2">
          {["10s", "15s", "30s", "60s"].map((t) => (
            <Btn
              key={t}
              onClick={() => setVoiceTuning({ inactivityTimeout: t })}
              active={voiceTuning.inactivityTimeout === t}
            >
              {t}
            </Btn>
          ))}
        </div>

        <Label>Inaktivitetsmelding</Label>
        <input
          type="text"
          value={voiceTuning.inactivityMessage}
          onChange={(e) => setVoiceTuning({ inactivityMessage: e.target.value })}
          className="border-border bg-background text-foreground mb-3 w-full rounded-lg border px-3 py-1.5 text-xs"
        />

        <Label>Tidsoverskridelsesmelding</Label>
        <input
          type="text"
          value={voiceTuning.timeExceededMessage}
          onChange={(e) => setVoiceTuning({ timeExceededMessage: e.target.value })}
          className="border-border bg-background text-foreground w-full rounded-lg border px-3 py-1.5 text-xs"
        />
      </Card>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  4. YTA — Density + Orb + Stack (dev)    */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <Card>
        <SectionHeader title="Visning" subtitle={state.density} />

        <div className="mb-3 flex gap-2">
          <Btn onClick={collapse} active={state.density === "orb"}>
            Orb
          </Btn>
          <Btn onClick={expand} active={state.density === "arena"}>
            Arena
          </Btn>
          <Btn onClick={goImmersive} active={state.density === "immersive"}>
            Immersiv
          </Btn>
        </div>
        {state.density === "arena" && (
          <p className="text-muted-foreground mb-3 font-mono text-[10px]">
            {state.arenaSize.width} × {state.arenaSize.height}
          </p>
        )}

        <Label>Orb-status: {state.orbStatus}</Label>
        <div className="mb-3 flex flex-wrap gap-2">
          {ORB_STATUSES.map((s) => (
            <Btn key={s} onClick={() => setOrbStatus(s)} active={state.orbStatus === s}>
              {s}
            </Btn>
          ))}
        </div>

        <Label>Aktiv vy: {activeView}</Label>
        <div className="mb-3 flex flex-wrap gap-2">
          <Btn onClick={() => switchView("visualizer")} active={activeView === "visualizer"}>
            Voice
          </Btn>
          <Btn onClick={() => switchView("chat")} active={activeView === "chat"}>
            Chat
          </Btn>
          <Btn onClick={() => switchView("notepad")} active={activeView === "notepad"}>
            Notepad
          </Btn>
          <Btn onClick={() => switchView("calculator")} active={activeView === "calculator"}>
            Kalkulator
          </Btn>
        </div>
        <p className="text-muted-foreground text-[10px]">
          Emma kan morfe mellom disse med verktøy: show_visualizer, show_notepad, show_calculator,
          show_chat
        </p>
      </Card>

      {/* ━━━ Debug footer ━━━ */}
      <p className="text-muted-foreground px-1 font-mono text-xs">
        transcript: {agent.transcript.length} msgs | pos: ({Math.round(state.position.x)},{" "}
        {Math.round(state.position.y)})
      </p>
    </div>
  );
}

/* ━━━ Shared UI ━━━ */

function Card({ children }: { children: React.ReactNode }) {
  return <div className="border-border bg-card space-y-1 rounded-xl border p-5">{children}</div>;
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <p className="text-foreground mb-3 text-sm font-medium">
      {title}
      {subtitle ? ": " : ""}
      <span className="text-muted-foreground font-mono text-xs">{subtitle}</span>
    </p>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground mb-1 text-[10px] tracking-wider uppercase">{children}</p>
  );
}

function Slider({
  min,
  max,
  value,
  onChange,
  left,
  right,
}: {
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  left?: string;
  right?: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-3">
      {left && <span className="text-muted-foreground text-[10px]">{left}</span>}
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-brand-orange h-1.5 flex-1"
      />
      {right && <span className="text-muted-foreground text-[10px]">{right}</span>}
    </div>
  );
}

function Btn({
  children,
  onClick,
  active = false,
  disabled = false,
  accent = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors duration-150",
        accent
          ? "border-brand-orange bg-brand-orange/20 text-foreground hover:bg-brand-orange/30"
          : active
            ? "border-brand-orange/40 bg-brand-orange/10 text-foreground"
            : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
        disabled && "cursor-not-allowed opacity-40",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </button>
  );
}
