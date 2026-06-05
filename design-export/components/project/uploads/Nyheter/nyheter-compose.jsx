// ComposeAnnouncement modal — audience picker + count pill + priority preview.

const { useState, useMemo, useEffect, useRef } = React;

function ComposeModal({ open, onClose, onPublish }) {
  const [title, setTitle] = useState("");
  const [body, setBody]   = useState("");
  const [audience, setAudience] = useState("all"); // all | on_duty | department | role | individuals
  const [selectedDepts, setSelectedDepts] = useState([]); // ids
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [selectedPeople, setSelectedPeople] = useState([]);
  const [personSearch, setPersonSearch] = useState("");
  const [bump, setBump] = useState(false);
  const lastN = useRef(NY_TOTAL);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setTitle(""); setBody("");
        setAudience("all");
        setSelectedDepts([]); setSelectedRoles([]); setSelectedPeople([]);
        setPersonSearch("");
      }, 200);
    }
  }, [open]);

  // Recipient resolution (mirrors useBroadcastRecipients on web)
  const resolved = useMemo(() => {
    if (audience === "all")    return NY_PEOPLE;
    if (audience === "on_duty") return NY_PEOPLE.filter(p => p.onDuty);
    if (audience === "department" && selectedDepts.length) {
      return NY_PEOPLE.filter(p => selectedDepts.includes(p.dept));
    }
    if (audience === "role" && selectedRoles.length) {
      return NY_PEOPLE.filter(p => selectedRoles.includes(p.role));
    }
    if (audience === "individuals") {
      return NY_PEOPLE.filter(p => selectedPeople.includes(p.id));
    }
    return [];
  }, [audience, selectedDepts, selectedRoles, selectedPeople]);

  const recipientCount = resolved.length;

  // Bump animation on count change
  useEffect(() => {
    if (lastN.current !== recipientCount) {
      lastN.current = recipientCount;
      setBump(true);
      const t = setTimeout(() => setBump(false), 420);
      return () => clearTimeout(t);
    }
  }, [recipientCount]);

  // Push to publish-handler
  function publish() {
    if (!title.trim() || !body.trim() || recipientCount === 0) return;
    const isTargeted = audience !== "all";
    onPublish({
      title: title.trim(),
      body: body.trim(),
      visibilityScope: isTargeted ? "targeted_members" : "all_members",
      targetProfileIds: isTargeted ? resolved.map(p => p.id) : [],
      audienceKind: audience,
      audienceLabel: audienceLabelFor(audience, selectedDepts, selectedRoles, selectedPeople),
      targetCount: recipientCount,
      deptHint: dominantDept(resolved),
    });
  }

  if (!open) return null;
  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target.classList.contains("scrim")) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="compose-title">
        <div className="modal__head">
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--muted-fg)", fontWeight: 600 }}>
              Ny kunngjøring
            </div>
            <div id="compose-title" className="modal__title">Hva må teamet vite?</div>
          </div>
          <button className="btn btn--icon btn--ghost" onClick={onClose} aria-label="Lukk"><IconX size={18} /></button>
        </div>

        <div className="modal__body">
          {/* Title */}
          <div>
            <div className="field-label">Tittel</div>
            <input
              className="input"
              placeholder="Kort og tydelig — én setning"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          {/* Body */}
          <div>
            <div className="field-label">Melding</div>
            <textarea
              className="textarea"
              placeholder="Hva, når, hvem berører det?"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: 11, color: "var(--muted-fg)" }}>Markdown er ikke støttet enda</span>
              <span className="compose-meta">{body.length} / 800</span>
            </div>
          </div>

          {/* Audience picker */}
          <div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
              <div className="field-label" style={{ margin: 0 }}>Målgruppe</div>
              <span style={{ fontSize: 11, color: "var(--muted-fg)" }}>
                Bestemmer hvem som ser kunngjøringen
              </span>
            </div>
            <div className="seg" role="tablist" aria-label="Velg målgruppe">
              <AudienceTab id="all"         active={audience} setActive={setAudience} icon={IconGlobe}    label="Alle" />
              <AudienceTab id="on_duty"     active={audience} setActive={setAudience} icon={IconClock}    label="På vakt" />
              <AudienceTab id="department"  active={audience} setActive={setAudience} icon={IconBuilding} label="Avdeling" />
              <AudienceTab id="role"        active={audience} setActive={setAudience} icon={IconBadge}    label="Rolle" />
              <AudienceTab id="individuals" active={audience} setActive={setAudience} icon={IconUser}     label="Personer" />
            </div>

            {/* Drilldown */}
            {audience === "department" && (
              <DeptDrilldown selected={selectedDepts} setSelected={setSelectedDepts} />
            )}
            {audience === "role" && (
              <RoleDrilldown selected={selectedRoles} setSelected={setSelectedRoles} />
            )}
            {audience === "individuals" && (
              <PeoplePicker
                selected={selectedPeople}
                setSelected={setSelectedPeople}
                search={personSearch}
                setSearch={setPersonSearch}
              />
            )}
          </div>

          {/* Count pill + priority preview */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div
              className="count-pill"
              data-bump={bump}
              data-tone={recipientCount === 0 ? "muted" : "brand"}
              aria-live="polite"
              aria-atomic="true"
            >
              <IconUsers size={16} style={{ color: "var(--muted-fg)" }} />
              <span className="count-pill__n">{recipientCount}</span>
              <span className="count-pill__lbl">
                {recipientCount === 1 ? "ansatt vil få denne" : "ansatte vil få denne"}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted-fg)", fontFamily: "var(--font-mono)" }}>
              {audienceSummary(audience, selectedDepts, selectedRoles, selectedPeople)}
            </div>
          </div>

          <div className="priority-line">
            <IconBell size={16} />
            <div>
              <strong>Push leveres som operasjonell varsel</strong>{" "}
              <span style={{ color: "oklch(0.45 0.04 50)" }}>
                — <code style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>priority=1</code>,{" "}
                <code style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>mode='operational'</code>.
                Passerer stille timer der vanlig chat blir holdt tilbake.
              </span>
            </div>
          </div>
        </div>

        <div className="modal__foot">
          <button className="btn btn--ghost" onClick={onClose}>Avbryt</button>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--muted-fg)", fontFamily: "var(--font-mono)" }}>
              {audience === "all" ? "visibility_scope: all_members" : "visibility_scope: targeted_members"}
            </span>
            <button
              className="btn btn--primary"
              onClick={publish}
              disabled={!title.trim() || !body.trim() || recipientCount === 0}
              style={{
                opacity: !title.trim() || !body.trim() || recipientCount === 0 ? 0.5 : 1,
                cursor: !title.trim() || !body.trim() || recipientCount === 0 ? "not-allowed" : "pointer",
              }}
            >
              <IconSend size={15} />
              <span>Publiser</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AudienceTab({ id, active, setActive, icon: Icon, label }) {
  return (
    <button data-active={active === id} onClick={() => setActive(id)} role="tab" aria-selected={active === id}>
      <Icon size={16} />
      <span>{label}</span>
    </button>
  );
}

function DeptDrilldown({ selected, setSelected }) {
  function toggle(id) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  }
  return (
    <div style={{ marginTop: 10 }}>
      <div className="dept-grid">
        {NY_DEPTS.map(d => (
          <button
            key={d.id}
            className="dept-tile"
            data-active={selected.includes(d.id)}
            onClick={() => toggle(d.id)}
          >
            <div className="dept-tile__dot" style={{ background: d.color }} />
            <div style={{ flex: 1 }}>
              <div className="dept-tile__name">{d.name}</div>
              <div className="dept-tile__count">{d.count} ansatte</div>
            </div>
            {selected.includes(d.id) && (
              <div style={{ color: "var(--brand-orange)" }}><IconCheck size={16} /></div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function RoleDrilldown({ selected, setSelected }) {
  function toggle(id) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  }
  return (
    <div style={{ marginTop: 10 }}>
      <div className="dept-grid">
        {NY_ROLES.map(r => (
          <button
            key={r.id}
            className="dept-tile"
            data-active={selected.includes(r.id)}
            onClick={() => toggle(r.id)}
          >
            <IconBadge size={16} style={{ color: "var(--muted-fg)" }} />
            <div style={{ flex: 1 }}>
              <div className="dept-tile__name">{r.name}</div>
              <div className="dept-tile__count">{r.count} ansatte</div>
            </div>
            {selected.includes(r.id) && (
              <div style={{ color: "var(--brand-orange)" }}><IconCheck size={16} /></div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function PeoplePicker({ selected, setSelected, search, setSearch }) {
  const q = search.trim().toLowerCase();
  const list = q
    ? NY_PEOPLE.filter(p => p.name.toLowerCase().includes(q))
    : NY_PEOPLE;
  function toggle(id) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  }
  return (
    <div style={{ marginTop: 10 }}>
      <div className="people-search">
        <IconSearch size={15} style={{ color: "var(--muted-fg)" }} />
        <input
          placeholder="Søk etter navn"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {selected.length > 0 && (
          <button
            className="btn btn--ghost btn--sm"
            style={{ marginLeft: "auto", height: 26, padding: "0 8px", fontSize: 12 }}
            onClick={() => setSelected([])}
          >
            Tøm
          </button>
        )}
      </div>
      <div className="people-list">
        {list.map(p => {
          const on = selected.includes(p.id);
          const dept = NY_DEPTS.find(d => d.id === p.dept);
          return (
            <div key={p.id} className="people-row" onClick={() => toggle(p.id)}>
              <div className="avatar avatar--sm">{p.initials}</div>
              <div className="people-row__name">{p.name}</div>
              <div className="people-row__sub">
                {dept?.name} · {p.onDuty ? "på vakt" : "fri"}
              </div>
              <div className="people-check" data-on={on}>
                {on && <IconCheck size={12} strokeWidth={3} />}
              </div>
            </div>
          );
        })}
        {list.length === 0 && (
          <div style={{ padding: 16, textAlign: "center", color: "var(--muted-fg)", fontSize: 13 }}>
            Ingen treff på «{search}»
          </div>
        )}
      </div>
      {selected.length > 0 && (
        <div className="people-selected">
          {selected.map(id => {
            const p = NY_PEOPLE.find(x => x.id === id);
            if (!p) return null;
            return (
              <span key={id} className="pill-token">
                {p.name}
                <button onClick={() => toggle(id)} aria-label={`Fjern ${p.name}`}>
                  <IconX size={12} />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function audienceSummary(audience, depts, roles, people) {
  if (audience === "all") return "audience_kind: all_members";
  if (audience === "on_duty") return "audience_kind: on_duty";
  if (audience === "department") {
    const names = depts.map(id => NY_DEPTS.find(d => d.id === id)?.name).filter(Boolean);
    return names.length ? `audience_kind: department · ${names.join(", ")}` : "audience_kind: department · velg én";
  }
  if (audience === "role") {
    const names = roles.map(id => NY_ROLES.find(r => r.id === id)?.name).filter(Boolean);
    return names.length ? `audience_kind: role · ${names.join(", ")}` : "audience_kind: role · velg én";
  }
  if (audience === "individuals") {
    return people.length ? `audience_kind: individuals · ${people.length} valgt` : "audience_kind: individuals · velg minst én";
  }
  return "";
}

function audienceLabelFor(audience, depts, roles, people) {
  if (audience === "all") return "Hele teamet";
  if (audience === "on_duty") return "På vakt i dag";
  if (audience === "department") {
    if (!depts.length) return "Avdeling";
    return depts.map(id => NY_DEPTS.find(d => d.id === id)?.name).filter(Boolean).join(" · ");
  }
  if (audience === "role") {
    if (!roles.length) return "Rolle";
    return roles.map(id => NY_ROLES.find(r => r.id === id)?.name).filter(Boolean).join(" · ");
  }
  if (audience === "individuals") return `${people.length} valgte`;
  return "—";
}

function dominantDept(profiles) {
  if (!profiles.length) return "kitchen";
  const counts = {};
  for (const p of profiles) counts[p.dept] = (counts[p.dept] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

Object.assign(window, { ComposeModal });
