// =============================================================================
// Smartout Mobile — OPPLÆRING & KOMPETANSE (kartotek)
// The registry counterpart to the OPERATIONAL "Opplæring" (Trening) front screen
// (which shows "din beredskap" + active courses/quizzes to DO now).
// Here you orient yourself — same simple-list pattern as HMS & Avvik:
//   • Sertifiseringer & lisenser  — keep track of validity/renewal (important!)
//   • Kurs & fag                  — progress + history
//   • Score                       — menu-knowledge / quiz scores + history
//   • Kommende                    — renewals & required next
// Registers window.SO_M_PAGES.kompetanse and window.MCertDetail.
// =============================================================================
(function () {
  const { useState, useMemo } = React;
  const Ic = window.MIc;
  const D = window.SmartoutData;
  const cls = (...xs) => xs.filter(Boolean).join(' ');

  // ---------------- registry data (mock, Bistro Nord — Selma) ----------------
  const CERTS = [
    { id: 'c-skjenk', name: 'Ansvarlig vertskap', kind: 'Skjenkekurs · lisens', icon: 'badge', status: 'gyldig', valid: 'Gyldig til mars 2027', issuer: 'VINN / Skjenkekontrollen', issued: '14. mar 2024' },
    { id: 'c-hygiene', name: 'Hygiene & IK-mat', kind: 'Matsikkerhet', icon: 'utensils', status: 'gyldig', valid: 'Gyldig til sep 2026', issuer: 'Mattilsynet-kurs', issued: '3. sep 2024' },
    { id: 'c-brann', name: 'Brannvern', kind: 'HMS · sikkerhet', icon: 'fire', status: 'gyldig', valid: 'Gyldig til jan 2027', issuer: 'Bistro Nord internt', issued: '12. jan 2025' },
    { id: 'c-forstehjelp', name: 'Førstehjelp', kind: 'HMS · beredskap', icon: 'shield', status: 'snart', valid: 'Utløper om 3 uker · 21. jun', issuer: 'Røde Kors', issued: '21. jun 2023' },
    { id: 'c-hms', name: 'HMS for servitører', kind: 'Arbeidsmiljø', icon: 'cap', status: 'utlopt', valid: 'Utløpt 2. mai · fornyes nå', issuer: 'Bistro Nord', issued: '2. mai 2024' },
  ];
  const CERT_ST = { gyldig: ['m-pill-ok', 'Gyldig'], snart: ['m-pill-warn', 'Utløper snart'], utlopt: ['m-pill-crit', 'Utløpt'] };

  const KURS = [
    { id: 'k-allergen', title: 'Allergenhåndtering', status: 'pagaende', pct: 60, src: 'Stilling', at: 'frist 2. jun' },
    { id: 'k-brann', title: 'Brann og evakuering', status: 'bestatt', pct: 100, src: 'Sesong', at: 'mar 2026' },
    { id: 'k-hms', title: 'HMS for servitører', status: 'utlopt', pct: 100, src: 'Avdeling', at: 'fornyes nå' },
    { id: 'k-skjenk', title: 'Ansvarlig vertskap', status: 'ikke', pct: 0, src: 'Bedrift', at: 'ikke startet' },
  ];
  const KURS_ST = { bestatt: ['m-pill-ok', 'Bestått'], pagaende: ['kt-st-arbeid', 'Pågår'], utlopt: ['m-pill-crit', 'Utløpt'], ikke: ['m-pill-muted', 'Ikke startet'] };

  const SCORE = [
    { id: 's-vinter', title: 'Vintermeny — mat', score: 91, status: 'bestatt', at: 'i dag', icon: 'utensils' },
    { id: 's-cocktail', title: 'Cocktailkart', score: 68, status: 'nytest', at: 'i går', icon: 'sparkle' },
    { id: 's-vin', title: 'Vinkart', score: 0, status: 'ikke', at: 'ikke tatt', icon: 'wallet' },
  ];
  const SCORE_ST = { bestatt: ['m-pill-ok', 'Bestått'], nytest: ['m-pill-warn', 'Ny test'], ikke: ['m-pill-muted', 'Ikke tatt'] };

  const KOMMENDE = [
    { id: 'u-forstehjelp', title: 'Førstehjelp — fornyelse', sub: 'Sertifikat utløper', when: 'Om 3 uker', icon: 'shield', tone: 'warn' },
    { id: 'u-skjenk', title: 'Ansvarlig vertskap', sub: 'Påkrevd før neste skift', when: 'Denne uka', icon: 'cap', tone: 'crit' },
    { id: 'u-meny', title: 'Ny sesongmeny-quiz', sub: 'Sommermeny lanseres', when: 'Neste uke', icon: 'utensils', tone: 'muted' },
  ];

  const avg = Math.round(SCORE.filter(s => s.status !== 'ikke').reduce((n, s) => n + s.score, 0) / SCORE.filter(s => s.status !== 'ikke').length);
  const validCerts = CERTS.filter(c => c.status === 'gyldig').length;

  // ---------------- certificate detail (bottom sheet) ----------------
  function CertDetail({ cert, onClose }) {
    const { toast } = window.useM();
    const [sc, sl] = CERT_ST[cert.status];
    return (
      <div className="m-sheet-scrim" onClick={onClose} style={{ zIndex: 47 }}>
        <div className="m-sheet" onClick={e => e.stopPropagation()}>
          <div className="m-sheet-grip" />
          <div className="m-sheet-h"><h3>Sertifikat</h3><button className="m-iconbtn" style={{ marginLeft: 'auto' }} onClick={onClose}><Ic n="x" s={20} /></button></div>
          <div className="m-sheet-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="m-cert-hero">
              <span className={cls('m-cert-ic', 'st-' + cert.status)}><Ic n={cert.icon} s={26} /></span>
              <div>
                <div className="m-cert-name">{cert.name}</div>
                <div className="m-cert-kind">{cert.kind}</div>
              </div>
            </div>
            <span className={cls('m-pill', sc)} style={{ alignSelf: 'flex-start', height: 26, fontSize: 12 }}><span className="m-pill-dot" /> {sl}</span>
            <div className="m-av-meta" style={{ marginTop: 0 }}>
              <div className="m-av-meta-row"><Ic n="calClock" s={15} c="var(--muted)" /><span>Gyldighet</span><b>{cert.valid}</b></div>
              <div className="m-av-meta-row"><Ic n="badge" s={15} c="var(--muted)" /><span>Utsteder</span><b>{cert.issuer}</b></div>
              <div className="m-av-meta-row"><Ic n="clock" s={15} c="var(--muted)" /><span>Utstedt</span><b>{cert.issued}</b></div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, padding: '10px 16px calc(16px + env(safe-area-inset-bottom,0px))', borderTop: '1px solid var(--border)' }}>
            {cert.status !== 'gyldig'
              ? <button className="m-btn m-btn-primary m-full" onClick={() => { toast('Fornyelse startet — leder varslet'); onClose(); }}><Ic n="history" s={16} /> Forny nå</button>
              : <button className="m-btn m-btn-ghost m-full" onClick={() => toast('Laster ned bevis (PDF)')}><Ic n="download" s={16} /> Last ned bevis</button>}
          </div>
        </div>
      </div>
    );
  }
  window.MCertDetail = CertDetail;

  // ---------------- the screen ----------------
  const FILTERS = [['alle', 'Alle'], ['sert', 'Sertifikater'], ['kurs', 'Kurs'], ['score', 'Score'], ['kommende', 'Kommende']];

  function Kompetanse() {
    const { toast, navigate, takeIntent } = window.useM();
    const intent = takeIntent ? takeIntent('kompetanse') : null;
    const [q, setQ] = useState('');
    const [filter, setFilter] = useState((intent && intent.filter) || 'alle');
    const [cert, setCert] = useState(null);

    const ql = q.trim().toLowerCase();
    const match = (s) => !ql || s.toLowerCase().includes(ql);
    const certs = useMemo(() => CERTS.filter(c => match(c.name + ' ' + c.kind + ' ' + c.issuer)), [ql]);
    const kurs = useMemo(() => KURS.filter(k => match(k.title + ' ' + k.src)), [ql]);
    const score = useMemo(() => SCORE.filter(s => match(s.title)), [ql]);
    const kommende = useMemo(() => KOMMENDE.filter(k => match(k.title + ' ' + k.sub)), [ql]);

    const show = (k) => filter === 'alle' || filter === k;
    const nothing = !(show('sert') && certs.length) && !(show('kurs') && kurs.length) && !(show('score') && score.length) && !(show('kommende') && kommende.length);

    return (
      <div className="m-page">
        <div className="m-hero">
          <h1>Opplæring & kompetanse</h1>
          <div className="m-hero-sub"><span>Din kompetanse — score, historikk og fornyelser.</span></div>
        </div>

        {/* stat strip */}
        <div className="m-kt-stats">
          <div className="m-kt-stat"><b className="mono" style={{ color: 'var(--success)' }}>{avg}%</b><span>Snittscore</span></div>
          <div className="m-kt-stat"><b className="mono">{validCerts}/{CERTS.length}</b><span>Gyldige sertifikat</span></div>
          <div className="m-kt-stat"><b className="mono" style={{ color: 'var(--warning)' }}>3 uker</b><span>Neste fornyelse</span></div>
        </div>

        {/* search */}
        <div className="m-kt-search">
          <Ic n="search" s={18} c="var(--muted)" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Søk i sertifikat, kurs og score…" />
          {q && <button className="m-kt-clear" onClick={() => setQ('')} aria-label="Tøm"><Ic n="x" s={15} /></button>}
        </div>

        {/* filter chips */}
        <div className="m-kt-seg">
          {FILTERS.map(([v, l]) => (
            <button key={v} className={cls('m-kt-chip', filter === v && 'on')} onClick={() => setFilter(v)}>{l}</button>
          ))}
        </div>

        {nothing && <div className="m-empty" style={{ marginTop: 8 }}><b>Ingen treff</b><p>Prøv et annet søk eller filter.</p></div>}

        {/* SERTIFISERINGER & LISENSER */}
        {show('sert') && certs.length > 0 && (
          <div>
            <div className="m-sec-h"><h2>Sertifiseringer & lisenser</h2><span className="m-sec-count">{certs.length}</span></div>
            <div className="m-card m-flush" style={{ marginTop: 10 }}>
              {certs.map(c => {
                const [sc, sl] = CERT_ST[c.status];
                return (
                  <button key={c.id} className="m-kt-row" onClick={() => setCert(c)}>
                    <span className={cls('m-kt-ic', 'cert-' + c.status)}><Ic n={c.icon} s={17} /></span>
                    <div className="m-kt-body">
                      <div className="m-kt-title" style={{ marginTop: 1 }}>{c.name}</div>
                      <div className="m-kt-sub">{c.kind} · {c.valid}</div>
                    </div>
                    <span className={cls('m-pill', sc)} style={{ height: 19, fontSize: 10, flex: '0 0 auto' }}>{sl}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* SCORE / menykunnskap */}
        {show('score') && score.length > 0 && (
          <div>
            <div className="m-sec-h"><h2>Score & menykunnskap</h2><button className="m-sec-link" onClick={() => navigate('trening')}>Ta quiz <Ic n="chevRight" s={13} /></button></div>
            <div className="m-card m-flush" style={{ marginTop: 10 }}>
              {score.map(s => {
                const [stc, stl] = SCORE_ST[s.status]; const taken = s.status !== 'ikke';
                return (
                  <button key={s.id} className="m-kt-row" onClick={() => navigate('trening')}>
                    <span className="m-kt-ic" style={{ background: 'var(--orange-soft)', color: 'var(--orange)' }}><Ic n={s.icon} s={17} /></span>
                    <div className="m-kt-body">
                      <div className="m-kt-title" style={{ marginTop: 1 }}>{s.title}</div>
                      {taken
                        ? <div className="m-score-bar"><div className="m-prog" style={{ flex: 1 }}><span style={{ width: s.score + '%' }} /></div><span className="mono m-score-v">{s.score}%</span></div>
                        : <div className="m-kt-sub">Ikke tatt ennå · <span className="mono">{s.at}</span></div>}
                    </div>
                    <span className={cls('m-pill', stc)} style={{ height: 19, fontSize: 10, flex: '0 0 auto' }}>{stl}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* KURS & FAG */}
        {show('kurs') && kurs.length > 0 && (
          <div>
            <div className="m-sec-h"><h2>Kurs & fag</h2><button className="m-sec-link" onClick={() => navigate('trening')}>Opplæring <Ic n="chevRight" s={13} /></button></div>
            <div className="m-card m-flush" style={{ marginTop: 10 }}>
              {kurs.map(k => {
                const [kc, kl] = KURS_ST[k.status];
                return (
                  <button key={k.id} className="m-kt-row" onClick={() => navigate('trening')}>
                    <span className="m-kt-ic" style={{ background: 'color-mix(in oklab, var(--info) 12%, transparent)', color: 'var(--info)' }}><Ic n="bookOpen" s={17} /></span>
                    <div className="m-kt-body">
                      <div className="m-kt-title" style={{ marginTop: 1 }}>{k.title}</div>
                      <div className="m-kt-sub">{k.src} · <span className="mono">{k.at}</span>{k.status === 'pagaende' ? ` · ${k.pct}%` : ''}</div>
                    </div>
                    <span className={cls('m-pill', kc)} style={{ height: 19, fontSize: 10, flex: '0 0 auto' }}>{kl}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* KOMMENDE */}
        {show('kommende') && kommende.length > 0 && (
          <div>
            <div className="m-sec-h"><h2>Kommende</h2><span className="m-sec-count">{kommende.length}</span></div>
            <div className="m-card m-flush" style={{ marginTop: 10 }}>
              {kommende.map(k => (
                <div key={k.id} className="m-kt-row" style={{ cursor: 'default' }}>
                  <span className={cls('m-kt-ic', 'kom-' + k.tone)}><Ic n={k.icon} s={17} /></span>
                  <div className="m-kt-body">
                    <div className="m-kt-title" style={{ marginTop: 1 }}>{k.title}</div>
                    <div className="m-kt-sub">{k.sub}</div>
                  </div>
                  <span className="m-kom-when">{k.when}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {cert && <CertDetail cert={cert} onClose={() => setCert(null)} />}
      </div>
    );
  }

  window.SO_M_PAGES = Object.assign(window.SO_M_PAGES || {}, { kompetanse: Kompetanse });
})();
