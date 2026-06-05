// ===== Kommunikasjon — compose/edit announcement + channel modals =====
// Exposes window.KoCompose (announcement create/edit with audience targeting,
// validation, draft/schedule/publish) and window.KoChannelModal (create/edit channel).
(function () {
  const { useState, useMemo, useEffect, useRef } = React;
  const Ko = window.Ko, Ic = window.Ic, SD = window.SmartoutData;

  // ============================================================
  // AUDIENCE PICKER — drilldown per facet (Avdeling/Lag/Område/Tilgangsnivå)
  // ============================================================
  function AudiencePicker({ aud, setAud }) {
    const kinds = SD.AUDIENCE_KINDS;
    const set = (kind) => setAud({ kind, depts: [], teams: [], locations: [], accessIds: [] });
    const toggle = (facet, id) => setAud((a) => {
      const arr = a[facet] || [];
      return { ...a, [facet]: arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id] };
    });
    const Tile = ({ on, color, name, sub, onClick }) => (
      <button type="button" className="ko-aud-tile" data-on={on} onClick={onClick}>
        {color ? <span className="dot" style={{ background: color }} /> : <Ic n="shield" s={15} c="var(--muted)" />}
        <span className="g"><span className="n">{name}</span>{sub && <span className="s">{sub}</span>}</span>
        <span className="chk">{on && <Ic n="check" s={14} sw={3} />}</span>
      </button>
    );
    return (
      <div className="ko-aud-picker">
        <div className="ko-aud-tabs" role="tablist">
          {Object.values(kinds).map((k) => (
            <button key={k.id} type="button" role="tab" aria-selected={aud.kind === k.id} data-on={aud.kind === k.id} onClick={() => set(k.id)}>
              <Ic n={k.icon} s={14} />{k.label}
            </button>
          ))}
        </div>
        {aud.kind === "department" && (
          <div className="ko-aud-grid">
            {Object.values(SD.KO_DEPARTMENTS).filter((d) => d.id !== "admin").map((d) => {
              const cnt = SD.KO_ACTIVE.filter((p) => (p.depts || [p.dept]).includes(d.id)).length;
              return <Tile key={d.id} on={(aud.depts || []).includes(d.id)} color={d.color} name={d.name} sub={`${cnt} ansatte`} onClick={() => toggle("depts", d.id)} />;
            })}
          </div>
        )}
        {aud.kind === "team" && (
          <div className="ko-aud-grid">
            {Object.values(SD.KO_TEAMS).map((t) => {
              const cnt = SD.KO_ACTIVE.filter((p) => p.team === t.id).length;
              return <Tile key={t.id} on={(aud.teams || []).includes(t.id)} color={(SD.KO_DEPARTMENTS[t.dept] || {}).color} name={t.name} sub={`${cnt} medlemmer`} onClick={() => toggle("teams", t.id)} />;
            })}
          </div>
        )}
        {aud.kind === "location" && (
          <div className="ko-aud-grid">
            {Object.values(SD.KO_LOCATIONS).map((l) => {
              const cnt = SD.KO_ACTIVE.filter((p) => (p.locations || []).includes(l.id)).length;
              return <Tile key={l.id} on={(aud.locations || []).includes(l.id)} name={l.name} sub={`${cnt} ansatte`} onClick={() => toggle("locations", l.id)} />;
            })}
          </div>
        )}
        {aud.kind === "access" && (
          <div className="ko-aud-grid">
            {Object.values(SD.KO_ACCESS).map((a) => {
              const cnt = SD.KO_ACTIVE.filter((p) => p.access === a.id).length;
              return <Tile key={a.id} on={(aud.accessIds || []).includes(a.id)} name={a.label} sub={`${cnt} ansatte`} onClick={() => toggle("accessIds", a.id)} />;
            })}
          </div>
        )}
        {(aud.kind === "all" || aud.kind === "on_duty") && (
          <div className="ko-aud-note"><Ic n="info" s={14} /><span>{aud.kind === "all" ? "Alle aktive ansatte mottar denne." : "Kun de som er på vakt i dag mottar denne ved publisering."}</span></div>
        )}
      </div>
    );
  }

  // ============================================================
  // COMPOSE / EDIT ANNOUNCEMENT
  // ============================================================
  function KoCompose({ open, mode = "create", initial, channels = [], onClose, onSubmit }) {
    const editing = mode === "edit";
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [channelId, setChannelId] = useState("c-kunngjoring");
    const [aud, setAud] = useState({ kind: "all", depts: [], teams: [], locations: [], accessIds: [] });
    const [priority, setPriority] = useState("operational");
    const [scheduled, setScheduled] = useState(false);
    const [when, setWhen] = useState("");
    const [pinned, setPinned] = useState(false);
    const [bump, setBump] = useState(false);
    const lastN = useRef(0);

    // hydrate on open
    useEffect(() => {
      if (!open) return;
      if (editing && initial) {
        setTitle(initial.title || ""); setBody(initial.body || "");
        setChannelId(initial.channel || "c-kunngjoring");
        setAud({ kind: "all", depts: [], teams: [], locations: [], accessIds: [], ...(initial.audience || {}) });
        setPriority(initial.priority || "normal");
        setScheduled(initial.status === "scheduled"); setWhen(initial.scheduledFor || "");
        setPinned(!!initial.pinned);
      } else {
        setTitle(""); setBody(""); setChannelId(initial && initial.channel ? initial.channel : "c-kunngjoring");
        setAud({ kind: "all", depts: [], teams: [], locations: [], accessIds: [] });
        setPriority("operational"); setScheduled(false); setWhen(""); setPinned(false);
      }
    }, [open]);

    useEffect(() => {
      if (!open) return;
      const h = (e) => { if (e.key === "Escape") onClose(); };
      window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
    }, [open]);

    const recipients = useMemo(() => SD.resolveAudience(aud), [aud]);
    const count = recipients.length;
    useEffect(() => {
      if (lastN.current !== count) { lastN.current = count; setBump(true); const t = setTimeout(() => setBump(false), 400); return () => clearTimeout(t); }
    }, [count]);

    // validation
    const facet = (SD.AUDIENCE_KINDS[aud.kind] || {}).facet;
    const facetEmpty = facet && (!(aud[facet] || []).length);
    const errs = [];
    if (!title.trim()) errs.push("Tittel mangler");
    if (!body.trim()) errs.push("Meldingstekst mangler");
    if (facetEmpty) errs.push("Velg minst én i målgruppen");
    if (count === 0 && !facetEmpty) errs.push("Ingen mottakere i valgt målgruppe");
    if (scheduled && !when.trim()) errs.push("Velg tidspunkt for planlagt utsending");
    const valid = errs.length === 0;

    function build(status) {
      return {
        ...(editing && initial ? initial : {}),
        title: title.trim(), body: body.trim(), channel: channelId,
        audience: { kind: aud.kind, depts: aud.depts, teams: aud.teams, locations: aud.locations, accessIds: aud.accessIds },
        priority, pinned, status,
        scheduledFor: status === "scheduled" ? when.trim() : undefined,
      };
    }

    if (!open) return null;
    const ch = SD.CHANNEL_BY_ID[channelId] || {};
    return (
      <div className="ko-scrim" onMouseDown={(e) => { if (e.target.classList.contains("ko-scrim")) onClose(); }}>
        <div className="ko-modal" role="dialog" aria-modal="true">
          <div className="ko-modal-head">
            <div className="hg">
              <div className="eyebrow">{editing ? "Rediger kunngjøring" : "Ny kunngjøring"}</div>
              <div className="t">{editing ? "Oppdater og republiser" : "Hva må teamet vite?"}</div>
            </div>
            <button className="ko-iconbtn" onClick={onClose} aria-label="Lukk"><Ic n="x" s={18} /></button>
          </div>

          <div className="ko-modal-body">
            {/* channel */}
            <div className="ko-field">
              <label className="ko-lbl">Kanal</label>
              <div className="ko-chselect">
                {channels.filter((c) => !c.archived).map((c) => (
                  <button key={c.id} type="button" className="ko-chopt" data-on={channelId === c.id} style={{ "--ch": c.color }} onClick={() => setChannelId(c.id)}>
                    <Ic n="hash" s={13} /><span>{c.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* title */}
            <div className="ko-field">
              <label className="ko-lbl">Tittel</label>
              <input className="ko-input" placeholder="Kort og tydelig — én setning" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            </div>

            {/* body */}
            <div className="ko-field">
              <label className="ko-lbl">Melding</label>
              <textarea className="ko-textarea" placeholder="Hva, når, hvem berører det?" value={body} onChange={(e) => setBody(e.target.value)} maxLength={800} />
              <div className="ko-fieldfoot"><span>Markdown støttes ikke ennå</span><span className="mono">{body.length} / 800</span></div>
            </div>

            {/* audience */}
            <div className="ko-field">
              <div className="ko-lblrow"><label className="ko-lbl">Målgruppe</label><span className="hint">Bestemmer hvem som ser kunngjøringen</span></div>
              <AudiencePicker aud={aud} setAud={setAud} />
              <div className="ko-countrow">
                <span className={`ko-countpill ${count === 0 ? "muted" : ""}`} data-bump={bump} aria-live="polite">
                  <Ic n="users" s={15} /><span className="n">{count}</span><span className="l">{count === 1 ? "ansatt mottar" : "ansatte mottar"}</span>
                </span>
                <span className="ko-audsummary mono">{SD.audienceLabel(aud)}</span>
              </div>
            </div>

            {/* options */}
            <div className="ko-optgrid">
              <button type="button" className="ko-opt" data-on={priority === "operational"} onClick={() => setPriority(priority === "operational" ? "normal" : "operational")}>
                <Ic n="bell" s={15} />
                <span className="g"><span className="n">Operasjonell push</span><span className="s">Passerer stille timer (priority=1)</span></span>
                <span className="sw" />
              </button>
              <button type="button" className="ko-opt" data-on={pinned} onClick={() => setPinned(!pinned)}>
                <Ic n="pin" s={15} />
                <span className="g"><span className="n">Fest øverst</span><span className="s">Vises i festet-stripen for alle</span></span>
                <span className="sw" />
              </button>
              <button type="button" className="ko-opt" data-on={scheduled} onClick={() => setScheduled(!scheduled)}>
                <Ic n="clock" s={15} />
                <span className="g"><span className="n">Planlegg utsending</span><span className="s">Publiser automatisk senere</span></span>
                <span className="sw" />
              </button>
              {scheduled && (
                <input className="ko-input" placeholder="f.eks. 1. juni 2026 · 08:00" value={when} onChange={(e) => setWhen(e.target.value)} />
              )}
            </div>

            {/* validation summary */}
            {!valid && (
              <div className="ko-valid">
                <Ic n="alert" s={14} />
                <span>{errs.join(" · ")}</span>
              </div>
            )}
          </div>

          <div className="ko-modal-foot">
            <button className="ko-btn" onClick={() => onSubmit(build("draft"), "draft")} disabled={!title.trim()}>Lagre utkast</button>
            <span className="spacer" />
            <span className="ko-scopetag mono">visibility_scope: {aud.kind === "all" ? "all_members" : "targeted_members"}</span>
            {scheduled ? (
              <button className="ko-btn primary" disabled={!valid} onClick={() => onSubmit(build("scheduled"), "scheduled")}><Ic n="clock" s={15} /> Planlegg</button>
            ) : (
              <button className="ko-btn primary" disabled={!valid} onClick={() => onSubmit(build("published"), "published")}><Ic n="send" s={15} /> {editing ? "Republiser" : "Publiser"}</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // CHANNEL CREATE / EDIT
  // ============================================================
  function KoChannelModal({ open, mode = "create", initial, onClose, onSubmit }) {
    const editing = mode === "edit";
    const [name, setName] = useState("");
    const [kind, setKind] = useState("tema");
    const [desc, setDesc] = useState("");
    const [deptId, setDeptId] = useState("kjokken");

    useEffect(() => {
      if (!open) return;
      if (editing && initial) { setName(initial.name || ""); setKind(initial.kind || "tema"); setDesc(initial.desc || ""); setDeptId(initial.dept || "kjokken"); }
      else { setName(""); setKind("tema"); setDesc(""); setDeptId("kjokken"); }
    }, [open]);
    useEffect(() => {
      if (!open) return;
      const h = (e) => { if (e.key === "Escape") onClose(); };
      window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
    }, [open]);

    const slug = name.trim().toLowerCase().replace(/[^a-z0-9æøå]+/g, "-").replace(/^-|-$/g, "");
    const valid = slug.length >= 2;
    if (!open) return null;
    const km = SD.CHANNEL_KINDS[kind];
    return (
      <div className="ko-scrim" onMouseDown={(e) => { if (e.target.classList.contains("ko-scrim")) onClose(); }}>
        <div className="ko-modal sm" role="dialog" aria-modal="true">
          <div className="ko-modal-head">
            <div className="hg"><div className="eyebrow">{editing ? "Rediger kanal" : "Ny kanal"}</div><div className="t">{editing ? "Oppdater kanalen" : "Opprett en kanal"}</div></div>
            <button className="ko-iconbtn" onClick={onClose} aria-label="Lukk"><Ic n="x" s={18} /></button>
          </div>
          <div className="ko-modal-body">
            <div className="ko-field">
              <label className="ko-lbl">Navn</label>
              <div className="ko-slugwrap"><span className="hash">#</span><input className="ko-input slug" placeholder="kanalnavn" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
              {slug && <div className="ko-fieldfoot"><span className="mono">#{slug}</span></div>}
            </div>
            <div className="ko-field">
              <label className="ko-lbl">Type</label>
              <div className="ko-kindgrid">
                {Object.values(SD.CHANNEL_KINDS).map((k) => (
                  <button key={k.id} type="button" className="ko-kindopt" data-on={kind === k.id} onClick={() => setKind(k.id)}>
                    <span className="ic"><Ic n={k.icon} s={16} /></span>
                    <span className="g"><span className="n">{k.label}</span><span className="s">{k.desc}</span></span>
                    <span className="chk">{kind === k.id && <Ic n="check" s={14} sw={3} />}</span>
                  </button>
                ))}
              </div>
            </div>
            {kind === "avdeling" && (
              <div className="ko-field">
                <label className="ko-lbl">Avdeling</label>
                <div className="ko-chselect">
                  {Object.values(SD.KO_DEPARTMENTS).filter((d) => d.id !== "admin").map((d) => (
                    <button key={d.id} type="button" className="ko-chopt" data-on={deptId === d.id} style={{ "--ch": d.color }} onClick={() => setDeptId(d.id)}>
                      <span className="dot" style={{ background: d.color, width: 8, height: 8, borderRadius: 9, display: "inline-block" }} /><span>{d.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="ko-field">
              <label className="ko-lbl">Beskrivelse</label>
              <textarea className="ko-textarea sm" placeholder="Hva er denne kanalen til?" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={160} />
            </div>
            <div className="ko-aud-note"><Ic n={km.icon} s={14} /><span>{km.post === "managers" ? "Kun ledere kan publisere i denne kanalen." : "Alle medlemmer kan poste i denne kanalen."}</span></div>
          </div>
          <div className="ko-modal-foot">
            <button className="ko-btn" onClick={onClose}>Avbryt</button>
            <span className="spacer" />
            <button className="ko-btn primary" disabled={!valid} onClick={() => onSubmit({ ...(editing && initial ? initial : {}), name: slug, kind, desc: desc.trim(), dept: kind === "avdeling" ? deptId : null })}>
              <Ic n={editing ? "check" : "plus"} s={15} /> {editing ? "Lagre" : "Opprett kanal"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  window.KoCompose = KoCompose;
  window.KoChannelModal = KoChannelModal;
})();
