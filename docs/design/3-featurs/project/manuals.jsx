/* global React, Icon, Icons, Avatar, Sidebar, Topbar */
// Onboarding manual — /docs/manuals/world-best-wfm/

const { useState } = React;

const MANUAL_TREE = [
  { id: "readme",      file: "README.md",                       title: "Veiledning · indeks", role: "Alle", minutes: 2 },
  { id: "pos",         file: "01-pos-integration-admin.md",     title: "POS-integrasjon", role: "Owner / Admin", minutes: 6 },
  { id: "mp-manager",  file: "02-marketplace-manager.md",       title: "Vaktbørs — manager", role: "Manager", minutes: 8 },
  { id: "mp-employee", file: "03-marketplace-employee.md",      title: "Vaktbørs — ansatt", role: "Ansatt", minutes: 5 },
  { id: "sched-web",   file: "04-scheduler-manager-compose.md", title: "Scheduler — foreslå plan (web)", role: "Manager", minutes: 7 },
  { id: "sched-mob",   file: "05-scheduler-manager-approve.md", title: "Scheduler — godkjenn (mobil)", role: "Manager", minutes: 4 },
];

const MANUAL_CONTENT = {
  pos: {
    audience: "owner / admin",
    prerequisites: "Workspace satt opp. Lightspeed-konto med K-Series API aktivert.",
    last_updated: "2026-05-14",
    body: (
      <div className="md">
        <div style={{ fontSize: 12, color: "var(--foreground-faint)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>
          Kapittel 01 · Owner / Admin · 6 min
        </div>
        <h1>POS-integrasjon for owner og admin</h1>
        <p style={{ fontSize: 17, color: "var(--foreground-soft)", maxWidth: "60ch", marginBottom: 32 }}>
          Koble Lightspeed K-Series til Smartout. Når salgsdataene flyter, kalibreres scheduler-prognosene automatisk — du slipper å gjette på bemanningstetthet.
        </p>

        <h2>Hva denne funksjonen gjør</h2>
        <p>
          Smartout leser aggregerte salgstall per time fra Lightspeed. Botsson bruker dette til å forutsi når dere trenger flere ansatte — og når dere kan trygt redusere.
        </p>

        <h2>Når du bruker den</h2>
        <ul>
          <li>Ved oppsett av nytt workspace.</li>
          <li>Når dere åpner ny lokasjon.</li>
          <li>Når dere bytter kassasystem.</li>
        </ul>

        <h2>Slik kobler du til</h2>
        <ol>
          <li>Gå til <code>/dashboard/pos-accounts/</code>.</li>
          <li>Klikk <strong>"+ Koble til Lightspeed"</strong>.</li>
          <li>Bekreft i Botsson-chat — Botsson åpner OAuth-vinduet til Lightspeed.</li>
          <li>Logg inn med Lightspeed-konto · velg butikk.</li>
          <li>Du sendes tilbake til Smartout. Kortet får grønn pulse — første synk starter automatisk.</li>
        </ol>

        <div className="callout">
          <strong>Hvis OAuth feiler:</strong> Sjekk at K-Series API er aktivert i Lightspeed Backoffice under <em>Settings → API Access</em>. Prøv igjen — kortet viser rød pulse med "Prøv på nytt"-knapp.
        </div>

        <h2>Vanlige spørsmål</h2>
        <h3>Hvilke data sendes til Smartout?</h3>
        <p>Kun salgstotaler per time og antall transaksjoner. Aldri individuelle kjøp, kortdetaljer eller kundenavn.</p>
        <h3>Når starter første synk?</h3>
        <p>Innen 5 minutter etter tilkobling. Etterpå synker Smartout hvert 15. minutt.</p>
        <h3>Hva om jeg vil koble fra?</h3>
        <p>Åpne 3-prikks-menyen på kortet → <em>Koble fra</em>. Botsson bekrefter i chat. Scheduler-prognoser går tilbake til standard heuristikk.</p>

        <h2>Hvis Botsson ber deg bekrefte</h2>
        <p>Alle endringer som påvirker pengestrøm eller datatilgang (per ADR-0078) bekreftes via chat. Du ser tilbudet, leser endringen, svarer "bekreft" eller "avbryt".</p>
      </div>
    ),
  },
};

function ManualsPage() {
  const [active, setActive] = useState("pos");
  const meta = MANUAL_CONTENT[active];

  return (
    <div style={{ position: "relative", height: "100%", overflow: "hidden", background: "var(--background)" }}>
      <div className="orb-bg" style={{ opacity: 0.6 }}></div>

      <div style={{ display: "flex", height: "100%", position: "relative", zIndex: 1 }}>
        <Sidebar active="docs" />

        <main className="scroll" style={{ flex: 1, overflowY: "auto", position: "relative" }}>
          <Topbar crumbs={["Veiledning", "World-Best-WFM"]} />

          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", minHeight: "calc(100% - 64px)" }}>
            {/* Doc nav */}
            <nav className="scroll" style={{
              borderRight: "1px solid var(--border)",
              padding: "32px 24px",
              background: "var(--background-soft)",
              overflowY: "auto",
            }}>
              <div style={{ fontSize: 11, color: "var(--foreground-faint)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
                Repo
              </div>
              <div className="mono" style={{ fontSize: 12, color: "var(--foreground-soft)", marginBottom: 20, wordBreak: "break-all" }}>
                docs/manuals/world-best-wfm/
              </div>

              <div style={{ fontSize: 11, color: "var(--foreground-faint)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
                Filer
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {MANUAL_TREE.map((m) => (
                  <button key={m.id} onClick={() => setActive(m.id)} style={{
                    display: "flex", alignItems: "flex-start", gap: 10,
                    padding: "10px 12px",
                    borderRadius: 8,
                    textAlign: "left",
                    background: active === m.id ? "var(--card)" : "transparent",
                    border: active === m.id ? "1px solid var(--border)" : "1px solid transparent",
                  }}>
                    <span style={{ color: active === m.id ? "var(--primary)" : "var(--foreground-faint)", marginTop: 2, flexShrink: 0 }}>
                      {m.id === "readme" ? Icons.Folder : Icons.Doc}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: active === m.id ? 500 : 400, color: active === m.id ? "var(--foreground)" : "var(--foreground-soft)" }}>
                        {m.title}
                      </div>
                      <div className="mono" style={{ fontSize: 10.5, color: "var(--foreground-faint)", marginTop: 2 }}>{m.file}</div>
                      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                        <span style={{ fontSize: 10.5, color: "var(--foreground-faint)" }}>{m.role}</span>
                        <span style={{ fontSize: 10.5, color: "var(--foreground-faint)" }}>·</span>
                        <span style={{ fontSize: 10.5, color: "var(--foreground-faint)" }}>{m.minutes} min</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div style={{
                marginTop: 24, padding: 14,
                borderRadius: 10, background: "var(--card)",
                border: "1px solid var(--border)",
                fontSize: 12, color: "var(--foreground-soft)", lineHeight: 1.55,
              }}>
                <div style={{ fontWeight: 500, color: "var(--foreground)", marginBottom: 4 }}>V1 omfang</div>
                Markdown i repo · NB-NO. EN-oversettelse + videoer = fase 2.
              </div>
            </nav>

            {/* Body */}
            <article style={{ padding: "48px 56px 96px", maxWidth: 820, margin: "0 auto", position: "relative" }}>
              {/* Frontmatter strip */}
              <div style={{
                display: "flex", gap: 18, padding: "10px 14px",
                background: "var(--background-soft)", border: "1px solid var(--border)", borderRadius: 10,
                marginBottom: 36, fontSize: 12, color: "var(--foreground-soft)",
                fontFamily: "var(--font-mono)",
              }}>
                <span><span style={{ color: "var(--foreground-faint)" }}>audience:</span> {meta?.audience}</span>
                <span><span style={{ color: "var(--foreground-faint)" }}>last_updated:</span> {meta?.last_updated}</span>
                <span style={{ marginLeft: "auto", color: "var(--foreground-faint)" }}>3 min lesetid</span>
              </div>

              {meta?.body}

              {/* Related */}
              <div style={{ marginTop: 56, paddingTop: 28, borderTop: "1px solid var(--border)" }}>
                <div style={{ fontSize: 11, color: "var(--foreground-faint)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Relatert</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <RelatedCard title="Vaktbørs — manager" sub="Tilby + godkjenn åpne vakter" minutes="8" />
                  <RelatedCard title="Scheduler — foreslå plan" sub="Generer plan + bekreft i chat" minutes="7" />
                </div>
              </div>
            </article>
          </div>
        </main>
      </div>
    </div>
  );
}

function RelatedCard({ title, sub, minutes }) {
  return (
    <a href="#" style={{
      display: "block", padding: 16,
      background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12,
      textDecoration: "none", color: "inherit",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "var(--primary)" }}>{Icons.Doc}</span>
        <span style={{ fontSize: 14, fontWeight: 500 }}>{title}</span>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--foreground-soft)", marginTop: 6 }}>{sub}</div>
      <div style={{ fontSize: 11, color: "var(--foreground-faint)", marginTop: 10 }}>{minutes} min lesetid →</div>
    </a>
  );
}

Object.assign(window, { ManualsPage });
