// ===== Avstemming — yrke · sesong · handoffs · innstillinger (window.RecMore) =====
(function () {
  const { useState } = React;
  const Ic = window.Ic;
  const D = () => window.SmartoutData;

  // =============================================================
  // YRKE (W-03) — occupational period close wizard
  // =============================================================
  function Yrke({ toast }) {
    const R = window.Rec;
    const O = D().REC_OCCUPATIONAL;
    const [step, setStep] = useState(0);
    const [prof, setProf] = useState("servitor");
    const ag = O.aggregate;
    const STEPS = ["Velg yrke + periode", "Gjennomgå aggregater", "Avvik", "Bekreft & lukk"];
    const profLabel = (O.professions.find((p) => p.id === prof) || {}).label;

    return (
      <div>
        <Stepper steps={STEPS} step={step} />
        <div className="rec-wizpanel">
          {step === 0 && (
            <>
              <div className="rec-wiztitle">Velg yrke og periode</div>
              <div className="rec-wizsub">Lukk en periode for én yrkesgruppe. Aggregatene beregnes fra timer, fravær og omsetning.</div>
              <R.Field label="Yrkesgruppe" required>
                <div className="rec-radios">
                  {O.professions.map((p) => (
                    <label key={p.id} className={`rec-radio ${prof === p.id ? "on" : ""}`} onClick={() => setProf(p.id)}><span className="rd" /><span className="rl"><span className="rt">{p.label}</span><span className="rs">{p.count} aktive ansatte</span></span></label>
                  ))}
                </div>
              </R.Field>
              <R.Field label="Periode"><input className="rec-input" defaultValue="Mai 2026" readOnly /></R.Field>
            </>
          )}
          {step === 1 && (
            <>
              <div className="rec-wiztitle">Aggregater — {profLabel} · {ag.period}</div>
              <div className="rec-wizsub">Beregnet fra godkjente vakter i perioden.</div>
              <table className="rec-aggtable">
                <thead><tr><th>Ansatt</th><th>Timer</th><th>Sykefravær</th><th>Omsetning</th><th>Lønn %</th><th>vs forv.</th></tr></thead>
                <tbody>
                  {ag.rows.map((r) => (
                    <tr key={r.uid}><td>{D().REC_IDENT(r.uid).name}</td><td>{r.hours.toFixed(1)}t</td><td>{r.sick ? r.sick.toFixed(1) + "t" : "—"}</td><td>{r.revenue ? R.krShort(r.revenue) : "—"}</td><td>{r.laborPct ? r.laborPct + "%" : "—"}</td><td className={`var ${r.variance > 0 ? "up" : r.variance < 0 ? "dn" : ""}`}>{r.variance > 0 ? "+" : ""}{r.variance || 0}%</td></tr>
                  ))}
                  <tr className="tot"><td>Total</td><td>{ag.totals.hours.toFixed(1)}t</td><td>{ag.totals.sick.toFixed(1)}t</td><td>{R.krShort(ag.totals.revenue)}</td><td>{ag.totals.laborPct}%</td><td className="var up">+{(ag.totals.laborPct - ag.totals.expected).toFixed(1)}%</td></tr>
                </tbody>
              </table>
            </>
          )}
          {step === 2 && (
            <>
              <div className="rec-wiztitle">Uavstemte dager</div>
              <div className="rec-wizsub">Alle dager i perioden må være godkjent eller låst før yrkesavstemmingen kan lukkes.</div>
              {ag.unreconciledDays > 0 ? (
                <div className="rec-warnbox"><span className="ic"><Ic n="alert" s={16} /></span><div><b>{ag.unreconciledDays} dag er ikke avstemt</b> (Søn 24.05). Gå til Daglig og godkjenn den før du fortsetter, eller lukk med revisjons-flagg.</div></div>
              ) : (
                <div className="rec-preflight clean"><div className="rec-preflight-h"><span className="ic"><Ic n="check" s={16} /></span>Alle dager i perioden er avstemt</div></div>
              )}
            </>
          )}
          {step === 3 && (
            <>
              <div className="rec-wiztitle">Bekreft & lukk</div>
              <div className="rec-wizsub">Lukker {profLabel.toLowerCase()} for {ag.period}. Trigger event <code style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>occupational_reconciliation.closed</code>.</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, background: "var(--border)", borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
                <Stat l="Timer" v={ag.totals.hours.toFixed(0) + "t"} />
                <Stat l="Omsetning" v={R.krShort(ag.totals.revenue)} />
                <Stat l="Lønn %" v={ag.totals.laborPct + "%"} />
              </div>
              <R.Field label="Notat"><textarea className="rec-textarea" placeholder="Eventuelle merknader til perioden …" /></R.Field>
            </>
          )}

          <div className="rec-wizactions">
            {step > 0 && <button className="rec-btn" onClick={() => setStep((s) => s - 1)}><Ic n="chevLeft" s={14} /> Tilbake</button>}
            <span style={{ flex: 1 }} />
            {step < 3
              ? <button className="rec-btn primary" onClick={() => setStep((s) => s + 1)}>Neste <Ic n="arrowRight" s={14} /></button>
              : <button className="rec-btn primary" onClick={() => toast(`${profLabel} · ${ag.period} lukket`, { undo: () => {} })}><Ic n="lock" s={14} /> Lukk perioden</button>}
          </div>
        </div>
      </div>
    );
  }

  // =============================================================
  // SESONG (W-04) — season reconciliation wizard
  // =============================================================
  function Sesong({ toast }) {
    const R = window.Rec;
    const S = D().REC_SEASON.selected;
    const [step, setStep] = useState(0);
    const [factors, setFactors] = useState(() => S.factors.map((f) => ({ ...f, apply: false })));
    const STEPS = ["Velg sesong", "Budsjett vs faktisk", "Lønn %", "Avviksmønstre", "Lærdom"];
    const maxLabor = Math.max(...S.laborWeeks);

    return (
      <div>
        <Stepper steps={STEPS} step={step} />
        <div className="rec-wizpanel">
          {step === 0 && (
            <>
              <div className="rec-wiztitle">Velg sesong</div>
              <div className="rec-wizsub">Strategisk lukking — oppdaterer forventningsmodellene for neste sesong.</div>
              <div className="rec-radios">
                {D().REC_SEASON.cycles.map((c) => (
                  <label key={c.id} className={`rec-radio ${c.id === S.id ? "on" : ""}`}><span className="rd" /><span className="rl"><span className="rt">{c.label}</span><span className="rs">{c.range} · {c.status}</span></span></label>
                ))}
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <div className="rec-wiztitle">Budsjett vs faktisk — {S.label}</div>
              <div className="rec-wizsub">Omsetning gjennom sesongen mot budsjett.</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, background: "var(--border)", borderRadius: 10, overflow: "hidden" }}>
                <Stat l="Budsjett" v={R.krShort(S.budget.target)} />
                <Stat l="Faktisk" v={R.krShort(S.budget.actual)} />
                <Stat l="Avvik" v={"+" + R.krShort(S.budget.actual - S.budget.target)} tone="ok" />
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <div className="rec-wiztitle">Lønn % over uker</div>
              <div className="rec-wizsub">Snitt {S.laborAvg}% mot mål {S.laborTarget}%. Søyler over mål er markert.</div>
              <div className="rec-spark">
                {S.laborWeeks.map((w, i) => <div key={i} className={`bar ${w > S.laborTarget + 0.5 ? "over" : ""}`} style={{ height: (w / maxLabor * 100) + "%" }} title={`Uke ${i + 1}: ${w}%`} />)}
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <div className="rec-wiztitle">Avviksmønstre</div>
              <div className="rec-wizsub">Gruppert per kategori gjennom sesongen.</div>
              <div className="rec-card" style={{ marginBottom: 0 }}>
                {S.patterns.map((p) => (
                  <div key={p.cat} className="rec-pattern">
                    <div><div className="pc">{p.cat}</div><div className="pn">{p.note}</div></div>
                    <span className="cnt">{p.count}</span>
                    <span className={`trend ${p.trend === "opp" ? "up" : p.trend === "ned" ? "down" : "flat"}`}><Ic n={p.trend === "opp" ? "trendUp" : p.trend === "ned" ? "trendUp" : "arrowRight"} s={12} style={p.trend === "ned" ? { transform: "scaleY(-1)" } : null} /> {p.trend}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {step === 4 && (
            <>
              <div className="rec-wiztitle">Lærdom — oppdater planfaktorer</div>
              <div className="rec-wizsub">Botsson foreslår justeringer for neste sesong. Hver endring krever bekreftelse.</div>
              <div className="rec-card" style={{ marginBottom: 0 }}>
                <div className="rec-card-b pad">
                  {factors.map((f, i) => (
                    <div key={f.id} className="rec-factor">
                      <div><div className="fl">{f.label}</div><div className="fr">{f.reason} · <span style={{ color: "var(--orange)" }}>tillit {f.conf === "high" ? "høy" : f.conf === "medium" ? "middels" : "lav"}</span></div></div>
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div className="fv"><span className="old">{f.current}</span><Ic n="arrowRight" s={13} c="var(--muted-soft)" /><span className="new">{f.suggested}</span></div>
                        <R.Switch on={f.apply} onClick={() => setFactors((fs) => fs.map((x, j) => j === i ? { ...x, apply: !x.apply } : x))} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="rec-wizactions">
            {step > 0 && <button className="rec-btn" onClick={() => setStep((s) => s - 1)}><Ic n="chevLeft" s={14} /> Tilbake</button>}
            <span style={{ flex: 1 }} />
            {step < 4
              ? <button className="rec-btn primary" onClick={() => setStep((s) => s + 1)}>Neste <Ic n="arrowRight" s={14} /></button>
              : <button className="rec-btn primary" onClick={() => { const n = factors.filter((f) => f.apply).length; toast(`${S.label} lukket${n ? ` · ${n} planfaktor${n > 1 ? "er" : ""} oppdatert` : ""}`, { undo: () => {} }); }}><Ic n="lock" s={14} /> Lukk sesongen</button>}
          </div>
        </div>
      </div>
    );
  }

  // =============================================================
  // HANDOFFS (W-05) — handoff inbox (two-panel)
  // =============================================================
  function Handoffs({ toast, initialId, onResolve }) {
    const R = window.Rec;
    const all = D().REC_HANDOFFS;
    const [filter, setFilter] = useState("alle");
    const [selId, setSelId] = useState(initialId || (all[0] && all[0].id));
    const FILTERS = [["alle", "Alle"], ["active", "Aktive"], ["awaiting", "Venter"], ["escalated", "Eskalert"], ["resolved", "Løst"]];
    const list = all.filter((h) => filter === "alle" ? true : h.status === filter);
    const sel = D().REC_HANDOFF_BY_ID[selId] || list[0];

    return (
      <div>
        <div className="rec-filtrow" style={{ marginBottom: 14 }}>
          {FILTERS.map(([k, l]) => <button key={k} className={`rec-chip ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>{l}</button>)}
        </div>
        <div className="rec-hoinbox">
          <div className="rec-holist">
            {list.length === 0 && <R.Empty icon="message" title="Ingen handoffs" sub="Ingen handoffs i denne kategorien." />}
            {list.map((h) => {
              const hs = D().REC_HANDOFF_STATUS[h.status]; const e = D().REC_IDENT(h.uid);
              return (
                <div key={h.id} className={`rec-horow ${sel && sel.id === h.id ? "on" : ""}`} onClick={() => setSelId(h.id)}>
                  <div className="hr-top"><R.Av uid={h.uid} size={26} /><span style={{ fontSize: 13, fontWeight: 600 }}>{e.name}</span><span style={{ flex: 1 }} /><span className={`rec-pill ${hs.tone}`}><span className="ic"><Ic n={hs.icon} s={11} /></span>{hs.label}</span></div>
                  <div className="hr-scope">{h.scopeLabel}</div>
                  <div className="hr-meta"><Ic n={h.channel === "voice" ? "phone" : "message"} s={12} /> {h.channel === "voice" ? "Telefon" : "Chat"} · frist {h.deadline}</div>
                </div>
              );
            })}
          </div>

          {sel ? <HandoffDetail h={sel} toast={toast} onResolve={onResolve} /> : <div className="rec-hodetail"><R.Empty icon="message" title="Velg en handoff" /></div>}
        </div>
      </div>
    );
  }

  function HandoffDetail({ h, toast, onResolve }) {
    const e = D().REC_IDENT(h.uid); const hs = D().REC_HANDOFF_STATUS[h.status];
    const day = D().REC_DAY_BY_ID[h.reconId];
    return (
      <div className="rec-hodetail">
        <div className="rec-hohead">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <window.Rec.Av uid={h.uid} size={32} />
            <div style={{ flex: 1 }}><h3>{e.name}</h3></div>
            <span className={`rec-pill ${hs.tone}`}><span className="ic"><Ic n={hs.icon} s={11} /></span>{hs.label}</span>
          </div>
          <div className="sub"><span><Ic n="link" s={11} /> {h.scopeLabel}</span><span>Opprettet {h.created}</span><span>Frist {h.deadline}</span></div>
        </div>
        <div className="rec-chat">
          {h.transcript.map((m, i) => (
            <div key={i} className={`rec-msg ${m.from}`}>
              {m.from !== "admin" && <div className="who">{m.from === "ai" ? <><Ic n="bot" s={12} /> Botsson</> : e.name}</div>}
              {m.meta && <div className="pillmeta">{m.meta}</div>}
              <div className="bub">{m.text}</div>
              <div className="tm">{m.ts}</div>
            </div>
          ))}
        </div>
        {h.status !== "resolved" && (
          <div className="rec-hoactions">
            <button className="rec-btn primary" onClick={() => { onResolve && onResolve(h.id); toast("Handoff godkjent og løst", { undo: () => {} }); }}><Ic n="check" s={14} /> Godkjenn handoff</button>
            {h.status !== "escalated" && <button className="rec-btn" onClick={() => toast("Eskalert til telefon")}><Ic n="phone" s={14} /> Eskaler til telefon</button>}
            <button className="rec-btn ghost" onClick={() => toast("Påminnelse sendt")}><Ic n="message" s={14} /> Send påminnelse</button>
            <button className="rec-btn danger" onClick={() => toast("Handoff avvist")}>Avvis</button>
          </div>
        )}
      </div>
    );
  }

  // =============================================================
  // INNSTILLINGER (W-06) — policy config
  // =============================================================
  function Settings({ toast }) {
    const R = window.Rec;
    const [cfg, setCfg] = useState(() => {
      const m = {};
      D().REC_POLICY.forEach((sec) => sec.fields.forEach((f) => { m[f.key] = f.value; }));
      return m;
    });
    const set = (k, v, lbl) => { setCfg((c) => ({ ...c, [k]: v })); toast(`«${lbl}» lagret`); };

    return (
      <div className="rec-policygrid">
        {D().REC_POLICY.map((sec) => (
          <div key={sec.id} className="rec-policy">
            <div className="rec-policy-h"><span className="ic"><Ic n={sec.icon} s={15} /></span><span className="t">{sec.title}</span></div>
            <div className="desc">{sec.desc}</div>
            {sec.fields.map((f) => (
              <div key={f.key} className="rec-pfield">
                <span className="pl">{f.label}</span>
                {f.type === "toggle" && <R.Switch on={cfg[f.key]} onClick={() => set(f.key, !cfg[f.key], f.label)} />}
                {f.type === "number" && <span className="rec-pinput"><input type="number" value={cfg[f.key]} onChange={(e) => set(f.key, parseInt(e.target.value) || 0, f.label)} />{f.unit && <span className="un">{f.unit}</span>}</span>}
                {f.type === "seg" && <R.Seg value={cfg[f.key]} opts={f.opts} onChange={(v) => set(f.key, v, f.label)} />}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  // ---------- shared bits ----------
  function Stepper({ steps, step }) {
    return (
      <div className="rec-stepper">
        {steps.map((s, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="rec-stepconn" />}
            <div className={`rec-step ${i === step ? "on" : i < step ? "done" : ""}`}><span className="num">{i < step ? <Ic n="check" s={12} /> : i + 1}</span>{s}</div>
          </React.Fragment>
        ))}
      </div>
    );
  }
  function Stat({ l, v, tone }) {
    return <div style={{ background: "var(--card)", padding: "13px 15px" }}><div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--muted)" }}>{l}</div><div style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700, color: tone === "ok" ? "var(--success)" : "var(--fg)" }}>{v}</div></div>;
  }

  window.RecMore = { Yrke, Sesong, Handoffs, Settings };
})();
