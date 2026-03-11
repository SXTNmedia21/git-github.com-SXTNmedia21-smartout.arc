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
          <div className="from-brand-orange/20 to-brand-orange/5 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br">
            <div className="bg-brand-orange/30 flex h-6 w-6 items-center justify-center rounded-full">
              <div className="bg-brand-orange h-2 w-2 rounded-full" />
            </div>
          </div>
          {agent.isConnected && (
            <div className="border-card absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 bg-emerald-500" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="text-foreground text-lg font-semibold">Emma</h2>
          <p className="text-muted-foreground text-xs">
            {voice?.description ?? "AI-stemme"} · {voice?.name ?? "Ukjent stemme"}
          </p>
          <p className="text-muted-foreground/60 mt-0.5 font-mono text-[10px]">{identityDisplay}</p>
        </div>
      </div>

      {/* ━━━ Personality blend — visual ━━━ */}
      <div className="border-border/40 bg-card/50 space-y-3 rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[10px] tracking-wider uppercase">
            Personlighet
          </span>
          <span className="text-muted-foreground/60 text-[10px]">{blendLabel}</span>
        </div>

        {/* Persona */}
        <div className="flex items-start gap-3">
          <div className="bg-brand-orange/10 text-brand-orange flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg">
            <span className="text-xs font-bold">{persona.name[0]}</span>
          </div>
          <div>
            <p className="text-foreground text-sm font-medium">{persona.name}</p>
            <p className="text-muted-foreground text-[11px]">{persona.traits}</p>
            <p className="text-muted-foreground/50 mt-0.5 text-[10px]">
              Vinkel: <span className="text-muted-foreground font-medium">{persona.angle}</span> ·
              Stemme: {persona.voice}
            </p>
          </div>
        </div>

        {/* Blend bar */}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-14 text-right text-[9px]">Persona</span>
          <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
            <div
              className="bg-brand-orange/60 h-full rounded-full transition-all duration-300"
              style={{ width: `${((10 - identity.blend) / 10) * 100}%` }}
            />
          </div>
          <span className="text-muted-foreground w-14 text-[9px]">Autoritet</span>
        </div>

        {/* Rank */}
        <div className="flex items-start gap-3">
          <div className="bg-accent text-muted-foreground flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg">
            <span className="text-xs font-bold">{rank.name[0]}</span>
          </div>
          <div>
            <p className="text-foreground text-sm font-medium">{rank.name}</p>
            <p className="text-muted-foreground text-[11px]">{rank.authority}</p>
            <p className="text-muted-foreground/50 mt-0.5 text-[10px]">Tone: {rank.tone}</p>
          </div>
        </div>
      </div>

      {/* ━━━ Voice tuning summary ━━━ */}
      <div className="border-border/40 bg-card/50 rounded-xl border p-4">
        <span className="text-muted-foreground mb-2 block text-[10px] tracking-wider uppercase">
          Stemmeinnstillinger
        </span>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
          <Row label="Temperatur" value={voiceTuning.temperature.toFixed(1)} />
          <Row
            label="Første taler"
            value={voiceTuning.firstSpeaker === "agent" ? "Emma" : "Bruker"}
          />
          <Row label="Maks varighet" value={formatDuration(voiceTuning.maxDuration)} />
          <Row label="Inaktivitet" value={voiceTuning.inactivityTimeout} />
          {voiceTuning.firstSpeaker === "agent" && voiceTuning.greeting && (
            <div className="col-span-2 mt-1">
              <span className="text-muted-foreground/60">Hilsen:</span>{" "}
              <span className="text-foreground/70 italic">
                &ldquo;{voiceTuning.greeting}&rdquo;
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ━━━ Capabilities ━━━ */}
      <div className="border-border/40 bg-card/50 rounded-xl border p-4">
        <span className="text-muted-foreground mb-2 block text-[10px] tracking-wider uppercase">
          Verktøy
        </span>
        <div className="flex flex-wrap gap-1.5">
          {["Notepad", "Kalkulator", "Chat", "Visualizer"].map((tool) => (
            <span
              key={tool}
              className="bg-accent/60 text-muted-foreground rounded-md px-2 py-0.5 text-[10px]"
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
