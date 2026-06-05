// ===== Kommunikasjon · Skranke — ticket (sak) detail drawer (window.KoCaseDrawer) =====
// Right-side slide-over matching KoDetail. Shows the conversation thread with
// channel context, a persistent Botsson AI summary, internal notes, an activity
// timeline (incl. what the AI did), and owner controls: status, priority,
// reassign (reversible via toast/undo upstream), resolve / reopen. AI is
// assistive — it can DRAFT a reply (confidence + sources + "why"), but never
// closes a case or reassigns sensitive ones on its own.
(function () {
  const { useState, useEffect, useRef } = React;
  const Ko = window.Ko, Ic = window.Ic, SD = window.SmartoutData;

  const OWNER_POOL = ["ma", "es", "jh"]; // managers who can own a desk/sak

  function CaseAvatar({ id, size = 32 }) { return <Ko.Av id={id} size={size} />; }

  // small reusable status/priority/sla badge from catalogs
  function StatusBadge({ id }) { const m = SD.CASE_STATUS[id]; return m ? <Ko.Badge tone={m.tone} ic={m.icon}>{m.label}</Ko.Badge> : null; }
  function PrioBadge({ id, outline }) { const m = SD.CASE_PRIORITY[id]; return m ? <Ko.Badge tone={m.tone} ic={m.icon} outline={outline}>{m.label}</Ko.Badge> : null; }
  function SlaBadge({ id }) { const m = SD.SLA_STATE[id]; return m ? <Ko.Badge tone={m.tone} ic={m.icon} outline>{m.label}</Ko.Badge> : null; }

  function KoCaseDrawer({ c, onClose, onSendReply, onStatus, onPriority, onResolve, onReopen, onReassign, onAddNote, onAcceptDraft, onDismissDraft }) {
    const [tab, setTab] = useState("samtale");      // samtale | internt | logg
    const [reply, setReply] = useState("");
    const [note, setNote] = useState("");
    const [why, setWhy] = useState(false);
    const [reassignOpen, setReassignOpen] = useState(false);
    const [prioOpen, setPrioOpen] = useState(false);
    const bodyRef = useRef(null);

    useEffect(() => {
      if (!c) return;
      setTab("samtale"); setReply(""); setNote(""); setWhy(false); setReassignOpen(false); setPrioOpen(false);
      const h = (e) => { if (e.key === "Escape") onClose(); };
      window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
    }, [c && c.id]);

    useEffect(() => { if (bodyRef.current && tab === "samtale") bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [c && c.messages && c.messages.length, tab]);

    if (!c) return null;
    const desk = SD.DESK_BY_ID[c.desk] || {};
    const cat = SD.SK_CATEGORIES[c.category] || {};
    const requester = Ko.person(c.requester);
    const owner = Ko.person(c.owner);
    const st = SD.CASE_STATUS[c.status] || {};
    const isOpen = SD.SK_OPEN_STATES.includes(c.status);
    const showDraft = c.aiDraft && isOpen && !c.draftUsed && !c.draftDismissed;
    const conf = Math.round((c.aiConfidence || 0) * 100);

    const sendReply = () => { if (reply.trim()) { onSendReply(c.id, reply.trim()); setReply(""); } };
    const useDraft = () => { setReply(c.aiDraft); onAcceptDraft && onAcceptDraft(c.id); };

    return (
      <div className="ko-drawer-scrim" onMouseDown={onClose}>
        <aside className="ko-drawer ko-case" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Sak: ${c.subject}`}>
          {/* header */}
          <div className="ko-dr-head">
            <div className="ko-dr-headtop">
              <span className="ko-chchip" style={{ "--ch": desk.color }}><Ic n="lifebuoy" s={12} /><span>{desk.name}</span></span>
              <StatusBadge id={c.status} />
              <SlaBadge id={c.sla} />
              <span className="spacer" />
              <button className="ko-iconbtn" onClick={onClose} aria-label="Lukk"><Ic n="x" s={18} /></button>
            </div>
            <h2 className="ko-dr-title">{c.subject}</h2>
            <div className="ko-dr-byline">
              <CaseAvatar id={c.requester} size={24} />
              <span><strong>{requester.name}</strong></span>
              <Ic n="arrowRight" s={13} style={{ opacity: 0.5 }} />
              <CaseAvatar id={c.owner} size={24} />
              <span>{owner.id === SD.SK_ME ? `${owner.name} (deg)` : owner.name}</span>
              <span className="dot" />
              <span className="mono">{cat.label}</span>
              <span className="dot" />
              <span className="mono">åpnet {c.ageLabel} siden</span>
            </div>
          </div>

          {/* tabs */}
          <div className="ko-dr-tabs">
            {[["samtale", "Samtale"], ["internt", `Internt · ${(c.notes || []).length}`], ["logg", "Logg"]].map(([k, l]) => (
              <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>

          <div className="ko-dr-body" ref={bodyRef}>
            {/* persistent AI summary */}
            <div className="ko-case-ai">
              <div className="ko-case-ai-head">
                <span className="av"><Ic n="bot" s={15} c="#fff" /></span>
                <span className="ttl">Botsson · sammendrag</span>
                <span className="conf" data-tone={conf >= 80 ? "ok" : conf >= 60 ? "warn" : "low"}>{conf}% sikker</span>
              </div>
              <p className="ko-case-ai-body">{c.aiSummary}</p>
              <div className="ko-case-ai-src">
                {(c.aiSources || []).map((s, i) => <span key={i} className="src"><Ic n="file" s={11} /> {s}</span>)}
              </div>
              {conf < 60 && (
                <div className="ko-case-ai-low"><Ic n="alert" s={13} /> Lav sikkerhet — Botsson anbefaler at en ansvarlig svarer manuelt.</div>
              )}
            </div>

            {tab === "samtale" && (
              <div className="ko-case-thread">
                {c.messages.map((m, i) => {
                  if (m.from === "sys") return (
                    <div key={i} className="ko-case-sys">{m.ai && <Ic n="sparkle" s={11} />}<span>{m.body}</span><span className="mono">{m.at}</span></div>
                  );
                  const p = Ko.person(m.from);
                  return (
                    <div key={i} className={`ko-case-msg ${m.self ? "self" : ""}`}>
                      {!m.self && <CaseAvatar id={m.from} size={32} />}
                      <div className="b">
                        <div className="h">{!m.self && <strong>{p.name}</strong>}<span className="mono">{m.at}</span>{m.self && <strong>{owner.name} (deg)</strong>}</div>
                        <div className="bub">{m.body}</div>
                      </div>
                    </div>
                  );
                })}

                {/* AI draft suggestion */}
                {showDraft && (
                  <div className="ko-case-draft">
                    <div className="ko-case-draft-head">
                      <span className="av"><Ic n="bot" s={14} c="#fff" /></span>
                      <span className="ttl">Forslag til svar</span>
                      <span className="conf" data-tone={conf >= 80 ? "ok" : "warn"}>{conf}%</span>
                      <span className="spacer" />
                      <button className="ko-linkbtn" onClick={() => setWhy((v) => !v)}>{why ? "Skjul" : "Hvorfor?"}</button>
                    </div>
                    {why && (
                      <div className="ko-case-draft-why">
                        Basert på {(c.aiSources || []).length} kilder og lignende løste saker. Botsson skriver aldri svaret selv — du redigerer og sender.
                        <div className="src-row">{(c.aiSources || []).map((s, i) => <span key={i} className="src"><Ic n="file" s={10} /> {s}</span>)}</div>
                      </div>
                    )}
                    <p className="ko-case-draft-body">{c.aiDraft}</p>
                    <div className="ko-case-draft-foot">
                      <button className="ko-btn sm primary" onClick={useDraft}><Ic n="pen" s={13} /> Sett inn og rediger</button>
                      <button className="ko-btn sm ghost" onClick={() => onDismissDraft && onDismissDraft(c.id)}>Avvis</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === "internt" && (
              <div className="ko-dr-stack">
                <div className="ko-case-noteinfo"><Ic n="lock" s={13} /> Interne notater er kun synlige for ansvarlige — ikke for {requester.name}.</div>
                {(c.notes || []).length === 0 ? (
                  <Ko.Empty icon="notepen" title="Ingen interne notater" sub="Skriv notater til deg selv eller andre ansvarlige uten at den som spør ser dem." />
                ) : (
                  <div className="ko-case-notes">
                    {c.notes.map((n, i) => { const p = Ko.person(n.by); return (
                      <div key={i} className="ko-case-note"><Ko.Av id={n.by} size={26} /><div className="b"><div className="h"><strong>{p.name}</strong><span className="mono">{n.at}</span></div><div className="t">{n.body}</div></div></div>
                    ); })}
                  </div>
                )}
                <div className="ko-comment-compose">
                  <input className="ko-input" placeholder="Internt notat…" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && note.trim()) { onAddNote(c.id, note.trim()); setNote(""); } }} />
                  <button className="ko-btn primary sm" disabled={!note.trim()} onClick={() => { onAddNote(c.id, note.trim()); setNote(""); }}><Ic n="send" s={14} /></button>
                </div>
              </div>
            )}

            {tab === "logg" && (
              <div className="ko-dr-stack">
                <div className="ko-timeline">
                  {(c.activity || []).slice().reverse().map((ev, i) => {
                    const p = ev.by === "bot" ? { name: "Botsson" } : Ko.person(ev.by);
                    return (
                      <div key={i} className={`ko-tl-row ${ev.ai ? "ai" : ""}`}>
                        <span className="ko-tl-dot" style={ev.ai ? { background: "var(--info)", boxShadow: "0 0 0 3px rgba(39,132,213,0.16)" } : null} />
                        <div className="ko-tl-b"><div className="t">{ev.text}</div><div className="m"><strong>{p.name}</strong>{ev.ai && <Ko.Badge tone="info" ic="bot">AI</Ko.Badge>} · <span className="mono">{ev.at}</span></div></div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* composer (only on Samtale, open cases) */}
          {tab === "samtale" && (
            isOpen ? (
              <div className="ko-case-composer">
                <textarea className="ko-textarea sm" placeholder={`Svar til ${requester.name}…`} value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendReply(); }} />
                <div className="ko-case-composer-foot">
                  <span className="hint">{desk.preset === "private" ? <><Ic n="lock" s={11} /> Privat sak · kun {requester.name} og du</> : <><Ic n="globe" s={11} /> Synlig i {c.channelThread}</>}</span>
                  <span className="spacer" />
                  <button className="ko-btn primary sm" disabled={!reply.trim()} onClick={sendReply}><Ic n="send" s={14} /> Send</button>
                </div>
              </div>
            ) : (
              <div className="ko-case-resolved-strip"><Ic n="check" s={15} /> Saken er {st.label.toLowerCase()}. {c.resolveHrs ? `Løsetid ${c.resolveHrs} t.` : ""}</div>
            )
          )}

          {/* footer — owner controls */}
          <div className="ko-dr-foot ko-case-foot">
            {/* reassign */}
            <div style={{ position: "relative" }}>
              <button className="ko-btn" onClick={() => setReassignOpen((o) => !o)}><Ic n="userCheck" s={15} /> Tildel</button>
              {reassignOpen && (
                <Ko.Pop onClose={() => setReassignOpen(false)} style={{ bottom: 42, left: 0, minWidth: 200 }}>
                  <div className="ko-pop-lbl">Tildel ansvarlig</div>
                  {OWNER_POOL.map((id) => { const p = Ko.person(id); return (
                    <button key={id} className="ko-popitem" onClick={() => { setReassignOpen(false); if (id !== c.owner) onReassign(c, id); }}>
                      <Ko.Av id={id} size={22} /> {p.name}{id === c.owner && <span className="ko-pop-cur"><Ic n="check" s={13} /></span>}
                    </button>
                  ); })}
                </Ko.Pop>
              )}
            </div>
            {/* priority */}
            <div style={{ position: "relative" }}>
              <button className="ko-btn" onClick={() => setPrioOpen((o) => !o)}><Ic n="flag" s={15} /> Prioritet</button>
              {prioOpen && (
                <Ko.Pop onClose={() => setPrioOpen(false)} style={{ bottom: 42, left: 0, minWidth: 170 }}>
                  <div className="ko-pop-lbl">Sett prioritet</div>
                  {["haster", "hoy", "normal", "lav"].map((id) => (
                    <button key={id} className="ko-popitem" onClick={() => { setPrioOpen(false); onPriority(c, id); }}>
                      <PrioBadge id={id} outline />{id === c.priority && <span className="ko-pop-cur"><Ic n="check" s={13} /></span>}
                    </button>
                  ))}
                </Ko.Pop>
              )}
            </div>
            <span className="spacer" />
            {isOpen ? (
              <button className="ko-btn primary" onClick={() => onResolve(c)}><Ic n="check" s={15} /> Løs sak</button>
            ) : (
              <button className="ko-btn" onClick={() => onReopen(c)}><Ic n="undo" s={15} /> Gjenåpne</button>
            )}
          </div>
        </aside>
      </div>
    );
  }

  window.KoCaseDrawer = KoCaseDrawer;
})();
