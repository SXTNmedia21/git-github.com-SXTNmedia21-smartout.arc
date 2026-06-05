// ===== Kontrakter — shared helpers + Botsson tariff/legal advisor =====
// Exposes window.Ct: lookups, status meta, and the MCP-backed advisor chat
// (assistive, cites sources, recommends grades — never auto-applies legal terms).
(function () {
  const { useState, useRef, useEffect } = React;
  const A = window.An;
  const { Ic, SD } = A;

  const STATUS = {
    draft:    { label: "Utkast", ic: "file", tone: "draft" },
    ready:    { label: "Klar", ic: "checkdoc", tone: "ready" },
    sent:     { label: "Sendt", ic: "send", tone: "sent" },
    viewed:   { label: "Sett", ic: "eye", tone: "viewed" },
    signed:   { label: "Signert", ic: "check", tone: "signed" },
    rejected: { label: "Avvist", ic: "ban", tone: "rejected" },
    expired:  { label: "Utløpt", ic: "clock", tone: "expired" },
    failed:   { label: "Feilet", ic: "alert", tone: "failed" },
  };
  const statusMeta = (s) => STATUS[s] || STATUS.draft;
  const gradeById = (id) => (SD.CT_TARIFF.grades.find((g) => g.id === id) || {});
  const tplById = (id) => (SD.CT_TEMPLATES.find((t) => t.id === id) || {});
  const groupById = (id) => (SD.CT_GROUPS.find((g) => g.id === id) || {});
  const fmtKr = (n) => (n == null ? "—" : Number(n).toLocaleString("nb-NO"));

  // ---------- Botsson tariff/legal advisor (reusable chat panel) ----------
  function Advisor({ onApply, applied, compact }) {
    const [log, setLog] = useState(() => SD.CT_BOT_THREAD.map((m) => ({ ...m })));
    const [done, setDone] = useState({});
    const [asked, setAsked] = useState({});
    const logRef = useRef(null);
    useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log]);

    const ask = (qa, i) => {
      setAsked((a) => ({ ...a, [i]: true }));
      setLog((l) => [...l, { who: "me", text: qa.q }]);
      setTimeout(() => {
        setLog((l) => [...l, { who: "bot", text: qa.text, conf: qa.conf, sources: qa.sources, apply: qa.apply, qi: i }]);
      }, 360);
    };
    const apply = (m) => {
      if (!m.apply) return;
      setDone((d) => ({ ...d, [m.qi]: true }));
      onApply && onApply(m.apply);
    };
    const unasked = SD.CT_BOT_QA.map((qa, i) => ({ qa, i })).filter((x) => !asked[x.i]);

    return (
      <aside className="ct-advisor">
        <div className="ct-adv-head">
          <span className="ct-adv-av"><Ic n="bot" s={17} /></span>
          <div className="ct-adv-h">
            <div className="t">Botsson <span className="mcp">MCP · Jus</span></div>
            <div className="s">Koblet til {SD.CT_TARIFF.name} + Skatteetaten</div>
          </div>
        </div>
        <div className="ct-adv-log" ref={logRef}>
          {log.map((m, i) => m.who === "me" ? (
            <div key={i} className="ct-adv-msg me">{m.text}</div>
          ) : (
            <div key={i} className="ct-adv-msg bot">
              <div className="ct-adv-bubble">
                <Rich text={m.text} />
                {m.conf != null && (
                  <div className="ct-adv-conf"><span className="bar"><span style={{ width: Math.round(m.conf * 100) + "%" }} /></span>{Math.round(m.conf * 100)}% sikkerhet</div>
                )}
                {m.sources && (
                  <div className="ct-adv-src">{m.sources.map((s, k) => <span key={k} className="s"><Ic n="scale" s={12} /> {s}</span>)}</div>
                )}
                {m.apply && (
                  <button className={`ct-adv-apply ${done[m.qi] || applied[m.apply.field] ? "done" : ""}`} onClick={() => apply(m)}>
                    <Ic n={done[m.qi] || applied[m.apply.field] ? "check" : "plus"} s={13} sw={2.2} /> {done[m.qi] || applied[m.apply.field] ? "Lagt til" : m.apply.label}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        {unasked.length > 0 && (
          <div className="ct-adv-suggest">
            {unasked.slice(0, 3).map(({ qa, i }) => (
              <button key={i} className="ct-adv-chip" onClick={() => ask(qa, i)}>{qa.q}</button>
            ))}
          </div>
        )}
        <div className="ct-adv-disc"><Ic n="shield" s={12} /> Botsson foreslår og forklarer — den endrer aldri lovpålagte vilkår uten at du bekrefter.</div>
      </aside>
    );
  }

  // tiny **bold** renderer
  function Rich({ text }) {
    const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
    return <>{parts.map((p, i) => /^\*\*.+\*\*$/.test(p) ? <strong key={i}>{p.slice(2, -2)}</strong> : <React.Fragment key={i}>{p}</React.Fragment>)}</>;
  }

  window.Ct = { Ic, SD, A, STATUS, statusMeta, gradeById, tplById, groupById, fmtKr, Advisor, Rich };
})();
