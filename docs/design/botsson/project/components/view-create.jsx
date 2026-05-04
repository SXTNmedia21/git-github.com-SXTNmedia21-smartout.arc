/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ViewCreate — "Skap noe nytt" (v2)
   Segmented picker on top · active form fills below
   Rebuilt for 600×~420 arena body — nothing clips
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function ViewCreate() {
  const tiles = [
    {
      id: "note", label: "Notat", sub: "idé · observasjon",
      color: "oklch(0.75 0.16 85)",
      icon: (sp) => (
        <svg {...sp}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="13" y2="17" /></svg>
      ),
    },
    {
      id: "task", label: "Oppgave", sub: "noe som skal gjøres",
      color: "oklch(0.65 0.22 40)",
      icon: (sp) => (
        <svg {...sp}><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="m7.5 12 3 3 6-6" /></svg>
      ),
    },
    {
      id: "booking", label: "Booking", sub: "bord · selskap",
      color: "oklch(0.72 0.14 180)",
      icon: (sp) => (
        <svg {...sp}><rect x="3" y="5" width="18" height="16" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="8" y1="3" x2="8" y2="7" /><line x1="16" y1="3" x2="16" y2="7" /></svg>
      ),
    },
    {
      id: "shift", label: "Vakt", sub: "rolle · tid · folk",
      color: "oklch(0.60 0.15 250)",
      icon: (sp) => (
        <svg {...sp}><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" /></svg>
      ),
      active: true,
    },
  ];

  const active = tiles.find(t => t.active);

  return (
    <div style={{ position: "absolute", inset: 0, padding: "14px 60px 14px 14px", display: "flex", flexDirection: "column", gap: 10 }}>

      {/* Segmented picker — 4 tiles, active one has filled accent */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
        {tiles.map(t => {
          const sp = { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" };
          return (
            <button key={t.id} style={{
              padding: "9px 10px",
              borderRadius: 9,
              border: "1px solid " + (t.active ? t.color : "var(--border)"),
              background: t.active ? t.color : "var(--card)",
              color: t.active ? "white" : "var(--foreground)",
              cursor: "pointer",
              textAlign: "left",
              display: "flex", flexDirection: "column", gap: 3,
              position: "relative",
              boxShadow: t.active ? `0 4px 12px ${t.color.replace(")", " / 0.3)")}` : "none",
              transition: "all 180ms",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                {t.icon({ ...sp })}
                <span style={{ fontSize: 12, fontWeight: 600 }}>{t.label}</span>
              </div>
              <div style={{ fontSize: 9.5, opacity: t.active ? 0.85 : 0.6, fontFamily: "var(--font-heading)", fontStyle: "italic" }}>{t.sub}</div>
            </button>
          );
        })}
      </div>

      {/* Active form — vakt, with live-from-voice treatment */}
      <div style={{
        flex: 1,
        padding: "12px 14px",
        borderRadius: 11,
        border: "1px solid var(--border)",
        background: "var(--card)",
        display: "flex", flexDirection: "column", gap: 10,
        minHeight: 0, overflow: "hidden",
        position: "relative",
      }}>
        {/* Listening ribbon */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          fontSize: 11, color: "var(--muted-fg)",
          paddingBottom: 10,
          borderBottom: "1px dashed var(--border)",
        }}>
          <EmmaOrb size={18} />
          <span style={{ flex: 1 }}>
            <span style={{ color: "var(--foreground)" }}>"legg til servitør-vakt fredag fra fire til elleve, Lars eller Ida…"</span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5, color: active.color, fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: active.color, animation: "botsson-pulse 1.4s ease-in-out infinite" }} />
            Lytter
          </span>
        </div>

        {/* Fields — two columns of compact pairs */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", rowGap: 9, columnGap: 16 }}>
          <SmallField label="Rolle"   value="Servitør"        fresh color={active.color} />
          <SmallField label="Dato"    value="Fre 3. mai"      fresh color={active.color} />
          <SmallField label="Tid"     value="16:00 — 23:00"   fresh color={active.color} />
          <SmallField label="Lokasjon" value="Hovedetasje"    dimmed />
        </div>

        {/* Candidates row */}
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "var(--muted-fg)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 5 }}>Kandidater</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {[
              { n: "Lars", match: 94 },
              { n: "Ida",  match: 88 },
              { n: "Mikkel", match: 62, tentative: true },
            ].map(p => (
              <div key={p.n} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "4px 9px 4px 5px",
                borderRadius: 999,
                background: p.tentative ? "transparent" : active.color.replace(")", " / 0.1)"),
                border: "1px " + (p.tentative ? "dashed" : "solid") + " " + (p.tentative ? "var(--border)" : active.color.replace(")", " / 0.3)")),
                fontSize: 11,
              }}>
                <span style={{
                  width: 18, height: 18, borderRadius: "50%",
                  background: p.tentative ? "var(--secondary)" : active.color,
                  color: p.tentative ? "var(--muted-fg)" : "white",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, fontWeight: 700,
                }}>{p.n[0]}</span>
                <span style={{ color: p.tentative ? "var(--muted-fg)" : "var(--foreground)" }}>{p.n}</span>
                <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--muted-fg)" }}>{p.match}%</span>
              </div>
            ))}
            <button style={{
              padding: "4px 9px",
              borderRadius: 999,
              border: "1px dashed var(--border)",
              background: "transparent",
              color: "var(--muted-fg)",
              fontSize: 10.5,
              cursor: "pointer",
            }}>+ åpne skift</button>
          </div>
        </div>

        {/* Action row — anchored at bottom */}
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 6, paddingTop: 6 }}>
          <button style={{
            padding: "6px 10px",
            fontSize: 11, fontWeight: 500,
            borderRadius: 7,
            background: "transparent", color: "var(--muted-fg)",
            border: "1px solid var(--border)",
            cursor: "pointer",
          }}>Avbryt</button>
          <span style={{ flex: 1 }} />
          <button style={{
            padding: "6px 11px",
            fontSize: 11, fontWeight: 500,
            borderRadius: 7,
            background: "transparent", color: "var(--foreground)",
            border: "1px solid var(--border)",
            cursor: "pointer",
          }}>Lagre utkast</button>
          <button style={{
            padding: "6px 14px",
            fontSize: 11.5, fontWeight: 600,
            borderRadius: 7,
            background: active.color, color: "white",
            border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 5,
          }}>
            Legg inn vakt
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function SmallField({ label, value, fresh, dimmed, color }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "var(--muted-fg)", textTransform: "uppercase", letterSpacing: "0.12em", display: "flex", alignItems: "center", gap: 5 }}>
        {label}
        {fresh && <span style={{
          width: 4, height: 4, borderRadius: "50%",
          background: color,
          animation: "botsson-pulse 1.6s ease-in-out infinite",
        }} />}
      </div>
      <div style={{
        fontSize: 12.5,
        fontWeight: 500,
        color: dimmed ? "var(--muted-fg)" : "var(--foreground)",
        fontStyle: dimmed ? "italic" : "normal",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{value}</div>
    </div>
  );
}

Object.assign(window, { ViewCreate });
