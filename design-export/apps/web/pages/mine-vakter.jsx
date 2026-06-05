// ===== Mine vakter — employee shift schedule (private route "mine-vakter") =====
// The employee's own roster: next shift hero, what needs their answer, a navigable
// week list, the shift marketplace (open shifts), and self-service tools. Persona:
// Jonas H. (Sous-chef · Kjøkken). Week nav works; every control routes/opens/toasts.
(function () {
  const { useState, useEffect } = React;
  const Ic = window.Ic;
  const DEPT = { sal: "#00ab93", kjokken: "#ee560c", bar: "#864ad2", event: "#c18200" };

  // 3 weeks of Jonas' own kitchen shifts · "now" = today is Tor 29. mai, week 22
  const WEEKS = [
    { id: 21, label: "Forrige uke", range: "19.–25. mai", hours: 34.0, target: 37.5, shifts: 4,
      days: [
        { dw: "Man", dn: 19, shift: { s: "14:00", e: "22:00", role: "Sous-chef", dep: "kjokken", loc: "Kjøkken" }, status: "done" },
        { dw: "Tir", dn: 20, off: true },
        { dw: "Ons", dn: 21, shift: { s: "14:00", e: "22:00", role: "Sous-chef", dep: "kjokken", loc: "Kjøkken" }, status: "done" },
        { dw: "Tor", dn: 22, shift: { s: "15:00", e: "23:00", role: "Lagleder", dep: "kjokken", loc: "Kjøkken · kveld" }, status: "done" },
        { dw: "Fre", dn: 23, shift: { s: "15:00", e: "23:00", role: "Lagleder", dep: "kjokken", loc: "Kjøkken · kveld" }, status: "done" },
        { dw: "Lør", dn: 24, off: true },
        { dw: "Søn", dn: 25, off: true },
      ] },
    { id: 22, label: "Denne uka", range: "26. mai–1. jun", hours: 36.5, target: 37.5, shifts: 5, current: true,
      days: [
        { dw: "Man", dn: 26, shift: { s: "09:00", e: "17:00", role: "Sous-chef", dep: "kjokken", loc: "Kjøkken · dag" }, status: "done" },
        { dw: "Tir", dn: 27, shift: { s: "09:00", e: "17:00", role: "Sous-chef", dep: "kjokken", loc: "Kjøkken · dag" }, status: "done" },
        { dw: "Ons", dn: 28, off: true },
        { dw: "Tor", dn: 29, shift: { s: "15:00", e: "23:00", role: "Lagleder", dep: "kjokken", loc: "Kjøkken · kveld" }, status: "done" },
        { dw: "Fre", dn: 30, shift: { s: "09:00", e: "17:00", role: "Sous-chef", dep: "kjokken", loc: "Kjøkken · dag" }, status: "today", today: true },
        { dw: "Lør", dn: 31, shift: { s: "12:00", e: "20:00", role: "Sous-chef", dep: "kjokken", loc: "Kjøkken · dag" }, status: "swap" },
        { dw: "Søn", dn: 1, off: true },
      ] },
    { id: 23, label: "Neste uke", range: "2.–8. jun", hours: 30.0, target: 37.5, shifts: 4,
      days: [
        { dw: "Man", dn: 2, off: true },
        { dw: "Tir", dn: 3, shift: { s: "14:00", e: "22:00", role: "Sous-chef", dep: "kjokken", loc: "Kjøkken" }, status: "" },
        { dw: "Ons", dn: 4, shift: { s: "14:00", e: "22:00", role: "Sous-chef", dep: "kjokken", loc: "Kjøkken" }, status: "" },
        { dw: "Tor", dn: 5, off: true },
        { dw: "Fre", dn: 6, shift: { s: "15:00", e: "23:00", role: "Lagleder", dep: "kjokken", loc: "Kjøkken · kveld" }, status: "" },
        { dw: "Lør", dn: 7, shift: { s: "15:00", e: "23:30", role: "Lagleder", dep: "kjokken", loc: "Event · 40 pax" }, status: "" },
        { dw: "Søn", dn: 8, off: true },
      ] },
  ];

  const OPEN_SHIFTS = [
    { id: "o1", day: "Lør 31. mai", time: "12:00–20:00", role: "Kokk", dep: "kjokken", note: "Din byttevakt — venter på dekning" },
    { id: "o2", day: "Søn 1. jun", time: "16:00–23:00", role: "Kokk", dep: "kjokken", note: "Ekstravakt · +18 kr/t kveldstillegg" },
    { id: "o3", day: "Ons 4. jun", time: "11:00–15:00", role: "Lunsj", dep: "kjokken", note: "Kort vakt · passer ekstra" },
  ];

  function Panel({ icon, title, action, children }) {
    return (
      <div className="so-panel">
        <div className="so-panel-head">
          <span className="t"><span className="ico"><Ic n={icon} s={15} /></span>{title}</span>
          {action ? <><span className="spacer" />{action}</> : null}
        </div>
        {children}
      </div>
    );
  }

  function MineVakterPage() {
    const toast = window.useToast();
    const [wi, setWi] = useState(1);             // week index (1 = denne uka)
    const [swap, setSwap] = useState(null);      // "asked" | "kept"
    const [claimed, setClaimed] = useState({});
    useEffect(() => {
      if (window.SmartoutContext && window.SmartoutContext.set)
        window.SmartoutContext.set({ route: "mine-vakter", view: "uke", role: "ansatt", subject: "Mine vakter" });
      return () => { if (window.SmartoutContext && window.SmartoutContext.set) window.SmartoutContext.set({ route: null }); };
    }, []);

    const wk = WEEKS[wi];

    return (
      <main className="sk-main">
        <div className="sk-wrap" style={{ maxWidth: 1080 }}>
          <div className="ms-head">
            <div>
              <div className="sk-eyebrow">Min side · Vakter</div>
              <h1 className="ms-h1">Mine vakter</h1>
              <div className="ms-sub">Turnusen din, det som venter på svar fra deg, og ledige vakter du kan ta. Bytter og fritak går alltid til godkjenning hos leder.</div>
            </div>
            <div className="ms-headacts">
              <div className="mv-weeknav">
                <button className="mv-wbtn" onClick={() => setWi(i => Math.max(0, i - 1))} disabled={wi === 0}><Ic n="chevLeft" s={18} /></button>
                <span className="mv-wlabel">{wk.label}<span className="wk">UKE {wk.id} · {wk.range}</span></span>
                <button className="mv-wbtn" onClick={() => setWi(i => Math.min(WEEKS.length - 1, i + 1))} disabled={wi === WEEKS.length - 1}><Ic n="chevRight" s={18} /></button>
              </div>
              {wi !== 1 && <button className="mv-today-btn" onClick={() => setWi(1)}>I dag</button>}
            </div>
          </div>

          {/* week summary */}
          <div className="mv-summary">
            <div className="mv-sum"><div className="mv-sum-l">Timer denne uka</div><div className="mv-sum-v">{String(wk.hours).replace(".", ",")}<span className="u"> / {String(wk.target).replace(".", ",")}t</span></div><div className="bar"><span style={{ width: `${Math.min(100, wk.hours / wk.target * 100)}%` }} /></div></div>
            <div className="mv-sum"><div className="mv-sum-l">Vakter</div><div className="mv-sum-v">{wk.shifts}</div><div className="mv-sum-s">{7 - wk.shifts} fridager</div></div>
            <div className="mv-sum"><div className="mv-sum-l">Kveldsvakter</div><div className="mv-sum-v">{wk.days.filter(d => d.shift && d.shift.s >= "15:00").length}</div><div className="mv-sum-s">+18 kr/t tillegg</div></div>
            <div className="mv-sum"><div className="mv-sum-l">Saldo timebank</div><div className="mv-sum-v">+6,5<span className="u">t</span></div><div className="mv-sum-s">kan tas ut etter avtale</div></div>
          </div>

          {/* next shift hero */}
          <div className="mv-next">
            <div className="mv-next-top">
              <span className="mv-next-tag">Neste vakt</span>
              <span className="mv-next-live"><span className="d" />I dag, fre 30. mai · starter 09:00</span>
            </div>
            <div className="mv-next-time" style={{ marginTop: 10 }}>09:00<span className="sep"> – </span>17:00</div>
            <div className="mv-next-meta">
              <span className="sub"><Ic n="users" s={14} c="rgba(255,255,255,0.7)" /> Sous-chef · Kjøkken dag</span>
              <span className="mv-next-dot" />
              <span className="sub"><Ic n="clock" s={14} c="rgba(255,255,255,0.7)" /> 8 t · starter om 46 min</span>
              <span className="mv-next-dot" />
              <span className="sub"><Ic n="users" s={14} c="rgba(255,255,255,0.7)" /> 4 på laget</span>
            </div>
            <div className="mv-next-actions">
              <button className="mv-nbtn solid" onClick={() => toast("Åpner vaktkort for fre 30. mai")}><Ic n="eye" s={15} /> Se vaktkort</button>
              <button className="mv-nbtn" onClick={() => toast("Bytteforespørsel opprettet — venter på en kollega")}><Ic n="repeat" s={15} /> Be om bytte</button>
            </div>
          </div>

          <div style={{ height: 18 }} />

          <div className="so-grid-2">
            {/* LEFT — week list */}
            <div className="so-stack">
              <Panel icon="calendar" title={wk.label} action={<span className="so-eyebrow-lbl">Uke {wk.id}</span>}>
                <div className="mv-week">
                  {wk.days.map((d, i) => (
                    <div key={i} className={`mv-day ${d.today ? "today" : ""} ${d.off ? "off" : ""}`}>
                      <div className="mv-date"><div className="dw">{d.dw}</div><div className="dn">{d.dn}</div></div>
                      {d.off ? (
                        <span className="mv-off-lbl">Fri</span>
                      ) : (
                        <div className="mv-shift-card" style={{ "--dept": DEPT[d.shift.dep] }} onClick={() => toast(`Vaktkort · ${d.dw} ${d.dn}. · ${d.shift.s}–${d.shift.e}`)}>
                          <span className="tm">{d.shift.s} – {d.shift.e}</span>
                          <span className="rl"><b>{d.shift.role}</b> · {d.shift.loc}</span>
                        </div>
                      )}
                      {d.status === "today" && <span className="mv-day-status now">I dag</span>}
                      {d.status === "done" && <span className="mv-day-status done"><Ic n="check" s={11} /> Fullført</span>}
                      {d.status === "swap" && <span className="mv-day-status swap"><Ic n="repeat" s={11} /> Til bytte</span>}
                    </div>
                  ))}
                </div>
              </Panel>
            </div>

            {/* RIGHT */}
            <div className="so-stack">
              {/* needs your answer */}
              <Panel icon="inbox" title="Venter på svar fra deg" action={<span className="so-pill-count">{swap ? 1 : 2}</span>}>
                <div>
                  {/* swap request */}
                  <div className="mv-act">
                    <span className="mv-act-ic swap"><Ic n="repeat" s={18} /></span>
                    <div className="mv-act-body">
                      <div className="mv-act-title">Sara K. vil bytte vakt med deg</div>
                      <div className="mv-act-sub">Hun tar din <b>lør 31. mai (12–20)</b>, du tar hennes <b>søn 1. jun (16–23)</b>. Begge i kjøkkenet.</div>
                      {swap === "asked" ? (
                        <div className="mv-act-done"><Ic n="check" s={14} /> Sendt til leder for godkjenning</div>
                      ) : swap === "kept" ? (
                        <div className="mv-act-done" style={{ color: "var(--muted)" }}><Ic n="x" s={14} /> Du beholdt vakta di</div>
                      ) : (
                        <div className="mv-act-btns">
                          <button className="mv-abtn primary" onClick={() => { setSwap("asked"); toast("Bytte akseptert — sendt til leder", { undo: () => setSwap(null) }); }}><Ic n="check" s={13} /> Godta bytte</button>
                          <button className="mv-abtn ghost" onClick={() => { setSwap("kept"); toast("Du beholder vakta", { undo: () => setSwap(null) }); }}>Behold min</button>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* open shift offer */}
                  <div className="mv-act">
                    <span className="mv-act-ic open"><Ic n="zap" s={18} /></span>
                    <div className="mv-act-body">
                      <div className="mv-act-title">Ekstravakt søn 1. jun passer deg</div>
                      <div className="mv-act-sub">Botsson foreslår denne — den passer turnusen din og gir <b>+18 kr/t</b> i kveldstillegg.</div>
                      <div className="mv-act-btns">
                        <button className="mv-abtn primary" onClick={() => { setClaimed(c => ({ ...c, o2: 1 })); toast("Forespørsel sendt — leder godkjenner"); }}><Ic n="plus" s={13} /> Meld interesse</button>
                        <button className="mv-abtn ghost" onClick={() => toast("Skjult — Botsson foreslår ikke denne igjen")}>Ikke nå</button>
                      </div>
                    </div>
                  </div>
                </div>
              </Panel>

              {/* open shifts marketplace */}
              <Panel icon="zap" title="Ledige vakter" action={<button className="ms-btn sm" onClick={() => toast("Åpner full vaktbørs")}>Se alle</button>}>
                <div>
                  {OPEN_SHIFTS.map(o => (
                    <div key={o.id} className="mv-open">
                      <span className="mv-open-ic" style={{ background: "color-mix(in oklab," + DEPT[o.dep] + " 14%, transparent)", color: DEPT[o.dep] }}><Ic n="calendar" s={16} /></span>
                      <div className="mv-open-body">
                        <div className="mv-open-title">{o.day} · {o.time}</div>
                        <div className="mv-open-meta">{o.role} · Kjøkken — {o.note}</div>
                      </div>
                      {claimed[o.id]
                        ? <span className="ms-pill sent"><Ic n="clock" s={11} /> Sendt</span>
                        : <button className="mv-abtn" onClick={() => { setClaimed(c => ({ ...c, [o.id]: 1 })); toast("Interesse meldt — venter på godkjenning"); }}>Ta vakt</button>}
                    </div>
                  ))}
                </div>
              </Panel>

              {/* self-service tools */}
              <Panel icon="grid" title="Verktøy">
                <div className="mv-tools" style={{ padding: 14 }}>
                  <button className="mv-tool" onClick={() => toast("Åpner ferieønske")}>
                    <span className="mv-tool-ic"><Ic n="umbrella" s={17} /></span>
                    <span className="mv-tool-lbl">Søk ferie</span><span className="mv-tool-sub">Legg inn ønske</span>
                  </button>
                  <button className="mv-tool" onClick={() => toast("Registrer fravær / egenmelding")}>
                    <span className="mv-tool-ic"><Ic n="alert" s={17} /></span>
                    <span className="mv-tool-lbl">Meld fravær</span><span className="mv-tool-sub">Egenmelding</span>
                  </button>
                  <button className="mv-tool" onClick={() => toast("Åpner tilgjengelighet")}>
                    <span className="mv-tool-ic"><Ic n="clock" s={17} /></span>
                    <span className="mv-tool-lbl">Tilgjengelighet</span><span className="mv-tool-sub">Når kan du jobbe</span>
                  </button>
                </div>
              </Panel>
            </div>
          </div>
        </div>
      </main>
    );
  }

  window.SO_PAGES = Object.assign(window.SO_PAGES || {}, { "mine-vakter": MineVakterPage });
})();
