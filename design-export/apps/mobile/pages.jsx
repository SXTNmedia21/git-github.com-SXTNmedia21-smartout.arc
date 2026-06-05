// =============================================================================
// Smartout Mobile — satellite pages (lighter): Vakter · Oppgaver · Chat · Mer
// Registers into window.SO_M_PAGES. Rich detail lives in hjem.jsx for now.
// =============================================================================
(function () {
  const { useState, useRef, useEffect } = React;
  const D = window.SmartoutData;
  const Ic = window.MIc;
  const { cls, fmtKr } = window.M;

  const PRI = { critical: 'm-pill-crit', high: 'm-pill-warn', normal: 'm-pill-muted', low: 'm-pill-muted' };
  const ORIGIN = D.ORIGIN || {};
  const taskTag = (t) => t.cat === 'ikmat' ? { label: 'IK-mat', color: 'var(--info)', bg: 'color-mix(in oklab, var(--info) 13%, transparent)' } : ORIGIN[t.origin];

  // ---------- small progress ring ----------
  function MiniRing({ pct, size = 52, sw = 5 }) {
    const r = (size - sw) / 2, c = 2 * Math.PI * r;
    return (
      <span className="m-ring-wrap" style={{ width: size, height: size, flex: '0 0 auto' }}>
        <svg width={size} height={size}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--secondary)" strokeWidth={sw} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--orange)" strokeWidth={sw} strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset 600ms' }} />
        </svg>
        <span className="m-ring-label" style={{ fontSize: size * 0.27, color: 'var(--orange)' }}>{Math.round(pct * 100)}</span>
      </span>
    );
  }

  // ---------- shared compact task row ----------
  function Task({ t, done, onToggle, onOpen }) {
    const overdue = t.status === 'overdue';
    const tag = taskTag(t);
    return (
      <div className={cls('m-task', overdue && 'is-overdue')}>
        <button className={cls('m-task-check', done && 'is-done')} onClick={onToggle}><Ic n="check" s={15} sw={3} /></button>
        <div className="m-task-body" onClick={onOpen}>
          <div className={cls('m-task-title', done && 'is-done')}>{t.title}</div>
          <div className="m-task-meta">
            <span className={cls('m-pill', overdue ? 'm-pill-crit' : PRI[t.priority], 'm-pill-time')}><Ic n="clock" s={11} /> {overdue ? t.deadlineRel : t.deadline}</span>
            {tag && <span className="m-pill" style={{ background: tag.bg, color: tag.color }}>{tag.label}</span>}
            {t.assignee && t.assignee !== 'ma' && <span className="m-task-who">{D.USERS[t.assignee]?.name.split(' ')[0]}</span>}
          </div>
        </div>
        <button className="m-task-go" onClick={onOpen}><Ic n="chevRight" s={18} /></button>
      </div>
    );
  }

  // =========================================================================
  // VAKTER
  // =========================================================================
  const WEEK = [
    { d: 'man', n: 26, shift: null },
    { d: 'tir', n: 27, shift: { s: '08:00', e: '16:00', role: 'Servitør' } },
    { d: 'ons', n: 28, shift: null },
    { d: 'tor', n: 29, shift: { s: '14:00', e: '22:00', role: 'Servitør' } },
    { d: 'fre', n: 30, today: true, shift: { s: '14:00', e: '22:00', role: 'Servitør · Sal' } },
    { d: 'lør', n: 31, shift: { s: '12:00', e: '20:00', role: 'Servitør', swap: true } },
    { d: 'søn', n: 1, shift: null },
  ];
  // shift detail / vaktkort — its OWN FULL-COVER screen (overlay, like punch / chat)
  function VaktScreen({ shift, onClose }) {
    const { toast, openOverlay, session } = window.useM();
    const day = WEEK[shift && shift.dayIndex != null ? shift.dayIndex : 4];
    const [openTask, setOpenTask] = useState(null);
    const sh = day.shift;
    const onShift = day.today && session.clockedIn;
    const inTime = session.inAt ? new Date(session.inAt).toTimeString().slice(0, 5) : null;
    const roster = ['sl', 'jh', 'pk', 'ib'];
    const myTasks = D.TASKS.filter(t => t.assignee === 'ma' && t.status !== 'done').slice(0, 3);
    const dateLbl = ['man', 'tir', 'ons', 'tor', 'fre', 'lør', 'søn'];
    return (
      <div className="m-vakt" role="dialog" aria-label="Vaktkort">
        <div className="m-vakt-head">
          <button className="m-iconbtn" onClick={onClose} aria-label="Lukk"><Ic n="chevDown" s={24} /></button>
          <div className="m-vakt-htitle">Vaktkort</div>
          <span />
        </div>
        <div className="m-vakt-body">
          {!sh ? (
            <div className="m-card"><div className="m-empty" style={{ padding: 28 }}><Ic n="coffee" s={28} /><b>Fri denne dagen</b><p>Ingen planlagt vakt.</p></div></div>
          ) : (<>
            {/* shift hero */}
            <div className={cls('m-shift', day.today && 'is-onshift')}>
              <div className="m-shift-top">
                <span className="m-shift-status">{day.today ? <><span className="m-shift-live" /> I dag</> : 'Kommende vakt'}</span>
                <span className="m-shift-role">{sh.role}</span>
              </div>
              <div className="m-shift-time">{sh.s}<span style={{ fontSize: 18, opacity: .7 }}> – {sh.e}</span></div>
              <div className="m-shift-meta">
                <span><Ic n="calendar" s={13} style={{ verticalAlign: -2 }} /> {dateLbl[(day.n - 1 + 3) % 7]}. {day.n}. mai</span>
                <span className="m-dotsep" style={{ background: 'rgba(255,255,255,.4)' }} />
                <span><Ic n="mappin" s={13} style={{ verticalAlign: -2 }} /> Bistro Nord</span>
              </div>
              <div className="m-shift-actions">
                {day.today ? (
                  onShift
                    ? <button className="m-btn m-btn-light m-solid m-full" onClick={() => openOverlay('punch')}><span className="m-shift-live" /> På vakt · stemplet inn {inTime}</button>
                    : <button className="m-btn m-btn-light m-solid m-full" onClick={() => openOverlay('punch', { role: sh.role, start: sh.s, end: sh.e, loc: 'Bistro Nord' })}><Ic n="clock" s={17} /> Stemple inn</button>
                ) : (
                  <button className="m-btn m-btn-light m-solid m-full" onClick={() => openOverlay('shiftoffer', { mode: 'offer' })}><Ic n="swap" s={16} /> Be om bytte</button>
                )}
                <button className="m-btn m-btn-light" onClick={() => toast('Lagt til i kalender')}><Ic n="calendar" s={16} /></button>
              </div>
            </div>

            {/* key facts */}
            <div className="m-card" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div className="m-cout-row"><span><Ic n="clock" s={14} style={{ verticalAlign: -2 }} /> Lengde</span><b className="mono">8 t · 30 min pause</b></div>
              <div className="m-cout-row"><span><Ic n="users" s={14} style={{ verticalAlign: -2 }} /> Vaktansvarlig</span><b>Maria A.</b></div>
              <div className="m-cout-row"><span><Ic n="wallet" s={14} style={{ verticalAlign: -2 }} /> Estimert lønn</span><b className="mono">{fmtKr(2040)} kr</b></div>
            </div>

            {/* roster */}
            <div>
              <div className="m-sec-h" style={{ marginBottom: 8 }}><h2>På vakt med deg</h2><span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{roster.length}</span></div>
              <div className="m-card" style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                {roster.map(id => { const u = D.USERS[id]; return (
                  <button key={id} className="m-prof-tap" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, width: 54 }} onClick={() => openOverlay('profile', { id })}>
                    <span className="m-avatar" style={{ background: u.color, width: 40, height: 40, fontSize: 14 }}>{u.initials}</span>
                    <span style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600, textAlign: 'center', lineHeight: 1.1 }}>{u.name.split(' ')[0]}</span>
                  </button>
                ); })}
              </div>
            </div>

            {/* tasks on this shift */}
            <div>
              <div className="m-sec-h" style={{ marginBottom: 8 }}><h2>Oppgaver på vakten</h2><span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{myTasks.length}</span></div>
              <div className="m-card m-flush">
                <div className="m-tasklist">
                  {myTasks.map(t => <Task key={t.id} t={t} done={false} onToggle={() => {}} onOpen={() => setOpenTask(t)} />)}
                </div>
              </div>
            </div>

            {/* dagsinfo */}
            <div className="m-bot" style={{ padding: '14px 15px' }}>
              <div className="m-bot-h"><span className="m-bot-ava"><Ic n="bot" s={16} /></span><b>Dagsinfo</b><span className="m-bot-tag">Botsson</span></div>
              <div className="m-bot-body">Det kommer et <b>stort selskap kl. 19</b> (30 pers, bord 8–12). Regn med travelt fra 19 — fokuser borddekking i sal før service.</div>
            </div>
          </>)}
        </div>
        {openTask && window.MTaskSheet && <window.MTaskSheet task={openTask} onClose={() => setOpenTask(null)} />}
      </div>
    );
  }
  window.MVaktScreen = VaktScreen;

  function Vakter() {
    const { navigate, toast, openAdd, openOverlay, session } = window.useM();
    const [sel, setSel] = useState(4);
    const day = WEEK[sel];
    const vInTime = session.inAt ? new Date(session.inAt).toTimeString().slice(0, 5) : null;
    return (
      <div className="m-page">
        <div className="m-hero"><h1>Mine vakter</h1><div className="m-hero-sub"><span>Uke 22 · mai 2026</span></div></div>

        {/* week strip */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }} className="m-scroll">
          {WEEK.map((w, i) => (
            <button key={i} onClick={() => setSel(i)} style={{
              flex: '1 0 46px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '9px 0', borderRadius: 13,
              background: sel === i ? 'var(--orange)' : 'var(--card)',
              border: '1px solid ' + (sel === i ? 'var(--orange)' : 'var(--border)'),
              color: sel === i ? '#fff' : 'var(--fg)',
            }}>
              <span style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '.06em', opacity: .8 }}>{w.d}</span>
              <span className="mono" style={{ fontSize: 17, fontWeight: 700 }}>{w.n}</span>
              <span style={{ width: 5, height: 5, borderRadius: 9, background: w.shift ? (sel === i ? '#fff' : 'var(--orange)') : 'transparent' }} />
            </button>
          ))}
        </div>

        {/* selected day */}
        {day.shift ? (
          <div className={cls('m-shift', day.today && 'is-onshift')} role="button" tabIndex={0} style={{ display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer' }} onClick={() => openOverlay('vakt', { dayIndex: sel })} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openOverlay('vakt', { dayIndex: sel }); } }}>
            <div className="m-shift-top">
              <span className="m-shift-status">{day.today ? <><span className="m-shift-live" /> I dag</> : 'Vakt'}</span>
              <span className="m-shift-role">{day.shift.role}</span>
            </div>
            <div className="m-shift-time">{day.shift.s}<span style={{ fontSize: 18, opacity: .7 }}> – {day.shift.e}</span></div>
            <div className="m-shift-meta"><span><Ic n="mappin" s={13} style={{ verticalAlign: -2 }} /> Bistro Nord</span>{day.shift.swap && <><span className="m-dotsep" style={{ background: 'rgba(255,255,255,.4)' }} /><span>Bytte foreslått</span></>}<span className="m-dotsep" style={{ background: 'rgba(255,255,255,.4)' }} /><span>Trykk for vaktkort</span></div>
            <div className="m-shift-actions">
              {day.today ? (
                session.clockedIn
                  ? <button className="m-btn m-btn-light m-solid m-full" onClick={(e) => { e.stopPropagation(); openOverlay('punch'); }}><span className="m-shift-live" /> På vakt · stemplet inn {vInTime}</button>
                  : <button className="m-btn m-btn-light m-solid m-full" onClick={(e) => { e.stopPropagation(); openOverlay('punch', { role: day.shift.role, start: day.shift.s, end: day.shift.e, loc: 'Bistro Nord' }); }}><Ic n="clock" s={17} /> Stemple inn</button>
              ) : (
                <button className="m-btn m-btn-light m-solid m-full" onClick={(e) => { e.stopPropagation(); openOverlay('shiftoffer', { mode: 'offer' }); }}><Ic n="swap" s={16} /> Be om bytte</button>
              )}
            </div>
          </div>
        ) : (
          <div className="m-card"><div className="m-empty" style={{ padding: 24 }}><Ic n="coffee" s={28} /><b>Fri denne dagen</b><p>Ingen planlagt vakt.</p></div></div>
        )}

        {/* vaktbørs */}
        <div>
          <div className="m-sec-h"><h2>Vaktbørs</h2></div>
          <div className="m-card m-flush" style={{ marginTop: 10 }}>
            <div className="m-row">
              <button className="m-prof-tap" onClick={() => openOverlay('profile', { id: 'sl' })} title="Se Selmas profil" style={{ flex: '0 0 auto', borderRadius: '50%' }}>
                <span className="m-avatar" style={{ background: D.USERS.sl.color }}>SL</span>
              </button>
              <div className="m-row-body"><div className="m-row-title">Selma tilbyr lør 12:00–20:00</div><div className="m-row-sub">Servitør · Sal</div></div>
              <button className="m-btn m-btn-ghost m-sm" onClick={() => openOverlay('claim', { who: 'sl', name: 'Selma L.', title: 'Selma tilbyr lør 12:00–20:00', role: 'Servitør · Sal', time: 'Lør 31. mai · 12:00–20:00' })}>Ta</button>
            </div>
            <button className="m-row" style={{ width: '100%' }} onClick={() => openOverlay('shiftoffer', { mode: 'offer' })}>
              <span className="m-row-ic" style={{ background: 'var(--orange-soft)', color: 'var(--orange)' }}><Ic n="plus" s={17} /></span>
              <div className="m-row-body"><div className="m-row-title">Legg ut eller ønsk en vakt</div><div className="m-row-sub">Tilby en vakt — eller be om å få jobbe</div></div>
              <span className="m-row-go"><Ic n="chevRight" s={18} /></span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // OPPGAVER
  // =========================================================================
  function Oppgaver() {
    const { mode, navigate, toast, openOverlay } = window.useM();
    const [done, setDone] = useState({});
    const [filter, setFilter] = useState('mine');
    const [openTask, setOpenTask] = useState(null);
    const toggle = (t) => {
      const was = !!done[t.id];
      setDone(s => ({ ...s, [t.id]: !was }));
      if (!was) toast(`«${t.title}» ferdig`, { undo: () => setDone(s => ({ ...s, [t.id]: false })) });
    };
    let tasks = D.TASKS.filter(t => t.status !== 'done');
    if (filter === 'mine') tasks = tasks.filter(t => t.assignee === 'ma');
    if (filter === 'haster') tasks = tasks.filter(t => t.priority === 'critical' || t.status === 'overdue');
    const naa = tasks.filter(t => t.status === 'overdue' || t.priority === 'critical');
    const senere = tasks.filter(t => !(t.status === 'overdue' || t.priority === 'critical'));
    const filters = [['mine', 'Mine'], ['haster', 'Haster'], ['alle', 'Alle']];
    const total = tasks.length;
    const remaining = tasks.filter(t => !done[t.id]).length;
    const pct = total ? (total - remaining) / total : 1;
    const hasterN = naa.filter(t => !done[t.id]).length;
    return (
      <div className="m-page">
        <div className="m-hero"><h1>Min dag</h1><div className="m-hero-sub"><span>Fredag 30. mai</span><span className="m-dotsep" /><span>{total} oppgaver</span></div></div>

        {/* daily progress */}
        <div className="m-card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <MiniRing pct={pct} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 650 }}>{remaining > 0 ? `${remaining} oppgaver igjen` : 'Alt fullført 🎉'}</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{total - remaining} av {total} fullført i dag</div>
          </div>
          {hasterN > 0 && <span className="m-pill m-pill-crit" style={{ flex: '0 0 auto' }}><span className="m-pill-dot" /> {hasterN} haster</span>}
        </div>

        {/* segmented filter */}
        <div className="m-seg m-seg-full">
          {filters.map(([id, l]) => <button key={id} className={filter === id ? 'is-active' : ''} onClick={() => setFilter(id)}>{l}</button>)}
        </div>

        {naa.length > 0 && <Group title="Haster nå" tone="crit" tasks={naa} done={done} toggle={toggle} onOpen={setOpenTask} />}
        {senere.length > 0 && <Group title="Senere i dag" tasks={senere} done={done} toggle={toggle} onOpen={setOpenTask} />}
        {tasks.length === 0 && <div className="m-card"><div className="m-empty"><Ic n="check" s={28} /><b>Ingen oppgaver</b><p>Du er à jour. Bra jobba!</p></div></div>}

        <button className="m-btn m-btn-ghost m-btn-block" onClick={() => openOverlay('newtask')}><Ic n="plus" s={17} /> Ny oppgave</button>
        {openTask && <window.MTaskSheet task={openTask} onClose={() => setOpenTask(null)} />}
      </div>
    );
  }
  function Group({ title, tone, tasks, done, toggle, onOpen }) {
    return (
      <div>
        <div className="m-sec-h">
          <h2>{tone === 'crit' && <span className="m-sec-dot" style={{ background: 'var(--error)' }} />}{title}</h2>
          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{tasks.length}</span>
        </div>
        <div className="m-card m-flush" style={{ marginTop: 10 }}>
          <div className="m-tasklist">
            {tasks.map(t => <Task key={t.id} t={t} done={!!done[t.id]} onToggle={() => toggle(t)} onOpen={() => onOpen(t)} />)}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // CHAT
  // =========================================================================
  // Conversation list, threads & roster come from the CENTRALIZED model in
  // shared/data.js (window.SmartoutData) — same source the web ChatPanel uses.
  // The rich conversation view + settings page live in apps/mobile/chat.jsx
  // (window.MConversation / MChatInfo / MChatCard).
  // ---------- Skranke (Helpdesk) — Min kø + sakvisning ----------
  const SK_TONE = { info: 'var(--info)', warning: 'var(--warning)', orange: 'var(--orange)', muted: 'var(--muted)', success: 'var(--success)', error: 'var(--error)' };
  const skPerson = (id) => { const SD = window.SmartoutData; return (SD.KO_PEOPLE_BY_ID && SD.KO_PEOPLE_BY_ID[id]) || (SD.USERS && SD.USERS[id]) || { name: id, initials: String(id || '?').slice(0, 2).toUpperCase(), color: 'var(--muted)' }; };
  function SkPill({ tone, children }) {
    const c = SK_TONE[tone] || 'var(--muted)';
    return <span className="m-pill" style={{ background: `color-mix(in oklab, ${c} 15%, transparent)`, color: c }}>{children}</span>;
  }
  function SkCaseRow({ c, onOpen }) {
    const SD = window.SmartoutData;
    const u = skPerson(c.requester);
    const st = SD.CASE_STATUS[c.status] || {};
    const desk = SD.DESK_BY_ID[c.desk] || {};
    const urgent = c.priority === 'haster' || c.sla === 'forfalt';
    return (
      <button className={cls('m-sk-row', urgent && 'is-urgent')} onClick={() => onOpen(c.id)}>
        <span className="m-avatar" style={{ background: u.color, width: 40, height: 40, fontSize: 14, flex: '0 0 auto' }}>{u.initials}</span>
        <div className="m-sk-main">
          <div className="m-sk-subj">{c.subject}{c.priority === 'haster' && <span className="m-sk-urgent"><Ic n="alert" s={12} /></span>}</div>
          <div className="m-sk-meta">
            <span className="m-sk-desk" style={{ color: desk.color }}>#{desk.slug}</span>
            <span className="m-dotsep" />
            <span>{u.name.split(' ')[0]}</span>
            <span className="m-dotsep" />
            <span className="mono">{c.ageLabel}</span>
          </div>
        </div>
        <div className="m-sk-side">
          {c.sla === 'forfalt' ? <SkPill tone="error">Forfalt</SkPill> : c.sla === 'snart' ? <SkPill tone="warning">Snart</SkPill> : null}
          <SkPill tone={st.tone}>{st.label}</SkPill>
        </div>
      </button>
    );
  }
  function SkSection({ title, dot, cases, onOpen }) {
    return (
      <div>
        <div className="m-sec-h"><h2>{dot && <span className="m-sec-dot" style={{ background: dot }} />}{title}</h2><span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{cases.length}</span></div>
        <div className="m-card m-flush" style={{ marginTop: 10 }}><div className="m-sk-list">{cases.map(c => <SkCaseRow key={c.id} c={c} onOpen={onOpen} />)}</div></div>
      </div>
    );
  }
  function SkrankeKo({ onOpen }) {
    const SD = window.SmartoutData;
    const ME = SD.SK_ME || 'ma';
    const cases = SD.CASES || [];
    const openStates = SD.SK_OPEN_STATES || [];
    const mine = cases.filter(c => c.owner === ME);
    const open = mine.filter(c => openStates.includes(c.status));
    const waiting = open.filter(c => c.status === 'venter_ansvarlig' || c.status === 'gjenapnet');
    const ongoing = open.filter(c => !(c.status === 'venter_ansvarlig' || c.status === 'gjenapnet'));
    const resolved = mine.filter(c => c.status === 'lost').slice(0, 2);
    return (
      <>
        <div className="m-card m-sk-summary">
          <span className="m-sk-sum-ic"><Ic n="lifebuoy" s={20} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 650 }}>Min kø</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{open.length} åpne · {waiting.length} venter på deg</div>
          </div>
          {waiting.length > 0 && <span className="m-pill m-pill-warn" style={{ flex: '0 0 auto' }}><span className="m-pill-dot" /> {waiting.length}</span>}
        </div>
        {waiting.length > 0 && <SkSection title="Venter på deg" dot="var(--warning)" cases={waiting} onOpen={onOpen} />}
        {ongoing.length > 0 && <SkSection title="Pågår" cases={ongoing} onOpen={onOpen} />}
        {resolved.length > 0 && <SkSection title="Løst nylig" cases={resolved} onOpen={onOpen} />}
        {open.length === 0 && <div className="m-card"><div className="m-empty"><Ic n="check" s={28} /><b>Køen er tom</b><p>Ingen saker venter på deg akkurat nå.</p></div></div>}
      </>
    );
  }
  function SkrankeCase({ caseId, onBack }) {
    const SD = window.SmartoutData;
    const { toast } = window.useM();
    const c = (SD.CASES || []).find(x => x.id === caseId);
    const ME = SD.SK_ME || 'ma';
    const [draft, setDraft] = useState('');
    const [extra, setExtra] = useState([]);
    const [status, setStatus] = useState(c ? c.status : 'lost');
    const bodyRef = useRef(null);
    useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [extra.length]);
    if (!c) return null;
    const st = SD.CASE_STATUS[status] || {};
    const desk = SD.DESK_BY_ID[c.desk] || {};
    const requester = skPerson(c.requester);
    const msgs = [...(c.messages || []), ...extra];
    const send = () => { if (!draft.trim()) return; setExtra(e => [...e, { from: ME, body: draft, at: 'nå', self: true }]); setDraft(''); setStatus('venter_ansatt'); };
    const resolve = () => { setStatus('lost'); toast('Sak løst', { undo: () => setStatus(c.status) }); setTimeout(onBack, 450); };
    return (
      <div className="m-skcase">
        <div className="m-skcase-head">
          <button className="m-iconbtn" onClick={onBack} aria-label="Tilbake"><Ic n="chevLeft" s={22} /></button>
          <div className="m-skcase-htitle">
            <div className="m-skcase-subj">{c.subject}</div>
            <div className="m-skcase-sub"><span style={{ color: desk.color, fontWeight: 600 }}>#{desk.slug}</span> · {requester.name}</div>
          </div>
          <SkPill tone={st.tone}>{st.label}</SkPill>
        </div>
        <div className="m-skcase-body" ref={bodyRef}>
          {c.aiSummary && (
            <div className="m-bot" style={{ padding: '13px 14px' }}>
              <div className="m-bot-h"><span className="m-bot-ava"><Ic n="bot" s={15} /></span><b>Botsson oppsummerer</b>{c.aiConfidence ? <span className="m-bot-tag">{Math.round(c.aiConfidence * 100)}%</span> : null}</div>
              <div className="m-bot-body">{c.aiSummary}</div>
              {(c.aiSources || []).length > 0 && <div className="m-skcase-src">{c.aiSources.map((s, i) => <span key={i} className="m-skcase-srcchip"><Ic n="file" s={11} /> {s}</span>)}</div>}
            </div>
          )}
          {msgs.map((m, i) => {
            if (m.from === 'sys' || m.from === 'bot') return <div key={i} className="m-skcase-sys">{m.ai && <Ic n="bot" s={12} />}<span>{m.body}</span><span className="m-skcase-sys-t">{m.at}</span></div>;
            const me = m.self || m.from === ME;
            const u = skPerson(m.from);
            const showName = !me && (i === 0 || msgs[i - 1].from !== m.from);
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: me ? 'flex-end' : 'flex-start', gap: 2 }}>
                {showName && <span style={{ fontSize: 11, fontWeight: 600, color: u.color, marginLeft: 4 }}>{u.name}</span>}
                <div className={cls('m-msg', me ? 'm-msg-me' : 'm-msg-bot')}>{m.body}</div>
                <span style={{ fontSize: 10, color: 'var(--muted-soft)', margin: '0 4px' }}>{m.at}</span>
              </div>
            );
          })}
          {c.aiDraft && status === 'venter_ansvarlig' && extra.length === 0 && (
            <div className="m-skcase-draft">
              <div className="m-skcase-draft-h"><Ic n="bot" s={13} /> Forslag fra Botsson</div>
              <div className="m-skcase-draft-b">{c.aiDraft}</div>
              <button className="m-btn m-btn-ghost m-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setDraft(c.aiDraft)}><Ic n="reply" s={14} /> Bruk forslag</button>
            </div>
          )}
        </div>
        <div className="m-skcase-foot">
          <button className="m-iconbtn" onClick={resolve} aria-label="Marker som løst" title="Marker som løst" style={{ color: 'var(--success)', flex: '0 0 auto' }}><Ic n="checkCircle" s={24} /></button>
          <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Svar til ansatt…" className="m-skcase-input" />
          <button className="m-iconbtn m-skcase-send" style={{ background: draft.trim() ? 'var(--orange)' : 'var(--secondary)', color: draft.trim() ? '#fff' : 'var(--muted)' }} onClick={send} aria-label="Send"><Ic n="send" s={18} /></button>
        </div>
      </div>
    );
  }

  function Chat() {
    const { toast, takeIntent, openOverlay } = window.useM();
    const intent = takeIntent('chat');
    const CONVS = D.CHAT_CONVS || [];
    const [tab, setTab] = useState(() => intent === 'kunngjoringer' ? 'kanaler' : intent === 'skranke' ? 'skranke' : 'meldinger');
    const [openId, setOpenId] = useState(() => (intent && intent.open) ? intent.open : null);
    const [caseId, setCaseId] = useState(null);
    // chat persistence (sent messages survive list↔conversation navigation)
    const [threads, setThreads] = useState(() => ({ ...(D.CHAT_THREADS || {}) }));
    const [unread, setUnread] = useState(() => ({ ...(D.CHAT_UNREAD || {}) }));
    const [pinnedMap, setPinnedMap] = useState({});
    const [mutedMap, setMutedMap] = useState({});

    const openConv = (id) => { setOpenId(id); setUnread(u => { const n = { ...u }; delete n[id]; return n; }); };
    const conv = openId && CONVS.find(c => c.id === openId);
    if (conv) return (
      <window.MConversation
        conv={conv}
        thread={threads[conv.id] || []}
        onAppend={(m) => setThreads(p => ({ ...p, [conv.id]: [...(p[conv.id] || []), m] }))}
        onBack={() => setOpenId(null)}
        pinned={pinnedMap[conv.id] || null}
        setPinned={(v) => setPinnedMap(p => ({ ...p, [conv.id]: typeof v === 'function' ? v(p[conv.id]) : v }))}
        muted={!!mutedMap[conv.id]}
        setMuted={(v) => setMutedMap(p => ({ ...p, [conv.id]: typeof v === 'function' ? v(p[conv.id]) : v }))}
      />
    );
    if (caseId) return <SkrankeCase caseId={caseId} onBack={() => setCaseId(null)} />;

    const cardLabel = (t) => ({ image: 'Bilde', video: 'Video', event: 'Event', booking: 'Booking', task: 'Oppgave', shift: 'Vakt', manual: 'Manual', doc: 'Dokument', quiz: 'Quiz', poll: 'Spørring' }[t] || 'Vedlegg');
    const preview = (last, m) => {
      if (!last) return 'Ingen meldinger ennå';
      const who = last.from === 'me' ? 'Du' : (D.USERS[last.from]?.name || '').split(' ')[0];
      const lead = (m.group || last.from === 'me') ? who + ': ' : '';
      return lead + (last.card ? cardLabel(last.card.type) : last.text);
    };
    // pinned conversations float to the top
    const ordered = [...CONVS].sort((a, b) => (pinnedMap[b.id] ? 1 : 0) - (pinnedMap[a.id] ? 1 : 0));

    return (
      <div className="m-page">
        <div className="m-hero"><h1>Meldinger</h1></div>
        <div className="m-seg m-seg-full">
          {[['meldinger', 'Meldinger'], ['kanaler', 'Kunngjøring'], ['skranke', 'Skranke']].map(([id, l]) => (
            <button key={id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>{l}</button>
          ))}
        </div>
        {tab === 'skranke' ? (
          <SkrankeKo onOpen={setCaseId} />
        ) : tab === 'meldinger' ? (
          <div className="m-card m-flush">
            {ordered.map(c => {
              const m = window.mConvMeta(c); const t = threads[c.id]; const last = t && t.length ? t[t.length - 1] : null; const u = unread[c.id];
              return (
                <button key={c.id} className="m-row" style={{ width: '100%' }} onClick={() => openConv(c.id)}>
                  <span className={cls('m-avatar', m.group && 'group')} style={{ background: m.color, width: 42, height: 42, fontSize: 14, position: 'relative' }}>
                    {m.group ? <Ic n="users" s={18} c="#fff" /> : m.init}
                    {c.online && <span className="m-shift-live" style={{ position: 'absolute', bottom: 0, right: -1, width: 10, height: 10, boxShadow: '0 0 0 2px var(--card)' }} />}
                  </span>
                  <div className="m-row-body">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                      <span className="m-row-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>{m.name}{pinnedMap[c.id] && <Ic n="pin" s={12} c="var(--orange)" />}</span>
                      <span style={{ fontSize: 11, color: u ? 'var(--orange-dark)' : 'var(--muted)', fontWeight: u ? 700 : 400, flex: '0 0 auto' }}>{last ? last.time : ''}</span>
                    </div>
                    <div className="m-row-sub" style={{ color: u ? 'var(--fg)' : 'var(--muted)', fontWeight: u ? 550 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview(last, m)}</div>
                  </div>
                  {u > 0 && <span className="m-tab-badge" style={{ position: 'static', boxShadow: 'none' }}>{u}</span>}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="m-card m-flush">
            <button className="m-row" style={{ width: '100%' }} onClick={() => openOverlay('announcement', { id: 'selskap' })}>
              <span className="m-row-ic" style={{ background: 'color-mix(in oklab, var(--info) 14%, transparent)', color: 'var(--info)' }}><Ic n="pin" s={17} /></span>
              <div className="m-row-body"><div className="m-row-title">Stort selskap i kveld</div><div className="m-row-sub">Drift · for 2 timer siden</div></div>
              <span className="m-pill m-pill-info">Ulest</span>
            </button>
            <button className="m-row" style={{ width: '100%' }} onClick={() => openOverlay('announcement', { id: 'allergen' })}>
              <span className="m-row-ic" style={{ background: 'color-mix(in oklab, var(--success) 13%, transparent)', color: 'var(--success)' }}><Ic n="cap" s={17} /></span>
              <div className="m-row-body"><div className="m-row-title">Ny allergen-rutine publisert</div><div className="m-row-sub">HMS · i går</div></div>
              <span className="m-row-go"><Ic n="chevRight" s={18} /></span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // MER (profile + mode switch + theme + links)
  // =========================================================================
  function Mer() {
    const { ME, mode, setMode, theme, toggleTheme, toast, navigate, openOverlay } = window.useM();
    const canAdmin = true; // Maria A. — Driftsleder
    return (
      <div className="m-page">
        {/* profile header */}
        <div className="m-card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="m-avatar" style={{ background: ME.color, width: 56, height: 56, fontSize: 20 }}>{ME.initials}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 24, lineHeight: 1 }}>{ME.name}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{ME.role} · Bistro Nord</div>
          </div>
          <button className="m-iconbtn" onClick={() => openOverlay('profile', { id: ME.id })}><Ic n="chevRight" s={20} /></button>
        </div>

        {/* mode switch */}
        {canAdmin && (
          <div className="m-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 650 }}>Visning</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{mode === 'admin' ? 'Du ser drift­sledervisningen' : 'Du ser ansattvisningen'}</div>
              </div>
              <div className="m-seg">
                <button className={mode === 'privat' ? 'is-active' : ''} onClick={() => { setMode('privat'); toast('Ansattvisning'); }}>Ansatt</button>
                <button className={mode === 'admin' ? 'is-active' : ''} onClick={() => { setMode('admin'); toast('Driftsledervisning'); }}>Leder</button>
              </div>
            </div>
          </div>
        )}

        {/* quick links */}
        <div className="m-list">
          <button className="m-list-item" onClick={() => navigate('lonn')}>
            <span className="m-list-ic"><Ic n="wallet" s={17} /></span><span className="m-list-t">Min lønn</span>
            <span className="m-list-v">Neste: 12. jun</span><Ic n="chevRight" s={17} c="var(--muted-soft)" />
          </button>
          <button className="m-list-item" onClick={() => navigate('kompetanse')}>
            <span className="m-list-ic"><Ic n="badge" s={17} /></span><span className="m-list-t">Min kompetanse</span><span className="m-list-v">1 fornyes</span><Ic n="chevRight" s={17} c="var(--muted-soft)" />
          </button>
          <button className="m-list-item" onClick={() => navigate('bookinger')}>
            <span className="m-list-ic"><Ic n="calClock" s={17} /></span><span className="m-list-t">Bookings & Event</span><Ic n="chevRight" s={17} c="var(--muted-soft)" />
          </button>
          <button className="m-list-item" onClick={() => navigate('kartotek')}>
            <span className="m-list-ic"><Ic n="alert" s={17} /></span><span className="m-list-t">HMS & avvik</span><span className="m-pill m-pill-warn" style={{ marginRight: 4 }}>3 åpne</span><Ic n="chevRight" s={17} c="var(--muted-soft)" />
          </button>
          <button className="m-list-item" onClick={() => navigate('handbok')}>
            <span className="m-list-ic"><Ic n="bookOpen" s={17} /></span><span className="m-list-t">Håndbøker</span><Ic n="chevRight" s={17} c="var(--muted-soft)" />
          </button>
        </div>

        {/* preferences */}
        <div className="m-list">
          <div className="m-list-item">
            <span className="m-list-ic"><Ic n={theme === 'dark' ? 'moon' : 'sun'} s={17} /></span>
            <span className="m-list-t">Mørk modus</span>
            <button onClick={toggleTheme} style={{
              width: 46, height: 28, borderRadius: 99, padding: 3,
              background: theme === 'dark' ? 'var(--orange)' : 'var(--border-strong)',
              display: 'flex', justifyContent: theme === 'dark' ? 'flex-end' : 'flex-start', transition: 'all 180ms',
            }}><span style={{ width: 22, height: 22, borderRadius: 99, background: '#fff', boxShadow: 'var(--sh-sm)' }} /></button>
          </div>
          <button className="m-list-item" onClick={() => openOverlay('settings')}>
            <span className="m-list-ic"><Ic n="settings" s={17} /></span><span className="m-list-t">Innstillinger</span><Ic n="chevRight" s={17} c="var(--muted-soft)" />
          </button>
          <button className="m-list-item" onClick={() => openOverlay('logout')}>
            <span className="m-list-ic" style={{ color: 'var(--error)' }}><Ic n="logout" s={17} /></span><span className="m-list-t" style={{ color: 'var(--error)' }}>Logg ut</span>
          </button>
        </div>

        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted-soft)', padding: '4px 0 8px' }}>Smartout Mobil · v1 · Bistro Nord</div>
      </div>
    );
  }

  // =========================================================================
  // KALENDER (the calendar surface — week/month, agenda, attention)
  // =========================================================================
  const KAL_WEEK = [
    { d: 'man', n: 26 }, { d: 'tir', n: 27 }, { d: 'ons', n: 28 }, { d: 'tor', n: 29 },
    { d: 'fre', n: 30, today: true }, { d: 'lør', n: 31 }, { d: 'søn', n: 1 },
  ];
  const KAL_DOTS = { 27: ['vakt'], 29: ['vakt', 'opp'], 30: ['vakt', 'opp', 'book'], 31: ['vakt'] };
  const DOT_COLOR = { vakt: 'var(--orange)', opp: 'var(--info)', book: 'var(--dept-bar)' };
  const KAL_AGENDA = [
    { t: '09:30', kind: 'opp', icon: 'thermometer', title: 'Mottakskontroll – Bama', sub: 'Oppgave · Vareleveranse', tone: 'info' },
    { t: '14:00', kind: 'vakt', icon: 'clock', title: 'Vakt · Servitør · Sal', sub: '14:00–22:00 · Bistro Nord', tone: 'orange' },
    { t: '19:00', kind: 'book', icon: 'users', title: 'Stort selskap', sub: 'Booking · 30 personer · Bord 8–12', tone: 'bar' },
    { t: '22:00', kind: 'opp', icon: 'checklist', title: 'Stengerutine', sub: 'Rutine · Sal', tone: 'muted' },
  ];
  const AV = {
    yes: { label: 'Tilgjengelig', icon: 'check', color: 'var(--success)', bg: 'color-mix(in oklab, var(--success) 14%, transparent)' },
    partial: { label: 'Deler av dagen', icon: 'clock', color: 'var(--warning)', bg: 'color-mix(in oklab, var(--warning) 16%, transparent)' },
    no: { label: 'Kan ikke jobbe', icon: 'x', color: 'var(--error)', bg: 'color-mix(in oklab, var(--error) 13%, transparent)' },
  };
  // May 2026 starts on a Thursday (Mon-first → 3 leading blanks), 31 days.
  const MONTH_CELLS = [null, null, null].concat(Array.from({ length: 31 }, (_, i) => i + 1));
  const WD = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];
  const DAY_NAMES = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag', 'søndag'];
  const dayLabel = (n) => { const d = DAY_NAMES[((n - 1) + 3) % 7]; return d.charAt(0).toUpperCase() + d.slice(1) + ' ' + n + '. mai'; };

  // availability registration drawer
  function AvailDrawer({ day, current, onSave, onClose }) {
    const [status, setStatus] = useState(current || 'yes');
    const [span, setSpan] = useState('day'); // 'day' | 'range'
    const dstr = (n) => '2026-05-' + String(n).padStart(2, '0');
    const [dFrom, setDFrom] = useState(dstr(day));
    const [dTo, setDTo] = useState(dstr(Math.min(day + 6, 31)));
    const [from, setFrom] = useState('09:00');
    const [to, setTo] = useState('16:00');
    const [note, setNote] = useState('');
    const fromN = parseInt(dFrom.slice(8), 10);
    const toN = parseInt(dTo.slice(8), 10);
    const inMay = (s) => s.startsWith('2026-05');
    const rangeOk = inMay(dFrom) && inMay(dTo) && toN >= fromN;
    const nDays = span === 'range' ? (rangeOk ? toN - fromN + 1 : 0) : 1;
    const canSave = span === 'day' || (rangeOk && nDays > 0);
    const save = () => { if (!canSave) return; onSave(status, span === 'range' ? { from: fromN, to: toN } : null); };
    return (
      <div className="m-sheet-scrim" onClick={onClose} style={{ zIndex: 47 }}>
        <div className="m-sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '90%' }}>
          <div className="m-sheet-grip" />
          <div className="m-sheet-h"><h3>Tilgjengelighet</h3><button className="m-iconbtn" style={{ marginLeft: 'auto' }} onClick={onClose}><Ic n="x" s={20} /></button></div>
          <div className="m-sheet-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* single day vs. period */}
            <div className="m-field"><span>Gjelder</span>
              <div className="m-seg m-seg-full">
                {[['day', 'Denne dagen'], ['range', 'Periode']].map(([id, l]) => <button key={id} className={span === id ? 'is-active' : ''} onClick={() => setSpan(id)}>{l}</button>)}
              </div>
            </div>
            {span === 'day' ? (
              <div style={{ fontSize: 13, color: 'var(--muted)' }}><Ic n="calendar" s={14} style={{ verticalAlign: -2 }} /> {dayLabel(day)}</div>
            ) : (
              <React.Fragment>
                <div style={{ display: 'flex', gap: 12 }}>
                  <label className="m-field" style={{ flex: 1 }}><span>Fra dato</span><input className="m-input" type="date" min="2026-05-01" max="2026-05-31" value={dFrom} onChange={e => setDFrom(e.target.value)} /></label>
                  <label className="m-field" style={{ flex: 1 }}><span>Til dato</span><input className="m-input" type="date" min="2026-05-01" max="2026-05-31" value={dTo} onChange={e => setDTo(e.target.value)} /></label>
                </div>
                <div style={{ fontSize: 12.5, color: rangeOk ? 'var(--muted)' : 'var(--error)', marginTop: -6 }}>
                  {rangeOk ? <React.Fragment><Ic n="calendar" s={13} style={{ verticalAlign: -2 }} /> {fromN}.–{toN}. mai · {nDays} {nDays === 1 ? 'dag' : 'dager'}</React.Fragment> : 'Velg en gyldig periode i mai (til-dato kan ikke være før fra-dato).'}
                </div>
              </React.Fragment>
            )}
            <div className="m-field"><span>{span === 'range' ? 'Kan du jobbe i perioden?' : 'Kan du jobbe denne dagen?'}</span>
              <div className="m-seg m-seg-full">
                {[['yes', 'Tilgjengelig'], ['partial', 'Delvis'], ['no', 'Kan ikke']].map(([id, l]) => <button key={id} className={status === id ? 'is-active' : ''} onClick={() => setStatus(id)}>{l}</button>)}
              </div>
            </div>
            {/* big status preview */}
            <div className="m-avprev" style={{ background: AV[status].bg, color: AV[status].color }}>
              <Ic n={AV[status].icon} s={20} sw={2.4} /> <b>{AV[status].label}</b>{span === 'range' && rangeOk && <span style={{ opacity: .7, fontWeight: 500, fontSize: 13 }}>· {nDays} {nDays === 1 ? 'dag' : 'dager'}</span>}
            </div>
            {status === 'partial' && (
              <div style={{ display: 'flex', gap: 12 }}>
                <label className="m-field" style={{ flex: 1 }}><span>Fra</span><input className="m-input" type="time" value={from} onChange={e => setFrom(e.target.value)} /></label>
                <label className="m-field" style={{ flex: 1 }}><span>Til</span><input className="m-input" type="time" value={to} onChange={e => setTo(e.target.value)} /></label>
              </div>
            )}
            <label className="m-field"><span>Notat <small style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--muted-soft)' }}>(valgfritt)</small></span><textarea className="m-input" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="F.eks. «Kan ta sene vakter»" /></label>
            <div className="m-bot" style={{ padding: '12px 14px' }}><div className="m-bot-body" style={{ fontSize: 12.5 }}>Leder bruker tilgjengeligheten din når vaktplanen legges. Du kan endre den når som helst.</div></div>
          </div>
          <div style={{ display: 'flex', gap: 8, padding: '10px 16px calc(16px + env(safe-area-inset-bottom,0px))', borderTop: '1px solid var(--border)' }}>
            <button className="m-btn m-btn-ghost" style={{ flex: '0 0 auto' }} onClick={onClose}>Avbryt</button>
            <button className="m-btn m-btn-primary m-full" disabled={!canSave} style={!canSave ? { opacity: .5 } : undefined} onClick={save}><Ic n="check" s={16} /> {span === 'range' && rangeOk ? 'Lagre ' + nDays + ' dager' : 'Lagre'}</button>
          </div>
        </div>
      </div>
    );
  }

  // booking detail sheet (agenda booking cards)
  function BookingSheet({ item, onClose }) {
    const { toast } = window.useM();
    return (
      <div className="m-sheet-scrim" onClick={onClose} style={{ zIndex: 47 }}>
        <div className="m-sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '80%' }}>
          <div className="m-sheet-grip" />
          <div className="m-sheet-h"><h3>Booking</h3><button className="m-iconbtn" style={{ marginLeft: 'auto' }} onClick={onClose}><Ic n="x" s={20} /></button></div>
          <div className="m-sheet-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              <span className="m-pill" style={{ background: 'color-mix(in oklab, var(--dept-bar) 14%, transparent)', color: 'var(--dept-bar)' }}>Booking</span>
              <span className="m-pill m-pill-info">Bekreftet</span>
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 26, lineHeight: 1.1 }}>{item.title}</div>
            <div className="m-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[['clock', 'Tidspunkt', item.t + ' · i kveld'], ['users', 'Antall gjester', '30 personer'], ['mappin', 'Bord', 'Bord 8–12 · Sal'], ['file', 'Anledning', 'Firmamiddag · 3-retters']].map(([ic, l, v]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <span className="m-row-ic" style={{ background: 'var(--secondary)', color: 'var(--muted)', width: 32, height: 32 }}><Ic n={ic} s={16} /></span>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>{l}</div><div style={{ fontSize: 14, fontWeight: 600, marginTop: 1 }}>{v}</div></div>
                </div>
              ))}
            </div>
            <div className="m-bot" style={{ padding: '12px 14px' }}><div className="m-bot-body" style={{ fontSize: 12.5 }}>Stort selskap øker trykket fra 19. Sal er bemannet med 4 — Botsson foreslår å forberede bord 8–12 før service.</div></div>
          </div>
          <div style={{ display: 'flex', gap: 8, padding: '10px 16px calc(16px + env(safe-area-inset-bottom,0px))', borderTop: '1px solid var(--border)' }}>
            <button className="m-btn m-btn-ghost" style={{ flex: '0 0 auto' }} onClick={() => toast('Melder fra til kjøkken')}>Varsle kjøkken</button>
            <button className="m-btn m-btn-primary m-full" onClick={onClose}>OK</button>
          </div>
        </div>
      </div>
    );
  }

  function Kalender() {
    const { navigate, toast, takeIntent } = window.useM();
    const [view, setView] = useState('uke');
    const [selDay, setSelDay] = useState(30);
    const [filter, setFilter] = useState('alt');
    const [avail, setAvail] = useState({ 24: 'no', 25: 'partial', 31: 'no', 1: 'no' });
    const [availDay, setAvailDay] = useState(() => { const it = takeIntent('kalender'); return it && it.avail ? 30 : null; });
    const [kalTask, setKalTask] = useState(null);
    const [kalBook, setKalBook] = useState(null);
    const agendaTask = (a) => ({ id: 'kal-' + a.t, cat: /mottak|temp|kjøl/i.test(a.title) ? 'ikmat' : undefined, title: a.title, description: a.sub, priority: 'normal', status: 'todo', origin: 'session', deadline: a.t, location: 'Bistro Nord', subtasks: [], activity: [] });
    const filters = [['alt', 'Alt'], ['opp', 'Oppgaver'], ['vakt', 'Vakter'], ['book', 'Bookinger']];
    const agenda = (selDay === 30 ? KAL_AGENDA : []).filter(a => filter === 'alt' || a.kind === filter);
    const av = avail[selDay];
    const toneBg = { info: 'color-mix(in oklab, var(--info) 13%, transparent)', orange: 'var(--orange-soft)', bar: 'color-mix(in oklab, var(--dept-bar) 14%, transparent)', muted: 'var(--secondary)' };
    const toneFg = { info: 'var(--info)', orange: 'var(--orange)', bar: 'var(--dept-bar)', muted: 'var(--muted)' };
    return (
      <div className="m-page">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div className="m-hero" style={{ flex: 1 }}><h1 style={{ fontSize: 30 }}>Mai 2026</h1></div>
          <div className="m-seg"><button className={view === 'uke' ? 'is-active' : ''} onClick={() => setView('uke')}>Uke</button><button className={view === 'mnd' ? 'is-active' : ''} onClick={() => setView('mnd')}>Måned</button></div>
        </div>

        {/* week strip OR month grid */}
        {view === 'uke' ? (
          <div style={{ display: 'flex', gap: 6 }}>
            {KAL_WEEK.map((w, i) => {
              const on = selDay === w.n;
              const dots = KAL_DOTS[w.n] || [];
              const wav = avail[w.n];
              return (
                <button key={i} onClick={() => setSelDay(w.n)} style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '9px 0 7px', borderRadius: 13,
                  background: on ? 'var(--orange)' : 'var(--card)', border: '1px solid ' + (on ? 'var(--orange)' : 'var(--border)'), color: on ? '#fff' : w.today ? 'var(--orange)' : 'var(--fg)',
                }}>
                  <span style={{ fontSize: 9.5, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '.06em', opacity: .8 }}>{w.d}</span>
                  <span className="mono" style={{ fontSize: 16, fontWeight: 700 }}>{w.n}</span>
                  <span style={{ display: 'flex', gap: 2, height: 5, alignItems: 'center' }}>
                    {wav && <span style={{ width: 6, height: 6, borderRadius: 9, background: on ? '#fff' : AV[wav].color }} />}
                    {dots.map((dk, j) => <span key={j} style={{ width: 4, height: 4, borderRadius: 9, background: on ? 'rgba(255,255,255,.85)' : DOT_COLOR[dk] }} />)}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="m-mgrid">
            {WD.map(d => <span key={d} className="m-mgrid-wd">{d}</span>)}
            {MONTH_CELLS.map((n, i) => n === null ? <span key={'b' + i} /> : (
              <button key={n} className={cls('m-mcell', selDay === n && 'on', n === 30 && 'today')} onClick={() => setSelDay(n)}>
                <span className="m-mcell-n">{n}</span>
                <span className="m-mcell-dots">
                  {avail[n] && <span className="m-mcell-av" style={{ background: AV[avail[n]].color }} />}
                  {(KAL_DOTS[n] || []).slice(0, 2).map((dk, j) => <span key={j} style={{ width: 4, height: 4, borderRadius: 9, background: DOT_COLOR[dk] }} />)}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* filter chips */}
        <div style={{ display: 'flex', gap: 7, overflowX: 'auto' }}>
          {filters.map(([id, l]) => (
            <button key={id} className={cls('m-pill', filter === id ? 'm-pill-warn' : 'm-pill-muted')} style={{ height: 31, padding: '0 13px', fontSize: 12.5, flex: '0 0 auto', background: filter === id ? 'var(--orange)' : undefined, color: filter === id ? '#fff' : undefined }} onClick={() => setFilter(id)}>{l}</button>
          ))}
        </div>

        {/* day header */}
        <div className="m-sec-h" style={{ marginTop: 2 }}><h2>{dayLabel(selDay)}</h2><span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{agenda.length} {agenda.length === 1 ? 'hendelse' : 'hendelser'}</span></div>

        {/* availability status for the selected day */}
        <button className="m-card" style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left' }} onClick={() => setAvailDay(selDay)}>
          <span className="m-row-ic" style={{ background: av ? AV[av].bg : 'var(--secondary)', color: av ? AV[av].color : 'var(--muted)' }}><Ic n={av ? AV[av].icon : 'calendar'} s={18} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 650 }}>Din tilgjengelighet</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{av ? AV[av].label : 'Ikke registrert ennå'}</div>
          </div>
          <span className="m-pill" style={{ background: av ? AV[av].bg : 'var(--secondary)', color: av ? AV[av].color : 'var(--muted)' }}>{av ? 'Endre' : 'Registrer'}</span>
        </button>

        {/* agenda */}
        {agenda.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: -4 }}>
            {agenda.map((a, i) => (
              <button key={i} className="m-card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 13, textAlign: 'left', width: '100%' }} onClick={() => a.kind === 'vakt' ? navigate('vakter') : a.kind === 'opp' ? setKalTask(agendaTask(a)) : setKalBook(a)}>
                <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', width: 40, flex: '0 0 auto' }}>{a.t}</span>
                <span style={{ width: 3, alignSelf: 'stretch', borderRadius: 3, background: toneFg[a.tone] }} />
                <span style={{ width: 34, height: 34, borderRadius: 10, flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: toneBg[a.tone], color: toneFg[a.tone] }}><Ic n={a.icon} s={17} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600 }}>{a.title}</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{a.sub}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="m-card"><div className="m-empty" style={{ padding: 22 }}><Ic n="calendar" s={26} /><b>Ingen planlagte hendelser</b><p>Registrer gjerne tilgjengeligheten din for dagen.</p></div></div>
        )}

        {availDay != null && <AvailDrawer day={availDay} current={avail[availDay]} onClose={() => setAvailDay(null)} onSave={(s, range) => {
          if (range) {
            setAvail(a => { const next = { ...a }; for (let n = range.from; n <= range.to; n++) next[n] = s; return next; });
            const nd = range.to - range.from + 1;
            toast('Tilgjengelighet lagret · ' + range.from + '.–' + range.to + '. mai (' + nd + ' dager)');
          } else {
            setAvail(a => ({ ...a, [availDay]: s }));
            toast('Tilgjengelighet lagret · ' + dayLabel(availDay));
          }
          setAvailDay(null);
        }} />}
        {kalTask && window.MTaskSheet && <window.MTaskSheet task={kalTask} onClose={() => setKalTask(null)} />}
        {kalBook && <BookingSheet item={kalBook} onClose={() => setKalBook(null)} />}
      </div>
    );
  }

  // =========================================================================
  // CHAT — the rich conversation view (MConversation), the settings/info page
  // (MChatInfo) and attachment cards (MChatCard) now live in apps/mobile/chat.jsx
  // and read the centralized chat model from window.SmartoutData. The Chat()
  // page above consumes them via window.MConversation.

  window.SO_M_PAGES = Object.assign(window.SO_M_PAGES || {}, { kalender: Kalender, vakter: Vakter, oppgaver: Oppgaver, chat: Chat, mer: Mer });
})();
