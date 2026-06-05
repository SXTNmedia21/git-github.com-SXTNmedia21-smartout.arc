// ===== Ansatte — panels part 1: AI assist · Readiness · Contract =====
(function () {
  const { useState } = React;
  const A = window.An;
  const { Ic, SD, Panel, Badge, protoMeta, protocol, empName } = A;

  // ---------- AI readiness assist (Mr. Botsson — assistive, undoable) ----------
  function AssistCard({ e, toast }) {
    const [done, setDone] = useState({});
    const r = A.readiness(e);
    let body, acts;
    if (e.lifecycle === "trainee") {
      const open = (e.onboarding ? e.onboarding.steps.filter((s) => s.status !== "done").length : 0);
      body = <span><strong>{e.display}</strong> er <strong>{r.score}%</strong> klar. Hovedblokkere: {r.blockers.slice(0, 2).map((b, i) => <span key={i}>{i > 0 ? " og " : ""}<strong>{b.label.toLowerCase()}</strong></span>)}. {open} onboarding-steg gjenstår — jeg kan minne mentor og purre signering.</span>;
      acts = [{ id: "x1", label: "Purr signering av avtale", t: "Påminnelse sendt om signering" }, { id: "x2", label: "Foreslå neste opplæring", t: "Foreslo Allergenhåndtering" }];
    } else if (e.lifecycle === "offboarding") {
      body = <span><strong>{e.display}</strong> avslutter <strong>{e.offboarding.lastDay}</strong>. {e.offboarding.tasks.filter((t) => t.status !== "done").length} oppgaver i avslutningsløpet gjenstår, og tilgang fjernes automatisk siste dag. Jeg fjerner ingenting selv.</span>;
      acts = [{ id: "x1", label: "Vis gjenstående handover", t: "Åpner handover-liste" }];
    } else if (r.hasExpired) {
      const exp = e.protocols.filter((p) => p.status === "expired").map((p) => protocol(p.protocol).name);
      body = <span><strong>{e.display}</strong> er i drift, men <strong>{exp.length} protokoll{exp.length > 1 ? "er" : ""}</strong> må resertifiseres: {exp.join(", ")}. Det blokkerer ikke vakt i dag, men bør planlegges.</span>;
      acts = [{ id: "x1", label: "Planlegg resertifisering", t: "Resertifisering lagt i kø" }];
    } else {
      body = <span><strong>{e.display}</strong> er <strong>klar for vakt</strong> — alle protokoller er fullført og sertifikater gyldige. Jeg fant ingen avvik mellom kontrakt, tilgang og opplæring.</span>;
      acts = [{ id: "x1", label: "Sjekk kontrakt vs. tilgang", t: "Ingen avvik funnet" }];
    }
    return (
      <div className="an-assist">
        <div className="an-assist-top">
          <span className="an-assist-av"><Ic n="bot" s={18} /></span>
          <div className="an-assist-id">
            <div className="n">Mr. Botsson <span className="tag">LESETILGANG</span></div>
            <div className="m">Beredskaps-sammendrag · skjuler aldri sensitive data</div>
          </div>
        </div>
        <p className="an-assist-body">{body}</p>
        <div className="an-assist-acts">
          {acts.map((a) => (
            <button key={a.id} className={`an-assist-act ${done[a.id] ? "done" : ""}`} onClick={() => { if (done[a.id]) return; setDone((d) => ({ ...d, [a.id]: true })); toast(a.t, { undo: () => setDone((d) => ({ ...d, [a.id]: false })) }); }}>
              {done[a.id] ? <Ic n="check" s={14} sw={2.4} /> : <Ic n="sparkle" s={13} />} {a.label}
            </button>
          ))}
        </div>
        <div className="an-assist-why"><Ic n="info" s={12} /> Forslag forklares og kan angres. Botsson aktiverer aldri ansatte, endrer tilgang eller signerer kontrakter automatisk.</div>
      </div>
    );
  }

  // ---------- onboarding block (trainee) ----------
  function Onboarding({ e, toast }) {
    const o = e.onboarding;
    const done = o.steps.filter((s) => s.status === "done").length;
    const pct = Math.round((done / o.steps.length) * 100);
    return (
      <div>
        <div className="an-onb">
          <div className="an-onb-top">
            <span className="d">Dag {o.day} / {o.totalDays}</span>
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{done} av {o.steps.length} steg · mentor {o.mentor ? empName(o.mentor) : <span style={{ color: "var(--error)" }}>ikke tildelt</span>}</span>
            <span style={{ flex: 1 }} />
            <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--info)" }}>{pct}%</span>
          </div>
          <div className="an-onb-bar"><span style={{ width: pct + "%" }} /></div>
        </div>
        <div className="an-onb-steps">
          {o.steps.map((s) => (
            <div key={s.id} className="an-step" data-st={s.status}>
              <span className="sc">{s.status === "done" ? <Ic n="check" s={12} sw={2.6} /> : s.status === "inprogress" ? null : <span style={{ fontSize: 9, color: "var(--muted-soft)" }} />}</span>
              <span className="sl">{s.label}</span>
              {s.blocker && s.status !== "done" && <span className="sb">Blokker</span>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---------- proof drill-down rows (audit-grade) ----------
  function ProcRow({ p }) {
    const verified = p.evidence && p.at !== "pågår";
    return (
      <div className={`an-proof-row ${verified ? "verified" : "pending"}`}>
        <span className="an-proof-ic"><Ic n={verified ? "clipcheck" : "clock"} s={14} /></span>
        <div className="an-proof-b">
          <div className="an-proof-t">{p.step}
            {p.evidence ? <span className={`an-proof-aff ${p.evidence.kind === "signoff" ? "signed" : "evidence"}`}>{p.evidence.kind === "signoff" ? "Signert" : "Bevis vedlagt"}</span> : <span className="an-proof-aff review">Gjenstår</span>}
          </div>
          <div className="an-proof-m">
            <span><span className="k">Fullført</span> <span className="mono">{p.at}</span></span>
            <span><span className="k">Av</span> {p.by}</span>
            {p.evidence && <span>{p.evidence.label}</span>}
          </div>
        </div>
      </div>
    );
  }
  function TestRow({ t }) {
    return (
      <div className={`an-proof-row ${t.passed ? "verified" : "review"}`}>
        <span className="an-proof-ic"><Ic n={t.passed ? "check" : "alert"} s={14} /></span>
        <div className="an-proof-b">
          <div className="an-proof-t">{t.test}
            <span className={`an-proof-aff ${t.passed ? "verified" : "review"}`}>{t.passed ? "Bestått" : "Vurdering kreves"}</span>
          </div>
          <div className="an-proof-m">
            <span><span className="k">Score</span> <span className="mono">{t.score}</span></span>
            <span><span className="k">Sensor</span> {t.grader}</span>
            <span><span className="k">Tid</span> <span className="mono">{t.at}</span></span>
            {t.ai != null && <span className="an-proof-ai"><span className="k">KI</span> <span className="bar"><span style={{ width: Math.round(t.ai * 100) + "%" }} /></span> {Math.round(t.ai * 100)}%</span>}
          </div>
        </div>
      </div>
    );
  }
  function ConfRow({ c }) {
    const signed = !!c.sig;
    return (
      <div className={`an-proof-row ${signed ? "verified" : "pending"}`}>
        <span className="an-proof-ic"><Ic n={signed ? "pen" : "clock"} s={14} /></span>
        <div className="an-proof-b">
          <div className="an-proof-t">{c.conf}
            <span className={`an-proof-aff ${signed ? "signed" : "review"}`}>{signed ? "Signert" : "Venter signering"}</span>
          </div>
          <div className="an-proof-m">
            <span><span className="k">Tid</span> <span className="mono">{c.at}</span></span>
            {c.sig && <span><span className="k">Signatur</span> {c.sig}</span>}
            {c.ip && <span><span className="k">IP</span> <span className="mono">{c.ip}</span></span>}
          </div>
        </div>
      </div>
    );
  }

  // ---------- protocol_assignment card ----------
  function ProtoCard({ a, toast }) {
    const [open, setOpen] = useState(false);
    const m = protoMeta(a);
    const p = protocol(a.protocol);
    const recert = a.status === "expired";
    const hasProof = !!a.proof;
    const segs = [
      { key: "proc", lbl: "Prosedyrer", v: a.proc },
      { key: "test", lbl: "Tester", v: a.test },
      { key: "conf", lbl: "Signaturer", v: a.conf },
    ];
    return (
      <div className={`an-proto ${m.cls} ${recert ? "recert" : ""} ${open ? "open" : ""}`}>
        <div className="an-proto-head" onClick={() => hasProof && setOpen((o) => !o)} style={{ cursor: hasProof ? "pointer" : "default" }}>
          <span className="an-proto-ic"><Ic n={m.icon} s={15} sw={m.icon === "check" ? 2.4 : 1.7} /></span>
          <div className="an-proto-id">
            <div className="an-proto-nm">{p.name}<span className="ver">v{a.version}</span></div>
            <div className="an-proto-meta">{a.assignedVia === "lifecycle" ? "Livsløp" : "Protokoll"} · tildelt av {a.assignedBy}{a.completedAt ? ` · fullført ${a.completedAt}` : ""}</div>
          </div>
          <div className="an-proto-side">
            <Badge tone={m.tone} ic={m.icon === "check" ? "check" : null}>{m.label}</Badge>
            {hasProof && <span className="an-proto-chev"><Ic n="chevDown" s={15} /></span>}
          </div>
        </div>
        <div className="an-segs">
          {segs.map((s) => (
            <div key={s.key} className={`an-seg ${s.key} ${s.v[0] >= s.v[1] && s.v[1] > 0 ? "full" : ""}`}>
              <div className="an-seg-top"><span className="an-seg-lbl">{s.lbl}</span><span className="an-seg-ct">{s.v[0]}/{s.v[1]}</span></div>
              <div className="an-seg-bar"><span style={{ width: (s.v[1] ? (s.v[0] / s.v[1]) * 100 : 0) + "%" }} /></div>
            </div>
          ))}
        </div>
        {recert && (
          <div className="an-recert">
            <span className="ic"><Ic n="history" s={14} /></span>
            <span>Resertifisering kreves — forfalt {a.nextReviewAt}.</span>
            <span className="acts">
              <button onClick={(ev) => { ev.stopPropagation(); toast("Påminnelse sendt", { undo: () => {} }); }}><Ic n="bell" s={12} /> Påminn</button>
              <button onClick={(ev) => { ev.stopPropagation(); toast("Frist forlenget 30 dager", { undo: () => {} }); }}><Ic n="clock" s={12} /> Forleng</button>
              <button className="primary" onClick={(ev) => { ev.stopPropagation(); window.AnCtl.open("recert", { name: p.name, due: a.nextReviewAt }); }}><Ic n="calendar" s={12} /> Planlegg</button>
            </span>
          </div>
        )}
        {!recert && a.nextReviewAt && a.status === "completed" && <div style={{ padding: "0 14px 12px", fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>Neste gjennomgang: {a.nextReviewAt}</div>}
        {open && hasProof && (
          <div className="an-proof">
            <div className="an-proof-grp"><div className="an-proof-h"><span className="seg-dot proc" /> Prosedyresteg · bevis</div>{a.proof.procedures.map((x, i) => <ProcRow key={i} p={x} />)}</div>
            <div className="an-proof-grp"><div className="an-proof-h"><span className="seg-dot test" /> Kunnskapstester · forsøk</div>{a.proof.tests.map((x, i) => <TestRow key={i} t={x} />)}</div>
            <div className="an-proof-grp"><div className="an-proof-h"><span className="seg-dot conf" /> Bekreftelser · signatur</div>{a.proof.confirmations.map((x, i) => <ConfRow key={i} c={x} />)}</div>
          </div>
        )}
      </div>
    );
  }

  // ---------- Readiness panel ----------
  function ReadinessPanel({ e, toast }) {
    const r = A.readiness(e);
    const verdict = r.ready ? "Klar for vakt" : e.lifecycle === "offboarding" ? "Avslutter — beholder tilgang til siste dag" : e.lifecycle === "inactive" ? "Inaktiv" : "Ikke klar for vakt";
    const verdictSub = r.ready ? "Alle påkrevde protokoller er fullført, ingen er utløpt." : e.lifecycle === "trainee" ? "Fullfør onboarding, signer avtale og bestå quiz før selvstendig vakt." : r.hasExpired ? "I drift, men minst én protokoll må resertifiseres." : "Mangler eller utløpte krav blokkerer selvstendig vakt.";
    return (
      <Panel icon="gauge" iconTone={r.ready ? "ok" : "warn"} title="Beredskap & protokoller" sub={`${(e.protocols || []).length} protokolltildelinger · krav fra profesjon`} accent="readiness" id="readiness">
        <div className="an-readsum">
          <div className="an-bigring" style={{ "--p": r.score, "--rc": r.color }}><span className="pct">{r.score}%</span></div>
          <div className="verdict">
            <div className={`t ${r.ready ? "ok" : "no"}`}>{verdict}</div>
            <div className="s">{verdictSub}</div>
          </div>
        </div>
        {e.onboarding && <Onboarding e={e} toast={toast} />}
        {(e.protocols || []).map((a) => <ProtoCard key={a.id} a={a} toast={toast} />)}
        {(e.protocols || []).length === 0 && <div className="an-scope-empty">Ingen protokoller tildelt ennå.</div>}
        {r.blockers.length > 0 && (
          <div className="an-blockers">
            {r.blockers.map((b, i) => (
              <div key={i} className="an-blocker" data-sev={b.sev}>
                <span className="bd" />
                <span className="bt">{b.label}</span>
                <button className="ba" onClick={() => toast("Botsson foreslår tiltak")}>Løs</button>
              </div>
            ))}
          </div>
        )}
      </Panel>
    );
  }

  // ---------- Contract panel (source of truth) ----------
  function ContractPanel({ e, toast }) {
    const [addOpen, setAddOpen] = useState(false);
    const c = e.contract;
    const Field = ({ k, v, big }) => <div className="an-field"><span className="k">{k}</span><span className={`v ${big ? "big" : ""}`}>{v}</span></div>;
    const sign = c.signed; // signed · sent · draft
    const signMeta = sign === "signed" ? { ic: "clipcheck", t: "Signert avtale", s: `Signert ${c.signedAt}`, tone: "success", label: "Signert" }
      : sign === "sent" ? { ic: "send", t: "Sendt til signering", s: `Sendt ${c.sentAt || "—"} · venter ansatt`, tone: "warning", label: "Venter signering" }
        : { ic: "file", t: "Utkast", s: "Ikke sendt til signering ennå", tone: "muted", label: "Utkast" };
    return (
      <Panel icon="checkdoc" title="Kontrakt & arbeidsvilkår" sub="Aktiv arbeidsavtale" src="Kilde for lønn & timer" id="contract"
        action={<button className="an-btn sm" onClick={() => setAddOpen(true)}><Ic n="plus" s={13} sw={2.2} /> Ny kontrakt</button>}>
        <div className="an-sot"><span className="ic"><Ic n="lock" s={14} /></span><span>Arbeidsavtalen er <strong>fasit</strong> for lønn, stillingsprosent, timer og datoer. Endringer krever ny signering.</span></div>
        <div className="an-pay">
          {c.payType === "Fastlønn"
            ? <><span className="amt">{(c.monthly || 0).toLocaleString("nb-NO")}</span><span className="per">kr / mnd · fastlønn</span></>
            : <><span className="amt">{c.hourly}</span><span className="per">kr / time · timelønn</span></>}
          <span className="tag"><Badge tone="muted">{c.form}</Badge></span>
        </div>
        <div className="an-pbody" style={{ paddingTop: 4, paddingBottom: 4 }}>
          <div className="an-fields">
            <Field k="Stilling" v={c.position} />
            <Field k="Ansettelsesform" v={c.form} />
            <Field k="Stillingsprosent" v={<span className="big">{c.pct != null ? c.pct + " %" : "Variabel"}</span>} />
            <Field k="Avtalt arbeidstid" v={<span><span className="mono">{c.weeklyHours != null ? c.weeklyHours : "—"}</span> t / uke</span>} />
            <Field k="Arbeidstidsordning" v={c.scheme} />
            <Field k="Lønnstype" v={c.payType} />
            <Field k="Startdato" v={<span className="mono">{c.start}</span>} />
            <Field k="Sluttdato" v={c.end ? <span className="mono">{c.end}</span> : "Løpende"} />
            <Field k="Prøvetid" v={c.trial || "Ingen"} />
            <Field k="Overtidsavtale" v={c.overtime} />
          </div>
        </div>
        <div className={`an-sign ${sign}`}>
          <span className="ic"><Ic n={signMeta.ic} s={18} /></span>
          <div className="b"><div className="t">{signMeta.t}</div><div className="s">{signMeta.s}</div></div>
          <Badge tone={signMeta.tone} ic={sign === "signed" ? "check" : null}>{signMeta.label}</Badge>
          {sign === "sent" && <button className="an-btn sm" onClick={() => toast("Påminnelse om signering sendt", { undo: () => {} })}><Ic n="bell" s={13} /> Purr</button>}
          {sign === "draft" && <button className="an-btn sm primary" onClick={() => toast("Avtale sendt til signering", { undo: () => {} })}><Ic n="send" s={13} /> Send</button>}
        </div>
        {addOpen && window.AnAddContract && <window.AnAddContract onClose={() => setAddOpen(false)} toast={toast} preset={e.id} />}
      </Panel>
    );
  }

  window.AnPanels = Object.assign(window.AnPanels || {}, { AssistCard, ReadinessPanel, ContractPanel });
})();
