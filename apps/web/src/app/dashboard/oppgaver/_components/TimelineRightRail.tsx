"use client";

/**
 * TimelineRightRail — the Manager Timeline right rail (380px).
 *
 * Binding Cloud Design: docs/domains/day-session/day-planner/project/Manager Timeline.html
 * (`.rail*` CSS + timeline-app.jsx RightRail/NowSnapshot/KpiBox) + scraps/v6.png.
 *
 * Tabs: Akkurat nå / Detalj / Melding / Avvik.
 * "Akkurat nå" (NowSnapshot): STATUS (4 KPI cards) + Krever oppmerksomhet +
 * Pågående + Neste.
 *
 * ⚠️ Pontus law: every KPI count is DERIVED from source rows (.length / .filter) —
 * NEVER stored or incremented. The rail holds no counter state.
 *
 * Tokens: Nordic Split CSS variables / shadcn token classes only (ADR-0366 — no
 * OKLCH literals, no hex). a11y (L-NEW-3): role="tablist"/"tab" + aria-selected,
 * focus-visible rings, motion-reduce-safe (no animation here).
 */

import { useState } from "react";
import { Clock, CheckCircle2, Mic, AlertCircle, Check } from "lucide-react";
import type { TimelineTask } from "../_chart/TaskBlock";
import type { Employee } from "../_chart/PersonLane";
import { hmToMin } from "../_chart/timeMath";

type RailTab = "now" | "detail" | "broadcast" | "avvik";

type Props = {
  tasks: TimelineTask[];
  employees: Employee[];
  /** Wall-clock minutes since midnight (drives on-shift + active derivation). */
  nowMinutes: number;
  /** Currently selected task (Detalj tab); null disables that tab. */
  selectedTask: TimelineTask | null;
  /** Resolve an area id → display label (band name). */
  areaLabel: (areaId: string | null | undefined) => string;
  /** Optional: confirm a deviation (Bekreft). No-op when not provided (V1). */
  onConfirmDeviation?: (taskId: string) => void;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** Small avatar bubble — token-driven, no literal colors. */
function Avatar({ name }: { name: string }) {
  return (
    <span
      className="bg-muted text-muted-foreground inline-flex h-5 w-5 items-center justify-center rounded-full font-mono text-[0.625rem] font-semibold"
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

/** KPI card. value is supplied already-derived by the caller (never a counter). */
function KpiBox({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: number;
  unit?: string;
  tone?: "warn" | "ok";
}) {
  const valueColor =
    tone === "warn" ? "text-destructive" : tone === "ok" ? "text-success" : "text-foreground";
  return (
    <div className="bg-card border-border rounded-xl border p-3">
      <div className="text-muted-foreground text-[0.625rem] font-semibold tracking-[0.14em] uppercase">
        {label}
      </div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className={`font-mono text-[1.625rem] leading-none font-black ${valueColor}`}>
          {value}
        </span>
        {unit ? (
          <span className="text-muted-foreground font-mono text-[0.6875rem]">{unit}</span>
        ) : null}
      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-muted-foreground m-0 mb-2.5 text-[0.625rem] font-semibold tracking-[0.16em] uppercase">
      {children}
    </h4>
  );
}

/** Rail card with a left accent bar. accent is a token class on the bar. */
function RailCard({
  title,
  meta,
  accent,
  children,
}: {
  title: string;
  meta?: string;
  accent: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-card border-border relative mb-2 rounded-[14px] border p-3.5">
      <span className={`absolute top-3.5 bottom-3.5 left-0 w-[3px] rounded-full ${accent}`} />
      <div className="text-foreground mb-1 text-[0.8125rem] font-semibold tracking-[-0.005em]">
        {title}
      </div>
      {meta ? <div className="text-muted-foreground font-mono text-[0.6875rem]">{meta}</div> : null}
      {children}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  sub,
}: {
  icon: typeof Clock;
  title: string;
  sub: string;
}) {
  return (
    <div className="text-muted-foreground px-4 py-10 text-center">
      <span className="bg-muted mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="text-foreground font-heading text-lg tracking-[-0.01em]">{title}</div>
      <div className="mt-1 text-xs">{sub}</div>
    </div>
  );
}

function NowSnapshot({
  tasks,
  employees,
  nowMinutes,
  areaLabel,
  onConfirmDeviation,
}: Omit<Props, "selectedTask">) {
  // ── All counts DERIVED from source rows (Pontus law: never increment). ──
  const onShift = employees.filter((e) => {
    if (!e.shift) return false;
    const start = hmToMin(e.shift[0]);
    const end = hmToMin(e.shift[1]);
    return start <= nowMinutes && nowMinutes <= end;
  });
  const activeNow = tasks.filter((t) => t.status === "in_progress");
  const openDevs = tasks.filter((t) => t.status === "missed");
  const upcoming = tasks
    .filter((t) => t.status === "upcoming")
    .sort((a, b) => hmToMin(a.start) - hmToMin(b.start));

  const empById = new Map(employees.map((e) => [e.id, e]));

  return (
    <>
      {/* STATUS — 4 derived KPI cards */}
      <section className="mb-6" aria-label="Status">
        <SectionHeading>Status</SectionHeading>
        <div className="grid grid-cols-2 gap-2">
          <KpiBox label="På vakt" value={onShift.length} unit="pers" />
          <KpiBox label="Aktive oppgaver" value={activeNow.length} unit="nå" />
          <KpiBox
            label="Avvik åpne"
            value={openDevs.length}
            tone={openDevs.length > 0 ? "warn" : "ok"}
          />
          <KpiBox label="Tasks gjenstår" value={upcoming.length} />
        </div>
      </section>

      {openDevs.length > 0 && (
        <section className="mb-6" aria-label="Krever oppmerksomhet">
          <SectionHeading>Krever oppmerksomhet</SectionHeading>
          {openDevs.map((d) => (
            <RailCard
              key={d.id}
              title={d.title}
              meta={`${d.start} · ${areaLabel(d.area)}`}
              accent="bg-destructive"
            >
              <div className="mt-1.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onConfirmDeviation?.(d.id)}
                  className="border-border hover:bg-muted focus-visible:ring-ring inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium focus-visible:ring-2 focus-visible:outline-none"
                >
                  <Check className="h-3 w-3" aria-hidden="true" /> Bekreft
                </button>
                <button
                  type="button"
                  className="border-border hover:bg-muted focus-visible:ring-ring inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium focus-visible:ring-2 focus-visible:outline-none"
                >
                  Eskaler
                </button>
              </div>
            </RailCard>
          ))}
        </section>
      )}

      <section className="mb-6" aria-label="Pågående">
        <SectionHeading>Pågående</SectionHeading>
        {activeNow.length === 0 ? (
          <div className="text-muted-foreground text-xs">Ingenting i aktiv status.</div>
        ) : (
          activeNow.map((t) => {
            const emp = t.emp ? empById.get(t.emp) : undefined;
            return (
              <RailCard
                key={t.id}
                title={t.title}
                meta={`${t.start}–${t.end} · ${areaLabel(t.area)}`}
                accent="bg-brand-orange"
              >
                {emp ? (
                  <div className="text-muted-foreground mt-1.5 flex items-center gap-2 text-xs">
                    <Avatar name={emp.name} /> <span>{emp.name}</span>
                  </div>
                ) : null}
              </RailCard>
            );
          })
        )}
      </section>

      <section className="mb-6" aria-label="Neste">
        <SectionHeading>Neste</SectionHeading>
        {upcoming.slice(0, 4).map((t) => {
          const emp = t.emp ? empById.get(t.emp) : undefined;
          return (
            <RailCard
              key={t.id}
              title={t.title}
              meta={`${t.start} · ${areaLabel(t.area)}`}
              accent="bg-brand-orange"
            >
              <div className="text-muted-foreground mt-1.5 flex items-center gap-2 text-xs">
                {emp ? (
                  <>
                    <Avatar name={emp.name} /> <span>{emp.name}</span>
                  </>
                ) : (
                  <span>Ledig</span>
                )}
              </div>
            </RailCard>
          );
        })}
        {upcoming.length === 0 ? (
          <div className="text-muted-foreground text-xs">Ingen kommende oppgaver.</div>
        ) : null}
      </section>
    </>
  );
}

export function TimelineRightRail({
  tasks,
  employees,
  nowMinutes,
  selectedTask,
  areaLabel,
  onConfirmDeviation,
}: Props) {
  const [tab, setTab] = useState<RailTab>("now");

  const tabs: Array<{ id: RailTab; label: string; icon: typeof Clock; disabled?: boolean }> = [
    { id: "now", label: "Akkurat nå", icon: Clock },
    { id: "detail", label: "Detalj", icon: CheckCircle2, disabled: !selectedTask },
    { id: "broadcast", label: "Melding", icon: Mic },
    { id: "avvik", label: "Avvik", icon: AlertCircle },
  ];

  return (
    <aside
      className="border-border bg-sidebar flex min-h-0 flex-col overflow-hidden border-l"
      aria-label="Timeline detaljpanel"
    >
      <div
        role="tablist"
        aria-label="Detaljpanel-faner"
        className="border-border flex gap-1 border-b px-4 pt-3"
      >
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={t.disabled}
              onClick={() => !t.disabled && setTab(t.id)}
              className={`focus-visible:ring-ring inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40 ${
                active
                  ? "border-brand-orange text-foreground"
                  : "text-muted-foreground border-transparent"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" aria-hidden="true" /> {t.label}
            </button>
          );
        })}
      </div>
      <div className="flex-1 overflow-auto p-4" role="tabpanel">
        {tab === "now" && (
          <NowSnapshot
            tasks={tasks}
            employees={employees}
            nowMinutes={nowMinutes}
            areaLabel={areaLabel}
            onConfirmDeviation={onConfirmDeviation}
          />
        )}
        {tab === "detail" &&
          (selectedTask ? (
            <RailCard
              title={selectedTask.title}
              meta={`${selectedTask.start}–${selectedTask.end} · ${areaLabel(selectedTask.area)}`}
              accent="bg-brand-orange"
            />
          ) : (
            <EmptyState
              icon={CheckCircle2}
              title="Ingen oppgave valgt"
              sub="Klikk en oppgave i tidslinjen for å se detaljer."
            />
          ))}
        {tab === "broadcast" && (
          <EmptyState
            icon={Mic}
            title="Melding"
            sub="Kringkasting til vakt-laget kommer i en oppfølging."
          />
        )}
        {tab === "avvik" && (
          <EmptyState
            icon={AlertCircle}
            title="Avvik"
            sub="Åpne avvik vises under «Krever oppmerksomhet» i Akkurat nå."
          />
        )}
      </div>
    </aside>
  );
}
