// =============================================================================
// Smartout Mobile — HÅNDBØKER  (window.SO_M_PAGES.handbok)
// Employee-first handbook library + AI-guided onboarding. Built on the shared
// HANDBOOKS data (../web/shared/handbook-data.js) and the mobile .m-* layer.
// Library overview · first-time welcome · AI recommendation · handbook detail
// (chapters/progress/search/summaries) · document reader (sources, mark-as-
// understood, continue later) · loading/empty/error states. The interactive AI
// learning flow lives in handbok-learn.jsx (window.MHbLearn).
// Tweaks (welcome animation, AI tone) via the shared tweaks panel.
// =============================================================================
(function () {
  const { useState, useEffect, useRef } = React;
  const D = window.SmartoutData;
  const Ic = window.MIc;
  const cls = (...xs) => xs.filter(Boolean).join(' ');

  // ---- shared tweak store (single source; surfaced in the one app Tweaks panel
  //      mounted by notifications.jsx — avoids a conflicting second panel) ----
  if (!window.SmartoutTweaks) {
    window.SmartoutTweaks = (function () {
      const KEY = 'so_hb_tweaks';
      const defaults = { welcomeAnim: true, showWelcome: true, aiTone: 'rolig' };
      let vals; try { vals = Object.assign({}, defaults, JSON.parse(localStorage.getItem(KEY)) || {}); } catch { vals = Object.assign({}, defaults); }
      const subs = new Set();
      return {
        defaults,
        get: (k) => (k ? vals[k] : Object.assign({}, vals)),
        set: (k, v) => { vals = Object.assign({}, vals, { [k]: v }); try { localStorage.setItem(KEY, JSON.stringify(vals)); } catch {} subs.forEach(f => f(vals)); },
        subscribe: (f) => { subs.add(f); return () => subs.delete(f); },
      };
    })();
  }
  function useTweakStore() {
    const S = window.SmartoutTweaks;
    const [v, setV] = useState(() => (S ? S.get() : { welcomeAnim: true, showWelcome: true, aiTone: 'rolig' }));
    useEffect(() => { if (S) return S.subscribe(setV); }, []);
    return v;
  }

  // Portal full-cover surfaces into the phone frame (.m-app) so they size to the
  // device, not the tall scrollable page content (their containing block).
  function Portal({ children }) {
    const host = (typeof document !== 'undefined') && document.querySelector('.m-app');
    return host ? ReactDOM.createPortal(children, host) : children;
  }

  // ---- employee-facing books, in onboarding order (System is internal/admin) ----
  const BOOK_ORDER = ['personal', 'opplaering', 'hms', 'bedrift'];
  const allBooks = () => (D.HANDBOOKS || []);
  const book = (id) => allBooks().find(b => b.id === id);
  const empBooks = () => BOOK_ORDER.map(book).filter(Boolean);

  // a friendly one-line "why this matters to you" per book
  const BOOK_WHY = {
    personal: 'Rettigheter, lønn, ferie og hvordan vi har det sammen.',
    opplaering: 'Menyen, vinen og allergenene — bli trygg før service.',
    hms: 'Trygt arbeid og trygg mat — det du må kunne på vakt.',
    bedrift: 'Slik driver vi stedet: roller, rutiner og arbeidsflyt.',
  };

  // ---- understood-progress (per employee, persisted) ----
  const PKEY = 'so_hb_understood';
  const seedUnderstood = { 'p-culture-1': 1, 'p-time-1': 1, 'h-intro-1': 1, 'o-allergen-1': 1, 'b-org-1': 1 };
  function loadUnderstood() { try { const v = JSON.parse(localStorage.getItem(PKEY)); return v && typeof v === 'object' ? v : { ...seedUnderstood }; } catch { return { ...seedUnderstood }; } }
  const RKEY = 'so_hb_resume';
  function loadResume() { try { return JSON.parse(localStorage.getItem(RKEY)) || null; } catch { return null; } }

  const bookDocs = (b) => b.chapters.flatMap(c => c.docs);
  const bookPct = (b, u) => { const ds = bookDocs(b); return ds.length ? ds.filter(d => u[d.id]).length / ds.length : 0; };
  const overallPct = (u) => { const ds = empBooks().flatMap(bookDocs); return ds.length ? ds.filter(d => u[d.id]).length / ds.length : 0; };

  // ---- authored document bodies (rich for showcased docs; others derive from summary) ----
  // block: { h?, p?:[], list?:[] }
  const HB_BODY = {
    'p-culture-1': { read: 4, points: [
      'Gjesten først — men aldri på bekostning av en kollega som trenger en hånd.',
      'Vi snakker rett og rolig med hverandre, også når det er travelt.',
      'Du skal vite hva som forventes av deg — og hva du kan forvente av oss.',
    ], blocks: [
      { p: ['Bistro Nord er et sted folk skal ha lyst til å komme tilbake til — både gjester og ansatte. Kulturen vår handler om to ting samtidig: at gjesten føler seg sett, og at du føler deg trygg i jobben din.'] },
      { h: 'Verdiene våre', list: ['Gjesten først — alltid', 'Vi rydder for hverandre', 'Trygg mat, trygg drift', 'Snakk opp — meld fra, spør, foreslå'] },
      { h: 'Et samspill', p: ['Vi ber ikke om at du skal kunne alt fra dag én. Vi ber om at du møter forberedt, sier fra når noe er uklart, og er til stede når du er på. Til gjengjeld sørger vi for opplæring, tydelige rutiner og en leder du kan nå.'] },
    ] },
    'p-employ-1': { read: 3, points: [
      'Arbeidsavtalen din beskriver stilling, stillingsbrøk, prøvetid og oppsigelsestid.',
      'Lønn følger Riksavtalen — tariff og tillegg er ikke noe du må forhandle alene.',
      'Er noe i avtalen uklart, har du rett til å få det forklart før du signerer.',
    ], blocks: [
      { p: ['Arbeidsavtalen er grunnlaget for forholdet mellom deg og Bistro Nord. Den sier hva du er ansatt som, hvor mye du jobber, og hvilke vilkår som gjelder.'] },
      { h: 'Det viktigste i avtalen', list: ['Stilling og stillingsbrøk', 'Prøvetid (vanligvis 6 måneder)', 'Oppsigelsestid begge veier', 'Lønnstrinn etter Riksavtalen'] },
      { h: 'Lønnen din er regulert', p: ['Du skal ikke måtte krangle om grunnlønn eller tillegg. Satsene følger tariffavtalen, og kvelds-, helge- og helligdagstillegg legges på automatisk når vakta er registrert.'] },
    ] },
    'p-time-1': { read: 4, points: [
      'Ferie søkes i Smartout — jo tidligere, jo lettere å gå i hop med resten av laget.',
      'Hovedferien fordeles slik at stedet alltid har nok folk på jobb.',
      'Du har krav på ferien din; vi har ansvar for at den lar seg planlegge.',
    ], blocks: [
      { p: ['Ferie skal være ferie — forutsigbar og avklart i god tid. Derfor søker du ferie i Smartout, og leder ser hele lagets ønsker samlet.'] },
      { h: 'Slik fungerer det', list: ['Legg inn ferieønske så tidlig du kan', 'Hovedferie avklares samlet for hele laget', 'Du får svar i appen — ikke på en lapp', 'Høytider fordeles rettferdig over tid'] },
      { h: 'To sider av samme sak', p: ['Du sørger for å melde ønskene dine i tide. Vi sørger for at ferien faktisk lar seg gjennomføre uten at noen står alene på gulvet.'] },
    ] },
    'p-time-2': { read: 3, points: [
      'Egenmelding registreres i Smartout — ikke på SMS til en kollega.',
      'Meld fra så tidlig som mulig, så kan vakta dekkes opp.',
      'Du trenger ikke oppgi diagnose; bare at du er syk.',
    ], blocks: [
      { p: ['Blir du syk, er det viktigste at du sier fra tidlig — da rekker vi å løse bemanningen uten stress for de som er på jobb.'] },
      { h: 'Når du blir syk', list: ['Registrer egenmelding i Smartout', 'Meld fra før vakta starter hvis du kan', 'Egenmelding gjelder et visst antall dager per år', 'Ved lengre fravær trengs sykmelding'] },
    ] },
    'p-onboard-1': { read: 5, points: [
      'De første 30 dagene har en plan — du skal ikke gjette deg fram.',
      'Du får en fadder som viser deg hvordan ting faktisk gjøres her.',
      'Sjekkpunkter underveis sikrer at ingenting viktig blir hoppet over.',
    ], blocks: [
      { p: ['Den første måneden er lagt opp som en plan, ikke en prøvelse. Målet er at du skal kjenne deg trygg på rutiner, folk og system før du står med fullt ansvar.'] },
      { h: 'Dag for dag', list: ['Uke 1: bli kjent med stedet, laget og de viktigste rutinene', 'Uke 2–3: skygg en fadder, øv på menyen og systemet', 'Uke 4: ta mer ansvar med fadder tilgjengelig', 'Underveis: korte sjekkpunkter med leder'] },
    ] },
    'b-org-1': { read: 4, points: [
      'Stedet er delt i avdelinger: Kjøkken, Sal, Bar, Event og Lager.',
      'Lag og områder bestemmer hvem du jobber tett med og hvem du spør.',
      'Du trenger ikke kunne hele kartet — bare vite hvor du hører til.',
    ], blocks: [
      { p: ['Bistro Nord er organisert i avdelinger og lag. Det er ikke byråkrati — det er for at du alltid skal vite hvem du jobber sammen med og hvem du går til når noe skjer.'] },
      { h: 'Avdelingene', list: ['Kjøkken — mat og HACCP', 'Sal — service og gjester', 'Bar — drikke og skjenking', 'Event — selskaper og store bookinger', 'Lager — varer og mottak'] },
    ] },
    'h-intro-1': { read: 4, points: [
      'HMS handler om at du går like trygg hjem som du kom på jobb.',
      'Internkontrollen gjelder alle — fra eier til ekstravakt.',
      'Det er bedre å melde ti små avvik enn å tie om ett stort.',
    ], blocks: [
      { p: ['HMS — helse, miljø og sikkerhet — er ikke et skjema. Det er måten vi sørger for at både du, kollegene dine og gjestene er trygge gjennom en hel vakt.'] },
      { h: 'Hva internkontrollen dekker', list: ['Trygt arbeidsmiljø og sikre rutiner', 'Trygg mat (IK-mat / HACCP)', 'Avvik: meld, så lærer vi av det', 'Beredskap når noe først skjer'] },
      { h: 'Ditt og vårt ansvar', p: ['Vi sørger for utstyr, opplæring og rutiner. Du sørger for å følge dem, og for å si fra når noe ikke stemmer. Et avvik er ikke en anklage — det er en mulighet til å fikse noe før det blir farlig.'] },
    ] },
    'h-proc-2': { read: 3, points: [
      'Kjøl og frys måles hver dag — temperatur er det første som svikter.',
      'Avvik logges med en gang, ikke «når du rekker det».',
      'Kontrollen er koblet til oppgaven «Morgenrutine kjøl» på vakta di.',
    ], blocks: [
      { p: ['Temperaturkontroll er hjørnesteinen i mattryggheten. Et kjøleskap som sniker seg opp i temperatur er den vanligste årsaken til at mat blir utrygg.'] },
      { h: 'Slik gjør du det', list: ['Mål kjøl og frys etter HACCP-rutinen', 'Logg verdien i Smartout med en gang', 'Avvik? Meld det og flytt varene', 'Følg opp at temperaturen kommer tilbake'] },
    ] },
    'o-allergen-1': { read: 5, points: [
      'Det finnes 14 lovpålagte allergener — du må kjenne alle.',
      'Ved tvil: sjekk oppslaget eller spør kjøkkenet. Aldri gjett.',
      'Krysskontaminering er like alvorlig som allergenet i selve retten.',
    ], blocks: [
      { p: ['Allergener er noe av det viktigste du lærer her. For de fleste gjester er en feil ubehagelig — for noen kan den være livstruende. Derfor tar vi det rolig og grundig.'] },
      { h: 'De 14 allergenene', p: ['Gluten, skalldyr, egg, fisk, peanøtter, soya, melk, nøtter, selleri, sennep, sesam, svoveldioksid, lupin og bløtdyr.'] },
      { h: 'Gylne regler', list: ['Er du i tvil, behandle retten som om den inneholder allergenet', 'Sjekk allergenoppslaget eller spør kjøkkenet før du svarer', 'Tenk på krysskontaminering — samme redskap, samme flate', 'Meld avvik hvis noe går galt, så lærer vi av det'] },
    ] },
    'o-mat-1': { read: 4, points: [
      'Du skal kunne beskrive hovedrettene med trygghet, ikke pugge en liste.',
      'Råvarer, tilberedning og allergener hører sammen for hver rett.',
      'En quiz hjelper deg å sjekke at det sitter — uten press.',
    ], blocks: [
      { p: ['Menykunnskap handler om å kunne svare gjesten med selvtillit. Når du kjenner rettene, blir mersalg naturlig og allergispørsmål trygge.'] },
      { h: 'For hver hovedrett', list: ['Hovedråvarer og opprinnelse', 'Slik er den tilberedt', 'Allergener gjesten må vite om', 'En god paring fra vin- eller drikkekartet'] },
    ] },
  };

  // derive 2–3 key points from a summary string
  function deriverPoints(summary) {
    if (!summary) return ['Les gjennom og marker som forstått når du er klar.'];
    return summary.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean).slice(0, 3);
  }

  // locate a doc anywhere in HANDBOOKS
  function locate(docId) {
    for (const b of allBooks()) for (const c of b.chapters) {
      const d = c.docs.find(x => x.id === docId);
      if (d) return { b, c, d };
    }
    return null;
  }

  // journeys linked from documents (reader gets a "ta gjennomgang"-banner)
  const DOC_JOURNEY = {
    'p-time-1': 'lonn', 'p-time-2': 'lonn', 'p-employ-1': 'lonn',
    'o-allergen-1': 'allergen', 'o-allergen-2': 'allergen', 'h-proc-2': 'allergen',
  };

  const STATE_PILL = (st) => {
    const m = { approved: ['m-pill-ok', 'Godkjent'], review: ['m-pill-info', 'Til gjennomgang'], draft: ['m-pill-muted', 'Utkast'], outdated: ['m-pill-warn', 'Utdatert'], archived: ['m-pill-muted', 'Arkivert'] };
    return m[st] || m.approved;
  };

  // ---- compact progress ring ----
  function Ring({ pct, size = 44, sw = 5, color = 'var(--orange)', track = 'rgba(255,255,255,.28)', label }) {
    const r = (size - sw) / 2, c = 2 * Math.PI * r;
    return (
      <span style={{ position: 'relative', width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={size} height={size}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={sw} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw}
            strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(.2,.8,.3,1)' }} />
        </svg>
        <span style={{ position: 'absolute', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: size * 0.27, color: label || color }}>{Math.round(pct * 100)}</span>
      </span>
    );
  }

  // =========================================================================
  // WELCOME — premium first-visit moment (shows on every entry, per demo setting)
  // =========================================================================
  function Welcome({ anim, tone, onStart, onSkip }) {
    const [closing, setClosing] = useState(false);
    const go = (fn) => { setClosing(true); setTimeout(fn, 300); };
    const lead = tone === 'energisk'
      ? 'Her finner du alt du trenger for å komme skikkelig godt i gang hos oss — og jeg er med deg hele veien.'
      : 'Her finner du det viktigste du trenger for å lykkes hos oss. Vi tar det rolig, litt etter litt.';
    return (
      <div className={cls('m-hbx-welcome', anim && 'anim', closing && 'closing')} role="dialog" aria-label="Velkommen">
        <div className="m-hbx-wel-body">
          <span className="m-hbx-wel-mark"><Ic n="bookOpen" s={28} c="#fff" /></span>
          <div className="m-hbx-wel-eyebrow">Håndbøker · Bistro Nord</div>
          <h1>Bra, nå er du her.</h1>
          <p>{lead}</p>
          <div className="m-hbx-wel-points">
            <div className="m-hbx-wel-point"><span className="m-hbx-wel-point-ic"><Ic n="bookOpen" s={16} c="#fff" /></span><span className="m-hbx-wel-point-t">Jeg har samlet alle håndbøkene på ett sted</span></div>
            <div className="m-hbx-wel-point"><span className="m-hbx-wel-point-ic"><Ic n="bot" s={16} c="#fff" /></span><span className="m-hbx-wel-point-t">Jeg forklarer det viktigste for deg</span></div>
            <div className="m-hbx-wel-point"><span className="m-hbx-wel-point-ic"><Ic n="checkCircle" s={16} c="#fff" /></span><span className="m-hbx-wel-point-t">Jeg går i ditt tempo — fortsett når du vil</span></div>
          </div>
          <div className="m-hbx-wel-acts">
            <button className="m-btn m-btn-light m-solid m-btn-block" onClick={() => go(onStart)}>Kom i gang <Ic n="arrowRight" s={17} /></button>
            <button className="m-hbx-wel-skip" onClick={() => go(onSkip)}>Hopp over</button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // AI RECOMMENDATION — the guided-learning suggestion module
  // =========================================================================
  function AiRec({ tone, onStart, onBrowse, navigate }) {
    const { toast } = window.useM();
    const body = tone === 'energisk'
      ? <>Har du 10 minutter? La oss ta <b>hvordan lønn fungerer</b> sammen — frister, tillegg og hva du kan forvente. Det er faktisk ganske gøy når man skjønner det.</>
      : <>Har du 10 minutter nå? Jeg anbefaler en rask gjennomgang av <b>hvordan lønn fungerer</b>. Det gir deg trygghet på frister, rutiner, ansvar og hva du kan forvente fra arbeidsgiver.</>;
    return (
      <div className="m-hbx-rec">
        <div className="m-hbx-rec-h">
          <span className="m-hbx-rec-ava"><Ic n="bot" s={18} c="#fff" /></span>
          <b>Mr. Botsson</b>
          <span className="m-hbx-rec-tag" style={{ marginLeft: 'auto' }}>Anbefaling</span>
        </div>
        <div className="m-hbx-rec-body">{body}</div>
        <div className="m-hbx-rec-meta">
          <span className="m-pill m-pill-info"><Ic n="clock" s={11} /> 10 min</span>
          <span>·</span><span>5 korte steg</span><span>·</span><span>teller mot ansiennitet</span>
        </div>
        <div className="m-hbx-rec-acts">
          <button className="m-btn m-btn-primary m-btn-block" onClick={() => onStart('lonn')}>
            <Ic n="play" s={16} /> Start 10-minutters gjennomgang
          </button>
          <div className="m-hbx-rec-row">
            <button className="m-btn m-btn-ghost m-full" onClick={onBrowse}>Vis håndbøkene først</button>
            <button className="m-btn m-btn-ghost m-full" onClick={() => toast('Lagt til. Jeg minner deg på det senere.')}>Ta dette senere</button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // SEARCH RESULTS (across all employee books)
  // =========================================================================
  function highlight(text, q) {
    if (!q) return text;
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return text;
    return <>{text.slice(0, i)}<mark className="m-hbx-hl">{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
  }
  function Results({ q, onOpen }) {
    const ql = q.toLowerCase();
    const hits = [];
    empBooks().forEach(b => b.chapters.forEach(c => c.docs.forEach(d => {
      if (d.title.toLowerCase().includes(ql) || (d.summary || '').toLowerCase().includes(ql) || c.title.toLowerCase().includes(ql))
        hits.push({ b, c, d });
    })));
    if (!hits.length) return (
      <div className="m-card"><div className="m-empty" style={{ padding: 30 }}>
        <Ic n="search" s={28} /><b>Ingen treff på «{q}»</b><p>Prøv et annet ord, eller spør Mr. Botsson — han finner riktig avsnitt for deg.</p>
      </div></div>
    );
    return (
      <div className="m-hbx-results">
        {hits.slice(0, 14).map(({ b, c, d }) => (
          <button key={d.id} className="m-hbx-result" onClick={() => onOpen(d.id)}>
            <span className="m-hbx-result-ic" style={{ background: b.accent }}><Ic n={b.icon} s={17} c="#fff" /></span>
            <span className="m-hbx-result-b">
              <span className="m-hbx-result-crumb">{b.short} · {c.title}</span>
              <span className="m-hbx-result-t">{highlight(d.title, q)}</span>
            </span>
            <Ic n="chevRight" s={17} c="var(--muted-soft)" />
          </button>
        ))}
      </div>
    );
  }

  // =========================================================================
  // DOCUMENT READER (full-cover) — loading / error / ready
  // =========================================================================
  const ERROR_DOC = 'b-flow-4'; // outdated "Dagsoppgjør" — demonstrates an error→retry→fallback
  function Reader({ docId, understood, onUnderstood, onClose, onOpenDoc, onLearn, tone }) {
    const loc = locate(docId);
    const [phase, setPhase] = useState('loading'); // loading | error | ready
    const attempt = useRef(0);
    const { toast } = window.useM();
    useEffect(() => {
      setPhase('loading'); attempt.current += 1;
      const isErr = docId === ERROR_DOC && attempt.current <= 1;
      const t = setTimeout(() => setPhase(isErr ? 'error' : 'ready'), 420);
      return () => clearTimeout(t);
    }, [docId]);

    if (!loc) return null;
    const { b, c, d } = loc;
    const authored = HB_BODY[docId];
    const points = (authored && authored.points) || deriverPoints(d.summary);
    const blocks = (authored && authored.blocks) || [{ p: [d.summary || 'Dette dokumentet er kort. Marker som forstått når du har lest det, eller spør Mr. Botsson om du vil ha det forklart.'] }];
    const readMin = (authored && authored.read) || 3;
    const isUnderstood = !!understood[docId];
    const journey = DOC_JOURNEY[docId];
    const [pp] = STATE_PILL(d.state);

    const retry = () => { setPhase('loading'); setTimeout(() => setPhase('ready'), 480); };

    return (
      <div className="m-vakt" role="dialog" aria-label={d.title}>
        <div className="m-vakt-head">
          <button className="m-iconbtn" onClick={onClose} aria-label="Lukk"><Ic n="chevDown" s={24} /></button>
          <div className="m-vakt-htitle">{b.short}</div>
          <span />
        </div>

        {phase === 'loading' && (
          <div className="m-vakt-body">
            <div className="m-hbx-shimmer" style={{ height: 13, width: '40%' }} />
            <div className="m-hbx-shimmer" style={{ height: 30, width: '88%', marginTop: -6 }} />
            <div className="m-hbx-skel" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="m-hbx-shimmer" style={{ height: 12 }} /><div className="m-hbx-shimmer" style={{ height: 12, width: '92%' }} /><div className="m-hbx-shimmer" style={{ height: 12, width: '70%' }} />
            </div>
            <div className="m-hbx-shimmer" style={{ height: 90, borderRadius: 14 }} />
            <div className="m-hbx-shimmer" style={{ height: 12, width: '95%' }} /><div className="m-hbx-shimmer" style={{ height: 12, width: '85%' }} />
          </div>
        )}

        {phase === 'error' && (
          <div className="m-vakt-body" style={{ justifyContent: 'center' }}>
            <div className="m-hbx-error">
              <span className="m-hbx-error-ic"><Ic n="alert" s={28} /></span>
              <h3>Fikk ikke lastet dokumentet</h3>
              <p>Kilden ser ut til å være utdatert, så jeg klarte ikke hente hele teksten akkurat nå.</p>
            </div>
            <button className="m-btn m-btn-primary m-btn-block" onClick={retry}><Ic n="history" s={16} /> Prøv igjen</button>
            <button className="m-btn m-btn-ghost m-btn-block" onClick={onClose}>Tilbake til kapitlene</button>
          </div>
        )}

        {phase === 'ready' && (
          <div className="m-vakt-body">
            <div className="m-hbx-rd-crumb"><Ic n="bookOpen" s={12} /> {b.short} <Ic n="chevRight" s={11} /> {c.title}</div>
            <h1 className="m-hbx-rd-title">{d.title}</h1>
            <div className="m-hbx-rd-meta">
              <span className={cls('m-pill', pp)}>{STATE_PILL(d.state)[1]}</span>
              <span className="sep" />
              <span className="m-avatar" style={{ background: (d.owner && d.owner.color) || b.accent }}>{(d.owner && d.owner.init) || 'BN'}</span>
              <span>{(d.owner && d.owner.name) || 'Bistro Nord'}</span>
              <span className="sep" /><span>Oppdatert {d.updated || '12. mai 2026'}</span>
              <span className="sep" /><span>{readMin} min</span>
            </div>

            {/* Botsson key summary */}
            <div className="m-hbx-sum">
              <div className="m-hbx-sum-h">
                <span className="m-hbx-rec-ava"><Ic n="bot" s={15} c="#fff" /></span>
                <b>Kort fortalt</b><span>Botsson</span>
              </div>
              <ul>{points.map((p, i) => <li key={i}><Ic n="checkCircle" s={16} /> {p}</li>)}</ul>
            </div>

            {/* learning-journey banner */}
            {journey && (
              <button className="m-hbx-learncta" onClick={() => onLearn(journey)}>
                <span className="m-hbx-rec-ava"><Ic n="play" s={16} c="#fff" /></span>
                <span className="m-hbx-learncta-b">
                  <b>{journey === 'lonn' ? 'Ta 10-min gjennomgang av lønn' : 'Ta gjennomgangen: Allergener i praksis'}</b>
                  <small>La meg forklare dette steg for steg, med en sjekk underveis.</small>
                </span>
                <Ic n="chevRight" s={18} c="var(--orange)" />
              </button>
            )}

            {/* body */}
            {blocks.map((bl, i) => (
              <div key={i} className="m-hbx-rd-block">
                {bl.h && <h2>{bl.h}</h2>}
                {(bl.p || []).map((p, j) => <p key={j}>{p}</p>)}
                {bl.list && <ul>{bl.list.map((l, k) => <li key={k}>{l}</li>)}</ul>}
              </div>
            ))}

            {/* sources / references */}
            <div className="m-hbx-src-h" style={{ marginTop: 4 }}>Kilde og henvisninger</div>
            <div className="m-hbx-chips">
              <div className="m-hbx-chip"><Ic n="bookOpen" s={14} /> {b.name} <small>· {c.title}</small></div>
              {(d.related || []).slice(0, 2).map((rt, i) => {
                const m = empBooks().flatMap(bk => bk.chapters.flatMap(ch => ch.docs)).find(x => x.title === rt);
                return <button key={i} className="m-hbx-chip" onClick={() => m && onOpenDoc(m.id)}><Ic n="file" s={14} /> {rt}</button>;
              })}
              <button className="m-hbx-chip" onClick={() => window.useM && toast('Botsson åpner — spør om dette dokumentet')}><Ic n="bot" s={14} /> Spør om dette</button>
            </div>
          </div>
        )}

        {phase === 'ready' && (
          <div className="m-hbx-rd-foot">
            {isUnderstood ? (
              <>
                <button className="m-btn m-btn-ghost" style={{ flex: '0 0 auto' }}
                  onClick={() => { onUnderstood(docId, false); toast('Fjernet markering', { undo: () => onUnderstood(docId, true) }); }}>
                  <Ic n="checkCircle" s={17} /> Forstått
                </button>
                <button className="m-btn m-btn-primary m-full" onClick={onClose}><Ic n="chevLeft" s={17} /> Tilbake</button>
              </>
            ) : (
              <>
                <button className="m-btn m-btn-primary m-full"
                  onClick={() => { onUnderstood(docId, true); toast('Markert som forstått', { undo: () => onUnderstood(docId, false) }); }}>
                  <Ic n="check" s={17} /> Marker som forstått
                </button>
                <button className="m-btn m-btn-ghost" style={{ flex: '0 0 auto' }} onClick={() => { toast('Lagret. Du finner det igjen her.'); onClose(); }}>Senere</button>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // HANDBOOK DETAIL (full-cover) — hero, search, chapter accordion, empty states
  // =========================================================================
  // Smooth accordion body. max-height is set ONLY via direct DOM (never in JSX
  // style) so React re-renders can't clobber it; a forced reflow on close makes
  // both directions transition to the measured height (no over-shoot snap).
  function ChapDocs({ open, children }) {
    const ref = useRef(null);
    useEffect(() => {
      const el = ref.current; if (!el) return;
      if (open) {
        el.style.maxHeight = el.scrollHeight + 'px';
        const onEnd = (e) => { if (e.propertyName === 'max-height') { el.style.maxHeight = 'none'; el.removeEventListener('transitionend', onEnd); } };
        el.addEventListener('transitionend', onEnd);
        return () => el.removeEventListener('transitionend', onEnd);
      }
      el.style.maxHeight = el.scrollHeight + 'px'; // pin (handles prior 'none')
      void el.offsetHeight;                        // force reflow
      el.style.maxHeight = '0px';                   // → transitions to 0
    }, [open]);
    return (
      <div ref={ref} className={cls('m-hbx-chap-docs', open && 'open')}>
        {children}
      </div>
    );
  }
  function Detail({ bookId, understood, onUnderstood, onClose, onOpenDoc, tone }) {
    const b = book(bookId);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState('');
    const [open, setOpen] = useState({});
    useEffect(() => { setLoading(true); const t = setTimeout(() => setLoading(false), 460); return () => clearTimeout(t); }, [bookId]);
    if (!b) return null;
    const ds = bookDocs(b);
    const understoodN = ds.filter(d => understood[d.id]).length;
    const pct = ds.length ? understoodN / ds.length : 0;
    const ql = q.toLowerCase();
    const chapters = b.chapters.map(c => ({ ...c, shown: c.docs.filter(d => !q || d.title.toLowerCase().includes(ql) || (d.summary || '').toLowerCase().includes(ql)) }))
      .filter(c => !q || c.shown.length);

    return (
      <div className="m-vakt" role="dialog" aria-label={b.name}>
        <div className="m-vakt-head">
          <button className="m-iconbtn" onClick={onClose} aria-label="Lukk"><Ic n="chevDown" s={24} /></button>
          <div className="m-vakt-htitle">{b.short}</div>
          <span />
        </div>
        <div className="m-vakt-body">
          {/* hero */}
          <div className="m-hbx-hero" style={{ background: `linear-gradient(155deg, ${b.accent}, color-mix(in oklab, ${b.accent} 62%, #000))` }}>
            <div className="m-hbx-hero-top">
              <span className="m-hbx-hero-ic"><Ic n={b.icon} s={26} c="#fff" /></span>
              <span className="m-hbx-hero-tt">
                <span className="m-hbx-hero-tag">{b.tagline}</span>
                <h1>{b.name}</h1>
              </span>
              <span className="m-hbx-hstat-ring"><Ring pct={pct} size={46} color="#fff" label="#fff" /></span>
            </div>
            <p className="m-hbx-hero-desc">{b.desc}</p>
            <div className="m-hbx-hero-stats">
              <span className="m-hbx-hstat"><b>{b.chapters.length}</b><span>Kapitler</span></span>
              <span className="m-hbx-hstat"><b>{ds.length}</b><span>Dokumenter</span></span>
              <span className="m-hbx-hstat"><b>{understoodN}</b><span>Forstått</span></span>
            </div>
          </div>

          {/* search within book */}
          <div className="m-hbx-search" style={{ boxShadow: 'none' }}>
            <Ic n="search" s={18} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder={`Søk i ${b.short.toLowerCase()}…`} />
            {q && <button className="m-hbx-clear" onClick={() => setQ('')}><Ic n="x" s={16} /></button>}
          </div>

          {loading ? (
            <>
              {[0, 1, 2].map(i => (
                <div key={i} className="m-hbx-skel" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="m-hbx-shimmer" style={{ width: 28, height: 28, borderRadius: 9 }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                    <div className="m-hbx-shimmer" style={{ height: 13, width: '70%' }} />
                    <div className="m-hbx-shimmer" style={{ height: 10, width: '40%' }} />
                  </div>
                </div>
              ))}
            </>
          ) : chapters.length === 0 ? (
            <div className="m-card"><div className="m-empty" style={{ padding: 30 }}><Ic n="search" s={28} /><b>Ingen treff</b><p>Prøv et annet ord i {b.short}.</p></div></div>
          ) : chapters.map(c => {
            const isOpen = q ? true : (open[c.id] || false);
            const cu = c.docs.filter(d => understood[d.id]).length;
            return (
              <div key={c.id} className={cls('m-hbx-chap', isOpen && 'open')}>
                <button className="m-hbx-chap-h" onClick={() => setOpen(s => ({ ...s, [c.id]: !isOpen }))}>
                  <span className="m-hbx-chap-n">{c.n}</span>
                  <span className="m-hbx-chap-b">
                    <span className="m-hbx-chap-t">{c.title}</span>
                    <span className="m-hbx-chap-meta">
                      {c.docs.length ? <>{cu}/{c.docs.length} forstått <span className="m-hbx-chap-prog"><span style={{ width: `${c.docs.length ? cu / c.docs.length * 100 : 0}%` }} /></span></> : 'Tomt kapittel'}
                    </span>
                  </span>
                  <Ic n="chevDown" s={18} c="var(--muted-soft)" style={{ flex: '0 0 auto', transition: 'transform .2s', transform: isOpen ? 'rotate(180deg)' : 'none' }} />
                </button>
                <ChapDocs open={isOpen}>
                    {(q ? c.shown : c.docs).length === 0 ? (
                      <div className="m-empty" style={{ padding: '22px 16px' }}><Ic n="file" s={24} /><b>Ingen dokumenter ennå</b><p>Botsson kan foreslå innhold til dette kapittelet.</p></div>
                    ) : (q ? c.shown : c.docs).map(d => {
                      const [pcl, plabel] = STATE_PILL(d.state);
                      const u = !!understood[d.id];
                      return (
                        <button key={d.id} className="m-hbx-doc" tabIndex={isOpen ? 0 : -1} onClick={() => onOpenDoc(d.id)}>
                          <span className={cls('m-hbx-doc-check', u && 'understood')}><Ic n="check" s={14} sw={3} /></span>
                          <span className="m-hbx-doc-b">
                            <span className="m-hbx-doc-t">{d.title}</span>
                            {d.summary && <span className="m-hbx-doc-s">{d.summary}</span>}
                            <span className="m-hbx-doc-meta">
                              <span className={cls('m-pill', pcl)}>{plabel}</span>
                              {DOC_JOURNEY[d.id] && <span className="m-pill m-pill-info"><Ic n="play" s={10} /> Gjennomgang</span>}
                            </span>
                          </span>
                          <Ic n="chevRight" s={18} c="var(--muted-soft)" />
                        </button>
                      );
                    })}
                </ChapDocs>
              </div>
            );
          })}

          {!loading && (
            <div className="m-bot" style={{ padding: '14px 15px' }}>
              <div className="m-bot-h"><span className="m-bot-ava"><Ic n="bot" s={16} /></span><b>Botsson</b><span className="m-bot-tag">Tips</span></div>
              <div className="m-bot-body">Du trenger ikke lese alt på én gang. Begynn med det som er merket «Gjennomgang» — så forklarer jeg det viktigste for deg.</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // LIBRARY PAGE
  // =========================================================================
  function Library() {
    const { navigate, toast } = window.useM();
    const t = useTweakStore();
    const tone = t.aiTone === 'energisk' ? 'energisk' : 'rolig';

    const [welcome, setWelcome] = useState(() => !!(window.SmartoutTweaks ? window.SmartoutTweaks.get().showWelcome : true));
    // respect the «Vis velkomst» tweak — turning it on re-shows, off hides; and
    // dismissing persists it OFF so it doesn't appear on every entry.
    useEffect(() => { setWelcome(!!t.showWelcome); }, [t.showWelcome]);
    const dismissWelcome = () => { setWelcome(false); if (window.SmartoutTweaks) window.SmartoutTweaks.set('showWelcome', false); };
    const [q, setQ] = useState('');
    const [detailId, setDetailId] = useState(null);
    const [readerStack, setReaderStack] = useState([]); // doc ids; last = top
    const [learnId, setLearnId] = useState(null);
    const [understood, setUnderstood] = useState(loadUnderstood);
    const [resume, setResume] = useState(loadResume);
    const recRef = useRef(null);

    useEffect(() => { try { localStorage.setItem(PKEY, JSON.stringify(understood)); } catch {} }, [understood]);

    const setU = (id, val) => setUnderstood(s => { const n = { ...s }; if (val) n[id] = 1; else delete n[id]; return n; });
    const openDoc = (id) => setReaderStack(s => [...s, id]);
    const popDoc = () => setReaderStack(s => s.slice(0, -1));
    const openLearn = (id) => { setLearnId(id); setReaderStack([]); };
    const browse = () => { if (recRef.current) recRef.current.scrollIntoView ? null : null; toast('Bla ned for å se håndbøkene'); };

    const completeLearn = (id, payload) => {
      // mark linked docs understood + clear resume
      const linked = Object.keys(DOC_JOURNEY).filter(k => DOC_JOURNEY[k] === id);
      setUnderstood(s => { const n = { ...s }; linked.forEach(k => n[k] = 1); return n; });
      setResume(null); try { localStorage.removeItem(RKEY); } catch {}
    };
    const saveResume = (r) => { setResume(r); try { localStorage.setItem(RKEY, JSON.stringify(r)); } catch {} };

    const overall = overallPct(understood);
    const JN = { lonn: 'Hvordan lønn fungerer', allergen: 'Allergener i praksis' };

    return (
      <div className="m-page">
        {/* intro */}
        <div className="m-hbx-intro">
          <h1>Håndbøker</h1>
          <p>Alt du trenger for å være trygg og god i jobben — samlet ett sted.</p>
          <div className="m-hbx-prog">
            <span className="m-hbx-prog-pct">{Math.round(overall * 100)}%</span>
            <span className="m-hbx-prog-bar"><span style={{ width: `${overall * 100}%` }} /></span>
            <span className="m-hbx-prog-lbl">av det viktigste<br />gjennomgått</span>
          </div>
        </div>

        {/* search */}
        <div className="m-hbx-search">
          <Ic n="search" s={18} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Søk i alle håndbøker…" aria-label="Søk" />
          {q && <button className="m-hbx-clear" onClick={() => setQ('')}><Ic n="x" s={16} /></button>}
        </div>

        {q ? <Results q={q} onOpen={openDoc} /> : (
          <>
            {/* resume */}
            {resume && (
              <button className="m-hbx-resume" onClick={() => openLearn(resume.id)}>
                <span className="m-hbx-resume-ic"><Ic n="play" s={20} /></span>
                <span className="m-hbx-resume-b">
                  <span className="m-hbx-resume-k">Fortsett der du slapp</span>
                  <span className="m-hbx-resume-t">{JN[resume.id] || 'Gjennomgang'}</span>
                  <span className="m-hbx-resume-bar"><span style={{ width: `${Math.round((resume.pct || 0) * 100)}%` }} /></span>
                </span>
                <Ic n="chevRight" s={18} c="var(--muted-soft)" />
              </button>
            )}

            {/* AI recommendation */}
            <div ref={recRef}><AiRec tone={tone} onStart={openLearn} onBrowse={browse} navigate={navigate} /></div>

            {/* handbook cards */}
            <div>
              <div className="m-hbx-sec"><h2>Håndbøkene dine</h2><small>{empBooks().length} bøker</small></div>
              <div className="m-hbx-books">
                {empBooks().map(b => {
                  const pct = bookPct(b, understood);
                  const ds = bookDocs(b);
                  return (
                    <button key={b.id} className="m-hbx-book" onClick={() => setDetailId(b.id)}>
                      <span className="m-hbx-book-top">
                        <span className="m-hbx-book-ic" style={{ background: b.accent }}><Ic n={b.icon} s={23} c="#fff" /></span>
                        <span className="m-hbx-book-h">
                          <span className="m-hbx-book-title">{b.name}</span>
                          <span className="m-hbx-book-tag">{BOOK_WHY[b.id] || b.tagline}</span>
                        </span>
                        <span className="m-hbx-book-ring"><Ring pct={pct} size={42} color={b.accent} track="var(--secondary)" label="var(--fg)" /></span>
                      </span>
                      <span className="m-hbx-book-pbar"><span style={{ width: `${pct * 100}%`, background: b.accent }} /></span>
                      <span className="m-hbx-book-foot">
                        <span>{b.chapters.length} kapitler</span><span className="sep" />
                        <span>{ds.length} dok.</span><span className="sep" />
                        <span>Oppdatert {b.chapters[0] && b.chapters[0].docs[0] ? (b.chapters[0].docs[0].updated || 'mai 2026') : 'mai 2026'}</span>
                        <span className="m-hbx-open">Åpne <Ic n="chevRight" s={14} /></span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* two-sided framing */}
            <div className="m-hbx-two">
              <div className="m-hbx-two-h">
                <h2>Slik jobber vi sammen</h2>
                <p>Smartout handler ikke om kontroll eller mas. Det handler om et samspill der begge sider gjør sin del.</p>
              </div>
              <div className="m-hbx-two-grid">
                <div className="m-hbx-two-col provide">
                  <h3><Ic n="building" s={13} /> Bedriften sørger for</h3>
                  <ul>
                    <li><Ic n="checkCircle" s={14} c="var(--info)" /> Riktig lønn til avtalt tid</li>
                    <li><Ic n="checkCircle" s={14} c="var(--info)" /> Opplæring og tydelige rutiner</li>
                    <li><Ic n="checkCircle" s={14} c="var(--info)" /> Trygt arbeidsmiljø og utstyr</li>
                    <li><Ic n="checkCircle" s={14} c="var(--info)" /> En leder du kan nå</li>
                  </ul>
                </div>
                <div className="m-hbx-two-col responsible">
                  <h3><Ic n="user" s={13} /> Du sørger for</h3>
                  <ul>
                    <li><Ic n="checkCircle" s={14} c="var(--orange)" /> Registrere timer og fravær i tide</li>
                    <li><Ic n="checkCircle" s={14} c="var(--orange)" /> Møte forberedt og til stede</li>
                    <li><Ic n="checkCircle" s={14} c="var(--orange)" /> Følge rutinene du har lært</li>
                    <li><Ic n="checkCircle" s={14} c="var(--orange)" /> Si fra — spør, foreslå, meld avvik</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}

        {/* layers — portaled into .m-app so they cover the device frame */}
        {detailId && (
          <Portal><Detail bookId={detailId} understood={understood} onUnderstood={setU} onClose={() => setDetailId(null)} onOpenDoc={openDoc} tone={tone} /></Portal>
        )}
        {readerStack.length > 0 && (
          <Portal><Reader docId={readerStack[readerStack.length - 1]} understood={understood} onUnderstood={setU}
            onClose={popDoc} onOpenDoc={openDoc} onLearn={openLearn} tone={tone} /></Portal>
        )}
        {learnId && window.MHbLearn && (
          <Portal><window.MHbLearn journey={learnId} tone={tone}
            onClose={() => setLearnId(null)}
            onSaveResume={saveResume}
            onComplete={completeLearn}
            onNext={(nx) => setLearnId(nx)} /></Portal>
        )}

        {welcome && <Portal><Welcome anim={t.welcomeAnim} tone={tone} onStart={dismissWelcome} onSkip={dismissWelcome} /></Portal>}
      </div>
    );
  }

  window.SO_M_PAGES = Object.assign(window.SO_M_PAGES || {}, { handbok: Library });
})();
