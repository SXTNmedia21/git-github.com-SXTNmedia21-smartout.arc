// =============================================================================
// Smartout Mobile — HJEM / MIN DAG  (window.SO_M_PAGES.hjem)
// Action-first home. Privat (employee) view + lighter Admin (manager) brief.
// =============================================================================
(function () {
  const { useState } = React;
  const D = window.SmartoutData;
  const { cls } = window.M;

  // ---- local shift mock (data.js has no shift times) — Bistro Nord, consistent cast
  const SHIFT = { onShift: true, role: 'Servitør · Sal', start: '14:00', end: '22:00', now: '13:42', startsIn: '18 min', loc: 'Bistro Nord' };

  function greeting() {
    const h = new Date().getHours();
    if (h < 5) return 'God natt';
    if (h < 11) return 'God morgen';
    if (h < 17) return 'Hei';
    return 'God kveld';
  }

  // ---- small progress ring ----
  function Ring({ pct, size = 46, sw = 5, color = 'var(--orange)' }) {
    const r = (size - sw) / 2, c = 2 * Math.PI * r;
    return (
      <span className="m-ring-wrap" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={sw} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw}
            strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset 600ms' }} />
        </svg>
        <span className="m-ring-label" style={{ fontSize: size * 0.26, color }}>{Math.round(pct * 100)}<span style={{ fontSize: '0.7em' }}>%</span></span>
      </span>
    );
  }

  const PRI = {
    critical: { cls: 'm-pill-crit', label: 'Kritisk' },
    high: { cls: 'm-pill-warn', label: 'Høy' },
    normal: { cls: 'm-pill-muted', label: 'Normal' },
    low: { cls: 'm-pill-muted', label: 'Lav' },
  };

  // ---- a single actionable task row ----
  function TaskRow({ t, done, onToggle, onOpen }) {
    const overdue = t.status === 'overdue';
    return (
      <div className="m-task">
        <button className={cls('m-task-check', done && 'is-done')} onClick={onToggle} aria-label="Marker ferdig">
          <window.MIc n="check" s={15} sw={3} />
        </button>
        <div className="m-task-body" onClick={onOpen}>
          <div className={cls('m-task-title', done && 'is-done')}>{t.title}</div>
          <div className="m-task-meta">
            <span className={cls('m-pill', overdue ? 'm-pill-crit' : PRI[t.priority].cls, 'm-pill-time')}>
              <window.MIc n="clock" s={11} /> {overdue ? t.deadlineRel : t.deadline}
            </span>
            {t.location && <><span className="m-dotsep" style={{ width: 3, height: 3, borderRadius: 9, background: 'var(--muted-soft)' }} /><span>{t.location}</span></>}
          </div>
        </div>
        <button className="m-task-go" onClick={onOpen}><window.MIc n="chevRight" s={18} /></button>
      </div>
    );
  }

  // ---- quick action chip ----
  function Quick({ icon, label, badge, onClick }) {
    return (
      <button className="m-quick-item" onClick={onClick} style={{ position: 'relative' }}>
        {badge ? <span className="m-q-badge">{badge}</span> : null}
        <span className="m-quick-ic"><window.MIc n={icon} s={20} /></span>
        <span>{label}</span>
      </button>
    );
  }

  // ---- main navigation action bar (mirrors web/repo ActionBar) ----
  function ActionBar({ navigate, remaining }) {
    const items = [
      { id: 'oppgaver', icon: 'checklist', label: 'Oppgaver', badge: remaining || null },
      { id: 'trening', icon: 'cap', label: 'Opplæring', badge: 1 },
      { id: 'sikkerhet', icon: 'shield', label: 'Sikkerhet', dot: true },
      { id: 'lonn', icon: 'wallet', label: 'Lønn' },
    ];
    return (
      <div className="m-actionbar">
        {items.map(it => (
          <button key={it.id} className="m-ab-item" onClick={() => navigate(it.id)}>
            <span className="m-ab-ic">
              <window.MIc n={it.icon} s={21} />
              {it.badge ? <span className="m-ab-badge">{it.badge}</span> : it.dot ? <span className="m-ab-dot" /> : null}
            </span>
            <span>{it.label}</span>
          </button>
        ))}
      </div>
    );
  }

  // =========================================================================
  function Hjem() {
    const { ME, mode, navigate, toast, openBotsson, openOverlay } = window.useM();
    const isAdmin = mode === 'admin';

    // Maria's own tasks for privat; everyone's for the admin brief count
    const myTasks = D.TASKS.filter(t => t.assignee === 'ma' && t.status !== 'done');
    const ordered = [...myTasks].sort((a, b) => (a.status === 'overdue' ? -1 : 0) - (b.status === 'overdue' ? -1 : 0));
    const [doneIds, setDoneIds] = useState({});
    const [openTask, setOpenTask] = useState(null);
    const toggle = (t) => {
      const wasDone = !!doneIds[t.id];
      setDoneIds(s => ({ ...s, [t.id]: !wasDone }));
      if (!wasDone) toast(`«${t.title}» markert ferdig`, { undo: () => setDoneIds(s => ({ ...s, [t.id]: false })) });
    };
    const remaining = ordered.filter(t => !doneIds[t.id]).length;
    const total = ordered.length;
    const pct = total ? (total - remaining) / total : 1;

    const firstName = ME.name.split(' ')[0];

    return (
      <div className="m-page">

        {/* greeting */}
        <div className="m-hero">
          <h1>{greeting()}, {firstName}.</h1>
          <div className="m-hero-sub">
            <span>Fredag 30. mai</span>
            <span className="m-dotsep" />
            {isAdmin
              ? <span>Du leder Bistro Nord i dag</span>
              : <span>Vakt {SHIFT.start}–{SHIFT.end}</span>}
          </div>
        </div>

        {isAdmin ? <AdminBody navigate={navigate} toast={toast} openBotsson={openBotsson} openOverlay={openOverlay} /> : (
          <>
            {/* on-shift hero */}
            <div className={cls('m-shift', SHIFT.onShift && 'is-onshift')}>
              <div className="m-shift-top">
                <span className="m-shift-status">
                  <span className="m-shift-live" /> Vakt starter snart
                </span>
                <span className="m-shift-role">{SHIFT.role}</span>
              </div>
              <div className="m-shift-time">{SHIFT.start}<span style={{ fontSize: 18, opacity: .7 }}> – {SHIFT.end}</span></div>
              <div className="m-shift-meta">
                <span><window.MIc n="clock" s={13} style={{ verticalAlign: -2 }} /> Starter om {SHIFT.startsIn}</span>
                <span className="m-dotsep" style={{ background: 'rgba(255,255,255,.4)' }} />
                <span><window.MIc n="mappin" s={13} style={{ verticalAlign: -2 }} /> {SHIFT.loc}</span>
              </div>
              <div className="m-shift-actions">
                <button className="m-btn m-btn-light m-solid m-full" onClick={() => openOverlay('punch', { role: SHIFT.role, start: SHIFT.start, end: SHIFT.end, loc: SHIFT.loc })}>
                  <window.MIc n="clock" s={17} /> Stemple inn
                </button>
                <button className="m-btn m-btn-light" onClick={() => openOverlay('vakt', { dayIndex: 4 })}>Se vakt</button>
              </div>
            </div>

            {/* main navigation */}
            <ActionBar navigate={navigate} remaining={remaining} />

            {/* Håndbøker entry — warm invitation into the library + AI onboarding */}
            <button className="m-card" style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left' }} onClick={() => navigate('handbok')}>
              <span style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--orange-soft)', color: 'var(--orange)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><window.MIc n="bookOpen" s={21} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 650 }}>Håndbøker</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>AI-guidet · alt du trenger for å lykkes hos oss</div>
              </div>
              <span className="m-pill m-pill-info" style={{ flex: '0 0 auto' }}><window.MIc n="bot" s={11} /> 10 min</span>
              <window.MIc n="chevRight" s={18} c="var(--muted-soft)" />
            </button>

            {/* Botsson brief */}
            <BotBrief openBotsson={openBotsson} navigate={navigate} toast={toast} isAdmin={false} />

            {/* Mine oppgaver i dag */}
            <div>
              <div className="m-sec-h">
                <h2>Mine oppgaver i dag</h2>
                <button className="m-sec-link" onClick={() => navigate('oppgaver')}>Se alle <window.MIc n="chevRight" s={13} /></button>
              </div>
              <div className="m-card m-flush" style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderBottom: '1px solid var(--border)' }}>
                  <Ring pct={pct} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 650 }}>{remaining > 0 ? `${remaining} igjen i dag` : 'Alt fullført 🎉'}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{total - remaining} av {total} fullført</div>
                  </div>
                  {remaining > 0 && <span className="m-pill m-pill-crit"><span className="m-pill-dot" />{ordered.filter(t => t.status === 'overdue' && !doneIds[t.id]).length} haster</span>}
                </div>
                <div className="m-tasklist">
                  {ordered.map(t => (
                    <TaskRow key={t.id} t={t} done={!!doneIds[t.id]} onToggle={() => toggle(t)} onOpen={() => setOpenTask(t)} />
                  ))}
                </div>
              </div>
            </div>

            {/* Siste nytt */}
            <div>
              <div className="m-sec-h"><h2>Siste nytt</h2><button className="m-sec-link" onClick={() => navigate('chat', 'kunngjoringer')}>Alle <window.MIc n="chevRight" s={13} /></button></div>
              <div className="m-card m-flush" style={{ marginTop: 10 }}>
                <button className="m-row" style={{ width: '100%' }} onClick={() => navigate('chat', 'kunngjoringer')}>
                  <span className="m-row-ic" style={{ background: 'color-mix(in oklab, var(--info) 14%, transparent)', color: 'var(--info)' }}><window.MIc n="pin" s={17} /></span>
                  <div className="m-row-body">
                    <div className="m-row-title">Stort selskap i kveld</div>
                    <div className="m-row-sub">Bord 8–12 reservert · 30 pers fra kl. 19</div>
                  </div>
                  <span className="m-pill m-pill-info" style={{ flex: '0 0 auto' }}>Ulest</span>
                </button>
                <button className="m-row" style={{ width: '100%' }} onClick={() => openOverlay('announcement', { id: 'lars' })}>
                  <span className="m-row-ic" style={{ background: 'color-mix(in oklab, var(--orange) 14%, transparent)', color: 'var(--orange)' }}><window.MIc n="heart" s={17} /></span>
                  <div className="m-row-body">
                    <div className="m-row-title">Lars fyller år i dag 🎂</div>
                    <div className="m-row-sub">Si gratulerer når du ser ham</div>
                  </div>
                  <span className="m-row-go"><window.MIc n="chevRight" s={18} /></span>
                </button>
              </div>
            </div>
          </>
        )}
        {openTask && <window.MTaskSheet task={openTask} onClose={() => setOpenTask(null)} />}
      </div>
    );
  }

  // ---- Botsson morning brief card ----
  function BotBrief({ openBotsson, navigate, toast, isAdmin }) {
    const [open, setOpen] = useState(false);
    return (
      <div className="m-bot">
        <div className="m-bot-h">
          <span className="m-bot-ava"><window.MIc n="bot" s={16} /></span>
          <b>Morgenbrief</b>
          <span className="m-bot-tag">Botsson</span>
        </div>
        <div className="m-bot-body">
          {isAdmin
            ? <>Roligere lunsj enn vanlig, men <b>stort selskap kl. 19</b> (30 pers). Sal er <b>1 person under</b> anbefalt bemanning 18–22. To oppgaver er forsinket på kjøkkenet.</>
            : <>Du har <b>2 oppgaver som haster</b> før vakta — temperaturkontroll er 32 min forsinket. I kveld kommer et stort selskap, så det blir travelt fra 19.</>}
        </div>
        <div className="m-bot-actions">
          {isAdmin
            ? <button className="m-btn m-btn-primary m-sm" onClick={openBotsson}>Foreslå løsning</button>
            : <button className="m-btn m-btn-primary m-sm" onClick={() => navigate('oppgaver')}>Vis oppgavene</button>}
          <button className="m-bot-why" onClick={() => setOpen(o => !o)}>
            <window.MIc n="sparkle" s={13} c="var(--orange)" /> Hvorfor? <window.MIc n="chevDown" s={12} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 180ms' }} />
          </button>
        </div>
        {open && (
          <div className="m-bot-src">
            <div className="m-src-row"><window.MIc n="thermometer" s={12} c="var(--muted)" /> IK-mat · temperaturlogg 08:00</div>
            <div className="m-src-row"><window.MIc n="calendar" s={12} c="var(--muted)" /> Booking · 30 pers kl. 19:00</div>
            <div className="m-src-row"><window.MIc n="users" s={12} c="var(--muted)" /> Vaktplan · bemanning 18–22</div>
          </div>
        )}
      </div>
    );
  }

  // ---- Admin (manager) brief body ----
  function AdminBody({ navigate, toast, openBotsson, openOverlay }) {
    const stats = [
      { l: 'Omsetning', v: '38 200', s: '+8% vs normalt', tone: 'ok' },
      { l: 'Bemanning', v: '11/12', s: '1 under kl. 18', tone: 'warn' },
      { l: 'Oppgaver', v: '6/14', s: '2 forsinket', tone: 'err' },
    ];
    return (
      <>
        {/* pulse strip */}
        <div className="m-card">
          <div className="m-stats">
            {stats.map(s => (
              <div className="m-stat" key={s.l}>
                <div className="m-stat-l">{s.l}</div>
                <div className="m-stat-v" style={{ color: s.tone === 'err' ? 'var(--error)' : s.tone === 'warn' ? 'var(--warning)' : s.tone === 'ok' ? 'var(--success)' : 'var(--fg)' }}>{s.v}</div>
                <div className="m-stat-s">{s.s}</div>
              </div>
            ))}
          </div>
        </div>

        <BotBrief openBotsson={openBotsson} toast={toast} isAdmin />

        {/* krever handling */}
        <div>
          <div className="m-sec-h"><h2>Krever handling nå</h2></div>
          <div className="m-card m-flush" style={{ marginTop: 10 }}>
            <button className="m-row" style={{ width: '100%' }} onClick={() => navigate('vakter')}>
              <span className="m-row-ic" style={{ background: 'color-mix(in oklab, var(--warning) 14%, transparent)', color: 'var(--warning)' }}><window.MIc n="users" s={17} /></span>
              <div className="m-row-body"><div className="m-row-title">Sal mangler 1 person 18–22</div><div className="m-row-sub">Botsson foreslår å spørre Petter K.</div></div>
              <span className="m-row-go"><window.MIc n="chevRight" s={18} /></span>
            </button>
            <button className="m-row" style={{ width: '100%' }} onClick={() => navigate('oppgaver')}>
              <span className="m-row-ic" style={{ background: 'color-mix(in oklab, var(--error) 12%, transparent)', color: 'var(--error)' }}><window.MIc n="thermometer" s={17} /></span>
              <div className="m-row-body"><div className="m-row-title">Temperaturkontroll forsinket</div><div className="m-row-sub">32 min over frist · Kjøkken sone A</div></div>
              <span className="m-pill m-pill-crit" style={{ flex: '0 0 auto' }}>Kritisk</span>
            </button>
            <button className="m-row" style={{ width: '100%' }} onClick={() => navigate('sikkerhet')}>
              <span className="m-row-ic" style={{ background: 'color-mix(in oklab, var(--error) 12%, transparent)', color: 'var(--error)' }}><window.MIc n="alert" s={17} /></span>
              <div className="m-row-body"><div className="m-row-title">Avvik #214 venter</div><div className="m-row-sub">Løs pakning Kjøl 3 · frist 12:00</div></div>
              <span className="m-row-go"><window.MIc n="chevRight" s={18} /></span>
            </button>
          </div>
        </div>

        {/* quick actions admin */}
        <div className="m-quick">
          <Quick icon="calendar" label="Vaktplan" onClick={() => navigate('vakter')} />
          <Quick icon="checklist" label="Oppgaver" badge={2} onClick={() => navigate('oppgaver')} />
          <Quick icon="swap" label="Avstemming" onClick={() => toast('Åpner avstemming')} />
          <Quick icon="trendUp" label="Rapporter" onClick={() => toast('Åpner rapporter')} />
        </div>

        {/* bemanning nå */}
        <div>
          <div className="m-sec-h"><h2>På vakt nå</h2><button className="m-sec-link" onClick={() => navigate('vakter')}>Vaktplan <window.MIc n="chevRight" s={13} /></button></div>
          <div className="m-card" style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {Object.values(D.USERS).filter(u => u.id !== 'bot' && u.id !== 'ma').map(u => (
              <button key={u.id} className="m-prof-tap" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, width: 56 }} onClick={() => openOverlay('profile', { id: u.id })}>
                <span className="m-avatar" style={{ background: u.color, width: 38, height: 38, fontSize: 13, position: 'relative' }}>
                  {u.initials}
                  <span className="m-shift-live" style={{ position: 'absolute', bottom: 0, right: -1, width: 9, height: 9, boxShadow: '0 0 0 2px var(--card)' }} />
                </span>
                <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, textAlign: 'center', lineHeight: 1.1 }}>{u.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>
      </>
    );
  }

  window.SO_M_PAGES = Object.assign(window.SO_M_PAGES || {}, { hjem: Hjem });
})();
