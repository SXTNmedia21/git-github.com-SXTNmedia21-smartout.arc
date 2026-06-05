// =============================================================================
// Smartout Mobile — HÅNDBØKER · interactive AI learning flow  (window.MHbLearn)
// A conversational, step-by-step guided journey led by Mr. Botsson. Reveals one
// beat at a time (typing indicator), explains policy in plain language, drops
// inline cards + source chips, asks lightweight check-in questions (supportive
// feedback — never shaming), summarizes, and ends on a celebratory success
// screen with a recap, honest XP note and a next recommendation.
// Two fully-built journeys: "Hvordan lønn fungerer" + "Allergener i praksis".
// Tone (rolig / energisk) is passed in from the Tweaks panel.
// =============================================================================
(function () {
  const { useState, useEffect, useRef } = React;
  const Ic = window.MIc;
  const cls = (...xs) => xs.filter(Boolean).join(' ');
  const md = (t) => String(t).split('**').map((p, i) => i % 2 ? <b key={i}>{p}</b> : p);
  const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ════════════════════ JOURNEY CONTENT ════════════════════
  const JOURNEYS = {
    lonn: {
      title: 'Hvordan lønn fungerer', short: 'Lønn', accent: '#008388', book: 'Personalhåndbok', est: '10 min',
      xp: 30, next: 'allergen',
      recap: [
        'Lønn er et samspill: bedriften betaler riktig og i tide, du registrerer timer og fravær.',
        'Frist for timer er den 5., lønningsdag er den 12.',
        'Kvelds-, helge- og helligdagstillegg legges på automatisk.',
      ],
      beats: [
        { say: 'Velkommen. Bra at du er her. Håndbøkene er ikke ment som tunge dokumenter du må lese alene — jeg hjelper deg å forstå det viktigste, litt etter litt.',
          say2: 'Heisann! Så bra at du tar denne nå. Vi tar lønn sammen på ti minutter — det er enklere enn det høres ut, lover.' },
        { say: 'Lønn handler om **to sider**. Bedriften skal sørge for riktig utbetaling, tydelige rutiner og tilgjengelig informasjon. Som ansatt registrerer du timer, fravær og endringer innen fristene. Når begge gjør sin del, går resten av seg selv.',
          card: { kind: 'twosided',
            provide: ['Riktig utbetaling til avtalt tid', 'Tydelige frister og rutiner', 'Tilgjengelig info om tillegg og tariff'],
            resp: ['Registrere timer og fravær i tide', 'Melde endringer som påvirker lønn', 'Si fra hvis noe ser feil ut'] },
          sources: [{ book: 'Personalhåndbok', chap: 'Ansettelse og kontrakt' }, { book: 'Personalhåndbok', chap: 'Ferie, fravær og goder' }] },
        { check: { q: 'Hva er ditt viktigste ansvar for at lønna blir riktig?', options: [
            { label: 'Registrere timer og fravær innen fristen', spot: true, feedback: 'Akkurat. Når timene dine er inne i tide, kan lønn kjøres uten gjetting — og du slipper etterbetalinger.' },
            { label: 'Sjekke kontoen på lønningsdagen', feedback: 'Lurt å sjekke! Men det viktigste skjer før: at timene dine faktisk er registrert i tide. Da stemmer det som regel.' },
            { label: 'Ingenting — det ordner seg selv', feedback: 'Nesten alt er automatisk — men timene og fraværet ditt må du registrere. Resten tar systemet seg av.' },
          ] } },
        { say: 'Tre ord det er greit å kjenne — så er du godt rustet:',
          card: { kind: 'terms', items: [
            { term: 'Frist', def: 'Når timene for perioden må være registrert og godkjent. Hos oss: den 5.' },
            { term: 'Tillegg', def: 'Ekstra betaling for kveld, helg og helligdag. Legges på automatisk.' },
            { term: 'Timebank', def: 'Plusstid du har jobbet inn, som du kan ta ut senere etter avtale.' },
          ] } },
        { say: 'Konkret hos Bistro Nord: **lønningsdag er den 12.** Timene for forrige periode må være registrert og godkjent **innen den 5.** Da rekker vi å kontrollere alt før utbetaling.',
          sources: [{ book: 'Personalhåndbok', chap: 'Egenmelding og sykefravær' }] },
        { check: { q: 'Du tar en kveldsvakt på en lørdag. Hva skjer med lønna?', options: [
            { label: 'Jeg får tillegg for både kveld og helg', spot: true, feedback: 'Riktig. Ubekvemstillegg for kveld og helg legges på automatisk når vakta er registrert — du ser dem på lønnsslippen.' },
            { label: 'Samme sats som en vanlig dagvakt', feedback: 'Ikke helt — kvelds- og helgetillegg kommer i tillegg til grunnlønna. Du trenger ikke be om dem; de kommer av seg selv.' },
          ] } },
        { say: 'Kort oppsummert: bedriften sørger for riktig og punktlig lønn, du sørger for at timer og fravær er inne i tide. Gjør begge sin del, så blir lønn noe du slipper å bekymre deg for.',
          say2: 'Og det var det! Bedriften betaler riktig og presis, du holder timene oppdatert — så er lønn helt udramatisk. Godt jobba!' },
      ],
    },

    allergen: {
      title: 'Allergener i praksis', short: 'Allergener', accent: '#b7791f', book: 'Opplæringshåndbok', est: '8 min',
      xp: 30, next: 'lonn',
      recap: [
        'Det finnes 14 lovpålagte allergener — kjenn dem.',
        'Ved tvil: sjekk oppslaget eller spør kjøkkenet. Aldri gjett.',
        'Krysskontaminering er like alvorlig som allergenet i selve retten.',
      ],
      beats: [
        { say: 'Allergener er noe av det viktigste du lærer her. For de fleste gjester er en feil ubehagelig — for noen kan den være alvorlig. Derfor tar vi det rolig og grundig, sammen.',
          say2: 'Nå tar vi noe som virkelig betyr noe: allergener. Litt fokus her gjør deg trygg på gulvet — la oss kjøre på!' },
        { say: 'Det finnes **14 lovpålagte allergener**. Du trenger ikke pugge dem i rekkefølge, men du skal kjenne dem igjen og vite hvor de gjemmer seg på menyen.',
          card: { kind: 'list', h: 'De 14 allergenene', tags: ['Gluten', 'Skalldyr', 'Egg', 'Fisk', 'Peanøtter', 'Soya', 'Melk', 'Nøtter', 'Selleri', 'Sennep', 'Sesam', 'Svoveldioksid', 'Lupin', 'Bløtdyr'] },
          sources: [{ book: 'Opplæringshåndbok', chap: 'Allergener & mattrygghet' }] },
        { check: { q: 'En gjest spør om en rett er glutenfri, og du er usikker. Hva gjør du?', options: [
            { label: 'Sjekker allergenoppslaget eller spør kjøkkenet før jeg svarer', spot: true, feedback: 'Helt riktig. Det tar ti sekunder å sjekke — og ved allergi kan de ti sekundene være avgjørende. Aldri gjett.' },
            { label: 'Sier sannsynligvis ja, det virker trygt', feedback: 'Her må vi være strenge: aldri gjett ved allergi. Sjekk alltid oppslaget eller spør kjøkkenet — selv når du tror du vet.' },
            { label: 'Sier at alt kan inneholde spor', feedback: 'Ærlig, men gjesten fortjener et presist svar. Sjekk oppslaget, så kan du svare trygt og konkret.' },
          ] } },
        { say: '**Krysskontaminering** er like viktig som selve ingrediensen. Samme skjærebrett, samme frityr eller samme redskap kan flytte et allergen fra én rett til en annen. Rene flater og egne redskaper er derfor en del av allergenarbeidet.',
          sources: [{ book: 'HMS-håndbok', chap: 'Prosedyrer og sikre rutiner' }] },
        { say: 'Når en gjest oppgir en allergi: bekreft det rolig, før det videre til kjøkkenet tydelig, og marker bordet slik at hele laget vet om det. Da er ansvaret delt og ingenting faller mellom to stoler.' },
        { check: { q: 'Gjesten på bord 6 oppgir nøtteallergi. Hva er førsteprioritet?', options: [
            { label: 'Si tydelig fra til kjøkkenet og marker bordet', spot: true, feedback: 'Nettopp. Informasjonen må fram til den som lager maten, og bordet markeres så alle vet det — fra bestilling til servering.' },
            { label: 'Anbefale en rett jeg tror er trygg', feedback: 'Først skal kjøkkenet vite det. Deretter kan dere sammen finne en rett som er trygg — ikke gjett alene.' },
          ] } },
        { say: 'Kort oppsummert: kjenn de 14 allergenene, sjekk alltid ved tvil, tenk krysskontaminering, og del informasjonen med kjøkkenet. Da er du trygg — og gjesten også.',
          say2: 'Det var det! Kjenn de 14, sjekk alltid, tenk krysskontaminering og snakk med kjøkkenet. Nå er du klar for gulvet — stødig jobba!' },
      ],
    },
  };

  // ════════════════════ inline cards ════════════════════
  function BeatCard({ card }) {
    if (card.kind === 'twosided') return (
      <div className="m-hbx-card"><div className="m-hbx-card-two">
        <div className="m-hbx-card-col provide">
          <h4><Ic n="building" s={12} /> Bedriften</h4>
          <ul>{card.provide.map((x, i) => <li key={i}><Ic n="checkCircle" s={13} c="var(--info)" /> {x}</li>)}</ul>
        </div>
        <div className="m-hbx-card-col resp">
          <h4><Ic n="user" s={12} /> Du</h4>
          <ul>{card.resp.map((x, i) => <li key={i}><Ic n="checkCircle" s={13} c="var(--orange)" /> {x}</li>)}</ul>
        </div>
      </div></div>
    );
    if (card.kind === 'terms') return (
      <div className="m-hbx-card"><div className="m-hbx-card-terms">
        {card.items.map((it, i) => <div key={i} className="m-hbx-term"><b>{it.term}</b><span>{it.def}</span></div>)}
      </div></div>
    );
    if (card.kind === 'list') return (
      <div className="m-hbx-card"><div className="m-hbx-card-list">
        <div className="m-hbx-card-lh">{card.h}</div>
        <div className="m-hbx-tags">{card.tags.map((t, i) => <span key={i} className="m-hbx-tag">{t}</span>)}</div>
      </div></div>
    );
    return null;
  }

  function Sources({ sources }) {
    const [open, setOpen] = useState(false);
    return (
      <div className="m-hbx-beat-src">
        <button className="m-hbx-srcbtn" onClick={() => setOpen(o => !o)}>
          <Ic n="bookOpen" s={13} /> Vis kilde ({sources.length}) <Ic n="chevDown" s={12} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .18s' }} />
        </button>
        {open && <div className="m-hbx-srclist">{sources.map((s, i) => (
          <div key={i} className="row"><Ic n="file" s={12} /> <b>{s.book}</b> › {s.chap}</div>
        ))}</div>}
      </div>
    );
  }

  // ════════════════════ main flow ════════════════════
  function GuidedLearn({ journey, tone, onClose, onSaveResume, onComplete, onNext }) {
    const J = JOURNEYS[journey];
    const { toast } = window.useM();
    const beats = J.beats;
    const [cursor, setCursor] = useState(0);     // index of the current (latest revealed) beat
    const [answers, setAnswers] = useState({});  // beatIndex -> optionIndex
    const [typing, setTyping] = useState(false);
    const [done, setDone] = useState(false);
    const bodyRef = useRef(null);

    const isCheck = (i) => beats[i] && beats[i].check;
    const textOf = (b) => (tone === 'energisk' && b.say2) ? b.say2 : b.say;

    // typing indicator when revealing a fresh bot 'say' beat
    useEffect(() => {
      if (done) return;
      const b = beats[cursor];
      if (b && !b.check) {
        if (reduceMotion()) { setTyping(false); return; }
        setTyping(true);
        const t = setTimeout(() => setTyping(false), cursor === 0 ? 500 : 720);
        return () => clearTimeout(t);
      } else setTyping(false);
    }, [cursor, done]);

    useEffect(() => { const el = bodyRef.current; if (el) el.scrollTop = el.scrollHeight; }, [cursor, typing, answers, done]);

    const advance = () => {
      if (cursor + 1 >= beats.length) { setDone(true); onComplete && onComplete(journey); }
      else setCursor(c => c + 1);
    };
    const answer = (oi) => {
      if (answers[cursor] != null) return;
      setAnswers(a => ({ ...a, [cursor]: oi }));
    };
    const saveAndClose = () => {
      if (!done) { onSaveResume && onSaveResume({ id: journey, pct: cursor / beats.length }); toast('Fremgang lagret — fortsett når du vil'); }
      onClose();
    };

    const pct = done ? 1 : (cursor + (isCheck(cursor) && answers[cursor] != null ? 1 : 0.5)) / beats.length;

    // ---- completion screen ----
    if (done) {
      const nx = J.next ? JOURNEYS[J.next] : null;
      return (
        <div className="m-vakt" role="dialog" aria-label="Fullført">
          <div className="m-hbx-learn-top">
            <button className="m-iconbtn" onClick={onClose} aria-label="Lukk"><Ic n="x" s={22} /></button>
            <div className="m-hbx-learn-prog"><span style={{ width: '100%' }} /></div>
            <span />
          </div>
          <div className="m-vakt-body" style={{ paddingTop: 0 }}>
            <div className="m-hbx-done">
              <span className="m-hbx-done-ring"><Ic n="check" s={40} sw={3} c="#fff" /></span>
              <h1>{tone === 'energisk' ? 'Det satt!' : 'Bra jobba!'}</h1>
              <p>Du har vært gjennom <b>{J.title.toLowerCase()}</b>. Nå vet du hva du kan forvente — og hva som forventes av deg.</p>
              <span className="m-hbx-xp"><Ic n="zap" s={15} /> +{J.xp} XP · teller mot ansiennitet</span>

              <div className="m-hbx-recap">
                <div className="m-hbx-recap-h">Dette tar du med deg</div>
                <ul>{J.recap.map((r, i) => <li key={i}><Ic n="checkCircle" s={16} /> {r}</li>)}</ul>
              </div>

              {nx && (
                <button className="m-hbx-next" onClick={() => { setDone(false); setCursor(0); setAnswers({}); onNext && onNext(J.next); }}>
                  <span className="m-hbx-next-ic" style={{ background: nx.accent }}><Ic n="play" s={17} c="#fff" /></span>
                  <span className="m-hbx-next-b"><small>Neste anbefaling</small><b>{nx.title}</b></span>
                  <Ic n="chevRight" s={18} c="var(--muted-soft)" />
                </button>
              )}
            </div>
          </div>
          <div className="m-hbx-rd-foot">
            <button className="m-btn m-btn-primary m-full" onClick={() => { toast('Fullført og lagret'); onClose(); }}>
              <Ic n="checkCircle" s={17} /> Tilbake til håndbøkene
            </button>
          </div>
        </div>
      );
    }

    // ---- conversational flow ----
    return (
      <div className="m-vakt" role="dialog" aria-label={J.title}>
        <div className="m-hbx-learn-top">
          <button className="m-iconbtn" onClick={saveAndClose} aria-label="Lagre og lukk"><Ic n="chevDown" s={24} /></button>
          <div className="m-hbx-learn-prog"><span style={{ width: `${Math.min(100, pct * 100)}%` }} /></div>
          <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>{cursor + 1}/{beats.length}</span>
        </div>

        <div className="m-hbx-learn-body" ref={bodyRef}>
          {/* journey intro chip */}
          <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
            <span className="m-pill m-pill-muted" style={{ height: 26, padding: '0 12px' }}><Ic n="bot" s={13} c="var(--orange)" /> Veiledning · {J.title} · {J.est}</span>
          </div>

          {beats.slice(0, cursor + 1).map((b, i) => {
            const current = i === cursor;
            if (b.check) {
              const ans = answers[i];
              const answered = ans != null;
              return (
                <div key={i} className="m-hbx-check">
                  <div className="m-hbx-beat"><span className="m-hbx-beat-ava"><Ic n="bot" s={16} c="#fff" /></span>
                    <div className="m-hbx-bubble">{md(b.check.q)}</div></div>
                  {b.check.options.map((o, oi) => {
                    const picked = ans === oi;
                    const showSpot = answered && o.spot;
                    return (
                      <button key={oi} disabled={answered}
                        className={cls('m-hbx-opt', showSpot && 'spot', picked && !o.spot && 'picked', answered && !picked && !o.spot && 'dim')}
                        onClick={() => answer(oi)}>
                        <span className="m-hbx-opt-b">{showSpot ? <Ic n="check" s={13} sw={3} /> : String.fromCharCode(65 + oi)}</span>
                        <span>{o.label}</span>
                      </button>
                    );
                  })}
                  {answered && (
                    <div className="m-hbx-beat" style={{ marginTop: 4 }}><span className="m-hbx-beat-ava"><Ic n="bot" s={16} c="#fff" /></span>
                      <div className="m-hbx-bubble">{md(b.check.options[ans].feedback)}</div></div>
                  )}
                </div>
              );
            }
            // 'say' beat
            if (current && typing) {
              return <div key={i} className="m-hbx-beat"><span className="m-hbx-beat-ava"><Ic n="bot" s={16} c="#fff" /></span>
                <div className="m-hbx-bubble" style={{ padding: 0 }}><div className="m-hbx-typing"><i /><i /><i /></div></div></div>;
            }
            return (
              <div key={i} className="m-hbx-beat"><span className="m-hbx-beat-ava"><Ic n="bot" s={16} c="#fff" /></span>
                <div className="m-hbx-bubble">
                  {md(textOf(b))}
                  {b.card && <BeatCard card={b.card} />}
                  {b.sources && <Sources sources={b.sources} />}
                </div>
              </div>
            );
          })}
        </div>

        {/* footer: advance (hidden while typing or awaiting an unanswered check) */}
        <div className="m-hbx-rd-foot">
          {isCheck(cursor) ? (
            answers[cursor] != null
              ? <button className="m-btn m-btn-primary m-full" onClick={advance}>Fortsett <Ic n="arrowRight" s={16} /></button>
              : <button className="m-btn m-btn-ghost m-full" disabled style={{ opacity: .6 }}>Velg et svar for å gå videre</button>
          ) : (
            <button className="m-btn m-btn-primary m-full" disabled={typing} style={typing ? { opacity: .6 } : null} onClick={advance}>
              {cursor + 1 >= beats.length ? <>Fullfør <Ic n="check" s={16} /></> : <>Fortsett <Ic n="arrowRight" s={16} /></>}
            </button>
          )}
        </div>
      </div>
    );
  }

  window.MHbLearn = GuidedLearn;
})();
