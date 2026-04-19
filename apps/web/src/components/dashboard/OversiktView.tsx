"use client";

import { useCallback, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button, cn } from "@smartout/ui";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CalendarPlus,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Minus,
  PenLine,
  Radio,
  Thermometer,
  UserPlus,
} from "lucide-react";

/* ─────────────────────────────────────────────────
 * Mock data — replace with real hooks in follow-up
 * ───────────────────────────────────────────────── */

type Priority = 1 | 2;
type ActionTag = "kritisk" | "advarsel";
type ActionIcon = "clock" | "alert" | "thermo" | "calendar" | "userplus" | "contract";
type CtaVariant = "primary" | "danger" | "default";

type Action = {
  id: string;
  priority: Priority;
  tag: ActionTag;
  title: string;
  sub: string;
  cta: string;
  ctaVariant: CtaVariant;
  icon: ActionIcon;
  capability: string;
  source: string;
};

const MOCK_ACTIONS: Action[] = [
  {
    id: "a1",
    priority: 1,
    tag: "kritisk",
    title: "Godkjenn timer for Anna Hovland",
    sub: "Uke 15 · 41,5t · forfalt 2 dager",
    cta: "Godkjenn",
    ctaVariant: "primary",
    icon: "clock",
    capability: "shift.approve_hours",
    source: "shift_approval",
  },
  {
    id: "a2",
    priority: 1,
    tag: "kritisk",
    title: "Løs avvik: kasseforskjell −340 kr",
    sub: "Bar · onsdag kveld · blokkerer dag-godkjenning",
    cta: "Løs",
    ctaVariant: "danger",
    icon: "alert",
    capability: "deviation.resolve",
    source: "public.deviation",
  },
  {
    id: "a3",
    priority: 1,
    tag: "kritisk",
    title: "HACCP-brudd: kjøl 3 — 9,2 °C",
    sub: "Over grense i 47 min · korrigering ikke logget",
    cta: "Bekreft",
    ctaVariant: "danger",
    icon: "thermo",
    capability: "haccp.corrective_action",
    source: "haccp_log",
  },
  {
    id: "a4",
    priority: 2,
    tag: "advarsel",
    title: "Bekreft vakt lørdag 20. april",
    sub: "Kjøkken · 16:00–23:00 · 7t · ubekreftet av deg",
    cta: "Bekreft",
    ctaVariant: "default",
    icon: "calendar",
    capability: "shift.confirm_self",
    source: "schedule_shift",
  },
  {
    id: "a5",
    priority: 2,
    tag: "advarsel",
    title: "Søknad fra Marcus Lien — servitør",
    sub: "Referanse: Emma Aas · innkommet i går 14:02",
    cta: "Tildel",
    ctaVariant: "default",
    icon: "userplus",
    capability: "workspace.manage_members",
    source: "invitation",
  },
  {
    id: "a6",
    priority: 2,
    tag: "advarsel",
    title: "Signer kontrakt for Sara Kvist",
    sub: "DocuSeal · venter på din signatur i 3 dager",
    cta: "Åpne",
    ctaVariant: "default",
    icon: "contract",
    capability: "contract.sign",
    source: "employment_contract",
  },
];

type Kpi = {
  key: "bemanning" | "onboarding" | "sertifiseringer" | "hms";
  label: string;
  value: number;
  unit: string;
  trend: "up" | "down" | "flat";
  delta: string;
  deltaCaption: string;
  drill: Array<[string, string]>;
  cta: { label: string; target: string };
};

const MOCK_KPIS: Kpi[] = [
  {
    key: "bemanning",
    label: "Bemanning",
    value: 94,
    unit: "%",
    trend: "up",
    delta: "+3 pp",
    deltaCaption: "vs forrige uke",
    drill: [
      ["Bekreftede vakter", "142 av 151"],
      ["Ubekreftet", "5"],
      ["Åpne (ubemannede)", "4"],
      ["Dekning", "94 %"],
      ["Forrige uke", "91 %"],
      ["Kilde", "schedule_shift"],
    ],
    cta: { label: "Åpne vaktplan", target: "schedule" },
  },
  {
    key: "onboarding",
    label: "Onboarding 30d",
    value: 87,
    unit: "%",
    trend: "down",
    delta: "−2 pp",
    deltaCaption: "vs forrige 30d",
    drill: [
      ["Fullførte protokoller", "26"],
      ["Startet i perioden", "30"],
      ["Fullføringsgrad", "87 %"],
      ["Forrige 30d", "89 %"],
      ["Kilde", "protocol_assignment"],
    ],
    cta: { label: "Åpne onboarding", target: "onboarding" },
  },
  {
    key: "sertifiseringer",
    label: "Sertifiseringer",
    value: 100,
    unit: "%",
    trend: "flat",
    delta: "0",
    deltaCaption: "ingen utløper <30d",
    drill: [
      ["Ansatte med gyldige", "18 av 18"],
      ["Utløper <30 dager", "0"],
      ["Kilde", "protocol_assignment"],
    ],
    cta: { label: "Åpne kompetanseregister", target: "readiness" },
  },
  {
    key: "hms",
    label: "HMS-sjekklister",
    value: 82,
    unit: "%",
    trend: "up",
    delta: "+5 pp",
    deltaCaption: "mål: 90%",
    drill: [
      ["Fullført", "42"],
      ["Utstående", "9"],
      ["Fullføringsgrad", "82 %"],
      ["Mål", "90 %"],
      ["Kilde", "session_task"],
    ],
    cta: { label: "Åpne HMS", target: "hms" },
  },
];

const MOCK_ALERTS: { label: string; matchId: string }[] = [
  { label: "2 vakter ubemannet i morgen", matchId: "a4" },
  { label: "HACCP-brudd kjøl 3", matchId: "a3" },
  { label: "Kasseforskjell blokkerer dag-godkjenning", matchId: "a2" },
];

/* ─────────────────────────────────────────────────
 * Drawer types
 * ───────────────────────────────────────────────── */

type CreatorKey = "nyhet" | "dagsnotat" | "vakt" | "invitasjon";

type DrawerState =
  | { kind: "compose"; which: CreatorKey }
  | { kind: "action"; action: Action }
  | { kind: "kpi"; kpi: Kpi }
  | { kind: "all" }
  | null;

/* ─────────────────────────────────────────────────
 * Main view
 * ───────────────────────────────────────────────── */

export default function OversiktView() {
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const handleResolve = useCallback((action: Action) => {
    setResolvedIds((prev) => new Set(prev).add(action.id));
    toast.success(`${action.cta}: ${action.title}`, {
      action: {
        label: "Angre",
        onClick: () =>
          setResolvedIds((prev) => {
            const next = new Set(prev);
            next.delete(action.id);
            return next;
          }),
      },
      duration: 5000,
    });
  }, []);

  const handleAlertClick = useCallback((matchId: string) => {
    setHighlightedId(matchId);
    const el = document.getElementById(`action-${matchId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    window.setTimeout(() => setHighlightedId(null), 1800);
  }, []);

  const visibleActions = MOCK_ACTIONS.slice(0, 4);
  const totalRemaining = MOCK_ACTIONS.length - resolvedIds.size;

  return (
    <>
      <div className="relative flex h-full min-h-0 flex-col gap-5 overflow-hidden px-10 py-6">
        {/* Ambient orbs — radial-gradient per Nordic Split */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-56 -right-40 h-[680px] w-[680px]"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, oklch(75% 0.18 40 / 0.24) 0%, transparent 62%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-72 -left-48 h-[600px] w-[600px]"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, oklch(78% 0.14 70 / 0.18) 0%, transparent 65%)",
          }}
        />

        <PageHeader onCompose={(which) => setDrawer({ kind: "compose", which })} />

        <AlertSection alerts={MOCK_ALERTS} onClick={handleAlertClick} />

        <div className="relative z-[2] grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
          <ActionQueue
            actions={visibleActions}
            totalRemaining={totalRemaining}
            total={MOCK_ACTIONS.length}
            resolvedIds={resolvedIds}
            highlightedId={highlightedId}
            onResolve={handleResolve}
            onInspect={(action) => setDrawer({ kind: "action", action })}
            onShowAll={() => setDrawer({ kind: "all" })}
          />
          <KpiPanel kpis={MOCK_KPIS} onDrilldown={(kpi) => setDrawer({ kind: "kpi", kpi })} />
        </div>
      </div>

      <Sheet
        open={drawer !== null}
        onOpenChange={(open) => {
          if (!open) setDrawer(null);
        }}
      >
        <SheetContent
          side="right"
          className="flex w-[460px] flex-col overflow-hidden sm:max-w-[460px]"
        >
          {drawer?.kind === "compose" && (
            <ComposeForm which={drawer.which} onDone={() => setDrawer(null)} />
          )}
          {drawer?.kind === "action" && (
            <ActionDetail
              action={drawer.action}
              onResolve={(a) => {
                handleResolve(a);
                setDrawer(null);
              }}
            />
          )}
          {drawer?.kind === "kpi" && (
            <KpiDrilldown kpi={drawer.kpi} onClose={() => setDrawer(null)} />
          )}
          {drawer?.kind === "all" && <AllActionsList onClose={() => setDrawer(null)} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

/* ─────────────────────────────────────────────────
 * Page header (greeting + skaparknapper)
 * ───────────────────────────────────────────────── */

function PageHeader({ onCompose }: { onCompose: (which: CreatorKey) => void }) {
  return (
    <header className="relative z-[2] flex items-baseline justify-between gap-8">
      <div>
        <h1 className="font-heading mb-1.5 text-[38px] leading-none tracking-tight">
          God morgen, <em className="text-brand-orange italic">Pontus</em>
        </h1>
        <div className="text-muted-foreground flex items-center gap-3 text-[12.5px]">
          <span className="text-foreground inline-flex items-center gap-2 font-medium">
            <span className="bg-brand-orange h-[7px] w-[7px] rounded-[2px]" />
            Spåtind Sport Hotell
          </span>
          <span className="bg-muted-foreground/50 h-1 w-1 rounded-full" />
          <span>torsdag 18. april</span>
          <span className="bg-muted-foreground/50 h-1 w-1 rounded-full" />
          <span>sist oppdatert 07:42</span>
        </div>
      </div>
      <div className="flex gap-2">
        <SkaparBtn icon={<Radio />} label="Nyhet" onClick={() => onCompose("nyhet")} />
        <SkaparBtn icon={<FileText />} label="Dagsnotat" onClick={() => onCompose("dagsnotat")} />
        <SkaparBtn icon={<CalendarPlus />} label="Ny vakt" onClick={() => onCompose("vakt")} />
        <SkaparBtn
          primary
          icon={<UserPlus />}
          label="Invitér"
          onClick={() => onCompose("invitasjon")}
        />
      </div>
    </header>
  );
}

function SkaparBtn({
  icon,
  label,
  onClick,
  primary,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "focus-visible:ring-brand-orange inline-flex items-center gap-2 rounded-[10px] border px-3.5 py-2.5 text-[13px] font-medium transition-all hover:-translate-y-px focus-visible:ring-2 focus-visible:outline-none active:translate-y-0",
        primary
          ? "bg-foreground text-background border-foreground hover:bg-foreground/85"
          : "bg-card text-foreground border-border hover:bg-muted hover:border-brand-orange/30",
      )}
    >
      <span className={cn("inline-flex", primary ? "text-background" : "text-brand-orange")}>
        <span className="[&>svg]:h-[15px] [&>svg]:w-[15px]">{icon}</span>
      </span>
      {label}
    </button>
  );
}

/* ─────────────────────────────────────────────────
 * Alert stripe
 * ───────────────────────────────────────────────── */

function AlertSection({
  alerts,
  onClick,
}: {
  alerts: { label: string; matchId: string }[];
  onClick: (matchId: string) => void;
}) {
  return (
    <section className="relative z-[2] flex flex-col gap-2">
      <SectionLabel label="Kritisk nå" meta={`${alerts.length} alerts`} />
      <div
        className="flex items-center gap-3.5 rounded-[14px] border px-4 py-3 backdrop-blur-xl"
        style={{
          background:
            "color-mix(in oklch, var(--destructive, oklch(55% 0.22 25)) 10%, transparent)",
          borderColor:
            "color-mix(in oklch, var(--destructive, oklch(55% 0.22 25)) 20%, transparent)",
          color: "var(--destructive, oklch(55% 0.22 25))",
        }}
      >
        <AlertPulse />
        <span className="text-[13.5px] font-medium tracking-tight">
          {alerts.length} ting krever deg før frokost
        </span>
        <div className="ml-auto flex gap-1.5">
          {alerts.map((a) => (
            <button
              key={a.matchId + a.label}
              type="button"
              onClick={() => onClick(a.matchId)}
              className="focus-visible:ring-brand-orange rounded-full border px-2.5 py-0.5 text-[11.5px] transition-all hover:-translate-y-px focus-visible:ring-2 focus-visible:outline-none"
              style={{
                background:
                  "color-mix(in oklch, var(--destructive, oklch(55% 0.22 25)) 14%, transparent)",
                borderColor:
                  "color-mix(in oklch, var(--destructive, oklch(55% 0.22 25)) 22%, transparent)",
                color: "inherit",
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function AlertPulse() {
  return (
    <span
      className="relative inline-block h-[9px] w-[9px] flex-shrink-0 rounded-full"
      style={{ background: "var(--destructive, oklch(55% 0.22 25))" }}
    >
      <span
        className="absolute -inset-1 animate-ping rounded-full opacity-35"
        style={{ background: "var(--destructive, oklch(55% 0.22 25))" }}
      />
    </span>
  );
}

/* ─────────────────────────────────────────────────
 * Section label (e.g. KREVER DEG / DENNE UKEN)
 * ───────────────────────────────────────────────── */

function SectionLabel({ label, meta }: { label: string; meta?: string }) {
  return (
    <div className="text-muted-foreground flex items-baseline justify-between gap-3 px-1 font-mono text-[10.5px] tracking-[0.14em] uppercase">
      <span>{label}</span>
      {meta ? <span className="opacity-80">{meta}</span> : null}
    </div>
  );
}

/* ─────────────────────────────────────────────────
 * Action queue
 * ───────────────────────────────────────────────── */

function ActionQueue({
  actions,
  resolvedIds,
  highlightedId,
  onResolve,
  onInspect,
  onShowAll,
  totalRemaining,
  total,
}: {
  actions: Action[];
  resolvedIds: Set<string>;
  highlightedId: string | null;
  onResolve: (a: Action) => void;
  onInspect: (a: Action) => void;
  onShowAll: () => void;
  totalRemaining: number;
  total: number;
}) {
  return (
    <section className="flex min-h-0 flex-col gap-2.5">
      <SectionLabel label="Krever deg" meta={`${totalRemaining} totalt · filter priority ≤ 2`} />
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden">
        <div className="scrollbar-thin flex flex-1 flex-col gap-2.5 overflow-y-auto pr-0.5">
          {actions.map((a) => (
            <ActionCard
              key={a.id}
              action={a}
              resolved={resolvedIds.has(a.id)}
              highlighted={highlightedId === a.id}
              onResolve={() => onResolve(a)}
              onInspect={() => onInspect(a)}
            />
          ))}
        </div>
        <div className="flex items-center justify-between px-1 pt-2">
          <button
            type="button"
            onClick={onShowAll}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-[12.5px]"
          >
            Vis alle {total} handlinger
            <ArrowRight className="h-3 w-3" />
          </button>
          <span className="text-muted-foreground font-mono text-[10.5px] tracking-[0.06em]">
            viser {actions.filter((a) => !resolvedIds.has(a.id)).length} av {total}
          </span>
        </div>
      </div>
    </section>
  );
}

function ActionCard({
  action,
  resolved,
  highlighted,
  onResolve,
  onInspect,
}: {
  action: Action;
  resolved: boolean;
  highlighted: boolean;
  onResolve: () => void;
  onInspect: () => void;
}) {
  const priorityBgClass =
    action.priority === 1 ? "bg-destructive/10 text-destructive" : "bg-warning/15 text-warning";
  return (
    <article
      id={`action-${action.id}`}
      onClick={onInspect}
      className={cn(
        "bg-card border-border grid cursor-pointer grid-cols-[28px_1fr_auto] grid-rows-[auto_auto] items-center gap-x-3.5 gap-y-1 rounded-[14px] border px-4 py-3.5 transition-all hover:-translate-y-px",
        "hover:border-brand-orange/30",
        resolved && "opacity-45 [&_[data-name]]:line-through",
        highlighted && "ring-brand-orange/30 border-brand-orange ring-[3px]",
      )}
    >
      <div
        className={cn(
          "row-span-2 inline-flex h-7 w-7 items-center justify-center rounded-lg",
          priorityBgClass,
        )}
      >
        <ActionIcon icon={action.icon} />
      </div>

      <div className="col-start-2 row-start-1 flex min-w-0 items-center gap-2.5 text-[13.5px] font-medium tracking-tight">
        <ActionTag tag={action.tag} />
        <span data-name className="min-w-0 truncate">
          {action.title}
        </span>
      </div>
      <div className="text-muted-foreground col-start-2 row-start-2 truncate text-[12px]">
        {action.sub}
      </div>

      <div className="col-start-3 row-span-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!resolved) onResolve();
          }}
          disabled={resolved}
          className={cn(
            "focus-visible:ring-brand-orange inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-[12.5px] font-medium transition-all hover:-translate-y-px focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed",
            action.ctaVariant === "primary" &&
              "bg-foreground text-background border-foreground hover:bg-foreground/85",
            action.ctaVariant === "danger" &&
              "border-destructive/45 text-destructive hover:bg-destructive/10",
            action.ctaVariant === "default" &&
              "border-border text-foreground hover:bg-muted bg-transparent",
          )}
        >
          {action.cta}
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </article>
  );
}

function ActionIcon({ icon }: { icon: ActionIcon }) {
  const map = {
    clock: Clock,
    alert: AlertTriangle,
    thermo: Thermometer,
    calendar: Calendar,
    userplus: UserPlus,
    contract: PenLine,
  } as const;
  const Ico = map[icon];
  return <Ico className="h-[15px] w-[15px]" />;
}

function ActionTag({ tag }: { tag: ActionTag }) {
  const base =
    "inline-flex flex-shrink-0 items-center rounded-full border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]";
  if (tag === "kritisk") {
    return (
      <span
        className={base}
        style={{
          color: "var(--destructive, oklch(55% 0.22 25))",
          background:
            "color-mix(in oklch, var(--destructive, oklch(55% 0.22 25)) 10%, transparent)",
          borderColor:
            "color-mix(in oklch, var(--destructive, oklch(55% 0.22 25)) 22%, transparent)",
        }}
      >
        kritisk
      </span>
    );
  }
  return (
    <span
      className={base}
      style={{
        color: "oklch(48% 0.18 75)",
        background: "oklch(95% 0.06 78 / 0.6)",
        borderColor: "oklch(72% 0.16 75 / 0.3)",
      }}
    >
      advarsel
    </span>
  );
}

/* ─────────────────────────────────────────────────
 * KPI panel
 * ───────────────────────────────────────────────── */

function KpiPanel({ kpis, onDrilldown }: { kpis: Kpi[]; onDrilldown: (k: Kpi) => void }) {
  return (
    <section className="flex min-h-0 flex-col gap-2.5">
      <SectionLabel label="Denne uken" meta="uke 16" />
      <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-2.5">
        {kpis.map((k) => (
          <KpiCard key={k.key} kpi={k} onClick={() => onDrilldown(k)} />
        ))}
      </div>
    </section>
  );
}

function KpiCard({ kpi, onClick }: { kpi: Kpi; onClick: () => void }) {
  const TrendIcon = kpi.trend === "up" ? ChevronUp : kpi.trend === "down" ? ChevronDown : Minus;
  const trendClasses = {
    up: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    down: "bg-red-500/10 text-red-600 dark:text-red-400",
    flat: "bg-muted text-muted-foreground",
  }[kpi.trend];

  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-card border-border hover:border-brand-orange/35 focus-visible:ring-brand-orange relative flex min-h-0 min-w-0 flex-col gap-2.5 overflow-hidden rounded-[14px] border px-5 py-4.5 text-left transition-all hover:-translate-y-px focus-visible:ring-2 focus-visible:outline-none"
    >
      <span className="text-muted-foreground text-[10.5px] font-medium tracking-[0.1em] uppercase">
        {kpi.label}
      </span>
      <div className="flex items-baseline gap-1 font-mono text-[34px] leading-none font-medium tracking-tight">
        {kpi.value}
        <span className="text-muted-foreground text-sm font-normal">{kpi.unit}</span>
      </div>
      <span className="text-muted-foreground mt-auto inline-flex items-center gap-1.5 text-[11.5px]">
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-mono font-medium",
            trendClasses,
          )}
        >
          <TrendIcon className="h-2.5 w-2.5" strokeWidth={2.5} />
          {kpi.delta}
        </span>
        {kpi.deltaCaption}
      </span>
    </button>
  );
}

/* ─────────────────────────────────────────────────
 * Drawer contents
 * ───────────────────────────────────────────────── */

function ComposeForm({ which, onDone }: { which: CreatorKey; onDone: () => void }) {
  const config = COMPOSE_CONFIG[which];

  function submit() {
    onDone();
    toast.success(`✓ ${config.toastLabel}: ${config.toastMsg}`);
  }

  return (
    <>
      <SheetHeader>
        <span className="text-muted-foreground font-mono text-[10.5px] tracking-[0.12em] uppercase">
          Opprett
        </span>
        <SheetTitle className="font-heading text-[24px] leading-none font-normal tracking-tight">
          {config.title}
        </SheetTitle>
        <SheetDescription className="sr-only">
          Skjema for å opprette {config.toastLabel}
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-4">{config.body}</div>

      <SheetFooter className="flex flex-row justify-end gap-2 border-t px-6 py-3.5">
        <Button variant="outline" onClick={onDone}>
          Avbryt
        </Button>
        <Button onClick={submit}>{config.submitLabel}</Button>
      </SheetFooter>
    </>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-muted-foreground mb-1.5 block text-[11px] font-medium tracking-[0.08em] uppercase">
      {children}
    </span>
  );
}

const COMPOSE_CONFIG: Record<
  CreatorKey,
  {
    title: React.ReactNode;
    submitLabel: string;
    toastLabel: string;
    toastMsg: string;
    body: React.ReactNode;
  }
> = {
  nyhet: {
    title: (
      <>
        Ny <em className="text-brand-orange italic">teamnyhet</em>
      </>
    ),
    submitLabel: "Send nyhet",
    toastLabel: "Nyhet",
    toastMsg: "teamnyhet sendt",
    body: (
      <>
        <label>
          <FieldLabel>Overskrift</FieldLabel>
          <Input placeholder="Kort og tydelig — maks 60 tegn" maxLength={60} autoFocus />
        </label>
        <label>
          <FieldLabel>Melding</FieldLabel>
          <Textarea placeholder="Hva trenger teamet å vite?" rows={4} />
        </label>
        <label>
          <FieldLabel>Mottakere</FieldLabel>
          <Select defaultValue="hele">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hele">Hele Spåtind</SelectItem>
              <SelectItem value="kjokken">Kjøkken</SelectItem>
              <SelectItem value="servitorer">Servitører</SelectItem>
              <SelectItem value="ledergruppen">Ledergruppen</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </>
    ),
  },
  dagsnotat: {
    title: (
      <>
        Nytt <em className="text-brand-orange italic">dagsnotat</em>
      </>
    ),
    submitLabel: "Lagre",
    toastLabel: "Dagsnotat",
    toastMsg: "dagsnotat lagret",
    body: (
      <>
        <label>
          <FieldLabel>Dato</FieldLabel>
          <Input value="torsdag 18. april 2026" readOnly />
        </label>
        <label>
          <FieldLabel>Avdeling</FieldLabel>
          <Select defaultValue="alle">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle</SelectItem>
              <SelectItem value="kjokken">Kjøkken</SelectItem>
              <SelectItem value="bar">Bar</SelectItem>
              <SelectItem value="resepsjon">Resepsjon</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <label>
          <FieldLabel>Notat</FieldLabel>
          <Textarea placeholder="Det som er verdt å huske fra dagen" rows={5} autoFocus />
        </label>
      </>
    ),
  },
  vakt: {
    title: (
      <>
        Ny <em className="text-brand-orange italic">ad-hoc vakt</em>
      </>
    ),
    submitLabel: "Publiser vakt",
    toastLabel: "Vakt",
    toastMsg: "vakt publisert",
    body: (
      <>
        <label>
          <FieldLabel>Dato</FieldLabel>
          <Input type="date" defaultValue="2026-04-19" />
        </label>
        <label>
          <FieldLabel>Tid</FieldLabel>
          <Input placeholder="16:00 – 23:00" autoFocus />
        </label>
        <label>
          <FieldLabel>Rolle</FieldLabel>
          <Select defaultValue="servitor">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="servitor">Servitør</SelectItem>
              <SelectItem value="kokk">Kokk</SelectItem>
              <SelectItem value="runner">Runner</SelectItem>
              <SelectItem value="resepsjon">Resepsjon</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <label>
          <FieldLabel>Avdeling</FieldLabel>
          <Select defaultValue="kjokken">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="kjokken">Kjøkken</SelectItem>
              <SelectItem value="bar">Bar</SelectItem>
              <SelectItem value="resepsjon">Resepsjon</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </>
    ),
  },
  invitasjon: {
    title: (
      <>
        <em className="text-brand-orange italic">Invitér</em> ansatt
      </>
    ),
    submitLabel: "Send invitasjon",
    toastLabel: "Invitasjon",
    toastMsg: "invitasjon sendt",
    body: (
      <>
        <label>
          <FieldLabel>Fornavn</FieldLabel>
          <Input placeholder="Fornavn" autoFocus />
        </label>
        <label>
          <FieldLabel>Etternavn</FieldLabel>
          <Input placeholder="Etternavn" />
        </label>
        <label>
          <FieldLabel>E-post</FieldLabel>
          <Input type="email" placeholder="navn@example.no" />
        </label>
        <label>
          <FieldLabel>Rolle</FieldLabel>
          <Select defaultValue="ansatt">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ansatt">Ansatt</SelectItem>
              <SelectItem value="leder">Leder</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </>
    ),
  },
};

function ActionDetail({ action, onResolve }: { action: Action; onResolve: (a: Action) => void }) {
  return (
    <>
      <SheetHeader>
        <span className="text-muted-foreground font-mono text-[10.5px] tracking-[0.12em] uppercase">
          Handling
        </span>
        <SheetTitle className="font-heading text-[24px] leading-none font-normal tracking-tight">
          {action.title}
        </SheetTitle>
        <SheetDescription className="sr-only">Detaljer om handling</SheetDescription>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto px-6 pb-4">
        <DrillRow label="Kilde" value={action.source} />
        <DrillRow
          label="Prioritet"
          value={action.priority === 1 ? "kritisk (1)" : "advarsel (2)"}
        />
        <DrillRow label="Opprettet" value="i går 16:42" />
        <DrillRow label="Capability" value={action.capability} />
        <DrillRow label="Kan resolves inline" value="ja" />
        <p className="text-muted-foreground mt-4 text-[12.5px]">
          I ekte app ville drawer vist hele konteksten — skift-detaljer, avviksbeskrivelse,
          HACCP-logg, etc. — med full resolve-flow.
        </p>
      </div>
      <SheetFooter className="flex flex-row justify-end gap-2 border-t px-6 py-3.5">
        <Button onClick={() => onResolve(action)}>Fullfør handling</Button>
      </SheetFooter>
    </>
  );
}

function KpiDrilldown({ kpi, onClose }: { kpi: Kpi; onClose: () => void }) {
  return (
    <>
      <SheetHeader>
        <span className="text-muted-foreground font-mono text-[10.5px] tracking-[0.12em] uppercase">
          Nøkkeltall
        </span>
        <SheetTitle className="font-heading text-[24px] leading-none font-normal tracking-tight">
          {kpi.label}
        </SheetTitle>
        <SheetDescription className="sr-only">Drilldown for {kpi.label}</SheetDescription>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto px-6 pb-4">
        {kpi.drill.map(([l, v]) => (
          <DrillRow key={l} label={l} value={v} />
        ))}
        <p className="text-muted-foreground mt-4 text-[12.5px]">
          Klikk CTA for å drilldown til modulens hovedside.
        </p>
      </div>
      <SheetFooter className="flex flex-row justify-end gap-2 border-t px-6 py-3.5">
        <Button variant="outline" onClick={onClose}>
          Lukk
        </Button>
        <Button
          onClick={() => {
            toast.info(`→ Navigerer til ${kpi.cta.target}`);
            onClose();
          }}
        >
          {kpi.cta.label}
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </SheetFooter>
    </>
  );
}

function DrillRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border flex justify-between border-t py-2.5 text-[13px] first:border-t-0">
      <span>{label}</span>
      <span className="text-muted-foreground font-mono">{value}</span>
    </div>
  );
}

function AllActionsList({ onClose }: { onClose: () => void }) {
  const full: Array<{ tag: ActionTag | "info"; title: string; sub: string }> = [
    { tag: "kritisk", title: "Godkjenn timer for Anna Hovland", sub: "Uke 15 · 41,5t" },
    { tag: "kritisk", title: "Løs avvik: kasseforskjell −340 kr", sub: "Bar · onsdag" },
    { tag: "kritisk", title: "HACCP-brudd: kjøl 3 — 9,2 °C", sub: "Over grense 47 min" },
    { tag: "advarsel", title: "Bekreft vakt lørdag 20. april", sub: "Kjøkken · 7t" },
    { tag: "advarsel", title: "Søknad fra Marcus Lien", sub: "Servitør · ref Emma Aas" },
    { tag: "advarsel", title: "Signer kontrakt for Sara Kvist", sub: "DocuSeal · 3 dager" },
    { tag: "info", title: "Tildel protokoll: Allergener til Sara K.", sub: "onboarding" },
    { tag: "info", title: "Følg opp: Morten har stoppet på modul 3", sub: "trainee · 9 dager" },
    { tag: "info", title: "Godkjenn fridag for Jonas B.", sub: "22. april" },
    { tag: "info", title: "Gjennomgå avviksrapport februar", sub: "HMS · månedlig" },
    { tag: "info", title: "Oppdater operasjonstider påske", sub: "D1 Envelope" },
    { tag: "info", title: "Bekreft nytt tariffkart", sub: "K1a · Riksavtalen 2026" },
  ];
  return (
    <>
      <SheetHeader>
        <span className="text-muted-foreground font-mono text-[10.5px] tracking-[0.12em] uppercase">
          Inbox
        </span>
        <SheetTitle className="font-heading text-[24px] leading-none font-normal tracking-tight">
          Alle handlinger <em className="text-brand-orange italic">({full.length})</em>
        </SheetTitle>
        <SheetDescription className="sr-only">Full liste over alle handlinger</SheetDescription>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto px-6 pb-4">
        {full.map((r, i) => (
          <div
            key={i}
            className="border-border flex items-start gap-3 border-t py-3 first:border-t-0"
          >
            {r.tag === "info" ? (
              <span className="bg-muted text-muted-foreground border-border inline-flex flex-shrink-0 items-center rounded-full border px-1.5 py-0.5 font-mono text-[10px] tracking-[0.08em] uppercase">
                info
              </span>
            ) : (
              <ActionTag tag={r.tag} />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-medium">{r.title}</div>
              <div className="text-muted-foreground mt-0.5 text-[12px]">{r.sub}</div>
            </div>
          </div>
        ))}
      </div>
      <SheetFooter className="flex flex-row justify-end gap-2 border-t px-6 py-3.5">
        <Button variant="outline" onClick={onClose}>
          Lukk
        </Button>
      </SheetFooter>
    </>
  );
}
