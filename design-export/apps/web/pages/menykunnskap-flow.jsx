// ===== Menykunnskap — Legg-til-meny flow (capture → AI-ekstraksjon → verifisering) =====
// Full-screen wizard overlay. Mobile-first capture (phone frame) → desktop-depth
// extraction + conversational verification → quiz-ready success. window.MkAddFlow.
(function () {
  const { useState, useEffect, useRef } = React;
  const M = () => window.Mk;
  const D = () => window.SmartoutData;
  const Ic = window.Ic;

  const fmtSize = (b) => b == null ? "" : b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(0) + " KB" : (b / 1048576).toFixed(1) + " MB";

  // ---------- real PDF upload (drag/drop or pick) ----------
  function PdfDrop({ value, onChange }) {
    const KEY = "mk_menu_pdf";
    const inputRef = useRef(null);
    const [over, setOver] = useState(false);
    const [err, setErr] = useState("");
    // restore a lightweight marker (name/size) across reopen; the preview url is in-memory only
    useEffect(() => {
      if (value && value.kind === "pdf") return;
      try { const m = JSON.parse(localStorage.getItem(KEY) || "null"); if (m && m.name) onChange({ kind: "pdf", name: m.name, size: m.size }); } catch (e) {}
    }, []);
    const take = (f) => {
      if (!f) return;
      if (f.type !== "application/pdf" && !/\.pdf$/i.test(f.name)) { setErr("Filen må være en PDF."); return; }
      setErr("");
      const r = new FileReader();
      r.onload = () => {
        const rec = { kind: "pdf", name: f.name, size: f.size, url: r.result };
        try { localStorage.setItem(KEY, JSON.stringify({ name: f.name, size: f.size })); } catch (e) {}
        onChange(rec);
      };
      r.readAsDataURL(f);
    };
    const clear = () => { try { localStorage.removeItem(KEY); } catch (e) {} onChange(null); setErr(""); };

    if (value && value.kind === "pdf") {
      return (
        <div className="mk-pdf filled">
          <div className="mk-pdf-prev">
            {value.url
              ? <embed src={value.url + "#toolbar=0&navpanes=0&view=FitH"} type="application/pdf" />
              : <span className="mk-pdf-bigico"><Ic n="file" s={34} c="var(--orange-dark)" /></span>}
          </div>
          <div className="mk-pdf-meta">
            <span className="ico"><Ic n="file" s={17} /></span>
            <div className="bd"><div className="nm">{value.name}</div><div className="sz">{value.size ? fmtSize(value.size) + " · " : ""}PDF{value.url ? " · klar" : " · lastet inn på nytt"}</div></div>
            <button className="mk-pdf-x" onClick={clear}><Ic n="x" s={13} /> Fjern</button>
          </div>
        </div>
      );
    }
    return (
      <div>
        <div className={`mk-pdf drop ${over ? "over" : ""}`} onClick={() => inputRef.current && inputRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files && e.dataTransfer.files[0]); }}>
          <span className="mk-pdf-ph">
            <span className="ic"><Ic n="file" s={26} c="var(--muted-soft)" /></span>
            <span className="t">Dra inn en PDF-meny, eller klikk for å velge fil</span>
            <span className="s">PDF-fil · Botsson leser alle sidene</span>
          </span>
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" style={{ display: "none" }} onChange={(e) => take(e.target.files && e.target.files[0])} />
        </div>
        {err && <div className="mk-pdf-err"><Ic n="alert" s={13} /> {err}</div>}
      </div>
    );
  }

  // ---------- step 1: desktop capture (real upload) — no phone frame ----------
  function CaptureStep({ method, setMethod, upload, setUpload, link, setLink, text, setText, onStart }) {
    const { ImageDrop } = M();
    const OPTS = [
      { id: "foto", t: "Bilde", ic: "camera", hint: "Foto av menyen" },
      { id: "pdf", t: "PDF", ic: "file", hint: "PDF-fil" },
      { id: "lenke", t: "Lenke", ic: "link", hint: "URL til meny" },
      { id: "tekst", t: "Tekst", ic: "pen", hint: "Lim inn tekst" },
    ];
    const ready = method === "lenke" ? link.trim().length > 3
      : method === "tekst" ? text.trim().length > 8
      : method === "pdf" ? !!(upload && upload.kind === "pdf")
      : !!(upload && typeof upload === "string");
    return (
      <div className="mk-cap2">
        <div className="mk-cap2-main">
          <div className="mk-cap2-hero">
            <div className="eyebrow">Bistro Nord · Menykunnskap</div>
            <h2>Legg til en meny</h2>
            <p>Velg hvordan du vil dele menyen — så leser Botsson den og bygger quizen automatisk.</p>
          </div>

          <div className="mk-cap2-methods" role="tablist">
            {OPTS.map((o) => (
              <button key={o.id} role="tab" aria-selected={method === o.id} className={`mk-cap2-method ${method === o.id ? "on" : ""}`} onClick={() => setMethod(o.id)}>
                <span className="ic"><Ic n={o.ic} s={18} /></span>
                <span className="tx"><b>{o.t}</b><small>{o.hint}</small></span>
              </button>
            ))}
          </div>

          <div className="mk-cap2-zone">
            {method === "foto" && (
              <ImageDrop k="mk_menu_upload" kind="menu" ratio="16 / 9" radius={14}
                placeholder="Dra inn et menyfoto, eller klikk for å laste opp"
                onChange={setUpload} />
            )}
            {method === "pdf" && (
              <PdfDrop value={upload} onChange={setUpload} />
            )}
            {method === "lenke" && (
              <div className="mk-cap2-input">
                <label><Ic n="link" s={14} /> Lenke til meny</label>
                <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://bistronord.no/meny" />
                <span className="hint">Botsson åpner siden og leser menyen direkte fra nettet.</span>
              </div>
            )}
            {method === "tekst" && (
              <div className="mk-cap2-input">
                <label><Ic n="pen" s={14} /> Lim inn menyteksten</label>
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} placeholder={"Grillet ribeye … 389\nArktisk torsk … 345\n…"} />
                <span className="hint">Én rett per linje fungerer best — pris og beskrivelse kan stå på samme linje.</span>
              </div>
            )}
          </div>

          <button className="mk-cap2-start" disabled={!ready} onClick={onStart}>
            <Ic n="sparkle" s={17} c="#fff" /> {ready ? "Start AI-import" : "Legg til en meny først"}
          </button>
        </div>

        <aside className="mk-cap2-aside">
          <div className="mk-seclbl"><Ic n="info" s={12} /> Slik fungerer det</div>
          <div className="mk-cap2-steps">
            {[
              ["camera", "Fang menyen", "Foto, PDF, lenke eller ren tekst — alt funker."],
              ["sparkle", "Botsson leser", "Retter, råvarer, allergener, priser og paringer trekkes ut."],
              ["message", "Du bekrefter", "Botsson spør om det den er usikker på, og din lokale kunnskap."],
              ["play", "Quiz er klar", "En spillbar quiz genereres og kan publiseres til staben."],
            ].map(([ic, t, s], i) => (
              <div key={i} className="mk-cap2-step">
                <span className="n">{i + 1}</span>
                <span className="ic"><Ic n={ic} s={15} /></span>
                <div className="bd"><div className="t">{t}</div><div className="s">{s}</div></div>
              </div>
            ))}
          </div>
          <div className="mk-cap2-trust"><Ic n="bot" s={14} c="var(--orange)" /> Botsson viser alltid kilde og sikkerhet for alt den foreslår.</div>
        </aside>
      </div>
    );
  }

  // ---------- step 2: AI extraction (slow, scanning, "thinking") ----------
  function ExtractStep({ upload, onDone }) {
    const stages = D().MK_EXTRACT_STAGES;
    const items = D().MK_EXTRACT_ITEMS;
    const [active, setActive] = useState(0);
    const finished = active >= stages.length;

    useEffect(() => {
      if (finished) return;
      // snappy but still "thinking": ~2.5s total across the stages
      const t = setTimeout(() => setActive((a) => a + 1), active === 0 ? 350 : 300);
      return () => clearTimeout(t);
    }, [active, finished]);

    const pct = Math.round((Math.min(active, stages.length) / stages.length) * 100);
    const cur = stages[Math.min(active, stages.length - 1)];
    const visibleItems = finished ? items.length : Math.max(1, Math.min(items.length, active - 1));

    // preset detection boxes drawn over the menu while scanning
    const BOXES = [
      { t: 19, l: 8, w: 60, h: 9, tag: "Ribeye" },
      { t: 33, l: 8, w: 64, h: 9, tag: "Torsk" },
      { t: 47, l: 8, w: 58, h: 9, tag: "Risotto" },
      { t: 61, l: 8, w: 62, h: 9, tag: "Burger" },
      { t: 75, l: 8, w: 66, h: 9, tag: "Panna cotta" },
    ];
    const showBoxes = finished ? BOXES.length : Math.max(0, Math.min(BOXES.length, active - 1));

    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 22 }}>{finished ? "Menyen er lest" : "Botsson leser menyen"}</span>
          {!finished && <span className="mk-chip" style={{ color: "var(--info)", background: "rgba(39,132,213,0.12)" }}><Ic n="sparkle" s={11} /> arbeider</span>}
          <span style={{ flex: 1 }} />
          {!finished && <button className="mk-btn ghost" style={{ height: 30, fontSize: 11.5 }} onClick={() => setActive(stages.length)}>Hopp over animasjon</button>}
        </div>

        <div className="mk-extract">
          {/* scanning visual */}
          <div>
            <div className="mk-scan-wrap">
              {upload && typeof upload === "string"
                ? <img className="mk-scan-img" src={upload} alt="Opplastet meny" />
                : upload && upload.kind === "pdf" && upload.url
                ? <embed className="mk-scan-pdf" src={upload.url + "#toolbar=0&navpanes=0&view=FitH"} type="application/pdf" />
                : (
                  <div className="mk-scan-menu">
                    <div className="ttl">{upload && upload.kind === "pdf" ? upload.name : "Vintermeny"}</div>
                    {["", "", "", ""].map((_, i) => (
                      <React.Fragment key={i}>
                        <div className="row"><span className="nm" style={{ width: (52 + (i * 7) % 30) + "%" }} /><span className="pr" /></div>
                        <div className="sub" style={{ width: (70 - (i * 9) % 25) + "%" }} />
                      </React.Fragment>
                    ))}
                  </div>
                )}
              {!finished && <div className="mk-scan-line" />}
              {Array.from({ length: showBoxes }).map((_, i) => (
                <div key={i} className="mk-scan-box" style={{ top: BOXES[i].t + "%", left: BOXES[i].l + "%", width: BOXES[i].w + "%", height: BOXES[i].h + "%", animationDelay: i * 0.05 + "s" }}>
                  <span className="tag">{BOXES[i].tag}</span>
                </div>
              ))}
              {finished && (
                <div className="mk-scan-done">
                  <span className="ic"><Ic n="check" s={26} c="#fff" sw={2.6} /></span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>8 retter gjenkjent</span>
                </div>
              )}
            </div>

            {/* thinking status */}
            <div className="mk-think">
              {finished
                ? <span className="mk-think-spin" style={{ color: "var(--success)" }}><Ic n="check" s={24} sw={2.4} /></span>
                : <span className="mk-think-spin"><Ic n="sparkle" s={24} /></span>}
              <div className="mk-think-txt">
                <div className="t">{finished ? "Ferdig lest" : <>{cur.label} <span className="dots" /></>}</div>
                <div className="s">{finished ? "8 retter · 41 ingredienser · 12 allergener" : cur.detail}</div>
              </div>
              <span className="mk-think-pct">{pct}%</span>
            </div>
            <div className="mk-think-bar"><span style={{ width: pct + "%" }} /></div>
          </div>

          {/* timeline + resolving cards */}
          <div>
            <div className="mk-timeline">
              {stages.map((s, i) => {
                const st = i < active ? "done" : i === active ? "active" : "";
                return (
                  <div key={s.id} className={`mk-tl ${st}`}>
                    <span className="mk-tl-dot">
                      {st === "done" ? <Ic n="check" s={14} sw={2.6} /> : st === "active" ? <Ic n="sparkle" s={13} className="spin" /> : <Ic n={s.warn ? "alert" : "clock"} s={13} />}
                    </span>
                    <div className="mk-tl-body">
                      <div className="mk-tl-label">{s.label}{(i < active) && s.count != null && <span className={`cnt ${s.warn ? "warn" : ""}`}>{s.warn ? "!" : "+"}{s.count}</span>}</div>
                      <div className="mk-tl-detail">{s.detail}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mk-seclbl" style={{ margin: "4px 0 10px" }}><Ic n="layers" s={11} /> Strukturert resultat {finished && `· ${items.length} elementer`}</div>
            <div className="mk-extract-grid">
              {items.slice(0, visibleItems).map((it, i) => (
                <div key={it.id} className={`mk-ecard ${it.status}`} style={{ animationDelay: i * 0.05 + "s" }}>
                  <div className="mk-ecard-top">
                    <div><div className="mk-ecard-name">{it.name}</div><div className="mk-ecard-cat">{it.cat}</div></div>
                    {it.price != null ? <span className="mk-ecard-price">{it.price}</span> : <span className="mk-ecard-price missing">pris?</span>}
                  </div>
                  {it.allergens.length > 0 && <window.Mk.Allergens list={it.allergens} size="sm" />}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span className={`mk-estatus ${it.status}`}>
                      <Ic n={it.status === "sikker" ? "check" : it.status === "sjekk" ? "eye" : "alert"} s={10} sw={2.4} />
                      {it.status === "sikker" ? "Sikker" : it.status === "sjekk" ? "Sjekk" : "Mangler info"}
                    </span>
                    <window.Mk.Conf v={it.conf} verified={it.conf >= 70} />
                  </div>
                </div>
              ))}
            </div>
            {finished && (
              <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--muted)" }}>
                <Ic n="info" s={14} c="var(--warning)" /> 2 retter trenger en sjekk og «Dagens suppe» mangler pris — Botsson spør deg nå.
              </div>
            )}
          </div>
        </div>
        <div style={{ marginTop: 22, display: "flex", justifyContent: "flex-end" }}>
          <button className="mk-btn primary" disabled={!finished} onClick={onDone}>
            {finished ? <>Fortsett til verifisering <Ic n="arrowRight" s={14} c="#fff" /></> : "Leser…"}
          </button>
        </div>
      </div>
    );
  }

  // ---------- step 3: conversational verification ----------
  function VerifyStep({ onDone, toast }) {
    const qs = D().MK_VERIFY_QUESTIONS;
    const { Src } = M();
    const [idx, setIdx] = useState(0);
    const [answers, setAnswers] = useState([]); // {q, a}
    const [text, setText] = useState("");
    const logRef = useRef(null);
    const done = idx >= qs.length;

    useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [idx, answers.length]);

    const KIND_LBL = { bekreft: "Bekreft", korriger: "Sikkerhetskritisk", utvid: "Lokal kunnskap" };
    const KIND_IC = { bekreft: "check", korriger: "alert", utvid: "mappin" };

    const answer = (label) => {
      const q = qs[idx];
      setAnswers((a) => [...a, { q: q.id, kind: q.kind, label }]);
      setText("");
      setIdx((i) => i + 1);
    };

    return (
      <div className="mk-verify">
        <div className="mk-vprogress">
          <span style={{ fontWeight: 600, color: "var(--fg)" }}>Verifisering</span>
          <div className="bar"><span style={{ width: (Math.min(idx, qs.length) / qs.length) * 100 + "%" }} /></div>
          <span className="mono" style={{ fontFamily: "var(--font-mono)" }}>{Math.min(idx, qs.length)}/{qs.length}</span>
        </div>

        <div ref={logRef} style={{ maxHeight: "48vh", overflowY: "auto", paddingRight: 4 }}>
          {/* answered history */}
          {answers.map((a, i) => (
            <div key={"h" + i}>
              <Bubble q={qs[i]} KIND_LBL={KIND_LBL} KIND_IC={KIND_IC} Src={Src} muted />
              <div className="mk-vme"><span className="mk-vme-bubble">{a.label}</span></div>
            </div>
          ))}
          {/* current question */}
          {!done && <Bubble q={qs[idx]} KIND_LBL={KIND_LBL} KIND_IC={KIND_IC} Src={Src} />}
          {done && (
            <div className="mk-vq">
              <span className="av"><Ic n="bot" s={18} /></span>
              <div className="mk-vq-bubble">
                <div className="mk-vq-text" style={{ fontSize: 14 }}>Takk, Maria. Alt er bekreftet — den lokale kunnskapen din er nå en del av quizen. Ingenting publiseres før du godkjenner.</div>
              </div>
            </div>
          )}
        </div>

        {/* answer input for current */}
        {!done && (
          <div className="mk-vanswer">
            {qs[idx].kind_options ? (
              <div className="mk-vchoices">
                {qs[idx].kind_options.map((o) => (
                  <button key={o.k} className={`mk-vchoice ${o.k === "ja" ? "ok" : "no"}`} onClick={() => answer(o.t)}>
                    <Ic n={o.k === "ja" ? "check" : "pen"} s={14} sw={2.2} /> {o.t}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mk-vinput">
                <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={qs[idx].placeholder} rows={1}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim()) answer(text.trim()); }} />
                <button className="mk-vsend skip" onClick={() => answer("— hoppet over")}>Hopp over</button>
                <button className="mk-vsend" disabled={!text.trim()} onClick={() => text.trim() && answer(text.trim())}><Ic n="send" s={14} c="var(--bg)" /> Send</button>
              </div>
            )}
          </div>
        )}

        {done && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <button className="mk-btn primary" onClick={onDone}>Bygg quiz <Ic n="arrowRight" s={14} c="#fff" /></button>
          </div>
        )}
      </div>
    );
  }

  function Bubble({ q, KIND_LBL, KIND_IC, Src, muted }) {
    return (
      <div className="mk-vq" style={muted ? { opacity: 0.62 } : null}>
        <span className="av"><Ic n="bot" s={18} /></span>
        <div className="mk-vq-bubble">
          <span className={`mk-vq-kind ${q.kind}`}><Ic n={KIND_IC[q.kind]} s={10} sw={2.4} /> {KIND_LBL[q.kind]}</span>
          <div className="mk-vq-text">{q.q}</div>
          <div className="mk-vq-why"><span className="ic"><Ic n="info" s={13} /></span>{q.why}</div>
          {q.assumption && <div className="mk-vq-assume"><span className="lbl">Botssons antakelse:</span> <b>{q.assumption}</b></div>}
          {q.src && <div className="mk-vsrc">{q.src.map((s, i) => <span key={i} className="mk-chip"><Ic n="layers" s={10} /> {s}</span>)}</div>}
        </div>
      </div>
    );
  }

  // ---------- step 4: quiz ready (publish) ----------
  function ReadyStep({ onPublish, onPreview }) {
    const { Confetti } = M();
    const rounds = D().MK_QUIZ_ROUNDS;
    const QT = D().MK_QTYPES;
    const [pass, setPass] = useState(80);
    return (
      <div style={{ position: "relative", textAlign: "center", padding: "16px 10px" }}>
        <Confetti n={46} />
        <div style={{ position: "relative", zIndex: 6 }}>
          <window.Mk.Ring value={100} size={104} stroke={9} label="✓" sub="klar" color="var(--success)" />
          <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 30, fontWeight: 400, margin: "16px 0 6px", letterSpacing: "-0.02em" }}>Lunsjmeny-quizen er klar</h2>
          <p style={{ fontSize: 14, color: "var(--muted)", maxWidth: "46ch", margin: "0 auto 20px", lineHeight: 1.5 }}>
            Botsson bygde 26 spørsmål i 6 runder fra menyen og din lokale kunnskap. Se gjennom rundene, sett bestått-grense, og publiser når du vil.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, maxWidth: 460, margin: "0 auto 20px" }}>
            {[["8", "retter"], ["26", "spørsmål"], ["6", "runder"], ["~12", "min"]].map(([v, l]) => (
              <div key={l} style={{ background: "var(--secondary)", borderRadius: 13, padding: "13px 6px" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>{v}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>{l}</div>
              </div>
            ))}
          </div>

          {/* delicious card preview — "slik ser kortene ut" */}
          <div style={{ maxWidth: 560, margin: "0 auto 18px", textAlign: "left" }}>
            <div className="mk-seclbl" style={{ marginBottom: 10 }}><Ic n="utensils" s={11} /> Slik ser rett-kortene ut for staben — slipp inn et tallerkenfoto</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {(D().MK_DISHES || []).slice(0, 2).map((dish) => <window.Mk.DishCard key={dish.id} dish={dish} />)}
            </div>
          </div>

          {/* quiz builder preview — rounds + types + difficulty */}
          <div style={{ maxWidth: 560, margin: "0 auto 18px", textAlign: "left" }}>
            <div className="so-panel">
              <div className="so-panel-head"><span className="t"><span className="ico"><Ic n="layers" s={15} /></span>Rundene i quizen</span><span className="spacer" /><span className="mk-chip"><Ic n="repeat" s={10} /> Botsson genererte</span></div>
              {rounds.map((r) => (
                <div key={r.id} className="mk-round">
                  <span className="mk-round-grab"><Ic n="list" s={14} /></span>
                  <span className="mk-round-ic"><Ic n={(QT[r.type] || {}).icon || "list"} s={16} /></span>
                  <div className="mk-round-id">
                    <div className="mk-round-name">{r.title}</div>
                    <div className="mk-round-meta"><span>{(QT[r.type] || {}).label}</span><span className="mono">· {r.n} spm</span><span className="mono">· ~{r.time} min</span></div>
                  </div>
                  <span className={`mk-diff ${r.diff}`}>{r.diff}</span>
                </div>
              ))}
              <div style={{ padding: "14px 16px", borderTop: "1px solid var(--border)" }}>
                <div className="mk-sumrow" style={{ borderBottom: "none", padding: "2px 0 9px" }}>
                  <span className="k"><Ic n="lock" s={14} c="var(--muted)" /> Bestått-grense (skiftklar)</span>
                  <span className="v" style={{ color: "var(--orange)", fontSize: 15 }}>{pass}%</span>
                </div>
                <input className="mk-range" type="range" min="60" max="100" step="5" value={pass} style={{ "--p": ((pass - 60) / 40) * 100 + "%" }} onChange={(e) => setPass(+e.target.value)} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--muted-soft)", marginTop: 5 }}><span>60 %</span><span>80 % anbefalt</span><span>100 %</span></div>
              </div>
              <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 9, fontSize: 12.5 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--muted)" }}><Ic n="users" s={14} /> Mottakere:</span>
                <span className="mk-chip"><Ic n="users" s={10} /> Sal-laget · 6</span>
                <span className="mk-chip"><Ic n="users" s={10} /> Kjøkken · 3</span>
                <span style={{ marginLeft: "auto", color: "var(--success)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5 }}><Ic n="userCheck" s={13} /> Påkrevd for skift</span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button className="mk-btn" onClick={onPreview}><Ic n="play" s={15} /> Forhåndsvis quiz</button>
            <button className="mk-btn primary" onClick={onPublish}><Ic n="send" s={15} c="#fff" /> Publiser til staben</button>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 14, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Ic n="lock" s={12} /> Ingenting sendes før du trykker publiser.
          </div>
        </div>
      </div>
    );
  }

  // ---------- the flow shell ----------
  function MkAddFlow({ onClose, toast, onPublish, onPreview }) {
    const [step, setStep] = useState(0); // 0 capture · 1 extract · 2 verify · 3 ready
    const [method, setMethod] = useState("foto");
    const [upload, setUpload] = useState(null);
    const [link, setLink] = useState("");
    const [text, setText] = useState("");

    useEffect(() => {
      const h = (e) => { if (e.key === "Escape") onClose(); };
      window.addEventListener("keydown", h);
      return () => window.removeEventListener("keydown", h);
    }, []);

    const STEPS = ["Fang", "Les", "Bekreft", "Publiser"];
    const titles = ["Legg til meny", "AI-ekstraksjon", "Verifisering", "Quiz klar"];

    return (
      <div className="mk-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="mk-modal" onMouseDown={(e) => e.stopPropagation()}>
          <div className="mk-modal-head">
            <span className="av"><Ic n="bot" s={18} /></span>
            <div>
              <div className="ttl">{titles[step]}</div>
              <div className="sub">Mr. Botsson · Bistro Nord</div>
            </div>
            <div className="mk-steps">
              {STEPS.map((s, i) => (
                <React.Fragment key={s}>
                  {i > 0 && <span className="mk-step-sep" />}
                  <span className={`mk-step ${i === step ? "on" : i < step ? "done" : ""}`}>
                    <span className="num">{i < step ? <Ic n="check" s={11} sw={2.8} /> : i + 1}</span>{s}
                  </span>
                </React.Fragment>
              ))}
            </div>
            <span className="x" onClick={onClose}><Ic n="x" s={18} /></span>
          </div>

          <div className="mk-modal-body">
            {step === 0 && <CaptureStep method={method} setMethod={setMethod} upload={upload} setUpload={setUpload} link={link} setLink={setLink} text={text} setText={setText} onStart={() => setStep(1)} />}
            {step === 1 && <ExtractStep upload={method === "foto" || method === "pdf" ? upload : null} onDone={() => setStep(2)} />}
            {step === 2 && <VerifyStep onDone={() => setStep(3)} toast={toast} />}
            {step === 3 && <ReadyStep onPublish={() => { onPublish && onPublish(); }} onPreview={() => { onPreview && onPreview(); }} />}
          </div>

          {step < 3 && (
            <div className="mk-modal-foot">
              {step > 0 && step < 3 && <button className="mk-btn ghost" onClick={() => setStep((s) => s - 1)}><Ic n="chevLeft" s={14} /> Tilbake</button>}
              <span className="spacer" />
              <span style={{ fontSize: 11.5, color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Ic n="bot" s={13} c="var(--orange)" /> Botsson viser kilde og sikkerhet for alt den foreslår
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  window.MkAddFlow = MkAddFlow;
})();
