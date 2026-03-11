"use client";

import { useWalkAi } from "./WalkAiProvider";
import { PERSONAS, RANKS } from "./persona-engine";
import { VOICE_OPTIONS } from "./types";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  Emma — Profile Card                       */
/*                                             */
/*  Who she is. How she sounds. What she sees. */
/*  A character sheet, not a settings panel.   */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function EmmaProfile() {
  const { identity, identityDisplay, voiceTuning, selectedVoice, agent } = useWalkAi();

  const persona = PERSONAS[identity.persona];
  const rank = RANKS[identity.rank];
  const voice = VOICE_OPTIONS.find((v) => v.id === selectedVoice);
  const blendLabel =
    identity.blend <= 3
      ? "Personlighet leder"
      : identity.blend >= 7
        ? "Autoritet leder"
        : "Balansert";

  return (
    <div className="space-y-6">
      {/* ━━━ Header — who she is ━━━ */}
      <div className="flex items-start gap-4">
        {/* Avatar orb */}
        <div className="relative flex-shrink-0">
          <div className="h-14 w-14 rounded-full bg-gradient-to-br from-brand-orange/20 to-brand-orange/5 flex items-center justify-center">
            <div className="h-6 w-6 rounded-full bg-brand-orange/30 flex items-center justify-center">
              <div className="h-2 w-2 rounded-full bg-brand-orange" />
            </div>
          </div>
          {agent.isConnected && (
            <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-emerald-500" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-foreground">Emma</h2>
          <p className="text-xs text-muted-foreground">
            {voice?.description ?? "AI-stemme"} · {voice?.name ?? "Ukjent stemme"}
          </p>
          <p className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">
            {identityDisplay}
          </p>
        </div>
      </div>

      {/* ━━━ Personality blend — visual ━━━ */}
      <div className="rounded-xl border border-border/40 bg-card/50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Personlighet</span>
          <span className="text-[10px] text-muted-foreground/60">{blendLabel}</span>
        </div>

        {/* Persona */}
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-orange/10 text-brand-orange">
            <span className="text-xs font-bold">{persona.name[0]}</span>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{persona.name}</p>
            <p className="text-[11px] text-muted-foreground">{persona.traits}</p>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">
              Vinkel: <span className="font-medium text-muted-foreground">{persona.angle}</span> · Stemme: {persona.voice}
            </p>
          </div>
        </div>

        {/* Blend bar */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-muted-foreground w-14 text-right">Persona</span>
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-brand-orange/60 transition-all duration-300"
              style={{ width: `${((10 - identity.blend) / 10) * 100}%` }}
            />
          </div>
          <span className="text-[9px] text-muted-foreground w-14">Autoritet</span>
        </div>

        {/* Rank */}
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-accent text-muted-foreground">
            <span className="text-xs font-bold">{rank.name[0]}</span>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{rank.name}</p>
            <p className="text-[11px] text-muted-foreground">{rank.authority}</p>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">
              Tone: {rank.tone}
            </p>
          </div>
        </div>
      </div>

      {/* ━━━ Voice tuning summary ━━━ */}
      <div className="rounded-xl border border-border/40 bg-card/50 p-4">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-2">Stemmeinnstillinger</span>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
          <Row label="Temperatur" value={voiceTuning.temperature.toFixed(1)} />
          <Row label="Første taler" value={voiceTuning.firstSpeaker === "agent" ? "Emma" : "Bruker"} />
          <Row label="Maks varighet" value={formatDuration(voiceTuning.maxDuration)} />
          <Row label="Inaktivitet" value={voiceTuning.inactivityTimeout} />
          {voiceTuning.firstSpeaker === "agent" && voiceTuning.greeting && (
            <div className="col-span-2 mt-1">
              <span className="text-muted-foreground/60">Hilsen:</span>{" "}
              <span className="text-foreground/70 italic">&ldquo;{voiceTuning.greeting}&rdquo;</span>
            </div>
          )}
        </div>
      </div>

      {/* ━━━ Capabilities ━━━ */}
      <div className="rounded-xl border border-border/40 bg-card/50 p-4">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-2">Verktøy</span>
        <div className="flex flex-wrap gap-1.5">
          {["Notepad", "Kalkulator", "Chat", "Visualizer"].map((tool) => (
            <span
              key={tool}
              className="rounded-md bg-accent/60 px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              {tool}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ━━━ Helpers ━━━ */

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-muted-foreground/60">{label}</span>
      <span className="text-foreground/70 font-mono text-[10px]">{value}</span>
    </>
  );
}

function formatDuration(s: string): string {
  const seconds = parseInt(s, 10);
  if (isNaN(seconds)) return s;
  if (seconds >= 3600) return `${seconds / 3600}t`;
  if (seconds >= 60) return `${seconds / 60}m`;
  return `${seconds}s`;
}
