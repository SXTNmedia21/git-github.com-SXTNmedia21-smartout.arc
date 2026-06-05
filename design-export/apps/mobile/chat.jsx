// =============================================================================
// Smartout Mobile — CHAT (Meldinger)
// Mobile mirror of the web ChatPanel/ChatInfo/ChatCard (apps/web/shared/shell.jsx).
// Reads the CENTRALIZED chat model from window.SmartoutData (shared/data.js) so the
// web + mobile clients can never drift. Exposes window.MConversation / MChatInfo /
// MChatCard / mConvMeta for pages.jsx.
// =============================================================================
(function () {
  const { useState, useEffect, useRef } = React;
  const Ic = window.MIc;
  const cls = (...a) => a.filter(Boolean).join(' ');
  const D = () => window.SmartoutData || { USERS: {} };

  // resolve a conversation (shared web shape: {id, type:'group'|'dm', name/uid, sub, c, online}) → display meta
  function mConvMeta(c) {
    const USERS = D().USERS;
    if (!c) return {};
    return c.type === 'group'
      ? { name: c.name, sub: c.sub, init: (c.name || '?').slice(0, 2).toUpperCase(), color: c.c, group: true }
      : { name: (USERS[c.uid] || {}).name || c.uid, sub: (USERS[c.uid] || {}).role || 'Ansatt', init: (USERS[c.uid] || {}).initials || '?', color: (USERS[c.uid] || {}).color || '#888', group: false };
  }
  const senderName = (from) => {
    if (from === 'me') return 'Du';
    const USERS = D().USERS;
    return ((USERS[from] || {}).name || (D().CHAT_STAFF || []).find(s => s.uid === from)?.name || '').split(' ')[0];
  };

  // ---------------------------------------------------------------------------
  // MChatCard — shared attachment cards (mirror of web ChatCard, .m-* styling)
  // ---------------------------------------------------------------------------
  function MChatCard({ d }) {
    if (!d) return null;
    if (d.type === 'image') return (
      <div className="m-attc" style={{ width: 230 }}>
        <div className="m-attc-media img"><Ic n="camera" s={26} c="rgba(255,255,255,.9)" /><span className="m-attc-badge">{d.dim}</span></div>
        <div className="m-attc-pad"><div className="m-attc-row"><Ic n="camera" s={13} /> <b>{d.title}</b></div></div>
      </div>
    );
    if (d.type === 'video') return (
      <div className="m-attc" style={{ width: 230 }}>
        <div className="m-attc-media vid"><span className="m-attc-play"><Ic n="play" s={17} c="#fff" /></span><span className="m-attc-badge">{d.dur}</span></div>
        <div className="m-attc-pad"><div className="m-attc-row"><Ic n="video" s={13} /> <b>{d.title}</b></div></div>
      </div>
    );
    if (d.type === 'event') return (
      <div className="m-attc">
        <div className="m-attc-accent" style={{ background: d.c }} />
        <div className="m-attc-pad">
          <div className="m-attc-eyebrow"><Ic n="calendar" s={11} /> Event</div>
          <div className="m-attc-title">{d.title}</div>
          <div className="m-attc-row"><Ic n="clock" s={13} /> <b>{d.when}</b></div>
          <div className="m-attc-row"><Ic n="mappin" s={13} /> {d.loc}</div>
          <div className="m-attc-avs">{d.going.map((i, k) => <span key={k} className="m-attc-av" style={{ background: ['#3B82F6', '#10B981', '#A855F7'][k] }}>{i}</span>)}<span className="m-attc-av more">+{d.goingN - d.going.length}</span></div>
        </div>
        <div className="m-attc-foot"><span className="lbl">{d.goingN} påmeldt</span><span className="cta">Meld på</span></div>
      </div>
    );
    if (d.type === 'booking') return (
      <div className="m-attc">
        <div className="m-attc-accent" style={{ background: d.c }} />
        <div className="m-attc-pad">
          <div className="m-attc-eyebrow"><Ic n="users" s={11} /> Booking</div>
          <div className="m-attc-title">{d.guest}</div>
          <div className="m-attc-row"><Ic n="users" s={13} /> <b>{d.pax} gjester</b> · {d.table}</div>
          <div className="m-attc-row"><Ic n="clock" s={13} /> {d.when}</div>
        </div>
        <div className="m-attc-foot"><span className="lbl">Bekreftet</span><span className="cta">Åpne booking</span></div>
      </div>
    );
    if (d.type === 'task') return (
      <div className="m-attc">
        <div className="m-attc-pad">
          <div className="m-attc-eyebrow"><Ic n="list" s={11} /> Oppgave</div>
          <div className="m-attc-title">{d.title}</div>
          <div className="m-attc-row" style={{ justifyContent: 'space-between' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: d.fc }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: d.fc }} />{d.folder}</span><span className={cls('m-attc-pill', d.tone)}>{d.status}</span></div>
          <div className="m-attc-row"><Ic n="clock" s={13} /> <b className="mono" style={{ color: 'var(--error)' }}>{d.due}</b></div>
        </div>
        <div className="m-attc-foot"><span className="lbl">Tildelt deg</span><span className="cta">Åpne oppgave</span></div>
      </div>
    );
    if (d.type === 'shift') return (
      <div className="m-attc">
        <div className="m-attc-accent" style={{ background: d.c }} />
        <div className="m-attc-pad">
          <div className="m-attc-eyebrow"><Ic n="grid" s={11} /> Vakt</div>
          <div className="m-attc-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>{d.role}<span className={cls('m-attc-pill', d.tone)}>{d.status}</span></div>
          <div className="m-attc-row"><Ic n="clock" s={13} /> <b>{d.when}</b></div>
          <div className="m-attc-row"><span style={{ width: 8, height: 8, borderRadius: 3, background: d.c }} /> {d.dept}</div>
        </div>
        <div className="m-attc-foot"><span className="lbl">Udekket vakt</span><span className="cta">Ta vakten</span></div>
      </div>
    );
    if (d.type === 'manual') return (
      <div className="m-attc"><div className="m-attc-doc"><span className="ic"><Ic n="book" s={18} /></span><span className="body"><span className="m-attc-eyebrow" style={{ marginBottom: 3 }}>Manual</span><span className="t">{d.title}</span><span className="m">{d.meta}</span></span></div></div>
    );
    if (d.type === 'doc') return (
      <div className="m-attc"><div className="m-attc-doc file"><span className="ic"><Ic n="file" s={18} /></span><span className="body"><span className="t">{d.title}</span><span className="m">{d.ext} · {d.size} · {d.pages}</span></span><span className="dl"><Ic n="download" s={15} /></span></div></div>
    );
    if (d.type === 'quiz') return (
      <div className="m-attc"><div className="m-attc-doc quiz"><span className="ic"><Ic n="help" s={18} /></span><span className="body"><span className="m-attc-eyebrow" style={{ marginBottom: 3 }}>Quiz</span><span className="t">{d.title}</span><span className="m">{d.meta}</span></span></div></div>
    );
    if (d.type === 'poll') {
      const tot = d.opts.reduce((a, o) => a + o[1], 0) || 1;
      return (
        <div className="m-attc"><div className="m-attc-pad">
          <div className="m-attc-eyebrow"><Ic n="checkdoc" s={11} /> Spørring</div>
          <div className="m-attc-title" style={{ marginBottom: 4 }}>{d.q}</div>
          <div className="m-attc-poll">
            {d.opts.map(([l, v], i) => <span key={i} className="m-attc-poll-row"><span className="m-attc-poll-bar" style={{ width: `${(v / tot) * 100}%` }} /><span>{l}</span><span className="v">{v}</span></span>)}
          </div>
        </div><div className="m-attc-foot"><span className="lbl">{tot} svar</span><span className="cta">Stem</span></div></div>
      );
    }
    return <div className="m-attc"><div className="m-attc-pad"><div className="m-attc-title">{d.title}</div></div></div>;
  }

  // ---------------------------------------------------------------------------
  // MChatInfo — contact / group settings page (mirror of web ChatInfo)
  // ---------------------------------------------------------------------------
  function MChatInfo({ conv, meta, onBack, pinned, setPinned, muted, setMuted, toast, openProfile }) {
    const PIN_OPTS = D().CHAT_PIN_OPTS || [];
    const [pinExpand, setPinExpand] = useState(false);
    const [customTime, setCustomTime] = useState('');
    const setPin = (val, label) => { const prev = pinned; setPinned(val); setPinExpand(false); toast && toast(val ? `Festet · ${label}` : 'Løsnet', { undo: () => setPinned(prev) }); };
    const first = (meta.name || '').split(' ')[0];
    return (
      <div className="m-ci">
        <div className="m-chat-head">
          <button className="m-iconbtn" onClick={onBack} aria-label="Tilbake"><Ic n="chevLeft" s={22} /></button>
          <div className="m-chat-head-id"><div className="m-chat-head-name">{meta.group ? 'Gruppeinfo' : 'Kontaktinfo'}</div></div>
        </div>
        <div className="m-ci-body">
          <div className="m-ci-hero">
            <button className={cls('m-avatar', meta.group && 'group')} onClick={() => !meta.group && openProfile && openProfile(conv.uid)} style={{ width: 84, height: 84, fontSize: 28, background: meta.color, cursor: meta.group ? 'default' : 'pointer' }}>{meta.group ? <Ic n="users" s={36} c="#fff" /> : meta.init}</button>
            <div className="m-ci-name">{meta.name}</div>
            <div className="m-ci-sub">{meta.group ? conv.sub : (meta.sub || 'Ansatt') + ' · +47 901 23 456'}</div>
            <div className="m-ci-actions">
              <button className="m-ci-act" onClick={() => toast && toast('Ringer ' + first + '…')}><span className="ic"><Ic n="phone" s={18} /></span>Tale</button>
              <button className="m-ci-act" onClick={() => toast && toast('Videosamtale startet')}><span className="ic"><Ic n="video" s={18} /></span>Video</button>
              <button className="m-ci-act" onClick={() => toast && toast('Søk i samtale')}><span className="ic"><Ic n="search" s={18} /></span>Søk</button>
            </div>
          </div>

          {!meta.group && openProfile && (
            <button className="m-ci-row" onClick={() => openProfile(conv.uid)} style={{ border: '1px solid var(--border)', borderRadius: 14, marginBottom: 16, background: 'var(--card)' }}>
              <span className="m-ci-ic"><Ic n="users" s={18} /></span>
              <span className="m-ci-t">Se full profil<span className="m-ci-s">Kompetanse, team, beredskap og kontakt</span></span>
              <Ic n="chevRight" s={15} c="var(--muted)" />
            </button>
          )}

          <button className="m-ci-media" onClick={() => toast && toast('Medier, lenker og dokumenter')}>
            <span className="m-ci-ic"><Ic n="image" s={18} /></span>
            <span className="m-ci-media-t">Medier, lenker og dokumenter</span>
            <span className="m-ci-cnt">8</span>
            <Ic n="chevRight" s={16} c="var(--muted)" />
          </button>
          <div className="m-ci-thumbs">
            {['#864ad2', '#00ab93', '#3B82F6', '#c18200'].map((c, i) => (
              <span key={i} className="m-ci-thumb" style={{ background: `linear-gradient(135deg, ${c}, ${c}cc)` }}><Ic n={i === 3 ? 'file' : 'camera'} s={18} c="rgba(255,255,255,0.92)" /></span>
            ))}
          </div>

          <div className="m-ci-group">
            <button className="m-ci-row" onClick={() => toast && toast('Ingen meldinger med stjerne ennå')}><span className="m-ci-ic"><Ic n="star" s={18} /></span><span className="m-ci-t">Meldinger med stjerne</span><Ic n="chevRight" s={15} c="var(--muted)" /></button>
            <button className="m-ci-row" onClick={() => setMuted(m => !m)}>
              <span className="m-ci-ic"><Ic n={muted ? 'bellOff' : 'bell'} s={18} /></span>
              <span className="m-ci-t">Varslingsinnstillinger<span className="m-ci-s">{muted ? 'Dempet' : 'På'}</span></span>
              <span className={cls('m-switch', !muted && 'on')}><span /></span>
            </button>
            <button className="m-ci-row" onClick={() => toast && toast('Meldinger som forsvinner: av')}><span className="m-ci-ic"><Ic n="clock" s={18} /></span><span className="m-ci-t">Meldinger som forsvinner<span className="m-ci-s">Av</span></span><Ic n="chevRight" s={15} c="var(--muted)" /></button>

            {/* PIN at a specific time */}
            <button className={cls('m-ci-row', pinned && 'active')} onClick={() => setPinExpand(e => !e)}>
              <span className="m-ci-ic"><Ic n="pin" s={18} /></span>
              <span className="m-ci-t">Fest samtale<span className="m-ci-s">{pinned ? 'Festet · ' + (PIN_OPTS.find(o => o[0] === pinned) || [, 'aktiv'])[1] : 'Av'}</span></span>
              <Ic n={pinExpand ? 'chevUp' : 'chevDown'} s={15} c="var(--muted)" />
            </button>
            {pinExpand && (
              <div className="m-ci-pin">
                <div className="m-ci-pin-lbl">Fest øverst i</div>
                <div className="m-ci-pin-opts">
                  {PIN_OPTS.map(([k, l]) => k !== 'egen'
                    ? <button key={k} className={cls('m-ci-pinchip', pinned === k && 'on')} onClick={() => setPin(k, l)}>{l}</button>
                    : null)}
                </div>
                <div className="m-ci-pin-custom">
                  <span className="m-ci-pin-lbl" style={{ margin: 0 }}>Egendefinert</span>
                  <input type="time" value={customTime} onChange={e => setCustomTime(e.target.value)} />
                  <button className="m-ci-pin-set" disabled={!customTime} onClick={() => setPin('egen', 'til ' + customTime)}>Fest</button>
                </div>
                {pinned && <button className="m-ci-pin-unset" onClick={() => setPin(null, '')}>Løsne samtale</button>}
              </div>
            )}

            <button className="m-ci-row" onClick={() => toast && toast('Ende-til-ende-kryptert')}><span className="m-ci-ic"><Ic n="lock" s={18} /></span><span className="m-ci-t">Kryptering<span className="m-ci-s">Ende-til-ende-kryptert. Trykk for å bekrefte.</span></span></button>
          </div>

          <div className="m-ci-group">
            <button className="m-ci-row" onClick={() => toast && toast('Lagt til i favoritter')}><span className="m-ci-ic"><Ic n="heart" s={18} /></span><span className="m-ci-t">Legg til i favoritter</span></button>
            <button className="m-ci-row danger" onClick={() => toast && toast('Chat tømt')}><span className="m-ci-ic"><Ic n="ban" s={18} /></span><span className="m-ci-t">Tøm chat</span></button>
            {!meta.group && <button className="m-ci-row danger" onClick={() => toast && toast(meta.name + ' blokkert')}><span className="m-ci-ic"><Ic n="ban" s={18} /></span><span className="m-ci-t">Blokker {meta.name}</span></button>}
            <button className="m-ci-row danger" onClick={() => toast && toast('Rapport sendt')}><span className="m-ci-ic"><Ic n="thumbsDown" s={18} /></span><span className="m-ci-t">Rapporter {meta.group ? 'gruppe' : first}</span></button>
            <button className="m-ci-row danger" onClick={() => toast && toast(meta.group ? 'Forlot gruppe' : 'Chat slettet')}><span className="m-ci-ic"><Ic n="trash" s={18} /></span><span className="m-ci-t">{meta.group ? 'Forlat gruppe' : 'Slett chat'}</span></button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // MConversation — rich conversation view (header → info, attach menu, cards)
  // ---------------------------------------------------------------------------
  function MConversation({ conv, thread, onAppend, onBack, pinned, setPinned, muted, setMuted }) {
    const { toast, openOverlay } = window.useM();
    const openProfile = (id) => openOverlay && openOverlay('profile', { id });
    const meta = mConvMeta(conv);
    const [draft, setDraft] = useState('');
    const [attachOpen, setAttachOpen] = useState(false);
    const [infoOpen, setInfoOpen] = useState(false);
    const bodyRef = useRef(null);
    const msgs = thread || [];
    useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [msgs.length, infoOpen]);

    const send = () => { const t = draft.trim(); if (!t) return; onAppend({ from: 'me', text: t, time: 'nå' }); setDraft(''); };
    const attach = (label, isMedia) => {
      setAttachOpen(false);
      const card = (D().CHAT_CARD_SAMPLES || {})[label] || { type: 'generic', title: label };
      onAppend({ from: 'me', card, time: 'nå' });
      toast(isMedia ? `${label} sendt` : `${label} delt i samtalen`);
    };
    const ATTACH = D().CHAT_ATTACH_MENU || [];

    if (infoOpen) {
      return (
        <div className="m-chat-screen">
          <MChatInfo conv={conv} meta={meta} onBack={() => setInfoOpen(false)} pinned={pinned} setPinned={setPinned} muted={muted} setMuted={setMuted} toast={toast} openProfile={openProfile} />
        </div>
      );
    }

    return (
      <div className="m-chat-screen">
        {/* header */}
        <div className="m-chat-head">
          <button className="m-iconbtn" onClick={onBack} aria-label="Tilbake"><Ic n="chevLeft" s={22} /></button>
          <button className="m-chat-head-id" onClick={() => meta.group ? setInfoOpen(true) : openProfile(conv.uid)}>
            <span className={cls('m-avatar', meta.group && 'group')} style={{ width: 36, height: 36, fontSize: 12, background: meta.color, flex: '0 0 auto', position: 'relative' }}>
              {meta.group ? <Ic n="users" s={16} c="#fff" /> : meta.init}
              {conv.online && <span className="m-shift-live" style={{ position: 'absolute', bottom: -1, right: -1, width: 9, height: 9, boxShadow: '0 0 0 2px var(--bg)' }} />}
            </span>
            <span className="m-chat-head-meta">
              <span className="m-chat-head-name">{meta.name}{pinned && <span className="m-chat-pindot"><Ic n="pin" s={11} /></span>}</span>
              <span className="m-chat-head-sub">{meta.group ? meta.sub : (conv.online ? <span className="on">aktiv nå</span> : 'sist sett nylig')}</span>
            </span>
          </button>
          <button className="m-iconbtn" onClick={() => toast('Ringer ' + meta.name.split(' ')[0] + '…')}><Ic n="phone" s={19} c="var(--orange)" sw={1.7} /></button>
          <button className="m-iconbtn" onClick={() => setInfoOpen(true)} aria-label="Innstillinger og info"><Ic n="settings" s={19} sw={1.7} /></button>
        </div>

        {/* messages */}
        <div ref={bodyRef} className="m-chat-log">
          <div className="m-chat-daydiv">I dag</div>
          {msgs.length === 0 && <div className="m-chat-empty">Ny samtale — skriv den første meldingen.</div>}
          {msgs.map((m, i) => {
            const me = m.from === 'me';
            const showName = meta.group && !me && (i === 0 || msgs[i - 1].from !== m.from);
            return (
              <div key={i} className={cls('m-chat-m', me ? 'me' : 'them')}>
                {showName && <span className="m-chat-sender" style={{ color: (D().USERS[m.from] || {}).color || 'var(--muted)' }}>{senderName(m.from)}</span>}
                {m.card ? <MChatCard d={m.card} /> : <div className={cls('m-msg', me ? 'm-msg-me' : 'm-msg-bot')}>{m.text}</div>}
                <span className="m-chat-time">{m.time}{me && <Ic n="check" s={11} c="var(--info)" sw={2.6} />}</span>
              </div>
            );
          })}
        </div>

        {/* composer + attach menu */}
        <div className="m-chat-foot">
          {attachOpen && <div className="m-chat-am-scrim" onClick={() => setAttachOpen(false)} />}
          {attachOpen && (
            <div className="m-chat-attachmenu">
              <div className="m-chat-am-grid">
                {ATTACH.map(([ic, l, media]) => (
                  <button key={l} className="m-chat-am-item" onClick={() => attach(l, !!media)}>
                    <span className="ic"><Ic n={ic} s={19} /></span>
                    <span className="lbl">{l}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="m-chat-inputbar">
            <button className={cls('m-iconbtn', attachOpen && 'on')} onClick={() => setAttachOpen(o => !o)} aria-label="Legg ved"><Ic n="plus" s={22} /></button>
            <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Melding…" className="m-chat-input" />
            <button className="m-iconbtn m-chat-send" style={{ background: draft.trim() ? 'var(--orange)' : 'var(--secondary)', color: draft.trim() ? '#fff' : 'var(--muted)' }} onClick={send} aria-label="Send"><Ic n="send" s={18} /></button>
          </div>
        </div>
      </div>
    );
  }

  Object.assign(window, { MChatCard, MChatInfo, MConversation, mConvMeta });
})();
