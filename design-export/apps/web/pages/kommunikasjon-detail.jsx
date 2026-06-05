// ===== Kommunikasjon — announcement detail drawer (window.KoDetail) =====
// Slide-over: header + status, body, audience + read receipts (who has/hasn't read),
// edit history, comment thread. Manager actions (edit/pin/archive/remind) are gated
// by `canManage`. Assistive — never auto-acts.
(function () {
  const { useState, useEffect } = React;
  const Ko = window.Ko, Ic = window.Ic, SD = window.SmartoutData;

  function KoDetail({ ann, canManage, onClose, onEdit, onTogglePin, onArchive, onRepublish, onRemind, onComment, role }) {
    const [tab, setTab] = useState("oversikt"); // oversikt | mottakere | historikk
    const [draft, setDraft] = useState("");
    useEffect(() => {
      if (!ann) return;
      setTab("oversikt"); setDraft("");
      const h = (e) => { if (e.key === "Escape") onClose(); };
      window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
    }, [ann && ann.id]);
    if (!ann) return null;

    const ch = Ko.channel(ann.channel);
    const author = Ko.person(ann.author);
    const sm = Ko.statusMeta(ann.status);
    const pct = Ko.readPct(ann);
    const readIds = (ann.reads || []).map((r) => r.emp);
    const unreadIds = (ann.targetIds || []).filter((id) => !readIds.includes(id));

    return (
      <div className="ko-drawer-scrim" onMouseDown={onClose}>
        <aside className="ko-drawer" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
          {/* header */}
          <div className="ko-dr-head">
            <div className="ko-dr-headtop">
              <Ko.ChannelChip id={ann.channel} />
              <Ko.StatusBadge id={ann.status} />
              {ann.pinned && <Ko.Badge tone="warning" ic="pin">Festet</Ko.Badge>}
              <span className="spacer" />
              <button className="ko-iconbtn" onClick={onClose} aria-label="Lukk"><Ic n="x" s={18} /></button>
            </div>
            <h2 className="ko-dr-title">{ann.title}</h2>
            <div className="ko-dr-byline">
              <Ko.Av id={ann.author} size={26} />
              <span><strong>{author.name}</strong> · {author.role}</span>
              <span className="dot" />
              <span className="mono">{ann.status === "scheduled" ? `Planlagt ${ann.scheduledFor}` : ann.createdAt}</span>
            </div>
          </div>

          {/* tabs */}
          <div className="ko-dr-tabs">
            {[["oversikt", "Oversikt"], ["mottakere", `Mottakere · ${ann.targetCount}`], ["historikk", "Historikk"]].map(([k, l]) => (
              <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>

          <div className="ko-dr-body">
            {tab === "oversikt" && (
              <div className="ko-dr-stack">
                <p className="ko-dr-text">{ann.body}</p>

                {ann.attachments && ann.attachments.length > 0 && (
                  <div className="ko-dr-attach">
                    {ann.attachments.map((at, i) => (
                      <div key={i} className="ko-attach-card"><span className="ic"><Ic n="file" s={15} /></span><span>{at.label}</span></div>
                    ))}
                  </div>
                )}

                {/* meta grid */}
                <div className="ko-dr-meta">
                  <div className="m"><span className="k">Målgruppe</span><span className="v"><Ko.AudiencePill aud={ann.audience} /></span></div>
                  <div className="m"><span className="k">Varsling</span><span className="v">{ann.priority === "operational" ? <Ko.Badge tone="warning" ic="bell">Operasjonell</Ko.Badge> : <span className="muted">Vanlig</span>}</span></div>
                  <div className="m"><span className="k">Lest</span><span className="v mono">{ann.readCount} / {ann.targetCount}{ann.targetCount ? ` · ${pct}%` : ""}</span></div>
                </div>

                {/* read progress */}
                {ann.status === "published" && ann.targetCount > 0 && (
                  <div className="ko-readbar-wrap">
                    <div className="ko-readbar"><span style={{ width: `${pct}%` }} /></div>
                    <div className="ko-readbar-lbl"><span><Ko.AvStack ids={readIds} max={5} /> har lest</span>{unreadIds.length > 0 && <span className="muted">{unreadIds.length} gjenstår</span>}</div>
                  </div>
                )}

                {ann.status === "scheduled" && (
                  <div className="ko-dr-callout info"><Ic n="clock" s={16} /><div><strong>Planlagt utsending</strong><span>Publiseres automatisk {ann.scheduledFor}. Ingen mottakere er varslet ennå.</span></div></div>
                )}
                {ann.status === "draft" && (
                  <div className="ko-dr-callout muted"><Ic n="pen" s={16} /><div><strong>Utkast</strong><span>Ikke publisert. Kun synlig for deg og andre ledere.</span></div></div>
                )}

                {/* comments */}
                <div className="ko-comments">
                  <div className="ko-comments-head"><Ic n="message" s={14} /> Kommentarer <span className="cnt">{(ann.comments || []).length}</span></div>
                  {(ann.comments || []).length === 0 ? (
                    <div className="ko-comments-empty">Ingen kommentarer ennå.</div>
                  ) : (
                    <div className="ko-comments-list">
                      {ann.comments.map((c) => {
                        const p = Ko.person(c.by);
                        return (
                          <div key={c.id} className="ko-comment">
                            <Ko.Av id={c.by} size={28} />
                            <div className="b"><div className="h"><strong>{p.name}</strong><span className="mono">{c.at}</span></div><div className="t">{c.body}</div></div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="ko-comment-compose">
                    <input className="ko-input" placeholder="Skriv en kommentar…" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && draft.trim()) { onComment(ann.id, draft.trim()); setDraft(""); } }} />
                    <button className="ko-btn primary sm" disabled={!draft.trim()} onClick={() => { onComment(ann.id, draft.trim()); setDraft(""); }}><Ic n="send" s={14} /></button>
                  </div>
                </div>
              </div>
            )}

            {tab === "mottakere" && (
              <div className="ko-dr-stack">
                <div className="ko-rcpt-summary">
                  <div className="seg"><span className="n mono">{ann.readCount}</span><span className="l">lest</span></div>
                  <div className="seg"><span className="n mono">{unreadIds.length}</span><span className="l">ulest</span></div>
                  <div className="seg"><span className="n mono">{ann.targetCount}</span><span className="l">totalt</span></div>
                </div>
                {ann.status !== "published" ? (
                  <Ko.Empty icon="users" title="Ikke sendt ennå" sub={ann.status === "scheduled" ? "Mottakerlisten beregnes ved publisering." : "Publiser kunngjøringen for å spore lesing."} />
                ) : (
                  <>
                    <div className="ko-rcpt-group"><div className="ko-rcpt-glbl"><Ic n="check" s={13} c="var(--success)" /> Har lest ({readIds.length})</div>
                      {readIds.map((id) => { const r = (ann.reads || []).find((x) => x.emp === id); const p = Ko.person(id); return (
                        <div key={id} className="ko-rcpt-row"><Ko.Av id={id} size={28} /><span className="nm">{p.name}</span><span className="rl">{p.role}</span><span className="at mono">{r ? `kl. ${r.at}` : ""}</span></div>
                      ); })}
                    </div>
                    {unreadIds.length > 0 && (
                      <div className="ko-rcpt-group"><div className="ko-rcpt-glbl"><Ic n="clock" s={13} c="var(--muted)" /> Ikke lest ({unreadIds.length})</div>
                        {unreadIds.map((id) => { const p = Ko.person(id); return (
                          <div key={id} className="ko-rcpt-row dim"><Ko.Av id={id} size={28} /><span className="nm">{p.name}</span><span className="rl">{p.role}</span></div>
                        ); })}
                        {canManage && <button className="ko-btn sm" style={{ margin: "8px 2px 0" }} onClick={() => onRemind(ann)}><Ic n="bell" s={14} /> Påminn {unreadIds.length} som ikke har lest</button>}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {tab === "historikk" && (
              <div className="ko-dr-stack">
                <div className="ko-timeline">
                  {(ann.edits || []).slice().reverse().map((ev, i) => {
                    const p = Ko.person(ev.by);
                    return (
                      <div key={i} className="ko-tl-row">
                        <span className="ko-tl-dot" />
                        <div className="ko-tl-b"><div className="t">{ev.summary}</div><div className="m"><strong>{p.name}</strong> · <span className="mono">{ev.at}</span></div></div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* footer actions */}
          {canManage && (
            <div className="ko-dr-foot">
              {ann.status === "archived" ? (
                <button className="ko-btn" onClick={() => onRepublish(ann)}><Ic n="undo" s={15} /> Gjenopprett</button>
              ) : (
                <>
                  <button className="ko-btn" onClick={() => onEdit(ann)}><Ic n="pen" s={15} /> Rediger</button>
                  <button className="ko-btn" onClick={() => onTogglePin(ann)}><Ic n="pin" s={15} /> {ann.pinned ? "Løsne" : "Fest"}</button>
                  <span className="spacer" />
                  <button className="ko-btn danger-ghost" onClick={() => onArchive(ann)}><Ic n="archive" s={15} /> Arkivér</button>
                </>
              )}
            </div>
          )}
        </aside>
      </div>
    );
  }

  window.KoDetail = KoDetail;
})();
