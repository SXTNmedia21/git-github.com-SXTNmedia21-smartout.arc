// ===== Rapporter — Datakilder (integrations + field mapping) =====
// Connected sources with sync health, freshness and field-mapping coverage. Click a
// source to open a drawer with its field map (matched / unmapped / low-confidence)
// and warnings. Reconnect / sync / map actions toast + undo. Reuses RAP_SOURCES.
(function () {
  const { useState } = React;

  const SYNC_LABEL = { ok: "Synket", warning: "Trenger tilsyn", error: "Feil", syncing: "Synker…", off: "Av" };

  function RapDatakilder({ toast }) {
    const R = window.Rap; const { Ic } = R;
    const D = window.SmartoutData;
    const SOURCES = D.RAP_SOURCES;
    const [openSrc, setOpenSrc] = useState(null);

    const connected = SOURCES.filter((s) => s.status !== "off");
    const avgHealth = Math.round(connected.reduce((a, s) => a + (s.health || 0), 0) / connected.length);
    const needsAttn = SOURCES.filter((s) => s.status === "warning" || s.status === "error");

    return (
      <div>
        {/* health strip */}
        <div className="so-grid-2" style={{ marginBottom: 16 }}>
          <div className="rap-warn info" style={{ alignItems: "center" }}>
            <span className="ic"><Ic n="layers" s={18} /></span>
            <div style={{ flex: 1 }}>
              <div className="bt">{connected.length} kilder tilkoblet · datakvalitet {avgHealth}%</div>
              <div className="bs">Botsson kombinerer disse til innsiktene. Jo bedre mapping, desto sikrere tall.</div>
            </div>
          </div>
          <div className={`rap-warn ${needsAttn.length ? "warn" : "info"}`} style={{ alignItems: "center" }}>
            <span className="ic"><Ic n={needsAttn.length ? "alert" : "check"} s={18} /></span>
            <div style={{ flex: 1 }}>
              <div className="bt">{needsAttn.length ? `${needsAttn.length} kilder trenger tilsyn` : "Alle kilder er friske"}</div>
              <div className="bs">{needsAttn.length ? needsAttn.map((s) => s.name).join(", ") + " har umappede felt." : "Ingen handling kreves akkurat nå."}</div>
            </div>
          </div>
        </div>

        {/* source grid */}
        <div className="rap-src-grid">
          {SOURCES.map((s) => (
            <div key={s.id} className="rap-source" onClick={() => setOpenSrc(s.id)}>
              <div className="rap-source-top">
                <span className="rap-source-ic"><Ic n={s.ic} s={19} /></span>
                <div className="rap-source-id">
                  <div className="rap-source-name">{s.name}</div>
                  <div className="rap-source-kind">{s.kind}</div>
                </div>
                <span className={`rap-sync ${s.status}`}><span className="dot" />{SYNC_LABEL[s.status]}</span>
              </div>
              <div className="rap-source-note">{s.note}</div>
              <div className="rap-source-foot">
                {s.status !== "off" ? (
                  <>
                    <span className="sf"><Ic n="history" s={12} /> <span className="mono">{s.last}</span></span>
                    <span className="sf"><Ic n="repeat" s={12} /> {s.freq}</span>
                    <span className="spacer" />
                    <span className="sf" title="Mappede felt">
                      <span className="rap-mapbar"><span className="track"><span className={s.mapped < s.total ? "warn" : ""} style={{ width: (s.total ? s.mapped / s.total * 100 : 0) + "%" }} /></span></span>
                      <span className="mono">{s.mapped}/{s.total}</span>
                    </span>
                  </>
                ) : (
                  <button className="rap-btn sm" onClick={(e) => { e.stopPropagation(); toast("Last opp CSV/Excel"); }}><Ic n="download" s={13} /> Last opp fil</button>
                )}
              </div>
            </div>
          ))}
        </div>

        {openSrc && <SourceDrawer src={SOURCES.find((s) => s.id === openSrc)} onClose={() => setOpenSrc(null)} toast={toast} />}
      </div>
    );
  }

  // ---- source detail drawer (field mapping) ----
  function SourceDrawer({ src, onClose, toast }) {
    const R = window.Rap; const { Ic } = R;
    const D = window.SmartoutData;
    const hasMap = D.RAP_MAPPING.source === src.id;
    const fields = hasMap ? D.RAP_MAPPING.fields : genericFields(src);
    const warnings = hasMap ? D.RAP_MAPPING.warnings : [];

    return (
      <>
        <div className="rap-scrim" onClick={onClose} />
        <aside className="rap-drawer">
          <div className="rap-drawer-head">
            <div className="rap-drawer-r1">
              <span className="rap-source-ic" style={{ width: 32, height: 32 }}><Ic n={src.ic} s={17} /></span>
              <span className="rap-drawer-ey">Datakilde · {src.kind}</span>
              <span className="spacer" />
              <span className={`rap-sync ${src.status}`}><span className="dot" />{SYNC_LABEL[src.status]}</span>
              <button className="rap-iconbtn" onClick={onClose}><Ic n="x" s={18} /></button>
            </div>
            <h2 className="rap-drawer-title">{src.name}</h2>
            <div className="rap-statline" style={{ marginTop: 14 }}>
              <div className="rap-stat"><div className="l">Datakvalitet</div><div className={`v ${src.health >= 90 ? "ok" : src.health >= 75 ? "warn" : "crit"}`}>{src.health != null ? src.health + "%" : "—"}</div></div>
              <div className="rap-stat"><div className="l">Felt mappet</div><div className="v">{src.mapped}<span style={{ fontSize: 14, color: "var(--muted-soft)" }}>/{src.total}</span></div></div>
              <div className="rap-stat"><div className="l">Frekvens</div><div className="v" style={{ fontSize: 18, alignSelf: "center" }}>{src.freq}</div></div>
              <div className="rap-stat"><div className="l">Sist synket</div><div className="v" style={{ fontSize: 18, alignSelf: "center", color: "var(--muted)" }}>{src.last}</div></div>
            </div>
          </div>

          <div className="rap-drawer-body">
            {warnings.map((w, i) => (
              <div key={i} className={`rap-warn ${w.sev}`} style={{ marginBottom: 12 }}>
                <span className="ic"><Ic n={w.sev === "warn" ? "alert" : "info"} s={16} /></span>
                <div><div className="bt">{w.t}</div><div className="bs">{w.s}</div></div>
              </div>
            ))}

            <h4 className="rap-secttl" style={{ marginTop: 6 }}><Ic n="route" s={12} /> Feltmapping</h4>
            <div className="so-panel" style={{ padding: "2px 14px", marginBottom: 18 }}>
              <table className="rap-maptbl">
                <thead>
                  <tr><th>Kildefelt</th><th></th><th>Smartout-felt</th><th>Eksempel</th><th style={{ textAlign: "right" }}>Status</th></tr>
                </thead>
                <tbody>
                  {fields.map((f, i) => (
                    <tr key={i}>
                      <td className="fsrc">{f.src}</td>
                      <td className="arrow"><Ic n="arrowRight" s={13} /></td>
                      <td className={`fdst ${f.status === "unmapped" ? "unmapped" : ""}`}>{f.dst}</td>
                      <td className="fsample">{f.sample}</td>
                      <td style={{ textAlign: "right" }}>
                        {f.status === "unmapped"
                          ? <button className="rap-btn sm" onClick={() => toast(`«${f.src}» mappet`)}><Ic n="plus" s={12} /> Map</button>
                          : <span className={`rap-mapstat ${f.status}`}>{f.status === "ok" ? `${f.conf}%` : `${f.conf}% lav`}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h4 className="rap-secttl"><Ic n="link" s={12} /> Brukes i</h4>
            <div className="so-panel" style={{ padding: "6px 18px", marginBottom: 18 }}>
              {usedIn(src.id).map((u, i, arr) => (
                <div key={u} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 0", borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <span className="rap-act-ic" style={{ width: 26, height: 26 }}><Ic n="file" s={13} /></span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{u}</span>
                  <Ic n="arrowRight" s={14} c="var(--muted-soft)" />
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="rap-btn" onClick={() => toast(`Synkroniserer ${src.name}…`)}><Ic n="repeat" s={15} /> Synk nå</button>
              <button className="rap-btn" onClick={() => toast("Mapping lagret")}><Ic n="route" s={15} /> Rediger mapping</button>
              <span style={{ flex: 1 }} />
              <button className="rap-btn" onClick={() => toast(`${src.name} koblet fra`)}><Ic n="ban" s={15} /> Koble fra</button>
            </div>
          </div>
        </aside>
      </>
    );
  }

  function genericFields(src) {
    const rows = Math.min(src.mapped, 5);
    const seed = ["dato", "beløp", "antall", "kategori", "tidspunkt", "id", "status"];
    return seed.slice(0, Math.max(3, rows)).map((s, i) => ({
      src: s + "_felt", dst: s.charAt(0).toUpperCase() + s.slice(1), status: "ok", conf: 99 - i * 2, sample: i === 1 ? "1 240" : i === 2 ? "42" : "2026-05-30",
    }));
  }
  function usedIn(id) {
    const map = {
      pos: ["Salg vs bemanning", "Snittbong-analyse", "Daglig driftspuls"],
      payroll: ["Ukentlig lønnsrapport", "Lønnsavvik", "Avdelingslønnsomhet"],
      schedule: ["Salg vs bemanning", "Dekningsgrad", "Overtidsvarsel"],
      guest: ["Gjesteetterspørsel vs plan", "Prognose uke 23"],
      delivery: ["Leveringssalg", "Kostnadslekkasje"],
      expenses: ["Avdelingslønnsomhet", "Kostnadslekkasje"],
      accounting: ["Dekningsbidrag", "Budsjettavvik"],
      manual: ["Engangsanalyser"],
    };
    return map[id] || ["Ingen aktive rapporter"];
  }

  window.RapDatakilder = RapDatakilder;
})();
