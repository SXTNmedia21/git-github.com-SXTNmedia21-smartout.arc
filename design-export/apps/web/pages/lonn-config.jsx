// ===== Lønn — config views: Regler (+ tester) · Innstillinger (window.LoConfig) =====
(function () {
  const { useState } = React;
  const Ic = window.Ic;
  const D = () => window.SmartoutData;
  const L = () => window.Lo;

  // ===================================================================
  // REGLER — supplement rules + tester
  // ===================================================================
  function Regler({ rules, onToggle, toast }) {
    const { Switch, Av } = L();
    const trace = D().LO_RULE_TRACE;
    const activeCount = rules.filter((r) => r.active).length;

    return (
      <div className="lo-rulegrid">
        {/* rules list */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 600 }}>{activeCount} aktive regler · gjelder hele organisasjonen</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="lo-btn sm" onClick={() => toast("Tester regler mot april …")}><Ic n="play" s={13} /> Test mot april</button>
              <button className="lo-btn sm primary" onClick={() => toast("Ny regel — utkast opprettet")}><Ic n="plus" s={13} /> Ny regel</button>
            </div>
          </div>
          {rules.map((r) => (
            <div key={r.code} className={`lo-rule ${r.active ? "on" : ""}`}>
              <div><div className="code">{r.code}</div><div className="nm">{r.label}</div></div>
              <div className="amt">{r.amount}</div>
              <div className="when-col"><div className="when">{r.when}</div><div className="applies"><span>Gjelder: {r.applies}</span>{r.warn && <><span style={{ opacity: 0.4 }}>·</span><span className="w">{r.warn}</span></>}</div></div>
              <Switch on={r.active} onClick={() => onToggle(r.code)} />
            </div>
          ))}
        </div>

        {/* tester */}
        <div className="lo-tester">
          <div className="eyebrow"><Ic n="play" s={14} c="var(--orange)" /> Regel-tester</div>
          <div className="rulename">{trace.rule}</div>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Kjør mot vakt</div>
          <div className="shiftcard">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}><Av uid={trace.uid} size={20} /><span style={{ fontWeight: 500, fontSize: 12.5 }}>{trace.shiftLabel}</span></div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>{trace.hours.toFixed(1)} t · grunnlønn {trace.rate} kr/t</div>
          </div>
          <div className="lo-trace">
            <div className="eyebrow">Trace · derivation</div>
            {trace.lines.map((ln, i) => (
              <div key={i} className={`ln ${ln.tone || ""}`}><span className="mk">·</span><span>{ln.t}</span></div>
            ))}
            <div className="ln result"><span className="mk">➜</span><span>{trace.result}</span></div>
          </div>
          <div style={{ marginTop: 14, fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
            <strong style={{ color: "var(--fg)" }}>Testet mot:</strong> {trace.testedAgainst}
          </div>
        </div>
      </div>
    );
  }

  // ===================================================================
  // INNSTILLINGER — policy defaults
  // ===================================================================
  function Innstillinger({ policies, onTogglePolicy, toast }) {
    const { Switch, Section } = L();
    const S = D().LO_SETTINGS;
    const [periodType, setPeriodType] = useState("Måned");

    const SetField = ({ f }) => (
      <div className="lo-setfield">
        <div className="l">{f.label}</div>
        {f.seg ? (
          <div className="lo-seg">{f.seg.map((s) => <button key={s} className={periodType === s ? "on" : ""} onClick={() => setPeriodType(s)}>{s}</button>)}</div>
        ) : (
          <div className={`box ${/\d|t\/|min|kr/.test(f.value) ? "mono" : ""}`}>{f.value}</div>
        )}
        {f.hint && <div className="hint">{f.hint}</div>}
      </div>
    );

    return (
      <div style={{ maxWidth: 780 }}>
        <Section title="Periode-konvensjon" sub="Når en periode starter og slutter">
          <div className="lo-setgrid">{S.period.map((f) => <SetField key={f.key} f={f} />)}</div>
        </Section>
        <Section title="Defaults · timer og pauser">
          <div className="lo-setgrid">{S.hours.map((f) => <SetField key={f.key} f={f} />)}</div>
        </Section>
        <Section title="Bekreftelser ved lås" sub="Disse må håndteres før perioden låses">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {policies.map((p) => (
              <div key={p.key} className="lo-policy">
                <Switch on={p.on} onClick={() => onTogglePolicy(p.key)} />
                <div className="bd"><div className="t">{p.label}</div><div className="s">{p.detail}</div></div>
                {p.blocking && <span className="lo-badge error">blokkerer</span>}
                {p.warn && <span className="lo-badge warning">advarsel</span>}
              </div>
            ))}
          </div>
        </Section>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
          <button className="lo-btn primary" onClick={() => toast("Innstillinger lagret")}><Ic n="check" s={15} /> Lagre endringer</button>
        </div>
      </div>
    );
  }

  window.LoConfig = { Regler, Innstillinger };
})();
