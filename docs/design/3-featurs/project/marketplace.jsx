/* global React, Icon, Icons, Avatar, Sidebar, Topbar */
// Marketplace — manager web page (/dashboard/marketplace/)

const { useState, useMemo } = React;

const MARKETPLACE_OFFERS = [
  {
    id: "o_4f9a",
    date: "2026-05-17",
    weekday: "Lørdag",
    start: "16:00", end: "23:30",
    role: "Bartender",
    department: "Bar",
    postedBy: "Ida Holm",
    postedAt: "for 8 min siden",
    expiresAt: "I dag 23:59",
    visibility: "workspace",
    reason: "Sykmelding — Eirik",
    status: "claimed",
    claimer: { name: "Mathias Berg", readiness: 92, roleMatch: true, hoursThisWeek: 28 },
  },
  {
    id: "o_2c81",
    date: "2026-05-18",
    weekday: "Søndag",
    start: "11:00", end: "17:00",
    role: "Servitør",
    department: "Sal",
    postedBy: "Ida Holm",
    postedAt: "for 22 min siden",
    expiresAt: "Lør 18:00",
    visibility: "department",
    reason: "Brunsj-rush, ekstra hjelp",
    status: "open",
    claimer: null,
    views: 14,
  },
  {
    id: "o_7d3b",
    date: "2026-05-19",
    weekday: "Mandag",
    start: "07:30", end: "14:00",
    role: "Kjøkkenassistent",
    department: "Kjøkken",
    postedBy: "Ida Holm",
    postedAt: "for 1 t siden",
    expiresAt: "Søn 12:00",
    visibility: "workspace",
    reason: null,
    status: "open",
    claimer: null,
    views: 6,
  },
  {
    id: "o_a012",
    date: "2026-05-20",
    weekday: "Tirsdag",
    start: "17:00", end: "23:00",
    role: "Hovmester",
    department: "Sal",
    postedBy: "Henrik Dahl",
    postedAt: "for 3 t siden",
    expiresAt: "Tir 12:00",
    visibility: "workspace",
    reason: "Stort selskap booket inn",
    status: "claimed",
    claimer: { name: "Sofie Lund", readiness: 78, roleMatch: false, hoursThisWeek: 32, missing: "Hovmester-sertifisering ikke registrert" },
  },
  {
    id: "o_b8e5",
    date: "2026-05-22",
    weekday: "Torsdag",
    start: "15:00", end: "22:30",
    role: "Servitør",
    department: "Sal",
    postedBy: "Ida Holm",
    postedAt: "i går",
    expiresAt: "Ons 16:00",
    visibility: "workspace",
    reason: null,
    status: "approved",
    claimer: { name: "Anna Nilsen", readiness: 88, roleMatch: true, hoursThisWeek: 24 },
    approvedAt: "for 4 t siden",
  },
];

function StatusDot({ status }) {
  const map = {
    open:      { cls: "pill-info",    label: "Åpen" },
    claimed:   { cls: "pill-warning", label: "Krevet" },
    approved:  { cls: "pill-success", label: "Godkjent" },
    cancelled: { cls: "pill-error",   label: "Kansellert" },
  };
  const m = map[status] || map.open;
  return <span className={`pill ${m.cls}`}><span className="dot"></span>{m.label}</span>;
}

function KpiTile({ label, value, sub, accent }) {
  return (
    <div className={"kpi" + (accent ? " kpi-accent" : "")}>
      <div className="label">{label}</div>
      <div className="value serif">{value}</div>
      <div className="delta">{sub}</div>
    </div>
  );
}

function OfferCard({ offer, onApprove, onCancel, onSelect }) {
  const dateLabel = new Date(offer.date).toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
  return (
    <div
      onClick={() => onSelect(offer.id)}
      style={{
        position: "relative",
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: 20,
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        gap: 24,
        alignItems: "center",
        cursor: "pointer",
        transition: "border-color 160ms ease, box-shadow 160ms ease, transform 80ms ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-strong)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
    >
      {/* Date pillar */}
      <div style={{ width: 64, textAlign: "left" }}>
        <div style={{ fontSize: 11, color: "var(--foreground-faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{offer.weekday}</div>
        <div className="serif" style={{ fontSize: 30, lineHeight: 1, marginTop: 4, letterSpacing: "-0.02em" }}>{dateLabel}</div>
        <div className="mono" style={{ fontSize: 12, color: "var(--foreground-soft)", marginTop: 6 }}>{offer.start}–{offer.end}</div>
      </div>

      {/* Middle: role + meta */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 16, fontWeight: 500 }}>{offer.role}</span>
          <span style={{ fontSize: 13, color: "var(--foreground-faint)" }}>· {offer.department}</span>
          <StatusDot status={offer.status} />
          {offer.visibility === "department" && (
            <span className="pill" style={{ background: "transparent", border: "1px solid var(--border)" }}>
              {Icons.Building}<span style={{ marginLeft: 2 }}>Kun {offer.department}</span>
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 12.5, color: "var(--foreground-soft)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{Icons.Clock}Lagt ut {offer.postedAt}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon d="M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" size={14} />Utløper {offer.expiresAt}</span>
          {offer.status === "open" && offer.views != null && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{Icons.Eye}{offer.views} sett</span>
          )}
        </div>
        {offer.reason && (
          <div style={{ fontSize: 13, color: "var(--foreground-soft)", fontStyle: "italic" }}>
            "{offer.reason}"
          </div>
        )}
      </div>

      {/* Right: claimer + action */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, justifySelf: "end" }}>
        {offer.status === "claimed" && offer.claimer && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px 8px 8px", background: "var(--warning-soft)", borderRadius: 999 }}>
            <Avatar name={offer.claimer.name} size={28} />
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "oklch(0.30 0.08 60)" }}>{offer.claimer.name}</div>
              <div style={{ fontSize: 11, color: "oklch(0.42 0.07 60)" }}>klar {offer.claimer.readiness}% {!offer.claimer.roleMatch && "· mangler match"}</div>
            </div>
          </div>
        )}
        {offer.status === "approved" && offer.claimer && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px 8px 8px", background: "var(--success-soft)", borderRadius: 999 }}>
            <Avatar name={offer.claimer.name} size={28} />
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "oklch(0.30 0.10 150)" }}>{offer.claimer.name}</div>
              <div style={{ fontSize: 11, color: "oklch(0.42 0.09 150)" }}>godkjent {offer.approvedAt}</div>
            </div>
          </div>
        )}
        {offer.status === "open" && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--foreground-faint)", fontSize: 12.5 }}>
            <span>Venter på krav</span>
            <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: 999, background: "var(--info)" }} className="pulse"></span>
          </div>
        )}

        {offer.status === "claimed" && (
          <button
            onClick={(e) => { e.stopPropagation(); onApprove(offer); }}
            className="btn btn-accent btn-sm"
          >
            {Icons.Check}<span>Godkjenn</span>
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); }}
          className="btn btn-ghost"
          style={{ width: 32, height: 32, padding: 0, justifyContent: "center", borderRadius: 8 }}
        >
          {Icons.More}
        </button>
      </div>
    </div>
  );
}

// Approve dialog
function ApproveDialog({ offer, onClose, onConfirm }) {
  if (!offer) return null;
  const c = offer.claimer;
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 50,
      background: "color-mix(in oklch, var(--foreground) 35%, transparent)",
      display: "flex", alignItems: "center", justifyContent: "center",
      animation: "fade-in 180ms ease",
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 480,
        background: "var(--card)",
        borderRadius: 18,
        border: "1px solid var(--border)",
        boxShadow: "0 24px 64px -16px oklch(0.20 0.04 60 / 0.20), 0 4px 12px -4px oklch(0.20 0.04 60 / 0.10)",
        animation: "scale-in 200ms cubic-bezier(0.16, 1, 0.3, 1)",
        overflow: "hidden",
      }}>
        <div style={{ padding: "26px 28px 20px" }}>
          <div className="pill pill-warning" style={{ marginBottom: 12 }}><span className="dot"></span>Krav venter</div>
          <h3 className="serif" style={{ fontSize: 26, margin: 0, lineHeight: 1.1, letterSpacing: "-0.01em" }}>Godkjenn {c.name}?</h3>
          <p style={{ marginTop: 10, color: "var(--foreground-soft)", fontSize: 14, lineHeight: 1.55 }}>
            Botsson vil sende godkjenningen via chat. Du bekrefter, og vakten settes fra <span className="mono" style={{ fontSize: 13 }}>claimed → approved</span>.
          </p>
        </div>

        <div style={{ padding: "0 28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 14, background: "var(--background-soft)", borderRadius: 12, border: "1px solid var(--border)" }}>
            <Avatar name={c.name} size={44} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{c.name}</div>
              <div style={{ fontSize: 12, color: "var(--foreground-faint)", marginTop: 2 }}>{offer.role} · {c.hoursThisWeek} t denne uka</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="mono" style={{ fontSize: 22, lineHeight: 1, color: c.readiness >= 80 ? "var(--success)" : "var(--warning)" }}>{c.readiness}%</div>
              <div style={{ fontSize: 11, color: "var(--foreground-faint)", marginTop: 4 }}>klar</div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14 }}>
            <CheckRow ok={c.roleMatch} label="Rollekvalifikasjon" detail={c.roleMatch ? `${offer.role} bekreftet` : c.missing} />
            <CheckRow ok={true}        label="Rammeavtale" detail="Innenfor ukentlig grense" />
            <CheckRow ok={true}        label="Hvile" detail="11 t fra forrige vakt" />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "20px 28px 22px", marginTop: 20, borderTop: "1px solid var(--border)", background: "var(--background-soft)" }}>
          <button onClick={onClose} className="btn btn-ghost">Avbryt</button>
          <button onClick={() => onConfirm(offer)} className="btn btn-accent">
            {Icons.Sparkle}<span>Bekreft i chat</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckRow({ ok, label, detail }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 4px", fontSize: 13 }}>
      <span style={{
        width: 18, height: 18, borderRadius: 999,
        background: ok ? "var(--success-soft)" : "var(--warning-soft)",
        color: ok ? "var(--success)" : "oklch(0.50 0.13 60)",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <Icon d={ok ? "m4 12 5 5L20 6" : "M12 9v4M12 17h.01"} size={11} />
      </span>
      <span style={{ fontWeight: 500 }}>{label}</span>
      <span style={{ color: "var(--foreground-faint)", marginLeft: "auto" }}>{detail}</span>
    </div>
  );
}

// Compose drawer
function ComposeDrawer({ open, onClose, onSubmit }) {
  const [shiftId, setShiftId] = useState("");
  const [reason, setReason] = useState("");
  const [visibility, setVisibility] = useState("workspace");
  const [department, setDepartment] = useState("Sal");
  const [expires, setExpires] = useState("24h");

  if (!open) return null;

  const shifts = [
    { id: "s_4022", label: "Lør 24. mai · 16:00–23:30 · Bartender · Bar", warn: false },
    { id: "s_4041", label: "Søn 25. mai · 11:00–17:00 · Servitør · Sal", warn: false },
    { id: "s_4087", label: "Tir 27. mai · 07:30–14:00 · Kokk · Kjøkken", warn: true },
  ];

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 40 }}>
      <div onClick={onClose} style={{
        position: "absolute", inset: 0,
        background: "color-mix(in oklch, var(--foreground) 25%, transparent)",
        animation: "fade-in 180ms ease",
      }}></div>
      <div style={{
        position: "absolute", top: 0, right: 0, bottom: 0,
        width: 480,
        background: "var(--card)",
        borderLeft: "1px solid var(--border)",
        animation: "slide-in-right 240ms cubic-bezier(0.16, 1, 0.3, 1)",
        display: "flex", flexDirection: "column",
        boxShadow: "-24px 0 64px -16px oklch(0.20 0.04 60 / 0.15)",
      }}>
        {/* Header */}
        <div style={{ padding: "22px 28px 18px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span className="pill pill-primary">Compose · chat-only</span>
            <button onClick={onClose} className="btn btn-ghost" style={{ width: 32, height: 32, padding: 0, justifyContent: "center", borderRadius: 8 }}>
              {Icons.X}
            </button>
          </div>
          <h3 className="serif" style={{ fontSize: 28, margin: 0, lineHeight: 1.08, letterSpacing: "-0.01em" }}>Tilby ny åpen vakt</h3>
          <p style={{ fontSize: 13.5, color: "var(--foreground-soft)", marginTop: 6, marginBottom: 0 }}>
            Velg en ufyllt vakt fra planen. Botsson bekrefter via chat før den publiseres.
          </p>
        </div>

        {/* Body */}
        <div className="scroll" style={{ flex: 1, overflowY: "auto", padding: "20px 28px 24px", display: "flex", flexDirection: "column", gap: 22 }}>
          {/* Shift picker */}
          <Field label="Vakt" hint="Kun ufylte vakter vises">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {shifts.map((s) => (
                <label key={s.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px",
                  border: shiftId === s.id ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                  background: shiftId === s.id ? "var(--primary-soft)" : "var(--card)",
                  borderRadius: 10, cursor: "pointer",
                }}>
                  <input type="radio" name="shift" checked={shiftId === s.id} onChange={() => setShiftId(s.id)} style={{ accentColor: "var(--primary)" }} />
                  <span style={{ fontSize: 13.5, flex: 1 }}>{s.label}</span>
                  {s.warn && <span className="pill pill-warning" style={{ height: 20, fontSize: 10.5 }}>kvalifikasjon</span>}
                </label>
              ))}
              <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start", marginTop: 2 }}>
                {Icons.Plus}<span>Lag ad-hoc vakt</span>
              </button>
            </div>
          </Field>

          <Field label="Grunn" hint="Valgfritt — vises i kortet">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="F.eks. sykmelding — Eirik"
              style={{
                width: "100%", minHeight: 64, resize: "vertical",
                padding: "10px 12px", borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--card)", fontSize: 13.5,
              }}
            />
          </Field>

          <Field label="Synlighet">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { v: "workspace", icon: Icons.Globe, label: "Hele workspace", sub: "Alle ansatte ser tilbudet" },
                { v: "department", icon: Icons.Building, label: "Spesifikk avdeling", sub: "Kun valgt avdeling" },
              ].map((o) => (
                <label key={o.v} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px",
                  border: visibility === o.v ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                  background: visibility === o.v ? "var(--primary-soft)" : "var(--card)",
                  borderRadius: 10, cursor: "pointer",
                }}>
                  <input type="radio" name="vis" checked={visibility === o.v} onChange={() => setVisibility(o.v)} style={{ accentColor: "var(--primary)" }} />
                  <span style={{ color: "var(--foreground-soft)" }}>{o.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>{o.label}</div>
                    <div style={{ fontSize: 11.5, color: "var(--foreground-faint)" }}>{o.sub}</div>
                  </div>
                </label>
              ))}
              {visibility === "department" && (
                <select value={department} onChange={(e) => setDepartment(e.target.value)} style={{
                  marginTop: 4, padding: "8px 10px", borderRadius: 8,
                  border: "1px solid var(--border)", background: "var(--card)", fontSize: 13.5,
                }}>
                  <option>Sal</option><option>Bar</option><option>Kjøkken</option>
                </select>
              )}
            </div>
          </Field>

          <Field label="Kravvindu">
            <div style={{ display: "flex", gap: 6 }}>
              {[
                { v: "4h", l: "4 t" },
                { v: "12h", l: "12 t" },
                { v: "24h", l: "24 t" },
                { v: "until", l: "Til vaktstart" },
              ].map((o) => (
                <button key={o.v} onClick={() => setExpires(o.v)} className={"btn btn-sm" + (expires === o.v ? " btn-primary" : " btn-outline")}>
                  {o.l}
                </button>
              ))}
            </div>
          </Field>
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 28px 20px", borderTop: "1px solid var(--border)",
          background: "var(--background-soft)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{ fontSize: 11.5, color: "var(--foreground-faint)", flex: 1, lineHeight: 1.45 }}>
            Vakten publiseres etter bekreftelse i Botsson-chat.
          </div>
          <button onClick={onClose} className="btn btn-ghost">Avbryt</button>
          <button onClick={() => onSubmit({ shiftId, reason, visibility, department, expires })} className="btn btn-accent" disabled={!shiftId}
            style={{ opacity: shiftId ? 1 : 0.5, pointerEvents: shiftId ? "auto" : "none" }}>
            {Icons.Sparkle}<span>Send til chat</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", marginBottom: 8 }}>
        <label style={{ fontSize: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--foreground-soft)" }}>{label}</label>
        {hint && <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--foreground-faint)" }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// Botsson confirm overlay (after submitting)
function BotssonChip({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div style={{
      position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)",
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 16px 10px 12px",
      background: "var(--foreground)", color: "var(--background)",
      borderRadius: 999,
      boxShadow: "0 12px 36px -8px oklch(0.20 0.04 60 / 0.30)",
      animation: "scale-in 220ms cubic-bezier(0.16, 1, 0.3, 1)", zIndex: 60,
    }}>
      <div style={{ width: 24, height: 24, borderRadius: 999, background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {Icons.Sparkle}
      </div>
      <span style={{ fontSize: 13.5 }}>{message}</span>
      <button onClick={onDismiss} style={{ marginLeft: 4, color: "color-mix(in oklch, var(--background) 70%, transparent)", width: 22, height: 22, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {Icons.X}
      </button>
    </div>
  );
}

function MarketplacePage() {
  const [offers, setOffers] = useState(MARKETPLACE_OFFERS);
  const [activeStatus, setActiveStatus] = useState("alle");
  const [dept, setDept] = useState("Alle avdelinger");
  const [composeOpen, setComposeOpen] = useState(false);
  const [approveTarget, setApproveTarget] = useState(null);
  const [botsson, setBotsson] = useState(null);

  const filtered = useMemo(() => {
    return offers.filter((o) => {
      if (activeStatus !== "alle" && o.status !== activeStatus) return false;
      if (dept !== "Alle avdelinger" && o.department !== dept) return false;
      return true;
    });
  }, [offers, activeStatus, dept]);

  const counts = useMemo(() => ({
    open:     offers.filter(o => o.status === "open").length,
    claimed:  offers.filter(o => o.status === "claimed").length,
    approved: offers.filter(o => o.status === "approved").length,
  }), [offers]);

  const handleApprove = (offer) => {
    setApproveTarget(null);
    setOffers((prev) => prev.map((o) => o.id === offer.id ? { ...o, status: "approved", approvedAt: "akkurat nå" } : o));
    setBotsson(`Botsson bekreftet godkjenning for ${offer.claimer.name}`);
    setTimeout(() => setBotsson(null), 3200);
  };

  const handleCompose = (data) => {
    setComposeOpen(false);
    setBotsson("Forslag sendt til Botsson — bekrefter i chat …");
    setTimeout(() => setBotsson(null), 3200);
  };

  return (
    <div style={{ position: "relative", height: "100%", overflow: "hidden", background: "var(--background)" }}>
      <div className="orb-bg"></div>

      <div style={{ display: "flex", height: "100%", position: "relative", zIndex: 1 }}>
        <Sidebar active="marketplace" />

        <main className="scroll" style={{ flex: 1, overflowY: "auto", position: "relative" }}>
          <Topbar crumbs={["Dashboard", "Vaktbørs"]} />

          <div style={{ padding: "32px 40px 120px", maxWidth: 1200, margin: "0 auto" }}>
            {/* Page header */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 32, marginBottom: 28 }}>
              <div style={{ flex: 1 }}>
                <div className="pill pill-primary" style={{ marginBottom: 12 }}>
                  <span className="dot"></span>ADR-0306 · Compose-verb
                </div>
                <h1 className="serif" style={{ fontSize: 56, margin: 0, lineHeight: 1.0, letterSpacing: "-0.025em" }}>Vaktbørs</h1>
                <p style={{ fontSize: 15.5, color: "var(--foreground-soft)", marginTop: 12, marginBottom: 0, maxWidth: 580, lineHeight: 1.55 }}>
                  Tilby åpne vakter til hele teamet — første som klarer kravene godkjennes via Botsson.
                </p>
              </div>
              <button onClick={() => setComposeOpen(true)} className="btn btn-accent btn-lg">
                {Icons.Plus}<span>Tilby ny åpen vakt</span>
              </button>
            </div>

            {/* KPI strip */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
              <KpiTile label="Åpne" value={counts.open} sub="Venter på krav" accent />
              <KpiTile label="Krevet" value={counts.claimed} sub="Klar for godkjenning" />
              <KpiTile label="Godkjent · 7d" value={12} sub="↑ 4 fra forrige uke" />
            </div>

            {/* Filter row */}
            <div style={{
              display: "flex", alignItems: "center", gap: 14, marginBottom: 20,
              padding: "10px 14px",
              borderRadius: 12,
              background: "var(--background-soft)",
              border: "1px solid var(--border)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, paddingRight: 12, borderRight: "1px solid var(--border)" }}>
                <select value={dept} onChange={(e) => setDept(e.target.value)} style={{
                  padding: "6px 8px", border: "none", background: "transparent", fontSize: 13.5, color: "var(--foreground)",
                }}>
                  <option>Alle avdelinger</option><option>Sal</option><option>Bar</option><option>Kjøkken</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {[
                  { v: "alle", l: "Alle", n: offers.length },
                  { v: "open", l: "Åpne", n: counts.open },
                  { v: "claimed", l: "Krevet", n: counts.claimed },
                  { v: "approved", l: "Godkjent", n: counts.approved },
                  { v: "cancelled", l: "Kansellert", n: 0 },
                ].map((p) => (
                  <button key={p.v} onClick={() => setActiveStatus(p.v)} style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "6px 12px", borderRadius: 999,
                    fontSize: 13, fontWeight: 500,
                    background: activeStatus === p.v ? "var(--foreground)" : "transparent",
                    color: activeStatus === p.v ? "var(--background)" : "var(--foreground-soft)",
                    transition: "background 160ms ease, color 160ms ease",
                  }}>
                    {p.l}
                    <span style={{ fontSize: 11, opacity: 0.7 }}>{p.n}</span>
                  </button>
                ))}
              </div>
              <div style={{ flex: 1 }}></div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--foreground-soft)" }}>
                {Icons.Clock}<span>17. – 24. mai</span>
                <Icon d="m6 9 6 6 6-6" size={12} />
              </div>
            </div>

            {/* Offer cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.map((o) => (
                <OfferCard key={o.id} offer={o} onApprove={setApproveTarget} onSelect={() => {}} />
              ))}
              {filtered.length === 0 && (
                <div style={{ padding: "60px 24px", textAlign: "center", color: "var(--foreground-faint)" }}>
                  <div className="serif" style={{ fontSize: 22, color: "var(--foreground-soft)", marginBottom: 6 }}>Ingen vakter her akkurat nå.</div>
                  <div style={{ fontSize: 13 }}>Juster filteret, eller tilby en ny vakt.</div>
                </div>
              )}
            </div>
          </div>

          {/* Drawer + Dialog + Toast */}
          <ComposeDrawer open={composeOpen} onClose={() => setComposeOpen(false)} onSubmit={handleCompose} />
          <ApproveDialog offer={approveTarget} onClose={() => setApproveTarget(null)} onConfirm={handleApprove} />
          <BotssonChip message={botsson} onDismiss={() => setBotsson(null)} />
        </main>
      </div>
    </div>
  );
}

Object.assign(window, { MarketplacePage });
