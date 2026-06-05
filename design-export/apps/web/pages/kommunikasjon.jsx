// ===== Kommunikasjon — broadcast / channels command center (page) =====
// Registers window.SO_PAGES.kommunikasjon. Depends on kommunikasjon-data.js,
// kommunikasjon-shared.jsx (window.Ko), kommunikasjon-compose.jsx (KoCompose,
// KoChannelModal) and kommunikasjon-detail.jsx (KoDetail).
// Admin-gated by the shell route guard. Manager = full control; channel-level
// posting permission is enforced in the compose flow.
(function () {
  const { useState, useEffect, useMemo } = React;
  const Ko = window.Ko, Ic = window.Ic, SD = window.SmartoutData;
  const ME = "ma"; // current manager (Maria A.) — reached only in admin mode

  function KommunikasjonPage() {
    const toast = window.useToast();
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState("oversikt");          // oversikt | kunngjoringer | kanaler | skranke
    const [anns, setAnns] = useState(() => SD.ANNOUNCEMENTS.map((a) => ({ ...a })));
    const [channels, setChannels] = useState(() => SD.CHANNELS.map((c) => ({ ...c })));

    // list controls
    const [query, setQuery] = useState("");
    const [statusF, setStatusF] = useState("all");
    const [channelF, setChannelF] = useState("all");
    const [sort, setSort] = useState("ny");

    // overlays
    const [detailId, setDetailId] = useState(null);
    const [compose, setCompose] = useState(null);        // { mode, initial }
    const [chModal, setChModal] = useState(null);        // { mode, initial }
    const [confirm, setConfirm] = useState(null);        // { kind, target }
    const [assistDone, setAssistDone] = useState(false);

    useEffect(() => { const t = setTimeout(() => setLoading(false), 480); return () => clearTimeout(t); }, []);

    // global «Skap → Kunngjøring» opens the standard compose flow
    useEffect(() => {
      if (window.__pendingCreate === "kunngjoring") { window.__pendingCreate = null; setTab("kunngjoringer"); setCompose({ mode: "create" }); }
    }, []);

    // ---- register Botsson context ----
    useEffect(() => {
      window.SmartoutContext = {
        route: "kommunikasjon", view: tab,
        describe: () => tab === "skranke"
          ? `Kommunikasjon · Skranke (helpdesk). ${(SD.CASES || []).filter((c) => (SD.SK_OPEN_STATES || []).includes(c.status)).length} åpne saker fordelt på ${(SD.DESKS || []).length} skranker.`
          : `Kommunikasjon · ${tab}. ${anns.filter((a) => a.status === "published").length} publiserte kunngjøringer, ${channels.filter((c) => !c.archived).length} aktive kanaler.`,
      };
      return () => { if (window.SmartoutContext && window.SmartoutContext.route === "kommunikasjon") window.SmartoutContext = null; };
    }, [tab, anns, channels]);

    const annById = (id) => anns.find((a) => a.id === id);
    const detail = detailId ? annById(detailId) : null;

    // ---- derived KPIs ----
    const kpis = useMemo(() => {
      const pub = anns.filter((a) => a.status === "published");
      const totRead = pub.reduce((s, a) => s + a.readCount, 0);
      const totTarget = pub.reduce((s, a) => s + a.targetCount, 0);
      return {
        published: pub.length,
        readPct: totTarget ? Math.round((totRead / totTarget) * 100) : 0,
        scheduled: anns.filter((a) => a.status === "scheduled").length,
        drafts: anns.filter((a) => a.status === "draft").length,
        channels: channels.filter((c) => !c.archived).length,
      };
    }, [anns, channels]);

    // ---- Botsson insight: a published, operational note with unread recipients ----
    const assist = useMemo(() => {
      const cand = anns.filter((a) => a.status === "published" && a.targetCount > a.readCount)
        .sort((a, b) => (b.targetCount - b.readCount) - (a.targetCount - a.readCount))[0];
      if (!cand) return null;
      return { ann: cand, missing: cand.targetCount - cand.readCount };
    }, [anns]);

    // ---- list filter/sort ----
    const list = useMemo(() => {
      let l = anns.slice();
      if (statusF !== "all") l = l.filter((a) => a.status === statusF);
      if (channelF !== "all") l = l.filter((a) => a.channel === channelF);
      const q = query.trim().toLowerCase();
      if (q) l = l.filter((a) => a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q));
      if (sort === "lest") l.sort((a, b) => Ko.readPct(b) - Ko.readPct(a));
      else if (sort === "mottakere") l.sort((a, b) => b.targetCount - a.targetCount);
      else l.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)); // pinned first for "ny"
      return l;
    }, [anns, statusF, channelF, query, sort]);

    const pinned = anns.filter((a) => a.pinned && a.status === "published");

    // ================= actions =================
    function upsertAnn(payload, status) {
      const isEdit = !!payload.id;
      if (isEdit) {
        setAnns((prev) => prev.map((a) => a.id === payload.id ? finalize({ ...a, ...payload, status,
          edits: [...(a.edits || []), { at: "nettopp", by: ME, summary: status === "draft" ? "Lagret utkast" : status === "scheduled" ? "Oppdatert · planlagt" : "Redigert og republisert" }] }) : a));
        toast(status === "draft" ? "Utkast lagret" : status === "scheduled" ? "Endring planlagt" : "Republisert");
      } else {
        const id = "a-" + Math.random().toString(36).slice(2, 7);
        const created = finalize({
          id, channel: payload.channel, author: ME, title: payload.title, body: payload.body,
          status, priority: payload.priority, pinned: !!payload.pinned, audience: payload.audience,
          createdAt: status === "scheduled" ? `planlagt · ${payload.scheduledFor}` : status === "draft" ? "utkast · nettopp" : "nettopp",
          scheduledFor: payload.scheduledFor, reads: [], comments: [], attachments: [],
          edits: [{ at: "nettopp", by: ME, summary: status === "draft" ? "Utkast opprettet" : status === "scheduled" ? "Opprettet som planlagt utsending" : "Opprettet og publisert" }],
        });
        setAnns((prev) => [created, ...prev]);
        const label = status === "draft" ? "Utkast lagret" : status === "scheduled" ? `Planlagt — ${created.targetCount} mottakere` : `Publisert — ${created.targetCount} mottakere varslet`;
        toast(label, { undo: () => setAnns((prev) => prev.filter((a) => a.id !== id)) });
      }
      setCompose(null);
    }
    function finalize(a) {
      a.targetIds = SD.resolveAudience(a.audience);
      a.targetCount = a.targetIds.length;
      a.readCount = (a.reads || []).length;
      a.audienceLabel = SD.audienceLabel(a.audience);
      return a;
    }
    function togglePin(ann) {
      setAnns((prev) => prev.map((a) => a.id === ann.id ? { ...a, pinned: !a.pinned } : a));
      toast(ann.pinned ? "Løsnet" : "Festet øverst", { undo: () => setAnns((prev) => prev.map((a) => a.id === ann.id ? { ...a, pinned: ann.pinned } : a)) });
    }
    function archiveAnn(ann) {
      setAnns((prev) => prev.map((a) => a.id === ann.id ? { ...a, status: "archived", pinned: false, edits: [...(a.edits || []), { at: "nettopp", by: ME, summary: "Arkivert" }] } : a));
      setDetailId(null);
      toast("Arkivert", { undo: () => setAnns((prev) => prev.map((a) => a.id === ann.id ? { ...a, status: ann.status, pinned: ann.pinned } : a)) });
    }
    function republishAnn(ann) {
      setAnns((prev) => prev.map((a) => a.id === ann.id ? { ...a, status: "published", edits: [...(a.edits || []), { at: "nettopp", by: ME, summary: "Gjenopprettet til feed" }] } : a));
      toast("Gjenopprettet");
    }
    function remind(ann) {
      const missing = ann.targetCount - ann.readCount;
      toast(`Påminnelse sendt til ${missing} ${missing === 1 ? "ansatt" : "ansatte"}`, { undo: () => {} });
    }
    function addComment(annId, body) {
      setAnns((prev) => prev.map((a) => a.id === annId ? { ...a, comments: [...(a.comments || []), { id: "cm" + Math.random().toString(36).slice(2, 6), by: ME, at: "nettopp", body }] } : a));
    }
    // channels
    function upsertChannel(payload) {
      if (payload.id) {
        setChannels((prev) => prev.map((c) => c.id === payload.id ? { ...c, ...payload } : c));
        toast("Kanal oppdatert");
      } else {
        const id = "c-" + Math.random().toString(36).slice(2, 7);
        const c = { id, name: payload.name, kind: payload.kind, desc: payload.desc, dept: payload.dept,
          color: payload.kind === "avdeling" && payload.dept ? (SD.KO_DEPARTMENTS[payload.dept] || {}).color : "#c18200",
          members: payload.kind === "avdeling" && payload.dept ? SD.KO_ACTIVE.filter((p) => (p.depts || [p.dept]).includes(payload.dept)).length : SD.KO_TOTAL,
          managers: [ME], notify: "normal", archived: false, lastAt: "nettopp" };
        setChannels((prev) => [...prev, c]);
        toast(`Kanal #${c.name} opprettet`, { undo: () => setChannels((prev) => prev.filter((x) => x.id !== id)) });
      }
      setChModal(null);
    }
    function toggleArchiveChannel(c) {
      setChannels((prev) => prev.map((x) => x.id === c.id ? { ...x, archived: !x.archived } : x));
      toast(c.archived ? `#${c.name} gjenåpnet` : `#${c.name} arkivert`, { undo: () => setChannels((prev) => prev.map((x) => x.id === c.id ? { ...x, archived: c.archived } : x)) });
    }

    function openChannel(c) { setChannelF(c.id); setTab("kunngjoringer"); }

    // ================= render =================
    return (
      <main className="sk-main">
        <div className="sk-wrap" style={{ maxWidth: 1180 }}>
          {/* header */}
          <div className="ko-head">
            <div>
              <div className="sk-eyebrow">Team · Bistro Nord</div>
              <h1 className="ko-h1">Kommunikasjon</h1>
              <div className="ko-sub">Kunngjøringer og kanaler. Festet vises øverst for alle — målrettede sendinger når kun mottakerne.</div>
            </div>
            <div className="ko-head-actions">
              {tab === "kanaler"
                ? <button className="ko-btn primary" onClick={() => setChModal({ mode: "create" })}><Ic n="plus" s={16} /> Ny kanal</button>
                : tab === "skranke"
                ? null
                : <button className="ko-btn primary" onClick={() => setCompose({ mode: "create" })}><Ic n="megaphone" s={16} /> Ny kunngjøring</button>}
            </div>
          </div>

          {/* tabs */}
          <div className="ko-tabs">
            {[["oversikt", "Oversikt", "gauge"], ["kunngjoringer", "Kunngjøringer", "megaphone"], ["kanaler", "Kanaler", "hash"], ["skranke", "Skranke", "lifebuoy"]].map(([k, l, ic]) => (
              <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}><Ic n={ic} s={15} /> {l}</button>
            ))}
          </div>

          {loading ? (
            <div className="ko-stack">
              <div className="ko-pulserow">{[0, 1, 2, 3, 4].map((i) => <Ko.Skel key={i} h={78} />)}</div>
              <Ko.Skel h={120} /><Ko.Skel h={300} />
            </div>
          ) : tab === "oversikt" ? (
            <Oversikt kpis={kpis} assist={assist} assistDone={assistDone} pinned={pinned} channels={channels} anns={anns}
              onAssist={() => { if (assist) { remind(assist.ann); setAssistDone(true); } }} onDismissAssist={() => setAssistDone(true)}
              onOpen={(id) => setDetailId(id)} onGoChannels={() => setTab("kanaler")} onGoList={() => setTab("kunngjoringer")} setStatusF={setStatusF} />
          ) : tab === "kunngjoringer" ? (
            <Kunngjoringer list={list} anns={anns} channels={channels} query={query} setQuery={setQuery}
              statusF={statusF} setStatusF={setStatusF} channelF={channelF} setChannelF={setChannelF} sort={sort} setSort={setSort}
              onOpen={(id) => setDetailId(id)} onNew={() => setCompose({ mode: "create" })} onTogglePin={togglePin} />
          ) : tab === "kanaler" ? (
            <Kanaler channels={channels} anns={anns} onOpen={openChannel} onNew={() => setChModal({ mode: "create" })}
              onEdit={(c) => setChModal({ mode: "edit", initial: c })} onArchive={(c) => setConfirm({ kind: "channel", target: c })} />
          ) : (
            <window.KoSkranke />
          )}
        </div>

        {/* overlays */}
        <window.KoDetail ann={detail} canManage={true} role="manager"
          onClose={() => setDetailId(null)}
          onEdit={(a) => { setDetailId(null); setCompose({ mode: "edit", initial: a }); }}
          onTogglePin={togglePin} onArchive={(a) => setConfirm({ kind: "archive", target: a })} onRepublish={republishAnn}
          onRemind={remind} onComment={addComment} />

        <window.KoCompose open={!!compose} mode={compose && compose.mode} initial={compose && compose.initial}
          channels={channels} onClose={() => setCompose(null)} onSubmit={upsertAnn} />

        <window.KoChannelModal open={!!chModal} mode={chModal && chModal.mode} initial={chModal && chModal.initial}
          onClose={() => setChModal(null)} onSubmit={upsertChannel} />

        <Ko.ConfirmModal open={!!confirm && confirm.kind === "archive"} onClose={() => setConfirm(null)}
          tone="warn" ic="archive" title="Arkivér kunngjøring?" body={confirm && confirm.target ? `«${confirm.target.title}» tas ut av aktiv feed.` : ""}
          note="Kunngjøringen beholdes for historikk og kan gjenopprettes. Mottakere varsles ikke."
          confirmLabel="Arkivér" confirmTone="primary" onConfirm={() => confirm && archiveAnn(confirm.target)} />

        <Ko.ConfirmModal open={!!confirm && confirm.kind === "channel"} onClose={() => setConfirm(null)}
          tone="warn" ic="archive" title={confirm && confirm.target && confirm.target.archived ? "Gjenåpne kanal?" : "Arkivér kanal?"}
          body={confirm && confirm.target ? `#${confirm.target.name}` : ""}
          note={confirm && confirm.target && confirm.target.archived ? "Kanalen blir aktiv igjen og kan motta nye kunngjøringer." : "Eksisterende kunngjøringer beholdes. Ingen nye kan publiseres før den gjenåpnes."}
          confirmLabel={confirm && confirm.target && confirm.target.archived ? "Gjenåpne" : "Arkivér"} confirmTone="primary"
          onConfirm={() => confirm && toggleArchiveChannel(confirm.target)} />
      </main>
    );
  }

  // ============================================================
  // OVERSIKT
  // ============================================================
  function Oversikt({ kpis, assist, assistDone, pinned, channels, anns, onAssist, onDismissAssist, onOpen, onGoChannels, onGoList, setStatusF }) {
    const recent = anns.filter((a) => a.status === "published").slice(0, 5);
    const PULSES = [
      { lbl: "Publisert", val: kpis.published, ic: "megaphone" },
      { lbl: "Lesegrad", val: kpis.readPct, u: "%", ic: "eye", tone: kpis.readPct >= 70 ? "ok" : kpis.readPct >= 40 ? "warn" : "crit" },
      { lbl: "Planlagt", val: kpis.scheduled, ic: "clock", tone: kpis.scheduled ? "info" : "" },
      { lbl: "Utkast", val: kpis.drafts, ic: "pen" },
      { lbl: "Aktive kanaler", val: kpis.channels, ic: "hash" },
    ];
    return (
      <div className="ko-stack">
        <div className="ko-pulserow">
          {PULSES.map((p) => (
            <button key={p.lbl} className="pulse" onClick={() => { if (p.lbl === "Aktive kanaler") onGoChannels(); else { setStatusF(p.lbl === "Planlagt" ? "scheduled" : p.lbl === "Utkast" ? "draft" : "all"); onGoList(); } }}>
              <span className="pulse-lbl"><span className="ico"><Ic n={p.ic} s={13} /></span>{p.lbl}</span>
              <span className={`pulse-val ${p.tone || ""}`}>{p.val}{p.u && <span className="u">{p.u}</span>}</span>
            </button>
          ))}
        </div>

        {/* Botsson assist */}
        {assist && !assistDone && (
          <div className="ko-assist">
            <span className="ko-assist-av"><Ic n="bot" s={17} c="#fff" /></span>
            <div className="ko-assist-body">
              <div className="ko-assist-t"><strong>{assist.missing} {assist.missing === 1 ? "ansatt har" : "ansatte har"} ikke lest «{assist.ann.title}»</strong></div>
              <div className="ko-assist-sources">
                <span className="src"><Ic n="eye" s={11} /> Lesekvittering</span>
                <span className="src"><Ko.ChannelChip id={assist.ann.channel} sm /></span>
                <span className="src"><Ic n="users" s={11} /> {assist.ann.targetCount} mottakere</span>
              </div>
            </div>
            <div className="ko-assist-actions">
              <button className="ko-btn sm primary" onClick={onAssist}><Ic n="bell" s={14} /> Send påminnelse</button>
              <button className="ko-btn sm ghost" onClick={onDismissAssist}>Avvis</button>
            </div>
          </div>
        )}

        <div className="so-grid-2">
          <Ko.Panel icon="pin" iconTone="warn" title="Festet" cnt={pinned.length}>
            {pinned.length === 0 ? <Ko.Empty icon="pin" title="Ingenting festet" sub="Fest viktige kunngjøringer så de holder seg øverst for hele teamet." /> : (
              <div className="ko-pinlist">
                {pinned.map((a) => (
                  <button key={a.id} className="ko-pinrow" onClick={() => onOpen(a.id)}>
                    <span className="ko-pin-ic"><Ic n="pin" s={14} /></span>
                    <span className="ko-pin-main"><span className="t">{a.title}</span><span className="m"><Ko.ChannelChip id={a.channel} sm /> · {a.audienceLabel}</span></span>
                    <span className="ko-pin-read mono">{a.readCount}/{a.targetCount}</span>
                  </button>
                ))}
              </div>
            )}
          </Ko.Panel>

          <Ko.Panel icon="hash" title="Kanaler" cnt={channels.filter((c) => !c.archived).length} action={<button className="ko-linkbtn" onClick={onGoChannels}>Alle <Ic n="chevRight" s={13} /></button>}>
            <div className="ko-chminilist">
              {channels.filter((c) => !c.archived).map((c) => (
                <div key={c.id} className="ko-chmini" style={{ "--ch": c.color }}>
                  <span className="ic"><Ic n={Ko.kindMeta(c.kind).icon} s={14} /></span>
                  <span className="nm">#{c.name}</span>
                  <span className="mb mono">{c.members}</span>
                </div>
              ))}
            </div>
          </Ko.Panel>
        </div>

        <Ko.Panel icon="megaphone" title="Siste kunngjøringer" action={<button className="ko-linkbtn" onClick={onGoList}>Se alle <Ic n="chevRight" s={13} /></button>}>
          {recent.length === 0 ? <Ko.Empty icon="megaphone" title="Ingen publiserte ennå" /> : (
            <div className="ko-feedmini">
              {recent.map((a) => <AnnRow key={a.id} a={a} onOpen={onOpen} />)}
            </div>
          )}
        </Ko.Panel>
      </div>
    );
  }

  // ============================================================
  // KUNNGJØRINGER (master list)
  // ============================================================
  function Kunngjoringer({ list, anns, channels, query, setQuery, statusF, setStatusF, channelF, setChannelF, sort, setSort, onOpen, onNew, onTogglePin }) {
    const STATUSES = [["all", "Alle"], ["published", "Publisert"], ["scheduled", "Planlagt"], ["draft", "Utkast"], ["archived", "Arkivert"]];
    return (
      <div className="ko-stack">
        <div className="ko-toolbar">
          <div className="ko-search"><Ic n="search" s={15} c="var(--muted)" /><input placeholder="Søk i kunngjøringer…" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
          <div className="ko-segrow">
            {STATUSES.map(([k, l]) => <button key={k} className={`ko-chip ${statusF === k ? "on" : ""}`} onClick={() => setStatusF(k)}>{l}</button>)}
          </div>
          <span className="spacer" />
          <select className="ko-select" value={channelF} onChange={(e) => setChannelF(e.target.value)}>
            <option value="all">Alle kanaler</option>
            {channels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
          </select>
          <select className="ko-select" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="ny">Nyeste</option><option value="lest">Lesegrad</option><option value="mottakere">Mottakere</option>
          </select>
        </div>

        <Ko.Panel className="flush">
          {list.length === 0 ? (
            <Ko.Empty icon="megaphone" title="Ingen treff" sub="Ingen kunngjøringer matcher filteret. Juster søk eller status." action={<button className="ko-btn sm primary" style={{ marginTop: 12 }} onClick={onNew}><Ic n="plus" s={14} /> Ny kunngjøring</button>} />
          ) : (
            <div className="ko-list">
              {list.map((a) => <AnnRow key={a.id} a={a} onOpen={onOpen} onTogglePin={onTogglePin} expanded />)}
            </div>
          )}
        </Ko.Panel>
      </div>
    );
  }

  // shared announcement row
  function AnnRow({ a, onOpen, onTogglePin, expanded }) {
    const sm = Ko.statusMeta(a.status);
    const pct = Ko.readPct(a);
    return (
      <div className={`ko-annrow ${expanded ? "exp" : ""}`} onClick={() => onOpen(a.id)} role="button" tabIndex={0}>
        <span className="ko-ann-edge" data-tone={sm.tone} />
        <div className="ko-ann-main">
          <div className="ko-ann-top">
            <Ko.ChannelChip id={a.channel} sm />
            {a.pinned && <span className="ko-ann-pin" title="Festet"><Ic n="pin" s={12} /></span>}
            <Ko.StatusBadge id={a.status} />
            {a.priority === "operational" && a.status === "published" && <Ko.Badge tone="warning" ic="bell">Operasjonell</Ko.Badge>}
          </div>
          <div className="ko-ann-title">{a.title}</div>
          {expanded && <div className="ko-ann-body">{a.body}</div>}
          <div className="ko-ann-meta">
            <span className="seg"><Ko.Av id={a.author} size={18} /> {Ko.person(a.author).name}</span>
            <span className="dot" />
            <Ko.AudiencePill aud={a.audience} count={a.targetCount} />
            <span className="dot" />
            <span className="mono">{a.status === "scheduled" ? a.scheduledFor : a.createdAt}</span>
          </div>
        </div>
        <div className="ko-ann-side">
          {a.status === "published" && a.targetCount > 0 && (
            <div className="ko-ann-read">
              <div className="ring" style={{ "--p": pct }}><span className="mono">{pct}%</span></div>
              <span className="lbl mono">{a.readCount}/{a.targetCount}</span>
            </div>
          )}
          {onTogglePin && a.status === "published" && (
            <button className="ko-rowpin" title={a.pinned ? "Løsne" : "Fest"} onClick={(e) => { e.stopPropagation(); onTogglePin(a); }} data-on={a.pinned}><Ic n="pin" s={15} /></button>
          )}
        </div>
      </div>
    );
  }

  // ============================================================
  // KANALER (channel management)
  // ============================================================
  function Kanaler({ channels, anns, onOpen, onNew, onEdit, onArchive }) {
    const active = channels.filter((c) => !c.archived);
    const archived = channels.filter((c) => c.archived);
    const countFor = (id) => anns.filter((a) => a.channel === id && a.status === "published").length;
    const Card = ({ c }) => {
      const km = Ko.kindMeta(c.kind);
      return (
        <div className={`ko-chcard ${c.archived ? "arch" : ""}`} style={{ "--ch": c.color }}>
          <div className="ko-chcard-top">
            <span className="ko-chcard-ic"><Ic n={km.icon} s={17} /></span>
            <div className="ko-chcard-id"><div className="nm">#{c.name}</div><div className="kd">{km.label}</div></div>
            <span className="spacer" />
            <ChannelMenu c={c} onEdit={onEdit} onArchive={onArchive} />
          </div>
          <div className="ko-chcard-desc">{c.desc}</div>
          <div className="ko-chcard-foot">
            <span className="seg"><Ic n="users" s={13} /> {c.members}</span>
            <span className="seg"><Ic n={km.post === "managers" ? "lock" : "globe"} s={13} /> {km.post === "managers" ? "Kun ledere" : "Alle kan poste"}</span>
            <span className="seg"><Ic n="megaphone" s={13} /> {countFor(c.id)}</span>
            <span className="spacer" />
            {!c.archived && <button className="ko-linkbtn" onClick={() => onOpen(c)}>Åpne <Ic n="chevRight" s={13} /></button>}
          </div>
        </div>
      );
    };
    return (
      <div className="ko-stack">
        <div className="ko-chgrid">{active.map((c) => <Card key={c.id} c={c} />)}</div>
        {archived.length > 0 && (
          <Ko.Panel icon="archive" title="Arkiverte kanaler" cnt={archived.length}>
            <div className="ko-archlist">
              {archived.map((c) => (
                <div key={c.id} className="ko-archrow">
                  <span className="ic"><Ic n="hash" s={14} /></span>
                  <span className="nm">#{c.name}</span>
                  <span className="ds">{c.desc}</span>
                  <span className="spacer" />
                  <button className="ko-btn sm" onClick={() => onArchive(c)}><Ic n="undo" s={14} /> Gjenåpne</button>
                </div>
              ))}
            </div>
          </Ko.Panel>
        )}
      </div>
    );
  }

  function ChannelMenu({ c, onEdit, onArchive }) {
    const [open, setOpen] = useState(false);
    return (
      <div style={{ position: "relative" }}>
        <button className="ko-iconbtn sm" onClick={() => setOpen((o) => !o)} aria-label="Meny"><Ic n="sliders" s={16} /></button>
        {open && (
          <Ko.Pop onClose={() => setOpen(false)} style={{ right: 0, top: 30, minWidth: 168 }}>
            <button className="ko-popitem" onClick={() => { setOpen(false); onEdit(c); }}><Ic n="pen" s={15} /> Rediger</button>
            <button className="ko-popitem" onClick={() => { setOpen(false); onArchive(c); }}><Ic n={c.archived ? "undo" : "archive"} s={15} /> {c.archived ? "Gjenåpne" : "Arkivér"}</button>
          </Ko.Pop>
        )}
      </div>
    );
  }

  window.SO_PAGES = Object.assign(window.SO_PAGES || {}, { kommunikasjon: KommunikasjonPage });
})();
