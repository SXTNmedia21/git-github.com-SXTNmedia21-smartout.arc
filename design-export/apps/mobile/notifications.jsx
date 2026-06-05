// =============================================================================
// Smartout Mobile — NOTIFICATIONS
// Lock-screen + in-app banners + "springende" attention nuggets, plus a Tweaks
// control board to pop any of them on demand.
//   window.MNotifLayer  — the live layer (lock screen / banners / springers).
//                          Render INSIDE .m-app (it consumes useM()).
//   window.MNotifBoard  — the Tweaks control panel (toolbar → Tweaks to open).
// Loaded after pages.jsx + tweaks-panel.jsx, before boot.
// Built on the shared tokens (notifications.css). Cast/world = Bistro Nord.
// =============================================================================
(function () {
  const { useState, useEffect, useRef, useCallback } = React;
  const Ic = window.MIc;
  const D = window.SmartoutData;
  const cls = (...xs) => xs.filter(Boolean).join(' ');
  const uid = () => Math.random().toString(36).slice(2);

  // ---- tiny shared store (lock state) + command bus, shared by layer + board ----
  const store = {
    locked: false,
    subs: new Set(),
    set(patch) { Object.assign(this, patch); this.subs.forEach((f) => f()); },
    sub(f) { this.subs.add(f); return () => this.subs.delete(f); },
  };
  const bus = {
    subs: new Set(),
    on(f) { this.subs.add(f); return () => this.subs.delete(f); },
    emit(a) { this.subs.forEach((f) => f(a)); },
  };
  function useLocked() {
    const [, force] = useState(0);
    useEffect(() => store.sub(() => force((x) => x + 1)), []);
    return store.locked;
  }

  // ---------------- content (grounded in Bistro Nord) ----------------
  // app: small eyebrow label · user: avatar from D.USERS · icon/bg: tile
  // go: { tab, intent } deep-link consumed on tap
  const N_SAMPLES = {
    msg: {
      app: 'Meldinger', user: 'sl', title: 'Selma L.', time: 'nå',
      body: 'Kan du ta lørdagsvakten min? 🙏 Jeg skylder deg en stor tjeneste.',
      go: { tab: 'chat', intent: { open: 'sl' } },
    },
    group: {
      app: 'Sal-teamet', icon: 'users', bg: '#864ad2', title: 'Sal-teamet · 2 nye', time: 'nå',
      body: 'Petter K.: Husk ekstra dekking på bord 12 til selskapet i kveld 🙌',
      go: { tab: 'chat', intent: { open: 'alle' } },
    },
    quiz: {
      app: 'Opplæring', icon: 'cap', bg: 'var(--orange)', title: 'Ny kunnskapstest klar', time: 'nå',
      body: 'Allergenhåndtering · 5 spørsmål · bestå 80%. Frist før neste vakt.',
      go: { tab: 'trening', intent: { quiz: 'c-allergen' } },
    },
    announce: {
      app: 'Kunngjøring', icon: 'pin', bg: '#c2410c', title: 'Bistro Nord', time: '2 min',
      body: 'Stort selskap i kveld 🎉 — 40 gjester kl. 19:00. Ekstra dekking i Sal.',
      go: { tab: 'chat', intent: 'kunngjoringer' },
    },
    avvik: {
      app: 'HMS · Avvik', icon: 'alert', bg: 'var(--error)', title: 'Nytt avvik #214', time: 'nå',
      body: 'Løs pakning på Kjøl 3 meldt av Jonas. Krever oppfølging — frist 12:00.',
      go: { tab: 'sikkerhet' },
    },
    shift: {
      app: 'Vakt', icon: 'clock', bg: 'var(--orange-dark)', title: 'Vakta starter snart', time: 'nå',
      body: 'Servitør · Sal 14:00–22:00 starter om 30 min. Husk å stemple inn.',
      go: { tab: 'vakter' },
    },
    botsson: {
      app: 'Mr. Botsson', icon: 'bot', bg: '#0F172A', title: '2 oppgaver haster', time: 'nå',
      body: 'Temperaturkontroll er 32 min forsinket. Vil du at jeg åpner den for deg?',
      go: { tab: 'oppgaver' },
    },
    lonn: {
      app: 'Lønn', icon: 'wallet', bg: 'var(--success)', title: 'Lønnsslipp klar', time: '1 t',
      body: 'Lønn for mai er beregnet og tilgjengelig. Estimert utbetaling 15. juni.',
      go: { tab: 'lonn' },
    },
  };

  const SPR_SAMPLES = {
    quiz: {
      tone: 'orange', icon: 'cap', eyebrow: 'Ny quiz', title: 'Allergenhåndtering',
      sub: '5 spørsmål · ca. 2 min', cta: 'Ta testen', go: { tab: 'trening', intent: { quiz: 'c-allergen' } },
    },
    msg: {
      tone: 'success', user: 'sl', eyebrow: 'Ny melding', title: 'Selma L.',
      sub: 'Kan du ta lørdagsvakten?', cta: 'Svar', go: { tab: 'chat', intent: { open: 'sl' } },
    },
    announce: {
      tone: 'info', icon: 'pin', eyebrow: 'Kunngjøring', title: 'Stort selskap i kveld',
      sub: '40 gjester kl. 19:00', cta: 'Les', go: { tab: 'chat', intent: 'kunngjoringer' },
    },
  };

  // ---------------- shared bits ----------------
  function NIcon({ n, cl = 'm-nico' }) {
    if (n.user) {
      const u = D.USERS[n.user] || { color: 'var(--muted)', initials: '?' };
      return <span className={cl} style={{ background: u.color }}>{u.initials}</span>;
    }
    return <span className={cl} style={{ background: n.bg || 'var(--orange)' }}><Ic n={n.icon || 'bell'} s={20} c="#fff" /></span>;
  }

  function useClock() {
    const [t, setT] = useState(() => new Date());
    useEffect(() => { const id = setInterval(() => setT(new Date()), 15000); return () => clearInterval(id); }, []);
    return t;
  }

  // ---------------- in-app banner ----------------
  function Banner({ n, onClose, onOpen }) {
    const [leaving, setLeaving] = useState(false);
    const startRef = useRef(null);
    const close = useCallback(() => { setLeaving(true); setTimeout(onClose, 230); }, [onClose]);
    useEffect(() => { const t = setTimeout(close, 5400); return () => clearTimeout(t); }, [close]);
    return (
      <div className={cls('m-banner', leaving && 'is-leaving')}
        onClick={() => { onOpen(); }}
        onPointerDown={(e) => { startRef.current = e.clientY; }}
        onPointerUp={(e) => { if (startRef.current != null && e.clientY - startRef.current < -26) { startRef.current = null; close(); e.stopPropagation(); } }}>
        <NIcon n={n} />
        <div className="m-banner-body">
          <div className="m-banner-top"><span>{n.app}</span><span className="t">{n.time}</span></div>
          <div className="m-banner-title">{n.title}</div>
          <div className="m-banner-text">{n.body}</div>
        </div>
        <span className="m-banner-grip" />
      </div>
    );
  }

  // ---------------- springende nugget ----------------
  function Springer({ s, onClose, onOpen }) {
    const [leaving, setLeaving] = useState(false);
    const close = useCallback(() => { setLeaving(true); setTimeout(onClose, 230); }, [onClose]);
    useEffect(() => { const t = setTimeout(close, 16000); return () => clearTimeout(t); }, [close]);
    const tone = s.tone || 'orange';
    const icStyle = s.user ? { background: (D.USERS[s.user] || {}).color, color: '#fff', borderRadius: '50%', fontWeight: 700 }
      : tone === 'orange' ? { color: '#fff' }
        : { background: `color-mix(in oklab, var(--${tone}) 15%, transparent)`, color: `var(--${tone})` };
    return (
      <div className={cls('m-spr', 't-' + tone)}>
        <button className="m-spr-x" onClick={close} aria-label="Lukk"><Ic n="x" s={13} /></button>
        {s.user
          ? <span className="m-spr-ic" style={icStyle}>{(D.USERS[s.user] || {}).initials}</span>
          : <span className="m-spr-ic m-spr-ping" style={icStyle}><Ic n={s.icon} s={21} c={tone === 'orange' ? '#fff' : undefined} /></span>}
        <div className="m-spr-body">
          <div className="m-spr-eyebrow">{s.eyebrow}</div>
          <div className="m-spr-title">{s.title}</div>
          <div className="m-spr-sub">{s.sub}</div>
        </div>
        <button className="m-spr-cta" onClick={() => { onOpen(); close(); }}>{s.cta} <Ic n="arrowRight" s={13} /></button>
      </div>
    );
  }

  // ---------------- lock screen ----------------
  function LockScreen({ cards, onUnlock, onCard, onClearCard }) {
    const t = useClock();
    const [dy, setDy] = useState(0);
    const [leaving, setLeaving] = useState(false);
    const startRef = useRef(null);
    const time = t.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
    const date = t.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' });

    const doUnlock = useCallback((target) => { setLeaving(true); setTimeout(() => onUnlock(target), 330); }, [onUnlock]);
    const begin = (e) => { startRef.current = e.clientY; };
    const move = (e) => { if (startRef.current != null) setDy(Math.min(0, e.clientY - startRef.current)); };
    const end = (e) => {
      if (startRef.current == null) return;
      const d = e.clientY - startRef.current; startRef.current = null;
      if (d < -70) doUnlock(); else setDy(0);
    };

    return (
      <div className={cls('m-lock', leaving && 'is-leaving')}
        style={dy ? { transform: `translateY(${dy * 0.6}px)` } : undefined}
        onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerLeave={end}>
        <div className="m-lock-status">
          <span>Bistro Nord</span>
          <span className="sig" aria-hidden="true">
            <span className="m-lock-bars"><i style={{ height: '4px' }} /><i style={{ height: '6px' }} /><i style={{ height: '8px' }} /><i style={{ height: '11px' }} /></span>
            <span style={{ fontWeight: 700, fontSize: 12 }}>5G</span>
            <span className="m-lock-batt"><span /></span>
          </span>
        </div>

        <div className="m-lock-clock">
          <div className="m-lock-lock-ico"><Ic n="lock" s={15} c="rgba(255,255,255,.9)" /></div>
          <div className="m-lock-date">{date}</div>
          <div className="m-lock-time">{time}</div>
        </div>

        <div className="m-lock-notes" onPointerDown={(e) => e.stopPropagation()}>
          {cards.length === 0 ? (
            <div className="m-lock-empty"><Ic n="bell" s={26} c="rgba(255,255,255,.5)" /><span>Ingen varsler</span></div>
          ) : cards.map((n) => (
            <button key={n.id} className="m-locknote" onClick={() => onCard(n)}>
              <NIcon n={n} cl="m-nico lg" />
              <div className="m-locknote-body">
                <div className="m-locknote-top"><span>{n.app}</span><span className="t">{n.time}</span></div>
                <div className="m-locknote-title">{n.title}</div>
                <div className="m-locknote-text">{n.body}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="m-lock-foot">
          <div className="m-lock-tools">
            <span className="m-lock-tool"><Ic n="zap" s={20} /></span>
            <span className="m-lock-tool"><Ic n="camera" s={20} /></span>
          </div>
          <button className="m-lock-hint" onClick={() => doUnlock()}>
            <Ic n="chevUp" s={16} c="rgba(255,255,255,.8)" /> Sveip opp for å åpne
          </button>
          <button className="m-lock-bar" aria-label="Lås opp" onClick={() => doUnlock()} />
        </div>
      </div>
    );
  }

  // ---------------- the live layer ----------------
  function MNotifLayer() {
    const { navigate } = window.useM();
    const locked = useLocked();
    const [banners, setBanners] = useState([]);
    const [springers, setSpringers] = useState([]);
    const [cards, setCards] = useState([]);

    const go = useCallback((n) => { if (n && n.go) navigate(n.go.tab, n.go.intent); }, [navigate]);

    useEffect(() => bus.on((a) => {
      if (a.t === 'toggleLock') { const on = !store.locked; store.set({ locked: on }); if (!on) setCards([]); }
      else if (a.t === 'lock') { store.set({ locked: a.on }); if (!a.on) setCards([]); }
      else if (a.t === 'notify') {
        const base = N_SAMPLES[a.key] || {};
        const n = { id: uid(), ...base, ...(a.notif || {}) };
        if (store.locked) setCards((c) => [n, ...c].slice(0, 8));
        else setBanners((b) => [...b, n].slice(-3));
      } else if (a.t === 'spring') {
        const base = SPR_SAMPLES[a.key]; if (!base) return;
        setSpringers((s) => s.find((x) => x.key === a.key) ? s : [...s, { id: uid(), key: a.key, ...base }]);
      } else if (a.t === 'clearSpr') setSpringers([]);
      else if (a.t === 'clear') { setBanners([]); setSpringers([]); setCards([]); }
    }), []);

    const unlock = useCallback((target) => { store.set({ locked: false }); setCards([]); if (target) go(target); }, [go]);

    return (
      <>
        {springers.length > 0 && (
          <div className="m-spr-wrap">
            {springers.map((s) => (
              <Springer key={s.id} s={s}
                onClose={() => setSpringers((x) => x.filter((y) => y.id !== s.id))}
                onOpen={() => go(s)} />
            ))}
          </div>
        )}
        {banners.length > 0 && (
          <div className="m-banner-wrap">
            {banners.map((n) => (
              <Banner key={n.id} n={n}
                onClose={() => setBanners((b) => b.filter((x) => x.id !== n.id))}
                onOpen={() => { setBanners((b) => b.filter((x) => x.id !== n.id)); go(n); }} />
            ))}
          </div>
        )}
        {locked && <LockScreen cards={cards} onUnlock={unlock} onCard={(n) => unlock(n)} />}
      </>
    );
  }

  // ---------------- the control board (Tweaks panel) ----------------
  const NOTIF_BTNS = [
    ['shift', 'Vakt starter', 'Påminnelse', 'var(--orange-dark)'],
    ['msg', 'Ny melding', 'Selma L.', 'var(--success)'],
    ['group', 'Gruppe-chat', 'Sal-teamet', '#864ad2'],
    ['quiz', 'Ny quiz', 'Allergen', 'var(--orange)'],
    ['announce', 'Kunngjøring', 'Stort selskap', '#c2410c'],
    ['avvik', 'HMS-avvik', '#214 haster', 'var(--error)'],
    ['botsson', 'Botsson-tips', '2 haster', '#0F172A'],
    ['lonn', 'Lønn klar', 'Mai', 'var(--success)'],
  ];
  const SPR_BTNS = [
    ['quiz', 'Quiz-boble', 'Bobler opp', 'var(--orange)'],
    ['msg', 'Meldingsboble', 'Fra Selma', 'var(--success)'],
    ['announce', 'Kunngjørings-puls', 'Selskap', 'var(--info)'],
  ];

  function NBtn({ label, sub, dot, onClick }) {
    return (
      <button className="nb-btn" onClick={onClick}>
        <b><span className="nb-dot" style={{ background: dot }} /> {label}</b>
        <small>{sub}</small>
      </button>
    );
  }

  function MNotifBoard() {
    const Panel = window.TweaksPanel, Section = window.TweakSection;
    if (!Panel) return null;
    const locked = useLocked();
    const { tab } = window.useM();
    const TW = window.SmartoutTweaks;
    const [tw, setTw] = useState(() => (TW ? TW.get() : null));
    useEffect(() => { if (TW) return TW.subscribe(setTw); }, []);
    const onHb = tab === 'handbok' && TW && tw;
    const fire = (a) => bus.emit(a);
    const sendAll = () => ['shift', 'msg', 'quiz', 'announce'].forEach((k, i) => setTimeout(() => fire({ t: 'notify', key: k }), i * 700));
    return (
      <Panel title={onHb ? 'Håndbøker' : 'Varsler'}>
        {onHb && (
          <Section label="Håndbøker">
            <div className="twk-row twk-row-h">
              <div className="twk-lbl"><span>Vis velkomst</span></div>
              <button type="button" className="twk-toggle" data-on={tw.showWelcome ? '1' : '0'} role="switch" aria-checked={!!tw.showWelcome}
                onClick={() => TW.set('showWelcome', !tw.showWelcome)}><i /></button>
            </div>
            <div className="twk-row twk-row-h">
              <div className="twk-lbl"><span>Velkomst-animasjon</span></div>
              <button type="button" className="twk-toggle" data-on={tw.welcomeAnim ? '1' : '0'} role="switch" aria-checked={!!tw.welcomeAnim}
                onClick={() => TW.set('welcomeAnim', !tw.welcomeAnim)}><i /></button>
            </div>
            {window.TweakRadio && <window.TweakRadio label="Botsson-tone" value={tw.aiTone}
              options={[{ value: 'rolig', label: 'Rolig' }, { value: 'energisk', label: 'Energisk' }]}
              onChange={(v) => TW.set('aiTone', v)} />}
            <div className="nb-hint">«Vis velkomst» styrer om velkomstmomentet dukker opp i Håndbøker (skrus av når du har sett det). Tonen styrer Botssons veiledning.</div>
          </Section>
        )}
        <Section label="Låseskjerm">
          <div className="twk-row twk-row-h">
            <div className="twk-lbl"><span>Lås skjermen</span></div>
            <button type="button" className="twk-toggle" data-on={locked ? '1' : '0'} role="switch" aria-checked={locked}
              onClick={() => fire({ t: 'toggleLock' })}><i /></button>
          </div>
          <div className="nb-hint">{locked
            ? 'Skjermen er låst — varsler under lander som kort på låseskjermen. Sveip opp for å åpne.'
            : 'Skjermen er åpen — varsler under lander som banner øverst i appen.'}</div>
        </Section>

        <Section label="Send varsel">
          <div className="nb-grid">
            {NOTIF_BTNS.map(([k, l, s, d]) => (
              <NBtn key={k} label={l} sub={s} dot={d} onClick={() => fire({ t: 'notify', key: k })} />
            ))}
          </div>
          <button type="button" className="twk-btn" onClick={sendAll}>Send en serie (4)</button>
        </Section>

        <Section label="Springende elementer">
          <div className="nb-grid">
            {SPR_BTNS.map(([k, l, s, d]) => (
              <NBtn key={k} label={l} sub={s} dot={d} onClick={() => fire({ t: 'spring', key: k })} />
            ))}
          </div>
          <button type="button" className="twk-btn secondary" onClick={() => fire({ t: 'clearSpr' })}>Fjern bobler</button>
        </Section>

        <Section label="Rydd">
          <button type="button" className="twk-btn secondary" onClick={() => fire({ t: 'clear' })}>Tøm alle varsler</button>
        </Section>
      </Panel>
    );
  }

  window.MNotifLayer = MNotifLayer;
  window.MNotifBoard = MNotifBoard;
  // optional programmatic API
  window.SmartoutNotify = {
    notify: (key, notif) => bus.emit({ t: 'notify', key, notif }),
    spring: (key) => bus.emit({ t: 'spring', key }),
    lock: (on) => bus.emit({ t: 'lock', on }),
    clear: () => bus.emit({ t: 'clear' }),
  };
})();
