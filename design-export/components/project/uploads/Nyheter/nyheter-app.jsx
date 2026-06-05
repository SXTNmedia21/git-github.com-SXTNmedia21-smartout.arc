// Main app — feed + pinned strip + NewsCard menu + tweaks + telemetry overlay.

const { useState: _useState, useEffect: _useEffect, useRef: _useRef, useMemo: _useMemo } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "viewAs": "manager",
  "feedState": "normal",
  "pinTone": "default",
  "showTelemetry": true
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const role = t.viewAs;

  const [feed, setFeed] = _useState(NY_INITIAL_FEED);
  const [menuOpenId, setMenuOpenId] = _useState(null);
  const [composeOpen, setComposeOpen] = _useState(false);
  const [tele, setTele] = _useState([]);
  const [ghost, setGhost] = _useState(null);
  const [leavingId, setLeavingId] = _useState(null);

  // Apply feedState tweak — derive displayed list
  const displayed = _useMemo(() => {
    if (t.feedState === "empty") return [];
    if (t.feedState === "no_pins") return feed.map(m => ({ ...m, pinned: false }));
    if (t.feedState === "one_pin") {
      let kept = false;
      return feed.map(m => {
        if (m.pinned && !kept) { kept = true; return m; }
        return { ...m, pinned: false };
      });
    }
    return feed;
  }, [feed, t.feedState]);

  const pinned = displayed.filter(m => m.pinned);
  const stream = displayed;

  // Close menu on outside click
  _useEffect(() => {
    function onDoc(e) {
      if (!e.target.closest?.(".news-card__menu-area")) setMenuOpenId(null);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function emit(name, props, kind = "sent") {
    setTele(t => [{ name, props, kind, at: new Date().toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) }, ...t].slice(0, 12));
  }

  function showGhost(text, ms = 2200) {
    setGhost(text);
    setTimeout(() => setGhost(null), ms);
  }

  function pinMessage(id) {
    setFeed(f => f.map(m => m.id === id ? { ...m, pinned: true } : m));
    const m = feed.find(x => x.id === id);
    emit("channel.message.pinned", {
      message_id: id,
      pinned_by: "p1",
      pinned_at: new Date().toISOString(),
      channel: "news",
      title: m?.title?.slice(0, 40) + "…",
    }, "pin");
    showGhost("Realtime: festet · sendt til alle medlemmer");
    setMenuOpenId(null);
  }

  function unpinMessage(id) {
    setFeed(f => f.map(m => m.id === id ? { ...m, pinned: false } : m));
    emit("channel.message.unpinned", {
      message_id: id,
      unpinned_by: "p1",
      channel: "news",
    }, "unpin");
    setMenuOpenId(null);
  }

  function deleteMessage(id) {
    setLeavingId(id);
    setTimeout(() => {
      setFeed(f => f.filter(m => m.id !== id));
      setLeavingId(null);
    }, 250);
    setMenuOpenId(null);
  }

  function handlePublish(payload) {
    const newMsg = {
      id: "m_" + Math.random().toString(36).slice(2, 8),
      author: "Sofia Bergmann",
      authorRole: "Daglig leder",
      initials: "SB",
      dept: payload.deptHint,
      deptLabel: payload.audienceLabel,
      time: "nettopp",
      title: payload.title,
      body: payload.body,
      audience: payload.visibilityScope,
      audienceLabel: payload.audienceLabel,
      targetCount: payload.targetCount,
      unread: true,
      pinned: false,
      priority: 1,
    };
    setFeed(f => [newMsg, ...f]);
    emit("channel.message.sent", {
      message_type: "announcement",
      visibility_scope: payload.visibilityScope,
      target_profile_count: payload.targetCount,
      audience_kind: payload.audienceKind,
      notification_priority: 1,
      notification_mode: "operational",
    }, "sent");
    setComposeOpen(false);
    showGhost(`Push sendt: priority=1, mode='operational' → ${payload.targetCount} ansatte`);
  }

  return (
    <div className="so-app">
      <Sidebar active="nyheter" />

      <main className="so-main">
        <div data-screen-label="01 Nyheter — feed" className="so-page">
          <PageHeader
            onCompose={() => setComposeOpen(true)}
            role={role}
          />

          {/* Pinned strip */}
          {pinned.length > 0 && t.feedState !== "empty" && (
            <PinnedStrip
              pinned={pinned}
              role={role}
              tone={t.pinTone}
              onUnpin={(id) => unpinMessage(id)}
              onJump={(id) => {
                const el = document.getElementById("news-" + id);
                if (el) {
                  el.style.transition = "background-color 600ms";
                  el.style.backgroundColor = "oklch(0.65 0.22 40 / 0.06)";
                  setTimeout(() => { el.style.backgroundColor = ""; }, 700);
                }
              }}
            />
          )}

          {stream.length === 0 ? (
            <EmptyState onCompose={() => setComposeOpen(true)} role={role} />
          ) : (
            <div>
              {stream.map(m => (
                <NewsCard
                  key={m.id}
                  msg={m}
                  role={role}
                  menuOpen={menuOpenId === m.id}
                  leaving={leavingId === m.id}
                  onToggleMenu={() => setMenuOpenId(menuOpenId === m.id ? null : m.id)}
                  onPin={() => pinMessage(m.id)}
                  onUnpin={() => unpinMessage(m.id)}
                  onDelete={() => deleteMessage(m.id)}
                />
              ))}
            </div>
          )}

          <DesignNote />
        </div>
      </main>

      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onPublish={handlePublish}
      />

      {ghost && (
        <div className="ghost-banner">
          <IconSparkles size={14} />
          <span>{ghost}</span>
        </div>
      )}

      {t.showTelemetry && <TelemetryOverlay events={tele} onClear={() => setTele([])} />}

      <TweaksPanel title="Tweaks">
        <TweakSection title="Visning">
          <TweakRadio
            label="Rolle"
            value={t.viewAs}
            onChange={(v) => setTweak("viewAs", v)}
            options={[
              { label: "Leder", value: "manager" },
              { label: "Ansatt", value: "employee" },
            ]}
          />
          <TweakSelect
            label="Feed-tilstand"
            value={t.feedState}
            onChange={(v) => setTweak("feedState", v)}
            options={[
              { label: "Vanlig (3+ festet)", value: "normal" },
              { label: "Én festet", value: "one_pin" },
              { label: "Ingen festet", value: "no_pins" },
              { label: "Tom feed", value: "empty" },
            ]}
          />
        </TweakSection>

        <TweakSection title="Pinned strip">
          <TweakRadio
            label="Tone"
            value={t.pinTone}
            onChange={(v) => setTweak("pinTone", v)}
            options={[
              { label: "Glass", value: "default" },
              { label: "Varm", value: "warm" },
              { label: "Accent", value: "accent" },
            ]}
          />
        </TweakSection>

        <TweakSection title="Utvikler">
          <TweakToggle
            label="Telemetry-overlay"
            value={t.showTelemetry}
            onChange={(v) => setTweak("showTelemetry", v)}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

// ───── PinnedStrip ─────
function PinnedStrip({ pinned, role, tone, onUnpin, onJump }) {
  return (
    <div className="pinned-strip" data-tone={tone} style={{ animation: "stripIn 400ms var(--ease-expo)" }}>
      <div className="pinned-strip__head">
        <IconPinSolid size={14} style={{ color: "oklch(0.65 0.18 65)" }} />
        <div className="pinned-strip__title">Festet</div>
        <div className="pinned-strip__count">{pinned.length}</div>
      </div>
      <div className="pinned-strip__scroller">
        {pinned.map(m => {
          const dept = NY_DEPTS.find(d => d.id === m.dept);
          return (
            <button
              key={m.id}
              className="pin-chip"
              style={{ borderLeftColor: dept?.color || "var(--dept-kitchen)" }}
              onClick={() => onJump(m.id)}
            >
              <div className="pin-chip__pin"><IconPinSolid size={12} /></div>
              <div className="pin-chip__meta">
                <span>{m.deptLabel}</span>
              </div>
              <div className="pin-chip__title">{m.title}</div>
              {role === "manager" && (
                <span
                  onClick={(e) => { e.stopPropagation(); onUnpin(m.id); }}
                  style={{
                    position: "absolute", bottom: 6, right: 8,
                    fontSize: 10, color: "var(--muted-fg)",
                    fontWeight: 600, letterSpacing: "0.04em",
                    cursor: "pointer", padding: "2px 6px",
                    borderRadius: 9999,
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--secondary)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >Løsne</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ───── NewsCard ─────
function NewsCard({ msg, role, menuOpen, leaving, onToggleMenu, onPin, onUnpin, onDelete }) {
  const dept = NY_DEPTS.find(d => d.id === msg.dept);
  const chipClass =
    msg.dept === "kitchen" ? "chip chip--kitchen" :
    msg.dept === "bar"     ? "chip chip--bar" :
    msg.dept === "floor"   ? "chip chip--floor" :
    msg.dept === "event"   ? "chip chip--event" :
    "chip chip--storage";

  return (
    <article
      id={"news-" + msg.id}
      className={"news-card" + (leaving ? " ann-leaving" : "")}
      data-unread={msg.unread}
    >
      {msg.pinned && (
        <div className="news-card__pin" title="Festet">
          <IconPinSolid size={16} />
        </div>
      )}
      {role === "manager" && (
        <div className="news-card__menu-area">
          <button
            className="news-card__menu-btn"
            onClick={onToggleMenu}
            aria-label="Meny"
            aria-expanded={menuOpen}
          >
            <IconMore size={18} />
          </button>
          {menuOpen && (
            <div className="menu" role="menu">
              {msg.pinned ? (
                <button className="menu__item" onClick={onUnpin}>
                  <IconPinOff size={16} style={{ color: "var(--muted-fg)" }} />
                  <span>Løsne</span>
                </button>
              ) : (
                <button className="menu__item" onClick={onPin}>
                  <IconPin size={16} style={{ color: "oklch(0.65 0.18 65)" }} />
                  <span>Fest øverst</span>
                </button>
              )}
              <button className="menu__item">
                <IconBell size={16} style={{ color: "var(--muted-fg)" }} />
                <span>Send påminnelse</span>
              </button>
              <button className="menu__item">
                <IconUsers size={16} style={{ color: "var(--muted-fg)" }} />
                <span>Se hvem som har lest</span>
              </button>
              <div className="menu__sep" />
              <button className="menu__item menu__item--destructive" onClick={onDelete}>
                <IconX size={16} />
                <span>Slett</span>
              </button>
            </div>
          )}
        </div>
      )}

      <div className="news-card__head">
        <div className="avatar">{msg.initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="news-card__author">{msg.author}</div>
          <div className="news-card__meta">
            <span>{msg.authorRole}</span>
            <span className="dot" />
            <span>{msg.time}</span>
          </div>
        </div>
      </div>

      <h2 className="news-card__title">{msg.title}</h2>
      <p className="news-card__body">{msg.body}</p>

      <div className="news-card__foot">
        <span className={chipClass}>
          {msg.audience === "all_members" ? <IconGlobe size={11} /> : <IconUsers size={11} />}
          {msg.audienceLabel}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted-fg)" }}>
          {msg.audience === "targeted_members"
            ? `${msg.targetCount} mottakere`
            : `${NY_TOTAL} mottakere`}
        </span>
        {msg.priority === 1 && (
          <span className="badge-9" title="Notification priority = 1, mode = operational">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <IconBell size={9} strokeWidth={2.4} />
              Operasjonell
            </span>
          </span>
        )}
        {msg.unread && (
          <span style={{
            marginLeft: "auto",
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 11, color: "var(--brand-orange)", fontWeight: 600,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--brand-orange)" }} />
            Ikke lest
          </span>
        )}
      </div>
    </article>
  );
}

// ───── Telemetry overlay ─────
function TelemetryOverlay({ events, onClear }) {
  return (
    <div className="tele" aria-label="Telemetry events">
      <div className="tele__head">
        <span>Telemetry</span>
        <button
          onClick={onClear}
          style={{
            background: "transparent", border: 0, color: "oklch(0.7 0.02 55)",
            fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em",
            textTransform: "uppercase", cursor: "pointer",
          }}
        >Clear</button>
      </div>
      <div className="tele__list">
        {events.length === 0 && (
          <div style={{ padding: "12px 10px", color: "oklch(0.55 0.02 55)" }}>
            Ingen hendelser. Publiser eller fest noe for å se events.
          </div>
        )}
        {events.map((ev, i) => (
          <div key={i} className="tele__row" data-kind={ev.kind}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="tele__name">{ev.name}</span>
              <span style={{ color: "oklch(0.55 0.02 55)" }}>{ev.at}</span>
            </div>
            <div className="tele__props">
              {Object.entries(ev.props).map(([k, v]) => (
                <div key={k}>{k}: <span style={{ color: "oklch(0.85 0.04 55)" }}>{String(v)}</span></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
