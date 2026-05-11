// Sidebar shell + News surface chrome (header, empty state).
// All components share the dashboard chrome.

function Sidebar({ active = "nyheter" }) {
  const items = [
    { id: "home",     label: "Hjem",      icon: IconHome },
    { id: "shifts",   label: "Vakter",    icon: IconCalendar },
    { id: "team",     label: "Ansatte",   icon: IconUsers },
    { id: "training", label: "Trening",   icon: IconBook },
    { id: "hms",      label: "HMS",       icon: IconShield },
  ];
  const commItems = [
    { id: "nyheter",  label: "Nyheter",   icon: IconMegaphone },
    { id: "chat",     label: "Kanaler",   icon: IconMsg },
  ];
  return (
    <aside className="so-side">
      <div className="so-side__logo">
        <img src="assets/smartout-icon.png" alt="" />
        <div className="so-side__logo-name">Smartout</div>
      </div>

      {items.map(it => {
        const Ic = it.icon;
        return (
          <div key={it.id} className="so-nav" data-active={active === it.id}>
            <Ic size={18} className="so-nav__icon" />
            <span>{it.label}</span>
          </div>
        );
      })}

      <div className="so-side__group-label">Kommunikasjon</div>
      {commItems.map(it => {
        const Ic = it.icon;
        return (
          <div key={it.id} className="so-nav" data-active={active === it.id}>
            <Ic size={18} className="so-nav__icon" />
            <span>{it.label}</span>
            {it.id === "nyheter" && (
              <span style={{
                marginLeft: "auto",
                background: "var(--brand-orange)",
                color: "#fff",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 6px",
                borderRadius: 9999,
                lineHeight: 1,
              }}>2</span>
            )}
          </div>
        );
      })}

      <div style={{ marginTop: "auto" }}>
        <div className="so-nav">
          <IconSettings size={18} className="so-nav__icon" />
          <span>Innstillinger</span>
        </div>
        <div className="so-side__workspace">
          <div className="so-side__ws-avatar">S</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="so-side__ws-name">Strøm Mat &amp; Bar</div>
            <div className="so-side__ws-role">Sofia · Daglig leder</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function PageHeader({ onCompose, role, onRoleHint }) {
  return (
    <div className="so-topbar">
      <div>
        <div className="so-crumb">Kommunikasjon · Nyheter</div>
        <h1 className="so-h1">Nyheter</h1>
        <div className="so-sub">Kunngjøringer fra ledelsen. Festet vises øverst for alle.</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {role === "manager" ? (
          <button className="btn btn--primary" onClick={onCompose}>
            <IconMegaphone size={16} />
            <span>Ny kunngjøring</span>
          </button>
        ) : (
          <div style={{
            fontSize: 12, color: "var(--muted-fg)", textAlign: "right", lineHeight: 1.4,
            maxWidth: 220,
          }}>
            Du ser kanalen som ansatt. Kun ledere kan publisere og feste.
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onCompose, role }) {
  return (
    <div className="empty">
      <div className="empty__icon"><IconMegaphone size={26} strokeWidth={1.6} /></div>
      <h2 className="empty__title">Ingen kunngjøringer enda</h2>
      <p className="empty__sub">
        Når ledere publiserer noe som hele teamet trenger å vite, dukker det opp her. Festede saker vises øverst.
      </p>
      {role === "manager" && (
        <button
          className="btn btn--primary"
          style={{ marginTop: 18 }}
          onClick={onCompose}
        >
          <IconMegaphone size={16} />
          <span>Publiser den første</span>
        </button>
      )}
    </div>
  );
}

function DesignNote() {
  return (
    <div className="design-note">
      <strong>Forskjell ansatt vs leder</strong>
      <ul>
        <li>Ansatt: ser <em>Festet</em>-stripen og kunngjøringer, men ingen «Ny kunngjøring»-knapp og ingen overflow-meny på kort.</li>
        <li>Ansatt: målrettede kunngjøringer filtreres bort av RLS før de når klienten — ansatt utenfor målgruppen ser dem ikke i det hele tatt.</li>
        <li>Push: <code>message_type='announcement'</code> får <code>priority=1</code> + <code>mode='operational'</code>; passerer stille timer der vanlig chat ville blitt holdt tilbake.</li>
      </ul>
    </div>
  );
}

Object.assign(window, { Sidebar, PageHeader, EmptyState, DesignNote });
