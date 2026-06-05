// scene-wizard.jsx — Section A: Wizard MVP

// ═══════════════════════════════════════════════════════════════
// ARTBOARD 1 — Hero: chapter 9/10 near-done with inserted blocks
// ═══════════════════════════════════════════════════════════════

const SceneWizardHero = () => (
  <div className="hms" style={{ width: 1440, height: 900 }}>
    <div className="hms-app">
      <HmsTopbar
        extraLeft={
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "color-mix(in oklab, var(--brand-orange) 9%, var(--card))",
            border: "1px solid color-mix(in oklab, var(--brand-orange) 35%, var(--border))",
            borderRadius: 999,
            padding: "5px 10px 5px 6px",
            fontSize: 12, fontWeight: 600,
            color: "var(--brand-orange-dark)",
          }}>
            <span style={{
              width: 18, height: 18, borderRadius: 999,
              background: "var(--brand-orange)", color: "white",
              display: "grid", placeItems: "center",
              fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
            }}>W</span>
            Førstegangs-oppsett (Wizard)
            <span style={{ color: "var(--muted-fg)", fontWeight: 500 }}>· 8/10</span>
          </div>
        }
      />

      <div className="hms-shell">
        <HmsSidebar progress={8} activeKey="emergency-fire" />

        {/* ── Editor canvas ── */}
        <main className="hms-canvas">
          <HmsToolbar status="Auto-lagret · 12 sek siden" />
          <div className="hms-doc-scroll">
            <div className="hms-doc">
              <div className="hms-doc-meta">
                <span className="crumb">Nivå A · Obligatorisk</span>
                <span className="sep">/</span>
                <span className="crumb"><b>9 av 10</b></span>
                <span className="sep">/</span>
                <span className="pill"><Icon name="edit" size={11}/> Pågår</span>
                <span style={{ marginLeft: "auto" }} className="crumb">
                  <Icon name="clock" size={12}/> Neste revisjon: <b style={{ marginLeft: 3 }}>15. nov 2026</b>
                </span>
              </div>

              <h1 className="hms-doc-h1">
                Beredskap, brann og <em>alvorlige hendelser</em>
              </h1>
              <p className="hms-doc-sub">
                Hvordan vi forebygger, varsler og håndterer brann, alvorlige skader
                og andre kritiske hendelser i Bistro Bjørvika.
              </p>

              <div className="hms-doc-byline">
                <span><Icon name="users" size={13}/> Ansvarlig: <div className="av">MK</div> <b>Magnus Krogh</b></span>
                <span><Icon name="calendar" size={13}/> Sist endret: <b>i dag, 14:22</b></span>
                <span><Icon name="branch" size={13}/> Kilde: <b>Manuell</b></span>
              </div>

              <h2 style={{ marginTop: 8 }}>1 · Formål og virkeområde</h2>
              <p>
                Dette kapittelet beskriver Bistro Bjørvikas beredskap for brann og
                alvorlige hendelser i henhold til <b>internkontrollforskriften §5</b>
                og <b>brann- og eksplosjonsvernloven §6, §8</b>. Det gjelder alle
                ansatte, gjester og leverandører som befinner seg i lokalet — inkludert
                kveldsåpning, arrangementer og leveranser utenom åpningstid.
              </p>

              {/* ── Risk table block ── */}
              <h2>2 · Risikovurdering — brann og alvorlige hendelser</h2>
              <div className="tt-block">
                <div className="tt-head">
                  <span className="tt-kind"><Icon name="table" size={12}/> Risikotabell</span>
                  <span className="tt-spacer"/>
                  <button className="tt-handle-btn"><Icon name="plus" size={14}/></button>
                  <button className="tt-handle-btn"><Icon name="more" size={14}/></button>
                </div>
                <div className="tt-body" style={{ padding: 0 }}>
                  <table className="tt-table">
                    <thead>
                      <tr>
                        <th style={{ width: "40%" }}>Risiko</th>
                        <th>Årsak</th>
                        <th style={{ width: 90 }}>Sannsynl.</th>
                        <th style={{ width: 90 }}>Konsekv.</th>
                        <th style={{ width: 100 }}>Vurdering</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="col-risk">
                          <b>Brann i kjøkken</b>
                          <small>Fritereolje, åpen flamme, ventilasjonsfett</small>
                        </td>
                        <td>Manglende rengjøring av avtrekk</td>
                        <td><span className="tt-pill" data-tone="med">Middels</span></td>
                        <td><span className="tt-pill" data-tone="high">Alvorlig</span></td>
                        <td><span className="tt-pill" data-tone="high">Høy</span></td>
                      </tr>
                      <tr>
                        <td className="col-risk">
                          <b>Røyk- eller branntilløp i bar</b>
                          <small>Levende lys, papirdekor</small>
                        </td>
                        <td>Tente lys uten tilsyn</td>
                        <td><span className="tt-pill" data-tone="low">Lav</span></td>
                        <td><span className="tt-pill" data-tone="med">Moderat</span></td>
                        <td><span className="tt-pill" data-tone="med">Middels</span></td>
                      </tr>
                      <tr>
                        <td className="col-risk">
                          <b>Akutt hjertestans — gjest</b>
                          <small>Fullt lokale, kveldsservering</small>
                        </td>
                        <td>Statistisk forekomst</td>
                        <td><span className="tt-pill" data-tone="low">Lav</span></td>
                        <td><span className="tt-pill" data-tone="high">Kritisk</span></td>
                        <td><span className="tt-pill" data-tone="med">Middels</span></td>
                      </tr>
                      <tr>
                        <td className="col-risk">
                          <b>Voldsom hendelse i lokalet</b>
                          <small>Trusler, slagsmål, vinningsforbrytelse</small>
                        </td>
                        <td>Berusede gjester, sen kveld</td>
                        <td><span className="tt-pill" data-tone="low">Lav</span></td>
                        <td><span className="tt-pill" data-tone="high">Alvorlig</span></td>
                        <td><span className="tt-pill" data-tone="med">Middels</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="tt-foot">
                  <Icon name="lock" size={11}/> Kun Tiptap-blokk · ikke aktivert i runtime
                  <span style={{ marginLeft: "auto" }} className="runtime-pill">
                    <Icon name="branch" size={10}/> Sortie 4: kan kobles til cascade
                  </span>
                </div>
              </div>

              {/* ── Responsibility block ── */}
              <h2>3 · Ansvar og roller</h2>
              <div className="tt-block">
                <div className="tt-head">
                  <span className="tt-kind"><Icon name="users" size={12}/> Ansvarsblokk</span>
                  <span className="tt-spacer"/>
                  <button className="tt-handle-btn"><Icon name="edit" size={13}/></button>
                  <button className="tt-handle-btn"><Icon name="more" size={14}/></button>
                </div>
                <div className="tt-body">
                  <div className="tt-resp">
                    <div className="tt-resp-card">
                      <div className="av" style={{ background: "var(--brand-orange)", color: "white" }}>MK</div>
                      <div>
                        <div className="role-label">Brannvernleder</div>
                        <div className="name">Magnus Krogh</div>
                        <div className="scope">Daglig leder · evakueringsansvarlig</div>
                      </div>
                    </div>
                    <div className="tt-resp-card">
                      <div className="av" style={{ background: "var(--brand-purple)", color: "white" }}>AS</div>
                      <div>
                        <div className="role-label">Stedfortreder</div>
                        <div className="name">Aleksandra Sand</div>
                        <div className="scope">Kjøkkensjef</div>
                      </div>
                    </div>
                    <div className="tt-resp-card">
                      <div className="av" style={{ background: "var(--dept-floor)", color: "white" }}>JN</div>
                      <div>
                        <div className="role-label">Førstehjelpsansvarlig</div>
                        <div className="name">Jonas Nilsen</div>
                        <div className="scope">Hovmester · sertifisert</div>
                      </div>
                    </div>
                    <div className="tt-resp-card">
                      <div className="av">+1</div>
                      <div>
                        <div className="role-label">Verneombud</div>
                        <div className="name" style={{ color: "var(--muted-fg)" }}>Ikke valgt</div>
                        <div className="scope">Velg ansatt fra Personal</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Checklist block ── */}
              <h2>4 · Faste rutiner og kontrollpunkter</h2>
              <div className="tt-block">
                <div className="tt-head">
                  <span className="tt-kind"><Icon name="checksquare" size={12}/> Sjekkliste</span>
                  <span className="tt-spacer"/>
                  <button className="tt-handle-btn"><Icon name="plus" size={14}/></button>
                  <button className="tt-handle-btn"><Icon name="more" size={14}/></button>
                </div>
                <div className="tt-body">
                  <div className="tt-checklist">
                    <div className="tt-check" data-done="true">
                      <div className="box"><Icon name="check" size={12} stroke={2.6}/></div>
                      <div>
                        <div className="lbl">Visuell kontroll av brannslukkere og slangeskap</div>
                        <div className="meta">Eier: brannvernleder · siste utført: 12. nov</div>
                      </div>
                      <div className="freq">Månedlig</div>
                    </div>
                    <div className="tt-check" data-done="true">
                      <div className="box"><Icon name="check" size={12} stroke={2.6}/></div>
                      <div>
                        <div className="lbl">Test av røykvarslere og rømningslys</div>
                        <div className="meta">Eier: brannvernleder · siste utført: 12. nov</div>
                      </div>
                      <div className="freq">Månedlig</div>
                    </div>
                    <div className="tt-check" data-done="false">
                      <div className="box"/>
                      <div>
                        <div className="lbl">Evakueringsøvelse — fullt personale</div>
                        <div className="meta">Eier: brannvernleder · neste: planlegges</div>
                      </div>
                      <div className="freq">2× per år</div>
                    </div>
                    <div className="tt-check" data-done="false">
                      <div className="box"/>
                      <div>
                        <div className="lbl">Service og kontroll av ventilasjonsanlegg</div>
                        <div className="meta">Eier: ekstern · neste: planlegges</div>
                      </div>
                      <div className="freq">Årlig</div>
                    </div>
                  </div>
                </div>
                <div className="tt-foot">
                  <Icon name="lock" size={11}/> Lagres som Tiptap-blokk · ingen runtime-rader opprettet ennå
                  <span style={{ marginLeft: "auto" }} className="runtime-pill">
                    <Icon name="play" size={10}/> Aktiver → oppretter <code style={{ fontSize: 10 }}>routine</code> + <code style={{ fontSize: 10 }}>session_task</code>
                  </span>
                </div>
              </div>

              <h2>5 · Varsling og evakuering</h2>
              <p>
                Ved brann eller røykutvikling skal nærmeste ansatt umiddelbart varsle
                gjester, bruke håndslokker dersom det er trygt, og deretter ringe
                <b> 110</b>. Brannvernleder eller stedfortreder leder evakueringen
                til samlingsplassen ved <b>Sørenga utsiktspunkt</b>.
              </p>

              <div className="hms-callout" data-tone="info">
                <span className="ic"><Icon name="sparkles" size={16}/></span>
                <div>
                  <div className="ttl">Mr. Botsson kan hjelpe</div>
                  <div className="txt">Generer forslag til evakueringsplan basert på lokalets plantegning og kapasitet (185 gjester). <a style={{ color: "var(--info)", fontWeight: 600 }}>Generer forslag →</a></div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* ── Right panel: Handling tab (mark-completed CTA visible) ── */}
        <aside className="hms-right">
          <HmsRightTabs active="handling"/>
          <div className="hms-right-body">

            <div className="mark-card">
              <div className="eyebrow">Avslutt kapittel 9 av 10</div>
              <div className="h">Marker kapittel som <em style={{ fontStyle: "italic" }}>ferdig</em>.</div>
              <div className="sub">
                Innhold er lagret. Markering registreres på din bruker og oppdaterer
                wizard-fremdriften.
              </div>
              <div className="acts">
                <button className="btn btn-primary"><Icon name="check" size={15} stroke={2.4}/> Marker ferdig</button>
                <button className="btn btn-ghost btn-sm" style={{ width: "auto" }}><Icon name="eye" size={14}/></button>
              </div>
            </div>

            <div className="hms-right-group">
              <div className="hd">Lagring</div>
              <div className="action-row">
                <span className="ic"><Icon name="save" size={14}/></span>
                <div className="body">
                  <div className="lbl">Lagre utkast</div>
                  <div className="meta">Auto-lagret · sist 12 sek siden</div>
                </div>
                <span className="kbd">⌘S</span>
              </div>
              <div className="action-row">
                <span className="ic"><Icon name="send" size={14}/></span>
                <div className="body">
                  <div className="lbl">Send til revisjon</div>
                  <div className="meta">Setter status: needs_review</div>
                </div>
              </div>
            </div>

            <div className="hms-right-group">
              <div className="hd">Senere — utenfor Sortie 1</div>
              <div className="action-row" style={{ opacity: 0.7 }}>
                <span className="ic"><Icon name="filepdf" size={14}/></span>
                <div className="body">
                  <div className="lbl">Eksporter til PDF<span className="sortie-tag">Sortie 2</span></div>
                  <div className="meta">Render kapittel eller hele håndboken</div>
                </div>
              </div>
              <div className="action-row" style={{ opacity: 0.7 }}>
                <span className="ic"><Icon name="eye" size={14}/></span>
                <div className="body">
                  <div className="lbl">Forhåndsvis som ansatt<span className="sortie-tag">Sortie 2</span></div>
                  <div className="meta">Skjul utkast og innstillinger</div>
                </div>
              </div>
              <div className="action-row" style={{ opacity: 0.7 }}>
                <span className="ic"><Icon name="branch" size={14}/></span>
                <div className="body">
                  <div className="lbl">Aktiver i runtime<span className="sortie-tag">Sortie 4</span></div>
                  <div className="meta">Opprett procedure / routine / framework_rule</div>
                </div>
              </div>
            </div>

          </div>
        </aside>
      </div>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════
// ARTBOARD 2 — Sidebar progress mini-stack (Tweak: 0 / 3 / 7 / 10)
// ═══════════════════════════════════════════════════════════════

const MiniSidebar = ({ progress, activeKey }) => (
  <div className="hms" style={{ width: 280, height: 540, overflow: "hidden" }}>
    <div style={{ display: "grid", gridTemplateRows: "1fr", height: "100%" }}>
      <HmsSidebar progress={progress} activeKey={activeKey} chapters={LEVEL_A.slice(0, 6)}/>
    </div>
  </div>
);

const SceneSidebarStates = () => (
  <div style={{ display: "flex", gap: 24, padding: 24, background: "transparent" }}>
    {[
      { p: 0,  key: "business-legal-hms-goals",   label: "0/10 · førstegang" },
      { p: 3,  key: "risk-assessment-action-plan", label: "3/10 · tidlig" },
      { p: 7,  key: "deviations-incidents",        label: "7/10 · sen fase" },
      { p: 10, key: null,                           label: "10/10 · ferdig" },
    ].map((s) => (
      <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(60,50,40,0.7)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
          {s.label}
        </div>
        <div style={{
          border: "1px solid var(--border)",
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}>
          <MiniSidebar progress={s.p} activeKey={s.key}/>
        </div>
      </div>
    ))}
  </div>
);

// ═══════════════════════════════════════════════════════════════
// ARTBOARD 3 — HMS Dashboard banner (employee view, no redirect)
// ═══════════════════════════════════════════════════════════════

const SceneDashboardBanner = () => (
  <div className="hms" style={{ width: 1280, height: 800 }}>
    <div className="hms-app" style={{ gridTemplateRows: "var(--header-h) 1fr" }}>
      <HmsTopbar/>
      <div style={{ display: "grid", gridTemplateColumns: "var(--side-w) 1fr", overflow: "hidden", minHeight: 0 }}>
        <HmsDashboardSide active="HMS"/>

        <main style={{ overflow: "auto", display: "flex", flexDirection: "column", minWidth: 0 }}>
          <HmsSubNav
            active="Oversikt"
            extra={<span><Icon name="calendar" size={13}/> Tor 28. mai 2026</span>}
          />

          <div style={{ padding: 32, flex: 1 }}>
          {/* SETUP BANNER */}
          <div style={{
            background: "linear-gradient(95deg, var(--panel) 0%, var(--panel-deep) 100%)",
            color: "white",
            borderRadius: 20,
            padding: "22px 26px",
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            gap: 22,
            alignItems: "center",
            position: "relative",
            overflow: "hidden",
            marginBottom: 28,
            boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
          }}>
            {/* ambient orbs */}
            <div style={{ position: "absolute", top: -60, left: 220, width: 280, height: 280, borderRadius: "50%",
              background: "radial-gradient(circle, var(--glow-warm) 0%, transparent 65%)", filter: "blur(20px)", opacity: 0.55, pointerEvents: "none" }}/>
            <div style={{ position: "absolute", bottom: -80, right: 160, width: 220, height: 220, borderRadius: "50%",
              background: "radial-gradient(circle, var(--glow-deep) 0%, transparent 65%)", filter: "blur(28px)", opacity: 0.5, pointerEvents: "none" }}/>

            <div style={{
              width: 64, height: 64, borderRadius: 18,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              display: "grid", placeItems: "center",
              backdropFilter: "blur(20px)",
              position: "relative",
            }}>
              <Icon name="shield" size={28}/>
            </div>

            <div style={{ position: "relative" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--brand-orange-light)", marginBottom: 6 }}>
                HMS-perm under oppsett
              </div>
              <div style={{ fontFamily: "var(--font-heading)", fontSize: 28, lineHeight: 1.1, fontWeight: 400, letterSpacing: "-0.01em", marginBottom: 8 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 800 }}>8</span> av 10 obligatoriske kapitler ferdig
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ flex: 1, maxWidth: 380, height: 8, borderRadius: 999, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                  <div style={{ width: "80%", height: "100%", background: "linear-gradient(90deg, var(--brand-orange) 0%, var(--brand-orange-light) 100%)", borderRadius: 999 }}/>
                </div>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                  Magnus jobber med <b style={{ color: "white", fontWeight: 600 }}>Beredskap og brann</b>
                </span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, position: "relative" }}>
              <button className="btn btn-primary" style={{ width: "auto", whiteSpace: "nowrap" }}>
                <Icon name="book" size={14}/> Åpne håndbok
              </button>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
                Kun admin · du leser
              </div>
            </div>
          </div>

          <div style={{ fontFamily: "var(--font-heading)", fontSize: 36, lineHeight: 1.1, marginBottom: 6, fontWeight: 400, letterSpacing: "-0.02em" }}>
            God morgen, Jonas.
          </div>
          <div style={{ fontSize: 15, color: "var(--muted-fg)", marginBottom: 28 }}>
            Ingen åpne avvik. Tre kontroller å gjøre før lunsj.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {[
              { lbl: "Åpne avvik", kpi: "0", sub: "siste 7 dager", tone: "var(--success)" },
              { lbl: "Kontroller i dag", kpi: "3", sub: "kjøl + frys + ventilasjon", tone: "var(--warning)" },
              { lbl: "Trening forfaller", kpi: "2", sub: "innen 14 dager", tone: "var(--info)" },
              { lbl: "Mattilsynet", kpi: "184d", sub: "siden sist tilsyn", tone: "var(--foreground)" },
            ].map(k => (
              <div key={k.lbl} style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 16,
                padding: 18,
                position: "relative",
                overflow: "hidden",
              }}>
                <div style={{ position: "absolute", top: -40, right: -40, width: 120, height: 120, background: `radial-gradient(circle, ${k.tone} 0%, transparent 70%)`, opacity: 0.15, filter: "blur(8px)" }}/>
                <div className="t-section-label" style={{ marginBottom: 8, position: "relative" }}>{k.lbl}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 36, fontWeight: 900, lineHeight: 1, marginBottom: 4, color: k.tone, position: "relative" }}>{k.kpi}</div>
                <div style={{ fontSize: 12, color: "var(--muted-fg)", position: "relative" }}>{k.sub}</div>
              </div>
            ))}
          </div>
          </div>
        </main>
      </div>
    </div>
  </div>
);

Object.assign(window, { SceneWizardHero, SceneSidebarStates, SceneDashboardBanner });
