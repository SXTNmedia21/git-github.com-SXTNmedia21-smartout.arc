// scene-panels.jsx — Section B: Right panel deep-dives (per tab)

const PanelFrame = ({ children, height = 720 }) => (
  <div className="hms" style={{ width: 340, height }}>
    <aside className="hms-right" style={{ height: "100%", borderLeft: "1px solid var(--sidebar-border)", borderRight: "1px solid var(--sidebar-border)" }}>
      {children}
    </aside>
  </div>
);

// ── Verktøy: insert blocks ──────────────────────────────────────
const PanelVerktoy = () => (
  <PanelFrame>
    <HmsRightTabs active="verktoy"/>
    <div className="hms-right-body">

      <div className="hms-right-group">
        <div className="hd">Sett inn blokk</div>
        <div className="hms-insert-grid">
          <button className="hms-insert-btn">
            <div className="ic"><Icon name="checksquare" size={15}/></div>
            <div className="lbl">Sjekkliste</div>
            <div className="meta">Daglige · ukentlige kontroller</div>
          </button>
          <button className="hms-insert-btn">
            <div className="ic"><Icon name="table" size={15}/></div>
            <div className="lbl">Risikotabell</div>
            <div className="meta">Sannsynl. × konsekvens</div>
          </button>
          <button className="hms-insert-btn">
            <div className="ic"><Icon name="users" size={15}/></div>
            <div className="lbl">Ansvarsblokk</div>
            <div className="meta">Roller fra Personal</div>
          </button>
          <button className="hms-insert-btn">
            <div className="ic"><Icon name="list" size={15}/></div>
            <div className="lbl">Rutineliste</div>
            <div className="meta">Frekvens · eier · neste</div>
          </button>
          <button className="hms-insert-btn">
            <div className="ic"><Icon name="thermometer" size={15}/></div>
            <div className="lbl">Kontrollskjema</div>
            <div className="meta">Temp · måling · signering</div>
          </button>
          <button className="hms-insert-btn">
            <div className="ic"><Icon name="file" size={15}/></div>
            <div className="lbl">Mal-snutt</div>
            <div className="meta">Fra Smartout-bibliotek</div>
          </button>
        </div>
      </div>

      <div className="hms-callout" data-tone="info">
        <span className="ic"><Icon name="sparkles" size={14}/></span>
        <div>
          <div className="ttl">Botsson kan foreslå</div>
          <div className="txt">Basert på kapittel <b>Beredskap og brann</b> — generer 4 sjekklistepunkter for evakuering.</div>
          <button className="btn btn-sm btn-primary" style={{ width: "auto", marginTop: 8 }}>
            <Icon name="sparkles" size={12}/> Generer forslag
          </button>
        </div>
      </div>

      <div className="hms-right-group">
        <div className="hd">Statistikk</div>
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
        }}>
          {[
            { lbl: "ord", kpi: "1 248" },
            { lbl: "kontrollpunkter", kpi: "12" },
            { lbl: "ansvarlige roller", kpi: "3" },
            { lbl: "vedlegg", kpi: "0" },
          ].map(s => (
            <div key={s.lbl} style={{
              border: "1px solid var(--border)",
              background: "var(--card)",
              padding: "10px 12px",
              borderRadius: 12,
            }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{s.kpi}</div>
              <div style={{ fontSize: 11, color: "var(--muted-fg)", marginTop: 4 }}>{s.lbl}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </PanelFrame>
);

// ── Handling: full action menu (Sortie 1-4 evolution) ───────────
const PanelHandling = () => (
  <PanelFrame>
    <HmsRightTabs active="handling"/>
    <div className="hms-right-body">

      <div className="mark-card">
        <div className="eyebrow">Avslutt kapittel</div>
        <div className="h">Marker som <em style={{ fontStyle: "italic" }}>ferdig</em>.</div>
        <div className="sub">Oppdaterer wizard-fremdriften til 9 av 10. Idempotent — kan reverseres til revisjon.</div>
        <div className="acts">
          <button className="btn btn-primary"><Icon name="check" size={14} stroke={2.4}/> Marker ferdig</button>
        </div>
      </div>

      <div className="hms-right-group">
        <div className="hd">Sortie 1 · Tilgjengelig nå</div>
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
            <div className="meta">Setter status: needs_review · varsler reviewer</div>
          </div>
        </div>
      </div>

      <div className="hms-right-group">
        <div className="hd">Sortie 2 · Snart</div>
        <div className="action-row" style={{ opacity: 0.7 }}>
          <span className="ic"><Icon name="filepdf" size={14}/></span>
          <div className="body">
            <div className="lbl">Eksporter til PDF<span className="sortie-tag">S2</span></div>
            <div className="meta">Edge function · render snapshot</div>
          </div>
        </div>
        <div className="action-row" style={{ opacity: 0.7 }}>
          <span className="ic"><Icon name="eye" size={14}/></span>
          <div className="body">
            <div className="lbl">Forhåndsvis som ansatt<span className="sortie-tag">S2</span></div>
            <div className="meta">Skjul utkast og admin-felter</div>
          </div>
        </div>
        <div className="action-row" style={{ opacity: 0.7 }}>
          <span className="ic"><Icon name="history" size={14}/></span>
          <div className="body">
            <div className="lbl">Snapshot-historikk<span className="sortie-tag">S2</span></div>
            <div className="meta">3 versjoner · sist 12. okt 2026</div>
          </div>
        </div>
      </div>

      <div className="hms-right-group">
        <div className="hd">Sortie 4 · Gated bak C4</div>
        <div className="action-row" style={{ opacity: 0.7 }}>
          <span className="ic"><Icon name="branch" size={14}/></span>
          <div className="body">
            <div className="lbl">Aktiver i runtime<span className="sortie-tag">S4</span></div>
            <div className="meta">Oppretter <code style={{ fontSize: 10 }}>procedure</code>, <code style={{ fontSize: 10 }}>routine</code>, <code style={{ fontSize: 10 }}>framework_rule</code></div>
          </div>
        </div>
      </div>
    </div>
  </PanelFrame>
);

// ── Innstillinger ──────────────────────────────────────────────
const PanelInnstillinger = () => (
  <PanelFrame>
    <HmsRightTabs active="innst"/>
    <div className="hms-right-body">

      <div className="hms-right-group">
        <div className="hd">Eierskap</div>
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "4px 14px" }}>
          <div className="setting-row">
            <div className="top">
              <div className="lbl">Ansvarlig</div>
              <div className="val"><span className="av-sm">MK</span> Magnus Krogh <Icon name="chev-down" size={12}/></div>
            </div>
            <div className="hint">Daglig leder · sett ved opprettelse</div>
          </div>
          <div className="setting-row">
            <div className="top">
              <div className="lbl">Reviewer</div>
              <div className="val"><span className="av-sm" style={{ background: "var(--dept-floor)" }}>AS</span> Aleksandra Sand <Icon name="chev-down" size={12}/></div>
            </div>
            <div className="hint">Kjøkkensjef · godkjenner endringer</div>
          </div>
          <div className="setting-row">
            <div className="top">
              <div className="lbl">Verneombud</div>
              <div className="val" style={{ color: "var(--muted-fg)" }}>Ikke valgt <Icon name="chev-down" size={12}/></div>
            </div>
            <div className="hint">Anbefales for kapittel om beredskap</div>
          </div>
        </div>
      </div>

      <div className="hms-right-group">
        <div className="hd">Revisjon</div>
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "4px 14px" }}>
          <div className="setting-row">
            <div className="top">
              <div className="lbl">Frekvens</div>
              <div className="val">Hver 6. måned <Icon name="chev-down" size={12}/></div>
            </div>
          </div>
          <div className="setting-row">
            <div className="top">
              <div className="lbl">Neste revisjon</div>
              <div className="val">15. nov 2026 <Icon name="calendar" size={12}/></div>
            </div>
            <div className="hint">Auto-varsel 14 dager før</div>
          </div>
          <div className="setting-row">
            <div className="top">
              <div className="lbl">Siste gjennomgang</div>
              <div className="val">12. okt 2026</div>
            </div>
            <div className="hint">av Magnus Krogh</div>
          </div>
        </div>
      </div>

      <div className="hms-right-group">
        <div className="hd">Synlighet</div>
        <div style={{ display: "flex", gap: 6 }}>
          {["Admin", "Manager", "Ansatt", "Skjult"].map((p, i) => (
            <button key={p} className={`btn btn-sm ${i === 2 ? "btn-primary" : ""}`} style={{ flex: 1, padding: "0 6px" }}>{p}</button>
          ))}
        </div>
      </div>

      <div className="hms-right-group">
        <div className="hd">Kilde</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          {[
            { l: "Manuell", a: true },
            { l: "Mal", a: false },
            { l: "Generert", a: false },
          ].map(o => (
            <div key={o.l} style={{
              padding: "10px 6px",
              border: `1px solid ${o.a ? "var(--brand-orange)" : "var(--border)"}`,
              background: o.a ? "color-mix(in oklab, var(--brand-orange) 8%, var(--card))" : "var(--card)",
              borderRadius: 10,
              textAlign: "center",
              fontSize: 12, fontWeight: 600,
              color: o.a ? "var(--brand-orange-dark)" : "var(--foreground)",
            }}>{o.l}</div>
          ))}
        </div>
      </div>

      <div className="hms-right-group">
        <div className="hd">Avansert</div>
        <div className="action-row" style={{ opacity: 0.85 }}>
          <span className="ic"><Icon name="branch" size={14}/></span>
          <div className="body">
            <div className="lbl">Kobling til governance<span className="sortie-tag">S4</span></div>
            <div className="meta">Ingen knyttet ennå</div>
          </div>
        </div>
        <div className="action-row" style={{ color: "var(--destructive)" }}>
          <span className="ic" style={{ background: "color-mix(in oklab, var(--destructive) 10%, transparent)", color: "var(--destructive)" }}><Icon name="trash" size={14}/></span>
          <div className="body">
            <div className="lbl">Arkiver kapittel</div>
            <div className="meta" style={{ color: "var(--destructive)" }}>Setter status='archived', beholder data</div>
          </div>
        </div>
      </div>
    </div>
  </PanelFrame>
);

// ── Vedlegg (Sortie 5) ─────────────────────────────────────────
const PanelVedlegg = () => (
  <PanelFrame>
    <HmsRightTabs active="vedlegg"/>
    <div className="hms-right-body">

      <div style={{
        display: "flex", flexDirection: "column", gap: 6, alignItems: "center", justifyContent: "center",
        padding: "20px 16px",
        border: "1.5px dashed var(--border)",
        background: "var(--card)",
        borderRadius: 16,
        textAlign: "center",
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: "color-mix(in oklab, var(--brand-orange) 10%, transparent)",
          color: "var(--brand-orange-dark)",
          display: "grid", placeItems: "center",
          marginBottom: 4,
        }}>
          <Icon name="upload" size={20}/>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Slipp filer her</div>
        <div style={{ fontSize: 11, color: "var(--muted-fg)" }}>eller <a style={{ color: "var(--brand-orange)", fontWeight: 600 }}>velg fra arkiv</a></div>
        <div style={{ fontSize: 10, color: "var(--muted-fg)", marginTop: 6, fontFamily: "var(--font-mono)" }}>
          PDF · DOCX · PNG · JPG · 25MB
        </div>
      </div>

      <div className="hms-right-group">
        <div className="hd">Kapittel-vedlegg · 3</div>

        {[
          { name: "Plantegning Bistro Bjørvika.pdf", who: "MK", date: "12. okt", size: "412 KB", ic: "filepdf" },
          { name: "Brannsertifikat 2025.pdf", who: "MK", date: "08. sep", size: "1.2 MB", ic: "filepdf" },
          { name: "Evakueringsplan-utkast.png", who: "AS", date: "i dag", size: "188 KB", ic: "file" },
        ].map(f => (
          <div key={f.name} className="action-row">
            <span className="ic" style={{ background: "color-mix(in oklab, var(--destructive) 8%, transparent)", color: "var(--destructive)" }}>
              <Icon name={f.ic} size={14}/>
            </span>
            <div className="body" style={{ minWidth: 0 }}>
              <div className="lbl" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div>
              <div className="meta">{f.who} · {f.date} · {f.size}</div>
            </div>
            <button className="hms-iconbtn" style={{ width: 26, height: 26 }}><Icon name="download" size={12}/></button>
          </div>
        ))}
      </div>

      <div className="hms-right-group">
        <div className="hd">Arbeidsstedet-arkiv</div>
        <button className="btn btn-sm" style={{ justifyContent: "flex-start", gap: 8 }}>
          <Icon name="folder" size={14}/>
          <span style={{ flex: 1, textAlign: "left" }}>Bla i 42 filer</span>
          <Icon name="chev-right" size={12}/>
        </button>
        <div style={{ fontSize: 11, color: "var(--muted-fg)", lineHeight: 1.5, marginTop: 4 }}>
          Workspace-vault deles på tvers av kapitler. Brannsertifikat, HMS-plan, Mattilsynet-rapporter osv.
        </div>
      </div>

      <div style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
        color: "var(--muted-fg)",
        background: "var(--secondary)",
        padding: "5px 9px",
        borderRadius: 999,
        alignSelf: "flex-start",
      }}>
        <Icon name="lock" size={11}/> Tilgjengelig fra Sortie 5
      </div>
    </div>
  </PanelFrame>
);

Object.assign(window, { PanelVerktoy, PanelHandling, PanelInnstillinger, PanelVedlegg });
