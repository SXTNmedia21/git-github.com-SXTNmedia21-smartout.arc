// scene-future.jsx — Sections C/D/E: IK-mat tab, Snapshots, Runtime activation

// ═══════════════════════════════════════════════════════════════
// IK-MAT operational tab (Sortie 3)
// ═══════════════════════════════════════════════════════════════
const SceneIkMat = () => (
  <div className="hms" style={{ width: 1440, height: 920 }}>
    <div className="hms-app">
      <HmsTopbar search="Søk i IK-mat..."/>
      <div style={{ display: "grid", gridTemplateColumns: "var(--side-w) 1fr", overflow: "hidden", minHeight: 0 }}>
        <HmsDashboardSide active="HMS"/>

        <main style={{ overflow: "auto", display: "flex", flexDirection: "column", minWidth: 0 }}>
          <HmsSubNav
            active="IK-mat"
            items={[
              { ic: "grid", lbl: "Oversikt" },
              { ic: "clipboard", lbl: "Drift" },
              { ic: "gradcap", lbl: "Opplæring" },
              { ic: "doc", lbl: "Dokumenter" },
              { ic: "warning-tri", lbl: "Avvik" },
              { ic: "shield", lbl: "Governance" },
              { ic: "thermometer", lbl: "IK-mat" },
            ]}
            extra={<><Icon name="sparkles" size={13} style={{ color: "var(--brand-orange)" }}/> Sortie 3 · ny fane</>}
          />

          <div style={{ padding: "24px 32px 32px", flex: 1 }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 6, gap: 16 }}>
            <div>
              <div className="t-section-label" style={{ marginBottom: 6, color: "var(--brand-orange-dark)" }}>HMS / IK-mat</div>
              <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 42, fontWeight: 400, lineHeight: 1.05, letterSpacing: "-0.02em", margin: 0 }}>
                Mattrygghet, i dag.
              </h1>
              <p style={{ fontSize: 15, color: "var(--muted-fg)", margin: "6px 0 0", maxWidth: "58ch" }}>
                Daglige kontroller, åpne avvik og dokumentasjon klar for Mattilsynet. Reglene leser fra
                kapittelet <a style={{ color: "var(--brand-orange)", fontWeight: 600 }}>IK-mat i håndboken</a>.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-sm" style={{ width: "auto" }}>
                <Icon name="calendar" size={13}/> November 2026
              </button>
              <button className="btn btn-sm btn-primary" style={{ width: "auto" }}>
                <Icon name="filepdf" size={13}/> Mattilsynet-pakke
              </button>
            </div>
          </div>

          {/* KPI strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, margin: "22px 0 26px" }}>
            {[
              { lbl: "Kontroller i dag", kpi: "8 / 11", sub: "3 gjenstår", tone: "var(--warning)" },
              { lbl: "Åpne avvik", kpi: "1", sub: "varegruppe-temperatur", tone: "var(--destructive)" },
              { lbl: "Avvikssnitt 30d", kpi: "0.7", sub: "ned fra 1.2", tone: "var(--success)" },
              { lbl: "HACCP-logg", kpi: "162", sub: "siste 30 dager", tone: "var(--foreground)" },
              { lbl: "Sist tilsyn", kpi: "184d", sub: "13. mai 2026", tone: "var(--info)" },
            ].map(k => (
              <div key={k.lbl} style={{
                background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16,
                padding: 16, position: "relative", overflow: "hidden",
              }}>
                <div style={{ position: "absolute", top: -40, right: -40, width: 120, height: 120, background: `radial-gradient(circle, ${k.tone} 0%, transparent 70%)`, opacity: 0.15, filter: "blur(6px)" }}/>
                <div className="t-section-label" style={{ marginBottom: 8, position: "relative" }}>{k.lbl}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 900, lineHeight: 1, color: k.tone, position: "relative" }}>{k.kpi}</div>
                <div style={{ fontSize: 11, color: "var(--muted-fg)", position: "relative", marginTop: 4 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Main grid: temp logs (big), control lists (med), Mattilsynet (right) */}
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 20 }}>
            {/* Temp logs */}
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Temperaturkontroll</h3>
                <span style={{ fontSize: 12, color: "var(--muted-fg)" }}>haccp_log · siste 24t</span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--muted-fg)", marginBottom: 16 }}>
                Auto-loggføring fra termometer-sensorer + manuelle målinger fra ansatt-app.
              </div>

              {/* Sparkline rows */}
              {[
                { lbl: "Kjøl 1 · Råvarer", target: "2-4 °C", last: "3.1 °C", line: "ok", peak: "" },
                { lbl: "Kjøl 2 · Sjømat", target: "0-2 °C", last: "1.4 °C", line: "ok", peak: "" },
                { lbl: "Frys A", target: "−18 °C", last: "−19.2 °C", line: "ok", peak: "" },
                { lbl: "Varmedisplay buffet", target: "≥ 60 °C", last: "58 °C", line: "warn", peak: "Avvik 12:14 → korrigert" },
              ].map((row, i) => (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "180px 1fr 80px 90px",
                  alignItems: "center", gap: 14,
                  padding: "10px 0",
                  borderTop: i === 0 ? "1px solid var(--border)" : "1px solid var(--border)",
                }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{row.lbl}</div>
                    <div style={{ fontSize: 11, color: "var(--muted-fg)", fontFamily: "var(--font-mono)" }}>Mål: {row.target}</div>
                  </div>
                  <svg viewBox="0 0 200 36" width="100%" height="36" preserveAspectRatio="none" style={{ display: "block" }}>
                    <defs>
                      <linearGradient id={`g${i}`} x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor={row.line === "warn" ? "var(--warning)" : "var(--success)"} stopOpacity="0.3"/>
                        <stop offset="100%" stopColor={row.line === "warn" ? "var(--warning)" : "var(--success)"} stopOpacity="0"/>
                      </linearGradient>
                    </defs>
                    <path
                      d={row.line === "warn"
                        ? "M0,18 L20,16 L40,20 L60,15 L80,12 L100,28 L120,10 L140,8 L160,14 L180,12 L200,16 L200,36 L0,36 Z"
                        : "M0,20 L20,18 L40,21 L60,17 L80,19 L100,16 L120,18 L140,15 L160,17 L180,14 L200,16 L200,36 L0,36 Z"}
                      fill={`url(#g${i})`}
                    />
                    <path
                      d={row.line === "warn"
                        ? "M0,18 L20,16 L40,20 L60,15 L80,12 L100,28 L120,10 L140,8 L160,14 L180,12 L200,16"
                        : "M0,20 L20,18 L40,21 L60,17 L80,19 L100,16 L120,18 L140,15 L160,17 L180,14 L200,16"}
                      fill="none"
                      stroke={row.line === "warn" ? "var(--warning)" : "var(--success)"}
                      strokeWidth="1.5"
                    />
                  </svg>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, textAlign: "right" }}>{row.last}</div>
                  <div style={{ textAlign: "right" }}>
                    <span className="tt-pill" data-tone={row.line === "warn" ? "med" : "low"}>{row.line === "warn" ? "Sjekk" : "OK"}</span>
                  </div>
                </div>
              ))}

              <button className="btn btn-sm" style={{ marginTop: 14, width: "auto" }}>
                <Icon name="plus" size={13}/> Manuell måling
              </button>
            </div>

            {/* Right column: deviations + inspection + control lists */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Open deviation */}
              <div style={{
                background: "var(--card)", border: "1px solid var(--border)",
                borderLeft: "3px solid var(--destructive)",
                borderRadius: 16, padding: 16,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Icon name="alert" size={14} style={{ color: "var(--destructive)" }}/>
                  <span className="t-section-label" style={{ color: "var(--destructive)" }}>Åpent avvik · K-2026-184</span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>Buffet under temperatur</div>
                <div style={{ fontSize: 12.5, color: "var(--muted-fg)", marginBottom: 12 }}>
                  Varmedisplay målt 58 °C kl. 12:14 — under minimum 60 °C i 8 minutter.
                  Berørt: lunsjbuffet, ca. 14 porsjoner.
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                  <span className="tt-pill" data-tone="info"><Icon name="users" size={10}/> Magnus K.</span>
                  <span className="tt-pill" data-tone="med">Pågår</span>
                  <span className="tt-pill" data-tone="info">framework: ik-mat</span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-sm" style={{ flex: 1 }}>Se detaljer</button>
                  <button className="btn btn-sm btn-primary" style={{ flex: 1 }}><Icon name="check" size={12}/> Lukk</button>
                </div>
              </div>

              {/* Control lists */}
              <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 16 }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>Dagens sjekklister</h3>
                {[
                  { lbl: "Mottakskontroll", who: "Aleksandra · 09:12", done: true },
                  { lbl: "Kjøl- og frystemperatur", who: "Auto · hver 30 min", done: true },
                  { lbl: "Allergen-merking buffet", who: "Magnus · 11:40", done: true },
                  { lbl: "Vasker og diskmaskin", who: "Lukk kveld", done: false },
                  { lbl: "Avfall · fettutskiller", who: "Kveldsskift", done: false },
                ].map((c, i) => (
                  <div key={i} style={{
                    display: "grid", gridTemplateColumns: "20px 1fr auto", gap: 10, alignItems: "center",
                    padding: "8px 0",
                    borderTop: i === 0 ? "none" : "1px solid var(--border)",
                  }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: 5,
                      border: c.done ? "1.5px solid var(--success)" : "1.5px solid var(--border)",
                      background: c.done ? "var(--success)" : "transparent",
                      display: "grid", placeItems: "center", color: "white",
                    }}>{c.done && <Icon name="check" size={11} stroke={3}/>}</div>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: c.done ? "var(--muted-fg)" : "var(--foreground)", textDecoration: c.done ? "line-through" : "none" }}>{c.lbl}</div>
                      <div style={{ fontSize: 11, color: "var(--muted-fg)" }}>{c.who}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Mattilsynet pack */}
              <div style={{
                background: "linear-gradient(180deg, var(--panel) 0%, var(--panel-deep) 100%)",
                color: "white",
                borderRadius: 16,
                padding: 18,
                position: "relative",
                overflow: "hidden",
              }}>
                <div style={{ position: "absolute", inset: "auto -60px -60px auto", width: 200, height: 200, background: "radial-gradient(circle, var(--glow-warm) 0%, transparent 65%)", filter: "blur(20px)", opacity: 0.5 }}/>
                <div style={{ position: "relative" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--brand-orange-light)", marginBottom: 6 }}>
                    Mattilsynet-pakke
                  </div>
                  <div style={{ fontFamily: "var(--font-heading)", fontSize: 22, lineHeight: 1.15, marginBottom: 8 }}>
                    Klar for tilsyn på <em style={{ fontStyle: "italic" }}>30 sek.</em>
                  </div>
                  <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.65)", marginBottom: 14 }}>
                    Genererer PDF-pakke: IK-mat-kapittel + siste 6 mnd. HACCP-logg + 30 dager avvik + bevillinger.
                  </div>
                  <button className="btn" style={{ background: "var(--brand-orange)", border: "none", color: "white", boxShadow: "var(--shadow-brand-glow)" }}>
                    <Icon name="filepdf" size={14}/> Generer pakke (3.4 MB)
                  </button>
                </div>
              </div>
            </div>
          </div>
          </div>
        </main>
      </div>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════
// Print / PDF preview + snapshot history (Sortie 2)
// ═══════════════════════════════════════════════════════════════

const PdfPreview = () => (
  <div style={{
    width: 460, height: 600,
    background: "white",
    border: "1px solid var(--border)",
    borderRadius: 4,
    boxShadow: "0 18px 50px rgba(0,0,0,0.15), 0 2px 6px rgba(0,0,0,0.08)",
    padding: "48px 56px",
    position: "relative",
    overflow: "hidden",
    fontFamily: "var(--font-body)",
  }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32, paddingBottom: 12, borderBottom: "1px solid #e5e5e5" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <LogoMark size={20}/>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#666" }}>Bistro Bjørvika · HMS-håndbok</span>
      </div>
      <div style={{ fontSize: 10, color: "#999", fontFamily: "var(--font-mono)" }}>v3.2 · 28. mai 2026</div>
    </div>

    <div style={{ fontSize: 10, color: "#888", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 6 }}>Kapittel 9 av 10</div>
    <div style={{ fontFamily: "var(--font-heading)", fontSize: 30, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 12 }}>
      Beredskap, brann og <em style={{ fontStyle: "italic" }}>alvorlige hendelser</em>
    </div>
    <div style={{ fontSize: 11, color: "#555", borderTop: "1px solid #e5e5e5", borderBottom: "1px solid #e5e5e5", padding: "8px 0", marginBottom: 20, display: "flex", gap: 18 }}>
      <span>Ansvarlig: <b>Magnus Krogh</b></span>
      <span>Sist revidert: <b>12. okt 2026</b></span>
      <span>Neste: <b>15. nov 2026</b></span>
    </div>

    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>1 · Formål og virkeområde</div>
    <div style={{ fontSize: 10.5, lineHeight: 1.55, color: "#333", marginBottom: 12 }}>
      Dette kapittelet beskriver Bistro Bjørvikas beredskap for brann og alvorlige hendelser i henhold til
      internkontrollforskriften §5 og brann- og eksplosjonsvernloven §6, §8.
    </div>

    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>2 · Risikovurdering</div>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9.5, marginBottom: 14 }}>
      <thead>
        <tr style={{ background: "#f7f5ef" }}>
          <th style={{ textAlign: "left", padding: "5px 6px", fontWeight: 700, color: "#444" }}>Risiko</th>
          <th style={{ textAlign: "left", padding: "5px 6px", fontWeight: 700, color: "#444" }}>S</th>
          <th style={{ textAlign: "left", padding: "5px 6px", fontWeight: 700, color: "#444" }}>K</th>
          <th style={{ textAlign: "left", padding: "5px 6px", fontWeight: 700, color: "#444" }}>Vurdering</th>
        </tr>
      </thead>
      <tbody>
        {[
          ["Brann i kjøkken", "M", "A", "Høy"],
          ["Røyk-/branntilløp i bar", "L", "M", "Middels"],
          ["Akutt hjertestans gjest", "L", "K", "Middels"],
        ].map((r, i) => (
          <tr key={i} style={{ borderTop: "1px solid #eee" }}>
            {r.map((c, j) => <td key={j} style={{ padding: "5px 6px", color: "#333" }}>{c}</td>)}
          </tr>
        ))}
      </tbody>
    </table>

    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>3 · Ansvar og roller</div>
    <div style={{ fontSize: 10.5, lineHeight: 1.55, color: "#333" }}>
      <b>Brannvernleder:</b> Magnus Krogh (daglig leder, evakueringsansvarlig)<br/>
      <b>Stedfortreder:</b> Aleksandra Sand (kjøkkensjef)<br/>
      <b>Førstehjelpsansvarlig:</b> Jonas Nilsen (hovmester, sertifisert)
    </div>

    {/* footer */}
    <div style={{ position: "absolute", bottom: 24, left: 56, right: 56, paddingTop: 8, borderTop: "1px solid #e5e5e5", display: "flex", justifyContent: "space-between", fontSize: 9, color: "#999" }}>
      <span>Bistro Bjørvika AS · org. 998 765 432</span>
      <span>Side 24 av 38</span>
    </div>
  </div>
);

const ScenePrint = () => (
  <div className="hms" style={{ width: 1280, height: 760 }}>
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 340px",
      height: "100%",
      background: "var(--secondary)",
    }}>
      {/* Print preview area */}
      <div style={{
        display: "grid",
        placeItems: "center",
        padding: 32,
        position: "relative",
        background: "radial-gradient(circle at 30% 20%, color-mix(in oklab, var(--brand-orange) 6%, var(--secondary)) 0%, var(--secondary) 60%)",
      }}>
        {/* Toolbar */}
        <div style={{
          position: "absolute", top: 16, left: 16, right: 16,
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "8px 12px",
          display: "flex", alignItems: "center", gap: 8,
          boxShadow: "var(--shadow-sm)",
        }}>
          <button className="hms-iconbtn"><Icon name="chev-left" size={14}/></button>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Forhåndsvisning · Beredskap og brann</span>
          <span style={{ fontSize: 11, color: "var(--muted-fg)" }}>side 24 av 38</span>
          <div style={{ flex: 1 }}/>
          <button className="hms-iconbtn"><Icon name="x" size={14}/></button>
          <span style={{ fontSize: 11, color: "var(--muted-fg)", fontFamily: "var(--font-mono)" }}>100%</span>
          <button className="hms-iconbtn"><Icon name="plus" size={14}/></button>
        </div>
        <PdfPreview/>
      </div>

      {/* Right side: export / snapshots */}
      <aside style={{ background: "var(--sidebar)", borderLeft: "1px solid var(--sidebar-border)", padding: 18, overflow: "auto" }}>

        <div style={{ marginBottom: 16 }}>
          <div className="t-section-label" style={{ marginBottom: 4 }}>Sortie 2 · Eksport</div>
          <div style={{ fontFamily: "var(--font-heading)", fontSize: 24, lineHeight: 1.15, letterSpacing: "-0.01em" }}>
            Snapshot &amp; print
          </div>
          <div style={{ fontSize: 12, color: "var(--muted-fg)", marginTop: 4 }}>
            Render én gang, signer, arkiver. Lagres i <code style={{ fontSize: 11 }}>hms_document_snapshot</code>.
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
          {[
            { lbl: "Hele håndboken", sub: "Alle Nivå A · 38 sider", primary: true },
            { lbl: "Kun dette kapittelet", sub: "3 sider · 412 KB" },
            { lbl: "IK-mat-seksjon", sub: "Kap. 5 + Kap. 6 + 90d HACCP-logg" },
          ].map((o, i) => (
            <button key={o.lbl} className={`btn ${o.primary ? "btn-primary" : ""}`} style={{
              height: "auto", padding: "10px 12px", justifyContent: "flex-start",
              flexDirection: "column", alignItems: "flex-start", gap: 2,
            }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                <Icon name="filepdf" size={14}/> {o.lbl}
              </span>
              <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.8 }}>{o.sub}</span>
            </button>
          ))}
        </div>

        <div className="t-section-label" style={{ marginBottom: 8 }}>Versjonshistorikk</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 0, borderLeft: "1.5px solid var(--border)", marginLeft: 8, paddingLeft: 16 }}>
          {[
            { ver: "v3.2", date: "i dag, 14:22", who: "Magnus K.", note: "Endret evakueringsrute", current: true },
            { ver: "v3.1", date: "12. okt 2026", who: "Aleksandra S.", note: "Lagt til hjertestarter-rutine" },
            { ver: "v3.0", date: "01. okt 2026", who: "Magnus K.", note: "Halvårlig revisjon — signert" },
            { ver: "v2.4", date: "13. mai 2026", who: "Magnus K.", note: "Lukket Mattilsynet-tilsyn" },
            { ver: "v2.3", date: "02. apr 2026", who: "Magnus K.", note: "Onboarding-rev" },
          ].map((s, i) => (
            <div key={s.ver} style={{ position: "relative", paddingBottom: 14 }}>
              <div style={{
                position: "absolute", left: -23, top: 3,
                width: 10, height: 10, borderRadius: "50%",
                background: s.current ? "var(--brand-orange)" : "var(--card)",
                border: `2px solid ${s.current ? "var(--brand-orange)" : "var(--border)"}`,
                boxShadow: s.current ? "var(--shadow-brand-glow)" : "none",
              }}/>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700 }}>{s.ver}</span>
                <span style={{ fontSize: 11, color: "var(--muted-fg)" }}>{s.date}</span>
              </div>
              <div style={{ fontSize: 12, marginTop: 1 }}>{s.note}</div>
              <div style={{ fontSize: 11, color: "var(--muted-fg)" }}>av {s.who}</div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════
// Runtime activation modal (Sortie 4)
// ═══════════════════════════════════════════════════════════════
const SceneRuntimeActivation = () => (
  <div className="hms" style={{ width: 1100, height: 720, position: "relative", overflow: "hidden" }}>
    {/* dim background of editor */}
    <div style={{
      position: "absolute", inset: 0,
      background: "var(--background)",
    }}>
      {/* shadow of doc behind */}
      <div style={{
        position: "absolute", inset: "60px 60px 60px 60px",
        background: "var(--card)", borderRadius: 12, border: "1px solid var(--border)",
        opacity: 0.5,
      }}>
        <div style={{ padding: 40 }}>
          <div style={{ fontFamily: "var(--font-heading)", fontSize: 32, opacity: 0.4 }}>Beredskap, brann og alvorlige hendelser</div>
          <div style={{ height: 8, background: "var(--secondary)", marginTop: 24, borderRadius: 4, width: "60%" }}/>
          <div style={{ height: 8, background: "var(--secondary)", marginTop: 12, borderRadius: 4, width: "80%" }}/>
          <div style={{ height: 8, background: "var(--secondary)", marginTop: 12, borderRadius: 4, width: "70%" }}/>
        </div>
      </div>
      <div style={{ position: "absolute", inset: 0, background: "rgba(20,15,10,0.55)", backdropFilter: "blur(2px)" }}/>
    </div>

    {/* Modal */}
    <div style={{
      position: "absolute",
      top: "50%", left: "50%",
      transform: "translate(-50%, -50%)",
      width: 720,
      background: "var(--card)",
      borderRadius: 20,
      boxShadow: "0 30px 80px rgba(0,0,0,0.35), 0 4px 12px rgba(0,0,0,0.15)",
      border: "1px solid var(--border)",
      overflow: "hidden",
    }}>
      {/* header */}
      <div style={{
        padding: "20px 24px 18px",
        background: "linear-gradient(180deg, color-mix(in oklab, var(--brand-orange) 8%, var(--card)) 0%, var(--card) 100%)",
        borderBottom: "1px solid var(--border)",
        position: "relative",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{
            width: 28, height: 28, borderRadius: 8,
            background: "var(--brand-orange)", color: "white",
            display: "grid", placeItems: "center",
            boxShadow: "var(--shadow-brand-glow)",
          }}><Icon name="branch" size={16}/></span>
          <div className="t-section-label" style={{ color: "var(--brand-orange-dark)" }}>Sortie 4 · C4 capability required</div>
        </div>
        <div style={{ fontFamily: "var(--font-heading)", fontSize: 28, lineHeight: 1.1, letterSpacing: "-0.01em" }}>
          Aktiver i runtime?
        </div>
        <div style={{ fontSize: 13.5, color: "var(--muted-fg)", marginTop: 4 }}>
          Oppretter governance-rader fra dette kapittelet. Reverserbart, men varsler alle koblede ansatte.
        </div>
        <button className="hms-iconbtn" style={{ position: "absolute", top: 14, right: 14 }}><Icon name="x" size={16}/></button>
      </div>

      {/* body */}
      <div style={{ padding: "20px 24px" }}>
        <div className="t-section-label" style={{ marginBottom: 10 }}>Følgende rader opprettes</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { tbl: "procedure", cnt: 1, lbl: "Evakueringsprosedyre", mod: "framework: emergency" },
            { tbl: "routine", cnt: 4, lbl: "Brannslukker · evakuering · ventilasjon · førstehjelp", mod: "fra sjekkliste-blokk" },
            { tbl: "framework_rule", cnt: 2, lbl: "Min. temp. varmedisplay 60 °C · evakuering 2×/år", mod: "fra risikotabell" },
            { tbl: "session_task", cnt: 0, lbl: "Planlegges av runtime", mod: "kveldsskift · åpningsrutine", soft: true },
          ].map(o => (
            <div key={o.tbl} style={{
              padding: 12,
              border: "1px solid var(--border)",
              background: "var(--card)",
              borderRadius: 12,
              opacity: o.soft ? 0.7 : 1,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <code style={{ fontFamily: "var(--font-mono)", fontSize: 11, background: "var(--secondary)", padding: "2px 6px", borderRadius: 4 }}>{o.tbl}</code>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 800, color: "var(--brand-orange)" }}>×{o.cnt}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{o.lbl}</div>
              <div style={{ fontSize: 11, color: "var(--muted-fg)" }}>{o.mod}</div>
            </div>
          ))}
        </div>

        <div className="hms-callout" data-tone="warning" style={{ marginTop: 18 }}>
          <span className="ic"><Icon name="warning-tri" size={15}/></span>
          <div>
            <div className="ttl">Cross-campaign collision check</div>
            <div className="txt">Disse radene blir synlige i <b>Drift</b> (dagslinje) og <b>Avvik</b>. Verifisér at de ikke duplikerer eksisterende rutiner før aktivering.</div>
          </div>
        </div>

        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginTop: 18, gap: 12,
        }}>
          <label style={{ fontSize: 12, color: "var(--muted-fg)", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" style={{ accentColor: "var(--brand-orange)" }} defaultChecked/>
            Lås innhold for redigering etter aktivering
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-sm" style={{ width: "auto" }}>Avbryt</button>
            <button className="btn btn-sm btn-primary" style={{ width: "auto" }}>
              <Icon name="play" size={12}/> Aktiver (7 rader)
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

Object.assign(window, { SceneIkMat, ScenePrint, SceneRuntimeActivation });
