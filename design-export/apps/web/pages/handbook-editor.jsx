// ===== Smartout — Håndbok document editor =====
// Side-by-side AI diff · approval timeline · version drawer · comments · ownership
// Exports to window: HbEditor
(function () {
  const { useState, useEffect, useRef } = React;
  const Ic = window.Ic;
  const SD = window.SmartoutData;
  const { HbChip, HbOwner, HbModal, HbRing, HbOwnerPicker } = window;

  const bookById = (id) => SD.HANDBOOKS.find(b => b.id === id);
  const findDoc = (bookId, chId, docId) => {
    const b = bookById(bookId); if (!b) return {};
    const c = b.chapters.find(x => x.id === chId) || b.chapters.find(x => x.docs.some(d => d.id === docId));
    const d = c && c.docs.find(x => x.id === docId);
    return { b, c, d };
  };

  // ---- generated document body (tailored, content-editable) ----
  function bodyBlocks(d, b, c) {
    return (
      <>
        <p>Dette dokumentet beskriver hvordan vi håndterer <strong>{d.title.toLowerCase()}</strong> ved Bistro Nord. Det er en del av {b.statutory ? "det lovpålagte internkontrollsystemet" : "selskapets operative dokumentasjon"} og skal være kjent for alle som berøres.</p>
        <h3>Formål</h3>
        <p>Sikre at rutinen følges likt av alle, at ansvar er tydelig plassert, og at avvik fanges opp og lukkes systematisk. Dokumentet revideres minst én gang i året, og ved endringer i drift eller regelverk.</p>
        <h3>Slik gjør vi det</h3>
        <ul>
          <li><span className="hb-ai-mark" title="Botsson foreslår en presisering her">Ansatte skal sjekke dette regelmessig gjennom dagen.</span></li>
          <li>Ansvarlig leder gjennomgår rutinen kvartalsvis og oppdaterer ved behov.</li>
          <li>Alle nyansatte signerer ved opplæring, og gjennomgangen logges i Smartout.</li>
          <li>Avvik registreres i Smartout og følges opp innen avtalt frist.</li>
        </ul>
        <h3>Ansvar og oppfølging</h3>
        <p>{d.owner ? `${d.owner.name} (${d.owner.role})` : "Ansvarlig leder"} eier dokumentet og er ansvarlig for at innholdet er korrekt og oppdatert. Tillitsvalgt og verneombud involveres ved endringer som påvirker arbeidsmiljøet.</p>
      </>
    );
  }

  // ---- AI suggestion (side-by-side diff), tailored per book ----
  function aiSuggestion(d, b) {
    if (b.id === "hms") return {
      why: "Setningen er for vag til å være etterprøvbar. En god HMS-rutine sier hvem som gjør hva, når, og hvor det logges — det er også det Mattilsynet ser etter ved tilsyn.",
      old: <>Ansatte skal sjekke <del>dette regelmessig gjennom dagen</del>.</>,
      neu: <>Ansvarlig kokk kontrollerer dette <ins>ved åpning (innen kl. 09:00) og ved stenging, og logger verdiene i Smartout</ins>.</>,
      sources: [["folder", "IK-mat v2.4"], ["thermometer", "Temp-logg Kjøl 3"], ["scale", "Mattilsynet · HACCP"]],
    };
    if (b.id === "personal") return {
      why: "Teksten kan oppleves upersonlig. Et varmere, tydeligere språk passer bedre i personalhåndboken og gjør forventningen lettere å forstå.",
      old: <>Ansatte skal sjekke <del>dette regelmessig gjennom dagen</del>.</>,
      neu: <>Vi forventer at alle <ins>holder seg oppdatert og tar opp ting tidlig — spør heller en gang for mye</ins>.</>,
      sources: [["heart", "Kultur og verdier"], ["users", "Tillitsvalgt"]],
    };
    return {
      why: "Presiser hvem som er ansvarlig og hvor ofte, slik at rutinen blir konkret og mulig å følge opp i Smartout.",
      old: <>Ansatte skal sjekke <del>dette regelmessig gjennom dagen</del>.</>,
      neu: <>Vaktleder kontrollerer dette <ins>ved hvert vaktskifte og kvitterer i Smartout</ins>.</>,
      sources: [["building", "Driftsrytme v2.0"], ["route", "Vaktbytte"]],
    };
  }

  function versionsFor(d) {
    const v = parseFloat(d.version) || 1;
    const out = [
      { tag: "v" + d.version, desc: "Nåværende versjon", meta: `${d.updated} · ${(d.owner || {}).name || "—"}`, cur: true },
      { tag: "v" + (v - 0.1 > 0 ? (v - 0.1).toFixed(1) : "0.9"), desc: "Språkvask og oppdaterte frister", meta: "2. mai 2026 · Maria A." },
      { tag: "v1.0", desc: "Første godkjente versjon", meta: "14. jan 2026 · Sara K." },
    ];
    return out;
  }

  function relatedFor(b) {
    if (b.id === "hms") return [["IK-mat internkontroll", "HMS · kap. 4", "spark2"], ["Avvikshåndtering", "HMS · kap. 5", "swap"], ["Sjekkliste — temperatur", "Vedlegg · PDF", "file"]];
    if (b.id === "personal") return [["Onboardingplan", "Personal · kap. 3", "cap"], ["Arbeidsavtale — mal", "Personal · kap. 2", "file"]];
    return [["Daglig driftsrytme", "Bedrift · kap. 3", "route"], ["Tilgangsnivåer", "Bedrift · kap. 1", "lock"]];
  }
  function attachmentsFor(b) {
    if (b.id === "hms") return [["Sjekkliste — temperaturkontroll.pdf", "PDF · 240 kB"], ["Plantegning kjøkken.png", "Bilde · 1,2 MB"]];
    if (b.id === "personal") return [["Skjema — medarbeidersamtale.pdf", "PDF · 180 kB"]];
    return [["Organisasjonskart 2026.pdf", "PDF · 320 kB"]];
  }
  function commentSeed(d) {
    const all = [
      { who: SD.HB_PEOPLE.sl, tm: "i går · 14:12", tx: "Kan vi presisere hvem som har ansvar når vaktleder ikke er til stede?", resolved: false },
      { who: SD.HB_PEOPLE.jh, tm: "i går · 15:40", tx: "Enig — la til et punkt om stedfortreder. Sjekk gjerne.", resolved: false },
      { who: SD.HB_PEOPLE.sk, tm: "2 dager siden", tx: "Frist flyttet til 09:00 etter avtale med Mattilsynet.", resolved: true },
    ];
    return all.slice(0, Math.max(d.comments || 0, 0));
  }

  // ---- approval timeline ----
  function timelineFor(state) {
    const base = [
      { key: "created", t: "Opprettet", who: "Maria A. · 14. jan" },
      { key: "draft", t: "Utkast", who: "Innhold under arbeid" },
      { key: "review", t: "Til gjennomgang", who: "Sendt til Sara K." },
      { key: "approved", t: "Godkjent", who: "Krever HMS-ansvarlig" },
    ];
    const order = ["draft", "review", "approved"];
    const idx = state === "approved" ? 3 : state === "review" ? 2 : 1;
    return base.map((b, i) => ({ ...b, status: i < idx ? "done" : i === idx ? "active" : "todo" }));
  }

  // ---- blank scaffold for a manually-created new document ----
  function newDocBody() {
    return (
      <>
        <p style={{ color: "var(--muted)" }}>Skriv innholdet her — eller bruk «Forbedre med Botsson» over for å få et utkast du kan justere.</p>
        <h3>Formål</h3>
        <p><br /></p>
        <h3>Slik gjør vi det</h3>
        <ul><li><br /></li></ul>
        <h3>Ansvar og oppfølging</h3>
        <p><br /></p>
      </>
    );
  }

  // ---- knowledge check (quiz) per document — feeds XP / rank ----
  function quizFor(d) {
    const seeds = {
      "sy-vaktansvarlig": { xp: 60, rank: "Expert", qs: [
        { q: "Hvor mange vaktansvarlige må hver driftsdag ha?", opts: ["Ingen — det går av seg selv", "Nøyaktig én", "Minst tre"], a: 1 },
        { q: "Hva gjør Smartout hvis en dag mangler vaktansvarlig?", opts: ["Ingenting", "Flagger det i kalender, dashbord og lederens sjekkliste", "Avlyser hele dagen"], a: 1 },
        { q: "Hva skjer når vaktansvarlig meldes syk?", opts: ["Dagen står uten eier", "Smartout foreslår nærmeste kvalifiserte stedfortreder og varsler leder", "Alle får beskjed om å dra hjem"], a: 1 },
      ]},
      "sy-xp": { xp: 50, rank: "Skilled", qs: [
        { q: "Hva måler XP?", opts: ["Ansettelseslengde", "Verifisert aktivitet nå og nylig", "Antall pauser"], a: 1 },
        { q: "Hva bygger ansiennitet?", opts: ["Kun XP fra i dag", "Langsiktig erfaring, tillit og verifisert bidrag over tid", "Hvor høyt du roper"], a: 1 },
        { q: "Hva kreves før CV-erfaring teller mot ansiennitet?", opts: ["Ingenting", "Godkjenning", "Tre års fartstid"], a: 1 },
      ]},
      "sy-rang": { xp: 55, rank: "Skilled", qs: [
        { q: "Hvilken rang er høyest?", opts: ["Expert", "Master", "Lead"], a: 2 },
        { q: "Hvordan hindrer Smartout poengjag?", opts: ["Det gjør det ikke", "Tak, nedkjøling og kategoribalanse (ELO-inspirert)", "Ved å skjule poengene"], a: 1 },
      ]},
      "sy-rack": { xp: 45, rank: "Expert", qs: [
        { q: "Når kjøres den daglige rack-sjekken?", opts: ["Etter stenging", "Før dagen starter", "Bare på lørdager"], a: 1 },
        { q: "Hva betyr en grønn rack-sjekk?", opts: ["At kassa stemmer", "At dagen kan åpne uten åpne risikoer", "At alle har gått hjem"], a: 1 },
      ]},
    };
    return seeds[d.id] || { xp: 30, rank: "Novice", qs: [
      { q: `Hvem eier «${d.title}»?`, opts: ["Ingen", (d.owner || {}).name || "Ansvarlig leder", "Alle ansatte likt"], a: 1 },
      { q: "Hvor ofte revideres dokumentet minst?", opts: ["Aldri", "Minst én gang i året", "Hver time"], a: 1 },
    ] };
  }

  function Quiz({ d, b, toast }) {
    const quiz = quizFor(d);
    const [mode, setMode] = useState("intro"); // intro | take | result
    const [cur, setCur] = useState(0);
    const [ans, setAns] = useState({});
    const [admin, setAdmin] = useState(false);
    const total = quiz.qs.length;
    const correct = quiz.qs.reduce((n, q, i) => n + (ans[i] === q.a ? 1 : 0), 0);
    const pass = Math.round(correct / total * 100) >= 70;
    const start = () => { setMode("take"); setCur(0); setAns({}); };
    const pick = (i, opt) => setAns(a => ({ ...a, [i]: opt }));
    const finish = () => { setMode("result"); if (Math.round(correct / total * 100) >= 70) toast(`Bestått · +${quiz.xp} XP lagt til (verifisert)`, { undo: () => {} }); };

    return (
      <div className="hb-quiz">
        <div className="hb-quiz-head">
          <span className="ic"><Ic n="clipcheck" s={16} /></span>
          <div style={{ flex: 1 }}><div className="t">Kunnskapssjekk</div><div className="s">Bestått gir <b>+{quiz.xp} XP</b> · teller mot ansiennitet og <b>{quiz.rank}</b></div></div>
          <button className="hb-quiz-edit" onClick={() => setAdmin(a => !a)} title="Rediger spørsmål"><Ic n="pen" s={13} /> {admin ? "Ferdig" : "Rediger"}</button>
        </div>

        {mode === "intro" && (
          <div className="hb-quiz-body">
            {admin ? (
              <>
                {quiz.qs.map((q, i) => (
                  <div key={i} className="hb-quiz-qedit">
                    <div className="qn">{i + 1}. <span contentEditable suppressContentEditableWarning>{q.q}</span></div>
                    {q.opts.map((o, j) => <div key={j} className={`qo ${j === q.a ? "correct" : ""}`}><span className="dot">{j === q.a ? <Ic n="check" s={11} sw={2.8} /> : null}</span><span contentEditable suppressContentEditableWarning>{o}</span></div>)}
                  </div>
                ))}
                <div className="hb-quiz-adminrow">
                  <button className="sk-ghost hb-btn-sm" onClick={() => toast("Nytt spørsmål lagt til — skriv inn tekst")}><Ic n="plus" s={13} /> Legg til spørsmål</button>
                  <span className="sp" />
                  <label className="hb-quiz-xpedit">Bestått-XP <input type="number" defaultValue={quiz.xp} /></label>
                </div>
                <p className="hb-quiz-note"><Ic n="lock" s={12} /> Endringer i XP og kobling til rang er sensitive og lagres i revisjonsloggen.</p>
              </>
            ) : (
              <>
                <p className="hb-quiz-intro">{total} spørsmål · 70 % for å bestå. Kunnskapssjekken bekrefter at innholdet i dokumentet er forstått før ansvar gis.</p>
                <button className="sk-primary" style={{ height: 38 }} onClick={start}><Ic n="clipcheck" s={15} /> Ta kunnskapssjekk</button>
              </>
            )}
          </div>
        )}

        {mode === "take" && (
          <div className="hb-quiz-body">
            <div className="hb-quiz-prog"><span style={{ width: ((cur + 1) / total * 100) + "%" }} /></div>
            <div className="hb-quiz-qn">Spørsmål {cur + 1} av {total}</div>
            <div className="hb-quiz-q">{quiz.qs[cur].q}</div>
            <div className="hb-quiz-opts">
              {quiz.qs[cur].opts.map((o, j) => (
                <button key={j} className={`hb-quiz-opt ${ans[cur] === j ? "on" : ""}`} onClick={() => pick(cur, j)}><span className="rb">{ans[cur] === j && <span />}</span>{o}</button>
              ))}
            </div>
            <div className="hb-quiz-nav">
              <button className="sk-ghost hb-btn-sm" disabled={cur === 0} onClick={() => setCur(c => c - 1)}>Forrige</button>
              <span className="sp" />
              {cur < total - 1
                ? <button className="sk-primary hb-btn-sm" disabled={ans[cur] == null} onClick={() => setCur(c => c + 1)}>Neste</button>
                : <button className="sk-primary hb-btn-sm" disabled={ans[cur] == null} onClick={finish}>Fullfør</button>}
            </div>
          </div>
        )}

        {mode === "result" && (
          <div className="hb-quiz-body">
            <div className={`hb-quiz-result ${pass ? "ok" : "fail"}`}>
              <span className="ic"><Ic n={pass ? "check" : "alert"} s={22} sw={pass ? 2.6 : 1.8} /></span>
              <div><div className="t">{pass ? "Bestått!" : "Ikke bestått"}</div><div className="s">{correct} av {total} riktige · {Math.round(correct / total * 100)} %{pass ? ` · +${quiz.xp} XP` : " · 70 % kreves"}</div></div>
            </div>
            {quiz.qs.map((q, i) => (
              <div key={i} className={`hb-quiz-review ${ans[i] === q.a ? "ok" : "no"}`}>
                <Ic n={ans[i] === q.a ? "check" : "x"} s={13} sw={2.4} />
                <div><div className="rq">{q.q}</div>{ans[i] !== q.a && <div className="ra">Riktig: {q.opts[q.a]}</div>}</div>
              </div>
            ))}
            <button className="sk-ghost hb-btn-sm" style={{ marginTop: 10 }} onClick={() => setMode("intro")}>{pass ? "Lukk" : "Prøv igjen"}</button>
          </div>
        )}
      </div>
    );
  }

  function findDocByTitle(nm) {
    const word = (nm || "").toLowerCase().split(" ")[0];
    for (const bk of (SD.HANDBOOKS || [])) for (const ch of bk.chapters) { const d2 = ch.docs.find(x => x.title.toLowerCase().includes(word)); if (d2) return { bookId: bk.id, chapterId: ch.id, docId: d2.id }; }
    return null;
  }

  function HbEditor({ bookId, chapterId, docId, draft, nav, toast, openBot }) {
    let { b, c, d } = findDoc(bookId, chapterId, docId);
    const isNew = !!(draft && draft.isNew) && !d;
    if (isNew) {
      d = { id: docId, title: (draft && draft.title) || "Nytt dokument", state: "draft", version: "0.1", updated: "nå", owner: null, read: 0, comments: 0, due: null };
      if (b && !c) c = b.chapters.find(x => x.id === chapterId) || b.chapters[0];
    }
    const [state, setState] = useState(d ? d.state : "draft");
    const [owner, setOwner] = useState(d ? d.owner : null);
    const [showAi, setShowAi] = useState(false);
    const [aiResolved, setAiResolved] = useState(false);
    const [drawer, setDrawer] = useState(false);
    const [modal, setModal] = useState(null); // 'approve' | 'archive'
    const [justApproved, setJustApproved] = useState(false);
    const [conflict, setConflict] = useState(docId === "h-risk-1");
    const [pickOwner, setPickOwner] = useState(false);
    const [comments, setComments] = useState(() => commentSeed(d || {}));
    const [draftComment, setDraftComment] = useState("");
    const [saved, setSaved] = useState("Lagret");
    const [relAdd, setRelAdd] = useState(false);
    const [superAdmin, setSuperAdmin] = useState(false);
    const sysLocked = b.id === "system" && !superAdmin;
    const [vis, setVis] = useState(() => (d.visibleTo || ["ansatte", "ledere", "admin"]));
    const toggleVis = (r) => setVis(v => v.includes(r) ? v.filter(x => x !== r) : [...v, r]);
    const [docVer, setDocVer] = useState(d.version);
    const baseBookVer = ({ bedrift: "1.4", hms: "2.0", personal: "1.3", system: "2.4" })[b.id] || "1.0";
    const [bookVer, setBookVer] = useState(() => (window.__hbBookVer && window.__hbBookVer[b.id]) || baseBookVer);
    const newVersion = () => {
      const nd = (parseFloat(docVer) + 0.1).toFixed(1);
      const nb = (parseFloat(bookVer) + 0.1).toFixed(1);
      setDocVer(nd); setBookVer(nb);
      window.__hbBookVer = Object.assign(window.__hbBookVer || {}, { [b.id]: nb });
      setDrawer(false);
      toast(`Ny versjon: dokument v${nd} · ${b.name} oppgradert til v${nb}`, { undo: () => { setDocVer(docVer); setBookVer(bookVer); } });
    };

    useEffect(() => { document.querySelector(".sk-main") && document.querySelector(".sk-main").scrollTo(0, 0); }, [docId]);
    useEffect(() => { try { window.SmartoutContext && window.SmartoutContext.set && window.SmartoutContext.set({ route: "bibliotek", view: "Dokument: " + d.title, handbook: b.name, handbookId: b.id, chapter: c.title, doc: d.title }); } catch (e) {} }, [docId]);
    // open AI suggestion automatically for outdated docs (natural: needs refresh)
    useEffect(() => { if (d && d.state === "outdated") setShowAi(true); }, [docId]);

    if (!d) return <main className="sk-main"><div className="sk-wrap"><div className="so-empty"><span className="ic"><Ic n="file" s={22} /></span><div className="t">Fant ikke dokumentet</div><button className="sk-ghost hb-btn-sm" style={{ marginTop: 10 }} onClick={() => nav.dashboard()}>Til Bibliotek</button></div></div></main>;

    const ai = aiSuggestion(d, b);
    const tl = timelineFor(state);
    const touch = () => { setSaved("Lagrer …"); setTimeout(() => setSaved("Lagret nå"), 500); };

    const primary = () => {
      if (state === "draft") return { label: "Send til godkjenning", ic: "arrowRight", run: () => { setState("review"); toast("Sendt til godkjenning hos Sara K.", { undo: () => setState("draft") }); } };
      if (state === "review") return { label: "Godkjenn dokument", ic: "check", run: () => setModal("approve") };
      if (state === "outdated") return { label: "Start revisjon", ic: "pen", run: () => { setState("draft"); toast("Revisjon startet — status satt til utkast"); } };
      return { label: "Publiser ny versjon", ic: "arrowRight", run: () => toast("Ny versjon publisert") };
    };
    const P = primary();

    const addComment = () => {
      if (!draftComment.trim()) return;
      setComments(cs => [...cs, { who: SD.HB_PEOPLE.ma, tm: "nå", tx: draftComment.trim(), resolved: false }]);
      setDraftComment(""); toast("Kommentar lagt til");
    };

    return (
      <main className="sk-main">
        <div className="sk-wrap" style={{ "--acc": b.accent }}>
          <div className="hb-ed-bar">
            <div className="hb-crumb">
              <button onClick={() => nav.dashboard()}>Bibliotek</button>
              <span className="sep"><Ic n="chevRight" s={12} /></span>
              <button onClick={() => nav.book(b.id)}>{b.short}</button>
              <span className="sep"><Ic n="chevRight" s={12} /></span>
              <span style={{ color: "var(--fg)" }}>{c.title}</span>
            </div>
            <span className="spacer" />
            <span className="hb-autosave"><span className="dot" />{saved}</span>
            <button className="sk-ghost hb-btn-sm" onClick={() => setDrawer(true)}><Ic n="history" s={14} /> Versjoner</button>
            <button className="sk-ghost hb-btn-sm" onClick={() => toast("Eksport startet — PDF")}><Ic n="download" s={14} /></button>
            <button className="hb-btn-danger hb-btn-sm" onClick={() => setModal("archive")}><Ic n="archive" s={14} /></button>
          </div>

          {justApproved && (
            <div className="hb-success">
              <span className="ic"><Ic n="check" s={18} sw={2.6} /></span>
              <div className="b"><div className="t">Dokumentet er godkjent og publisert</div><div className="s">Versjon {d.version} er nå synlig for alle ansatte. Endringen er logget.</div></div>
            </div>
          )}

          {conflict && (
            <div className="hb-conflict">
              <span className="ic"><Ic n="alert" s={20} /></span>
              <div className="b">
                <div className="t">Sara K. redigerer dette dokumentet akkurat nå</div>
                <div className="s">Hun har ulagrede endringer fra 2 minutter siden. Lagrer du nå, kan endringer overskrives.</div>
              </div>
              <button onClick={() => { setConflict(false); toast("Åpnet sammenligning av endringer"); }}>Sammenlign</button>
              <button onClick={() => { setConflict(false); toast("Du redigerer nå — Sara er varslet"); }}>Overta</button>
            </div>
          )}

          <div className="hb-editor">
            {/* ---- main sheet ---- */}
            <div>
              {b.id === "system" && (
                <div className="hb-lock-banner">
                  <span className="ic"><Ic n="lock" s={16} /></span>
                  <div><div className="t">Systemmanualen er låst til SuperAdmin</div><div className="s">{sysLocked ? "Du kan lese, men ikke endre. Bedrift, HMS og Personal kan endres av Admin." : "Du redigerer som SuperAdmin — endringer logges i revisjonsloggen."}</div></div>
                  <span className="sp" />
                  <button onClick={() => setSuperAdmin(s => !s)}>{sysLocked ? "Lås opp som SuperAdmin" : "Lås igjen"}</button>
                </div>
              )}
              <div className="hb-sheet">
                <div className="hb-sheet-eyebrow">{b.name} · {c.title}{b.statutory ? " · lovpålagt" : ""}</div>
                <h1 contentEditable={!sysLocked} suppressContentEditableWarning onInput={touch}>{d.title}</h1>
                <div className="hb-sheet-meta">
                  <HbChip state={state} />
                  <span><Ic n="user" s={12} style={{ verticalAlign: -2 }} /> {owner ? owner.name : "Ingen eier"}</span>
                  <span>·</span><span>v{docVer}</span>
                  <span>·</span><span>Sist endret {d.updated}</span>
                  {d.read != null && <><span>·</span><span>{d.read} har lest</span></>}
                </div>

                <div className="hb-ai-actions" style={{ marginBottom: 18 }}>
                  <button className="hb-btn-soft hb-btn-sm" onClick={() => setShowAi(s => !s)}><Ic n="spark2" s={14} /> {showAi ? "Skjul forslag" : "Forbedre med Botsson"}</button>
                  <button className="sk-ghost hb-btn-sm" onClick={() => toast("Botsson oversetter til engelsk …")}><Ic n="message" s={14} /> Oversett</button>
                  <button className="sk-ghost hb-btn-sm" onClick={() => toast("Botsson forenkler språket …")}><Ic n="pen" s={14} /> Forenkle</button>
                </div>

                <div className="hb-sheet-body" contentEditable={!sysLocked} suppressContentEditableWarning onInput={touch}>
                  {isNew ? newDocBody() : bodyBlocks(d, b, c)}
                </div>

                {showAi && !aiResolved && (
                  <div className="hb-ai-card">
                    <div className="hb-ai-head">
                      <span className="hb-ai-av"><Ic n="bot" s={16} /></span>
                      <div style={{ flex: 1 }}>
                        <div className="t">Botsson foreslår en forbedring <span className="tag">FORSLAG</span></div>
                        <div className="m">1 endring i avsnittet «Slik gjør vi det»</div>
                      </div>
                    </div>
                    <p className="hb-ai-why"><strong style={{ fontWeight: 600 }}>Hvorfor:</strong> {ai.why}</p>
                    <div className="hb-diff">
                      <div className="hb-diff-col old"><div className="lbl"><Ic n="file" s={11} /> Nåværende</div><div className="txt">{ai.old}</div></div>
                      <div className="hb-diff-col new"><div className="lbl"><Ic n="spark2" s={11} /> Forslag</div><div className="txt">{ai.neu}</div></div>
                    </div>
                    <div className="hb-ai-trust">
                      {ai.sources.map(([ic, s]) => <span key={s} className="hb-trust"><span className="ic"><Ic n={ic} s={11} /></span>{s}</span>)}
                      <span className="hb-trust warn"><span className="ic"><Ic n="user" s={11} /></span>Krever din godkjenning</span>
                    </div>
                    <div className="hb-ai-actions">
                      <button className="sk-primary" style={{ height: 32 }} onClick={() => { setAiResolved(true); touch(); toast("Forslag tatt inn", { undo: () => setAiResolved(false) }); }}><Ic n="check" s={14} sw={2.4} /> Godta</button>
                      <button className="sk-ghost" style={{ height: 32 }} onClick={() => { setAiResolved(true); toast("Forslag avvist", { undo: () => setAiResolved(false) }); }}>Avvis</button>
                      <button className="sk-ghost" style={{ height: 32 }} onClick={() => toast("Du kan redigere forslaget direkte i teksten")}><Ic n="pen" s={13} /> Rediger</button>
                    </div>
                  </div>
                )}
              </div>
              <Quiz d={d} b={b} toast={toast} />
            </div>

            {/* ---- side rail ---- */}
            <div className="hb-ed-side">
              <div className="hb-panel">
                <div className="hb-panel-head"><span className="ic"><Ic n="checkdoc" s={14} /></span>Status og godkjenning</div>
                <div className="hb-panel-body">
                  <div style={{ marginBottom: 14 }}><HbChip state={state} /></div>
                  <div className="hb-timeline">
                    {tl.map((s, i) => (
                      <div key={s.key} className={`hb-tl-item ${s.status}`}>
                        <div className="hb-tl-rail">
                          <span className={`hb-tl-dot ${s.status}`}>{s.status === "done" ? <Ic n="check" s={12} sw={2.6} /> : s.status === "active" ? <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} /> : i + 1}</span>
                          {i < tl.length - 1 && <span className="hb-tl-line" />}
                        </div>
                        <div className="hb-tl-body"><div className="t">{s.t}</div><div className="who">{s.who}</div></div>
                      </div>
                    ))}
                  </div>
                  <button className="sk-primary" style={{ width: "100%", justifyContent: "center", marginTop: 6 }} onClick={() => sysLocked ? toast("Systemmanualen krever SuperAdmin-tilgang") : P.run()}><Ic n={P.ic} s={15} sw={2.2} /> {P.label}</button>
                  {state === "review" && <button className="sk-ghost" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} onClick={() => { setState("draft"); toast("Sendt tilbake til utkast med merknad"); }}>Be om endringer</button>}
                  <p style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5, marginTop: 10, display: "flex", gap: 6 }}><Ic n="lock" s={12} style={{ flexShrink: 0, marginTop: 1 }} /> {b.statutory ? "Lovpålagt dokument — krever godkjenning fra HMS-ansvarlig." : "Endringer logges med navn og tidspunkt."}</p>
                </div>
              </div>

              <div className="hb-panel">
                <div className="hb-panel-head"><span className="ic"><Ic n="sliders" s={14} /></span>Detaljer</div>
                <div className="hb-panel-body">
                  <div className="hb-field"><span className="k">Eier</span><span className="v" style={{ position: "relative" }}><span className="hb-owner-btn" onClick={() => setPickOwner(p => !p)}><HbOwner owner={owner} size={20} /><Ic n="chevDown" s={12} c="var(--muted)" /></span><HbOwnerPicker open={pickOwner} onPick={(p) => { setOwner(p); toast(`Eier satt til ${p.name}`); }} onClose={() => setPickOwner(false)} /></span></div>
                  <div className="hb-field"><span className="k">Versjon</span><span className="v mono">v{docVer}</span></div>
                  <div className="hb-field"><span className="k">Frist for gjennomgang</span><span className="v" style={{ color: d.due && /forfalt/i.test(d.due) ? "var(--error)" : "inherit" }}>{d.due || "Innen 1 år"}</span></div>
                  <div className="hb-field"><span className="k">Lest av</span><span className="v">{d.read != null ? `${d.read} ansatte` : "—"}</span></div>
                  <div className="hb-field"><span className="k">Kapittel</span><span className="v">{c.title}</span></div>
                  <div className="hb-field"><span className="k">Redigering</span><span className="v">{b.id === "system" ? "Kun SuperAdmin" : "Admin"}</span></div>
                  <div className="hb-field" style={{ flexDirection: "column", alignItems: "stretch", gap: 7 }}>
                    <span className="k">Synlig for</span>
                    <div className="hb-access">
                      {[["ansatte", "Ansatte"], ["ledere", "Ledere"], ["admin", "Admin"]].map(([id, l]) => <button key={id} className={`hb-access-chip ${vis.includes(id) ? "on" : ""}`} onClick={() => { toggleVis(id); toast(`${vis.includes(id) ? "Skjult for" : "Synlig for"} ${l.toLowerCase()}`); }}><span className="d" />{l}</button>)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="hb-panel">
                <div className="hb-panel-head"><span className="ic"><Ic n="link" s={14} /></span>Tilknyttede dokumenter<span className="spacer" /><button className="lnk" onClick={() => setRelAdd(v => !v)}>+ Legg til</button></div>
                <div className="hb-panel-body" style={{ paddingTop: 4, paddingBottom: 4 }}>
                  {relAdd && (
                    <div className="hb-reladd">
                      {[["clipcheck", "Kunnskapstest"], ["book", "Manual"], ["list", "Form"], ["file", "Dokument"]].map(([ic2, l]) => (
                        <button key={l} onClick={() => { setRelAdd(false); if (l === "Kunnskapstest") { const q = document.querySelector(".hb-quiz"); q && q.scrollIntoView({ behavior: "smooth", block: "center" }); toast("Kunnskapstest ligger nederst i dokumentet"); } else { toast(`${l} koblet til dokumentet`); } }}><Ic n={ic2} s={13} /> {l}</button>
                      ))}
                    </div>
                  )}
                  {relatedFor(b).map(([nm, mt, ic], i) => (
                    <div key={i} className="hb-rel" onClick={() => { const tg = findDocByTitle(nm); tg ? nav.doc(tg.bookId, tg.chapterId, tg.docId) : toast(`Fant ikke «${nm}» — koble et dokument`); }}><span className="ic"><Ic n={ic} s={14} /></span><div className="b"><div className="nm">{nm}</div><div className="mt">{mt}</div></div><Ic n="chevRight" s={14} c="var(--muted-soft)" /></div>
                  ))}
                </div>
              </div>

              <div className="hb-panel">
                <div className="hb-panel-head"><span className="ic"><Ic n="file" s={14} /></span>Vedlegg<span className="spacer" /><button className="lnk" onClick={() => toast("Velg fil å laste opp")}>+ Legg til</button></div>
                <div className="hb-panel-body" style={{ paddingTop: 4, paddingBottom: 4 }}>
                  {attachmentsFor(b).map(([nm, mt], i) => (
                    <div key={i} className="hb-rel" onClick={() => toast(`Åpner vedlegg «${nm}»`)}><span className="ic" style={{ background: "rgba(231,0,11,0.08)", color: "var(--error)" }}><Ic n="file" s={14} /></span><div className="b"><div className="nm">{nm}</div><div className="mt">{mt}</div></div><Ic n="download" s={14} c="var(--muted-soft)" /></div>
                  ))}
                </div>
              </div>

              <div className="hb-panel">
                <div className="hb-panel-head"><span className="ic"><Ic n="message" s={14} /></span>Kommentarer<span className="spacer" /><span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{comments.length}</span></div>
                <div className="hb-panel-body">
                  {comments.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)", padding: "4px 0 10px" }}>Ingen kommentarer ennå.</div>}
                  {comments.map((cm, i) => (
                    <div key={i} className={`hb-comment ${cm.resolved ? "resolved" : ""}`}>
                      <span className="so-av" style={{ width: 26, height: 26, background: cm.who.color }}>{cm.who.init}</span>
                      <div className="b">
                        <div className="top"><span className="nm">{cm.who.name}</span><span className="tm">{cm.tm}</span>{cm.resolved && <HbChip tone="ok" label="Løst" />}</div>
                        <div className="tx">{cm.tx}</div>
                      </div>
                    </div>
                  ))}
                  <div className="hb-comment-add">
                    <span className="so-av" style={{ width: 26, height: 26, background: "#FF7849" }}>MA</span>
                    <textarea className="hb-comment-input" placeholder="Skriv en kommentar …" value={draftComment} onChange={e => setDraftComment(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addComment(); }} />
                  </div>
                  {draftComment.trim() && <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}><button className="sk-primary hb-btn-sm" onClick={addComment}>Kommenter</button></div>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* version drawer */}
        {drawer && (
          <>
            <div className="hb-drawer-scrim" onMouseDown={() => setDrawer(false)} />
            <aside className="hb-drawer">
              <div className="hb-drawer-head"><span className="t">Versjonshistorikk</span><span className="spacer" /><button className="sk-iconbtn" onClick={() => setDrawer(false)}><Ic n="x" s={18} /></button></div>
              <div className="hb-drawer-body">
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 14, lineHeight: 1.45, display: "flex", gap: 7 }}><Ic n="route" s={13} style={{ flexShrink: 0, marginTop: 1 }} /> Hver dokumentendring hever <strong style={{ color: "var(--fg)", fontWeight: 600 }}>{b.name}</strong> med 0.1 — nå v{bookVer}.</div>
                {versionsFor(d).map((v, i) => (
                  <div key={i} className={`hb-ver ${v.cur ? "cur" : ""}`}>
                    <span className="hb-ver-tag">{v.tag}</span>
                    <div style={{ minWidth: 0 }}><div className="desc">{v.desc}</div><div className="meta">{v.meta}</div></div>
                    {v.cur ? <HbChip tone="ok" label="Nå" /> : <button className="restore" onClick={() => { setDrawer(false); toast(`Gjenoppretter ${v.tag} …`, { undo: () => {} }); }}>Gjenopprett</button>}
                  </div>
                ))}
              </div>
              <div className="hb-drawer-foot"><span style={{ flex: 1 }} /><button className="sk-primary" onClick={newVersion}><Ic n="plus" s={15} sw={2.2} /> Opprett ny versjon</button></div>
            </aside>
          </>
        )}

        <HbModal open={modal === "approve"} onClose={() => setModal(null)} icon="checkdoc" tone="ok" title="Godkjenne dokumentet?" confirmLabel="Godkjenn og publiser"
          onConfirm={() => { setState("approved"); setModal(null); setJustApproved(true); toast("Dokument godkjent og publisert", { undo: () => { setState("review"); setJustApproved(false); } }); }}>
          Du godkjenner <strong>{d.title}</strong> som {owner ? owner.name : "ansvarlig"}. Versjon {d.version} blir synlig for alle ansatte, og godkjenningen logges med ditt navn{b.statutory ? ". Dette er et lovpålagt dokument" : ""}.
        </HbModal>
        <HbModal open={modal === "archive"} onClose={() => setModal(null)} icon="archive" tone="crit" danger title="Arkivere dokumentet?" confirmLabel="Arkiver"
          onConfirm={() => { setModal(null); toast("Dokument arkivert", { undo: () => {} }); nav.book(b.id); }}>
          Dokumentet flyttes til arkivet og blir ikke lenger synlig for ansatte. Du kan gjenopprette det senere fra Innstillinger → Arkiv.
        </HbModal>
      </main>
    );
  }

  Object.assign(window, { HbEditor });
})();
