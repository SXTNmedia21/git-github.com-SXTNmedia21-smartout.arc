// ===== Avstemming — forms & overlays (window.RecForms) =====
// Modals/drawers shared across the daily flow: shift hours edit (F-03),
// revenue adjust (F-04), deviation resolve (F-05), request handoff (F-09),
// day reject (F-07), day lock (F-08), bulk approve (F-13).
(function () {
  const { useState } = React;
  const Ic = window.Ic;
  const D = () => window.SmartoutData;

  // ---------- F-03 Shift hours edit ----------
  function ShiftEdit({ day, shift, onClose, onSubmit }) {
    const R = window.Rec;
    const [hours, setHours] = useState(shift.calculated);
    const [just, setJust] = useState("");
    const [disputed, setDisputed] = useState(shift.status === "disputed");
    const e = D().REC_IDENT(shift.uid);
    const changed = Math.abs(hours - shift.calculated) > 0.001;
    const needJust = changed;
    const valid = !needJust || just.trim().length > 0;
    return (
      <R.Scrim onClose={onClose}>
        <div className="rec-modal" onMouseDown={(ev) => ev.stopPropagation()}>
          <div className="rec-modal-h"><span className="t">Rediger timer</span><span className="x" onClick={onClose}><Ic n="x" s={18} /></span></div>
          <div className="rec-modal-b">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <R.Av uid={shift.uid} size={36} />
              <div><div style={{ fontWeight: 600 }}>{e.name}</div><div style={{ fontSize: 12, color: "var(--muted)" }}>{shift.role} · {shift.deptName} · {day.weekday} {day.dateLabel}</div></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
              {[["Planlagt", shift.planned], ["Beregnet", shift.calculated]].map(([l, v]) => (
                <div key={l} style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--secondary)" }}>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--muted)" }}>{l}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 600 }}>{R.h1(v)}t</div>
                </div>
              ))}
              <div style={{ padding: "10px 12px", border: "1px solid var(--orange)", borderRadius: 10, background: "color-mix(in oklab, var(--orange) 6%, transparent)" }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--orange)" }}>Godkjent</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700 }}>{R.h1(hours)}t</div>
              </div>
            </div>
            <R.Field label="Godkjente timer" hint="0,25t steg">
              <input className="rec-input mono" type="number" step="0.25" value={hours} onChange={(ev) => setHours(parseFloat(ev.target.value) || 0)} />
            </R.Field>
            {needJust && (
              <R.Field label="Begrunnelse" required hint={`avviker fra beregnet (${R.h1(shift.calculated)}t)`}>
                <textarea className="rec-textarea" value={just} onChange={(ev) => setJust(ev.target.value)} placeholder="Hvorfor justeres timene?" />
              </R.Field>
            )}
            <label className="rec-radio" style={{ marginTop: 2 }} onClick={() => setDisputed((d) => !d)}>
              <span className={`rec-checkbox ${disputed ? "on" : ""}`}>{disputed && <Ic n="check" s={12} />}</span>
              <span className="rl"><span className="rt">Merk som omtvistet</span><span className="rs">Blokkerer dag-godkjenning til løst</span></span>
            </label>
          </div>
          <div className="rec-modal-f">
            <button className="rec-btn ghost" onClick={onClose}>Avbryt</button>
            <span style={{ flex: 1 }} />
            <button className="rec-btn primary" disabled={!valid} onClick={() => onSubmit(shift.uid, { hours, just, disputed })}><Ic n="check" s={14} /> Lagre timer</button>
          </div>
        </div>
      </R.Scrim>
    );
  }

  // ---------- F-04 Revenue adjust ----------
  function RevenueAdjust({ day, onClose, onSubmit }) {
    const R = window.Rec;
    const r = day.revenue;
    const [total, setTotal] = useState(r.total || 0);
    const [cash, setCash] = useState(r.cashCounted != null ? r.cashCounted : (r.cash || 0));
    const [reason, setReason] = useState("");
    const valid = reason.trim().length > 2;
    return (
      <R.Scrim onClose={onClose}>
        <div className="rec-modal" onMouseDown={(ev) => ev.stopPropagation()}>
          <div className="rec-modal-h"><span className="t">Juster omsetning</span><span className="x" onClick={onClose}><Ic n="x" s={18} /></span></div>
          <div className="rec-modal-b">
            <div className="rec-warnbox"><span className="ic"><Ic n="alert" s={16} /></span><div>Manuell justering logges som egen valideringspost med diff og begrunnelse. Originalt iSettle-tall bevares.</div></div>
            <R.Field label="Total omsetning" hint="kr"><input className="rec-input mono" type="number" value={total} onChange={(e) => setTotal(parseFloat(e.target.value) || 0)} /></R.Field>
            <R.Field label="Talt kontant" hint="kr"><input className="rec-input mono" type="number" value={cash} onChange={(e) => setCash(parseFloat(e.target.value) || 0)} /></R.Field>
            <R.Field label="Begrunnelse for justering" required><textarea className="rec-textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="F.eks. veksel til event-depositum ikke registrert i kasse" /></R.Field>
          </div>
          <div className="rec-modal-f"><button className="rec-btn ghost" onClick={onClose}>Avbryt</button><span style={{ flex: 1 }} /><button className="rec-btn primary" disabled={!valid} onClick={() => onSubmit({ total, cash, reason })}><Ic n="check" s={14} /> Lagre justering</button></div>
        </div>
      </R.Scrim>
    );
  }

  // ---------- F-05 Deviation resolve ----------
  function DeviationResolve({ day, dev, onClose, onSubmit }) {
    const R = window.Rec;
    const [notes, setNotes] = useState(dev.suggestion ? "" : "");
    const [cost, setCost] = useState("");
    const sev = R.sevMeta(dev.severity);
    const needNote = dev.severity === "critical" || dev.severity === "high";
    const valid = !needNote || notes.trim().length > 0;
    return (
      <R.Scrim onClose={onClose}>
        <div className="rec-modal" onMouseDown={(ev) => ev.stopPropagation()}>
          <div className="rec-modal-h"><span className="t">{needNote ? "Løs avvik" : "Bekreft avvik"}</span><span className="x" onClick={onClose}><Ic n="x" s={18} /></span></div>
          <div className="rec-modal-b">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span className={`rec-pill ${sev.tone}`}><span className="ic"><Ic n="alert" s={11} /></span>{sev.label}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", background: "var(--secondary)", padding: "2px 6px", borderRadius: 5 }}>{dev.code}</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{dev.title}</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", margin: "5px 0 16px", lineHeight: 1.5 }}>{dev.detail}</div>
            {dev.suggestion && (
              <div style={{ padding: "11px 13px", borderRadius: 10, background: "color-mix(in oklab, var(--orange) 5%, var(--card))", border: "1px solid color-mix(in oklab, var(--orange) 24%, transparent)", marginBottom: 16 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--orange)", display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}><Ic n="bot" s={12} /> Botsson foreslår</div>
                <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>{dev.suggestion}</div>
              </div>
            )}
            <R.Field label={needNote ? "Løsningsnotat" : "Kommentar"} required={needNote} hint={needNote ? "kort begrunnelse" : "valgfritt"}><textarea className="rec-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={needNote ? "Hva ble gjort for å løse avviket?" : "Legg ev. ved en kort merknad …"} /></R.Field>
            <R.Field label="Kostnadseffekt" hint="valgfritt · kr"><input className="rec-input mono" type="number" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" /></R.Field>
          </div>
          <div className="rec-modal-f"><button className="rec-btn ghost" onClick={onClose}>Avbryt</button><span style={{ flex: 1 }} /><button className="rec-btn primary" disabled={!valid} onClick={() => onSubmit(dev.id, { notes, cost })}><Ic n="check" s={14} /> {needNote ? "Marker løst" : "Bekreft"}</button></div>
        </div>
      </R.Scrim>
    );
  }

  // ---------- F-09 Request handoff ----------
  function HandoffRequest({ day, seed, onClose, onSubmit }) {
    const R = window.Rec;
    const [scope, setScope] = useState(seed && seed.scope || "deviation");
    const [channel, setChannel] = useState("chat");
    const [ctx, setCtx] = useState(seed && seed.context || "");
    const [deadline, setDeadline] = useState(8);
    const scopes = [["day", "Hele dagen", "Alt rundt dagsoppgjøret"], ["shift", "En vakt", "Spesifikk vakt/timer"], ["deviation", "Et avvik", "Spesifikt avvik å avklare"]];
    return (
      <R.Scrim onClose={onClose}>
        <div className="rec-modal" onMouseDown={(ev) => ev.stopPropagation()}>
          <div className="rec-modal-h"><span className="t">Be om avklaring</span><span className="x" onClick={onClose}><Ic n="x" s={18} /></span></div>
          <div className="rec-modal-b">
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14, lineHeight: 1.5 }}>Botsson starter en samtale med ansatt for å avklare. Svarer de ikke innen fristen, eskaleres det til telefon.</div>
            <R.Field label="Omfang" required>
              <div className="rec-radios">
                {scopes.map(([v, t, s]) => (
                  <label key={v} className={`rec-radio ${scope === v ? "on" : ""}`} onClick={() => setScope(v)}><span className="rd" /><span className="rl"><span className="rt">{t}</span><span className="rs">{s}</span></span></label>
                ))}
              </div>
            </R.Field>
            <R.Field label="Kanal"><R.Seg value={channel} opts={[["chat", "Chat (AI)"], ["voice", "Telefon"]]} onChange={setChannel} /></R.Field>
            <R.Field label="Kontekst til Botsson" hint="valgfritt"><textarea className="rec-textarea" value={ctx} onChange={(e) => setCtx(e.target.value)} placeholder="Hva skal ansatt avklare? Sendes som start på samtalen." /></R.Field>
            <R.Field label="Frist" hint="timer før eskalering"><input className="rec-input mono" type="number" value={deadline} onChange={(e) => setDeadline(parseInt(e.target.value) || 8)} style={{ width: 90 }} /></R.Field>
          </div>
          <div className="rec-modal-f"><button className="rec-btn ghost" onClick={onClose}>Avbryt</button><span style={{ flex: 1 }} /><button className="rec-btn primary" onClick={() => onSubmit({ scope, channel, ctx, deadline })}><Ic n="message" s={14} /> Start handoff</button></div>
        </div>
      </R.Scrim>
    );
  }

  // ---------- F-07 Day reject ----------
  function DayReject({ day, onClose, onSubmit }) {
    const R = window.Rec;
    const [reason, setReason] = useState("");
    const valid = reason.trim().length >= 10;
    return (
      <R.Scrim onClose={onClose}>
        <div className="rec-modal" onMouseDown={(ev) => ev.stopPropagation()}>
          <div className="rec-modal-h"><span className="t">Avvis dagen</span><span className="x" onClick={onClose}><Ic n="x" s={18} /></span></div>
          <div className="rec-modal-b">
            <div className="rec-warnbox"><span className="ic"><Ic n="alert" s={16} /></span><div>Dagen settes tilbake til «Åpen». {day.settledBy ? D().REC_IDENT(day.settledBy).name : "Ansatt"} får varsel om at oppgjøret må gjøres på nytt.</div></div>
            <R.Field label="Begrunnelse" required hint="min. 10 tegn — sendes til ansatt"><textarea className="rec-textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Hva må rettes før dagen kan godkjennes?" /></R.Field>
          </div>
          <div className="rec-modal-f"><button className="rec-btn ghost" onClick={onClose}>Avbryt</button><span style={{ flex: 1 }} /><button className="rec-btn danger" disabled={!valid} onClick={() => onSubmit(reason)}><Ic n="undo" s={14} /> Avvis & send tilbake</button></div>
        </div>
      </R.Scrim>
    );
  }

  // ---------- F-08 Day lock ----------
  function DayLock({ day, onClose, onConfirm }) {
    const R = window.Rec;
    return (
      <R.Scrim onClose={onClose}>
        <div className="rec-modal" onMouseDown={(ev) => ev.stopPropagation()}>
          <div className="rec-modal-h"><span className="t">Lås dagen</span><span className="x" onClick={onClose}><Ic n="x" s={18} /></span></div>
          <div className="rec-modal-b">
            <div className="rec-warnbox"><span className="ic"><Ic n="lock" s={16} /></span><div><b>Dette kan ikke angres.</b> Når {day.weekday.toLowerCase()} {day.dateLabel} låses, fryses omsetning, timer og avvik permanent. Tallene går videre til lønnsgrunnlaget.</div></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "var(--border)", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ background: "var(--card)", padding: "12px 14px" }}><div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--muted)" }}>Omsetning</div><div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 600 }}>{R.kr(day.revenue.total)}</div></div>
              <div style={{ background: "var(--card)", padding: "12px 14px" }}><div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--muted)" }}>Timer</div><div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 600 }}>{R.h1(day.hours.total)}t</div></div>
            </div>
          </div>
          <div className="rec-modal-f"><button className="rec-btn ghost" onClick={onClose}>Avbryt</button><span style={{ flex: 1 }} /><button className="rec-btn primary" onClick={onConfirm}><Ic n="lock" s={14} /> Lås permanent</button></div>
        </div>
      </R.Scrim>
    );
  }

  // ---------- F-13 Bulk approve ----------
  function BulkApprove({ days, onClose, onConfirm }) {
    const R = window.Rec;
    const ready = days.filter((d) => D().REC_PREFLIGHT(d).length === 0);
    const blocked = days.filter((d) => D().REC_PREFLIGHT(d).length > 0);
    const [running, setRunning] = useState(false);
    const [progress, setProgress] = useState(0);
    const run = () => {
      setRunning(true);
      let i = 0;
      const iv = setInterval(() => {
        i++; setProgress(Math.round((i / ready.length) * 100));
        if (i >= ready.length) { clearInterval(iv); setTimeout(() => onConfirm(ready.map((d) => d.id)), 350); }
      }, 260);
    };
    return (
      <R.Scrim onClose={running ? undefined : onClose}>
        <div className="rec-modal lg" onMouseDown={(ev) => ev.stopPropagation()}>
          <div className="rec-modal-h"><span className="t">Godkjenn valgte dager</span>{!running && <span className="x" onClick={onClose}><Ic n="x" s={18} /></span>}</div>
          <div className="rec-modal-b">
            {running ? (
              <div style={{ padding: "8px 0" }}>
                <div style={{ fontSize: 13, marginBottom: 4 }}>Godkjenner {ready.length} dager … {progress}%</div>
                <div className="rec-progress"><i style={{ width: progress + "%" }} /></div>
                <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Hver dag godkjennes atomisk — feil på én ruller ikke tilbake de andre.</div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14 }}>Bare dager uten blokkere kan godkjennes samlet. Blokkerte dager må håndteres enkeltvis.</div>
                <div className="rec-checklist">
                  {ready.map((d) => (
                    <div key={d.id} className="rec-clitem ok"><span className="ci"><Ic n="check" s={12} /></span><span className="cl">{d.weekday} {d.dateLabel}</span><span className="cs">{R.kr(d.revenue.total)}</span></div>
                  ))}
                  {blocked.map((d) => {
                    const pf = D().REC_PREFLIGHT(d);
                    return <div key={d.id} className="rec-clitem bad"><span className="ci"><Ic n="alert" s={12} /></span><span className="cl">{d.weekday} {d.dateLabel}</span><span className="cs">{pf.length} blokker</span></div>;
                  })}
                </div>
              </>
            )}
          </div>
          {!running && <div className="rec-modal-f"><button className="rec-btn ghost" onClick={onClose}>Avbryt</button><span style={{ flex: 1 }} /><button className="rec-btn primary" disabled={!ready.length} onClick={run}><Ic n="check" s={14} /> Godkjenn {ready.length} {ready.length === 1 ? "dag" : "dager"}</button></div>}
        </div>
      </R.Scrim>
    );
  }

  // ---------- Shift approval (rich) — godkjenn / foreslå ny tid / manuelle tillegg ----------
  const SUPP_TYPES = [
    ["overtid", "Overtid 50%"],
    ["kveld", "Kveldstillegg 25%"],
    ["helg", "Helgtillegg 50%"],
    ["bonus", "Bonus / engangstillegg"],
  ];
  function ShiftApprove({ day, shift, dev, onClose, onSubmit }) {
    const R = window.Rec;
    const e = D().REC_IDENT(shift.uid);
    const [mode, setMode] = useState(shift.status === "disputed" ? "propose" : "approve");
    const [hours, setHours] = useState(shift.calculated);
    const [note, setNote] = useState("");
    const [supps, setSupps] = useState([]);
    const [stype, setStype] = useState("overtid");
    const [samount, setSamount] = useState("");
    const over = shift.calculated > shift.planned;
    const suppSum = supps.reduce((a, s) => a + s.amount, 0);
    const addSupp = () => {
      const amt = parseInt(samount, 10);
      if (!amt) return;
      const lbl = (SUPP_TYPES.find((t) => t[0] === stype) || [])[1];
      setSupps((s) => [...s, { id: Date.now(), type: stype, label: lbl, amount: amt }]);
      setSamount("");
    };
    const proposeValid = mode === "approve" || (Math.abs(hours - shift.calculated) > 0.001 ? note.trim().length > 0 : true);

    return (
      <R.Scrim onClose={onClose}>
        <div className="rec-modal lg" onMouseDown={(ev) => ev.stopPropagation()}>
          <div className="rec-modal-h"><span className="t">Godkjenn vakt</span><span className="x" onClick={onClose}><Ic n="x" s={18} /></span></div>
          <div className="rec-modal-b">
            {/* employee */}
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
              <R.Av uid={shift.uid} size={40} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{e.name}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{shift.role} · {shift.deptName} · {day.weekday} {day.dateLabel}</div>
              </div>
              <span className={`rec-pill ${shift.status === "disputed" ? "error" : "warning"}`}>{shift.status === "disputed" ? "Omtvistet" : "Venter"}</span>
            </div>

            {/* hours strip */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, background: "var(--border)", borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
              {[["Planlagt", shift.planned, ""], ["Beregnet", shift.calculated, over ? "var(--warning)" : ""], ["Godkjennes", mode === "approve" ? shift.calculated : hours, "var(--orange)"]].map(([l, v, col]) => (
                <div key={l} style={{ background: "var(--card)", padding: "11px 13px" }}>
                  <div style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--muted)" }}>{l}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 17, fontWeight: 700, color: col || "var(--fg)" }}>{R.h1(v)}t</div>
                </div>
              ))}
            </div>

            {dev && <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14, lineHeight: 1.45 }}>{dev.detail}</div>}
            {shift.note && <div style={{ fontSize: 12.5, color: "var(--fg)", background: "var(--secondary)", borderRadius: 8, padding: "9px 11px", marginBottom: 14 }}><b style={{ fontWeight: 600 }}>Ansattes notat:</b> «{shift.note}»</div>}

            {/* mode switch */}
            <div className="rec-field">
              <div className="lab"><span className="t">Hvordan løse</span></div>
              <div className="rec-radios">
                <label className={`rec-radio ${mode === "approve" ? "on" : ""}`} onClick={() => setMode("approve")}><span className="rd" /><span className="rl"><span className="rt">Godkjenn beregnet ({R.h1(shift.calculated)}t)</span><span className="rs">Bekreft timene slik de er stemplet</span></span></label>
                <label className={`rec-radio ${mode === "propose" ? "on" : ""}`} onClick={() => setMode("propose")}><span className="rd" /><span className="rl"><span className="rt">Foreslå ny tid</span><span className="rs">Sendes til {e.name} for godkjenning før den teller</span></span></label>
              </div>
            </div>

            {mode === "propose" && (
              <div style={{ padding: "2px 0 4px" }}>
                <R.Field label="Foreslåtte timer" hint="0,25t steg"><input className="rec-input mono" type="number" step="0.25" value={hours} onChange={(ev) => setHours(parseFloat(ev.target.value) || 0)} style={{ width: 120 }} /></R.Field>
                <R.Field label="Melding til ansatt" required={Math.abs(hours - shift.calculated) > 0.001}><textarea className="rec-textarea" value={note} onChange={(ev) => setNote(ev.target.value)} placeholder={`F.eks. «Jeg setter ${R.h1(hours)}t — ekstra rydding var ikke avtalt. Godkjenn hvis ok.»`} /></R.Field>
              </div>
            )}

            {/* manual supplements */}
            <div className="rec-field" style={{ marginTop: 4 }}>
              <div className="lab"><span className="t">Manuelle tillegg</span>{suppSum > 0 && <span className="hint">Σ {R.kr(suppSum)}</span>}</div>
              {supps.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 9 }}>
                  {supps.map((s) => (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 11px", border: "1px solid var(--border)", borderRadius: 9, fontSize: 12.5 }}>
                      <Ic n="plus" s={13} c="var(--success)" /><span style={{ fontWeight: 500 }}>{s.label}</span><span style={{ flex: 1 }} /><span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{R.kr(s.amount)}</span><span className="x" style={{ cursor: "pointer", color: "var(--muted)", display: "inline-flex" }} onClick={() => setSupps((x) => x.filter((y) => y.id !== s.id))}><Ic n="x" s={14} /></span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 7 }}>
                <select className="rec-input" value={stype} onChange={(ev) => setStype(ev.target.value)} style={{ flex: 1 }}>
                  {SUPP_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <input className="rec-input mono" type="number" value={samount} onChange={(ev) => setSamount(ev.target.value)} placeholder="kr" style={{ width: 90 }} />
                <button className="rec-btn" onClick={addSupp} disabled={!parseInt(samount, 10)}><Ic n="plus" s={14} /></button>
              </div>
            </div>
          </div>
          <div className="rec-modal-f">
            <button className="rec-btn ghost" onClick={onClose}>Avbryt</button>
            <span style={{ flex: 1 }} />
            {mode === "approve"
              ? <button className="rec-btn primary" onClick={() => onSubmit({ uid: shift.uid, role: shift.role, mode: "approve", hours: shift.calculated, supplements: supps, devId: dev && dev.id })}><Ic n="check" s={14} /> Godkjenn vakt{supps.length ? ` + ${supps.length} tillegg` : ""}</button>
              : <button className="rec-btn primary" disabled={!proposeValid} onClick={() => onSubmit({ uid: shift.uid, role: shift.role, mode: "propose", hours, note, supplements: supps, devId: dev && dev.id })}><Ic n="send" s={14} /> Send forslag til {e.name.split(" ")[0]}</button>}
          </div>
        </div>
      </R.Scrim>
    );
  }

  // ---------- Export (reconciled days → reports & accounting files) ----------
  function ExportModal({ scope, onClose, onSubmit }) {
    const R = window.Rec;
    const ARTIFACTS = [
      { id: "rapport", label: "Avstemmingsrapport (PDF)", sub: "Avstemte dager · omsetning, avvik, audit", ic: "checkdoc" },
      { id: "regnskap", label: "Regnskapsfil (SAF-T)", sub: "Bokføringsbilag · per dag og konto", ic: "file" },
      { id: "oppgjor", label: "Kontant- & kortoppgjør", sub: "Z-rapport · kasse, kort, Vipps", ic: "wallet" },
      { id: "avvik", label: "Avviksrapport", sub: "Justeringer med begrunnelse og diff", ic: "alert" },
    ];
    const DEST = [
      { id: "tripletex", label: "Send til Tripletex", sub: "Overfør avstemmingen rett til regnskap/lønn", ic: "send" },
      { id: "csv", label: "CSV", sub: "Rådata · semikolonseparert (.csv)", ic: "file" },
      { id: "excel", label: "Excel", sub: "Regneark (.xlsx)", ic: "grid" },
      { id: "pdf", label: "PDF", sub: "Avstemmingsrapport · utskriftsklar", ic: "checkdoc" },
    ];
    const [dest, setDest] = useState("tripletex");
    const [sel, setSel] = useState({ rapport: true, regnskap: true, oppgjor: false, avvik: false });
    const toggle = (id) => setSel((s) => ({ ...s, [id]: !s[id] }));
    const chosen = ARTIFACTS.filter((a) => sel[a.id]);
    const isTriple = dest === "tripletex";
    const destLabel = DEST.find((d) => d.id === dest).label;
    return (
      <R.Scrim onClose={onClose}>
        <div className="rec-modal" onMouseDown={(ev) => ev.stopPropagation()}>
          <div className="rec-modal-h"><span className="t">Eksporter avstemte dager</span><span className="x" onClick={onClose}><Ic n="x" s={18} /></span></div>
          <div className="rec-modal-b">
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14, lineHeight: 1.5 }}>Velg hvor avstemmingen skal sendes eller lastes ned for {scope || "perioden"}. Bare låste dager tas med — åpne dager hoppes over.</div>
            <div className="rec-exsec">Format / destinasjon</div>
            <div className="rec-exlist">
              {DEST.map((d) => (
                <button key={d.id} type="button" className={`rec-exrow ${dest === d.id ? "on" : ""}`} onClick={() => setDest(d.id)} role="radio" aria-checked={dest === d.id}>
                  <span className="rec-exic"><Ic n={d.ic} s={16} /></span>
                  <span className="rec-extx"><span className="t">{d.label}</span><span className="s">{d.sub}</span></span>
                  <span className={`rec-exbox ${dest === d.id ? "on" : ""}`}>{dest === d.id && <Ic n="check" s={12} sw={3} />}</span>
                </button>
              ))}
            </div>
            <div className="rec-exsec" style={{ marginTop: 16 }}>Hva skal med</div>
            <div className="rec-exlist">
              {ARTIFACTS.map((a) => (
                <button key={a.id} type="button" className={`rec-exrow ${sel[a.id] ? "on" : ""}`} onClick={() => toggle(a.id)} role="checkbox" aria-checked={!!sel[a.id]}>
                  <span className="rec-exic"><Ic n={a.ic} s={16} /></span>
                  <span className="rec-extx"><span className="t">{a.label}</span><span className="s">{a.sub}</span></span>
                  <span className={`rec-exbox ${sel[a.id] ? "on" : ""}`}>{sel[a.id] && <Ic n="check" s={12} sw={3} />}</span>
                </button>
              ))}
            </div>
            {isTriple && <div className="rec-warnbox" style={{ marginTop: 14, background: "var(--orange-soft)", color: "var(--fg)" }}><span className="ic"><Ic n="send" s={16} /></span><div>Avstemmingen overføres til <strong>Tripletex</strong> via integrasjonen. Bilag bokføres når du bekrefter kjøringen inne i Tripletex.</div></div>}
          </div>
          <div className="rec-modal-f">
            <button className="rec-btn ghost" onClick={onClose}>Avbryt</button>
            <span style={{ flex: 1 }} />
            <button className="rec-btn primary" disabled={chosen.length === 0} onClick={() => onSubmit(dest, chosen.map((a) => a.label))}><Ic n={isTriple ? "send" : "download"} s={14} /> {isTriple ? "Send til Tripletex" : `Last ned ${destLabel}`}</button>
          </div>
        </div>
      </R.Scrim>
    );
  }

  window.RecForms = { ShiftEdit, ShiftApprove, RevenueAdjust, DeviationResolve, HandoffRequest, DayReject, DayLock, BulkApprove, ExportModal };
})();
