// ===== Min lønn — employee pay (private route "min-lonn") =====
// The employee's own pay surface: live preview of the running period, payslip
// history (→ detail drawer), timebank + banks, and the one thing that needs
// THEIR signature before the period locks. Botsson explains; nothing auto-acts.
(function () {
  const { useState, useEffect } = React;
  const Ic = window.Ic;
  const D = () => window.SmartoutData;

  function MinLonnPage() {
    const toast = window.useToast();
    const { fmt0, kr, Badge, Panel, Scrim } = window.Lo;
    const ML = D().ML_PAY;
    const [openSlip, setOpenSlip] = useState(null);
    const [signed, setSigned] = useState(false);

    useEffect(() => {
      if (window.SmartoutContext && window.SmartoutContext.set) {
        window.SmartoutContext.set({ route: "min-lonn", view: "oversikt", role: "ansatt", subject: "Din lønn" });
      }
      return () => { if (window.SmartoutContext && window.SmartoutContext.set) window.SmartoutContext.set({ route: null }); };
    }, []);

    const cur = ML.current;
    const slip = openSlip ? ML.payslips.find((p) => p.id === openSlip) : null;

    const sign = () => { setSigned(true); toast("Tillegg signert · lønn for april kan låses", { undo: () => setSigned(false) }); };

    return (
      <main className="sk-main">
        <div className="sk-wrap" style={{ maxWidth: 1100 }}>
          <div className="lo-head">
            <div>
              <div className="sk-eyebrow">Min side · Lønn</div>
              <h1 className="lo-h1">Lønn</h1>
              <div className="lo-sub">Slipper, timebank og ferie — alt oppdateres live mens måneden går.</div>
            </div>
          </div>

          {/* pending signature */}
          {!signed && ML.pending && (
            <div className="ml-pending">
              <div className="ic"><Ic n="pen" s={18} /></div>
              <div className="bd">
                <div className="t">{ML.pending.title}</div>
                <div className="s">{ML.pending.shift} · {ML.pending.extra.grunnlag} · {kr(ML.pending.extra.kr)}. {ML.pending.why}</div>
              </div>
              <div className="acts">
                <button className="lo-btn sm ghost" onClick={() => toast("Sendt til leder for avklaring")}>Avklar</button>
                <button className="lo-btn sm primary" onClick={sign}><Ic n="check" s={14} /> Signér tillegg</button>
              </div>
            </div>
          )}
          {signed && (
            <div className="lo-banner ok" style={{ marginBottom: 16 }}>
              <div className="ic"><Ic n="check" s={18} /></div>
              <div className="bd"><div className="bt">Tillegg for rød dag er signert</div><div className="bs">Takk! Leder kan nå låse lønnen for april. Du får varsel når lønnsslippen er klar.</div></div>
              <button className="lo-btn sm" onClick={() => setSigned(false)}><Ic n="undo" s={14} /> Angre</button>
            </div>
          )}

          <div className="ml-grid">
            {/* LEFT */}
            <div>
              {/* hero — running period */}
              <div className="ml-hero">
                <div className="inner">
                  <div className="eyebrow">Foreløpig · {cur.period}</div>
                  <div className="big">{kr(cur.net)}</div>
                  <div className="cap">Netto · oppdateres til lønnsslipp {cur.payslipDate}</div>
                  <div className="minis">
                    <div className="ml-mini"><div className="l">Timer</div><div className="v">{cur.hours.toFixed(0)}</div></div>
                    <div className="ml-mini"><div className="l">Tillegg</div><div className="v">{kr(cur.supp)}</div></div>
                    <div className="ml-mini"><div className="l">Timebank</div><div className="v brand">{cur.bank}</div></div>
                  </div>
                </div>
              </div>

              <Panel icon="wallet" title="Lønnsslipper">
                <div className="ml-slips" style={{ border: 0, borderRadius: 0 }}>
                  {ML.payslips.map((p) => (
                    <div key={p.id} className="ml-slip" onClick={() => setOpenSlip(p.id)}>
                      <div className="ico"><Ic n="wallet" s={16} /></div>
                      <div className="bd">
                        <div className="p">{p.period}</div>
                        <div className="m"><span>Utbetalt {p.paid}</span>{p.tag && <><span style={{ opacity: 0.4 }}>·</span><span className="tag">{p.tag}</span></>}</div>
                      </div>
                      <span className="amt">{kr(p.net)}</span>
                      <Ic n="chevRight" s={14} c="var(--muted-soft)" />
                    </div>
                  ))}
                </div>
              </Panel>
            </div>

            {/* RIGHT */}
            <div className="lo-stack">
              {/* timebank */}
              <div>
                <div className="ml-bank">
                  <div className="inner">
                    <div className="l">Timebank · pluss-timer</div>
                    <div className="v">{cur.bank}</div>
                    <div className="cap">Av maks ±20t · oppdatert 30.04</div>
                  </div>
                </div>
                <Panel icon="scale" title="Banker">
                  <div style={{ padding: "12px 18px 6px" }}>
                    {ML.banks.map((b) => {
                      const pct = Math.min(1, Math.abs(b.pos) / b.max);
                      return (
                        <div key={b.key} className="ml-bankbar">
                          <div className="top"><span><Ic n={b.icon} s={12} /> {b.label}</span><span className="v">{b.pos > 0 ? "+" : ""}{b.pos}{b.unit} <span className="max">/ {b.max}{b.unit}</span></span></div>
                          <div className="track"><div className={`fill ${b.tone || ""}`} style={{ width: `${pct * 100}%` }} /></div>
                        </div>
                      );
                    })}
                    <button className="lo-btn sm" style={{ width: "100%", justifyContent: "center", marginTop: 6 }} onClick={() => toast("Forespørsel om avspasering sendt")}><Ic n="plus" s={14} /> Be om avspasering</button>
                  </div>
                </Panel>
              </div>

              <Panel icon="history" title="April · justeringer">
                <div style={{ padding: "6px 18px 12px" }}>
                  {ML.adjustments.map((a, i) => (
                    <div key={i} className="ml-adj">
                      <span className="dt">{a.date}</span>
                      <div className="tx">{a.text}<div className="src">{a.source}</div></div>
                      <span className={`delta ${a.tone}`}>{a.delta}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </div>
        </div>

        {/* payslip detail drawer */}
        {slip && (
          <Scrim mode="right" onClose={() => setOpenSlip(null)}>
            <div className="lo-drawer" style={{ width: 520 }}>
              <div className="lo-dhead">
                <div className="lo-dhead-top">
                  <button className="lo-x" onClick={() => setOpenSlip(null)}><Ic n="x" s={18} /></button>
                  <span style={{ flex: 1 }} />
                  <button className="lo-btn sm ghost" onClick={() => { window.open(((window.SmartoutReportDocs || {}).lonnsgrunnlag) || "reports/L%C3%B8nnsgrunnlag.html", "_blank", "noopener"); toast("Åpner lønnsgrunnlag (PDF)"); }}><Ic n="download" s={14} /> Last ned</button>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 600 }}>Lønnsslipp</div>
                <div style={{ fontFamily: "var(--font-heading)", fontSize: 26, letterSpacing: "-0.02em", marginTop: 2 }}>{slip.period}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}><Badge kind="approved" /><span style={{ fontSize: 12, color: "var(--muted)" }}>Utbetalt {slip.paid}</span></div>
              </div>
              <div className="lo-dbody">
                <div className="lo-card" style={{ marginTop: 8 }}>
                  <div className="ml-net"><span className="l">Netto</span><span className="v">{kr(slip.net)}</span></div>
                  {slip.lines ? slip.lines.map((r, i) => (
                    <div key={i} className={`ml-pdline ${r.total ? "total" : ""}`}><span className="lab">{r.label}</span><span className={`v ${r.neg ? "neg" : ""}`}>{r.neg ? "−" : ""}{fmt0(Math.abs(r.kr))}</span></div>
                  )) : (
                    <div className="ml-pdline"><span className="lab">Brutto</span><span className="v">{fmt0(slip.gross)}</span></div>
                  )}
                </div>
                {slip.hours && (
                  <Panel icon="clock" title="Timer">
                    <div style={{ padding: "10px 18px 14px" }}>
                      <div className="ml-pdline"><span className="lab">Faktiske timer</span><span className="v">{slip.hours.actual.toFixed(1)}</span></div>
                      <div className="ml-pdline"><span className="lab">Hvorav helg</span><span className="v">{slip.hours.helg.toFixed(1)}</span></div>
                      <div className="ml-pdline"><span className="lab">Hvorav kveld</span><span className="v">{slip.hours.kveld.toFixed(1)}</span></div>
                    </div>
                  </Panel>
                )}
                <div className="lo-infonote" style={{ marginTop: 16 }}>
                  <span className="ic"><Ic n="bot" s={14} /></span>
                  <div>Spørsmål om denne slippen? <span className="lo-link" onClick={() => toast("Åpner sak i #lønn")}>Åpne sak i #lønn</span> — Bot-Sson svarer ut fra dine egne tall.</div>
                </div>
              </div>
            </div>
          </Scrim>
        )}
      </main>
    );
  }

  window.SO_PAGES = Object.assign(window.SO_PAGES || {}, { "min-lonn": MinLonnPage });
})();
