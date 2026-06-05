// ===== Ansatte — panels part 2: Competence · Access · Placement · Absence · PII · Offboarding · Audit =====
(function () {
  const { useState } = React;
  const A = window.An;
  const { Ic, SD, Panel, Badge, ConfirmModal, AccessBadge, AuthorityBadge, dept, loc, team, pos, profession, protocol, legalFn, empName } = A;

  // ============================================================
  // COMPETENCE — three separate axes (positions · professions · legal)
  // ============================================================
  function CompetencePanel({ e, toast }) {
    return (
      <Panel icon="cap" title="Kompetanse" sub="Stillinger · profesjoner · juridiske funksjoner" id="competence"
        action={<button className="an-btn sm" onClick={() => window.AnCtl.open("competence")}><Ic n="plus" s={13} sw={2.2} /> Legg til</button>}>
        {/* Positions (what you can do) */}
        <div className="an-comp-sub"><span className="ic"><Ic n="layers" s={13} /></span> Stillinger</div>
        <div className="an-pos-grid">
          {e.positions.map((pp) => {
            const p = pos(pp.position); const d = dept(p.dept); const pf = profession(p.profession);
            return (
              <div key={pp.position} className={`an-pos ${pp.isPrimary ? "primary" : ""}`}>
                <span className="an-pos-ic" style={{ background: p.color }}><Ic n={p.icon} s={17} /></span>
                <div className="an-pos-b">
                  <div className="an-pos-nm">{p.name}{pp.isPrimary && <span className="pr">PRIMÆR</span>}</div>
                  <div className="an-pos-m"><span style={{ color: d.color, fontWeight: 600 }}>{d.name}</span><span>·</span>{pf ? pf.name : "—"}{p.season && <><span>·</span>sesong {p.season}</>}</div>
                  <div className="an-pos-skills">{p.skills.map((s) => <span key={s} className="an-pos-skill">{s}</span>)}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Professions (training-linked) */}
        <div className="an-comp-sub"><span className="ic"><Ic n="cap" s={13} /></span> Profesjoner</div>
        {e.professions.map((pid) => {
          const pf = profession(pid);
          return (
            <div key={pid} className="an-prof">
              <div className="an-prof-top">
                <span className="an-prof-nm">{pf.name}</span>
                <span className="an-prof-slug">{pf.slug}</span>
                <span style={{ flex: 1 }} />
                <Badge tone={pf.universal ? "info" : "muted"} ic={pf.universal ? "spark2" : "building"}>{pf.universal ? "Universell" : "Arbeidsplass-spesifikk"}</Badge>
              </div>
              <p className="an-prof-desc">{pf.desc}</p>
              <div className="an-prof-tr">
                {pf.training.map((t) => (
                  <span key={t.protocol} className={`an-prof-trchip ${t.required ? "required" : "optional"}`}>
                    <span className="req" /> {protocol(t.protocol).name} <span className="w">×{t.weight}</span>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
        {e.professions.length === 0 && <div className="an-scope-empty">Ingen profesjon registrert.</div>}

        {/* Legal functions (compliance) */}
        <div className="an-comp-sub"><span className="ic"><Ic n="shield" s={13} /></span> Juridiske funksjoner</div>
        {(e.legal || []).length === 0
          ? <div className="an-scope-empty">Ingen lovpålagte verv tildelt.</div>
          : e.legal.map((lf) => {
            const f = legalFn(lf.fn);
            const st = lf.state === "completed" ? { tone: "success", label: "Oppfylt", ic: "check" } : lf.state === "in_progress" ? { tone: "warning", label: "Under opplæring", ic: "clock" } : { tone: "muted", label: "Tildelt", ic: "clock" };
            return (
              <div key={lf.fn} className="an-legal">
                <span className="an-legal-ic"><Ic n="scale" s={18} /></span>
                <div className="an-legal-b">
                  <div className="an-legal-nm">{f.name} <Badge tone={st.tone} ic={st.ic}>{st.label}</Badge></div>
                  <div className="an-legal-desc">{f.desc}</div>
                  <div className="an-legal-meta">
                    <span><span className="k" style={{ color: "var(--muted-soft)" }}>Hjemmel</span> <span className="basis">{f.basis}</span></span>
                    <span><span className="k" style={{ color: "var(--muted-soft)" }}>Opplæring</span> <strong>{f.hours} t</strong></span>
                    {f.profession && <span><span className="k" style={{ color: "var(--muted-soft)" }}>Profesjon</span> <strong>{profession(f.profession).name}</strong></span>}
                    <span><span className="k" style={{ color: "var(--muted-soft)" }}>Tildelt</span> <strong>{lf.assignedAt}</strong> · av {lf.assignedBy}</span>
                  </div>
                </div>
              </div>
            );
          })}
      </Panel>
    );
  }

  // ============================================================
  // ACCESS — four separate concepts + fine-grained scopes
  // ============================================================
  function AccessPanel({ e, toast }) {
    const al = SD.ACCESS_LEVELS[e.access];
    const au = SD.AUTHORITY_LEVELS[e.authority];
    return (
      <Panel icon="lock" title="Tilgang & ansvar" sub="Fire adskilte konsepter — slås aldri sammen" id="access"
        action={<button className="an-btn sm" onClick={() => window.AnCtl.open("access")}><Ic n="pen" s={13} /> Endre</button>}>
        {/* 1 — platform access level */}
        <div className="an-axis">
          <div className="an-axis-k"><div className="t">Tilgangsnivå</div><div className="s">Plattform-rolle</div></div>
          <div className="an-axis-v"><div className="badges"><AccessBadge id={e.access} /></div><div className="grants">{al.grants}</div></div>
        </div>
        {/* 2 — operational authority */}
        <div className="an-axis">
          <div className="an-axis-k"><div className="t">Ansvarsnivå</div><div className="s">Operativ rang</div></div>
          <div className="an-axis-v"><div className="badges"><AuthorityBadge id={e.authority} /></div><div className="grants">{au.desc}</div></div>
        </div>
        {/* 3 — leadership via dept/team */}
        <div className="an-axis">
          <div className="an-axis-k"><div className="t">Ledelse</div><div className="s">Via avdeling / lag</div></div>
          <div className="an-axis-v">
            {e.leadership.length === 0
              ? <span className="none">Ingen ledelsesrelasjoner</span>
              : <div className="lead-list">{e.leadership.map((l) => <span key={l} className="lead-item"><span className="ic"><Ic n="users" s={14} /></span>{l}</span>)}</div>}
          </div>
        </div>
        {/* 4 — fine-grained access scopes (profile_access · domain.action) */}
        <div className="an-comp-sub" style={{ borderTop: "1px solid var(--border)" }}>
          <span className="ic"><Ic n="sliders" s={13} /></span> Finmasket tilgang
          <span style={{ color: "var(--muted-soft)", fontWeight: 500, letterSpacing: 0, textTransform: "none", marginLeft: 6 }}>domain.action</span>
        </div>
        <ScopeList e={e} />
      </Panel>
    );
  }
  // separate component so the scopes array reads cleanly
  function ScopeList({ e }) {
    const scopes = e.accessScopes || [];
    if (scopes.length === 0) return <div className="an-scope-empty">Kun standard ansatt-tilgang. Ingen ekstra scopes tildelt.</div>;
    return (
      <div className="an-scopes">
        {scopes.map((s, i) => {
          const [domainPart, action] = s.scope.split(".");
          return (
            <div key={i} className="an-scope">
              <div className="an-scope-l">
                <span className="an-scope-code"><span className="dom">{domainPart}</span>.{action}</span>
                <span className="an-scope-meta"><span className="k" style={{ color: "var(--muted-soft)" }}>tildelt av</span> {s.grantedBy}</span>
              </div>
              <span className="an-scope-meta"><span className="mono">{s.createdAt}</span>{s.updatedAt !== s.createdAt && <span> · endret <span className="mono">{s.updatedAt}</span></span>}</span>
            </div>
          );
        })}
      </div>
    );
  }

  // ============================================================
  // PLACEMENT — multi-department / multi-location is normal
  // ============================================================
  function PlacementPanel({ e, toast }) {
    const p = e.placement;
    const Chip = ({ d, primary, label, color }) => (
      <span className={`an-pchip ${primary ? "primary" : ""}`}>{color && <span className="d" style={{ background: color }} />}{primary && <span className="pr">PRIMÆR</span>}{label}</span>
    );
    return (
      <Panel icon="mappin" title="Plassering" sub="Avdelinger, områder og lag" id="placement"
        action={<button className="an-btn sm" onClick={() => window.AnCtl.open("placement")}><Ic n="pen" s={13} /> Endre</button>}>
        <div className="an-place-row">
          <span className="pk">Avdelinger</span>
          <div className="an-place-chips">
            {p.depts.map((id) => <Chip key={id} primary={id === p.primary} label={dept(id).name} color={dept(id).color} />)}
          </div>
        </div>
        <div className="an-place-row">
          <span className="pk">Områder</span>
          <div className="an-place-chips">{p.locations.map((id) => <span key={id} className="an-pchip"><Ic n="mappin" s={12} c="var(--muted)" />{loc(id).name}</span>)}</div>
        </div>
        <div className="an-place-row">
          <span className="pk">Lag</span>
          <div className="an-place-chips">{p.team ? <span className="an-pchip"><Ic n="users" s={12} c="var(--muted)" />{team(p.team).name}</span> : <span style={{ fontSize: 12.5, color: "var(--muted-soft)", fontStyle: "italic", paddingTop: 4 }}>Ikke medlem av et lag</span>}</div>
        </div>
        <div className="an-place-row">
          <span className="pk">Ledere</span>
          <div className="an-place-chips">
            <span className="an-pchip"><Ic n="user" s={12} c="var(--muted)" />Avd.leder: {p.deptLeader ? empName(p.deptLeader) : "—"}</span>
            {p.teamLeader && <span className="an-pchip"><Ic n="user" s={12} c="var(--muted)" />Lagleder: {empName(p.teamLeader)}</span>}
          </div>
        </div>
        <div className="an-comp-sub" style={{ borderTop: "1px solid var(--border)" }}><span className="ic"><Ic n="history" s={13} /></span> Tildelingshistorikk</div>
        <div className="an-hist">
          {p.history.map((h, i) => <div key={i} className="an-hist-item"><span className="when">{h.when}</span><span className="what">{h.what}</span></div>)}
        </div>
      </Panel>
    );
  }

  // ============================================================
  // ABSENCE
  // ============================================================
  function AbsencePanel({ e, toast }) {
    const A_ = SD.ABSENCE_TYPES;
    const statusBadge = (s) => s === "approved" ? <Badge tone="success" ic="check">Godkjent</Badge> : s === "pending" ? <Badge tone="warning" ic="clock">Venter</Badge> : <Badge tone="error" ic="x">Avslått</Badge>;
    return (
      <Panel icon="umbrella" title="Fravær & tilgjengelighet" sub={`${e.absence.length} registrering${e.absence.length === 1 ? "" : "er"}`} id="absence"
        action={<button className="an-btn sm" onClick={() => window.AnCtl.open("absence")}><Ic n="plus" s={13} /> Nytt</button>}>
        {e.absence.length === 0
          ? <div className="so-empty"><span className="ic"><Ic n="umbrella" s={20} /></span><div className="t">Ingen fravær</div><div className="s">Ingen registrerte permisjoner eller sykefravær.</div></div>
          : e.absence.map((ab, i) => {
            const t = A_[ab.type];
            return (
              <div key={i} className="an-abs">
                <span className="ai" style={{ color: `var(--${t.tone === "error" ? "error" : t.tone === "purple" ? "purple" : t.tone === "info" ? "info" : "muted"})` }}><Ic n={t.icon} s={16} /></span>
                <div className="am"><div className="at">{t.label}</div><div className="as">{ab.from} – {ab.to}</div></div>
                <span className="ad">{ab.days} d</span>
                {statusBadge(ab.status)}
              </div>
            );
          })}
      </Panel>
    );
  }

  // ============================================================
  // PII — masked + reveal-and-log
  // ============================================================
  function unmask(str) {
    if (!str || /Ikke registrert|Mangler/i.test(str)) return str;
    let n = 2;
    return str.replace(/•/g, () => String((n = (n * 7 + 3) % 10)));
  }
  function PiiPanel({ e, toast, canReveal = true }) {
    const [shown, setShown] = useState({});
    const [ask, setAsk] = useState(null); // field key pending confirm
    const rows = [
      { k: "personnr", label: "Personnummer" },
      { k: "bank", label: "Kontonummer" },
      { k: "address", label: "Adresse" },
      { k: "family", label: "Familiesituasjon" },
      { k: "taxCard", label: "Skattekort / lønns-ID" },
    ];
    const reveal = (k) => { setShown((s) => ({ ...s, [k]: true })); toast("Innsyn logget i revisjonslogg", { undo: () => setShown((s) => ({ ...s, [k]: false })) }); };
    return (
      <Panel icon="eye" iconTone="crit" title="Sensitive opplysninger" sub="Maskert som standard · rollestyrt" id="pii">
        <div className="an-pii-note">
          <span className="ic"><Ic n="lock" s={15} /></span>
          <span>Skjult fordi feltene er personsensitive (personvern). Du har <strong>pii.reveal</strong>-tilgang. Hvert innsyn logges med din identitet, tidspunkt og IP.</span>
          {canReveal && <button className="lk" onClick={() => toast("Åpner revisjonslogg for innsyn")}>Se innsynslogg</button>}
        </div>
        {rows.map((r) => {
          const isShown = shown[r.k];
          const val = e.pii[r.k] || "—";
          const missing = /Ikke registrert|Mangler/i.test(val);
          return (
            <div key={r.k} className="an-pii-row">
              <span className="pk">{r.label}</span>
              <span className={`pv ${isShown ? "" : "masked"}`} style={missing ? { color: "var(--error)", letterSpacing: 0 } : null}>{missing ? val : isShown ? unmask(val) : val}</span>
              {missing
                ? <span style={{ fontSize: 11, color: "var(--muted-soft)" }}>—</span>
                : <button className={`an-reveal ${isShown ? "shown" : ""}`} onClick={() => isShown ? setShown((s) => ({ ...s, [r.k]: false })) : setAsk(r)}>
                    <Ic n={isShown ? "eye" : "lock"} s={13} /> {isShown ? "Skjul" : "Vis"}
                  </button>}
            </div>
          );
        })}
        <ConfirmModal open={!!ask} onClose={() => setAsk(null)} tone="crit" ic="eye"
          title={`Vis ${ask ? ask.label.toLowerCase() : ""}?`}
          body={`Du er i ferd med å vise en sensitiv personopplysning for ${e.display}.`}
          note="Innsynet logges i revisjonsloggen med ditt navn, tidspunkt og IP-adresse. Del aldri informasjonen utenfor det den trengs til."
          confirmLabel="Vis og logg innsyn" confirmTone="primary" onConfirm={() => reveal(ask.k)} />
      </Panel>
    );
  }

  // ============================================================
  // OFFBOARDING
  // ============================================================
  function OffboardingPanel({ e, toast }) {
    const o = e.offboarding;
    const stMeta = (s) => s === "done" ? { tone: "success", label: "Fullført", ic: "check" } : s === "inprogress" ? { tone: "info", label: "Pågår", ic: "clock" } : s === "pending" ? { tone: "warning", label: "Venter", ic: "clock" } : s === "scheduled" ? { tone: "purple", label: "Planlagt", ic: "calendar" } : { tone: "muted", label: "Ikke startet", ic: "clock" };
    const open = o.tasks.filter((t) => t.status !== "done").length;
    return (
      <Panel icon="logout" iconTone="warn" title="Avslutning" sub="Handover, tilgang og forpliktelser" id="offboarding">
        <div className="an-off-banner">
          <span className="ic"><Ic n="logout" s={18} /></span>
          <div className="b"><div className="t">{o.reason}</div><div className="s">Oppsigelse levert {o.noticeGiven} · {open} oppgaver gjenstår</div></div>
          <div className="cd"><div className="n">{o.lastDay.replace(" 2026", "")}</div><div className="l">Siste dag</div></div>
        </div>
        <div className="an-axis">
          <div className="an-axis-k"><div className="t">Tilgang</div><div className="s">Fjernes automatisk</div></div>
          <div className="an-axis-v"><div className="badges"><Badge tone="warning" ic="lock">{o.accessRemoval}</Badge></div><div className="grants">App, kasse og nøkkelkort deaktiveres ved arbeidstidens slutt siste dag.</div></div>
        </div>
        <div className="an-comp-sub" style={{ borderTop: "1px solid var(--border)" }}><span className="ic"><Ic n="list" s={13} /></span> Gjenstående forpliktelser</div>
        <div className="an-checklist">
          {o.tasks.map((t) => {
            const m = stMeta(t.status);
            return (
              <div key={t.id} className="an-ci" data-st={t.status === "done" ? "done" : t.status === "scheduled" ? "pending" : t.status === "notstarted" ? "missing" : "pending"}>
                <span className="ci-ic"><Ic n={m.ic} s={13} sw={m.ic === "check" ? 2.4 : 1.7} /></span>
                <div className="ci-main"><div className="ci-t">{t.label}</div><div className="ci-m"><span className="ci-kind">Ansvarlig</span> {t.owner === "System" ? "System" : empName(t.owner)}{t.when && <span> · {t.when}</span>}</div></div>
                <Badge tone={m.tone}>{m.label}</Badge>
              </div>
            );
          })}
        </div>
      </Panel>
    );
  }

  // ============================================================
  // AUDIT LOG
  // ============================================================
  function AuditPanel({ e, toast }) {
    const icFor = (k) => k === "pii" ? "eye" : k === "access" ? "lock" : k === "contract" ? "checkdoc" : k === "lifecycle" ? "user" : "settings";
    const items = e.audit && e.audit.length ? e.audit : [];
    return (
      <Panel icon="history" title="Aktivitets- & revisjonslogg" sub={`${items.length} hendelse${items.length === 1 ? "" : "r"}`} id="audit"
        action={<button className="an-btn sm" onClick={() => toast("Eksporterer revisjonslogg")}><Ic n="download" s={13} /> Eksport</button>}>
        {items.length === 0
          ? <div className="so-empty"><span className="ic"><Ic n="history" s={20} /></span><div className="t">Ingen hendelser</div><div className="s">Endringer på profilen vil vises her.</div></div>
          : <div className="an-audit">
            {items.map((a, i) => (
              <div key={i} className="an-audit-item" data-k={a.kind}>
                <span className="ai"><Ic n={icFor(a.kind)} s={14} /></span>
                <div className="ab"><span className="who">{a.who}</span> {a.what}</div>
                <span className="aw">{a.when}</span>
              </div>
            ))}
          </div>}
      </Panel>
    );
  }

  window.AnPanels = Object.assign(window.AnPanels || {}, {
    CompetencePanel, AccessPanel, PlacementPanel, AbsencePanel, PiiPanel, OffboardingPanel, AuditPanel,
  });
})();
