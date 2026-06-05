// ===== Kontrakter — branded contract document + detail/signing/audit =====
(function () {
  const { useState, useEffect } = React;
  const C = window.Ct;
  const { Ic, SD, A, statusMeta, gradeById, fmtKr } = C;
  const { Av, dept, emp, empName } = A;
  const PROV = SD.CT_PROVIDER;
  const TARIFF = SD.CT_TARIFF;

  const fieldStatus = (c, key) => {
    if (!c.missing || c.missing.length === 0) return "ok";
    const m = SD.CT_MISSING;
    if (c.missing.includes(key)) return m[key] && m[key].required ? "missing" : "pending";
    return "ok";
  };

  // ============================================================
  // BRANDED CONTRACT DOCUMENT
  // ============================================================
  function CtDoc({ contract: c, onClose, toast, onSend }) {
    useEffect(() => { const h = (e) => e.key === "Escape" && onClose(); window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, []);
    const d = dept(c.dept); const g = gradeById(c.grade); const st = statusMeta(c.status);
    const pay = c.monthly ? { amt: fmtKr(c.monthly), per: "kr / måned" } : { amt: fmtKr(c.hourly), per: "kr / time" };
    const SEC = (n, ic, color, title, children) => (
      <div className="ct-doc-sec">
        <div className="ct-doc-sec-head"><span className="ct-doc-sec-ic" style={{ background: color }}><Ic n={ic} s={17} /></span><div className="ct-doc-sec-t"><span className="num">§{n}</span>{title}</div></div>
        <div className="ct-doc-sec-body">{children}</div>
      </div>
    );
    const Row = ({ k, v, status, legal }) => (
      <div className="ct-doc-r"><span className="k">{k}</span><span className={`v ${legal ? "legal" : ""}`}>{v}{status && <span className={`ct-doc-fieldstatus ${status}`}>{status === "ok" ? "Bekreftet" : status === "pending" ? "Venter" : "Mangler"}</span>}</span></div>
    );

    return (
      <div className="ct-take" role="dialog" aria-label="Arbeidsavtale">
        <div className="ct-take-top">
          <button className="ct-back" onClick={onClose}><Ic n="chevLeft" s={16} /> Lukk</button>
          <span className="ct-take-ttl">Arbeidsavtale · {c.name} <span className="badge">Forhåndsvisning</span></span>
          <span className="gr" />
          <button className="ct-btn sm" onClick={() => toast("Laster ned PDF …")}><Ic n="download" s={14} /> Last ned PDF</button>
          {c.status === "draft" && <button className="ct-btn sm primary" onClick={() => { onSend ? onSend() : toast("Sendt til signering"); }}><Ic n="send" s={14} c="#fff" /> Send til signering</button>}
        </div>

        <div className="ct-docwrap">
          <div className="ct-doc">
            {/* cover */}
            <div className="ct-doc-cover">
              <div className="ct-doc-brand"><span className="mark"><Ic n="checkdoc" s={17} /></span><span className="nm">Bistro Nord</span><span className="org">ORG 912 345 678</span></div>
              <div className="ct-doc-eyebrow">Arbeidsavtale</div>
              <h1 className="ct-doc-title">{c.name}</h1>
              <div className="ct-doc-cover-meta">
                <div className="m"><span className="k">Rolle</span><span className="v">{c.role}</span></div>
                <div className="m"><span className="k">Avdeling</span><span className="v">{d.name}</span></div>
                <div className="m"><span className="k">Ansettelsesform</span><span className="v">{c.form}</span></div>
                <div className="m"><span className="k">Oppstart</span><span className="v">{c.start}</span></div>
              </div>
              <div className="ct-doc-status"><span className="d" /> {st.label}{c.completion < 100 ? ` · ${c.completion}% komplett` : ""}</div>
            </div>

            {/* parties */}
            <div className="ct-doc-parties">
              <div className="ct-doc-party"><div className="role">Arbeidsgiver</div><div className="who">Bistro Nord AS</div><div className="det">Storgata 14, 0184 Oslo<br /><span className="mono">Org. 912 345 678</span> · Daglig leder Erik S.</div></div>
              <div className="ct-doc-party"><div className="role">Arbeidstaker</div><div className="who">{c.name}</div><div className="det">{c.isNew ? "Onboarding pågår" : "Aktiv ansatt"}<br />Nærmeste leder: {empName(c.manager) || "—"}</div></div>
            </div>

            {/* §1 stilling og arbeidssted */}
            {SEC(1, "building", "var(--info)", "Stilling og arbeidssted", (
              <div className="ct-doc-rows">
                <Row k="Stilling" v={c.role} />
                <Row k="Avdeling" v={d.name} />
                <Row k="Arbeidssted" v="Storgata 14, Oslo" />
                <Row k="Nærmeste leder" v={empName(c.manager) || "—"} />
              </div>
            ))}

            {/* §2 arbeidstid */}
            {SEC(2, "clock", "var(--dept-bar)", "Arbeidstid og fleksitid", (
              <React.Fragment>
                <div className="ct-doc-rows">
                  <Row k="Stillingsprosent" v={c.pct != null ? c.pct + " %" : "Variabel (tilkalling)"} />
                  <Row k="Timer per uke" v={c.pct != null ? Math.round(c.pct / 100 * 37.5 * 10) / 10 + " t" : "Ved behov"} />
                  <Row k="Arbeidstidsordning" v={c.form === "Tilkalling" ? "Ved behov" : "Turnus"} />
                  <Row k="Maks arbeidstid" v="9 t/dag · 40 t/uke" legal />
                </div>
                <div className="ct-doc-note"><Ic n="scale" s={13} /> Daglig og ukentlig arbeidstid følger arbeidsmiljøloven §10-4. Turnusplan publiseres i Vaktplan.</div>
              </React.Fragment>
            ))}

            {/* §3 lønn, tariff, tillegg */}
            {SEC(3, "wallet", "var(--success)", "Lønn, tariff og tillegg", (
              <React.Fragment>
                <div className="ct-doc-pay"><span className="amt">{pay.amt}</span><span className="per">{pay.per}</span><span className="grade"><span className="ct-pill" data-s="signed"><span className="d" />{g.code} · {g.label}</span></span></div>
                <div className="ct-doc-rows">
                  <Row k="Tariffavtale" v={TARIFF.name} legal />
                  <Row k="Minstesats (gulv)" v={`${g.floor} kr/t`} legal />
                </div>
                <div style={{ margin: "12px 0 4px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)" }}>Lovpålagte tillegg</div>
                <div className="ct-doc-list">
                  {TARIFF.supplements.map((s) => <span key={s.id} className="ct-doc-chip"><Ic n="plus" s={12} className="ic" /> {s.label} {s.val}</span>)}
                </div>
                <div className="ct-doc-note"><Ic n="bot" s={13} /> Lønnstrinn foreslått av Botsson fra Riksavtalen og bekreftet av leder. Tillegg beregnes automatisk fra vaktplanen.</div>
              </React.Fragment>
            ))}

            {/* §4 opplæring */}
            {SEC(4, "cap", "var(--purple)", "Opplæringsplan", (
              <React.Fragment>
                <div className="ct-doc-list">
                  <span className="ct-doc-chip">HACCP & mattrygghet</span>
                  <span className="ct-doc-chip">Brannvern</span>
                  <span className="ct-doc-chip">Allergener</span>
                  <span className="ct-doc-chip">{d.name}-rutiner</span>
                </div>
                <div className="ct-doc-note"><Ic n="link" s={13} /> <span>Knyttet til opplæringsløpet for ansattgruppen. Fullføres i appen — se <span className="ct-doc-link">Personalhåndbok <Ic n="arrowRight" s={11} /></span></span></div>
              </React.Fragment>
            ))}

            {/* §5 forventninger */}
            {SEC(5, "clipcheck", "var(--orange)", "Forventninger og ansvar", (
              <React.Fragment>
                <div className="ct-doc-rows one">
                  <Row k="Stillingsbeskrivelse" v={`${c.role} · fra rollebibliotek`} />
                  <Row k="Personalhåndbok" v="Forpliktet til å gjøre seg kjent" />
                  <Row k="HMS-håndbok" v="Forpliktet til å gjøre seg kjent" />
                  <Row k="Taushetserklæring" v="Vedlagt (auto)" />
                </div>
              </React.Fragment>
            ))}

            {/* §6 lovpålagt */}
            {SEC(6, "scale", "var(--error)", "Lovpålagte vilkår", (
              <div className="ct-doc-rows">
                <Row k="Oppsigelsesfrist" v="Gjensidig 1 mnd" legal />
                <Row k="Prøvetid" v="6 måneder" legal />
                <Row k="Ferie" v="5 uker · 12 % feriepenger" legal />
                <Row k="Pensjon (OTP)" v="Innmeldt fra dag 1" legal />
              </div>
            ))}

            {/* §7 ansattinformasjon */}
            {SEC(7, "user", "var(--dept-sal)", "Ansattinformasjon", (
              <React.Fragment>
                <div className="ct-doc-rows">
                  <Row k="Fullt navn" v={c.name} status="ok" />
                  <Row k="Fødselsnummer" v={fieldStatus(c, "m-fnr") === "ok" ? "•• •• •• •••••" : "Samles inn"} status={fieldStatus(c, "m-fnr")} />
                  <Row k="Adresse" v={c.isNew ? "Samles inn" : "Registrert"} status={c.isNew ? "pending" : "ok"} />
                  <Row k="Kontonummer" v={fieldStatus(c, "m-konto") === "ok" ? "•••• •• •••••" : "Samles inn"} status={fieldStatus(c, "m-konto")} />
                </div>
                {c.missing && c.missing.length > 0 && <div className="ct-doc-note"><Ic n="clock" s={13} /> Manglende opplysninger samles inn fra ansatt ved første innlogging. Kun fødselsnummer er påkrevd før signering.</div>}
              </React.Fragment>
            ))}

            {/* signatur */}
            <div className="ct-doc-sign">
              <div className="ct-doc-sigbox"><div className="ct-doc-sigline">{c.status === "signed" ? <React.Fragment><Ic n="check" s={13} className="ic" /> {c.name} · signert med BankID</React.Fragment> : <span className="pending">Signatur — arbeidstaker (BankID)</span>}</div></div>
              <div className="ct-doc-sigbox"><div className="ct-doc-sigline">{c.status === "signed" ? <React.Fragment><Ic n="check" s={13} className="ic" /> {empName(c.manager)} · for Bistro Nord</React.Fragment> : <span className="pending">Signatur — arbeidsgiver</span>}</div></div>
            </div>
          </div>
        </div>

        <div className="ct-doc-foot">
          <span className="verify"><Ic n="shield" s={14} className="ic" /> Generert av Smartout · {TARIFF.source}</span>
          <span className="gr" />
          <button className="ct-btn sm ghost" onClick={onClose}>Lukk</button>
          {c.status === "draft"
            ? <button className="ct-btn sm primary" onClick={() => { onSend ? onSend() : toast("Sendt til signering"); }}><Ic n="send" s={14} c="#fff" /> Send til signering</button>
            : <button className="ct-btn sm" onClick={() => toast("Laster ned PDF …")}><Ic n="download" s={14} /> Last ned PDF</button>}
        </div>
      </div>
    );
  }

  // ============================================================
  // CONTRACT DETAIL — signing status + audit trail + next actions
  // ============================================================
  const TRACK = [
    { id: "created", lb: "Opprettet" },
    { id: "sent", lb: "Sendt" },
    { id: "viewed", lb: "Åpnet" },
    { id: "signed", lb: "Signert" },
  ];
  const STAGE_IDX = { draft: 0, ready: 0, sent: 1, viewed: 2, signed: 3, expired: 1, rejected: 1, failed: 1 };

  function CtDetail({ id, onClose, onDoc, onOpen, toast }) {
    const c0 = SD.CT_CONTRACTS.find((x) => x.id === id);
    const [status, setStatus] = useState(c0.status);
    const [sentSplash, setSentSplash] = useState(false);
    useEffect(() => { const h = (e) => e.key === "Escape" && onClose(); window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, []);
    if (!c0) return null;
    const c = { ...c0, status };
    const st = statusMeta(status); const d = dept(c.dept); const g = gradeById(c.grade);
    const audit = SD.CT_AUDIT[id] || [];
    const idx = STAGE_IDX[status];
    const bad = ["expired", "rejected", "failed"].includes(status);
    const pay = c.monthly ? `${fmtKr(c.monthly)} kr/mnd` : `${fmtKr(c.hourly)} kr/t`;

    const send = () => {
      setStatus("sent"); setSentSplash(true);
      toast("Sendt til ekstern signering", { undo: () => { setStatus(c0.status); setSentSplash(false); } });
    };

    if (sentSplash) {
      return (
        <div className="ct-take" role="dialog">
          <div className="ct-take-top"><button className="ct-back" onClick={onClose}><Ic n="chevLeft" s={16} /> Kontrakter</button><span className="ct-take-ttl">Sendt til signering</span></div>
          <div className="ct-splash">
            <span className="ct-splash-ring"><Ic n="send" s={40} /></span>
            <h1 className="ct-splash-title">Sendt til {c.name}</h1>
            <p className="ct-splash-sub">Avtalen er sendt til {PROV.name} for signering med {PROV.method}. {c.missing && c.missing.length ? "De manglende opplysningene samles inn ved første innlogging." : ""} Du får varsel når den er åpnet og signert.</p>
            <div className="ct-handoff-flow">
              <div className="ct-flow-node smart"><span className="b"><Ic n="checkdoc" s={22} /></span><span className="l">Smartout</span></div>
              <span className="ct-flow-arrow"><span className="dots"><span /><span /><span /></span></span>
              <div className="ct-flow-node ext"><span className="b"><Ic n="pen" s={20} /></span><span className="l">{PROV.short}</span></div>
            </div>
            <div className="ct-splash-acts">
              <button className="ct-btn" onClick={() => setSentSplash(false)}><Ic n="chart" s={15} /> Se status</button>
              <button className="ct-btn primary" onClick={onClose}><Ic n="check" s={15} c="#fff" sw={2.2} /> Ferdig</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="ct-take" role="dialog" aria-label="Kontraktdetaljer">
        <div className="ct-take-top">
          <button className="ct-back" onClick={onClose}><Ic n="chevLeft" s={16} /> Kontrakter</button>
          <span className="ct-take-ttl">{c.name} · {c.role}</span>
          <span className="gr" />
          <button className="ct-btn sm" onClick={() => onDoc(c)}><Ic n="eye" s={14} /> Se hele kontrakten</button>
        </div>

        <div className="ct-detail">
          <div className="ct-detail-wrap">
            <div className="ct-detail-main">
              {/* status hero + tracker */}
              <div className="ct-statushero">
                <div className="ct-statushero-top">
                  <span className="ct-statushero-ic" data-s={status}><Ic n={st.ic} s={22} sw={st.ic === "check" ? 2.3 : 1.8} /></span>
                  <div className="ct-statushero-b">
                    <div className="t">{bad ? (status === "expired" ? "Signeringslenke utløpt" : "Avvist") : status === "signed" ? "Signert og aktiv" : status === "viewed" ? "Åpnet — venter på signering" : status === "sent" ? "Sendt til signering" : "Utkast — ikke sendt"}</div>
                    <div className="s">{c.note}</div>
                  </div>
                  <span className="ct-pill" data-s={st.tone}><span className="d" />{st.label}</span>
                </div>
                {!bad && (
                  <div className="ct-track">
                    {TRACK.map((t, i) => (
                      <React.Fragment key={t.id}>
                        {i > 0 && <span className={`ct-track-line ${i <= idx ? "done" : ""}`} />}
                        <div className={`ct-track-node ${i < idx ? "done" : i === idx ? "curr" : ""}`}>
                          <span className="dot" style={{ position: "relative" }}>{i < idx ? <Ic n="check" s={13} sw={2.5} /> : i === idx ? <span style={{ width: 7, height: 7, borderRadius: "50%", background: "currentColor" }} /> : <span style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}>{i + 1}</span>}</span>
                          <span className="lb">{t.lb}</span>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>

              {/* missing info (draft) */}
              {status === "draft" && c.missing && c.missing.length > 0 && (
                <div className="ct-miss">
                  <div className="ct-miss-head">
                    <span className="ic"><Ic n="alert" s={18} /></span>
                    <div className="b"><div className="t">Manglende opplysninger</div><div className="s">Samles inn fra ansatt ved første innlogging</div></div>
                    <span className="cnt">{c.missing.length}</span>
                  </div>
                  {c.missing.map((mid) => {
                    const m = SD.CT_MISSING[mid];
                    return (
                      <div key={mid} className="ct-miss-row">
                        <span className={`ct-miss-ic ${m.required ? "req" : ""}`}><Ic n={m.required ? "alert" : "clock"} s={14} /></span>
                        <div className="ct-miss-b"><div className="t">{m.label}</div><div className="s">{m.why}</div></div>
                        <div className="ct-miss-who">{m.who}</div>
                        <div className="ct-miss-tags">
                          <span className={`ct-tag-sm ${m.required ? "req" : "opt"}`}>{m.required ? "Påkrevd før signering" : "Ikke påkrevd"}</span>
                          {m.collect && <span className="ct-tag-sm collect">Samles ved onboarding</span>}
                        </div>
                      </div>
                    );
                  })}
                  <div className="ct-miss-foot">
                    <div className="b"><div className="t">Send invitasjonen likevel?</div><div className="s">Botsson samler inn de manglende opplysningene fra ansatt ved første innlogging. Kun fødselsnummer er påkrevd før signering.</div></div>
                    <button className="ct-btn primary" onClick={send}><Ic n="send" s={15} c="#fff" /> Send & inviter</button>
                  </div>
                </div>
              )}

              {/* audit trail */}
              <div className="ct-card">
                <div className="ct-card-h"><Ic n="history" s={15} className="ic" /> Aktivitetslogg & sporbarhet</div>
                <div className="ct-card-b">
                  <div className="ct-audit">
                    {audit.map((a, i) => (
                      <div key={i} className="ct-audit-item" data-k={a.kind}>
                        <div className="ct-audit-rail"><span className="dot"><Ic n={a.kind === "ai" ? "bot" : a.kind === "sign" ? "check" : a.kind === "send" ? "send" : a.kind === "view" ? "eye" : a.kind === "expire" || a.kind === "reject" ? "alert" : a.kind === "system" ? "sparkle" : a.kind === "edit" ? "pen" : "plus"} s={13} /></span><span className="ln" /></div>
                        <div className="ct-audit-c">
                          <div className="tx"><span className="who">{a.who}</span> {a.text}</div>
                          <div className="mt">{a.at}{a.conf != null && <span className="conf"><span className="bar"><span style={{ width: Math.round(a.conf * 100) + "%" }} /></span>{Math.round(a.conf * 100)}%</span>}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* side */}
            <div className="ct-detail-side">
              {/* next actions */}
              <div className="ct-actions">
                {status === "draft" && <button className="ct-action primary" onClick={send}><span className="ic"><Ic n="send" s={16} /></span><div className="b"><div className="t">Send til signering</div><div className="s">Inviter {c.name} via {PROV.short}</div></div></button>}
                {(status === "sent" || status === "viewed") && <button className="ct-action primary" onClick={() => toast(`Påminnelse sendt til ${c.name}`)}><span className="ic"><Ic n="bell" s={16} /></span><div className="b"><div className="t">Send påminnelse</div><div className="s">Purr på signering</div></div></button>}
                {(status === "sent" || status === "viewed") && <button className="ct-action" onClick={() => { setStatus("draft"); toast("Trukket tilbake — tilbake til utkast"); }}><span className="ic"><Ic n="swap" s={16} /></span><div className="b"><div className="t">Trekk tilbake</div><div className="s">Stopp signeringen</div></div></button>}
                {status === "expired" && <button className="ct-action primary" onClick={send}><span className="ic"><Ic n="send" s={16} /></span><div className="b"><div className="t">Send på nytt</div><div className="s">Ny signeringslenke</div></div></button>}
                {status === "signed" && <button className="ct-action primary" onClick={() => toast("Laster ned signert PDF …")}><span className="ic"><Ic n="download" s={16} /></span><div className="b"><div className="t">Last ned signert avtale</div><div className="s">PDF med signaturlogg</div></div></button>}
                <button className="ct-action" onClick={() => onDoc(c)}><span className="ic"><Ic n="checkdoc" s={16} /></span><div className="b"><div className="t">Se hele kontrakten</div><div className="s">Branded forhåndsvisning</div></div></button>
                {emp(c.who) && <button className="ct-action" onClick={() => onOpen(c.who, "kontrakt")}><span className="ic"><Ic n="user" s={16} /></span><div className="b"><div className="t">Åpne ansattprofil</div><div className="s">{c.name}</div></div></button>}
              </div>

              {/* contract summary */}
              <div className="ct-card">
                <div className="ct-card-h"><Ic n="checkdoc" s={15} className="ic" /> Avtaledetaljer</div>
                <div className="ct-card-b">
                  <div className="ct-prow"><span className="k">Rolle</span><span className="v">{c.role} · <span style={{ color: d.color }}>{d.name}</span></span></div>
                  <div className="ct-prow"><span className="k">Form</span><span className="v">{c.form}{c.pct != null ? ` · ${c.pct} %` : ""}</span></div>
                  <div className="ct-prow"><span className="k">Lønn</span><span className="v"><span className="mono">{pay}</span></span></div>
                  <div className="ct-prow"><span className="k">Trinn</span><span className="v">{g.code} · {g.label}</span></div>
                  <div className="ct-prow"><span className="k">Oppstart</span><span className="v">{c.start}</span></div>
                  {c.end && <div className="ct-prow"><span className="k">Slutt</span><span className="v">{c.end}</span></div>}
                </div>
              </div>

              {/* external provider */}
              <div className="ct-card">
                <div className="ct-card-h"><Ic n="pen" s={15} className="ic" /> Ekstern signering</div>
                <div className="ct-card-b">
                  <div className="ct-prow"><span className="k">Leverandør</span><span className="v">{PROV.short}</span></div>
                  <div className="ct-prow"><span className="k">Metode</span><span className="v">{PROV.method}</span></div>
                  {c.sent && <div className="ct-prow"><span className="k">Sendt</span><span className="v"><span className="mono">{c.sent}</span></span></div>}
                  {c.viewed && <div className="ct-prow"><span className="k">Åpnet</span><span className="v"><span className="mono">{c.viewed}</span></span></div>}
                  {c.signed && <div className="ct-prow"><span className="k">Signert</span><span className="v"><span className="mono">{c.signed}</span></span></div>}
                  <div className="ct-boundary" style={{ justifyContent: "flex-start", marginTop: 10 }}><Ic n="shield" s={12} className="ic" /> Smartout orkestrerer — signeringen skjer hos leverandøren.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  window.CtDoc = CtDoc;
  window.CtDetail = CtDetail;
})();
