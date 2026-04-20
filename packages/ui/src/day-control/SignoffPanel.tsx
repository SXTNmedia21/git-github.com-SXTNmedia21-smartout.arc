"use client";

import { useState } from "react";
import { Check } from "lucide-react";

export interface SignoffSummary {
  tasksDone: number;
  tasksTotal: number;
  tasksUnfinished: number;
  openDeviations: number;
  openDeviationsLabel?: string;
  lastOutAt?: string;
  lastOutBy?: string;
}

export function SignoffPanel({
  summary,
  onConfirm,
  busy = false,
}: {
  summary: SignoffSummary;
  onConfirm?: (input: { notes: string }) => void;
  busy?: boolean;
}) {
  const [notes, setNotes] = useState("");

  return (
    <section
      className="border-border rounded-[16px] border p-5"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in oklch, var(--warning) 6%, var(--card)) 0%, var(--card) 60%)",
      }}
      aria-labelledby="signoff-title"
    >
      <div className="mb-3 flex items-center gap-2.5">
        <span
          className="grid h-8 w-8 place-items-center rounded-full bg-[color:color-mix(in_oklch,var(--warning)_16%,transparent)]"
          aria-hidden
        >
          <Check className="h-4 w-4 text-[color:var(--warning)]" />
        </span>
        <div>
          <h2 id="signoff-title" className="font-heading text-[22px] tracking-[-0.01em]">
            Avslutt dagen
          </h2>
          <p className="text-muted-foreground text-[12px]">Gjennomgå og send til oppgjør</p>
        </div>
      </div>
      <div className="mb-3.5 grid grid-cols-3 gap-3">
        <Stat
          label="Oppgaver"
          value={`${summary.tasksDone} / ${summary.tasksTotal}`}
          sub={summary.tasksUnfinished > 0 ? `${summary.tasksUnfinished} uferdig` : "alle ferdig"}
          tone={summary.tasksUnfinished > 0 ? "warning" : "muted"}
        />
        <Stat
          label="Åpne avvik"
          value={String(summary.openDeviations)}
          sub={summary.openDeviationsLabel ?? ""}
          tone="muted"
        />
        <Stat
          label="Siste ut"
          value={summary.lastOutAt ?? "—"}
          sub={summary.lastOutBy ?? ""}
          tone="muted"
        />
      </div>
      <label
        htmlFor="signoff-notes"
        className="text-muted-foreground mb-1.5 block text-[11px] font-semibold tracking-[0.08em] uppercase"
      >
        Notat til oppgjør
      </label>
      <textarea
        id="signoff-notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Valgfritt — kommentar til admin om dagen…"
        className="border-border bg-card focus-visible:ring-brand-orange w-full resize-y rounded-[10px] border p-3 text-[13px] outline-none focus-visible:ring-2"
      />
      <button
        type="button"
        onClick={() => onConfirm?.({ notes })}
        disabled={busy}
        className="bg-brand-orange hover:bg-brand-orange/90 mt-3.5 h-12 w-full rounded-[12px] text-[14px] font-bold text-white shadow-[0_2px_12px_color-mix(in_oklch,var(--brand-orange)_28%,transparent)] transition-colors disabled:opacity-50"
      >
        Bekreft og send til oppgjør →
      </button>
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "muted" | "warning";
}) {
  return (
    <div>
      <div className="text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase">
        {label}
      </div>
      <div className="mt-1 font-mono text-[16px] font-bold tabular-nums">{value}</div>
      {sub ? (
        <div
          className={
            tone === "warning"
              ? "mt-0.5 text-[11px] text-[color:var(--warning)]"
              : "text-muted-foreground mt-0.5 text-[11px]"
          }
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
}
