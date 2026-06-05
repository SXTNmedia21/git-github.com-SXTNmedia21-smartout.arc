// ===== Rapporter — Planlagte (scheduled reports) =====
// Automated reports: cadence + recipient groups + next/last run + status, with
// pause/resume, a create modal (preset · cadence · recipients · format), and a
// delivery audit log. Everything toasts + undoes; nothing sends without confirm.
(function () {
  const { useState } = React;

  function RapPlanlagte({ scope, toast }) {
    const R = window.Rap; const { Ic } = R;
    const D = window.SmartoutData;
    const GROUPS = D.RAP_RECIPIENT_GROUPS;
    const groupById = (id) => GROUPS.find((g) => g.id === id) || { label: id, n: 0, color: "var(--muted)" };

    const [rows, setRows] = useState(() => D.RAP_SCHEDULED.map((s) => ({ ...s })));
    const [createOpen, setCreateOpen] = useState(false);
    const docs = window.SmartoutReportDocs || { pdf: "#", email: "#", driftspuls: "#", avdeling: "#" };
    const previewEmail = () => window.open(docs.email, "_blank", "noopener");
    const reportDocFor = (s) => {
      const k = (s.name + " " + (s.preset || "")).toLowerCase();
      if (/driftspuls|daglig/.test(k)) return docs.driftspuls || docs.pdf;
      if (/avdeling|lønnsomhet|lonnsomhet|dekningsbidrag/.test(k)) return docs.avdeling || docs.pdf;
      if (/lønnskjøring|lonnskjoring|kjøring/.test(k)) return docs.lonnskjoring || docs.pdf;
      return docs.pdf;
    };
    const openReport = (s) => window.open(reportDocFor(s), "_blank", "noopener");

    const togglePause = (id) => {
      const r = rows.find((x) => x.id === id);
      const next = r.status === "active" ? "paused" : "active";
      setRows((rs) => rs.map((x) => x.id === id ? { ...x, status: next, next: next === "paused" ? "satt på pause" : "neste kjøring planlagt" } : x));
      toast(`«${r.name}» ${next === "paused" ? "satt på pause" : "aktivert"}`, {
        undo: () => setRows((rs) => rs.map((x) => x.id === id ? { ...r } : x)),
      });
    };
    const addReport = (rep) => {
      setRows((rs) => [rep, ...rs]);
      toast(`«${rep.name}» planlagt`, { undo: () => setRows((rs) => rs.filter((x) => x.id !== rep.id)) });
    };

    const activeCount = rows.filter((r) => r.status === "active").length;
    const recipReach = new Set();
    rows.forEach((r) => r.status === "active" && r.recipients.forEach((g) => recipReach.add(g)));
    const totalPeople = [...recipReach].reduce((a, g) => a + groupById(g).n, 0);

    return (
      <div>
        {/* summary strip */}
        <div className="rap-warn info" style={{ alignItems: "center", marginBottom: 16 }}>
          <span className="ic"><Ic n="timer" s={18} /></span>
          <div style={{ flex: 1 }}>
            <div className="bt">{activeCount} aktive utsendinger · når ca. {totalPeople} mottakere</div>
            <div className="bs">Rapporter genereres og sendes automatisk. Du kan pause når som helst — ingenting sendes uten at en utsending er aktiv.</div>
          </div>
          <button className="rap-btn primary sm" onClick={() => setCreateOpen(true)}><Ic n="plus" s={14} sw={2.2} /> Ny utsending</button>
        </div>

        <div className="so-grid-2">
          {/* scheduled list */}
          <div className="so-stack">
            <R.Panel icon="repeat" title="Planlagte utsendinger" count={rows.length}>
              <div className="rap-sched">
                {rows.map((s) => (
                  <div key={s.id} className="rap-sched-row" onClick={previewEmail} title="Forhåndsvis e-postutkast">
                    <span className={`rap-sched-ic ${s.status === "paused" ? "paused" : ""}`}><Ic n={cadenceIcon(s.cadence)} s={17} /></span>
                    <div className="rap-sched-main">
                      <div className="rap-sched-name">{s.name}</div>
                      <div className="rap-sched-meta">
                        <span>{s.cadence}</span><span className="sep">·</span>
                        <span className="mono">{s.when}</span><span className="sep">·</span>
                        <span>{s.scope}</span><span className="sep">·</span>
                        <span className="mono">{s.format}</span>
                      </div>
                      <div className="rap-sched-meta" style={{ marginTop: 6 }}>
                        <span className="rap-sched-recip">
                          {s.recipients.map((gid) => {
                            const g = groupById(gid);
                            return <span key={gid} className="so-av" style={{ width: 22, height: 22, fontSize: 8.5, background: g.color }} title={`${g.label} (${g.n})`}>{g.label.slice(0, 2)}</span>;
                          })}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>{s.recipients.map((g) => groupById(g).label).join(" · ")}</span>
                      </div>
                    </div>
                    <div className="rap-sched-next">
                      <div className="n">{s.next}</div>
                      <div className="l">sist: {s.last}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }} onClick={(e) => e.stopPropagation()}>
                      <span className={`rap-statepill ${s.status}`}>{s.status === "active" ? "Aktiv" : "Pauset"}</span>
                      <span style={{ display: "flex", gap: 2 }}>
                        <button className="rap-iconbtn" title="Forhåndsvis e-post" onClick={previewEmail}><Ic n="send" s={15} /></button>
                        <button className="rap-iconbtn" title="Åpne rapport (PDF)" onClick={() => openReport(s)}><Ic n="file" s={15} /></button>
                        <button className="rap-iconbtn" title={s.status === "active" ? "Pause" : "Aktiver"} onClick={() => togglePause(s.id)}>
                          <Ic n={s.status === "active" ? "bellOff" : "play"} s={16} />
                        </button>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </R.Panel>
          </div>

          {/* audit + recipients */}
          <div className="so-stack">
            <R.Panel icon="history" title="Leveringslogg" right={<span className="so-eyebrow-lbl" style={{ marginRight: 6, fontSize: 10, color: "var(--muted)" }}>Siste 5</span>}>
              <div className="rap-act">
                {D.RAP_DELIVERY_LOG.map((d) => (
                  <div key={d.id} className="rap-act-row">
                    <span className={`rap-act-ic ${d.status === "ok" ? "approved" : "dismissed"}`}><Ic n={d.status === "ok" ? "check" : "alert"} s={13} /></span>
                    <div className="rap-act-body">
                      <span className="who">{d.report}</span> → {d.to}
                      <div className="rap-act-time">{d.t} · {d.opened}</div>
                    </div>
                    {d.status !== "ok" && <button className="rap-btn sm" onClick={() => toast("Levering forsøkt på nytt")}><Ic n="repeat" s={12} /></button>}
                  </div>
                ))}
              </div>
            </R.Panel>

            <R.Panel icon="users" title="Mottakergrupper">
              <div style={{ padding: "6px 18px 14px" }}>
                {GROUPS.map((g, i) => {
                  const inUse = rows.some((r) => r.status === "active" && r.recipients.includes(g.id));
                  return (
                    <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 0", borderBottom: i < GROUPS.length - 1 ? "1px solid var(--border)" : "none" }}>
                      <span className="so-av" style={{ width: 28, height: 28, fontSize: 10, background: g.color }}>{g.label.slice(0, 2)}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{g.label}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>{g.n} {g.n === 1 ? "person" : "personer"}</div>
                      </div>
                      <span className={`rap-statepill ${inUse ? "active" : "paused"}`}>{inUse ? "Mottar" : "Ingen"}</span>
                    </div>
                  );
                })}
              </div>
            </R.Panel>
          </div>
        </div>

        {createOpen && <CreateModal onClose={() => setCreateOpen(false)} onCreate={addReport} toast={toast} groups={GROUPS} />}
      </div>
    );
  }

  function cadenceIcon(c) {
    return c === "Daglig" ? "sun" : c === "Ukentlig" ? "calendar" : c === "Månedlig" ? "layers" : "timer";
  }

  // ---- create scheduled report modal ----
  function CreateModal({ onClose, onCreate, toast, groups }) {
    const R = window.Rap; const { Ic } = R;
    const D = window.SmartoutData;
    const [preset, setPreset] = useState(D.RAP_PRESETS[0].name);
    const [cadence, setCadence] = useState("Ukentlig");
    const [when, setWhen] = useState("Mandag 07:00");
    const [format, setFormat] = useState("PDF");
    const [scope, setScope] = useState("Nord Gruppen");
    const [recips, setRecips] = useState(["owners", "gm"]);

    const whenOpts = {
      Daglig: ["06:00", "07:00", "18:00"],
      Ukentlig: ["Mandag 07:00", "Fredag 16:00", "Søndag 20:00"],
      Månedlig: ["1. i måneden 08:00", "Siste fredag 16:00"],
      "Ved terskel": ["8 t overtid", "Lønn > budsjett", "Dekning < 90 %"],
    };
    const toggleRecip = (id) => setRecips((r) => r.includes(id) ? r.filter((x) => x !== id) : [...r, id]);
    const reach = recips.reduce((a, id) => a + (groups.find((g) => g.id === id) || { n: 0 }).n, 0);

    const create = () => {
      if (!recips.length) { toast("Velg minst én mottakergruppe"); return; }
      onCreate({
        id: "s" + Date.now(), name: preset, preset, cadence, when, channel: format === "App" ? "App-varsel" : "E-post + app",
        status: "active", next: "neste kjøring planlagt", last: "ikke kjørt ennå",
        recipients: recips, scope, format, owner: "ma",
      });
      onClose();
    };

    return (
      <div className="rap-modal" onMouseDown={onClose}>
        <div className="rap-modal-card" onMouseDown={(e) => e.stopPropagation()}>
          <div className="rap-modal-head">
            <span className="rap-sched-ic" style={{ width: 40, height: 40 }}><Ic n="timer" s={19} /></span>
            <div style={{ flex: 1 }}>
              <h3>Ny planlagt utsending</h3>
              <div className="s">Velg rapport, frekvens og mottakere. Du kan pause eller endre når som helst.</div>
            </div>
            <button className="rap-iconbtn" onClick={onClose}><Ic n="x" s={18} /></button>
          </div>

          <div className="rap-modal-body">
            <div>
              <label className="rap-fieldlbl">Rapport</label>
              <div className="rap-seg">
                {D.RAP_PRESETS.slice(0, 4).map((p) => (
                  <button key={p.id} className={preset === p.name ? "on" : ""} onClick={() => setPreset(p.name)}><Ic n={p.ic} s={13} /> {p.name}</button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              <div>
                <label className="rap-fieldlbl">Frekvens</label>
                <div className="rap-seg">
                  {["Daglig", "Ukentlig", "Månedlig", "Ved terskel"].map((c) => (
                    <button key={c} className={cadence === c ? "on" : ""} onClick={() => { setCadence(c); setWhen(whenOpts[c][0]); }}>{c}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="rap-fieldlbl">Tidspunkt</label>
                <div className="rap-seg">
                  {whenOpts[cadence].map((w) => (
                    <button key={w} className={when === w ? "on" : ""} onClick={() => setWhen(w)}>{w}</button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="rap-fieldlbl">Mottakere · {reach} personer</label>
              <div className="rap-recip-grid">
                {groups.map((g) => (
                  <div key={g.id} className={`rap-recip ${recips.includes(g.id) ? "on" : ""}`} onClick={() => toggleRecip(g.id)}>
                    <span className="ck">{recips.includes(g.id) && <Ic n="check" s={12} sw={3} />}</span>
                    <span className="so-av" style={{ width: 24, height: 24, fontSize: 9, background: g.color }}>{g.label.slice(0, 2)}</span>
                    <span className="rl">{g.label}</span>
                    <span className="rn">{g.n}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              <div>
                <label className="rap-fieldlbl">Format</label>
                <div className="rap-seg">
                  {["PDF", "Excel", "App"].map((f) => <button key={f} className={format === f ? "on" : ""} onClick={() => setFormat(f)}>{f}</button>)}
                </div>
              </div>
              <div>
                <label className="rap-fieldlbl">Omfang</label>
                <div className="rap-seg">
                  {["Nord Gruppen", "Per sted", "Bistro Nord"].map((s) => <button key={s} className={scope === s ? "on" : ""} onClick={() => setScope(s)}>{s}</button>)}
                </div>
              </div>
            </div>

            <div className="rap-preview-mini">
              <div className="pm-head"><Ic n="eye" s={13} /> Forhåndsvisning</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{preset}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
                {cadence === "Ved terskel" ? "Utløses automatisk" : cadence} · {when} · {scope} · sendes som {format} til {reach} mottakere i {recips.length} {recips.length === 1 ? "gruppe" : "grupper"}.
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
                <button className="rap-btn sm" onClick={() => window.open((window.SmartoutReportDocs || {}).email || "#", "_blank", "noopener")}><Ic n="send" s={13} /> Se e-postutkast</button>
                <button className="rap-btn sm" onClick={() => window.open((window.SmartoutReportDocs || {}).pdf || "#", "_blank", "noopener")}><Ic n="file" s={13} /> Se rapport</button>
              </div>
            </div>
          </div>

          <div className="rap-modal-foot">
            <span style={{ fontSize: 11.5, color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 6 }}><Ic n="lock" s={13} /> Ingenting sendes før første planlagte kjøring</span>
            <span className="spacer" />
            <button className="rap-btn" onClick={onClose}>Avbryt</button>
            <button className="rap-btn primary" onClick={create}><Ic n="check" s={15} sw={2.2} /> Planlegg utsending</button>
          </div>
        </div>
      </div>
    );
  }

  window.RapPlanlagte = RapPlanlagte;
})();
