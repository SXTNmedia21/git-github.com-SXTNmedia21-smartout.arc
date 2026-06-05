// =============================================================================
// Smartout Mobile — HMS & AVVIK (kartotek)
// A LIVING registry (not the static handbook): search, browse and find all
//   • Avvik (deviations) — every status, not just the active ones
//   • HMS-kontroller — the LOG of completed controls (temp, vern, brann, mottak)
//   • Kompetanse — our courses / certificates as records
// Distinct from the OPERATIONAL "Sikkerhet" screen (which is about DOING/closing
// active compliance now). Reached from Sikkerhet's avvik card + the Mer menu.
// Registers window.SO_M_PAGES.kartotek and window.MAvvikDetail.
// =============================================================================
(function () {
  const { useState, useMemo } = React;
  const Ic = window.MIc;
  const D = window.SmartoutData;
  const cls = (...xs) => xs.filter(Boolean).join(' ');

  // ---------------- registry data (mock, Bistro Nord) ----------------
  const SEV = { hoy: ['m-pill-crit', 'Høy'], middels: ['m-pill-warn', 'Middels'], lav: ['m-pill-muted', 'Lav'] };
  const ST = { meldt: ['kt-st-meldt', 'Meldt'], arbeid: ['kt-st-arbeid', 'Under arbeid'], lukket: ['kt-st-lukket', 'Lukket'] };
  const STEPS = ['meldt', 'arbeid', 'lukket'];

  const AVVIK = [
    { id: 'AV-214', sev: 'hoy', status: 'arbeid', title: 'Løs pakning på Kjøl 3', cat: 'Mattrygghet', area: 'Kjøkken', owner: 'jh', at: 'i går 21:40', due: 'I dag 12:00',
      desc: 'Pakning på Kjøl 3 slipper — ga temperaturavvik over +4 °C i natt.', tiltak: 'Stram eller bytt pakning, test temperatur i 30 min, signer kontroll.',
      log: [['meldt', 'Jonas H.', 'meldte avviket fra nattevakt', 'i går 21:40'], ['arbeid', 'Maria A.', 'tildelte Jonas og bestilte ny pakning', 'i dag 07:10']] },
    { id: 'AV-208', sev: 'lav', status: 'meldt', title: 'Sikkerhetsdatablad mangler', cat: 'Kjemikalier', area: 'Lager', owner: 'ib', at: '28. mai', due: '4. jun',
      desc: 'Nytt avkalkingsmiddel tatt i bruk uten registrert sikkerhetsdatablad.', tiltak: 'Hent datablad fra leverandør og legg i HMS-kartoteket.',
      log: [['meldt', 'Ida B.', 'meldte manglende datablad', '28. mai']] },
    { id: 'AV-203', sev: 'lav', status: 'arbeid', title: 'Sklisikring ved oppvask', cat: 'Fallrisiko', area: 'Kjøkken', owner: 'pk', at: '26. mai', due: '10. jun',
      desc: 'Gulvmatte ved oppvaskstasjonen er slitt — glatt når det søles.', tiltak: 'Bestill ny sklisikker matte; midlertidig varselskilt er satt opp.',
      log: [['meldt', 'Petter K.', 'meldte slitt matte', '26. mai'], ['arbeid', 'Maria A.', 'satte opp varselskilt, matte bestilt', '27. mai']] },
    { id: 'AV-197', sev: 'middels', status: 'lukket', title: 'Branndør sto åpen', cat: 'Brannvern', area: 'Sal', owner: 'ma', at: '20. mai', due: '20. mai',
      desc: 'Rømningsdør mot bakgård var kilt opp under varelevering.', tiltak: 'Fjernet kile, informerte teamet om rutine. Dørpumpe sjekket OK.',
      log: [['meldt', 'Selma L.', 'oppdaget åpen branndør', '20. mai 16:20'], ['arbeid', 'Maria A.', 'fjernet kile og sjekket dørpumpe', '20. mai 16:35'], ['lukket', 'Maria A.', 'lukket — rutine repetert på premøte', '20. mai 17:00']] },
    { id: 'AV-191', sev: 'lav', status: 'lukket', title: 'Feil merking i allergen-skap', cat: 'Mattrygghet', area: 'Kjøkken', owner: 'sl', at: '14. mai', due: '16. mai',
      desc: 'To beholdere i allergen-skapet hadde byttet etikett.', tiltak: 'Re-merket beholderne og kontrollerte resten av skapet.',
      log: [['meldt', 'Selma L.', 'meldte feil merking', '14. mai'], ['arbeid', 'Jonas H.', 're-merket beholdere', '15. mai'], ['lukket', 'Maria A.', 'kontrollerte hele skapet — lukket', '16. mai']] },
    { id: 'AV-184', sev: 'hoy', status: 'lukket', title: 'Kjøl 2 temperaturavvik', cat: 'Mattrygghet', area: 'Kjøkken', owner: 'jh', at: '8. mai', due: '8. mai',
      desc: 'Kjøl 2 målte +7 °C om morgenen — varer kassert etter vurdering.', tiltak: 'Service tilkalt, termostat byttet, varer kassert og loggført.',
      log: [['meldt', 'Jonas H.', 'meldte temperaturavvik', '8. mai 06:50'], ['arbeid', 'Maria A.', 'tilkalte service, kasserte varer', '8. mai 09:30'], ['lukket', 'Maria A.', 'termostat byttet — temp stabil, lukket', '8. mai 14:00']] },
  ];

  const KONTROLL = [
    { id: 'k1', title: 'HACCP Temperaturkontroll', kind: 'temp', icon: 'thermometer', who: 'ma', at: 'I dag 11:30', result: 'ok', note: 'Alle kjøl/frys innenfor.' },
    { id: 'k2', title: 'Vernerunde sal & kjøkken', kind: 'vern', icon: 'shield', who: 'ma', at: '23. mai', result: 'funn', note: '2 funn → avvik AV-203, AV-197.' },
    { id: 'k3', title: 'Brannrunde & rømningsveier', kind: 'brann', icon: 'fire', who: 'pk', at: '16. mai', result: 'ok', note: 'Slukkere og veier OK.' },
    { id: 'k4', title: 'Mottakskontroll varer', kind: 'mottak', icon: 'checklist', who: 'jh', at: '14. mai', result: 'ok', note: 'Temperatur ved mottak godkjent.' },
    { id: 'k5', title: 'Egenkontroll IK-mat (uke 19)', kind: 'ikmat', icon: 'checklist', who: 'sl', at: '12. mai', result: 'ok', note: 'Ukentlig egenkontroll signert.' },
  ];

  const KURS = [
    { id: 'c-allergen', title: 'Allergenhåndtering', status: 'pagaende', pct: 60, src: 'Stilling', at: 'frist 2. jun' },
    { id: 'c-brann', title: 'Brann og evakuering', status: 'bestatt', pct: 100, src: 'Sesong', at: 'mar 2026' },
    { id: 'c-hms', title: 'HMS for servitører', status: 'utlopt', pct: 100, src: 'Avdeling', at: 'fornyes nå' },
    { id: 'c-skjenk', title: 'Ansvarlig vertskap', status: 'ikke', pct: 0, src: 'Bedrift', at: 'ikke startet' },
  ];
  const KURS_ST = { bestatt: ['m-pill-ok', 'Bestått'], pagaende: ['kt-st-arbeid', 'Pågår'], utlopt: ['m-pill-crit', 'Utløpt'], ikke: ['m-pill-muted', 'Ikke startet'] };

  // ---------------- avvik detail (full-cover, lifecycle) ----------------
  function AvvikDetail({ avvik, onClose }) {
    const { toast } = window.useM();
    const [status, setStatus] = useState(avvik.status);
    const [extra, setExtra] = useState([]);
    const u = D.USERS[avvik.owner] || {};
    const [sc, sl] = SEV[avvik.sev];
    const curIdx = STEPS.indexOf(status);
    const log = [...avvik.log, ...extra];

    const advance = () => {
      if (status === 'meldt') { setStatus('arbeid'); setExtra(e => [...e, ['arbeid', 'Deg', 'tok oppfølging på avviket', 'nå']]); toast('Du tok oppfølging — status: Under arbeid'); }
      else if (status === 'arbeid') { const prev = status; setStatus('lukket'); setExtra(e => [...e, ['lukket', 'Deg', 'markerte avviket som lukket', 'nå']]); toast('Avvik lukket ✓', { undo: () => { setStatus(prev); setExtra(e => e.slice(0, -1)); } }); }
    };
    const reopen = () => { const prev = status; setStatus('arbeid'); setExtra(e => [...e, ['arbeid', 'Deg', 'gjenåpnet avviket', 'nå']]); toast('Avvik gjenåpnet', { undo: () => { setStatus(prev); setExtra(e => e.slice(0, -1)); } }); };

    return (
      <div className="m-vakt" role="dialog" aria-label={'Avvik ' + avvik.id}>
        <div className="m-vakt-head">
          <button className="m-iconbtn" onClick={onClose} aria-label="Lukk"><Ic n="chevDown" s={22} /></button>
          <div className="m-vakt-htitle">{avvik.id}</div>
          <span />
        </div>
        <div className="m-vakt-body">
          <div className="m-av-head">
            <span className={cls('m-av-sevic', 'sev-' + avvik.sev)}><Ic n="alert" s={20} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="m-av-title">{avvik.title}</div>
              <div className="m-av-tags">
                <span className={cls('m-pill', sc)} style={{ height: 20, fontSize: 10.5 }}><span className="m-pill-dot" /> {sl}</span>
                <span className="m-av-cat">{avvik.cat} · {avvik.area}</span>
              </div>
            </div>
          </div>

          {/* lifecycle stepper */}
          <div className="m-av-steps">
            {STEPS.map((s, i) => {
              const done = i < curIdx, on = i === curIdx;
              const [, label] = ST[s];
              return (
                <div key={s} className={cls('m-av-step', done && 'done', on && 'on')}>
                  <span className="m-av-step-dot">{done ? <Ic n="check" s={12} sw={2.6} /> : i + 1}</span>
                  <span className="m-av-step-lbl">{label}</span>
                  {i < STEPS.length - 1 && <span className="m-av-step-bar" />}
                </div>
              );
            })}
          </div>

          <p className="m-av-desc">{avvik.desc}</p>

          {/* Botsson tiltak */}
          <div className="m-av-bot">
            <span className="m-av-bot-ic"><Ic n="bot" s={16} c="#fff" /></span>
            <div><b>Foreslått tiltak</b><span>{avvik.tiltak}</span></div>
          </div>

          {/* meta */}
          <div className="m-av-meta">
            <div className="m-av-meta-row"><Ic n="users" s={15} c="var(--muted)" /><span>Ansvarlig</span><b><span className="m-avatar" style={{ background: u.color || 'var(--muted)', width: 20, height: 20, fontSize: 8.5, marginRight: 6, verticalAlign: -4 }}>{u.initials || '?'}</span>{u.name || '—'}</b></div>
            <div className="m-av-meta-row"><Ic n="clock" s={15} c="var(--muted)" /><span>Meldt</span><b>{avvik.at}</b></div>
            <div className="m-av-meta-row"><Ic n="calClock" s={15} c="var(--muted)" /><span>Frist</span><b>{avvik.due}</b></div>
          </div>

          {/* activity timeline */}
          <div className="m-sec-h" style={{ marginTop: 4 }}><h2>Historikk</h2></div>
          <div className="m-av-tl">
            {log.map((l, i) => {
              const who = D.USERS[Object.keys(D.USERS).find(k => D.USERS[k].name === l[1])] || null;
              return (
                <div key={i} className="m-av-tl-row">
                  <span className={cls('m-av-tl-dot', 'st-' + l[0])} />
                  <div className="m-av-tl-body">
                    <div className="m-av-tl-txt"><b>{l[1]}</b> {l[2]}</div>
                    <div className="m-av-tl-time">{l[3]}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="m-vakt-foot">
          {status === 'lukket'
            ? <button className="m-btn m-btn-ghost m-btn-block" onClick={reopen}><Ic n="history" s={16} /> Gjenåpne avvik</button>
            : <button className="m-btn m-btn-primary m-btn-block" onClick={advance}><Ic n={status === 'meldt' ? 'check' : 'flag'} s={16} /> {status === 'meldt' ? 'Ta oppfølging' : 'Marker som lukket'}</button>}
        </div>
      </div>
    );
  }
  window.MAvvikDetail = AvvikDetail;

  // ---------------- the kartotek screen ----------------
  const FILTERS = [['alle', 'Alle'], ['avvik', 'Avvik'], ['kontroll', 'Kontroller'], ['kurs', 'Kompetanse']];

  function Kartotek() {
    const { toast, openAdd, navigate, takeIntent } = window.useM();
    const intent = takeIntent ? takeIntent('kartotek') : null;
    const [q, setQ] = useState('');
    const [filter, setFilter] = useState((intent && intent.filter) || 'alle');
    const [detail, setDetail] = useState(null);

    const ql = q.trim().toLowerCase();
    const match = (s) => !ql || s.toLowerCase().includes(ql);
    const avvik = useMemo(() => AVVIK.filter(a => match(a.id + ' ' + a.title + ' ' + a.cat + ' ' + a.area)), [ql]);
    const kontroll = useMemo(() => KONTROLL.filter(k => match(k.title + ' ' + k.note)), [ql]);
    const kurs = useMemo(() => KURS.filter(k => match(k.title + ' ' + k.src)), [ql]);

    const showAvvik = filter === 'alle' || filter === 'avvik';
    const showKontroll = filter === 'alle' || filter === 'kontroll';
    const showKurs = filter === 'alle' || filter === 'kurs';
    const openCount = AVVIK.filter(a => a.status !== 'lukket').length;
    const nothing = (!showAvvik || !avvik.length) && (!showKontroll || !kontroll.length) && (!showKurs || !kurs.length);

    return (
      <div className="m-page">
        <div className="m-hero">
          <h1>HMS & Avvik</h1>
          <div className="m-hero-sub"><span>Kartoteket — søk, bla og finn alt.</span></div>
        </div>

        {/* stat strip */}
        <div className="m-kt-stats">
          <div className="m-kt-stat"><b className="mono" style={{ color: openCount ? 'var(--orange)' : 'var(--success)' }}>{openCount}</b><span>Åpne avvik</span></div>
          <div className="m-kt-stat"><b className="mono">{KONTROLL.length}</b><span>Kontroller logget</span></div>
          <div className="m-kt-stat"><b className="mono">{KURS.filter(k => k.status === 'bestatt').length}/{KURS.length}</b><span>Kurs bestått</span></div>
        </div>

        {/* search */}
        <div className="m-kt-search">
          <Ic n="search" s={18} c="var(--muted)" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Søk i avvik, kontroller og kurs…" />
          {q && <button className="m-kt-clear" onClick={() => setQ('')} aria-label="Tøm"><Ic n="x" s={15} /></button>}
        </div>

        {/* filter chips */}
        <div className="m-kt-seg">
          {FILTERS.map(([v, l]) => (
            <button key={v} className={cls('m-kt-chip', filter === v && 'on')} onClick={() => setFilter(v)}>{l}</button>
          ))}
        </div>

        {nothing && <div className="m-empty" style={{ marginTop: 8 }}><b>Ingen treff</b><p>Prøv et annet søk eller filter.</p></div>}

        {/* AVVIK */}
        {showAvvik && avvik.length > 0 && (
          <div>
            <div className="m-sec-h"><h2>Avvik</h2><span className="m-sec-count">{avvik.length}</span></div>
            <div className="m-card m-flush" style={{ marginTop: 10 }}>
              {avvik.map(a => {
                const [sc, sl] = SEV[a.sev]; const [stc, stl] = ST[a.status];
                return (
                  <button key={a.id} className="m-kt-row" onClick={() => setDetail(a)}>
                    <span className={cls('m-kt-ic', 'sev-' + a.sev)}><Ic n="alert" s={17} /></span>
                    <div className="m-kt-body">
                      <div className="m-kt-top"><span className="mono m-kt-id">{a.id}</span><span className={cls('m-kt-stp', stc)}>{stl}</span></div>
                      <div className="m-kt-title">{a.title}</div>
                      <div className="m-kt-sub">{a.cat} · {a.area} · <span className="mono">{a.at}</span></div>
                    </div>
                    <span className={cls('m-pill', sc)} style={{ height: 19, fontSize: 10, flex: '0 0 auto' }}>{sl}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* KONTROLLER */}
        {showKontroll && kontroll.length > 0 && (
          <div>
            <div className="m-sec-h"><h2>HMS-kontroller</h2><span className="m-sec-count">{kontroll.length}</span></div>
            <div className="m-card m-flush" style={{ marginTop: 10 }}>
              {kontroll.map(k => {
                const u = D.USERS[k.who] || {}; const ok = k.result === 'ok';
                return (
                  <div key={k.id} className="m-kt-row" style={{ cursor: 'default' }}>
                    <span className="m-kt-ic" style={{ background: 'var(--secondary)', color: 'var(--muted)' }}><Ic n={k.icon} s={17} /></span>
                    <div className="m-kt-body">
                      <div className="m-kt-title" style={{ marginTop: 1 }}>{k.title}</div>
                      <div className="m-kt-sub">{k.note}</div>
                      <div className="m-kt-meta-row"><span className="m-avatar" style={{ background: u.color || 'var(--muted)', width: 18, height: 18, fontSize: 8 }}>{u.initials}</span> {u.name} · <span className="mono">{k.at}</span></div>
                    </div>
                    <span className={cls('m-kt-res', ok ? 'ok' : 'funn')}>{ok ? <><Ic n="check" s={12} sw={2.6} /> OK</> : <><Ic n="alert" s={12} /> Funn</>}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* KOMPETANSE */}
        {showKurs && kurs.length > 0 && (
          <div>
            <div className="m-sec-h"><h2>Kompetanse</h2><button className="m-sec-link" onClick={() => navigate('trening')}>Opplæring <Ic n="chevRight" s={13} /></button></div>
            <div className="m-card m-flush" style={{ marginTop: 10 }}>
              {kurs.map(k => {
                const [kc, kl] = KURS_ST[k.status];
                return (
                  <button key={k.id} className="m-kt-row" onClick={() => navigate('trening')}>
                    <span className="m-kt-ic" style={{ background: 'color-mix(in oklab, var(--success) 12%, transparent)', color: 'var(--success)' }}><Ic n="badge" s={17} /></span>
                    <div className="m-kt-body">
                      <div className="m-kt-title" style={{ marginTop: 1 }}>{k.title}</div>
                      <div className="m-kt-sub">{k.src} · <span className="mono">{k.at}</span></div>
                    </div>
                    <span className={cls('m-pill', kc)} style={{ height: 19, fontSize: 10, flex: '0 0 auto' }}>{kl}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <button className="m-btn m-btn-primary m-btn-block" onClick={openAdd} style={{ marginTop: 4 }}><Ic n="plus" s={18} /> Meld nytt avvik</button>

        {detail && <AvvikDetail avvik={detail} onClose={() => setDetail(null)} />}
      </div>
    );
  }

  window.SO_M_PAGES = Object.assign(window.SO_M_PAGES || {}, { kartotek: Kartotek });
})();
