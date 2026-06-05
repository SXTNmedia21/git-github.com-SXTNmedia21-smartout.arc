// ===== Kommunikasjon · Skranke — analytics, setup, desk modal =====
// Exposes: window.KoSkrankeAnalyse (analytics dashboard),
//          window.KoSkrankeSetup (helpdesk setup list),
//          window.KoDeskModal (enable/configure a channel as a skranke).
// Consumed by the Skranke tab host (kommunikasjon-skranke.jsx).
(function () {
  const { useState, useEffect, useMemo } = React;
  const Ko = window.Ko, Ic = window.Ic, SD = window.SmartoutData;

  // ============================================================
  // ANALYSE — measurable service quality
  // ============================================================
  function KoSkrankeAnalyse({ desks, cases }) {
    const A = SD.SKRANKE_ANALYTICS;
    const maxVol = Math.max(...A.volume.flatMap((v) => [v.created, v.resolved]));
    const METRICS = [
      { lbl: "Åpne saker", val: A.openTickets, ic: "inbox" },
      { lbl: "Forfalt", val: A.overdue, ic: "alert", tone: A.overdue > 0 ? "crit" : "ok" },
      { lbl: "Snitt førstesvar", val: A.avgFirstResponseMin, u: "min", ic: "timer", tone: A.avgFirstResponseMin <= 20 ? "ok" : "warn" },
      { lbl: "Snitt løsetid", val: A.avgResolutionHrs, u: "t", ic: "clock" },
      { lbl: "AI-svar godtatt", val: A.aiAcceptedPct, u: "%", ic: "bot", tone: "ok" },
      { lbl: "Løst denne uka", val: A.resolvedThisWeek, ic: "check", tone: "ok" },
    ];
    return (
      <div className="ko-stack">
        <div className="ko-metricrow">
          {METRICS.map((m) => (
            <div key={m.lbl} className="ko-metric">
              <span className="ko-metric-lbl"><span className="ico"><Ic n={m.ic} s={13} /></span>{m.lbl}</span>
              <span className={`ko-metric-val ${m.tone || ""}`}>{m.val}{m.u && <span className="u">{m.u}</span>}</span>
            </div>
          ))}
        </div>

        <div className="so-grid-2">
          {/* workload chart */}
          <Ko.Panel icon="chart" title="Saksvolum denne uka" sub="Opprettet vs. løst">
            <div className="ko-chartwrap">
              <div className="ko-chart">
                {A.volume.map((v) => (
                  <div key={v.d} className="ko-chart-col">
                    <div className="ko-chart-bars">
                      <span className="bar created" style={{ height: `${(v.created / maxVol) * 100}%` }} title={`Opprettet ${v.created}`} />
                      <span className="bar resolved" style={{ height: `${(v.resolved / maxVol) * 100}%` }} title={`Løst ${v.resolved}`} />
                    </div>
                    <span className="ko-chart-x">{v.d}</span>
                  </div>
                ))}
              </div>
              <div className="ko-chart-legend">
                <span><i className="dot created" /> Opprettet</span>
                <span><i className="dot resolved" /> Løst</span>
                <span className="spacer" />
                <span className="mono">AI deflektert {A.aiDeflectedPct}%</span>
              </div>
            </div>
          </Ko.Panel>

          {/* recurring topics */}
          <Ko.Panel icon="layers" title="Gjentakende behov" sub={`Hyppigste: ${A.topTopic}`}>
            <div className="ko-reclist">
              {A.recurring.map((r) => {
                const area = SD.SK_AREAS[r.area] || {};
                const max = A.recurring[0].count;
                return (
                  <div key={r.topic} className="ko-recrow">
                    <span className="ar" style={{ "--ar": area.color }}><Ic n={area.icon} s={13} /></span>
                    <div className="m">
                      <div className="t">{r.topic}</div>
                      <div className="bar"><span style={{ width: `${(r.count / max) * 100}%`, background: area.color }} /></div>
                    </div>
                    <span className="cnt mono">{r.count}</span>
                    <span className={`trend ${r.trend}`}><Ic n={r.trend === "up" ? "trendUp" : r.trend === "down" ? "trendUp" : "arrowRight"} s={13} style={r.trend === "down" ? { transform: "scaleY(-1)" } : null} /></span>
                  </div>
                );
              })}
            </div>
          </Ko.Panel>
        </div>

        <div className="so-grid-2">
          {/* owner workload */}
          <Ko.Panel icon="users" title="Arbeidsbelastning per ansvarlig">
            <div className="ko-wl">
              {A.workload.map((w) => { const p = Ko.person(w.owner); const max = Math.max(...A.workload.map((x) => x.open)); return (
                <div key={w.owner} className="ko-wlrow">
                  <Ko.Av id={w.owner} size={30} />
                  <div className="m">
                    <div className="h"><span className="nm">{p.name}{w.owner === SD.SK_ME ? " (deg)" : ""}</span><span className="role">{p.role}</span></div>
                    <div className="bar"><span style={{ width: `${(w.open / max) * 100}%` }} /></div>
                  </div>
                  <div className="stats"><span className="mono big">{w.open}</span><span className="sub">åpne · {w.resolvedWk} løst · {w.avgFirstMin} min</span></div>
                </div>
              ); })}
            </div>
          </Ko.Panel>

          {/* channel health */}
          <Ko.Panel icon="lifebuoy" title="Skranke-helse">
            <div className="ko-health">
              {A.health.map((h) => { const d = SD.DESK_BY_ID[h.desk] || {}; return (
                <div key={h.desk} className="ko-healthrow">
                  <span className="nm"><span className="hash" style={{ color: d.color }}>#</span>{d.slug}</span>
                  <div className="bar"><span data-state={h.state} style={{ width: `${h.score}%` }} /></div>
                  <span className="sc mono">{h.score}</span>
                  <Ko.Badge tone={h.state === "ok" ? "success" : h.state === "watch" ? "warning" : "error"} dot>{h.state === "ok" ? "God" : h.state === "watch" ? "Følg med" : "Risiko"}</Ko.Badge>
                </div>
              ); })}
            </div>
          </Ko.Panel>
        </div>
      </div>
    );
  }

  // ============================================================
  // INNSTILLINGER — helpdesk setup (which channels are desks)
  // ============================================================
  function KoSkrankeSetup({ desks, onEdit, onNew, onUpgrade }) {
    return (
      <div className="ko-stack">
        <div className="ko-setup-intro">
          <div className="g">
            <div className="t">Skranker</div>
            <div className="s">Gjør en kanal om til en skranke for å spore spørsmål som saker med ansvarlig, frist og AI-hjelp. Vanlige kanaler forblir åpne forum.</div>
          </div>
          <button className="ko-btn primary" onClick={onNew}><Ic n="plus" s={15} /> Ny skranke</button>
        </div>

        <Ko.Panel icon="lifebuoy" iconTone="warn" title="Skranke-kanaler" cnt={desks.length}>
          <div className="ko-setuplist">
            {desks.map((d) => {
              const pre = SD.SKRANKE_PRESETS[d.preset] || {};
              const ai = SD.SK_AI_MODES[d.ai] || {};
              return (
                <div key={d.id} className="ko-setuprow" style={{ "--ch": d.color }}>
                  <span className="ic"><Ic n={pre.icon || "lifebuoy"} s={16} /></span>
                  <div className="m">
                    <div className="h"><span className="nm">#{d.slug}</span>
                      <Ko.Badge tone={d.preset === "private" ? "purple" : "orange"} ic={d.preset === "private" ? "lock" : "globe"}>{d.preset === "private" ? "Privat" : "Offentlig"}</Ko.Badge>
                      {!d.enabled && <Ko.Badge tone="muted">Av</Ko.Badge>}
                    </div>
                    <div className="sub">{d.name} · {d.categories.length} kategorier · SLA {d.sla.first} min / {d.sla.resolve} t</div>
                  </div>
                  <div className="ow">{d.owners.map((id) => <Ko.Av key={id} id={id} size={24} />)}</div>
                  <span className="ai"><Ic n="bot" s={13} /> {ai.label}</span>
                  <button className="ko-btn sm" onClick={() => onEdit(d)}><Ic n="sliders" s={14} /> Konfigurer</button>
                </div>
              );
            })}
          </div>
        </Ko.Panel>

        <Ko.Panel icon="hash" title="Vanlige kanaler" sub="Kan oppgraderes til skranke" cnt={SD.NORMAL_CHANNELS.length}>
          <div className="ko-setuplist">
            {SD.NORMAL_CHANNELS.map((n) => (
              <div key={n.id} className="ko-setuprow normal">
                <span className="ic plain"><Ic n="hash" s={16} /></span>
                <div className="m"><div className="h"><span className="nm">#{n.slug}</span><span className="forum">Forum</span></div><div className="sub">{n.name} · {n.members} medlemmer</div></div>
                <span className="spacer" />
                <button className="ko-btn sm" onClick={() => onUpgrade(n)}><Ic n="lifebuoy" s={14} /> Gjør til skranke</button>
              </div>
            ))}
          </div>
        </Ko.Panel>
      </div>
    );
  }

  // ============================================================
  // DESK MODAL — enable / configure a skranke
  // ============================================================
  function KoDeskModal({ open, mode, initial, onClose, onSubmit }) {
    const [preset, setPreset] = useState("public");
    const [owners, setOwners] = useState(["ma"]);
    const [cats, setCats] = useState([]);
    const [ai, setAi] = useState("mention");
    const [slaFirst, setSlaFirst] = useState(30);
    const [slaResolve, setSlaResolve] = useState(8);
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");

    useEffect(() => {
      if (!open) return;
      if (initial) {
        setPreset(initial.preset || "public"); setOwners(initial.owners || ["ma"]); setCats(initial.categories || []);
        setAi(initial.ai || "mention"); setSlaFirst(initial.sla ? initial.sla.first : 30); setSlaResolve(initial.sla ? initial.sla.resolve : 8);
        setName(initial.name || ""); setSlug(initial.slug || "");
      } else {
        setPreset("public"); setOwners(["ma"]); setCats([]); setAi("mention"); setSlaFirst(30); setSlaResolve(8);
        setName(""); setSlug("");
      }
      const h = (e) => { if (e.key === "Escape") onClose(); };
      window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
    }, [open, initial && initial.id]);

    if (!open) return null;
    const isDesk = preset !== "none";
    const allCats = Object.values(SD.SK_CATEGORIES);
    const toggleOwner = (id) => setOwners((o) => o.includes(id) ? o.filter((x) => x !== id) : [...o, id]);
    const toggleCat = (id) => setCats((c) => c.includes(id) ? c.filter((x) => x !== id) : [...c, id]);
    const valid = isDesk && owners.length > 0 && name.trim() && slug.trim();

    const save = () => onSubmit({ id: initial && initial.id, name: name.trim(), slug: slug.trim().replace(/^#/, ""), preset, owners, categories: cats, ai, sla: { first: Number(slaFirst), resolve: Number(slaResolve) }, enabled: isDesk });

    return (
      <div className="ko-scrim" onMouseDown={onClose}>
        <div className="ko-modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
          <div className="ko-modal-head">
            <div className="hg">
              <div className="eyebrow">{mode === "edit" ? "Konfigurer skranke" : "Ny skranke"}</div>
              <div className="t">Gjør kanalen til en skranke</div>
            </div>
            <button className="ko-iconbtn" onClick={onClose} aria-label="Lukk"><Ic n="x" s={18} /></button>
          </div>

          <div className="ko-modal-body">
            {/* name + slug */}
            <div className="so-grid-2" style={{ gap: 12 }}>
              <div className="ko-field"><label className="ko-lbl">Navn</label><input className="ko-input" placeholder="HR og personal" value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="ko-field"><label className="ko-lbl">Kanal-slug</label>
                <div className="ko-slugwrap"><span className="hash">#</span><input className="ko-input slug" placeholder="personal" value={slug} onChange={(e) => setSlug(e.target.value)} /></div>
              </div>
            </div>

            {/* preset grid */}
            <div className="ko-field">
              <label className="ko-lbl">Type skranke</label>
              <div className="ko-preset-grid">
                {Object.values(SD.SKRANKE_PRESETS).map((p) => (
                  <button key={p.id} className="ko-preset" data-on={preset === p.id} onClick={() => setPreset(p.id)}>
                    <span className="rad" />
                    <div className="g">
                      <div className="h">{p.icon && <Ic n={p.icon} s={15} />}<span className="n">{p.label}</span></div>
                      <div className="s">{p.lede}</div>
                      {preset === p.id && p.consequence && <div className="cons">→ {p.consequence}</div>}
                      {preset === p.id && p.warn && <div className="warn">Avanserte innstillinger. Anbefaler et forhåndsvalg.</div>}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {isDesk && (
              <>
                {/* owners */}
                <div className="ko-field">
                  <div className="ko-lblrow"><label className="ko-lbl">Ansvarlige</label><span className="hint">Påkrevd</span></div>
                  <div className="ko-chselect">
                    {["ma", "es", "jh", "sl"].map((id) => { const p = Ko.person(id); return (
                      <button key={id} className="ko-chopt" data-on={owners.includes(id)} style={{ "--ch": p.color }} onClick={() => toggleOwner(id)}>
                        <Ko.Av id={id} size={18} /> {p.name}{owners.includes(id) && <Ic n="check" s={13} />}
                      </button>
                    ); })}
                  </div>
                </div>

                {/* categories */}
                <div className="ko-field">
                  <label className="ko-lbl">Kategorier</label>
                  <div className="ko-chselect">
                    {allCats.map((c) => (
                      <button key={c.id} className="ko-chopt" data-on={cats.includes(c.id)} onClick={() => toggleCat(c.id)}>
                        {c.label}{cats.includes(c.id) && <Ic n="check" s={13} />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* SLA */}
                <div className="ko-field">
                  <label className="ko-lbl">Frister (SLA)</label>
                  <div className="ko-slagrid">
                    <div className="ko-slacell"><span className="k">Førstesvar</span><div className="inp"><input className="ko-input" type="number" min="5" value={slaFirst} onChange={(e) => setSlaFirst(e.target.value)} /><span className="u">min</span></div></div>
                    <div className="ko-slacell"><span className="k">Løsetid</span><div className="inp"><input className="ko-input" type="number" min="1" value={slaResolve} onChange={(e) => setSlaResolve(e.target.value)} /><span className="u">timer</span></div></div>
                  </div>
                </div>

                {/* AI policy */}
                <div className="ko-field">
                  <label className="ko-lbl">Botsson-policy</label>
                  <div className="ko-optgrid">
                    {Object.values(SD.SK_AI_MODES).map((m) => (
                      <button key={m.id} className="ko-opt" data-on={ai === m.id} onClick={() => setAi(m.id)}>
                        <Ic n={m.id === "off" ? "bellOff" : m.id === "mention" ? "bot" : "sparkle"} s={16} />
                        <div className="g"><div className="n">{m.label}</div><div className="s">{m.desc}</div></div>
                        <span className="ko-radio" data-on={ai === m.id} />
                      </button>
                    ))}
                  </div>
                  <div className="ko-aud-note" style={{ padding: "8px 0 0" }}><Ic n="shield" s={14} /> Botsson lukker aldri saker eller tildeler sensitive saker uten at en ansvarlig bekrefter.</div>
                </div>
              </>
            )}

            {!isDesk && (
              <div className="ko-dr-callout muted"><Ic n="hash" s={16} /><div><strong>Vanlig kanal</strong><span>Ingen saker opprettes. Kanalen forblir et åpent forum.</span></div></div>
            )}
          </div>

          <div className="ko-modal-foot">
            <span className="ko-scopetag">{isDesk ? `${preset === "private" ? "Privat" : "Offentlig"} skranke · ${owners.length} ansvarlig${owners.length === 1 ? "" : "e"}` : "Skranke av"}</span>
            <span className="spacer" />
            <button className="ko-btn" onClick={onClose}>Avbryt</button>
            <button className="ko-btn primary" disabled={!valid && isDesk} onClick={save}>{mode === "edit" ? "Lagre" : "Opprett skranke"}</button>
          </div>
        </div>
      </div>
    );
  }

  window.KoSkrankeAnalyse = KoSkrankeAnalyse;
  window.KoSkrankeSetup = KoSkrankeSetup;
  window.KoDeskModal = KoDeskModal;
})();
