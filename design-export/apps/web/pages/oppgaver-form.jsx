// ===== Oppgaver — svarformular (kontrollskjema/vernerunde) + Flow Player =====
// Inspection-type tasks open a signed answer form: sections of questions with
// types foto · sjekk · vurdering · qr · tall. Manuals open the Flow Player.
(function () {
  const { useState } = React;
  const Ic = window.Ic;
  const D = () => window.SmartoutData;

  // ---------- control-form schemas: ONE shared source (shared/data.js) ----------
  // Both web (this FormViewer) and mobile (MFormViewer) read SmartoutData.resolveControlForm,
  // so the Flow Controller is identical across Vern · HMS · IK · Mat · innhenting.
  const resolveForm = (task) => D().resolveControlForm(task);
  window.OppForms = D().CONTROL_FORMS;
  window.OppFormTemplates = D().CONTROL_TEMPLATES;
  window.OppResolveForm = resolveForm;
  window.OppHasForm = (task) => !!resolveForm(task);

  const QTYPE = {
    tall: { ic: "thermometer", label: "Måling" },
    sjekk: { ic: "check", label: "Spørsmål" },
    foto: { ic: "camera", label: "Foto" },
    vurdering: { ic: "star", label: "Vurdering" },
    qr: { ic: "grid", label: "QR-skann" },
    signatur: { ic: "pen", label: "Signatur" },
  };

  // ---------- a single question ----------
  function Question({ q, val, onChange }) {
    const answered = val != null && val !== "" && !(typeof val === "object" && val.v == null);
    return (
      <div className={`opf-q ${answered ? "answered" : ""}`}>
        <div className="opf-q-top">
          <span className={`opf-q-type ${q.type}`}><Ic n={QTYPE[q.type].ic} s={14} /></span>
          <div className="opf-q-p">{q.prompt}{q.req && <span className="req">*</span>}<div className="opf-q-tt">{QTYPE[q.type].label}</div></div>
          {answered && <span className="opf-q-ok"><Ic n="check" s={16} sw={2.6} /></span>}
        </div>
        {q.type === "tall" && (() => {
          const num = val === "" || val == null ? null : parseFloat(String(val).replace(",", "."));
          const ok = num == null ? null : (q.max < 0 ? num <= q.max : num <= q.max);
          return (
            <div className="opf-num">
              <input inputMode="decimal" value={val ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="–" />
              <span className="unit">{q.unit}</span>
              <span className="target">krav ≤ {q.max}{q.unit}</span>
              <span className="spacer" style={{ flex: 1 }} />
              {num != null && <span className={`verdict ${ok ? "ok" : "avvik"}`}>{ok ? "Innenfor" : "Avvik"}</span>}
            </div>
          );
        })()}
        {q.type === "sjekk" && (
          <div className="opf-segs">
            <button className={`opf-seg ${val === "ok" ? "on ok" : ""}`} onClick={() => onChange("ok")}><Ic n="check" s={14} /> OK</button>
            <button className={`opf-seg ${val === "avvik" ? "on avvik" : ""}`} onClick={() => onChange("avvik")}><Ic n="alert" s={14} /> Avvik</button>
          </div>
        )}
        {q.type === "vurdering" && (
          <>
            <div className="opf-segs">
              {[["bra", "Bra", "ok"], ["middels", "Middels", "neutral"], ["darlig", "Dårlig", "avvik"]].map(([k, l, t]) => (
                <button key={k} className={`opf-seg ${val && val.v === k ? "on " + t : ""}`} onClick={() => onChange({ v: k, note: (val && val.note) || "" })}>{l}</button>
              ))}
            </div>
            {val && val.v && <textarea className="opf-note" placeholder="Kort begrunnelse (valgfri)…" value={val.note || ""} onChange={(e) => onChange({ v: val.v, note: e.target.value })} />}
          </>
        )}
        {q.type === "foto" && (
          <div className={`opf-drop ${val ? "done" : ""}`} onClick={() => !val && onChange("1 bilde lagt til · " + new Date().toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" }))}>
            <span className="dic"><Ic n={val ? "image" : "camera"} s={18} /></span>
            <div className="db"><div className="dt">{val ? "Bilde lagt til" : "Ta bilde eller last opp"}</div><div className="ds">{val || "Trykk for å åpne kamera"}</div></div>
            {val && <Ic n="check" s={18} c="var(--success)" sw={2.4} />}
          </div>
        )}
        {q.type === "qr" && (
          <div className="opf-qr">
            {val ? <span className="opf-qr-res"><Ic n="check" s={15} sw={2.4} /> Skannet: {val}</span>
              : <button className="opf-qr-btn" onClick={() => onChange(q.code)}><Ic n="grid" s={16} /> Skann QR-kode</button>}
          </div>
        )}
        {q.type === "signatur" && (
          <div className="opf-qr">
            {val ? <span className="opf-qr-res"><Ic n="check" s={15} sw={2.4} /> Signert: {val}</span>
              : <button className="opf-qr-btn" onClick={() => onChange("Maria A. · " + new Date().toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" }))}><Ic n="pen" s={16} /> Signér her</button>}
          </div>
        )}
      </div>
    );
  }

  // ---------- the form viewer ----------
  function FormViewer({ task, onClose, onComplete, toast }) {
    const form = resolveForm(task);
    const [ans, setAns] = useState({});
    const [done, setDone] = useState(false);
    if (!form) return null;
    const allQs = form.sections.flatMap((s) => s.qs);
    const isAns = (q) => { const v = ans[q.id]; return v != null && v !== "" && !(typeof v === "object" && !v.v); };
    const answered = allQs.filter(isAns).length;
    const complete = allQs.filter((q) => q.req || true).every(isAns);
    const reqMissing = allQs.some((q) => q.req && !isAns(q));

    return (
      <div className="opf-overlay" onMouseDown={onClose}>
        <div className="opf" onMouseDown={(e) => e.stopPropagation()} role="dialog">
          {done ? (
            <div className="opf-done">
              <span className="opf-done-ic"><Ic n="check" s={34} sw={2.4} /></span>
              <h3>Kontroll signert</h3>
              <p>Svarene er låst og bevis er generert til loggen. Avvik er sendt til oppfølging.</p>
              <div className="evi"><Ic n="file" s={15} c="var(--success)" /> {task.title} · {new Date().toLocaleDateString("nb-NO")}</div>
              <div style={{ marginTop: 20 }}><button className="opf-btn" onClick={() => { onComplete && onComplete(task.id); onClose(); }}><Ic n="check" s={15} sw={2.4} /> Ferdig</button></div>
            </div>
          ) : (
            <>
              <div className="opf-head">
                <div className="opf-head-top">
                  <span className="opf-badge" style={{ color: form.color, background: form.color + "1c" }}><Ic n="clipcheck" s={11} /> Kontroll</span>
                  <span className="sp" />
                  <button className="opf-x" onClick={onClose}><Ic n="x" s={18} /></button>
                </div>
                <h2 className="opf-title">{task.title}</h2>
                <div className="opf-meta">
                  <span className="chap" style={{ color: form.color }}><span className="dot" style={{ background: form.color }} />{form.kind}</span>
                  <span>·</span><span>{form.chapter}</span>
                  <span>·</span><span>Må signeres ved fullføring</span>
                </div>
                <div className="opf-prog">
                  <div className="opf-prog-bar"><span style={{ width: Math.round((answered / allQs.length) * 100) + "%" }} /></div>
                  <span className="opf-prog-n">{answered}/{allQs.length}</span>
                </div>
              </div>
              <div className="opf-body">
                {form.sections.map((s, si) => (
                  <div key={si} className="opf-sec">
                    <div className="opf-sec-h"><span className="opf-sec-n">{si + 1}</span><span className="opf-sec-t">{s.title}</span><span className="opf-sec-c">{s.qs.filter(isAns).length}/{s.qs.length}</span></div>
                    {s.intro && <div style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "10px 12px", margin: "0 0 10px", borderRadius: "var(--r-lg)", background: "var(--orange-soft)", border: "1px solid color-mix(in srgb, var(--orange) 22%, var(--border))", fontSize: 12.5, lineHeight: 1.5, color: "var(--fg)" }}><span style={{ flex: "0 0 auto", marginTop: 1 }}><Ic n="info" s={14} c="var(--orange-dark)" /></span><span><strong style={{ fontWeight: 600 }}>Husk:</strong> {s.intro}</span></div>}
                    {s.qs.map((q) => <Question key={q.id} q={q} val={ans[q.id]} onChange={(v) => setAns((a) => ({ ...a, [q.id]: v }))} />)}
                  </div>
                ))}
              </div>
              <div className="opf-foot">
                <div className="opf-sign">
                  <div className="opf-sign-info">
                    <div className="t">Signér og fullfør</div>
                    <div className="s">{reqMissing ? <span className="av">Påkrevd foto mangler</span> : complete ? "Alt besvart — klar til signering" : `${allQs.length - answered} spørsmål gjenstår`}</div>
                  </div>
                  <button className="opf-btn" disabled={!complete || reqMissing} onClick={() => { setDone(true); toast("Kontroll signert · bevis generert", { undo: () => {} }); }}><Ic n="pen" s={15} /> Signér</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ---------- Flow Player (manual viewer as a guided stepper) ----------
  function FlowPlayer({ manual, onClose, toast }) {
    const [i, setI] = useState(0);
    const [ans, setAns] = useState({});
    if (!manual) return null;
    const secs = manual.sections && manual.sections.length ? manual.sections : [{ title: manual.title, type: "text", content: [manual.description || "Ingen seksjoner registrert ennå."] }];
    const QUIZ = manual.quiz || [
      { q: "Hva gjør du hvis du oppdager et avvik fra prosedyren?", options: ["Ignorerer det", "Registrerer avvik og varsler ansvarlig", "Venter til neste vakt"], correct: 1 },
      { q: "Når skal kontrollen/sjekklisten signeres?", options: ["Når oppgaven er fullført", "Ved vaktstart", "Den trenger ikke signeres"], correct: 0 },
    ];
    const quizIdx = secs.length + 1;
    const total = secs.length + 2; // cover + sections + quiz
    const isCover = i === 0;
    const isQuiz = i === quizIdx;
    const sec = isCover || isQuiz ? null : secs[i - 1];
    const pct = Math.round((i / (total - 1)) * 100);
    const allAns = QUIZ.every((_, k) => ans[k] != null);
    const score = QUIZ.filter((q, k) => ans[k] === q.correct).length;
    return (
      <div className="opf-overlay" onMouseDown={onClose}>
        <div className="opf opf-lg" onMouseDown={(e) => e.stopPropagation()} role="dialog">
          <div className="opf-head">
            <div className="opf-head-top">
              <span className="opf-badge"><Ic n="play" s={11} /> Veiledning · Manual</span>
              <span className="sp" /><button className="opf-x" onClick={onClose}><Ic n="x" s={18} /></button>
            </div>
            <div className="opf-prog"><div className="opf-prog-bar"><span style={{ width: pct + "%", background: "var(--orange)" }} /></div><span className="opf-prog-n">{i + 1}/{total}</span></div>
          </div>
          <div className="opf-body" style={{ minHeight: 220 }}>
            {isCover ? (
              <div style={{ padding: "10px 2px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>Manual</div>
                <h2 className="opf-title">{manual.title}</h2>
                <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.55, maxWidth: "56ch" }}>{manual.description}</p>
                <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--muted)", marginTop: 14, fontFamily: "var(--font-mono)" }}>
                  <span>v{manual.version}</span><span>{secs.length} seksjoner</span><span>~{manual.estimatedReadTime} min</span>
                </div>
              </div>
            ) : isQuiz ? (
              <div style={{ padding: "6px 2px" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--info)", marginBottom: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>Kunnskapssjekk</div>
                {QUIZ.map((qq, k) => (
                  <div key={k} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{k + 1}. {qq.q}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {qq.options.map((op, oi) => (
                        <button key={oi} onClick={() => setAns((a) => ({ ...a, [k]: oi }))} className={`opf-seg ${ans[k] === oi ? "on neutral" : ""}`} style={{ justifyContent: "flex-start", height: "auto", padding: "10px 12px", textAlign: "left", width: "100%" }}>{op}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (() => {
              const SK = { text: ["Tekst", "file"], video: ["Video", "play"], image: ["Bilde", "image"], checklist: ["Sjekkliste", "list"], quote: ["Sitat", "file"] };
              const [skLabel, skIcon] = SK[sec.type] || SK.text;
              return (
              <div style={{ padding: "6px 2px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>Steg {i} av {secs.length}</span>
                  <span className="opf-badge" style={{ background: "var(--secondary)", color: "var(--muted)" }}><Ic n={skIcon} s={11} /> {skLabel}</span>
                </div>
                <h2 className="opf-title" style={{ fontSize: 22 }}>{sec.title}</h2>
                {sec.type === "video" && (
                  <div style={{ position: "relative", aspectRatio: "16/9", borderRadius: 12, overflow: "hidden", background: "linear-gradient(135deg,#2a1f18,#4a3a2c)", display: "flex", alignItems: "center", justifyContent: "center", margin: "12px 0" }}>
                    <span style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,255,255,.95)", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic n="play" s={22} c="#1c1814" /></span>
                    {(sec.videoTitle || sec.videoDuration) && <span style={{ position: "absolute", left: 12, right: 12, bottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", color: "#fff", fontSize: 12 }}><b style={{ fontWeight: 600 }}>{sec.videoTitle}</b><span style={{ fontFamily: "var(--font-mono)" }}>{sec.videoDuration}</span></span>}
                  </div>
                )}
                {sec.type === "image" && (
                  <div style={{ aspectRatio: "16/9", borderRadius: 12, background: "var(--secondary)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8, alignItems: "center", justifyContent: "center", margin: "12px 0", color: "var(--muted-soft)" }}>
                    <Ic n="image" s={30} />
                    <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase" }}>Illustrasjon</span>
                  </div>
                )}
                {sec.type === "quote" && (
                  <blockquote style={{ margin: "12px 0", padding: "14px 18px", borderLeft: "3px solid var(--orange)", background: "var(--orange-soft)", borderRadius: "0 var(--r-lg) var(--r-lg) 0" }}>
                    <span style={{ fontFamily: "var(--font-heading)", fontSize: 21, lineHeight: 1.35, color: "var(--fg)" }}>«{(sec.content || [])[0] || ""}»</span>
                    {sec.by && <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--muted)", marginTop: 8 }}>— {sec.by}</span>}
                  </blockquote>
                )}
                {sec.type === "checklist" ? (
                  <div style={{ margin: "6px 0" }}>
                    {(sec.content || []).map((c, k) => (
                      <div key={k} style={{ display: "flex", gap: 11, alignItems: "flex-start", padding: "9px 0", borderBottom: "1px solid var(--border)", fontSize: 14.5, lineHeight: 1.45 }}>
                        <span style={{ width: 20, height: 20, borderRadius: 6, border: "1.5px solid var(--border-strong)", flex: "0 0 auto", marginTop: 1 }} />{c}
                      </div>
                    ))}
                  </div>
                ) : sec.type !== "quote" && (sec.content || []).map((p, k) => <p key={k} style={{ fontSize: 15, lineHeight: 1.6, color: "var(--fg)", maxWidth: "60ch" }}>{p}</p>)}
              </div>
              );
            })()}
          </div>
          <div className="opf-foot">
            <div className="opf-sign">
              <button className="btn btn-ghost btn-sm" disabled={i === 0} onClick={() => setI((x) => Math.max(0, x - 1))} style={{ opacity: i === 0 ? .4 : 1 }}><Ic n="chevLeft" s={15} /> Forrige</button>
              <span className="opf-sign-info" />
              {i < total - 1
                ? <button className="opf-btn" style={{ background: "var(--orange)" }} onClick={() => setI((x) => x + 1)}>Neste <Ic n="chevRight" s={15} /></button>
                : <button className="opf-btn" disabled={!allAns} style={{ opacity: allAns ? 1 : .5 }} onClick={() => { toast(`Fullført · quiz ${score}/${QUIZ.length} riktige · lesekvittering registrert`, { undo: () => {} }); onClose(); }}><Ic n="check" s={15} sw={2.4} /> Fullfør</button>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  window.OppFormViewer = FormViewer;
  window.OppFlowPlayer = FlowPlayer;

  // ---------- Chapter document viewer (opens a håndbok-kapittel as a doc) ----------
  const BOOKMETA = { hms: { label: "HMS", color: "#f97316" }, bedrift: { label: "Bedrift", color: "#8b5cf6" }, personal: { label: "Personal", color: "#008388" } };
  function ChapterViewer({ book, chapter, onClose, toast }) {
    const b = BOOKMETA[book] || { label: book, color: "#7a756e" };
    return (
      <div className="opf-overlay" onMouseDown={onClose}>
        <div className="opf opf-lg" onMouseDown={(e) => e.stopPropagation()} role="dialog">
          <div className="opf-head">
            <div className="opf-head-top">
              <span className="opf-badge" style={{ color: b.color, background: b.color + "1c" }}><Ic n="book" s={11} /> {b.label}-håndbok</span>
              <span className="sp" />
              <button className="opf-x" onClick={() => { toast("Åpner i Dokumentmodus"); onClose(); }} title="Åpne i Bibliotek"><Ic n="maximize" s={16} /></button>
              <button className="opf-x" onClick={onClose}><Ic n="x" s={18} /></button>
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>{b.label}-håndbok › {chapter}</div>
            <h2 className="opf-title" style={{ marginTop: 6 }}>{chapter}</h2>
            <div className="opf-meta"><span className="chap" style={{ color: b.color }}><span className="dot" style={{ background: b.color }} />Kapittel</span><span>·</span><span>Sist endret 28/5 · Maria A.</span><span>·</span><span style={{ color: "var(--success)", fontWeight: 600 }}>Godkjent</span></div>
          </div>
          <div className="opf-body">
            <div style={{ padding: "4px 2px" }}>
              <p style={{ fontSize: 15, lineHeight: 1.65, color: "var(--fg)", maxWidth: "62ch" }}>Dette kapittelet beskriver virksomhetens rutiner og krav for <strong>{(chapter || "").toLowerCase()}</strong> ved Bistro Nord. Oppgavene du utfører er forankret her — kapittelet er kilden, oppgaven gjør det om til handling.</p>
              <h3 style={{ fontFamily: "var(--font-heading)", fontSize: 21, fontWeight: 400, margin: "20px 0 10px" }}>Formål</h3>
              <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "var(--fg)", maxWidth: "62ch" }}>Sikre at alle ansatte kjenner og følger gjeldende prosedyrer, og at avvik fanges opp og lukkes systematisk.</p>
              <ul style={{ fontSize: 14.5, lineHeight: 1.8, color: "var(--fg)", paddingLeft: 20, margin: "8px 0 0" }}>
                <li>Ansvarlig leder gjennomgår rutinen kvartalsvis.</li>
                <li>Alle nyansatte signerer ved opplæring.</li>
                <li>Avvik registreres i Smartout og følges opp innen frist.</li>
              </ul>
              <h3 style={{ fontFamily: "var(--font-heading)", fontSize: 21, fontWeight: 400, margin: "22px 0 10px" }}>Tilknyttede dokumenter</h3>
              {[["Sjekkliste — " + chapter + ".pdf", "PDF · 240 kB"], ["Prosedyre — gjennomføring", "Dokument"]].map(([nm, mt], i) => (
                <div key={i} onClick={() => toast("Åpner «" + nm + "»")} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 13px", border: "1px solid var(--border)", borderRadius: 12, marginBottom: 8, cursor: "pointer", maxWidth: 520 }}>
                  <span style={{ width: 34, height: 34, borderRadius: 9, background: b.color + "1c", color: b.color, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ic n="file" s={16} /></span>
                  <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>{nm}</span><span style={{ fontSize: 11.5, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{mt}</span></span>
                  <Ic n="chevRight" s={16} c="var(--muted)" />
                </div>
              ))}
            </div>
          </div>
          <div className="opf-foot">
            <div className="opf-sign">
              <span className="opf-sign-info"><div className="t">Håndbokkapittel</div><div className="s">Åpne full versjon i Bibliotek for redigering og historikk.</div></span>
              <button className="opf-btn" style={{ background: b.color }} onClick={() => { toast("Åpner i Dokumentmodus"); onClose(); }}><Ic n="book" s={15} /> Åpne i Bibliotek</button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  window.OppChapterViewer = ChapterViewer;
})();
