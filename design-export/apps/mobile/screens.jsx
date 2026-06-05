// =============================================================================
// Smartout Mobile — sub-screens reached from the Hjem ActionBar / Mer:
//   trening   (Opplæring)  — ported from app/(app)/(home)/training.tsx
//   sikkerhet (HMS)        — ported from app/(app)/(home)/hms.tsx
//   lonn      (Lønn & arbeid) — ported from app/(app)/(me)/index.tsx + payroll
// Registers into window.SO_M_PAGES. Reuses shared tokens + .m-* component layer.
// These are NOT bottom tabs — the shell topbar renders a back arrow for them.
// =============================================================================
(function () {
  const { useState } = React;
  const Ic = window.MIc;
  const { cls, fmtKr } = window.M;

  // ---------- shared: progress ring ----------
  function Ring({ pct, size = 104, sw = 9, color = 'var(--orange)' }) {
    const r = (size - sw) / 2, c = 2 * Math.PI * r;
    return (
      <span className="m-ring-wrap" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted-soft)" strokeWidth={sw - 3} opacity="0.4" />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw}
            strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset 700ms' }} />
        </svg>
        <span className="m-ring-label" style={{ fontSize: size * 0.24 }}>{Math.round(pct * 100)}<span style={{ fontSize: '0.62em' }}>%</span></span>
      </span>
    );
  }

  // =========================================================================
  // TRENING — Opplæring
  // =========================================================================
  const COURSES = [
    { id: 'c-allergen', title: 'Allergenhåndtering', desc: 'Trygg servering ved allergier', status: 'in_progress', pct: 60, source: 'Stilling', v: '2.1' },
    { id: 'c-skjenk', title: 'Ansvarlig vertskap', desc: 'Skjenkeregler og aldersgrense', status: 'not_started', pct: 0, source: 'Bedrift', v: '1.4' },
    { id: 'c-brann', title: 'Brann og evakuering', desc: 'Rømningsveier og slukkeutstyr', status: 'completed', pct: 100, source: 'Sesong', v: '3.0' },
    { id: 'c-hms', title: 'HMS for servitører', desc: 'Ergonomi og sikker drift i sal', status: 'expired', pct: 100, source: 'Avdeling', v: '1.0' },
  ];
  const C_STATUS = {
    not_started: { label: 'Ikke startet', cls: 'm-pill-muted' },
    in_progress: { label: 'Pågående', cls: 'm-pill-info' },
    completed: { label: 'Fullført', cls: 'm-pill-ok' },
    expired: { label: 'Utløpt', cls: 'm-pill-crit' },
  };
  const PROCEDURES = [
    { id: 'p-kasse', title: 'Kasseoppgjør ved vaktslutt', isNew: true },
    { id: 'p-bord', title: 'Borddekking à la carte', isNew: false },
    { id: 'p-vin', title: 'Vinservering og dekantering', isNew: true },
  ];
  const CERTS = [
    { id: 'cert-skjenk', title: 'Kunnskapsprøve skjenkebevilling', date: 'MAI 2026' },
    { id: 'cert-hygiene', title: 'Næringsmiddelhygiene', date: 'FEB 2026' },
  ]; // eslint-disable-line no-unused-vars — legacy; certs registry now lives in kompetanse.jsx
  // full module content (manual sections) per course / procedure — fed to the FlowPlayer
  const mkMan = (title, desc, secs, extra) => Object.assign({ title, version: '1.0', updated: 'mai 2026', estimatedReadTime: Math.max(2, secs.length * 2), description: desc, author: 'Bistro Nord', sections: secs }, extra || {});
  const COURSE_CONTENT = {
    'c-allergen': mkMan('Allergenhåndtering', 'Trygg servering ved allergier og intoleranser.', [
      { title: 'De 14 allergenene', type: 'image', content: ['Gluten, skalldyr, egg, fisk, peanøtter, soya, melk, nøtter, selleri, sennep, sesam, svoveldioksid, lupin og bløtdyr.'] },
      { title: 'Spør alltid gjesten', type: 'text', content: ['Ved usikkerhet — spør kjøkkenet før du bekrefter. Aldri gjett.', 'Marker bordet med allergi-lapp så hele teamet vet det.'] },
      { title: 'Unngå krysskontaminering', type: 'checklist', content: ['Eget skjærebrett', 'Rene hansker', 'Egen serveringsbestikk', 'Sjekk pålegg og dressinger'] },
    ], { author: 'Sara K. (Kvalitetsleder)' }),
    'c-skjenk': mkMan('Ansvarlig vertskap', 'Skjenkeregler, aldersgrense og overskjenking.', [
      { title: 'Aldersgrenser', type: 'text', content: ['18 år for øl/vin, 20 år for brennevin. Be om legitimasjon ved tvil.'] },
      { title: 'Overskjenking', type: 'checklist', content: ['Ikke skjenk åpenbart berusede', 'Tilby vann og mat', 'Si fra til vaktansvarlig'] },
    ]),
    'c-brann': mkMan('Brann og evakuering', 'Rømningsveier, slukkeutstyr og møteplass.', [
      { title: 'Rømningsveier', type: 'image', content: ['Hold alltid rømningsveier fri. Kjenn nærmeste utgang fra hver sone.'] },
      { title: 'Slukkeutstyr', type: 'video', content: ['Pulverapparat og brannteppe henger ved kjøkkeninngang.'], videoTitle: 'Slik bruker du brannslukker', videoDuration: '1:30' },
      { title: 'Ved brann', type: 'checklist', content: ['Varsle', 'Redde gjester', 'Slukke om trygt', 'Møteplass: parkeringen'] },
    ]),
    'c-hms': mkMan('HMS for servitører', 'Ergonomi og sikker drift i sal.', [
      { title: 'Løfteteknikk', type: 'text', content: ['Løft med beina, ikke ryggen. Be om hjelp ved tunge brett.'] },
      { title: 'Søl og glatt gulv', type: 'checklist', content: ['Tørk opp umiddelbart', 'Sett opp varselskilt', 'Meld avvik ved skade'] },
    ]),
  };
  const PROC_CONTENT = {
    'p-kasse': mkMan('Kasseoppgjør ved vaktslutt', 'Slik teller du ned og avstemmer kassen.', [
      { title: 'Tell kontanter', type: 'text', content: ['Tell ned skuffen og noter beløp. Sammenlign med Z-rapport.'] },
      { title: 'Avvik', type: 'checklist', content: ['Differanse < 50 kr: noter', 'Differanse > 50 kr: meld leder', 'Legg oppgjør i safe'] },
    ]),
    'p-bord': mkMan('Borddekking à la carte', 'Standard dekking for à la carte-service.', [
      { title: 'Oppdekk', type: 'image', content: ['Tallerken midt, gaffel venstre, kniv høyre (egg inn), glass over kniven.'] },
      { title: 'Finish', type: 'checklist', content: ['Rene glass uten merker', 'Brettet serviett', 'Tente lys etter kl. 17'] },
    ]),
    'p-vin': mkMan('Vinservering og dekantering', 'Presentasjon, smaking og dekantering.', [
      { title: 'Presenter flasken', type: 'text', content: ['Vis etiketten til vertskapet før åpning. Les årgang høyt.'] },
      { title: 'Dekantering', type: 'video', content: ['Hell forsiktig til bunnfallet nås.'], videoTitle: 'Dekantering steg for steg', videoDuration: '2:05' },
    ]),
  };
  // per-course knowledge test (kunnskapstest) + linked handbook chapter (real surfaces)
  const COURSE_QUIZ = {
    'c-allergen': { title: 'Allergenhåndtering', pass: 0.8, questions: [
      { q: 'Hvor mange offisielle allergener må merkes?', options: ['10', '12', '14', '16'], correct: 2 },
      { q: 'En gjest spør om en rett er glutenfri, og du er usikker. Hva gjør du?', options: ['Gjetter ut fra ingrediensene', 'Spør kjøkkenet før du bekrefter', 'Sier ja for å være hyggelig', 'Anbefaler noe annet'], correct: 1 },
      { q: 'Hva hindrer best krysskontaminering?', options: ['Bruke samme bestikk raskt', 'Eget skjærebrett og rene hansker', 'Skylle utstyret i kaldt vann', 'Tørke av med klut'], correct: 1 },
      { q: 'Hvordan markerer du et bord med allergi?', options: ['Sier det høyt én gang', 'Setter en allergi-lapp så hele teamet ser det', 'Husker det selv', 'Skriver det i kassa'], correct: 1 },
      { q: 'Skalldyr er ett av de 14 allergenene.', options: ['Sant', 'Usant'], correct: 0 },
    ] },
    'c-skjenk': { title: 'Ansvarlig vertskap', pass: 0.8, questions: [
      { q: 'Hva er aldersgrensen for å kjøpe brennevin?', options: ['18 år', '20 år', '21 år'], correct: 1 },
      { q: 'En gjest er åpenbart beruset. Hva gjør du?', options: ['Skjenker én til', 'Lar være å skjenke og tilbyr vann/mat', 'Ignorerer det'], correct: 1 },
      { q: 'Ved tvil om alder skal du …', options: ['Be om legitimasjon', 'Anslå selv', 'Spørre en kollega'], correct: 0 },
    ] },
    'c-brann': { title: 'Brann og evakuering', pass: 0.8, questions: [
      { q: 'Hva er første steg ved brann?', options: ['Slukke', 'Varsle', 'Rydde'], correct: 1 },
      { q: 'Hvor er møteplassen ved evakuering?', options: ['Kjøkkenet', 'Parkeringen', 'Baren'], correct: 1 },
      { q: 'Rømningsveier skal alltid …', options: ['Holdes fri', 'Låses', 'Brukes til lager'], correct: 0 },
    ] },
    'c-hms': { title: 'HMS for servitører', pass: 0.8, questions: [
      { q: 'Riktig løfteteknikk er å løfte med …', options: ['Ryggen', 'Beina', 'Armene alene'], correct: 1 },
      { q: 'Du oppdager søl på gulvet. Hva gjør du først?', options: ['Tørker opp umiddelbart', 'Venter til vakta er over', 'Går rundt det'], correct: 0 },
      { q: 'Ved personskade skal du …', options: ['Melde avvik', 'La det være', 'Vente til neste dag'], correct: 0 },
    ] },
  };
  const GENERIC_QUIZ = { title: 'Kunnskapstest', pass: 0.8, questions: [
    { q: 'Hvor finner du oppdaterte rutiner for denne modulen?', options: ['I tilhørende håndbok', 'På oppslagstavla', 'Hos en kollega'], correct: 0 },
    { q: 'Hva gjør du om du er usikker på en prosedyre?', options: ['Spør vaktansvarlig eller Botsson', 'Gjetter', 'Hopper over'], correct: 0 },
    { q: 'Når er en modul fullført?', options: ['Når veiledning og test er bestått', 'Når du har åpnet den', 'Aldri'], correct: 0 },
  ] };
  const quizFor = (course) => COURSE_QUIZ[course.id] || Object.assign({}, GENERIC_QUIZ, { title: course.title });
  const COURSE_DOC = {
    'c-allergen': { book: 'HMS-håndbok', chapter: 'Allergener og matsikkerhet', title: 'Allergenhåndtering', updated: 'mai 2026', blocks: [
      { p: ['Alle som serverer mat hos oss skal kjenne de 14 lovpålagte allergenene og hvordan vi unngår krysskontaminering. Dette kapittelet er bindende for alt salspersonell.'] },
      { h: 'De 14 allergenene', p: ['Gluten, skalldyr, egg, fisk, peanøtter, soya, melk, nøtter, selleri, sennep, sesam, svoveldioksid, lupin og bløtdyr.'] },
      { h: 'Når en gjest melder allergi', list: ['Spør alltid kjøkkenet før du bekrefter — aldri gjett.', 'Sett en allergi-lapp på bordet så hele teamet vet det.', 'Bruk eget skjærebrett, rene hansker og egen serveringsbestikk.'] },
      { h: 'Ved tvil', p: ['Er du i tvil, behandle retten som om den inneholder allergenet. Meld avvik dersom noe går galt, så vi kan lære av det.'] },
    ] },
    'c-skjenk': { book: 'Driftshåndbok', chapter: 'Skjenkebevilling og ansvar', title: 'Ansvarlig vertskap', updated: 'mai 2026', blocks: [
      { p: ['Vi har et felles ansvar for trygg skjenking. Brudd kan koste bevillingen.'] },
      { h: 'Aldersgrenser', list: ['18 år for øl og vin', '20 år for brennevin', 'Be om legitimasjon ved tvil'] },
      { h: 'Overskjenking', p: ['Ikke skjenk åpenbart berusede gjester. Tilby vann og mat, og si fra til vaktansvarlig.'] },
    ] },
    'c-brann': { book: 'HMS-håndbok', chapter: 'Brannvern og evakuering', title: 'Brann og evakuering', updated: 'mai 2026', blocks: [
      { p: ['Kjenn rømningsveiene og slukkeutstyret på din sone før vakta begynner.'] },
      { h: 'Ved brann', list: ['Varsle', 'Redde gjester', 'Slukke om det er trygt', 'Møteplass: parkeringen'] },
    ] },
    'c-hms': { book: 'HMS-håndbok', chapter: 'Ergonomi og sikkerhet i sal', title: 'HMS for servitører', updated: 'mai 2026', blocks: [
      { p: ['God ergonomi og rask respons på søl holder både gjester og kolleger trygge.'] },
      { h: 'Løft og søl', list: ['Løft med beina, ikke ryggen', 'Tørk opp søl umiddelbart og sett opp varselskilt', 'Meld avvik ved skade'] },
    ] },
  };
  const docFor = (course) => COURSE_DOC[course.id] || { book: 'HMS-håndbok', chapter: 'Kapittel', title: course.title, updated: 'mai 2026', blocks: [{ p: ['Tilhørende kapittel kommer snart for denne modulen.'] }] };

  // course detail bottom sheet — lists all the content types (manual/quiz/håndbok/sertifikat)
  function CourseSheet({ course, onClose }) {
    const { toast } = window.useM();
    const [flow, setFlow] = useState(false);
    const [quiz, setQuiz] = useState(false);
    const [doc, setDoc] = useState(false);
    const man = COURSE_CONTENT[course.id];
    const st = C_STATUS[course.status];
    const doneCourse = course.status === 'completed';
    return (
      <div className="m-sheet-scrim" onClick={onClose} style={{ zIndex: 47 }}>
        <div className="m-sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '90%' }}>
          <div className="m-sheet-grip" />
          <div className="m-sheet-h"><h3>Kurs</h3><button className="m-iconbtn" style={{ marginLeft: 'auto' }} onClick={onClose}><Ic n="x" s={20} /></button></div>
          <div className="m-sheet-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', gap: 7, marginBottom: 9 }}><span className="m-pill m-pill-muted">{course.source}</span><span className={cls('m-pill', st.cls)}>{st.label}</span></div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 26, lineHeight: 1.1 }}>{course.title}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>{course.desc}</div>
            </div>
            <div className="m-course-prog"><div className="m-prog"><span style={{ width: course.pct + '%' }} /></div><span className="m-course-pct">{course.pct}%</span></div>

            <div className="m-sec-h" style={{ marginBottom: 4 }}><h2>Innhold</h2></div>
            <div className="m-card m-flush">
              <button className="m-row" style={{ width: '100%' }} onClick={() => man && setFlow(true)}>
                <span className="m-row-ic" style={{ background: 'var(--orange-soft)', color: 'var(--orange)' }}><Ic n="bookOpen" s={17} /></span>
                <div className="m-row-body"><div className="m-row-title">Veiledning</div><div className="m-row-sub">{man ? `${man.sections.length} steg` : 'Kommer snart'}</div></div>
                <span className="m-row-go"><Ic n="play" s={16} /></span>
              </button>
              <button className="m-row" style={{ width: '100%' }} onClick={() => setQuiz(true)}>
                <span className="m-row-ic" style={{ background: 'color-mix(in oklab, var(--info) 13%, transparent)', color: 'var(--info)' }}><Ic n="checkCircle" s={17} /></span>
                <div className="m-row-body"><div className="m-row-title">Kunnskapstest</div><div className="m-row-sub">{quizFor(course).questions.length} spørsmål · bestå {Math.round((quizFor(course).pass || 0.8) * 100)}%</div></div>
                <span className="m-row-go"><Ic n="chevRight" s={18} /></span>
              </button>
              <button className="m-row" style={{ width: '100%' }} onClick={() => setDoc(true)}>
                <span className="m-row-ic" style={{ background: 'var(--secondary)', color: 'var(--muted)' }}><Ic n="route" s={17} /></span>
                <div className="m-row-body"><div className="m-row-title">Tilhørende håndbok</div><div className="m-row-sub">{docFor(course).book} · {docFor(course).chapter}</div></div>
                <span className="m-row-go"><Ic n="chevRight" s={18} /></span>
              </button>
              {doneCourse && (
                <button className="m-row" style={{ width: '100%' }} onClick={() => toast('Laster ned kursbevis')}>
                  <span className="m-row-ic" style={{ background: 'color-mix(in oklab, var(--success) 12%, transparent)', color: 'var(--success)' }}><Ic n="download" s={17} /></span>
                  <div className="m-row-body"><div className="m-row-title">Last ned kursbevis</div><div className="m-row-sub">PDF · signert</div></div>
                  <Ic n="download" s={17} c="var(--success)" />
                </button>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, padding: '10px 16px calc(16px + env(safe-area-inset-bottom,0px))', borderTop: '1px solid var(--border)' }}>
            <button className="m-btn m-btn-primary m-btn-block" onClick={() => man ? setFlow(true) : toast('Innhold kommer snart')}><Ic n="play" s={16} /> {course.pct > 0 && !doneCourse ? 'Fortsett modulen' : doneCourse ? 'Gjennomgå på nytt' : 'Start modulen'}</button>
          </div>
          {flow && man && window.MFlowPlayer && <window.MFlowPlayer manual={man} onClose={() => setFlow(false)} />}
          {quiz && window.MQuiz && <window.MQuiz quiz={quizFor(course)} onClose={() => setQuiz(false)} />}
          {doc && window.MHandbookReader && <window.MHandbookReader doc={docFor(course)} onClose={() => setDoc(false)} />}
        </div>
      </div>
    );
  }
  function Trening() {
    const { toast, takeIntent, navigate } = window.useM();
    const intent = takeIntent ? takeIntent('trening') : null;
    const [course, setCourse] = useState(null);
    const [proc, setProc] = useState(null);
    const [menuQuiz, setMenuQuiz] = useState(null);
    const [board, setBoard] = useState(false);
    // deep-link: a notification / springer can pass { quiz: <courseId> } to open a test straight away
    const [directQuiz, setDirectQuiz] = useState(() => {
      if (!intent || !intent.quiz) return null;
      const c = COURSES.find(x => x.id === intent.quiz);
      return c ? quizFor(c) : null;
    });
    const MK = window.SmartoutData || {};
    const menus = (MK.MK_MENUS || []).filter(m => m.status === 'publisert');
    const MYMENU = { 'vinter-mat': { score: 91, st: 'bestatt' }, 'vinkart': { score: 0, st: 'ikke' }, 'cocktail': { score: 68, st: 'nytest' } };
    const MK_ST = { bestatt: ['m-pill-ok', 'Bestått'], nytest: ['m-pill-warn', 'Ny test'], ikke: ['m-pill-muted', 'Ikke tatt'] };
    const startMenu = (m) => setMenuQuiz({ title: m.name, kind: 'meny', pass: 0.8, questions: MK.MK_QUIZ_QUESTIONS || [] });
    const completed = COURSES.filter(c => c.status === 'completed').length;
    const readiness = 0.72;
    return (
      <div className="m-page">
        {/* readiness */}
        <div className="m-card m-readiness">
          <div className="m-readiness-head">
            <div>
              <div className="m-readiness-t">Din beredskap: {Math.round(readiness * 100)}%</div>
              <div className="m-readiness-s">Du er godt på vei til å bli fullsertifisert for sesongen.</div>
              <div className="m-readiness-c">{completed} av {COURSES.length} fullført</div>
            </div>
            <span className="m-readiness-deco">01</span>
          </div>
          <div className="m-prog m-prog-lg"><span style={{ width: (readiness * 100) + '%' }} /></div>
          <div className="m-readiness-labels"><span>BEGYNNER</span><span>EKSPERT</span></div>
        </div>

        {/* menykunnskap — rich menu quizzes */}
        <div>
          <div className="m-sec-h"><h2>Menykunnskap</h2><button className="m-sec-link" onClick={() => setBoard(true)}>Ledertavle <Ic n="chevRight" s={13} /></button></div>
          <div className="m-mq-rail">
            {menus.map(m => {
              const my = MYMENU[m.id] || { score: 0, st: 'ikke' };
              const [pc, pl] = MK_ST[my.st];
              const req = my.st !== 'bestatt';
              return (
                <button key={m.id} className="m-card m-course m-mq-card" onClick={() => startMenu(m)}>
                  <div className="m-course-top">
                    <span className="m-course-ic" style={{ background: 'var(--orange-soft)', color: 'var(--orange)' }}><Ic n={m.icon} s={20} /></span>
                    <span className="m-course-badges">
                      <span className="m-pill m-pill-muted" style={{ height: 19, fontSize: 10 }}>{(MK.MK_KIND_LABEL || {})[m.kind] || m.kind}</span>
                      <span className={cls('m-pill', pc)} style={{ height: 19, fontSize: 10 }}>{pl}{my.st !== 'ikke' ? ` · ${my.score}%` : ''}</span>
                    </span>
                  </div>
                  <div className="m-course-title">{m.name}</div>
                  <div className="m-course-desc">{m.items} retter · spillbar quiz{req ? ' · påkrevd før skift' : ''}</div>
                  <span className="m-btn m-btn-primary m-sm" style={{ alignSelf: 'flex-start', marginTop: 10, pointerEvents: 'none' }}><Ic n="play" s={14} /> {my.st === 'bestatt' ? 'Øv igjen' : my.st === 'nytest' ? 'Ta på nytt' : 'Start quiz'}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* aktive kurs */}
        <div>
          <div className="m-sec-h"><h2>Aktive kurs</h2><button className="m-sec-link" onClick={() => toast('Alle kurs')}>Se alle <Ic n="chevRight" s={13} /></button></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            {COURSES.map(c => {
              const st = C_STATUS[c.status];
              return (
                <button key={c.id} className="m-card m-course" onClick={() => setCourse(c)}>
                  <div className="m-course-top">
                    <span className="m-course-ic"><Ic n="bookOpen" s={20} /></span>
                    <span className="m-course-badges">
                      <span className="m-pill m-pill-muted" style={{ height: 19, fontSize: 10 }}>{c.source}</span>
                      <span className={cls('m-pill', st.cls)} style={{ height: 19, fontSize: 10 }}>{st.label}</span>
                    </span>
                  </div>
                  <div className="m-course-title">{c.title}</div>
                  <div className="m-course-desc">{c.desc} · <span className="mono">v{c.v}</span></div>
                  <div className="m-course-prog">
                    <div className="m-prog"><span style={{ width: c.pct + '%' }} /></div>
                    <span className="m-course-pct">{c.pct}%</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* prosedyrer */}
        <div>
          <div className="m-sec-h"><h2>Prosedyrer</h2></div>
          <div className="m-card m-flush" style={{ marginTop: 10 }}>
            {PROCEDURES.map(p => (
              <button key={p.id} className="m-row" style={{ width: '100%' }} onClick={() => setProc(PROC_CONTENT[p.id])}>
                <span className="m-row-ic" style={{ background: 'var(--secondary)', color: 'var(--muted)' }}><Ic n="file" s={17} /></span>
                <div className="m-row-body"><div className="m-row-title">{p.title}{p.isNew && <span className="m-ny">NY</span>}</div></div>
                <span className="m-row-go"><Ic n="play" s={16} /></span>
              </button>
            ))}
          </div>
        </div>

        {/* min kompetanse — registry (kartotek) pointer */}
        <button className="m-card m-kompetanse-cta" onClick={() => navigate('kompetanse')}>
          <span className="m-row-ic" style={{ background: 'color-mix(in oklab, var(--success) 12%, transparent)', color: 'var(--success)', flex: '0 0 auto' }}><Ic n="badge" s={20} /></span>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <div style={{ fontSize: 15, fontWeight: 650 }}>Min kompetanse</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>Sertifikater, score, historikk og fornyelser</div>
          </div>
          <span className="m-pill m-pill-warn" style={{ flex: '0 0 auto' }}>1 fornyes</span>
          <Ic n="chevRight" s={18} c="var(--muted-soft)" style={{ flex: '0 0 auto' }} />
        </button>

        {course && <CourseSheet course={course} onClose={() => setCourse(null)} />}
        {directQuiz && window.MQuiz && <window.MQuiz quiz={directQuiz} onClose={() => setDirectQuiz(null)} />}
        {board && window.MMenyLeaderboard && <window.MMenyLeaderboard onClose={() => setBoard(false)} />}
        {proc && window.MFlowPlayer && <window.MFlowPlayer manual={proc} onClose={() => setProc(null)} />}
        {menuQuiz && window.MQuiz && <window.MQuiz quiz={menuQuiz} onClose={() => setMenuQuiz(null)} />}
      </div>
    );
  }

  // =========================================================================
  // SIKKERHET — HMS Oversikt
  // =========================================================================
  function Sikkerhet() {
    const { navigate, toast, openAdd, openOverlay } = window.useM();
    const [tasks, setTasks] = useState({ t1: true, t2: false, t3: false });
    const toggle = (k) => setTasks(s => ({ ...s, [k]: !s[k] }));
    return (
      <div className="m-page">
        {/* compliance hero */}
        <div className="m-hms-hero">
          <div className="m-hms-hero-t">
            <div className="m-hms-hero-title">Systemet er <span className="m-accent">klart for drift.</span></div>
            <div className="m-hms-hero-sub">3 aktive avvik krever oppfølging denne uken.</div>
          </div>
          <Ring pct={0.94} size={96} sw={8} />
        </div>

        {/* HACCP aktiv nå */}
        <div className="m-card m-haccp">
          <div className="m-haccp-top">
            <span className="m-pill" style={{ background: 'var(--orange)', color: '#fff', height: 22 }}><span className="m-pill-dot" style={{ background: '#fff' }} /> AKTIV NÅ</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Frist: 12:30</span>
          </div>
          <div className="m-haccp-title">HACCP Temperaturkontroll</div>
          <button className="m-btn m-btn-primary m-btn-block" onClick={() => openOverlay('kontroll', { id: 't1', cat: 'ikmat', title: 'HACCP Temperaturkontroll', book: 'hms', chapter: 'Egenkontroll mat (IK-mat)' })}><Ic n="zap" s={17} /> Start måling</button>
        </div>

        {/* avvik */}
        <div className="m-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div><div style={{ fontSize: 18, fontWeight: 650 }}>3 aktive avvik</div><div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Siste 48 timer</div></div>
            <Ic n="alert" s={24} c="var(--orange)" sw={1.6} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <span className="m-pill m-pill-crit" style={{ height: 32, padding: '0 14px', fontSize: 12.5 }}><span className="m-pill-dot" /> 1 Høy</span>
            <span className="m-pill m-pill-muted" style={{ height: 32, padding: '0 14px', fontSize: 12.5 }}><span className="m-pill-dot" /> 2 Lav</span>
          </div>
          <button className="m-bot-why" style={{ alignSelf: 'flex-end', color: 'var(--orange)' }} onClick={() => navigate('kartotek')}>Åpne kartoteket <Ic n="arrowRight" s={14} /></button>
        </div>

        {/* bento: vernerunde | insight */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="m-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5, textAlign: 'left' }} onClick={() => openOverlay('kontroll', { id: 'vern-uke', title: 'Vernerunde HMS', book: 'hms', chapter: 'HMS › Vernerunder og inspeksjoner', cat: 'vern' })}>
            <span className="m-quick-ic" style={{ marginBottom: 2 }}><Ic n="calClock" s={20} /></span>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', color: 'var(--muted)' }}>KOMMENDE</span>
            <span style={{ fontSize: 16, fontWeight: 650 }}>Vernerunde</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--orange)' }}>Torsdag, 14:00</span>
          </button>
          <div className="m-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <Ic n="trendUp" s={22} c="var(--orange)" sw={1.6} />
            <span style={{ fontSize: 30, fontWeight: 700, color: 'var(--orange)', letterSpacing: '-.02em' }} className="mono">+12%</span>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', color: 'var(--muted)', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.3 }}>Forbedring<br />vs forrige mnd</span>
          </div>
        </div>

        {/* dagens gjøremål */}
        <div className="m-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.16em', color: 'var(--muted)' }}>DAGENS GJØREMÅL</div>
          {[['t1', 'Brannøvelse-info sendt'], ['t2', 'Oppdater ansattliste HMS'], ['t3', 'Kontroll av førstehjelpsskrin']].map(([k, l]) => (
            <button key={k} onClick={() => toggle(k)} style={{ display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left' }}>
              <Ic n={tasks[k] ? 'checkCircle' : 'circle'} s={20} c={tasks[k] ? 'var(--success)' : 'var(--muted-soft)'} sw={tasks[k] ? 2 : 1.6} />
              <span style={{ fontSize: 14, fontWeight: 550, color: tasks[k] ? 'var(--muted)' : 'var(--fg)', textDecoration: tasks[k] ? 'line-through' : 'none' }}>{l}</span>
            </button>
          ))}
        </div>

        <button className="m-btn m-btn-primary m-btn-block" onClick={openAdd}><Ic n="plus" s={18} /> Meld avvik</button>
      </div>
    );
  }

  // =========================================================================
  // LØNN — Lønn & arbeid
  // =========================================================================
  const PAYSLIPS = [
    { id: 'p-apr', month: 'April 2026', sub: 'Utbetalt 12. mai', amount: 35045, status: 'paid' },
    { id: 'p-mar', month: 'Mars 2026', sub: 'Utbetalt 12. apr', amount: 33180, status: 'paid' },
    { id: 'p-feb', month: 'Februar 2026', sub: 'Utbetalt 12. mar', amount: 31920, status: 'paid' },
  ];
  function Lonn() {
    const { ME, toast, openOverlay } = window.useM();
    const firstName = ME.name.split(' ')[0];
    return (
      <div className="m-page">
        <div className="m-hero">
          <h1>Hei, {firstName}</h1>
          <div className="m-hero-sub"><span>Lønn, timebank og fravær på ett sted.</span></div>
        </div>

        {/* primary payroll card */}
        <div className="m-shift is-onshift" style={{ background: 'radial-gradient(130% 120% at 100% 0%, rgba(255,255,255,.16), transparent 52%), linear-gradient(150deg, var(--orange-dark), #7c2d09 75%)' }}>
          <div className="m-shift-top">
            <span className="m-shift-status">Estimert neste lønn</span>
            <span className="m-pill" style={{ background: 'rgba(255,255,255,.18)', color: '#fff', height: 22 }}>Mai · pågår</span>
          </div>
          <div className="m-shift-time">{fmtKr(36420)}<span style={{ fontSize: 18, opacity: .7 }}> kr</span></div>
          <div className="m-shift-meta">
            <span><Ic n="clock" s={13} style={{ verticalAlign: -2 }} /> 152 t registrert</span>
            <span className="m-dotsep" style={{ background: 'rgba(255,255,255,.4)' }} />
            <span>Utbetales 12. jun</span>
          </div>
        </div>

        {/* bento stats */}
        <div className="m-paygrid">
          <button className="m-paycard" onClick={() => openOverlay('payslip', PAYSLIPS[0])}>
            <div className="m-paycard-h"><Ic n="wallet" s={19} c="var(--orange)" sw={1.6} /><span>SISTE LØNN</span></div>
            <div className="m-paycard-v">{fmtKr(35045)}<small> kr</small></div>
          </button>
          <button className="m-paycard" onClick={() => toast('Åpner timebank')}>
            <div className="m-paycard-h"><Ic n="clock" s={19} c="var(--orange)" sw={1.6} /><span>TIMEBANK</span></div>
            <div className="m-paycard-v" style={{ color: 'var(--orange)' }}>+8<small> t</small></div>
          </button>
          <button className="m-paycard" onClick={() => toast('Åpner fraværssaldo')}>
            <div className="m-paycard-h"><Ic n="bars" s={19} c="var(--orange)" sw={1.6} /><span>SALDO</span></div>
            <div className="m-paycard-v">19<small> dager igjen</small></div>
          </button>
          <button className="m-paycard m-paycard-cta" onClick={() => openOverlay('absence')}>
            <div className="m-paycard-h"><Ic n="calClock" s={19} c="#fff" sw={1.6} /><span style={{ color: 'rgba(255,255,255,.75)' }}>SØKNAD</span></div>
            <div className="m-paycard-cta-b"><span>Nytt fravær</span><Ic n="arrowRight" s={18} c="#fff" /></div>
          </button>
        </div>

        {/* lønnsgrunnlag */}
        <div>
          <div className="m-sec-h"><h2>Siste lønnsgrunnlag</h2><button className="m-sec-link" onClick={() => toast('Alle lønnsgrunnlag')}>Se alle <Ic n="chevRight" s={13} /></button></div>
          <div className="m-card m-flush" style={{ marginTop: 10 }}>
            {PAYSLIPS.map(p => (
              <button key={p.id} className="m-row" style={{ width: '100%' }} onClick={() => openOverlay('payslip', p)}>
                <span className="m-row-ic" style={{ background: 'var(--secondary)', color: 'var(--muted)' }}><Ic n="file" s={17} /></span>
                <div className="m-row-body"><div className="m-row-title">{p.month}</div><div className="m-row-sub">{p.sub}</div></div>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 3, flex: '0 0 auto' }}>
                  <span className="mono" style={{ fontSize: 16, fontWeight: 700 }}>{fmtKr(p.amount)}</span>
                  <small style={{ fontSize: 11, color: 'var(--muted)' }}>kr</small>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* quick links */}
        <div className="m-list">
          <button className="m-list-item" onClick={() => openOverlay('doc', { id: 'kontrakt' })}>
            <span className="m-list-ic"><Ic n="file" s={17} /></span><span className="m-list-t">Arbeidskontrakt</span><Ic n="chevRight" s={17} c="var(--muted-soft)" />
          </button>
          <button className="m-list-item" onClick={() => openOverlay('doc', { id: 'tariff' })}>
            <span className="m-list-ic"><Ic n="gift" s={17} /></span><span className="m-list-t">Tariff og tillegg</span><Ic n="chevRight" s={17} c="var(--muted-soft)" />
          </button>
          <button className="m-list-item" onClick={() => openOverlay('doc', { id: 'personvern' })}>
            <span className="m-list-ic"><Ic n="shield" s={17} /></span><span className="m-list-t">Personvern og sikkerhet</span><Ic n="chevRight" s={17} c="var(--muted-soft)" />
          </button>
        </div>
      </div>
    );
  }

  window.SO_M_PAGES = Object.assign(window.SO_M_PAGES || {}, { trening: Trening, sikkerhet: Sikkerhet, lonn: Lonn });

  // =========================================================================
  // SHARED — Task detail bottom sheet (opened from Hjem + Oppgaver)
  // =========================================================================
  const D = window.SmartoutData;
  const MANUALS = D.MANUALS || {};
  const ORIGIN = D.ORIGIN || {};
  const BOOK_LABEL = { hms: 'HMS-håndbok', bedrift: 'Bedriftshåndbok', personal: 'Personalhåndbok', drift: 'Driftshåndbok', onboarding: 'Onboarding' };
  const SEC_TYPE = { text: ['Tekst', 'file'], video: ['Video', 'video'], image: ['Bilde', 'camera'], checklist: ['Sjekkliste', 'checklist'] };
  const PRI_SHEET = { critical: ['m-pill-crit', 'Kritisk'], high: ['m-pill-warn', 'Høy'], normal: ['m-pill-muted', 'Normal'], low: ['m-pill-muted', 'Lav'] };
  const ACT_ICON = { create: 'sparkle', start: 'clock', check: 'check', comment: 'message', assign: 'users' };

  function TaskSheet({ task, onClose }) {
    const { toast } = window.useM();
    const [subs, setSubs] = useState(() => (task.subtasks || []).reduce((m, s) => (m[s.id] = !!s.done, m), {}));
    const [flow, setFlow] = useState(false);
    const [full, setFull] = useState(false);
    const [ctrl, setCtrl] = useState(false);
    const ctrlForm = D.resolveControlForm ? D.resolveControlForm(task) : null;
    const total = (task.subtasks || []).length;
    const doneN = Object.values(subs).filter(Boolean).length;
    const origin = ORIGIN[task.origin];
    const [pcls, plabel] = PRI_SHEET[task.priority] || PRI_SHEET.normal;
    const overdue = task.status === 'overdue';
    const hasManual = !!(task.manual && MANUALS[task.manual]);
    const hasMore = hasManual || (!!task.book && !!task.chapter && task.origin !== 'adhoc');
    const toggleSub = (s) => setSubs(m => ({ ...m, [s.id]: !m[s.id] }));
    const complete = () => { toast(`«${task.title}» markert ferdig`); onClose(); };
    return (
      <div className="m-sheet-scrim" onClick={onClose}>
        <div className="m-sheet" onClick={e => e.stopPropagation()} style={{ height: '88%' }}>
          <div className="m-sheet-grip" />
          <div className="m-sheet-h">
            <h3>Oppgave</h3>
            <button className="m-iconbtn" style={{ marginLeft: 'auto' }} onClick={onClose}><Ic n="x" s={20} /></button>
          </div>
          <div className="m-sheet-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {origin && <span className="m-pill" style={{ background: origin.bg, color: origin.color }}>{origin.label}</span>}
              {task.cat === 'ikmat' && <span className="m-pill m-pill-info">IK-mat</span>}
              <span className={cls('m-pill', overdue ? 'm-pill-crit' : pcls)}><span className="m-pill-dot" /> {overdue ? 'Forsinket' : plabel}</span>
            </div>

            {/* title + meta */}
            <div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 25, lineHeight: 1.12, letterSpacing: '-.01em' }}>{task.title}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10, fontSize: 12.5, color: 'var(--muted)' }}>
                <span><Ic n="clock" s={13} style={{ verticalAlign: -2 }} /> Frist {task.deadline}{overdue ? ` · ${task.deadlineRel}` : ''}</span>
                {task.location && <span><Ic n="mappin" s={13} style={{ verticalAlign: -2 }} /> {task.location}</span>}
                {task.estimate && <span><Ic n="history" s={13} style={{ verticalAlign: -2 }} /> ~{task.estimate} min</span>}
              </div>
            </div>

            {task.description && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--fg)' }}>{task.description}</p>}

            {/* control form → Flow Controller (HMS · IK-mat · mottak · vern · vedlikehold) */}
            {ctrlForm && (
              <button className="m-row" style={{ width: '100%', border: '1px solid color-mix(in srgb, ' + ctrlForm.color + ' 38%, var(--border))', borderRadius: 'var(--r-card)', background: 'color-mix(in srgb, ' + ctrlForm.color + ' 7%, var(--card))' }} onClick={() => setCtrl(true)}>
                <span className="m-row-ic" style={{ background: ctrlForm.color, color: '#fff' }}><Ic n="checklist" s={17} /></span>
                <div className="m-row-body"><div className="m-row-title">Start kontroll</div><div className="m-row-sub">{ctrlForm.kind} · {ctrlForm.sections.reduce((n, s) => n + s.qs.length, 0)} kontroller · signeres</div></div>
                <span className="m-row-go"><Ic n="chevRight" s={16} /></span>
              </button>
            )}

            {/* subtasks — superseded by the Flow Controller for control tasks */}
            {!ctrlForm && total > 0 && (
              <div>
                <div className="m-sec-h" style={{ marginBottom: 8 }}><h2>Sjekkpunkter</h2><span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{doneN}/{total}</span></div>
                <div className="m-card m-flush">
                  <div className="m-tasklist">
                    {task.subtasks.map(s => (
                      <div key={s.id} className="m-task">
                        <button className={cls('m-task-check', subs[s.id] && 'is-done')} onClick={() => toggleSub(s)}><Ic n="check" s={15} sw={3} /></button>
                        <div className="m-task-body">
                          <div className={cls('m-task-title', subs[s.id] && 'is-done')}>{s.title}</div>
                          {s.value && <div className="m-task-meta"><span className="mono">{s.value}</span></div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* manual link → FlowPlayer */}
            {hasManual && (
              <button className="m-row" style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 'var(--r-card)' }} onClick={() => setFlow(true)}>
                <span className="m-row-ic" style={{ background: 'var(--orange-soft)', color: 'var(--orange)' }}><Ic n="bookOpen" s={17} /></span>
                <div className="m-row-body"><div className="m-row-title">Veiledning</div><div className="m-row-sub">{(MANUALS[task.manual].sections || []).length} steg · Slik utfører du den</div></div>
                <span className="m-row-go"><Ic n="play" s={16} /></span>
              </button>
            )}

            {/* activity */}
            {task.activity && task.activity.length > 0 && (
              <div>
                <div className="m-sec-h" style={{ marginBottom: 8 }}><h2>Aktivitet</h2></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {task.activity.map((a, i) => {
                    const u = D.USERS[a.user];
                    return (
                      <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <span className="m-avatar" style={{ background: u?.color || 'var(--muted)', width: 28, height: 28, fontSize: 10, flex: '0 0 auto' }}>{u?.initials || '?'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, lineHeight: 1.4 }}><b style={{ fontWeight: 650 }}>{u?.name.split(' ')[0]}</b> {a.text}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted-soft)', marginTop: 1 }}>{a.time}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* actions */}
          <div style={{ display: 'flex', gap: 8, padding: '10px 16px calc(16px + env(safe-area-inset-bottom,0px))', borderTop: '1px solid var(--border)' }}>
            {hasMore && <button className="m-btn m-btn-ghost" onClick={() => setFull(true)} style={{ flex: '0 0 auto' }}>Åpne hele</button>}
            <button className="m-btn m-btn-primary m-full" onClick={() => { if (ctrlForm) { setCtrl(true); } else { complete(); } }}><Ic n={ctrlForm ? 'checklist' : 'check'} s={17} /> {ctrlForm ? 'Start kontroll' : 'Marker ferdig'}</button>
          </div>

          {flow && window.MFlowPlayer && <window.MFlowPlayer manualId={task.manual} onClose={() => setFlow(false)} />}
          {ctrl && window.MFormViewer && <window.MFormViewer task={task} onClose={() => setCtrl(false)} />}
          {full && window.MTaskFull && <window.MTaskFull task={task} onClose={() => setFull(false)} />}
        </div>
      </div>
    );
  }
  window.MTaskSheet = TaskSheet;
})();
