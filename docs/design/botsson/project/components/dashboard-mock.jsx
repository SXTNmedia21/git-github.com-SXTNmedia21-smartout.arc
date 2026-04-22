/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Dashboard mock — Smartout shell behind the overlay
   Sidebar + KPI cards + shift table. Supports dark.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function DashboardMock({ dark = false, width = 1080, height = 680 }) {
  const themeClass = dark ? "dark" : "";
  return (
    <div className={themeClass} style={{
      position: "relative",
      width, height,
      borderRadius: 16,
      overflow: "hidden",
      background: "var(--background)",
      color: "var(--foreground)",
      display: "flex",
      fontFamily: "var(--font-body)",
      border: "1px solid var(--border)",
    }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, flexShrink: 0,
        background: "var(--sidebar)",
        borderRight: "1px solid var(--sidebar-border)",
        padding: "20px 14px",
        display: "flex", flexDirection: "column", gap: 4,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px 20px" }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "var(--brand-orange)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2 L22 12 L12 22 L2 12 Z" /></svg>
          </div>
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 20, letterSpacing: "-0.02em" }}>Smartout</span>
        </div>
        {[
          { n: "Hjem", ic: "home", active: true },
          { n: "Vakter", ic: "cal" },
          { n: "Ansatte", ic: "users" },
          { n: "Opplæring", ic: "book" },
          { n: "HMS", ic: "shield" },
          { n: "Innstillinger", ic: "cog" },
        ].map((it, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 12px",
            borderRadius: 8,
            background: it.active ? "var(--sidebar-accent)" : "transparent",
            color: it.active ? "var(--foreground)" : "var(--muted-fg)",
            fontSize: 13, fontWeight: it.active ? 600 : 500,
          }}>
            <span style={{ width: 16, height: 16, borderRadius: 3, background: "var(--secondary)" }} />
            {it.n}
          </div>
        ))}
      </aside>

      {/* Main */}
      <div style={{ flex: 1, padding: 32, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--muted-fg)", fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase" }}>Onsdag 22. april · 2026</div>
            <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 36, fontWeight: 400, margin: "6px 0 0", letterSpacing: "-0.02em" }}>God morgen, Sofia</h1>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button style={{ padding: "8px 14px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--card)", fontSize: 12, fontWeight: 500 }}>Denne uken</button>
            <button style={{ padding: "8px 14px", border: "none", borderRadius: 10, background: "var(--brand-orange)", color: "white", fontSize: 12, fontWeight: 600, boxShadow: "0 2px 8px oklch(0.65 0.22 40 / 0.35)" }}>+ Ny vakt</button>
          </div>
        </div>

        {/* KPI row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginTop: 24 }}>
          {[
            { l: "Vakter i dag", v: "12", s: "3 åpne" },
            { l: "Aktive ansatte", v: "47", s: "+2 denne uken" },
            { l: "Lønn denne uken", v: "184 620", s: "kr" },
            { l: "Uleste varsler", v: "8", s: "2 krever svar" },
          ].map((k, i) => (
            <div key={i} style={{
              position: "relative",
              padding: 18,
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              overflow: "hidden",
            }}>
              <span style={{
                position: "absolute", right: -30, top: -30,
                width: 120, height: 120,
                borderRadius: "50%",
                background: "radial-gradient(circle, oklch(0.65 0.22 40 / 0.15), transparent 70%)",
                filter: "blur(6px)",
              }} />
              <div style={{ fontSize: 10.5, color: "var(--muted-fg)", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" }}>{k.l}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 900, margin: "6px 0 2px", letterSpacing: "-0.02em" }}>{k.v}</div>
              <div style={{ fontSize: 11, color: "var(--muted-fg)" }}>{k.s}</div>
            </div>
          ))}
        </div>

        {/* Shift table */}
        <div style={{ marginTop: 24, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Vakter i dag</span>
            <span style={{ fontSize: 11, color: "var(--muted-fg)" }}>· 12 totalt, 3 åpne</span>
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--muted-fg)", textTransform: "uppercase", letterSpacing: "0.12em", display: "grid", gridTemplateColumns: "140px 1fr 100px 80px 60px", padding: "8px 18px", borderBottom: "1px solid var(--border)" }}>
            <span>Tid</span><span>Ansatt</span><span>Avdeling</span><span>Type</span><span style={{ textAlign: "right" }}>Status</span>
          </div>
          {[
            { t: "07:00 – 15:00", who: "Lars Henriksen", dep: "Kjøkken", kind: "Hovedkokk", st: "ok", depCol: "var(--dept-kitchen)" },
            { t: "09:00 – 17:00", who: "Ida Solberg",    dep: "Servering", kind: "Skift", st: "ok", depCol: "var(--dept-floor)" },
            { t: "11:00 – 19:00", who: "—",               dep: "Bar", kind: "Vikarvakt", st: "open", depCol: "var(--dept-bar)" },
            { t: "15:00 – 23:00", who: "Mikkel Dahl",     dep: "Bar", kind: "Skift", st: "pending", depCol: "var(--dept-bar)" },
            { t: "17:00 – 23:00", who: "Emma Lind",       dep: "Servering", kind: "Deltid", st: "ok", depCol: "var(--dept-floor)" },
          ].map((r, i) => (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "140px 1fr 100px 80px 60px",
              padding: "10px 18px",
              fontSize: 13,
              borderBottom: i < 4 ? "1px solid var(--border)" : "none",
              borderLeft: `3px solid ${r.depCol}`,
              alignItems: "center",
            }}>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>{r.t}</span>
              <span style={{ fontWeight: 500 }}>{r.who}</span>
              <span style={{ color: "var(--muted-fg)" }}>{r.dep}</span>
              <span style={{ color: "var(--muted-fg)", fontSize: 12 }}>{r.kind}</span>
              <span style={{ textAlign: "right" }}>
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                  padding: "3px 8px", borderRadius: 999,
                  background: r.st === "ok" ? "oklch(0.68 0.15 145 / 0.15)" : r.st === "open" ? "oklch(0.60 0.20 25 / 0.15)" : "oklch(0.75 0.15 75 / 0.18)",
                  color: r.st === "ok" ? "var(--success)" : r.st === "open" ? "var(--destructive)" : "var(--warning)",
                }}>{r.st === "ok" ? "bekreftet" : r.st === "open" ? "åpen" : "venter"}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { DashboardMock });
