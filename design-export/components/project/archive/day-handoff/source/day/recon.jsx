// Reconciliation list + detail — admin perspective on the week
// Uses WEEK_GRID and RECON_LIST from DATA

const RECON_STATUS = {
  active:          { label: "Pågår",     fg: "#0a7a22", bg: "rgba(17,173,50,0.1)" },
  pending_signoff: { label: "Venter",    fg: "#8a5d00", bg: "rgba(193,130,0,0.12)" },
  closed:          { label: "Stengt",    fg: "#595550", bg: "#ece9e3" },
  locked:          { label: "Låst",      fg: "#c2410c", bg: "rgba(249,115,22,0.1)" },
  missed:          { label: "Ikke åpnet",fg: "#9a000a", bg: "rgba(231,0,11,0.1)" },
  upcoming:        { label: "Kommer",    fg: "#595550", bg: "#ece9e3" },
};

function ReconList({ onSelect }) {
  const counts = DATA.RECON_LIST.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
  return (
    <div style={{ background: SO.secondary, padding: 24, minHeight: "100%" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: SO.muted, marginBottom: 6 }}>Avstemming · Pontus Sjögren</div>
          <div style={{ fontFamily: "Instrument Serif, serif", fontSize: 40, letterSpacing: "-0.02em", lineHeight: 1.02 }}>
            Uke 17 — 13.–19. april
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {[
            { label: "Venter oppgjør", value: counts.pending_signoff || 0, color: SO.warning },
            { label: "Klar til å låse", value: counts.closed || 0, color: SO.info },
            { label: "Avvik denne uka", value: 2, color: SO.error },
          ].map(c => (
            <div key={c.label} style={{ padding: "10px 16px", background: SO.bg, border: `1px solid ${SO.border}`, borderRadius: 12, minWidth: 140 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: SO.muted, letterSpacing: "0.12em", textTransform: "uppercase" }}>{c.label}</div>
              <div style={{ fontFamily: "Geist Mono, monospace", fontSize: 22, fontWeight: 800, color: c.color, marginTop: 4 }}>{c.value}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background: SO.bg, border: `1px solid ${SO.border}`, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "100px 120px 1fr 160px 140px 160px", padding: "12px 18px", fontSize: 10, fontWeight: 600, color: SO.muted, letterSpacing: "0.14em", textTransform: "uppercase", background: SO.secondary, borderBottom: `1px solid ${SO.border}` }}>
          <span>Dato</span><span>Avdeling</span><span>Omsetning</span><span>Labor %</span><span>Status</span><span></span>
        </div>
        {DATA.RECON_LIST.map((r, i) => {
          const s = RECON_STATUS[r.status];
          const pending = r.status === "pending_signoff";
          return (
            <div key={i} onClick={() => pending && onSelect && onSelect(r)} style={{ display: "grid", gridTemplateColumns: "100px 120px 1fr 160px 140px 160px", padding: "14px 18px", fontSize: 13, alignItems: "center", borderBottom: `1px solid ${SO.border}`, cursor: pending ? "pointer" : "default", background: pending ? "rgba(193,130,0,0.04)" : "transparent" }}>
              <span style={{ fontFamily: "Geist Mono, monospace", fontWeight: 600 }}>{r.date}</span>
              <span>{r.dept}</span>
              <span style={{ fontFamily: "Geist Mono, monospace", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                {r.revenue ? `${r.revenue.toLocaleString("no-NO")} kr` : <span style={{ color: SO.muted, fontWeight: 400 }}>—</span>}
              </span>
              <span style={{ fontFamily: "Geist Mono, monospace", color: r.laborPct && r.laborPct > 18 ? SO.warning : SO.fg, fontVariantNumeric: "tabular-nums" }}>
                {r.laborPct ? `${r.laborPct.toFixed(1)}%` : <span style={{ color: SO.muted }}>—</span>}
              </span>
              <span style={{ display: "inline-flex", padding: "3px 10px", borderRadius: 9999, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: s.fg, background: s.bg, width: "fit-content" }}>
                {s.label}
              </span>
              <span style={{ textAlign: "right" }}>
                {pending && <span style={{ fontSize: 12, color: SO.orange, fontWeight: 600 }}>Gjennomgå →</span>}
                {r.status === "closed" && <span style={{ fontSize: 12, color: SO.muted }}>Lås →</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReconDetail({ onClose }) {
  return (
    <div style={{ background: SO.secondary, padding: 24, minHeight: "100%" }}>
      <button onClick={onClose} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, border: `1px solid ${SO.border}`, background: SO.bg, fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 18 }}>
        <Icon name="arrowleft" size={14} /> Tilbake til uke-oversikt
      </button>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20 }}>
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: SO.muted, marginBottom: 6 }}>Admin-gjennomgang</div>
            <div style={{ fontFamily: "Instrument Serif, serif", fontSize: 36, letterSpacing: "-0.02em", lineHeight: 1.02 }}>Lørdag 18. april · Kjøkken</div>
            <div style={{ fontSize: 13, color: SO.muted, marginTop: 4 }}>Sendt av Marcus Lien · 23:47 · 45 min ventetid</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[
              { label: "Omsetning",  value: "91 200 kr", delta: "+8.6% mot mål",  dir: "up" },
              { label: "Arbeidstid", value: "41.8 t",    delta: "−1.2t plan",     dir: "up" },
              { label: "Lønn",       value: "11 950 kr", delta: "13.1%",           dir: "up" },
              { label: "Margin",     value: "+4.1%",     delta: "innenfor mål",    dir: "up" },
            ].map(t => (
              <div key={t.label} style={{ padding: 14, background: SO.bg, border: `1px solid ${SO.border}`, borderRadius: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: SO.muted, letterSpacing: "0.12em", textTransform: "uppercase" }}>{t.label}</div>
                <div style={{ fontFamily: "Geist Mono, monospace", fontSize: 18, fontWeight: 700, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{t.value}</div>
                <div style={{ fontSize: 11, color: SO.success, marginTop: 2, fontWeight: 500 }}>↗ {t.delta}</div>
              </div>
            ))}
          </div>

          <div style={{ background: SO.bg, border: `1px solid ${SO.border}`, borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Bemanning — faktisk vs planlagt</div>
            <div style={{ display: "grid", gap: 8 }}>
              {DATA.SHIFTS.slice(0, 5).map(s => {
                const varPct = s.planned ? ((s.actual - s.planned) / s.planned) * 100 : 0;
                return (
                  <div key={s.id} style={{ display: "grid", gridTemplateColumns: "140px 1fr 80px 80px 80px", padding: "8px 0", fontSize: 12, alignItems: "center", borderBottom: `1px solid ${SO.border}` }}>
                    <span>{s.name}</span>
                    <span style={{ fontSize: 11, color: SO.muted }}>{s.role}</span>
                    <span style={{ fontFamily: "Geist Mono, monospace", color: SO.muted, textAlign: "right" }}>{s.planned.toFixed(1)}t</span>
                    <span style={{ fontFamily: "Geist Mono, monospace", fontWeight: 600, textAlign: "right" }}>{s.actual.toFixed(1)}t</span>
                    <span style={{ fontFamily: "Geist Mono, monospace", textAlign: "right", color: Math.abs(varPct) < 5 ? SO.success : SO.warning, fontWeight: 500 }}>
                      {varPct > 0 ? "+" : ""}{varPct.toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ background: SO.bg, border: `1px solid ${SO.border}`, borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Oppgaver & compliance</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div><div style={{ fontSize: 10, color: SO.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>Ferdig</div><div style={{ fontFamily: "Geist Mono, monospace", fontSize: 20, fontWeight: 700, marginTop: 4 }}>25/25</div><div style={{ fontSize: 11, color: SO.success, marginTop: 2 }}>100%</div></div>
              <div><div style={{ fontSize: 10, color: SO.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>Compliance</div><div style={{ fontFamily: "Geist Mono, monospace", fontSize: 20, fontWeight: 700, marginTop: 4 }}>6/6</div><div style={{ fontSize: 11, color: SO.success, marginTop: 2 }}>Alle evidence OK</div></div>
              <div><div style={{ fontSize: 10, color: SO.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>Avvik</div><div style={{ fontFamily: "Geist Mono, monospace", fontSize: 20, fontWeight: 700, marginTop: 4 }}>0</div><div style={{ fontSize: 11, color: SO.muted, marginTop: 2 }}>Ingen åpne</div></div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
          <div style={{ background: SO.bg, border: `1px solid ${SO.border}`, borderRadius: 16, padding: 20, position: "sticky", top: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: SO.warning, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>Venter godkjenning</div>
            <div style={{ fontFamily: "Instrument Serif, serif", fontSize: 22, marginBottom: 14 }}>Lås dagen?</div>
            <div style={{ fontSize: 12, color: SO.muted, lineHeight: 1.5, marginBottom: 14 }}>
              Når dagen låses blir timer overført til lønn, og tall frosne for rapport. Kan åpnes igjen av admin.
            </div>
            <button style={{ width: "100%", height: 44, borderRadius: 10, border: "none", background: SO.orange, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 10px rgba(249,115,22,0.25)" }}>Godkjenn og lås</button>
            <button style={{ width: "100%", marginTop: 8, height: 40, borderRadius: 10, border: `1px solid ${SO.border}`, background: SO.bg, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Spør leder om revisjon</button>
          </div>

          <div style={{ background: SO.bg, border: `1px solid ${SO.border}`, borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: SO.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>Notat fra leder</div>
            <div style={{ fontSize: 12, lineHeight: 1.5, color: SO.fg, fontStyle: "italic" }}>
              "Rolig lørdag, men mye lunsjtrafikk. Kjølerom ble fikset 13:45. Cecilie tok en ekstra vakt — bør reflekteres i timene."
            </div>
            <div style={{ fontSize: 11, color: SO.muted, marginTop: 8 }}>— Marcus Lien</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReconView() {
  const [selected, setSelected] = React.useState(null);
  return selected ? <ReconDetail onClose={() => setSelected(null)} /> : <ReconList onSelect={setSelected} />;
}

Object.assign(window, { ReconList, ReconDetail, ReconView });
