/* global React, Icon, Icons, Avatar, Sidebar, Topbar */
// POS Account Management — admin web page (/dashboard/pos-accounts/)

const { useState } = React;

const POS_VENDORS = [
  { id: "lightspeed_k", name: "Lightspeed K-Series", desc: "Restaurant POS · K-Series API", brand: "oklch(0.62 0.155 42)", logoLetter: "L", available: true, badge: "V1" },
  { id: "lightspeed_x", name: "Lightspeed X-Series", desc: "Retail POS · X-Series API", brand: "oklch(0.62 0.155 42)", logoLetter: "L", available: false, badge: "V2" },
  { id: "pos_pro",      name: "POS Pro",             desc: "Nordisk multi-vertikal kassesystem", brand: "oklch(0.55 0.12 240)", logoLetter: "P", available: false, badge: "V2" },
  { id: "resengine",    name: "ResEngine",           desc: "Restaurant management suite", brand: "oklch(0.58 0.14 150)", logoLetter: "R", available: false, badge: "V2" },
  { id: "epos_now",     name: "ePos Now",            desc: "Cloud POS · UK + Nordics", brand: "oklch(0.45 0.16 295)", logoLetter: "e", available: false, badge: "V2" },
];

const POS_ACCOUNTS_DEFAULT = [
  {
    id: "pa_a91f",
    vendor: "lightspeed_k",
    label: "Strøm Mat & Bar — K-Series",
    currency: "NOK",
    status: "connected",
    lastSyncedAt: "for 3 min siden",
    connectedAt: "12. mars 2026",
    connectedBy: "Ida Holm",
    salesToday: "kr 84 320",
    transactionsToday: 412,
  },
  {
    id: "pa_b8d2",
    vendor: "lightspeed_k",
    label: "Strøm Aker Brygge — K-Series",
    currency: "NOK",
    status: "syncing",
    lastSyncedAt: "synkroniserer nå",
    connectedAt: "2. mai 2026",
    connectedBy: "Henrik Dahl",
    salesToday: "kr 41 980",
    transactionsToday: 287,
  },
];

function VendorLogo({ vendor, size = 36 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 10,
      background: vendor.brand, color: "var(--background)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--font-heading)", fontSize: size * 0.5,
      fontWeight: 500, flexShrink: 0,
    }}>
      {vendor.logoLetter}
    </div>
  );
}

function AccountCard({ account, onDisconnect, onSync }) {
  const vendor = POS_VENDORS.find(v => v.id === account.vendor);
  const statusMap = {
    connected: { cls: "pill-success", label: "Tilkoblet" },
    syncing:   { cls: "pill-info",    label: "Synkroniserer" },
    error:     { cls: "pill-error",   label: "Feil" },
    disconnected: { cls: "", label: "Frakoblet" },
  };
  const s = statusMap[account.status] || statusMap.connected;
  return (
    <div style={{
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: 14,
      padding: 22,
      display: "grid",
      gridTemplateColumns: "auto 1fr auto",
      gap: 20,
      alignItems: "flex-start",
    }}>
      <VendorLogo vendor={vendor} size={48} />

      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 17, fontWeight: 500 }}>{account.label}</span>
          <span className={`pill ${s.cls}`}>
            {account.status === "syncing"
              ? <span className="dot pulse" style={{ background: "var(--info)" }}></span>
              : <span className="dot"></span>}
            {s.label}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 12.5, color: "var(--foreground-soft)" }}>
          <span className="mono">{account.currency}</span>
          <span>·</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{Icons.Refresh}Synket {account.lastSyncedAt}</span>
          <span>·</span>
          <span>Koblet til av {account.connectedBy}</span>
        </div>

        {/* Mini metrics row */}
        <div style={{ display: "flex", gap: 28, marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <Metric label="Salg i dag" value={account.salesToday} mono />
          <Metric label="Transaksjoner" value={account.transactionsToday} mono />
          <Metric label="Timer kalibrert" value="156 / 168" sub="siste 7d" mono />
          <Metric label="Tilkoblet siden" value={account.connectedAt} />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button className="btn btn-ghost btn-sm">{Icons.Refresh}<span>Synk nå</span></button>
        <button className="btn btn-ghost" style={{ width: 32, height: 32, padding: 0, justifyContent: "center", borderRadius: 8 }}>{Icons.More}</button>
      </div>
    </div>
  );
}

function Metric({ label, value, sub, mono }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--foreground-faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div className={mono ? "mono" : ""} style={{ fontSize: 15, marginTop: 4, fontWeight: 500 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--foreground-faint)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function ConnectDrawer({ open, onClose, onConnect }) {
  const [selected, setSelected] = useState("lightspeed_k");
  const [step, setStep] = useState("pick"); // pick | connecting | error

  if (!open) return null;

  const tryConnect = () => {
    setStep("connecting");
    setTimeout(() => {
      onConnect(selected);
      setStep("pick");
    }, 1800);
  };

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 40 }}>
      <div onClick={onClose} style={{
        position: "absolute", inset: 0,
        background: "color-mix(in oklch, var(--foreground) 25%, transparent)",
        animation: "fade-in 180ms ease",
      }}></div>
      <div style={{
        position: "absolute", top: 0, right: 0, bottom: 0,
        width: 520,
        background: "var(--card)",
        borderLeft: "1px solid var(--border)",
        animation: "slide-in-right 240ms cubic-bezier(0.16, 1, 0.3, 1)",
        display: "flex", flexDirection: "column",
        boxShadow: "-24px 0 64px -16px oklch(0.20 0.04 60 / 0.15)",
      }}>
        <div style={{ padding: "22px 28px 18px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span className="pill pill-primary">Compose · admin · chat-bekreftet</span>
            <button onClick={onClose} className="btn btn-ghost" style={{ width: 32, height: 32, padding: 0, justifyContent: "center", borderRadius: 8 }}>{Icons.X}</button>
          </div>
          <h3 className="serif" style={{ fontSize: 28, margin: 0, lineHeight: 1.08, letterSpacing: "-0.01em" }}>Koble til POS</h3>
          <p style={{ fontSize: 13.5, color: "var(--foreground-soft)", marginTop: 6, marginBottom: 0 }}>
            Velg leverandør. OAuth åpnes i nytt vindu — du blir sendt tilbake hit ved fullført pålogging.
          </p>
        </div>

        <div className="scroll" style={{ flex: 1, overflowY: "auto", padding: "20px 28px 24px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {POS_VENDORS.map((v) => (
              <label key={v.id} style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "14px 16px",
                border: selected === v.id ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                background: selected === v.id ? "var(--primary-soft)" : "var(--card)",
                borderRadius: 12,
                cursor: v.available ? "pointer" : "not-allowed",
                opacity: v.available ? 1 : 0.55,
              }}>
                <input
                  type="radio" name="vendor"
                  checked={selected === v.id}
                  onChange={() => v.available && setSelected(v.id)}
                  disabled={!v.available}
                  style={{ accentColor: "var(--primary)" }}
                />
                <VendorLogo vendor={v} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 500 }}>{v.name}</span>
                    <span className="pill" style={{ height: 18, fontSize: 10.5, background: v.available ? "var(--success-soft)" : "var(--muted)", color: v.available ? "var(--success)" : "var(--foreground-faint)" }}>
                      {v.badge}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--foreground-faint)", marginTop: 2 }}>{v.desc}</div>
                </div>
                {!v.available && <span style={{ fontSize: 11, color: "var(--foreground-faint)" }}>kommer</span>}
              </label>
            ))}
          </div>

          {/* Remediation card for Lightspeed */}
          <div style={{
            marginTop: 24, padding: "16px 18px",
            background: "var(--background-soft)",
            border: "1px solid var(--border)", borderRadius: 12,
            fontSize: 12.5, color: "var(--foreground-soft)", lineHeight: 1.55,
          }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ color: "var(--primary)", flexShrink: 0, marginTop: 2 }}>{Icons.AlertTri}</span>
              <div>
                <div style={{ fontSize: 13, color: "var(--foreground)", fontWeight: 500, marginBottom: 4 }}>Sjekk før du starter</div>
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  <li>K-Series API er aktivert i Lightspeed Backoffice</li>
                  <li>Du har owner- eller manager-rolle i Lightspeed-kontoen</li>
                  <li>Riktig butikk er valgt (om du har flere lokasjoner)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div style={{
          padding: "16px 28px 20px", borderTop: "1px solid var(--border)",
          background: "var(--background-soft)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{ fontSize: 11.5, color: "var(--foreground-faint)", flex: 1, lineHeight: 1.45 }}>
            OAuth-flyt: cloud.lightspeedapp.com → tilbake til /dashboard/pos-accounts
          </div>
          <button onClick={onClose} className="btn btn-ghost">Avbryt</button>
          <button onClick={tryConnect} className="btn btn-accent" disabled={step === "connecting"}>
            {step === "connecting"
              ? <><span className="dot pulse" style={{ width: 8, height: 8, background: "var(--background)", borderRadius: 999, display: "inline-block" }}></span><span>Åpner…</span></>
              : <>{Icons.Link}<span>Fortsett til Lightspeed</span></>}
          </button>
        </div>
      </div>
    </div>
  );
}

function PosEmptyState({ onConnect }) {
  return (
    <div style={{
      position: "relative",
      padding: "80px 40px",
      borderRadius: 20,
      background: "var(--card)",
      border: "1px solid var(--border)",
      overflow: "hidden",
      textAlign: "center",
    }}>
      {/* Orb flourish */}
      <div style={{
        position: "absolute", top: -120, left: "50%", transform: "translateX(-50%)",
        width: 520, height: 280,
        background: "radial-gradient(closest-side, color-mix(in oklch, var(--primary) 35%, transparent), transparent 70%)",
        filter: "blur(8px)",
        pointerEvents: "none",
      }}></div>

      <div style={{ position: "relative", maxWidth: 480, margin: "0 auto" }}>
        <div style={{
          width: 72, height: 72, borderRadius: 18,
          background: "var(--primary)", color: "var(--primary-fg)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-heading)", fontSize: 36,
          marginBottom: 24,
          boxShadow: "0 16px 32px -8px color-mix(in oklch, var(--primary) 40%, transparent)",
        }}>L</div>
        <h2 className="serif" style={{ fontSize: 36, margin: 0, lineHeight: 1.1, letterSpacing: "-0.02em" }}>Koble på kassasystemet</h2>
        <p style={{ fontSize: 15, color: "var(--foreground-soft)", marginTop: 14, lineHeight: 1.55 }}>
          Få ekte salgstall inn i Smartout. Botsson kalibrerer scheduler-prognoser automatisk når dataen flyter.
        </p>
        <div style={{ marginTop: 28, display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={onConnect} className="btn btn-accent btn-lg">{Icons.Link}<span>Koble til Lightspeed</span></button>
          <button className="btn btn-ghost btn-lg">{Icons.Doc}<span>Les veiledningen</span></button>
        </div>
        <div style={{ fontSize: 12, color: "var(--foreground-faint)", marginTop: 18 }}>
          Krever Lightspeed-konto med K-Series API-tilgang.
        </div>
      </div>
    </div>
  );
}

function PosAccountsPage() {
  const [accounts, setAccounts] = useState(POS_ACCOUNTS_DEFAULT);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pulseId, setPulseId] = useState(null);

  const isEmpty = accounts.length === 0;

  const handleConnect = (vendorId) => {
    setDrawerOpen(false);
    const id = "pa_" + Math.random().toString(36).slice(2, 6);
    const newAcc = {
      id, vendor: vendorId,
      label: "Ny lokasjon — K-Series",
      currency: "NOK",
      status: "syncing",
      lastSyncedAt: "starter første synk",
      connectedAt: "i dag",
      connectedBy: "Ida Holm",
      salesToday: "—",
      transactionsToday: "—",
    };
    setAccounts((prev) => [...prev, newAcc]);
    setPulseId(id);
    setTimeout(() => {
      setAccounts((prev) => prev.map(a => a.id === id ? { ...a, status: "connected", lastSyncedAt: "akkurat nå", salesToday: "kr 0", transactionsToday: 0 } : a));
      setTimeout(() => setPulseId(null), 1200);
    }, 2200);
  };

  return (
    <div style={{ position: "relative", height: "100%", overflow: "hidden", background: "var(--background)" }}>
      <div className="orb-bg"></div>

      <div style={{ display: "flex", height: "100%", position: "relative", zIndex: 1 }}>
        <Sidebar active="pos" />

        <main className="scroll" style={{ flex: 1, overflowY: "auto", position: "relative" }}>
          <Topbar crumbs={["Dashboard", "Integrasjoner", "POS"]} />

          <div style={{ padding: "32px 40px 120px", maxWidth: 1100, margin: "0 auto" }}>
            {/* Page header */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 32, marginBottom: 32 }}>
              <div style={{ flex: 1 }}>
                <div className="pill pill-primary" style={{ marginBottom: 12 }}>
                  <span className="dot"></span>ADR-0305 · admin / owner
                </div>
                <h1 className="serif" style={{ fontSize: 56, margin: 0, lineHeight: 1.0, letterSpacing: "-0.025em" }}>POS-integrasjoner</h1>
                <p style={{ fontSize: 15.5, color: "var(--foreground-soft)", marginTop: 12, marginBottom: 0, maxWidth: 580, lineHeight: 1.55 }}>
                  Koble kassasystemet til Smartout for automatisk salgsdata og scheduler-kalibrering.
                </p>
              </div>
              {!isEmpty && (
                <button onClick={() => setDrawerOpen(true)} className="btn btn-accent btn-lg">
                  {Icons.Plus}<span>Koble til ny konto</span>
                </button>
              )}
            </div>

            {isEmpty ? (
              <PosEmptyState onConnect={() => setDrawerOpen(true)} />
            ) : (
              <>
                {/* Aggregate strip */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
                  <KpiCompact label="Tilkoblet" value={accounts.filter(a => a.status === "connected").length} sub={`av ${accounts.length} kontoer`} />
                  <KpiCompact label="Salg i dag" value="kr 126 300" sub="alle lokasjoner" mono />
                  <KpiCompact label="Synk-feil · 7d" value="0" sub="alt går bra" success />
                  <KpiCompact label="Siste synk" value="3 min" sub="aktiv polling" />
                </div>

                {/* Account list */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {accounts.map((a) => (
                    <div key={a.id} style={{ position: "relative" }}>
                      <AccountCard account={a} />
                      {pulseId === a.id && (
                        <div style={{
                          position: "absolute", inset: 0, borderRadius: 14, pointerEvents: "none",
                          boxShadow: "0 0 0 2px var(--success), 0 0 40px 8px color-mix(in oklch, var(--success) 30%, transparent)",
                          animation: "pulse-glow 1.6s ease-in-out 2",
                        }}></div>
                      )}
                    </div>
                  ))}
                </div>

                {/* What data flows in */}
                <div style={{
                  marginTop: 32,
                  padding: 24,
                  borderRadius: 14,
                  background: "var(--background-soft)",
                  border: "1px solid var(--border)",
                  display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 32,
                }}>
                  <div>
                    <div className="pill" style={{ marginBottom: 12 }}><span className="dot" style={{ background: "var(--primary)" }}></span>Hva flyter inn</div>
                    <h3 className="serif" style={{ fontSize: 22, margin: 0, lineHeight: 1.2, letterSpacing: "-0.01em" }}>Salgstotaler per time — ikke individuelle transaksjoner.</h3>
                    <p style={{ fontSize: 13.5, color: "var(--foreground-soft)", marginTop: 12, marginBottom: 0, lineHeight: 1.6 }}>
                      Smartout leser aggregert salgsdata fra Lightspeed for å kalibrere prognoser i scheduler. Ingen personopplysninger fra kunder, ingen kortdetaljer.
                    </p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <FlowRow icon={Icons.Check} label="Salg per time" sub="for vakt-prognoser" />
                    <FlowRow icon={Icons.Check} label="Antall transaksjoner" sub="for bemanningstetthet" />
                    <FlowRow icon={Icons.Check} label="Åpningstider" sub="kalibrerer fra POS-aktivitet" />
                    <FlowRow icon={Icons.X} label="Individuelle kjøp" sub="aldri" muted />
                  </div>
                </div>
              </>
            )}
          </div>

          <ConnectDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onConnect={handleConnect} />
        </main>
      </div>
    </div>
  );
}

function KpiCompact({ label, value, sub, mono, success }) {
  return (
    <div style={{
      padding: "18px 20px",
      borderRadius: 14,
      background: "var(--card)",
      border: "1px solid var(--border)",
    }}>
      <div style={{ fontSize: 11, color: "var(--foreground-faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div className={mono ? "mono" : "serif"} style={{ fontSize: mono ? 24 : 36, lineHeight: 1, marginTop: 10, letterSpacing: "-0.01em", color: success ? "var(--success)" : "var(--foreground)" }}>{value}</div>
      <div style={{ fontSize: 11.5, color: "var(--foreground-faint)", marginTop: 8 }}>{sub}</div>
    </div>
  );
}

function FlowRow({ icon, label, sub, muted }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
      <span style={{
        width: 22, height: 22, borderRadius: 999,
        background: muted ? "var(--muted)" : "var(--success-soft)",
        color: muted ? "var(--foreground-faint)" : "var(--success)",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>{icon}</span>
      <span style={{ fontWeight: 500, color: muted ? "var(--foreground-faint)" : "var(--foreground)" }}>{label}</span>
      <span style={{ marginLeft: "auto", color: "var(--foreground-faint)", fontSize: 12 }}>{sub}</span>
    </div>
  );
}

Object.assign(window, { PosAccountsPage });
