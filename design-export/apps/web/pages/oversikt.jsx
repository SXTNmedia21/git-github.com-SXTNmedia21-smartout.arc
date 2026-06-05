// ===== Oversikt — Today Dashboard / Daily Control Center =====
(function () {
  const { useState } = React;
  const Ic = window.Ic;

  const DEPT = { kjokken: "#ee560c", sal: "#00ab93", bar: "#864ad2", event: "#c18200" };

  // curated, coherent with ../data.js cast (Bistro Nord)
  const ACTIONS = [
    { id: "a1", kind: "Avvik", sev: "crit", ic: "thermometer", title: "Temperaturavvik — Kjøl 3 over +4 °C", meta: "Kjøkken sone A · oppdaget 08:10", deadline: "32 min forsinket", who: { i: "MA", c: "#FF7849" }, cta: "Løs nå", primary: true, toast: "Avvik åpnet" },
    { id: "a2", kind: "Avvik", sev: "crit", ic: "alert", title: "Avvik #214 — løs pakning på Kjøl 3", meta: "Vedlikehold · oppfølging fra i går", deadline: "frist 12:00", who: { i: "MA", c: "#FF7849" }, cta: "Åpne", toast: "Oppgave åpnet" },
    { id: "a3", kind: "Godkjenning", sev: "warn", ic: "checkdoc", title: "Petters timeavvik (+1,5 t) venter", meta: "Lønn · helgevakt lør 24/5", deadline: null, who: { i: "PK", c: "#A855F7" }, cta: "Godkjenn", toast: "Timeavvik godkjent" },
    { id: "a4", kind: "Levering", sev: "info", ic: "clock", title: "Mottakskontroll — Bama leverer 09:30", meta: "Vareleveranse · temperatur + antall", deadline: "om 58 min", who: { i: "MA", c: "#FF7849" }, cta: "Klargjør", toast: "Sjekkliste klargjort" },
  ];

  const ROSTER = [
    { i: "MA", nm: "Maria A.", rl: "Driftsleder", c: "#FF7849", dep: "sal", s: 9, e: 17, status: "on" },
    { i: "JH", nm: "Jonas H.", rl: "Kokk", c: "#3B82F6", dep: "kjokken", s: 11, e: 20, status: "on" },
    { i: "IB", nm: "Ida B.", rl: "Renhold", c: "#EAB308", dep: "sal", s: 8, e: 14, status: "on" },
    { i: "SL", nm: "Selma L.", rl: "Servitør", c: "#10B981", dep: "sal", s: 16, e: 23, status: "soon" },
    { i: null, nm: "Bartender", rl: "Bar · kveld", c: "#864ad2", dep: "bar", s: 17, e: 23, status: "gap" },
  ];
  const DAY_S = 8, DAY_E = 23, NOW = 8 + 14 / 60;

  const FEED = [
    { c: "var(--error)", who: "Jonas H.", text: " opprettet avvik på Kjøl 3", t: "08:10" },
    { c: "var(--success)", who: "Erik T.", text: " godkjente fettutskiller-logg", t: "07:52" },
    { c: "var(--orange)", who: "Botsson", text: " flyttet renhold til 10:30 pga. levering", t: "07:40" },
    { c: "var(--info)", who: "Selma L.", text: " byttet kveldsvakt med Kari (venter svar)", t: "i går 21:14" },
  ];

  const RECEIPTS = [
    { i: "JH", nm: "Jonas H.", c: "#3B82F6", read: true },
    { i: "SL", nm: "Selma L.", c: "#10B981", read: true },
    { i: "IB", nm: "Ida B.", c: "#EAB308", read: true },
    { i: "PK", nm: "Petter K.", c: "#A855F7", read: false },
    { i: "OT", nm: "Ole T.", c: "#864ad2", read: false },
  ];

  function Brief({ toast }) {
    const [showWhy, setShowWhy] = useState(false);
    const [done, setDone] = useState({});
    const acts = [
      { id: "b1", label: "Åpne Avvik #214", toast: "Avvik #214 åpnet" },
      { id: "b2", label: "Send kveldsvakt til Jonas", toast: "Forespørsel sendt til Jonas H." },
      { id: "b3", label: "Påminn 2 om vaktendring", toast: "Påminnelse sendt til 2 ansatte" },
    ];
    return (
      <div className="brief">
        <div className="brief-top">
          <span className="brief-av"><Ic n="bot" s={19} /></span>
          <div className="brief-id">
            <div className="n">Morgenbrief <span className="tag">BOTSSON</span></div>
            <div className="m">Generert 08:14 · oppdateres løpende</div>
          </div>
          <span className="spacer" />
          <button className="brief-why" onClick={() => setShowWhy(s => !s)}>
            <Ic n={showWhy ? "chevUp" : "eye"} s={13} /> {showWhy ? "Skjul kilder" : "Hvorfor?"}
          </button>
        </div>
        <p className="brief-body">
          Dagen ser rolig ut, men <span className="hl-crit">Kjøl 3 har et temperaturavvik</span> som bør løses før Bama leverer <strong>09:30</strong>. Du har <strong>3 oppgaver</strong> før 12:00 og <strong>3 godkjenninger</strong> som ser rutinemessige ut. I morgen mangler du <strong>én kokk på kveld</strong> — Jonas er ledig.
        </p>
        {showWhy && (
          <div className="brief-sources">
            {[["thermometer", "Temp-logg Kjøl 3"], ["list", "12 oppgaver i dag"], ["grid", "Vaktplan fre"], ["wallet", "3 timeavvik"], ["hash", "1 ulest kunngjøring"]].map(([ic, s]) => (
              <span key={s} className="brief-src"><span className="ic"><Ic n={ic} s={12} /></span>{s}</span>
            ))}
          </div>
        )}
        <div className="brief-actions">
          {acts.map((a, i) => (
            <button key={a.id} className={`brief-act ${done[a.id] ? "done" : ""}`}
              onClick={() => { if (done[a.id]) return; setDone(d => ({ ...d, [a.id]: true })); toast(a.toast, { undo: () => setDone(d => ({ ...d, [a.id]: false })) }); }}>
              {done[a.id] ? <Ic n="check" s={14} sw={2.4} /> : <span className="num">{i + 1}</span>}
              {a.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  function Pulse({ lbl, ic, val, unit, sub, tone, edge, onClick }) {
    return (
      <div className="pulse" onClick={onClick}>
        {edge && <span className="pulse-edge" style={{ background: edge }} />}
        <div className="pulse-lbl"><span className="ico"><Ic n={ic} s={13} /></span>{lbl}</div>
        <div className={`pulse-val ${tone || ""}`}>{val}{unit && <span className="u">{unit}</span>}</div>
        <div className="pulse-sub">{sub}</div>
      </div>
    );
  }

  function ActionQueue({ toast, setRoute }) {
    const [done, setDone] = useState({});
    const live = ACTIONS.filter(a => !done[a.id]);
    return (
      <div className="so-panel">
        <div className="so-panel-head">
          <span className="t"><span className="ico"><Ic n="alert" s={15} /></span>Krever handling nå</span>
          <span className="cnt crit">{live.length}</span>
          <span className="spacer" />
          <button className="link" onClick={() => setRoute("oppgaver")}>Alle oppgaver <Ic n="arrowRight" s={13} /></button>
        </div>
        <div className="aq">
          {live.length === 0 ? (
            <div className="so-empty"><span className="ic"><Ic n="check" s={22} /></span><div className="t">Alt under kontroll</div><div className="s">Ingenting krever deg akkurat nå.</div></div>
          ) : live.map(a => (
            <div key={a.id} className={`aq-row ${a.sev}`} onClick={() => setRoute("oppgaver")}>
              <span className={`aq-ic ${a.sev}`}><Ic n={a.ic} s={17} /></span>
              <div className="aq-main">
                <div className="aq-tline">
                  <span className={`aq-kind ${a.sev}`}>{a.kind}</span>
                  {a.deadline && <span className={`aq-meta`}><span className={`deadline ${a.sev === "crit" ? "crit" : ""} mono`}>{a.deadline}</span></span>}
                </div>
                <div className="aq-title">{a.title}</div>
                <div className="aq-meta">{a.meta}</div>
              </div>
              <div className="aq-side">
                {a.who && <span className="so-av" style={{ width: 28, height: 28, background: a.who.c }}>{a.who.i}</span>}
                <button className={`aq-btn ${a.primary ? "primary" : ""}`}
                  onClick={(e) => { e.stopPropagation(); setDone(d => ({ ...d, [a.id]: true })); toast(`${a.kind}: ${a.toast}`, { undo: () => setDone(d => ({ ...d, [a.id]: false })) }); }}>
                  {a.cta}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function Roster({ toast }) {
    const span = DAY_E - DAY_S;
    const pct = (h) => `${((h - DAY_S) / span) * 100}%`;
    return (
      <div className="so-panel">
        <div className="so-panel-head">
          <span className="t"><span className="ico"><Ic n="users" s={15} /></span>På vakt nå</span>
          <span className="cnt">4/5</span>
          <span className="spacer" />
          <span className="so-panel-head" style={{ padding: 0, border: "none", fontSize: 11.5, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>08:14</span>
        </div>
        <div className="roster">
          {ROSTER.map((p, i) => (
            <div key={i} className={`roster-row ${p.status === "gap" ? "gap" : ""}`}>
              <div className="roster-emp">
                {p.i
                  ? <span className="so-av" style={{ width: 30, height: 30, background: p.c }}>{p.i}</span>
                  : <span className="so-av" style={{ width: 30, height: 30, background: "var(--secondary)", color: "var(--error)", border: "1.5px dashed var(--error)" }}><Ic n="user" s={14} /></span>}
                <span style={{ minWidth: 0 }}><span className="nm">{p.nm}</span><span className="rl" style={{ display: "block" }}>{p.rl}</span></span>
              </div>
              <div className="roster-track">
                <span className="roster-bar" style={{ left: pct(p.s), width: `${((p.e - p.s) / span) * 100}%`, background: p.status === "gap" ? "rgba(231,0,11,0.14)" : DEPT[p.dep], color: p.status === "gap" ? "var(--error)" : "#fff", border: p.status === "gap" ? "1px dashed var(--error)" : "none" }}>
                  {String(p.s).padStart(2, "0")}–{String(p.e).padStart(2, "0")}
                </span>
                <span className="roster-now" style={{ left: pct(NOW) }} />
              </div>
              <span className={`roster-status ${p.status}`}>{p.status === "on" ? "På vakt" : p.status === "soon" ? "Fra 16:00" : "Mangler"}</span>
            </div>
          ))}
          <div className="roster-gapfill">
            <span className="fill-msg"><Ic n="alert" s={14} c="var(--error)" /> Kveldsvakt bar 17–23 udekket</span>
            <span />
            <button className="aq-btn primary" onClick={() => toast("Forespørsel sendt til 3 kvalifiserte", { undo: () => {} })}>Finn vikar</button>
          </div>
        </div>
      </div>
    );
  }

  function RiskTomorrow() {
    return (
      <div className="so-panel">
        <div className="so-panel-head"><span className="t"><span className="ico"><Ic n="trendUp" s={15} /></span>Risiko i morgen</span><span className="spacer" /><span className="so-eyebrow-lbl">Fre 31/5</span></div>
        <div className="risk-body">
          <p className="risk-lead">Dekning <strong>fre 31/5</strong> ligger på <strong>83 %</strong>. Hovedrisiko er kveldsservice i bar.</p>
          <div className="risk-meter">
            <span style={{ width: "62%", background: "var(--success)" }} />
            <span style={{ width: "21%", background: "var(--warning)" }} />
            <span style={{ width: "17%", background: "var(--error)" }} />
          </div>
          <div className="risk-legend">
            <span><i style={{ background: "var(--success)" }} />Dekket</span>
            <span><i style={{ background: "var(--warning)" }} />Stramt</span>
            <span><i style={{ background: "var(--error)" }} />Udekket</span>
          </div>
          {[
            { c: "var(--error)", t: <span><b>Kveldsvakt bar 17–23</b> — ingen bartender</span>, a: "Løs" },
            { c: "var(--warning)", t: <span><b>Lunsj kjøkken</b> — kun 1 kokk ved fullt hus</span>, a: "Se" },
            { c: "var(--warning)", t: <span><b>Selma L.</b> nærmer seg 37,5t denne uka</span>, a: "Se" },
          ].map((r, i) => (
            <div key={i} className="risk-item"><span className="rdot" style={{ background: r.c }} /><span className="rtxt">{r.t}</span><span className="raction">{r.a}</span></div>
          ))}
        </div>
      </div>
    );
  }

  function Feed({ setRoute }) {
    return (
      <div className="so-panel">
        <div className="so-panel-head"><span className="t"><span className="ico"><Ic n="swap" s={15} /></span>Siste endringer</span><span className="spacer" /><button className="link" onClick={() => setRoute("kommunikasjon")}>Alle <Ic n="arrowRight" s={13} /></button></div>
        <div className="feed">
          {FEED.map((f, i) => (
            <div key={i} className="feed-item">
              <span className="feed-rail"><span className="feed-dot" style={{ background: f.c }} /></span>
              <div className="feed-body"><span className="who">{f.who}</span>{f.text}<div className="feed-time">{f.t}</div></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function Receipts({ toast }) {
    const [nudged, setNudged] = useState(false);
    const unread = RECEIPTS.filter(r => !r.read);
    return (
      <div className="so-panel">
        <div className="so-panel-head"><span className="t"><span className="ico"><Ic n="eye" s={15} /></span>Ulest — vaktendring fre</span><span className="cnt warn" style={{ color: "var(--warning)", background: "rgba(193,130,0,0.12)" }}>{unread.length}</span></div>
        <div className="rr">
          {RECEIPTS.map(r => (
            <div key={r.i} className="rr-row">
              <span className="so-av" style={{ width: 28, height: 28, background: r.c }}>{r.i}</span>
              <span className="rr-name">{r.nm}</span>
              <span className={`rr-state ${r.read ? "read" : "unread"}`}>
                {r.read ? <><Ic n="check" s={12} sw={2.4} /> Lest</> : "Ikke lest"}
              </span>
            </div>
          ))}
          <div className="rr-foot">
            <button className="rr-nudge" disabled={nudged} onClick={() => { setNudged(true); toast(`Påminnelse sendt til ${unread.length}`, { undo: () => setNudged(false) }); }}>
              <Ic n="bell" s={14} /> {nudged ? "Påminnelse sendt" : `Påminn ${unread.length} som ikke har lest`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function OversiktPage({ setRoute }) {
    const toast = window.useToast();
    return (
      <main className="sk-main">
        <div className="sk-wrap">
          <div className="dash-head">
            <div>
              <div className="sk-eyebrow">Torsdag · 30. mai 2026 · 08:14</div>
              <h1 className="dash-greet">God morgen, Maria</h1>
              <div className="dash-statusline">
                <span className="seg"><span className="dot" style={{ background: "var(--success)" }} /><strong>4 av 5</strong> på vakt</span>
                <span className="sep" />
                <span className="seg"><span className="dot" style={{ background: "var(--error)" }} /><strong>1</strong> bemanningshull</span>
                <span className="sep" />
                <span className="seg"><span className="dot" style={{ background: "var(--warning)" }} /><strong>3</strong> må løses før 12:00</span>
                <span className="sep" />
                <span className="seg">Åpner <strong>10:00</strong></span>
              </div>
            </div>
            <div className="sk-page-actions">
              <button className="sk-ghost" onClick={() => { window.openDagsrapport && window.openDagsrapport(); }}><Ic n="checkdoc" s={15} /> Dagsrapport</button>
              {window.CreateButton ? <window.CreateButton /> : null}
            </div>
          </div>

          <Brief toast={toast} />

          <div className="dash-pulse">
            <Pulse lbl="På vakt nå" ic="users" val="4" unit="/ 5" sub="1 møter 16:00" tone="" edge="var(--success)" onClick={() => setRoute("vaktplan")} />
            <Pulse lbl="Må løses" ic="alert" val="3" sub="hvorav 1 forsinket" tone="crit" edge="var(--error)" onClick={() => setRoute("oppgaver")} />
            <Pulse lbl="Til godkjenning" ic="checkdoc" val="3" sub="≈ 2 min å rydde" tone="warn" edge="var(--warning)" onClick={() => setRoute("avstemming")} />
            <Pulse lbl="Ulest" ic="eye" val="2" sub="av 5 — vaktendring" tone="warn" edge="var(--warning)" onClick={() => setRoute("kommunikasjon")} />
            <Pulse lbl="Dekning i dag" ic="trendUp" val="92" unit="%" sub="fre faller til 83 %" tone="ok" edge="var(--success)" onClick={() => setRoute("vaktplan")} />
          </div>

          <div className="so-grid-2">
            <div className="so-stack">
              <ActionQueue toast={toast} setRoute={setRoute} />
              <Roster toast={toast} />
            </div>
            <div className="so-stack">
              <RiskTomorrow />
              <Receipts toast={toast} />
              <Feed setRoute={setRoute} />
            </div>
          </div>
        </div>
      </main>
    );
  }

  window.SO_PAGES = Object.assign(window.SO_PAGES || {}, { oversikt: OversiktPage });
})();
