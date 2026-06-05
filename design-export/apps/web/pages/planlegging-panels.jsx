// ===== Planlegging — slide-over panels =====
// Exposes window.PLPanels = { DetailPanel, BookingCreatePanel, OpeningHoursPanel, AttentionPanel, BotCard }.
(function () {
  const { useState } = React;
  const Ic = window.Ic;
  const PL = window.PL;

  const Meta = ({ k, v, mono, c }) => (
    <div className="pl-meta"><span className="k">{k}</span><span className={`v ${mono ? "mono" : ""}`} style={c ? { color: c } : null}>{v}</span></div>
  );
  const KindPill = ({ icon, label, c }) => (
    <span className="pl-over-kind" style={{ background: `color-mix(in oklab, ${c} 13%, transparent)`, color: c }}><Ic n={icon} s={11} />{label}</span>
  );
  // Typed entity header — one design house across every data type so the entity
  // kind is unmistakable: tinted band + colored medallion icon + kind label.
  const TypeHead = ({ icon, label, c, title, sub, onClose }) => (
    <div className="pl-over-head typed" style={{ "--etype": c }}>
      <div className="pl-th-band">
        <span className="pl-th-med"><Ic n={icon} s={19} /></span>
        <span className="pl-th-kind">{label}</span>
        <span style={{ flex: 1 }} />
        <button className="icbtn" onClick={onClose}><Ic n="x" s={18} /></button>
      </div>
      <div className="pl-th-id">
        <h2 className="pl-over-title">{title}</h2>
        {sub != null && <div className="pl-over-sub">{sub}</div>}
      </div>
    </div>
  );
  const Shell = ({ children, onClose }) => (
    <>
      <div className="pl-over-scrim" onClick={onClose} />
      <aside className="pl-over" role="dialog">{children}</aside>
    </>
  );

  // ---------------- Botsson assistive card ----------------
  function BotCard({ text, src, cta, toastMsg, onConfirm }) {
    const toast = window.useToast();
    const [state, setState] = useState(null); // null | 'done' | 'dismissed'
    if (state === "dismissed") return null;
    return (
      <div className="pl-bot">
        <div className="pl-bot-h"><span className="av"><Ic n="bot" s={14} /></span><span className="lbl">Mr. Botsson</span></div>
        {state === "done" ? (
          <div className="pl-bot-resolved"><Ic n="check" s={15} sw={2.4} /> {cta} — utført</div>
        ) : (
          <>
            <p>{text}</p>
            {src && <div className="src">{src.map(s => <span key={s} className="c">{s}</span>)}</div>}
            {cta && <div className="pl-bot-actions">
              <button className="confirm" onClick={() => { setState("done"); onConfirm && onConfirm(); toast && toast(toastMsg || "Utført", { undo: () => setState(null) }); }}>{cta}</button>
              <button className="dismiss" onClick={() => setState("dismissed")}>Ikke nå</button>
            </div>}
          </>
        )}
      </div>
    );
  }

  // ---------------- entity detail slide-over ----------------
  function DetailPanel({ item, onClose, goRoute, openHours, openBooking }) {
    const toast = window.useToast();
    if (!item) return null;
    const type = item.type;

    // ---- SHIFT ----
    if (type === "shift") {
      const e = PL.empById(item.e), dc = PL.DEPT[item.dep].c;
      const coworkers = PL.shiftsOn(item.iso).filter(s => s.id !== item.id);
      const cost = Math.round((item.en - item.st) * 245);
      const stLabel = item.status === "draft" ? "Utkast" : item.lc === "active" ? "Aktiv nå" : "Publisert";
      return (
        <Shell onClose={onClose}>
          <TypeHead icon="grid" label="Vakt" c={dc}
            title={e.name}
            sub={<><span className="so-av" style={{ width: 20, height: 20, fontSize: 9, background: e.c }}>{e.init}</span>{item.role} · {PL.DEPT[item.dep].name}</>}
            onClose={onClose} />
          <div className="pl-over-body">
            {item.warn && <div className="pl-callout warn" style={{ marginTop: 14 }}><span className="ic"><Ic n="alert" s={16} /></span><div className="ct-body">{item.warn}.</div></div>}
            <div className="pl-sec">
              <div className="pl-meta-grid">
                <Meta k="Tid" v={item.t} mono />
                <Meta k="Varighet" v={`${item.en - item.st} t`} mono />
                <Meta k="Avdeling" v={PL.DEPT[item.dep].name} c={dc} />
                <Meta k="Rolle" v={item.role} />
                <Meta k="Status" v={stLabel} />
                <Meta k="Est. kostnad" v={`${cost.toLocaleString("nb")} kr`} mono />
              </div>
            </div>
            <div className="pl-sec">
              <h5>Dekning denne dagen</h5>
              <div className="pl-meta-grid" style={{ marginBottom: 0 }}>
                <Meta k="På vakt" v={`${coworkers.length + 1} ansatte`} />
                <Meta k="Bemanning" v="92 %" c="var(--success)" />
              </div>
            </div>
            {coworkers.length > 0 && <div className="pl-sec">
              <h5>Kolleger på vakt</h5>
              <div className="pl-coworkers">{coworkers.map(s => { const c = PL.empById(s.e); return (
                <span key={s.id} className="pl-cw"><span className="so-av" style={{ width: 20, height: 20, fontSize: 9, background: c.c }}>{c.init}</span>{c.name.split(" ")[0]} · {s.t}</span>
              ); })}</div>
            </div>}
          </div>
          <div className="pl-over-foot">
            <button className="pl-act" onClick={() => goRoute("vaktplan")}><Ic n="grid" s={15} /> Åpne i vaktplan</button>
            <span className="sp" />
            <button className="pl-act primary" onClick={() => toast("Vakt åpnet for redigering")}><Ic n="pen" s={15} /> Rediger</button>
          </div>
        </Shell>
      );
    }

    // ---- BOOKING ----
    if (type === "booking") {
      const st = PL.BSTATUS[item.status], bc = PL.ETYPE.booking.c;
      return (
        <Shell onClose={onClose}>
          <TypeHead icon="utensils" label="Booking" c={bc}
            title={item.name}
            sub={<><span className="pl-statpill" style={{ background: st.soft, color: st.c }}><Ic n="circle" s={8} />{st.label}</span> · {PL.SRC[item.src]}</>}
            onClose={onClose} />
          <div className="pl-over-body">
            {item.conflict === "hours" && <div className="pl-callout crit" style={{ marginTop: 14 }}><span className="ic"><Ic n="clock" s={16} /></span><div className="ct-body"><strong>Utenfor åpningstid.</strong> Bordet er satt etter ordinær stengetid. Eventunntak gjelder til 01:00 — bekreft før du holder av bordet.</div></div>}
            <div className="pl-bk-hero">
              <div className="pl-bk-stat"><span className="v">{item.t}</span><span className="k">Tid</span></div>
              <div className="pl-bk-stat"><span className="v">{item.guests}</span><span className="k">Gjester</span></div>
              <div className="pl-bk-stat"><span className="v">{item.table}</span><span className="k">Bord / ressurs</span></div>
            </div>
            <div className="pl-sec">
              <div className="pl-meta-grid">
                <Meta k="Avdeling" v={PL.DEPT[item.dep].name} c={PL.DEPT[item.dep].c} />
                <Meta k="Kilde" v={PL.SRC[item.src]} />
                <Meta k="Status" v={st.label} c={st.c} />
              </div>
            </div>
            {item.phone && <div className="pl-sec">
              <h5>Kontakt</h5>
              <div className="pl-person"><span className="so-av" style={{ width: 34, height: 34, fontSize: 12, background: "var(--info)" }}>{item.name[0]}</span><div><div className="nm">{item.name}</div><div className="rl mono">{item.phone}</div></div><button className="pl-act act" style={{ height: 32, padding: "0 12px" }}><Ic n="phone" s={14} /> Ring</button></div>
            </div>}
            {item.note && <div className="pl-sec"><h5>Notat</h5><div className="pl-note">{item.note}</div></div>}
          </div>
          <div className="pl-over-foot">
            {item.status === "pending" ? <button className="pl-act ok" onClick={() => toast("Booking bekreftet", { undo: () => {} })}><Ic n="check" s={15} sw={2.3} /> Bekreft</button>
              : <button className="pl-act" onClick={() => toast("Booking åpnet")}><Ic n="pen" s={15} /> Endre</button>}
            <span className="sp" />
            <button className="pl-act danger" onClick={() => toast("Booking avlyst", { undo: () => {} })}><Ic n="x" s={15} /> Avlys</button>
          </div>
        </Shell>
      );
    }

    // ---- EVENT ----
    if (type === "event") {
      const dm = PL.DEMAND[item.demand], season = PL.SEASONS.find(s => s.id === item.season);
      return (
        <Shell onClose={onClose}>
          <TypeHead icon="ticket" label="Event" c="var(--orange)"
            title={item.title}
            sub={<><span className="pl-statpill" style={{ background: "var(--orange-soft)", color: "var(--orange-dark)" }}><Ic n="trendUp" s={10} /> {dm.label} demand</span> · {item.allday ? "Hele dagen" : item.t}</>}
            onClose={onClose} />
          <div className="pl-over-body">
            <div className="pl-sec">
              <div className="pl-meta-grid">
                <Meta k="Tid" v={item.allday ? "Heldags" : item.t} mono />
                <Meta k="Avdeling" v={PL.DEPT[item.dep].name} c={PL.DEPT[item.dep].c} />
                <Meta k="Demand" v={dm.label} c={dm.c} />
                <Meta k="Bemanning" v={item.staffing} />
              </div>
            </div>
            {item.note && <div className="pl-sec"><h5>Om eventet</h5><div className="pl-note">{item.note}</div></div>}
            <div className="pl-sec">
              <h5>Bemanningskonsekvens</h5>
              <div className="pl-callout info"><span className="ic"><Ic n="users" s={16} /></span><div className="ct-body">Eventet krever <strong>{item.staffing}</strong>. {item.demand === "high" ? "Sjekk dekning i vaktplanen før dagen." : "Innenfor normal bemanning."}</div></div>
            </div>
            {season && <div className="pl-sec">
              <h5>Sesongkontekst</h5>
              <div className="pl-person" style={{ cursor: "pointer" }} onClick={() => onClose()}><span style={{ width: 30, height: 30, borderRadius: 8, background: `color-mix(in oklab, ${season.c} 18%, transparent)`, color: season.c, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Ic n="wheel" s={16} /></span><div><div className="nm">{season.name}</div><div className="rl">{season.concept}</div></div><span className="act"><Ic n="chevRight" s={16} c="var(--muted)" /></span></div>
            </div>}
          </div>
          <div className="pl-over-foot">
            <button className="pl-act" onClick={() => goRoute("vaktplan")}><Ic n="grid" s={15} /> Til vaktplan</button>
            <span className="sp" />
            <button className="pl-act primary" onClick={() => toast("Event åpnet for redigering")}><Ic n="pen" s={15} /> Rediger</button>
          </div>
        </Shell>
      );
    }

    // ---- LEAVE ----
    if (type === "leave") {
      const e = PL.empById(item.e), st = PL.LSTATUS[item.status];
      const fmt = (iso) => { const [m, d] = iso.split("-"); return `${d}. ${PL.MONTH_NAMES[+m - 1].toLowerCase()}`; };
      return (
        <Shell onClose={onClose}>
          <TypeHead icon="umbrella" label="Fravær" c="var(--warning)"
            title={item.kind}
            sub={<><span className="so-av" style={{ width: 20, height: 20, fontSize: 9, background: e.c }}>{e.init}</span>{e.name} · <span className="pl-statpill" style={{ background: st.soft, color: st.c }}>{st.label}</span></>}
            onClose={onClose} />
          <div className="pl-over-body">
            {item.conflict && <div className="pl-callout warn" style={{ marginTop: 14 }}><span className="ic"><Ic n="alert" s={16} /></span><div className="ct-body"><strong>Konflikt med vaktplan.</strong> {item.impact}</div></div>}
            <div className="pl-sec">
              <div className="pl-meta-grid">
                <Meta k="Ansatt" v={e.name} />
                <Meta k="Type" v={item.kind} />
                <Meta k="Fra" v={fmt(item.from)} />
                <Meta k="Til" v={fmt(item.to)} />
                <Meta k="Dager" v={item.days} mono />
                <Meta k="Status" v={st.label} c={st.c} />
              </div>
            </div>
            {item.impact && !item.conflict && <div className="pl-sec"><h5>Konsekvens for dekning</h5><div className="pl-note">{item.impact}</div></div>}
            {item.note && <div className="pl-sec"><h5>Merknad</h5><div className="pl-note">{item.note}</div></div>}
          </div>
          {item.status === "pending" ? (
            <div className="pl-over-foot">
              <button className="pl-act ok" onClick={() => toast("Fravær godkjent", { undo: () => {} })}><Ic n="check" s={15} sw={2.3} /> Godkjenn</button>
              <button className="pl-act danger" onClick={() => toast("Fravær avslått", { undo: () => {} })}><Ic n="x" s={15} /> Avslå</button>
              <span className="sp" />
              <button className="pl-act" onClick={() => goRoute("vaktplan")} title="Se dekning"><Ic n="grid" s={15} /></button>
            </div>
          ) : (
            <div className="pl-over-foot"><span className="pl-statpill" style={{ background: st.soft, color: st.c, height: 30 }}>{st.label}</span><span className="sp" /><button className="pl-act" onClick={onClose}>Lukk</button></div>
          )}
        </Shell>
      );
    }

    // ---- SEASON ----
    if (type === "season") {
      const s = PL.SEASONS.find(x => x.id === item.id) || PL.SEASONS[1];
      return (
        <Shell onClose={onClose}>
          <TypeHead icon="wheel" label="Sesong" c={s.c}
            title={s.name} sub={s.concept} onClose={onClose} />
          <div className="pl-over-body">
            <div className="pl-sec">
              <div className="pl-meta-grid">
                <Meta k="Status" v={s.status === "active" ? "Aktiv" : s.status === "planned" ? "Planlagt" : "Arkivert"} />
                <Meta k="Demand" v={s.demand} c={s.c} />
              </div>
            </div>
            <div className="pl-sec"><h5>Servicekonsept</h5><div className="pl-note">{s.note}</div></div>
            <div className="pl-sec">
              <h5>Planlagte hendelser</h5>
              <div className="pl-coworkers" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                {s.events.map(ev => <span key={ev} className="pl-cw" style={{ justifyContent: "flex-start" }}><span style={{ width: 7, height: 7, borderRadius: 9, background: s.c }} />{ev}</span>)}
              </div>
            </div>
          </div>
          <div className="pl-over-foot"><button className="pl-act" onClick={() => goRoute("vaktplan")}><Ic n="grid" s={15} /> Planlegg bemanning</button><span className="sp" /><button className="pl-act primary" onClick={() => toast("Åpner årshjul-detalj")}>Åpne i årshjul</button></div>
        </Shell>
      );
    }

    // ---- YEAR PIN ----
    if (type === "pin") {
      const p = PL.YEAR_PINS.find(x => x.iso === item.id), s = p && PL.SEASONS.find(x => x.id === p.season);
      if (!p) return null;
      const kindLabel = { menu: "Menylansering", event: "Arrangement", ops: "Drift", staffing: "Bemanning", booking: "Booking" }[p.kind] || "Hendelse";
      return (
        <Shell onClose={onClose}>
          <TypeHead icon="bookmark" label="Planhendelse" c={s ? s.c : "var(--orange)"}
            title={p.title} sub={<>{p.d}. {PL.MONTH_NAMES[p.m - 1]} 2026 · {s ? s.name : ""}</>} onClose={onClose} />
          <div className="pl-over-body">
            <div className="pl-sec"><div className="pl-meta-grid"><Meta k="Type" v={kindLabel} /><Meta k="Sesong" v={s ? s.name : "—"} c={s ? s.c : null} /></div></div>
            <div className="pl-sec"><div className="pl-callout info"><span className="ic"><Ic n="info" s={16} /></span><div className="ct-body">Planhendelser fra årshjulet driver konkret operativ planlegging — meny, bemanning og bookinger kobles hit.</div></div></div>
          </div>
          <div className="pl-over-foot"><span className="sp" /><button className="pl-act primary" onClick={() => toast("Åpner i årsplan")}>Åpne i årsplan</button></div>
        </Shell>
      );
    }

    // ---- ATTENTION ----
    if (type === "attention") {
      const a = PL.ATTENTION.find(x => x.id === item.id);
      if (!a) return null;
      const sevC = a.sev === "crit" ? "var(--error)" : a.sev === "warn" ? "var(--warning)" : "var(--orange)";
      const doAction = () => {
        if (a.id === "a4") { openHours && openHours(); return; }
        if (a.type === "booking") { const b = PL.BOOKINGS.find(x => x.id === a.ref); if (b) return window.__plOpen && window.__plOpen(b); }
        if (a.type === "leave") { const l = PL.LEAVE.find(x => x.id === a.ref); if (l) return window.__plOpen && window.__plOpen(l); }
        goRoute("vaktplan");
      };
      return (
        <Shell onClose={onClose}>
          <TypeHead icon={a.icon} label={a.sev === "crit" ? "Kritisk" : a.sev === "warn" ? "Følg opp" : "Info"} c={sevC}
            title={a.title} sub={null} onClose={onClose} />
          <div className="pl-over-body">
            <div className="pl-sec" style={{ borderBottom: "none" }}><div className="pl-note" style={{ background: "transparent", padding: 0, fontSize: 14, lineHeight: 1.6 }}>{a.body}</div></div>
            <BotCard text={<span>Jeg overvåker dekning, åpningstider og bookinger. Dette er flagget fordi <span className="hl">det kan gi varekast eller dårlig gjesteopplevelse</span> hvis det ikke løses før dagen.</span>} src={["Vaktplan", "Åpningstider", "Bookinger"]} cta={a.action} toastMsg={a.action + " utført"} />
          </div>
          <div className="pl-over-foot"><span className="sp" /><button className="pl-act primary" onClick={doAction}>{a.action} <Ic n="arrowRight" s={15} /></button></div>
        </Shell>
      );
    }
    return null;
  }

  // ---------------- booking creation ----------------
  function BookingCreatePanel({ slot, onClose }) {
    const toast = window.useToast();
    const [btype, setBtype] = useState("Bord");
    const [dep, setDep] = useState("sal");
    const [guests, setGuests] = useState(4);
    const w = PL.WEEK.find(x => x.iso === (slot && slot.iso)) || PL.WEEK[3];
    const [st, setSt] = useState(slot && slot.st != null ? slot.st : 18);
    const en = st + 2;
    const h = PL.hoursFor(w.iso, w.wd);
    const outside = h.open == null || st < h.open || en > h.close;
    const over = guests > 40;
    return (
      <Shell onClose={onClose}>
        <TypeHead icon="utensils" label="Ny booking" c={PL.ETYPE.booking.c}
          title="Ny booking" sub={<>{w.dl} {w.d}. {PL.MONTH_NAMES[w.m - 1].toLowerCase()} · {PL.pad(st)}–{PL.pad(en)}</>} onClose={onClose} />
        <div className="pl-over-body">
          <div className={`pl-avail ${outside || over ? "warn" : "ok"}`} style={{ marginTop: 14 }}>
            <Ic n={outside || over ? "alert" : "check"} s={16} sw={2.2} />
            {h.open == null ? <span><strong>Stengt denne dagen.</strong> Sett åpningstid før booking.</span>
              : outside ? <span><strong>Utenfor åpningstid</strong> ({h.label}). Bekreft unntak ved lagring.</span>
              : over ? <span><strong>Overbooking?</strong> {guests} gjester krever eget oppsett.</span>
              : <span><strong>Ledig kapasitet.</strong> Innenfor åpningstid {h.label}.</span>}
          </div>
          <div className="pl-form-grp"><label>Type</label><div className="pl-segopts">{["Bord", "Selskap", "Event"].map(t => <button key={t} className={`pl-segopt ${btype === t ? "on" : ""}`} onClick={() => setBtype(t)}>{t}</button>)}</div></div>
          <div className="pl-form-grp"><label>Avdeling / ressurs</label><div className="pl-segopts">{Object.values(PL.DEPT).map(d => <button key={d.id} className={`pl-segopt ${dep === d.id ? "on" : ""}`} onClick={() => setDep(d.id)}><span className="sw" style={{ background: d.c }} />{d.name}</button>)}</div></div>
          <div className="pl-row2">
            <div className="pl-form-grp"><label>Starttid</label><div className="pl-stepper"><button onClick={() => setSt(s => Math.max(8, s - 1))}><Ic n="chevDown" s={16} /></button><span className="val">{PL.pad(st)}</span><button onClick={() => setSt(s => Math.min(24, s + 1))}><Ic n="chevUp" s={16} /></button></div></div>
            <div className="pl-form-grp"><label>Gjester</label><div className="pl-stepper"><button onClick={() => setGuests(g => Math.max(1, g - 1))}><Ic n="chevDown" s={16} /></button><span className="val">{guests}</span><button onClick={() => setGuests(g => g + 1)}><Ic n="chevUp" s={16} /></button></div></div>
          </div>
          <div className="pl-form-grp"><label>Navn / kontakt</label><input className="pl-input" placeholder="Gjestens navn" /></div>
          <div className="pl-form-grp"><label>Bord</label><input className="pl-input" placeholder="Velg bord eller la stå tomt" defaultValue={btype === "Event" ? "Hele sal" : "Bord 7"} /></div>
          <div className="pl-form-grp"><label>Notat</label><textarea className="pl-input" rows={2} placeholder="Allergier, anledning, ønsker…" /></div>
        </div>
        <div className="pl-over-foot">
          <button className="pl-act" onClick={onClose}>Avbryt</button>
          <span className="sp" />
          <button className="pl-act primary" onClick={() => { toast(`Booking opprettet · ${guests} gj. ${w.dl} ${PL.pad(st)}`, { undo: () => {} }); onClose(); }}><Ic n="check" s={15} sw={2.3} /> Opprett booking</button>
        </div>
      </Shell>
    );
  }

  // ---------------- opening hours management ----------------
  function OpeningHoursPanel({ onClose }) {
    const toast = window.useToast();
    const DN = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];
    return (
      <Shell onClose={onClose}>
        <div className="pl-over-head">
          <div className="toprow"><KindPill icon="door" label="Åpningstider" c="var(--muted)" /><span style={{ flex: 1 }} /><button className="icbtn" onClick={onClose}><Ic n="x" s={18} /></button></div>
          <h2 className="pl-over-title">Åpningstider</h2>
          <div className="pl-over-sub">Bistro Nord · standard uke + unntak</div>
        </div>
        <div className="pl-over-body">
          <div className="pl-sec">
            <h5>Standard uke</h5>
            {PL.HOURS_STD.map((h, i) => (
              <div key={i} className="pl-oh-day">
                <span className="pl-oh-dn">{DN[i]}</span>
                <span className="pl-oh-times"><Ic n="clock" s={13} c="var(--muted)" /> {h.label}</span>
                <button className="pl-oh-edit" onClick={() => toast(`${DN[i]} åpnet for redigering`)}><Ic n="pen" s={14} /></button>
              </div>
            ))}
          </div>
          <div className="pl-sec">
            <h5>Unntak & spesialdager</h5>
            {PL.HOURS_EXC.map((e, i) => {
              const c = e.kind === "closed" ? "var(--error)" : e.kind === "special" ? "var(--info)" : "var(--orange)";
              const lbl = e.kind === "closed" ? "Stengt" : e.kind === "special" ? "Spesial" : "Utvidet";
              const [m, d] = e.iso.split("-");
              return (
                <div key={i} className="pl-oh-exc">
                  <span className="badge" style={{ background: `color-mix(in oklab, ${c} 13%, transparent)`, color: c }}>{lbl}</span>
                  <div className="b"><div className="d">{d}. {PL.MONTH_NAMES[+m - 1].toLowerCase()} · {e.label}</div><div className="n">{e.note}</div></div>
                  <button className="pl-oh-edit" onClick={() => toast("Unntak åpnet")}><Ic n="pen" s={14} /></button>
                </div>
              );
            })}
            <button className="pl-act" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} onClick={() => toast("Nytt unntak")}><Ic n="plus" s={15} /> Legg til unntak</button>
          </div>
        </div>
        <div className="pl-over-foot"><button className="pl-act" onClick={onClose}>Avbryt</button><span className="sp" /><button className="pl-act primary" onClick={() => { toast("Åpningstider lagret"); onClose(); }}>Lagre</button></div>
      </Shell>
    );
  }

  // ---------------- conflict / needs-attention panel ----------------
  function AttentionPanel({ onClose, onOpen }) {
    const crit = PL.ATTENTION.filter(a => a.sev === "crit").length;
    const fmt = (iso) => { const [m, d] = iso.split("-"); return `${d}/${m}`; };
    return (
      <Shell onClose={onClose}>
        <div className="pl-over-head">
          <div className="toprow"><KindPill icon="alert" label="Krever oppmerksomhet" c="var(--error)" /><span style={{ flex: 1 }} /><button className="icbtn" onClick={onClose}><Ic n="x" s={18} /></button></div>
          <h2 className="pl-over-title">Krever oppmerksomhet</h2>
          <div className="pl-over-sub">{PL.ATTENTION.length} saker denne uka · {crit} kritiske</div>
        </div>
        <div className="pl-over-body">
          <BotCard text={<span>Jeg har gått gjennom uka. <strong>Fredag</strong> er den tetteste dagen: <span className="hl">Live jazz</span> gir høy demand samtidig som det mangler bemanning og en booking ligger utenfor åpningstid. Ta de to kritiske først.</span>} src={["Vaktplan", "Bookinger", "Åpningstider", "Eventer"]} cta="Lag tiltaksliste" toastMsg="Tiltaksliste klargjort" />
          <div className="pl-attn-list" style={{ marginTop: 4 }}>
            {PL.ATTENTION.map(a => (
              <div key={a.id} className={`pl-attn ${a.sev}`} onClick={() => onOpen({ type: "attention", id: a.id })}>
                <span className="pl-attn-ic"><Ic n={a.icon} s={17} /></span>
                <div className="pl-attn-b">
                  <div className="t">{a.title}<span className="when">{fmt(a.iso)}</span></div>
                  <div className="body">{a.body}</div>
                  <div className="cta">{a.action} <Ic n="arrowRight" s={13} /></div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="pl-over-foot"><span className="sp" /><button className="pl-act" onClick={onClose}>Lukk</button></div>
      </Shell>
    );
  }

  window.PLPanels = { DetailPanel, BookingCreatePanel, OpeningHoursPanel, AttentionPanel, BotCard };
})();
