// ===== Lønn — admin views: Oversikt · Linjer · Avvik (window.LoViews) =====
(function () {
  const { useState, useMemo } = React;
  const Ic = window.Ic;
  const D = () => window.SmartoutData;
  const L = () => window.Lo;

  const TONE = { error: "var(--error)", warning: "var(--warning)", info: "var(--info)" };

  // ===================================================================
  // OVERSIKT
  // ===================================================================
  function Oversikt({ period, devs, emps, totals, assistDone, onAssist, onDismissAssist, onConfirmDev, onOpenEmp, onLock, onGoTab, onSelectPeriod }) {
    const { kr, fmt0, Av, Badge, Panel, Empty } = L();
    const errorsOpen = devs.filter((d) => d.kind === "error" && d.status === "open");
    const manualCount = emps.filter((e) => e.manual > 0).length;
    const lockable = errorsOpen.length === 0;
    const helligOpen = errorsOpen.filter((d) => d.code === "HELLIGDAG_KOLLISJON");
    const periods = D().LO_PERIODS;

    const PULSES = [
      { lbl: "Brutto", val: fmt0(totals.gross), pre: "kr", ic: "wallet" },
      { lbl: "Netto", val: fmt0(totals.net), pre: "kr", ic: "scale" },
      { lbl: "Krever handling", val: errorsOpen.length, ic: "alert", tone: errorsOpen.length ? "crit" : "ok", go: () => onGoTab("avvik") },
      { lbl: "Manuelle tillegg", val: manualCount, ic: "pen", go: () => onGoTab("linjer") },
      { lbl: lockable ? "Klar til lås" : "Til lås", val: lockable ? "Ja" : errorsOpen.length, ic: "lock", tone: lockable ? "ok" : "warn", go: lockable ? onLock : () => onGoTab("avvik") },
    ];

    return (
      <div className="lo-stack">
        <div className="lo-pulserow">
          {PULSES.map((p) => (
            <button key={p.lbl} className="pulse" onClick={p.go || (() => {})}>
              <span className="pulse-lbl"><span className="ico"><Ic n={p.ic} s={13} /></span>{p.lbl}</span>
              <span className={`pulse-val ${p.tone || ""}`}>{p.pre && <span className="u" style={{ fontSize: 13 }}>{p.pre} </span>}{p.val}</span>
            </button>
          ))}
        </div>

        {/* Botsson assist */}
        {!assistDone && (
          <div className="lo-assist">
            <span className="lo-assist-av"><Ic n="bot" s={17} c="#fff" /></span>
            <div className="lo-assist-body">
              <div className="lo-assist-t"><strong>{errorsOpen.length ? `${errorsOpen.length} avvik må bekreftes før ${period.label} kan låses` : `${period.label} er klar til lås`}</strong>{helligOpen.length ? ` — ${helligOpen.length} gjelder rød dag (Skjærtorsdag). Begge ansatte har signert i appen.` : ""}</div>
              <div className="lo-assist-sources">
                <span className="src"><Ic n="checkdoc" s={11} /> Hovedavtale §10.3</span>
                <span className="src"><Ic n="pen" s={11} /> Signatur i app</span>
                <span className="src"><Ic n="grid" s={11} /> Vaktdata 17.04</span>
              </div>
            </div>
            <div className="lo-assist-actions">
              {helligOpen.length ? (
                <button className="lo-btn sm primary" onClick={() => onAssist(helligOpen.map((d) => d.id))}><Ic n="check" s={14} /> Bekreft rød dag ×{helligOpen.length}</button>
              ) : lockable ? (
                <button className="lo-btn sm primary" onClick={onLock}><Ic n="lock" s={14} /> Lås {period.label.split(" ")[0]}</button>
              ) : (
                <button className="lo-btn sm" onClick={() => onGoTab("avvik")}>Vis avvik</button>
              )}
              <button className="lo-btn sm ghost" onClick={onDismissAssist}>Avvis</button>
            </div>
          </div>
        )}

        {/* featured open period */}
        <div className="lo-feature">
          <div className="main">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Badge kind={period.status} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>{period.start} – {period.end} · {period.emp} ansatte · {period.lines} linjer</span>
            </div>
            <div className="title">{period.label}</div>
            <div className="note">{errorsOpen.length ? `${devs.filter((d) => d.status === "open").length} avvik åpne · ${errorsOpen.length} må bekreftes før lås` : "Alle avvik håndtert — klar til lås"}</div>
          </div>
          <div className="stats">
            <div className="lo-fstat"><div className="l">Brutto</div><div className="v">{kr(totals.gross)}</div></div>
            <div className="lo-fstat"><div className="l">Netto</div><div className="v">{kr(totals.net)}</div></div>
            <div className="lo-fstat"><div className="l">Avvik</div><div className={`v ${errorsOpen.length ? "warn" : ""}`}>{errorsOpen.length || "0"}</div></div>
          </div>
          <div className="actions">
            <button className="lo-btn primary" onClick={() => onGoTab("linjer")}>Åpne periode <Ic n="arrowRight" s={15} /></button>
          </div>
        </div>

        {/* action queue */}
        <Panel icon="alert" iconTone="error" title="Krever handling nå" cnt={errorsOpen.length} cntCrit={errorsOpen.length > 0}>
          {errorsOpen.length === 0 ? (
            <Empty icon="check" title="Ingen åpne avvik" sub="Calc-engine har ingen blokkerende avvik. Du kan låse perioden." />
          ) : (
            <div>
              {errorsOpen.map((d) => {
                const e = D().LO_EMP_BY_ID[d.uid] || {};
                return (
                  <div key={d.id} className="lo-devrow">
                    <div className="lo-devrow-main" style={{ gridTemplateColumns: "36px 1fr auto" }}>
                      <div className="lo-devicon error"><Ic n="alert" s={14} /></div>
                      <div>
                        <div className="dtitle"><b>{d.title}</b><span className="code">{d.code}</span></div>
                        <div className="ddetail">{d.detail}</div>
                      </div>
                      <div className="acts" style={{ alignSelf: "center" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, marginRight: 6 }}><Av uid={d.uid} size={24} /><span style={{ fontSize: 12.5, fontWeight: 500 }}>{e.name}</span></span>
                        <button className="lo-btn sm" onClick={() => onOpenEmp(d.uid)}>Vis vakt</button>
                        <button className="lo-btn sm primary" onClick={() => onConfirmDev(d.id)}><Ic n="check" s={13} /> Bekreft</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        {/* earlier periods */}
        <Panel icon="history" title="Tidligere perioder">
          <div className="lo-ptable" style={{ border: 0, borderRadius: 0 }}>
            <div className="lo-prow head">
              <div>Periode</div><div>Datoer</div><div>Ansatte</div><div className="lo-r">Brutto</div><div>Avvik</div><div>Status</div>
            </div>
            {periods.filter((p) => p.id !== period.id).map((p) => (
              <div key={p.id} className="lo-prow click" onClick={() => onSelectPeriod(p.id)}>
                <div className="pname">{p.label}</div>
                <div className="lo-kr" style={{ fontSize: 12.5, color: "var(--muted)" }}>{p.start} – {p.end}</div>
                <div className="lo-kr" style={{ fontSize: 13 }}>{p.emp}</div>
                <div className="lo-kr lo-r" style={{ fontWeight: 500 }}>{kr(p.gross)}</div>
                <div style={{ fontSize: 12.5, color: "var(--muted)" }}>— ingen åpne</div>
                <div><Badge kind={p.status} /></div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    );
  }

  // ===================================================================
  // LINJER
  // ===================================================================
  function Linjer({ emps, devs, totals, onOpenEmp, onSupplement }) {
    const { fmt0, Av, DeptDot } = L();
    const [q, setQ] = useState("");
    const [dept, setDept] = useState("alle");
    const [devF, setDevF] = useState("alle");
    const devCount = (uid) => devs.filter((d) => d.uid === uid && d.status === "open").length;
    const devKindFor = (uid) => {
      const ds = devs.filter((d) => d.uid === uid && d.status === "open");
      return ds.some((d) => d.kind === "error") ? "error" : ds.length ? "warning" : null;
    };
    const depts = D().LO_DEPT;

    const rows = useMemo(() => emps.filter((e) => {
      if (q && !e.name.toLowerCase().includes(q.toLowerCase())) return false;
      if (dept !== "alle" && e.dept !== dept) return false;
      if (devF === "med" && devCount(e.uid) === 0) return false;
      if (devF === "uten" && devCount(e.uid) > 0) return false;
      return true;
    }), [q, dept, devF, emps, devs]);

    const Cell = ({ v, cls }) => <div className={`cell ${cls || ""} ${!v || v === "—" ? "dim" : ""}`}>{v}</div>;

    return (
      <div>
        <div className="lo-filterbar">
          <div className="lo-search"><Ic n="search" s={14} c="var(--muted)" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søk navn …" /></div>
          <div className="lo-chip" onClick={() => setDept(dept === "alle" ? "kjokken" : dept === "kjokken" ? "sal" : dept === "sal" ? "bar" : "alle")}>
            {dept !== "alle" && <span className="dot" style={{ background: depts[dept].c }} />}<span style={{ color: "var(--muted)" }}>Avdeling:</span> <b>{dept === "alle" ? "Alle" : depts[dept].name}</b> <Ic n="chevDown" s={12} c="var(--muted)" />
          </div>
          {[["alle", "Alle"], ["med", "Med avvik"], ["uten", "Uten avvik"]].map(([k, l]) => (
            <button key={k} className={`lo-chip ${devF === k ? "on" : ""}`} onClick={() => setDevF(k)}>{l}</button>
          ))}
          <div style={{ flex: 1 }} />
          <span className="lo-count">{rows.length} av {emps.length} ansatte</span>
        </div>

        <div className="lo-lines">
          <div className="lo-lwrap">
            <div className="lo-lrow head">
              <div>Ansatt</div><div className="lo-r">Plan</div><div className="lo-r">Faktisk</div><div className="lo-r">OT</div><div className="lo-r">Kveld</div><div className="lo-r">Helg</div><div className="lo-r">Hellig</div><div className="lo-r">Manuelt</div><div className="lo-r">Avvik</div><div className="lo-r">Brutto</div><div></div>
            </div>
            {/* total row */}
            <div className="lo-lrow total">
              <div className="lo-emp"><span className="sigma">Σ Total</span></div>
              <Cell v={totals.sched.toFixed(1)} cls="" />
              <Cell v={totals.actual.toFixed(1)} cls="" />
              <Cell v={totals.ot.toFixed(1)} cls="ot" />
              <Cell v={totals.kveld.toFixed(1)} cls="" />
              <Cell v={totals.helg.toFixed(1)} cls="" />
              <Cell v={totals.hellig.toFixed(1)} cls="" />
              <Cell v={fmt0(totals.manual)} cls="" />
              <div className="cell"></div>
              <Cell v={fmt0(totals.gross)} cls="" />
              <div></div>
            </div>
            {rows.map((e) => {
              const dc = devCount(e.uid); const dk = devKindFor(e.uid);
              return (
                <div key={e.uid} className="lo-lrow click" onClick={() => onOpenEmp(e.uid)}>
                  <div className="lo-emp">
                    <Av uid={e.uid} size={28} />
                    <div style={{ minWidth: 0 }}>
                      <div className="nm">{e.name}</div>
                      <div className="rl"><DeptDot dept={e.dept} /><span>{e.deptName} · {e.type}</span></div>
                    </div>
                  </div>
                  <Cell v={e.sched.toFixed(1)} />
                  <Cell v={e.actual.toFixed(1)} cls={e.actual > e.sched ? "" : "dim"} />
                  <div className={`cell ${e.ot > 0 ? "ot" : "dim"}`}>{e.ot > 0 ? e.ot.toFixed(1) : "—"}</div>
                  <Cell v={e.kveld > 0 ? e.kveld.toFixed(1) : "—"} />
                  <Cell v={e.helg > 0 ? e.helg.toFixed(1) : "—"} />
                  <div className={`cell ${e.hellig > 0 ? "ot" : "dim"}`}>{e.hellig > 0 ? e.hellig.toFixed(1) : "—"}</div>
                  <Cell v={e.manual > 0 ? fmt0(e.manual) : "—"} />
                  <div className="cell">
                    {dc > 0 ? <span className="lo-devpill" style={{ color: TONE[dk] }}><span className="d" style={{ background: TONE[dk] }} />{dc}</span> : <span className="dim">—</span>}
                  </div>
                  <div className="cell" style={{ fontWeight: 600 }}>{fmt0(e.gross)}</div>
                  <div style={{ textAlign: "right", color: "var(--muted-soft)" }}><Ic n="chevRight" s={14} /></div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
          <button className="lo-btn sm" onClick={() => onSupplement(null)}><Ic n="plus" s={14} /> Manuelt tillegg</button>
        </div>
      </div>
    );
  }

  // ===================================================================
  // AVVIK
  // ===================================================================
  function Avvik({ period, devs, onConfirmDev, onConfirmAll, onOpenEmp, onLock }) {
    const { Av, Badge, Empty } = L();
    const [expanded, setExpanded] = useState(null);
    const [collapsed, setCollapsed] = useState({ info: true });
    const errors = devs.filter((d) => d.kind === "error" && d.status === "open");
    const warnings = devs.filter((d) => d.kind === "warning" && d.status === "open");
    const acked = devs.filter((d) => d.status === "ack");
    const lockable = errors.length === 0;

    const Group = ({ id, title, tone, items, defaultExpand }) => {
      const open = !collapsed[id];
      return (
        <div className="lo-devgroup">
          <div className="lo-devgroup-h" onClick={() => setCollapsed((c) => ({ ...c, [id]: !c[id] }))}>
            <span className="d" style={{ background: TONE[tone] }} /><span>{title}</span><span style={{ opacity: 0.7 }}>· {items.length}</span>
            <span className="line" /><Ic n={open ? "chevDown" : "chevRight"} s={12} />
          </div>
          {open && (items.length === 0 ? <Empty icon="check" title="Ingenting her" /> : (
            <div className="lo-devlist">
              {items.map((d, i) => <DevRow key={d.id} d={d} expanded={expanded === d.id || (defaultExpand && i === 0 && expanded == null)} onToggle={() => setExpanded((x) => x === d.id ? "" : d.id)} onConfirm={onConfirmDev} onOpenEmp={onOpenEmp} />)}
            </div>
          ))}
        </div>
      );
    };

    return (
      <div>
        {lockable ? (
          <div className="lo-banner ok">
            <div className="ic"><Ic n="check" s={18} /></div>
            <div className="bd"><div className="bt">Alle blokkerende avvik er bekreftet</div><div className="bs">{warnings.length} advarsler vises som info på lønnsslippen. Du kan låse perioden.</div></div>
            <button className="lo-btn primary" onClick={onLock}><Ic n="lock" s={15} /> Lås {period.label.split(" ")[0]}</button>
          </div>
        ) : (
          <div className="lo-banner warn">
            <div className="ic"><Ic n="alert" s={18} /></div>
            <div className="bd"><div className="bt">{errors.length} avvik må bekreftes før perioden kan låses</div><div className="bs">Resterende {warnings.length} er advarsler — du kan låse uten å håndtere dem, men de vises på lønnsslippen.</div></div>
            <button className="lo-btn sm" onClick={() => onConfirmAll("HELLIGDAG_KOLLISJON")}><Ic n="check" s={14} /> Bekreft alle rød-dag</button>
          </div>
        )}

        <Group id="error" title="Krever handling" tone="error" items={errors} defaultExpand />
        <Group id="warn" title="Advarsler" tone="warning" items={warnings} />
        <Group id="info" title="Til orientering · bekreftet" tone="info" items={acked} />
      </div>
    );
  }

  function DevRow({ d, expanded, onToggle, onConfirm, onOpenEmp }) {
    const { Av, Badge } = L();
    const toast = window.useToast();
    const e = D().LO_EMP_BY_ID[d.uid] || {};
    return (
      <div className={`lo-devrow ${expanded ? "open" : ""}`}>
        <div className="lo-devrow-main">
          <div className={`lo-devicon ${d.kind}`}><Ic n={d.kind === "info" ? "check" : "alert"} s={14} /></div>
          <div style={{ cursor: d.suggestion ? "pointer" : "default" }} onClick={() => d.suggestion && onToggle()}>
            <div className="dtitle"><b>{d.title}</b><span className="code">{d.code}</span></div>
            <div className="ddetail">{d.detail}</div>
          </div>
          <div className="who"><Av uid={d.uid} size={22} /><div><div className="nm">{e.name}</div><div className="dt">{d.date}</div></div></div>
          <div className="req">{d.requires}</div>
          <div className="acts">
            {d.status === "ack" ? <Badge kind="ack" /> : (
              <>
                <button className="lo-btn sm" onClick={() => onOpenEmp(d.uid)}>Vis vakt</button>
                <button className="lo-btn sm primary" onClick={() => onConfirm(d.id)}><Ic n="check" s={13} /> Bekreft</button>
              </>
            )}
          </div>
        </div>
        {expanded && d.suggestion && (
          <div className="lo-devexp">
            <div className="box">
              <div className="eyebrow">Foreslått handling</div>
              <div className="body">{d.suggestion}{d.note && <><br /><span style={{ color: "var(--fg)", fontWeight: 500 }}>Ansattes notat:</span> «{d.note}»</>}</div>
              <div className="acts">
                <button className="lo-btn sm primary" onClick={() => onConfirm(d.id)}><Ic n="check" s={13} /> Bekreft tillegg</button>
                <button className="lo-btn sm" onClick={() => onOpenEmp(d.uid)}><Ic n="grid" s={13} /> Vis vakt</button>
                <button className="lo-btn sm ghost" onClick={() => toast("Vakt avvist · sendt tilbake til vaktansvarlig", { undo: () => {} })}>Avvis vakten</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  window.LoViews = { Oversikt, Linjer, Avvik };
})();
