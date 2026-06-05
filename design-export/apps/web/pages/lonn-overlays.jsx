// ===== Lønn — overlays: Drilldown · LockModal · SupplementForm (window.LoOverlays) =====
(function () {
  const { useState } = React;
  const Ic = window.Ic;
  const D = () => window.SmartoutData;
  const L = () => window.Lo;

  // ===================================================================
  // DRILLDOWN — per-employee shift breakdown (drawer)
  // ===================================================================
  function Drilldown({ uid, devs, onClose, onSupplement, onOpenProfile }) {
    const { fmt0, kr, Av, DeptDot, Badge, Scrim, SuppChip } = L();
    const e = D().LO_EMP_BY_ID[uid];
    if (!e) return null;
    const shifts = D().LO_SHIFTS[uid] || [];
    const empDevs = devs.filter((d) => d.uid === uid && d.status === "open");
    const r = e.rate;
    const shiftTotal = (s) => {
      const base = Math.round(s.actual * r);
      const kveld = s.kveld ? Math.round(r * Math.min(s.actual, 4) * 0.25) : 0;
      const helg = s.helg ? Math.round(r * s.actual * 0.5) : 0;
      const hellig = s.hellig ? Math.round(r * s.actual * 1.0) : 0;
      const ot = s.ot ? Math.round(r * s.ot * 0.5) : 0;
      return { base, kveld, helg, hellig, ot, total: base + kveld + helg + hellig + ot };
    };

    return (
      <Scrim mode="right" onClose={onClose}>
        <div className="lo-drawer">
          <div className="lo-dhead">
            <div className="lo-dhead-top">
              <button className="lo-x" onClick={onClose}><Ic n="x" s={18} /></button>
              <span style={{ flex: 1 }} />
              <button className="lo-btn sm ghost" onClick={() => onOpenProfile ? onOpenProfile(uid) : onClose()}><Ic n="user" s={14} /> Åpne profil</button>
              <button className="lo-btn sm" onClick={() => onSupplement(uid)}><Ic n="plus" s={14} /> Manuelt tillegg</button>
            </div>
            <div className="lo-dhead-id">
              <Av uid={uid} size={56} />
              <div style={{ flex: 1 }}>
                <div className="nm">{e.name}</div>
                <div className="rl"><DeptDot dept={e.dept} size={8} /><span>{e.deptName} · {e.type}{e.monthly ? ` ${fmt0(e.monthly)} kr/mnd` : ` ${e.rate} kr/t`}</span><span style={{ opacity: 0.4 }}>·</span><span>{e.pct}% stilling</span></div>
              </div>
              <div className="lo-mini" style={{ textAlign: "right" }}><div className="l">Brutto april</div><div className="v">{kr(e.gross)}</div></div>
            </div>
          </div>

          <div className="lo-dsummary">
            <div className="lo-mini"><div className="l">Planlagt</div><div className="v">{e.sched.toFixed(1)}t</div></div>
            <div className="lo-mini"><div className="l">Faktisk</div><div className="v">{e.actual.toFixed(1)}t</div></div>
            <div className="lo-mini"><div className="l">OT</div><div className="v brand">{e.ot ? e.ot.toFixed(1) + "t" : "—"}</div></div>
            <div className="lo-mini"><div className="l">Kveld</div><div className="v">{e.kveld ? e.kveld.toFixed(1) + "t" : "—"}</div></div>
            <div className="lo-mini"><div className="l">Helg</div><div className="v">{e.helg ? e.helg.toFixed(1) + "t" : "—"}</div></div>
            <div className="lo-mini"><div className="l">Manuelt</div><div className="v">{e.manual ? fmt0(e.manual) + " kr" : "—"}</div></div>
          </div>

          <div className="lo-dbody">
            <div className="lo-dbar">
              <span className="lbl">Vakter · {shifts.length} vakter · derivation snapshot</span>
              {empDevs.length > 0 && <span className="warn"><Ic n="alert" s={12} /> {empDevs.length} avvik åpne</span>}
            </div>

            {shifts.map((s, i) => {
              const t = shiftTotal(s);
              return (
                <div key={i} className={`lo-shift ${s.warn ? "warn" : ""} ${s.hellig ? "hellig" : ""}`}>
                  <div>
                    <div className="dt">{s.date}</div>
                    {s.dayLabel && <div className={`day ${s.hellig ? "hellig" : ""}`}>{s.dayLabel}</div>}
                  </div>
                  <div className="kl">{s.kl}{s.ot ? <div className="ot">+{s.ot}t OT</div> : null}</div>
                  <div className="chips">
                    <SuppChip kind="base" amount={t.base} />
                    {s.kveld && <SuppChip kind="kveld" amount={t.kveld} />}
                    {s.helg && <SuppChip kind="helg" amount={t.helg} />}
                    {s.hellig && <SuppChip kind="hellig" amount={t.hellig} />}
                    {s.warn && <SuppChip kind="warn" />}
                  </div>
                  <div className="tot">{kr(t.total)}</div>
                </div>
              );
            })}

            {/* derivation breakdown */}
            <div className="lo-deriv">
              <div className="eyebrow">Derivation breakdown · april</div>
              {e.breakdown.map((b, i) => (
                <div key={i} className="lo-deriv-row"><span className="k">{b.code} · {b.label}</span><span className="v">{fmt0(b.kr)}</span></div>
              ))}
              <div className="lo-deriv-row total"><span className="k">= Brutto</span><span className="v">{fmt0(e.gross)}</span></div>
            </div>
          </div>
        </div>
      </Scrim>
    );
  }

  // ===================================================================
  // LOCK MODAL
  // ===================================================================
  function LockModal({ period, devs, totals, onClose, onConfirm, toast }) {
    const { fmt0, kr, Scrim } = L();
    const errorsOpen = devs.filter((d) => d.kind === "error" && d.status === "open").length;
    const warnings = devs.filter((d) => d.kind === "warning" && d.status === "open").length;
    const manualCount = D().LO_EMPLOYEES.filter((e) => e.manual > 0).length;
    const lockable = errorsOpen === 0;
    const checks = [
      { t: `${devs.filter((d) => d.kind === "error").length} avvik er bekreftet`, on: lockable },
      { t: `${manualCount} manuelle tillegg er signert`, on: true },
      { t: `${warnings} advarsler vises på lønnsslipp som info`, on: true },
      { t: `Varsle ansatte: lønnsslipp tilgjengelig ${period.payDate || "28.04"}`, on: true },
    ];

    return (
      <Scrim mode="center" onClose={onClose}>
        <div className="lo-modal">
          <div className="lo-mhead">
            <div className="ic"><Ic n="lock" s={18} /></div>
            <div style={{ flex: 1 }}>
              <h3>Lås {period.label.toLowerCase()}?</h3>
              <div className="sub">Linjer fryses og kan ikke endres uten å åpne perioden på nytt.</div>
            </div>
            <button className="lo-x" onClick={onClose}><Ic n="x" s={18} /></button>
          </div>
          <div className="lo-mbody">
            <div className="lo-statgrid">
              <div className="lo-mini"><div className="l">Linjer</div><div className="v">{period.lines}</div></div>
              <div className="lo-mini"><div className="l">Brutto</div><div className="v">{kr(totals.gross)}</div></div>
              <div className="lo-mini"><div className="l">Avvik</div><div className="v">{devs.filter((d) => d.status !== "ack").length || devs.length}</div></div>
              <div className="lo-mini"><div className="l">Manuelle</div><div className="v">{manualCount}</div></div>
            </div>
            {checks.map((c, i) => (
              <div key={i} className="lo-check"><span className={`box ${c.on ? "" : "off"}`}>{c.on && <Ic n="check" s={12} sw={3} />}</span><span>{c.t}</span></div>
            ))}
            <div className="lo-infonote">
              <span className="ic"><Ic n="info" s={14} /></span>
              <div>Hvis ansatt registrerer endring etter lås, blir det en ny linje neste periode. Mr. Botsson sender deg en notis hvis det skjer.</div>
            </div>
            {!lockable && (
              <div className="lo-banner warn" style={{ marginBottom: 16 }}>
                <div className="ic"><Ic n="alert" s={18} /></div>
                <div className="bd"><div className="bt">{errorsOpen} avvik er ikke bekreftet</div><div className="bs">Håndter dem i Avvik-fanen før du kan låse.</div></div>
              </div>
            )}
          </div>
          <div className="lo-mfoot">
            <button className="lo-btn ghost" onClick={onClose}>Avbryt</button>
            <button className="lo-btn" onClick={() => { toast("Lagret uten å låse"); onClose(); }}>Lagre uten å låse</button>
            <button className="lo-btn primary" disabled={!lockable} onClick={onConfirm}><Ic n="lock" s={15} /> Lås {period.label.split(" ")[0]}</button>
          </div>
        </div>
      </Scrim>
    );
  }

  // ===================================================================
  // MANUAL SUPPLEMENT FORM
  // ===================================================================
  function SupplementForm({ uid, onClose, onSubmit }) {
    const { Av, Field, Scrim } = L();
    const e = uid ? D().LO_EMP_BY_ID[uid] : null;
    const [type, setType] = useState("Bonus");
    const [amount, setAmount] = useState("200,00");
    const [desc, setDesc] = useState("Ekstra hjelp Skjærtorsdag");
    const [vis, setVis] = useState("Lønnsslipp");
    const types = [["sparkle", "Bonus"], ["wallet", "Forskudd"], ["scale", "Trekk"], ["plus", "Annet"]];

    return (
      <Scrim mode="center" onClose={onClose}>
        <div className="lo-modal wide">
          <div className="lo-mhead">
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 600, marginBottom: 4 }}>April 2026 · manuelt tillegg</div>
              <h3>Legg til lønnslinje</h3>
            </div>
            <button className="lo-x" onClick={onClose}><Ic n="x" s={18} /></button>
          </div>
          <div className="lo-mbody" style={{ paddingTop: 16 }}>
            <Field label="Ansatt" required>
              {e ? (
                <div className="lo-emptag"><Av uid={uid} size={28} /><div style={{ flex: 1 }}><div style={{ fontWeight: 500, fontSize: 14 }}>{e.name}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{e.deptName} · {e.type}</div></div><Ic n="chevDown" s={14} c="var(--muted)" /></div>
              ) : (
                <div className="lo-input" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "var(--muted)" }}>Velg ansatt … <Ic n="chevDown" s={14} /></div>
              )}
            </Field>
            <Field label="Type" required>
              <div className="lo-typegrid">{types.map(([ic, l]) => (
                <div key={l} className={`lo-typecard ${type === l ? "on" : ""}`} onClick={() => setType(l)}><Ic n={ic} s={18} />{l}</div>
              ))}</div>
            </Field>
            <div className="lo-inrow">
              <Field label="Beløp" required hint="Skattepliktig (alminnelig)">
                <div className="lo-input" style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 13px" }}>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", fontSize: 13 }}>kr</span>
                  <input value={amount} onChange={(ev) => setAmount(ev.target.value)} style={{ flex: 1, border: 0, outline: "none", background: "none", padding: "11px 0", fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 600, color: "var(--fg)" }} />
                </div>
              </Field>
              <Field label="Lønnskode" hint="Brukes ved A-melding">
                <div className="lo-input" style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>5210</span><span style={{ color: "var(--muted)" }}>· Bonus skattepliktig</span><span style={{ flex: 1 }} /><Ic n="chevDown" s={14} c="var(--muted)" /></div>
              </Field>
            </div>
            <Field label="Beskrivelse · vises på lønnsslipp" required>
              <input className="lo-input" value={desc} onChange={(ev) => setDesc(ev.target.value)} />
            </Field>
            <div className="lo-inrow">
              <Field label="Knytt til vakt" hint="Valgfritt">
                <div className="lo-input" style={{ display: "flex", alignItems: "center", gap: 8 }}><Ic n="calendar" s={14} c="var(--muted)" /><span>17.04 · 14:00–22:00</span><span style={{ flex: 1 }} /><Ic n="chevDown" s={14} c="var(--muted)" /></div>
              </Field>
              <Field label="Synlighet">
                <div className="lo-seg">{["Lønnsslipp", "Bare admin"].map((t) => <button key={t} className={vis === t ? "on" : ""} onClick={() => setVis(t)}>{t}</button>)}</div>
              </Field>
            </div>
            <div className="lo-bottip" style={{ marginBottom: 16 }}>
              <span className="ic"><Ic n="bot" s={14} /></span>
              <div><strong style={{ color: "var(--fg)" }}>Bot-Sson tipset:</strong> Ole og Erik jobbet også 17.04. Vil du legge til samme bonus for dem? <span className="lo-link">Legg til 2 til</span></div>
            </div>
          </div>
          <div className="lo-mfoot">
            <div className="note">Linjen blir signert med din konto · 06.05.2026</div>
            <button className="lo-btn ghost" onClick={onClose}>Avbryt</button>
            <button className="lo-btn primary" onClick={() => onSubmit({ uid, type, amount, desc })}><Ic n="check" s={15} /> Legg til linje</button>
          </div>
        </div>
      </Scrim>
    );
  }

  // ===================================================================
  // EXPORT MODAL — choose which payroll artifacts to generate
  // ===================================================================
  function ExportModal({ period, totals, locked, onClose, onConfirm }) {
    const { kr, Scrim } = L();
    const DEST = [
      { id: "tripletex", label: "Send til Tripletex", sub: "Overfør lønnskjøringen rett til lønnssystemet", ic: "send" },
      { id: "csv", label: "CSV", sub: "Rådata · semikolonseparert (.csv)", ic: "file" },
      { id: "excel", label: "Excel", sub: "Regneark (.xlsx)", ic: "grid" },
      { id: "pdf", label: "PDF", sub: "Lønnskjøringsrapport · klar for utskrift", ic: "checkdoc" },
    ];
    const [dest, setDest] = useState("tripletex");
    const ARTIFACTS = [
      { id: "amelding", label: "A-melding", sub: "Altinn · 7 ansatte · 89 linjer", ic: "checkdoc" },
      { id: "bankfil", label: "Bankfil (utbetaling)", sub: `${kr(totals.net || 189910)} · 7 konti · forfall 15.05`, ic: "wallet" },
      { id: "slipper", label: "Lønnsslipper (PDF)", sub: "Publiseres til ansatte i appen", ic: "file" },
      { id: "grunnlag", label: "Grunnlagsrapport", sub: "Full kjøring · brutto → netto", ic: "checkdoc" },
    ];
    const [sel, setSel] = useState({ amelding: true, bankfil: true, slipper: true, grunnlag: false });
    const toggle = (id) => setSel((s) => ({ ...s, [id]: !s[id] }));
    const chosen = ARTIFACTS.filter((a) => sel[a.id]);
    const isTriple = dest === "tripletex";
    const isPdf = dest === "pdf";
    const destLabel = DEST.find((d) => d.id === dest).label;

    return (
      <Scrim mode="center" onClose={onClose}>
        <div className="lo-modal">
          <div className="lo-mhead">
            <div className="ic"><Ic n="download" s={18} /></div>
            <div style={{ flex: 1 }}>
              <h3>Eksporter {period.label.toLowerCase()}</h3>
              <div className="sub">Velg hvor lønnskjøringen skal sendes eller lastes ned.</div>
            </div>
            <button className="lo-x" onClick={onClose}><Ic n="x" s={18} /></button>
          </div>
          <div className="lo-mbody">
            <div className="lo-exsec">Format / destinasjon</div>
            <div className="lo-destgrid">
              {DEST.map((d) => (
                <button key={d.id} type="button" className={`lo-dest ${dest === d.id ? "on" : ""}`} onClick={() => setDest(d.id)} role="radio" aria-checked={dest === d.id}>
                  <span className="lo-dest-ic"><Ic n={d.ic} s={17} /></span>
                  <span className="lo-dest-tx"><span className="t">{d.label}</span><span className="s">{d.sub}</span></span>
                  <span className={`lo-dest-dot ${dest === d.id ? "on" : ""}`}>{dest === d.id && <Ic n="check" s={11} sw={3} />}</span>
                </button>
              ))}
            </div>

            {!isPdf && (
              <>
                <div className="lo-exsec" style={{ marginTop: 18 }}>Hva skal med</div>
                <div className="lo-exlist">
                  {ARTIFACTS.map((a) => (
                    <button key={a.id} type="button" className={`lo-exrow ${sel[a.id] ? "on" : ""}`} onClick={() => toggle(a.id)} role="checkbox" aria-checked={!!sel[a.id]}>
                      <span className="lo-exic"><Ic n={a.ic} s={16} /></span>
                      <span className="lo-extx"><span className="t">{a.label}</span><span className="s">{a.sub}</span></span>
                      <span className={`lo-exbox ${sel[a.id] ? "on" : ""}`}>{sel[a.id] && <Ic n="check" s={12} sw={3} />}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {isTriple ? (
              <div className="lo-infonote"><span className="ic"><Ic n="send" s={14} /></span><div>Lønnskjøringen overføres til <strong>Tripletex</strong> via integrasjonen. Du bekrefter kjøringen inne i Tripletex før utbetaling.</div></div>
            ) : isPdf ? (
              <div className="lo-infonote"><span className="ic"><Ic n="info" s={14} /></span><div>Åpner <strong>lønnskjøringsrapporten</strong> som PDF — klar for utskrift eller arkiv.</div></div>
            ) : !locked ? (
              <div className="lo-infonote"><span className="ic"><Ic n="info" s={14} /></span><div>Perioden er ikke låst ennå — dette blir en <strong>foreløpig eksport</strong>. Endelige filer til Altinn og bank genereres når du låser perioden.</div></div>
            ) : null}
          </div>
          <div className="lo-mfoot">
            <button className="lo-btn ghost" onClick={onClose}>Avbryt</button>
            <button className="lo-btn primary" disabled={!isPdf && !isTriple && chosen.length === 0} onClick={() => onConfirm(dest, chosen.map((a) => a.label))}>
              <Ic n={isTriple ? "send" : isPdf ? "file" : "download"} s={15} /> {isTriple ? "Send til Tripletex" : isPdf ? "Åpne PDF" : `Last ned ${destLabel}`}
            </button>
          </div>
        </div>
      </Scrim>
    );
  }

  window.LoOverlays = { Drilldown, LockModal, SupplementForm, ExportModal };
})();
