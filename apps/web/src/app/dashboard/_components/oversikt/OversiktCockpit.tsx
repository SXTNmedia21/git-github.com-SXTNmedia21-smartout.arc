"use client";

// ===== Oversikt — Today Dashboard / Daily Control Center =====
// Verbatim copy of oversikt.jsx.
// Changes from source (only 4 allowed plumbing changes):
//   1. IIFE + window.SO_PAGES → "use client" + export default function
//   2. const{useState}=React → import from react
//   3. window.Ic → local Ic shim below (same n=".." prop shape, lucide-react icons)
//   4. window.useToast() → sonner toast; toast(msg, {undo}) → toast(msg, {action:{label:"Angre",onClick}})
//   5. Props injected via OversiktCockpitProps instead of setRoute from window
//   6. Telemetry emit() calls added at each mutation/navigation call-site (per PLAN.md Phase 1+2)
//      — each emit is awaited inside void Promise chains; fire-and-forget with .catch(noop)
//   DEPT constant remains verbatim; window.CreateButton is null (not injected from shell)
//   Output line count: ≈ source (295 lines JSX + shim + telemetry calls ≈ 340 lines total)

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Check,
  CheckSquare,
  ChevronUp,
  Clock,
  Eye,
  FileCheck,
  Hash,
  List,
  LayoutGrid,
  ThumbsUp,
  Thermometer,
  TrendingUp,
  Users,
  User,
  Wallet,
} from "lucide-react";
import { emit, nonEmpty } from "@smartout/telemetry";
import { department } from "@smartout/design-tokens";
import "./oversikt.css";
import type { DesignOversikt } from "./to-design-shape";

// ---------------------------------------------------------------------------
// Icon shim — maps design's Ic n="xxx" to lucide-react, same prop shape
// ---------------------------------------------------------------------------
type IcName =
  | "alert"
  | "arrowRight"
  | "bell"
  | "bot"
  | "check"
  | "checkdoc"
  | "chevUp"
  | "clock"
  | "eye"
  | "grid"
  | "hash"
  | "list"
  | "swap"
  | "thermometer"
  | "trendUp"
  | "user"
  | "users"
  | "wallet";

const IC_MAP: Record<
  IcName,
  React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>
> = {
  alert: AlertTriangle,
  arrowRight: ArrowRight,
  bell: Bell,
  bot: ThumbsUp, // no direct "bot" in lucide; ThumbsUp as closest proxy
  check: Check,
  checkdoc: FileCheck,
  chevUp: ChevronUp,
  clock: Clock,
  eye: Eye,
  grid: LayoutGrid,
  hash: Hash,
  list: List,
  swap: TrendingUp, // "swap" → TrendingUp (changelog feed icon)
  thermometer: Thermometer,
  trendUp: TrendingUp,
  user: User,
  users: Users,
  wallet: Wallet,
};

function Ic({ n, s = 16, c, sw }: { n: IcName; s?: number; c?: string; sw?: number }) {
  const Icon = IC_MAP[n] ?? AlertTriangle;
  return <Icon size={s} color={c} strokeWidth={sw ?? 1.8} />;
}

// ---------------------------------------------------------------------------
// Telemetry helpers — fire-and-forget; never block render
// ---------------------------------------------------------------------------
const noop = () => {};

function emitNav(
  event:
    | "oversikt.pulse_tile_clicked"
    | "oversikt.action_queue_row_clicked"
    | "oversikt.nav_link_clicked",
  data: Record<string, string>,
  workspaceId: string,
  actorId: string,
) {
  void emit({
    event,
    workspace_id: nonEmpty(workspaceId, "workspace_id"),
    actor_id: nonEmpty(actorId, "actor_id"),
    properties: { data },
  } as Parameters<typeof emit>[0]).catch(noop);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
// Route slug → dashboard path mapping (mirrors the prototype's setRoute semantics)
const ROUTE_MAP: Record<string, string> = {
  vaktplan: "/dashboard/vaktplan",
  oppgaver: "/dashboard/oppgaver",
  avstemming: "/dashboard/avstemming",
  kommunikasjon: "/dashboard/kommunikasjon",
};

export interface OversiktCockpitProps {
  data: DesignOversikt;
  workspaceId: string;
  actorId: string;
}

// ---------------------------------------------------------------------------
// DEPT color map — sourced from @smartout/design-tokens (ADR-0361/0366)
// ---------------------------------------------------------------------------
const DEPT: Record<string, string> = {
  kjokken: department.kjokken,
  sal: department.sal,
  bar: department.bar,
  event: department.event,
};

// ---------------------------------------------------------------------------
// DAY constants — design source uses DAY_S=8, DAY_E=23, NOW=8+14/60 (static)
// Here we derive NOW from the server-injected dateLabel's time component, falling
// back to client Date.now(). DAY_S/E defaulted per design source.
// ---------------------------------------------------------------------------
const DAY_S = 8;
const DAY_E = 23;

// ---------------------------------------------------------------------------
// Brief — verbatim JSX from design
// ---------------------------------------------------------------------------
// GHOST: Brief content (body text + b1–b3 actions + sources) is static demo text.
// Product decision pending — Botsson AI-generated morning brief requires
// a dedicated AI summary endpoint. Leave hardcoded until that endpoint ships.
function Brief({ workspaceId, actorId }: { workspaceId: string; actorId: string }) {
  const [showWhy, setShowWhy] = useState(false);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const acts = [
    { id: "b1", label: "Åpne Avvik #214", toast: "Avvik #214 åpnet" },
    { id: "b2", label: "Send kveldsvakt til Jonas", toast: "Forespørsel sendt til Jonas H." },
    { id: "b3", label: "Påminn 2 om vaktendring", toast: "Påminnelse sendt til 2 ansatte" },
  ];
  return (
    <div className="brief">
      <div className="brief-top">
        <span className="brief-av">
          <Ic n="bot" s={19} />
        </span>
        <div className="brief-id">
          <div className="n">
            Morgenbrief <span className="tag">BOTSSON</span>
          </div>
          <div className="m">Generert 08:14 · oppdateres løpende</div>
        </div>
        <span className="spacer" />
        <button
          className="brief-why"
          aria-expanded={showWhy}
          onClick={() => {
            const next = !showWhy;
            setShowWhy(next);
            void emit({
              event: "oversikt.brief_why_toggled",
              workspace_id: nonEmpty(workspaceId, "workspace_id"),
              actor_id: nonEmpty(actorId, "actor_id"),
              properties: { data: { expanded: next } },
            } as Parameters<typeof emit>[0]).catch(noop);
          }}
        >
          <Ic n={showWhy ? "chevUp" : "eye"} s={13} /> {showWhy ? "Skjul kilder" : "Hvorfor?"}
        </button>
      </div>
      <p className="brief-body">
        Dagen ser rolig ut, men <span className="hl-crit">Kjøl 3 har et temperaturavvik</span> som
        bør løses før Bama leverer <strong>09:30</strong>. Du har <strong>3 oppgaver</strong> før
        12:00 og <strong>3 godkjenninger</strong> som ser rutinemessige ut. I morgen mangler du{" "}
        <strong>én kokk på kveld</strong> — Jonas er ledig.
      </p>
      {showWhy && (
        <div className="brief-sources">
          {[
            ["thermometer", "Temp-logg Kjøl 3"],
            ["list", "12 oppgaver i dag"],
            ["grid", "Vaktplan fre"],
            ["wallet", "3 timeavvik"],
            ["hash", "1 ulest kunngjøring"],
          ].map(([ic, s]) => (
            <span key={s} className="brief-src">
              <span className="ic">
                <Ic n={ic as IcName} s={12} />
              </span>
              {s}
            </span>
          ))}
        </div>
      )}
      <div className="brief-actions">
        {acts.map((a, i) => (
          <button
            key={a.id}
            className={`brief-act ${done[a.id] ? "done" : ""}`}
            onClick={() => {
              if (done[a.id]) return;
              setDone((d) => ({ ...d, [a.id]: true }));
              toast(a.toast, {
                action: {
                  label: "Angre",
                  onClick: () => setDone((d) => ({ ...d, [a.id]: false })),
                },
              });
              void emit({
                event: "oversikt.brief_action_taken",
                workspace_id: nonEmpty(workspaceId, "workspace_id"),
                actor_id: nonEmpty(actorId, "actor_id"),
                properties: { data: { action_type: a.id } },
              } as Parameters<typeof emit>[0]).catch(noop);
            }}
          >
            {done[a.id] ? <Ic n="check" s={14} sw={2.4} /> : <span className="num">{i + 1}</span>}
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pulse — verbatim JSX from design
// ---------------------------------------------------------------------------
function Pulse({
  lbl,
  ic,
  val,
  unit,
  sub,
  tone,
  edge,
  onClick,
}: {
  lbl: string;
  ic: IcName;
  val: string | number;
  unit?: string;
  sub: string;
  tone?: string;
  edge?: string;
  onClick?: () => void;
}) {
  return (
    <div className="pulse" onClick={onClick}>
      {edge && <span className="pulse-edge" style={{ background: edge }} />}
      <div className="pulse-lbl">
        <span className="ico">
          <Ic n={ic} s={13} />
        </span>
        {lbl}
      </div>
      <div className={`pulse-val ${tone || ""}`}>
        {val}
        {unit && <span className="u">{unit}</span>}
      </div>
      <div className="pulse-sub">{sub}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActionQueue — verbatim JSX from design
// ---------------------------------------------------------------------------
function ActionQueue({
  actions,
  setRoute,
  workspaceId,
  actorId,
}: {
  actions: DesignOversikt["actions"];
  setRoute: (r: string) => void;
  workspaceId: string;
  actorId: string;
}) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const live = actions.filter((a) => !done[a.id]);
  return (
    <div className="so-panel">
      <div className="so-panel-head">
        <span className="t">
          <span className="ico">
            <Ic n="alert" s={15} />
          </span>
          Krever handling nå
        </span>
        <span className="cnt crit">{live.length}</span>
        <span className="spacer" />
        <button
          className="link"
          onClick={() => {
            setRoute("oppgaver");
            emitNav(
              "oversikt.nav_link_clicked",
              { source: "action_queue_header", target_route: "oppgaver" },
              workspaceId,
              actorId,
            );
          }}
        >
          Alle oppgaver <Ic n="arrowRight" s={13} />
        </button>
      </div>
      <div className="aq">
        {live.length === 0 ? (
          <div className="so-empty">
            <span className="ic">
              <Ic n="check" s={22} />
            </span>
            <div className="t">Alt under kontroll</div>
            <div className="s">Ingenting krever deg akkurat nå.</div>
          </div>
        ) : (
          live.map((a) => (
            <div
              key={a.id}
              className={`aq-row ${a.sev}`}
              role="button"
              tabIndex={0}
              onClick={() => {
                setRoute("oppgaver");
                void emit({
                  event: "oversikt.action_queue_row_clicked",
                  workspace_id: nonEmpty(workspaceId, "workspace_id"),
                  actor_id: nonEmpty(actorId, "actor_id"),
                  properties: { data: { action_type: a.kind } },
                } as Parameters<typeof emit>[0]).catch(noop);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setRoute("oppgaver");
                  void emit({
                    event: "oversikt.action_queue_row_clicked",
                    workspace_id: nonEmpty(workspaceId, "workspace_id"),
                    actor_id: nonEmpty(actorId, "actor_id"),
                    properties: { data: { action_type: a.kind } },
                  } as Parameters<typeof emit>[0]).catch(noop);
                }
              }}
            >
              <span className={`aq-ic ${a.sev}`}>
                <Ic n={a.ic as IcName} s={17} />
              </span>
              <div className="aq-main">
                <div className="aq-tline">
                  <span className={`aq-kind ${a.sev}`}>{a.kind}</span>
                  {a.deadline && (
                    <span className={`aq-meta`}>
                      <span className={`deadline ${a.sev === "crit" ? "crit" : ""} mono`}>
                        {a.deadline}
                      </span>
                    </span>
                  )}
                </div>
                <div className="aq-title">{a.title}</div>
                <div className="aq-meta">{a.meta}</div>
              </div>
              <div className="aq-side">
                {a.who && (
                  <span className="so-av" style={{ width: 28, height: 28, background: a.who.c }}>
                    {a.who.i}
                  </span>
                )}
                <button
                  className={`aq-btn ${a.primary ? "primary" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDone((d) => ({ ...d, [a.id]: true }));
                    toast(`${a.kind}: ${a.toast}`, {
                      action: {
                        label: "Angre",
                        onClick: () => setDone((d) => ({ ...d, [a.id]: false })),
                      },
                    });
                    void emit({
                      event: "oversikt.action_cta_clicked",
                      workspace_id: nonEmpty(workspaceId, "workspace_id"),
                      actor_id: nonEmpty(actorId, "actor_id"),
                      properties: { data: { cta_key: a.cta } },
                    } as Parameters<typeof emit>[0]).catch(noop);
                  }}
                >
                  {a.cta}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Roster — verbatim JSX from design
// ---------------------------------------------------------------------------
function Roster({
  roster,
  workspaceId,
  actorId,
}: {
  roster: DesignOversikt["roster"];
  workspaceId: string;
  actorId: string;
}) {
  const now = new Date();
  const NOW = now.getHours() + now.getMinutes() / 60;
  const span = DAY_E - DAY_S;
  const pct = (h: number) => `${((h - DAY_S) / span) * 100}%`;
  const gapEntry = roster.find((r) => r.status === "gap");

  return (
    <div className="so-panel">
      <div className="so-panel-head">
        <span className="t">
          <span className="ico">
            <Ic n="users" s={15} />
          </span>
          På vakt nå
        </span>
        <span className="cnt">
          {roster.filter((r) => r.status === "on").length}/{roster.length}
        </span>
        <span className="spacer" />
        <span
          className="so-panel-head"
          style={{
            padding: 0,
            border: "none",
            fontSize: 11.5,
            color: "var(--muted)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {now.toTimeString().slice(0, 5)}
        </span>
      </div>
      <div className="roster">
        {roster.map((p, i) => (
          <div key={i} className={`roster-row ${p.status === "gap" ? "gap" : ""}`}>
            <div className="roster-emp">
              {p.i ? (
                <span className="so-av" style={{ width: 30, height: 30, background: p.c }}>
                  {p.i}
                </span>
              ) : (
                <span
                  className="so-av"
                  style={{
                    width: 30,
                    height: 30,
                    background: "var(--secondary)",
                    color: "var(--error)",
                    border: "1.5px dashed var(--error)",
                  }}
                >
                  <Ic n="user" s={14} />
                </span>
              )}
              <span style={{ minWidth: 0 }}>
                <span className="nm">{p.nm}</span>
                <span className="rl" style={{ display: "block" }}>
                  {p.rl}
                </span>
              </span>
            </div>
            <div className="roster-track">
              <span
                className="roster-bar"
                style={{
                  left: pct(p.s),
                  width: `${((p.e - p.s) / span) * 100}%`,
                  background:
                    p.status === "gap"
                      ? "color-mix(in oklch, var(--error) 14%, transparent)"
                      : (DEPT[p.dep] ?? "var(--muted)"),
                  color: p.status === "gap" ? "var(--error)" : "var(--bg)",
                  border: p.status === "gap" ? "1px dashed var(--error)" : "none",
                }}
              >
                {String(p.s).padStart(2, "0")}–{String(p.e).padStart(2, "0")}
              </span>
              <span
                className="roster-now"
                style={{ left: pct(Math.max(DAY_S, Math.min(NOW, DAY_E))) }}
              />
            </div>
            <span className={`roster-status ${p.status}`}>
              {p.status === "on" ? "På vakt" : p.status === "soon" ? "Fra 16:00" : "Mangler"}
            </span>
          </div>
        ))}
        {gapEntry && (
          <div className="roster-gapfill">
            <span className="fill-msg">
              <Ic n="alert" s={14} c="var(--error)" /> Kveldsvakt {gapEntry.dep} {gapEntry.s}–
              {gapEntry.e} udekket
            </span>
            <span />
            <button
              className="aq-btn primary"
              onClick={() => {
                toast("Forespørsel sendt til 3 kvalifiserte", {
                  action: { label: "Angre", onClick: () => {} },
                });
                // GAP: useCreateOpenShift hook missing — emit intent event only
                void emit({
                  event: "oversikt.gap_fill_requested",
                  workspace_id: nonEmpty(workspaceId, "workspace_id"),
                  actor_id: nonEmpty(actorId, "actor_id"),
                  properties: {
                    data: { date_iso: new Date().toISOString().slice(0, 10), gap_count: 1 },
                  },
                } as Parameters<typeof emit>[0]).catch(noop);
              }}
            >
              Finn vikar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RiskTomorrow — verbatim JSX from design (static data; noop_candidates: no onClick on risk items)
// ---------------------------------------------------------------------------
// GHOST: RiskTomorrow displays static hardcoded forecast data. A real
// tomorrow-risk calculation requires schedule coverage analysis across
// future shift rows — no hook for this exists yet. Leave as-is until
// a forecasting hook ships.
function RiskTomorrow() {
  return (
    <div className="so-panel">
      <div className="so-panel-head">
        <span className="t">
          <span className="ico">
            <Ic n="trendUp" s={15} />
          </span>
          Risiko i morgen
        </span>
        <span className="spacer" />
        <span className="so-eyebrow-lbl">Fre 31/5</span>
      </div>
      <div className="risk-body">
        <p className="risk-lead">
          Dekning <strong>fre 31/5</strong> ligger på <strong>83 %</strong>. Hovedrisiko er
          kveldsservice i bar.
        </p>
        <div className="risk-meter">
          <span style={{ width: "62%", background: "var(--success)" }} />
          <span style={{ width: "21%", background: "var(--warning)" }} />
          <span style={{ width: "17%", background: "var(--error)" }} />
        </div>
        <div className="risk-legend">
          <span>
            <i style={{ background: "var(--success)" }} />
            Dekket
          </span>
          <span>
            <i style={{ background: "var(--warning)" }} />
            Stramt
          </span>
          <span>
            <i style={{ background: "var(--error)" }} />
            Udekket
          </span>
        </div>
        {[
          {
            c: "var(--error)",
            t: (
              <span>
                <b>Kveldsvakt bar 17–23</b> — ingen bartender
              </span>
            ),
            a: "Løs",
          },
          {
            c: "var(--warning)",
            t: (
              <span>
                <b>Lunsj kjøkken</b> — kun 1 kokk ved fullt hus
              </span>
            ),
            a: "Se",
          },
          {
            c: "var(--warning)",
            t: (
              <span>
                <b>Selma L.</b> nærmer seg 37,5t denne uka
              </span>
            ),
            a: "Se",
          },
        ].map((r, i) => (
          <div key={i} className="risk-item">
            <span className="rdot" style={{ background: r.c }} />
            <span className="rtxt">{r.t}</span>
            <span className="raction">{r.a}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feed — verbatim JSX from design
// ---------------------------------------------------------------------------
function Feed({
  feed,
  setRoute,
  workspaceId,
  actorId,
}: {
  feed: DesignOversikt["feed"];
  setRoute: (r: string) => void;
  workspaceId: string;
  actorId: string;
}) {
  return (
    <div className="so-panel">
      <div className="so-panel-head">
        <span className="t">
          <span className="ico">
            <Ic n="swap" s={15} />
          </span>
          Siste endringer
        </span>
        <span className="spacer" />
        <button
          className="link"
          onClick={() => {
            setRoute("kommunikasjon");
            emitNav(
              "oversikt.nav_link_clicked",
              { source: "feed_header", target_route: "kommunikasjon" },
              workspaceId,
              actorId,
            );
          }}
        >
          Alle <Ic n="arrowRight" s={13} />
        </button>
      </div>
      <div className="feed">
        {feed.length === 0 ? (
          <div className="so-empty">
            <span className="ic">
              <Ic n="swap" s={22} />
            </span>
            <div className="t">Ingen endringer</div>
            <div className="s">Ingen aktivitet registrert i dag ennå.</div>
          </div>
        ) : (
          feed.map((f, i) => (
            <div key={i} className="feed-item">
              <span className="feed-rail">
                <span className="feed-dot" style={{ background: f.c }} />
              </span>
              <div className="feed-body">
                <span className="who">{f.who}</span>
                {f.text}
                <div className="feed-time">{f.t}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Receipts — verbatim JSX from design
// ---------------------------------------------------------------------------
function Receipts({
  receipts,
  workspaceId,
  actorId,
}: {
  receipts: DesignOversikt["receipts"];
  workspaceId: string;
  actorId: string;
}) {
  const [nudged, setNudged] = useState(false);
  const unread = receipts.filter((r) => !r.read);
  return (
    <div className="so-panel">
      <div className="so-panel-head">
        <span className="t">
          <span className="ico">
            <Ic n="eye" s={15} />
          </span>
          Ulest — vaktendring fre
        </span>
        <span
          className="cnt warn"
          style={{
            color: "var(--warning)",
            background: "color-mix(in oklch, var(--warning) 12%, transparent)",
          }}
        >
          {unread.length}
        </span>
      </div>
      {receipts.length === 0 ? (
        <div className="rr">
          <div className="so-empty">
            <span className="ic">
              <Ic n="eye" s={22} />
            </span>
            <div className="t">Ingen kvitteringsdata</div>
            <div className="s">Lesekvitteringer tilgjengelig etter F0.4 seeding.</div>
          </div>
        </div>
      ) : (
        <div className="rr">
          {receipts.map((r) => (
            <div key={r.i} className="rr-row">
              <span className="so-av" style={{ width: 28, height: 28, background: r.c }}>
                {r.i}
              </span>
              <span className="rr-name">{r.nm}</span>
              <span className={`rr-state ${r.read ? "read" : "unread"}`}>
                {r.read ? (
                  <>
                    <Ic n="check" s={12} sw={2.4} /> Lest
                  </>
                ) : (
                  "Ikke lest"
                )}
              </span>
            </div>
          ))}
          <div className="rr-foot">
            <button
              className="rr-nudge"
              disabled={nudged}
              onClick={() => {
                setNudged(true);
                toast(`Påminnelse sendt til ${unread.length}`, {
                  action: { label: "Angre", onClick: () => setNudged(false) },
                });
                void emit({
                  event: "oversikt.receipt_nudge_sent",
                  workspace_id: nonEmpty(workspaceId, "workspace_id"),
                  actor_id: nonEmpty(actorId, "actor_id"),
                  properties: { data: { workspace_id: workspaceId } },
                } as Parameters<typeof emit>[0]).catch(noop);
              }}
            >
              <Ic n="bell" s={14} />{" "}
              {nudged ? "Påminnelse sendt" : `Påminn ${unread.length} som ikke har lest`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// OversiktCockpit — main page component (replaces OversiktPage + window.SO_PAGES)
// ---------------------------------------------------------------------------
export default function OversiktCockpit({ data, workspaceId, actorId }: OversiktCockpitProps) {
  const router = useRouter();
  const setRoute = useCallback(
    (route: string) => {
      const path = ROUTE_MAP[route] ?? `/dashboard/${route}`;
      router.push(path);
    },
    [router],
  );

  // Page view event — emit once on mount
  useEffect(() => {
    void emit({
      event: "oversikt.viewed",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(actorId, "actor_id"),
      properties: { data: { date_iso: new Date().toISOString().slice(0, 10) } },
    } as Parameters<typeof emit>[0]).catch(noop);
  }, [workspaceId, actorId]);

  // Budget empty-state telemetry — emit when budget null (workspace_budget 0-seeded trap)
  useEffect(() => {
    if (data.budget === null) {
      void emit({
        event: "oversikt.budget_empty_state_shown",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(actorId, "actor_id"),
        properties: { data: { date_iso: new Date().toISOString().slice(0, 10) } },
      } as Parameters<typeof emit>[0]).catch(noop);
    }
  }, [data.budget, workspaceId, actorId]);

  return (
    <main className="sk-main">
      <div className="sk-wrap">
        <div className="dash-head">
          <div>
            <div className="sk-eyebrow">{data.dateLabel}</div>
            <h1 className="dash-greet">God morgen, {data.greetingName}</h1>
            <p className="dash-desc">
              Din operasjonelle arbeidsdag — vakt, bemanning, avvik og handlingskø samlet på ett
              sted.
            </p>
            <div className="dash-statusline">
              <span className="seg">
                <span className="dot" style={{ background: "var(--success)" }} />
                <strong>{data.staffSummary}</strong> på vakt
              </span>
              <span className="sep" />
              <span className="seg">
                <span className="dot" style={{ background: "var(--error)" }} />
                <strong>{data.gapCount}</strong> bemanningshull
              </span>
              <span className="sep" />
              <span className="seg">
                <span className="dot" style={{ background: "var(--warning)" }} />
                <strong>{data.resolveCount}</strong> må løses før 12:00
              </span>
              <span className="sep" />
              <span className="seg">
                Åpner <strong>10:00</strong>
              </span>
            </div>
          </div>
          <div className="sk-page-actions">
            <button
              className="sk-ghost"
              onClick={() => {
                // GAP: useGenerateDayReport hook missing — emit intent only, no backend mutation
                toast("Dagsrapport — ikke tilgjengelig ennå", {
                  description: "Hook mangler (se PLAN.md Gap 2)",
                });
                void emit({
                  event: "oversikt.dagsrapport_requested",
                  workspace_id: nonEmpty(workspaceId, "workspace_id"),
                  actor_id: nonEmpty(actorId, "actor_id"),
                  properties: { data: { date_iso: new Date().toISOString().slice(0, 10) } },
                } as Parameters<typeof emit>[0]).catch(noop);
              }}
            >
              <Ic n="checkdoc" s={15} /> Dagsrapport
            </button>
          </div>
        </div>

        <Brief workspaceId={workspaceId} actorId={actorId} />

        <div className="dash-pulse">
          <Pulse
            lbl="På vakt nå"
            ic="users"
            val={data.pulse.onShift}
            unit={data.pulse.onShiftUnit}
            sub={data.pulse.onShiftSub}
            tone=""
            edge="var(--success)"
            onClick={() => {
              setRoute("vaktplan");
              emitNav(
                "oversikt.pulse_tile_clicked",
                { tile_key: "on_shift" },
                workspaceId,
                actorId,
              );
            }}
          />
          <Pulse
            lbl="Må løses"
            ic="alert"
            val={data.pulse.mustResolve}
            sub={data.pulse.mustResolveSub}
            tone={data.pulse.mustResolve > 0 ? "crit" : ""}
            edge="var(--error)"
            onClick={() => {
              setRoute("oppgaver");
              emitNav(
                "oversikt.pulse_tile_clicked",
                { tile_key: "must_resolve" },
                workspaceId,
                actorId,
              );
            }}
          />
          <Pulse
            lbl="Til godkjenning"
            ic="checkdoc"
            val={data.pulse.pendingApprovals}
            sub={data.pulse.pendingApprovalsSub}
            tone={data.pulse.pendingApprovals > 0 ? "warn" : ""}
            edge="var(--warning)"
            onClick={() => {
              setRoute("avstemming");
              emitNav(
                "oversikt.pulse_tile_clicked",
                { tile_key: "pending_approvals" },
                workspaceId,
                actorId,
              );
            }}
          />
          <Pulse
            lbl="Ulest"
            ic="eye"
            val={data.pulse.unread}
            sub={data.pulse.unreadSub}
            tone={data.pulse.unread > 0 ? "warn" : ""}
            edge="var(--warning)"
            onClick={() => {
              setRoute("kommunikasjon");
              emitNav("oversikt.pulse_tile_clicked", { tile_key: "unread" }, workspaceId, actorId);
            }}
          />
          {data.pulse.coveragePct !== null ? (
            <Pulse
              lbl="Dekning i dag"
              ic="trendUp"
              val={data.pulse.coveragePct}
              unit="%"
              sub={data.pulse.coverageSub}
              tone={
                data.pulse.coveragePct >= 90 ? "ok" : data.pulse.coveragePct >= 75 ? "warn" : "crit"
              }
              edge="var(--success)"
              onClick={() => {
                setRoute("vaktplan");
                emitNav(
                  "oversikt.pulse_tile_clicked",
                  { tile_key: "coverage_today" },
                  workspaceId,
                  actorId,
                );
              }}
            />
          ) : (
            // GAP: coverage % not available — honest empty-state tile
            <div className="pulse" style={{ cursor: "default", opacity: 0.5 }}>
              <span className="pulse-edge" style={{ background: "var(--border-strong)" }} />
              <div className="pulse-lbl">
                <span className="ico">
                  <Ic n="trendUp" s={13} />
                </span>
                Dekning i dag
              </div>
              <div className="pulse-val">—</div>
              <div className="pulse-sub">sjekk Vaktplan</div>
            </div>
          )}
        </div>

        <div className="so-grid-2">
          <div className="so-stack">
            <ActionQueue
              actions={data.actions}
              setRoute={setRoute}
              workspaceId={workspaceId}
              actorId={actorId}
            />
            <Roster roster={data.roster} workspaceId={workspaceId} actorId={actorId} />
          </div>
          <div className="so-stack">
            <RiskTomorrow />
            <Receipts receipts={data.receipts} workspaceId={workspaceId} actorId={actorId} />
            <Feed
              feed={data.feed}
              setRoute={setRoute}
              workspaceId={workspaceId}
              actorId={actorId}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
