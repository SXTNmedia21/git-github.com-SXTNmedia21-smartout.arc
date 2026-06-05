// Settings (general policies) + Supplement rules + Botsson chat + Tip pool

// ═══════════════════════════════════════════════════════════
// SCREEN 8: Payroll settings — general policies
// ═══════════════════════════════════════════════════════════
const PayrollSettings = () => (
  <div style={{ width: PAGE_W, height: PAGE_H, display: 'flex', background: 'var(--background)',
    fontFamily: 'var(--font-body)', color: 'var(--foreground)', overflow: 'hidden' }}>
    <SidebarNav active="lønn" />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <PageHeader
        crumbs={['Lønn', 'Innstillinger']}
        title="Innstillinger · lønn"
        subtitle="Defaults brukt av calc-engine. Per-ansatt overrides finnes på lønnsprofilen."
        actions={[<Btn key="r" variant="default" size="md" icon="check">Lagre endringer</Btn>]}
      />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Settings sub-nav */}
        <div style={{ width: 240, borderRight: '1px solid var(--border)', padding: '20px 14px',
          background: 'oklch(0.99 0.004 60 / 0.4)', overflowY: 'auto' }}>
          {[
            ['Periode', 'calendar', false],
            ['Tillegg-regler', 'sparkles', true],
            ['Lønnskoder', 'hash', false],
            ['A-melding', 'external', false],
            ['Skattekort', 'shield', false],
            ['Pensjon', 'wallet', false],
            ['Feriepenger', 'utensils-crossed', false],
            ['Tipspott', 'wine', false],
            ['Eksport-mål', 'arrow-up', false],
          ].map(([lbl, ic, on]) => (
            <div key={lbl} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', fontSize: 13, marginBottom: 2,
              background: on ? 'var(--card)' : 'transparent',
              border: on ? '1px solid var(--border)' : '1px solid transparent',
              borderRadius: 8, color: on ? 'var(--foreground)' : 'var(--muted-fg)',
              fontWeight: on ? 600 : 400 }}>
              <Icon name={ic} size={14} />
              {lbl}
            </div>
          ))}
        </div>

        {/* Settings body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
          <div style={{ maxWidth: 760 }}>
            <SectionCard title="Periode-konvensjon" subtitle="Når en periode starter og slutter">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Field label="Periode-type">
                  <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--muted)', borderRadius: 10 }}>
                    {['Måned', '14 dager'].map((t, i) => (
                      <div key={t} style={{
                        flex: 1, textAlign: 'center', padding: '8px', fontSize: 13, borderRadius: 7,
                        background: i === 0 ? 'var(--card)' : 'transparent', fontWeight: i === 0 ? 600 : 400,
                        boxShadow: i === 0 ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>{t}</div>
                    ))}
                  </div>
                </Field>
                <Field label="Lås-frist (default)" hint="Auto-låses kl 23:59">
                  <div style={{ padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10,
                    fontFamily: 'var(--font-mono)', fontSize: 14 }}>5. i måneden etter</div>
                </Field>
                <Field label="Utbetalingsdato" hint="Vises på lønnsslippen">
                  <div style={{ padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10,
                    fontFamily: 'var(--font-mono)', fontSize: 14 }}>15. i måneden etter</div>
                </Field>
                <Field label="Recalc-strategi">
                  <div style={{ padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10,
                    fontSize: 13.5 }}>Auto · ved endring i vakter eller regler</div>
                </Field>
              </div>
            </SectionCard>

            <SectionCard title="Defaults · timer og pauser" mt={20}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Field label="Standard ukestimer" hint="Definerer fulltidsstilling">
                  <div style={{ padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10,
                    fontFamily: 'var(--font-mono)', fontSize: 14 }}>37.5 t/uke</div>
                </Field>
                <Field label="OT-grense (default)" hint="Per måned · over telles som overtid">
                  <div style={{ padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10,
                    fontFamily: 'var(--font-mono)', fontSize: 14 }}>162.5 t/mnd</div>
                </Field>
                <Field label="Min. pause (8t-vakt)">
                  <div style={{ padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10,
                    fontFamily: 'var(--font-mono)', fontSize: 14 }}>30 min · betalt</div>
                </Field>
                <Field label="Når stempling mangler">
                  <div style={{ padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10,
                    fontSize: 13.5 }}>Bruk planlagt + advarsel</div>
                </Field>
              </div>
            </SectionCard>

            <SectionCard title="Bekreftelser ved lås" subtitle="Disse må håndteres før perioden låses" mt={20}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <PolicyToggle label="OT over avtalt grense" detail="Ansvarlig + ansatt må bekrefte" on />
                <PolicyToggle label="Vakt på rød dag" detail="Krever signert tillegg" on />
                <PolicyToggle label="Stempling mangler" detail="Vises som advarsel — ikke blokkerende" on warn />
                <PolicyToggle label="Pause < minimum" detail="Smartout legger til lønnet pause automatisk" on />
                <PolicyToggle label="Recalc endrer brutto > 200 kr" detail="Notify ansatt etter lås" on />
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const PolicyToggle = ({ label, detail, on, warn }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 14,
    padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10 }}>
    <Switch on={on} />
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 13.5, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--muted-fg)', marginTop: 1 }}>{detail}</div>
    </div>
    {warn && <Pill tone="brand">advarsel</Pill>}
  </div>
);

// ═══════════════════════════════════════════════════════════
// SCREEN 9: Supplement rules editor + tester
// ═══════════════════════════════════════════════════════════
const SupplementRules = () => (
  <div style={{ width: PAGE_W, height: PAGE_H, display: 'flex', background: 'var(--background)',
    fontFamily: 'var(--font-body)', color: 'var(--foreground)', overflow: 'hidden' }}>
    <SidebarNav active="lønn" />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <PageHeader
        crumbs={['Lønn', 'Innstillinger', 'Tillegg-regler']}
        title="Tillegg-regler"
        subtitle="Hvordan calc-engine deriverer kveld, helg, hellig og overtid."
        actions={[
          <Btn key="t" variant="outline" size="md" icon="play">Test mot april</Btn>,
          <Btn key="n" variant="default" size="md" icon="plus">Ny regel</Btn>,
        ]}
      />

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 380px', overflow: 'hidden' }}>
        {/* Rules list */}
        <div style={{ overflowY: 'auto', padding: '20px 24px 24px 32px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'var(--muted-fg)', fontWeight: 500, marginBottom: 12 }}>
            8 aktive regler · gjelder for hele organisasjonen
          </div>

          {[
            { code: 'SUPP_KVELD', label: 'Kveldstillegg', amount: '+25%', when: 'Hverdag 18:00 – 22:00', applies: 'Alle ansatte', last: '03.04', sel: true },
            { code: 'SUPP_NATT', label: 'Nattillegg', amount: '+45%', when: '22:00 – 06:00', applies: 'Alle' },
            { code: 'SUPP_HELG', label: 'Helgtillegg', amount: '+50%', when: 'Lørdag 13:00 – Søndag 23:59', applies: 'Alle' },
            { code: 'SUPP_HELLIG', label: 'Helligdagstillegg', amount: '+100%', when: 'Bevegelige helligdager (auto)', applies: 'Alle', warn: 'krever lederbekreftelse' },
            { code: 'SUPP_NYTTAR', label: 'Nyttårsaften etter 16:00', amount: '+100%', when: '31.12 16:00 – 01.01', applies: 'Alle' },
            { code: 'OT_DAG', label: 'Daglig overtid', amount: '+50%', when: '> 9t/dag', applies: 'Timebasert' },
            { code: 'OT_MND', label: 'Månedlig overtid', amount: '+50%', when: '> 162.5t/mnd', applies: 'Fastlønn' },
            { code: 'TIPS', label: 'Tipspott · ut', amount: 'Skattepliktig', when: 'Månedlig fordeling', applies: 'Sal + bar' },
          ].map((r) => (
            <RuleCard key={r.code} {...r} />
          ))}
        </div>

        {/* Rule tester */}
        <div style={{ borderLeft: '1px solid var(--border)', background: 'oklch(0.965 0.005 58 / 0.4)',
          padding: '20px 24px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Icon name="play" size={14} style={{ color: 'var(--brand-orange)' }} />
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: 'var(--muted-fg)', fontWeight: 500 }}>Regel-tester</div>
          </div>
          <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 16 }}>SUPP_KVELD</div>

          <Field label="Kjør mot vakt" hint="Velg en faktisk vakt for å se hva som skjer">
            <div style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10,
              background: 'var(--card)', fontSize: 12.5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Avatar name="Anna Kvist" size={20} />
                <span style={{ fontWeight: 500 }}>Anna · 09.04 17:00–22:00</span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted-fg)' }}>
                5.0 t · grunnlønn 230 kr/t
              </div>
            </div>
          </Field>

          <div style={{ marginTop: 18, padding: 14, background: 'oklch(0.18 0.03 50)',
            color: 'oklch(0.95 0.005 55)', borderRadius: 12, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            <div style={{ opacity: 0.55, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
              Trace · derivation
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Trace>match window: 18:00–22:00 → 4.0t</Trace>
              <Trace>before window: 17:00–18:00 → 1.0t (no supp)</Trace>
              <Trace>base: 4.0t × 230 = 920</Trace>
              <Trace tone="ok">supp: 920 × 0.25 = 230 ✓</Trace>
              <Trace>+ no overlap with SUPP_HELG</Trace>
              <Trace tone="ok">+ no overlap with SUPP_HELLIG</Trace>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', marginTop: 6, paddingTop: 8 }}>
                <Trace tone="result">total = 230 kr · added to derived line</Trace>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 18, fontSize: 12, color: 'var(--muted-fg)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--foreground)' }}>Testet mot:</strong> 89 vakter i april. Reglen treffer 47 vakter, gir 12 250 kr i tillegg totalt.
          </div>
        </div>
      </div>
    </div>
  </div>
);

const RuleCard = ({ code, label, amount, when, applies, warn, sel }) => (
  <div style={{ padding: '16px 18px', marginBottom: 10,
    background: 'var(--card)',
    border: sel ? '1.5px solid var(--brand-orange)' : '1px solid var(--border)',
    borderRadius: 12, display: 'grid', gridTemplateColumns: '160px 100px 1fr auto', gap: 18, alignItems: 'center' }}>
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted-fg)', marginBottom: 2 }}>{code}</div>
      <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
    </div>
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700,
      color: 'var(--brand-orange-dark)', letterSpacing: '-0.01em' }}>{amount}</div>
    <div>
      <div style={{ fontSize: 13 }}>{when}</div>
      <div style={{ fontSize: 11.5, color: 'var(--muted-fg)', marginTop: 2,
        display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>Gjelder: {applies}</span>
        {warn && (
          <>
            <span style={{ opacity: 0.4 }}>·</span>
            <span style={{ color: 'oklch(0.45 0.15 85)' }}>{warn}</span>
          </>
        )}
      </div>
    </div>
    <Switch on />
  </div>
);

const Trace = ({ children, tone }) => (
  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8,
    color: tone === 'ok' ? 'oklch(0.75 0.15 145)' :
           tone === 'result' ? 'oklch(0.85 0.18 40)' : 'oklch(0.95 0.005 55 / 0.85)' }}>
    <span style={{ opacity: 0.5 }}>{tone === 'result' ? '➜' : '·'}</span>
    <span>{children}</span>
  </div>
);

// ═══════════════════════════════════════════════════════════
// SCREEN 10: Botsson chat — payroll-driven nudges
// ═══════════════════════════════════════════════════════════
const BotsonChat = () => (
  <div style={{ width: PAGE_W, height: PAGE_H, display: 'flex', background: 'var(--background)',
    fontFamily: 'var(--font-body)', color: 'var(--foreground)', overflow: 'hidden' }}>
    <SidebarNav active="kanaler" />
    <div style={{ width: 280, background: 'var(--card)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>Kanaler</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
          background: 'var(--muted)', borderRadius: 8, fontSize: 13, color: 'var(--muted-fg)' }}>
          <Icon name="search" size={13} /> Søk
        </div>
      </div>
      <div style={{ padding: '14px 10px' }}>
        <div style={{ padding: '0 10px 8px', fontFamily: 'var(--font-mono)', fontSize: 10,
          textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--muted-fg)', fontWeight: 500 }}>
          Direkte
        </div>
        {[
          { name: 'Bot-Sson', desc: 'Lønn · siste tip 2 min', sel: true, bot: true },
          { name: 'Linn Andersen', desc: 'Perfekt, takk' },
          { name: 'Mikkel Dahl', desc: 'Sees lørdag' },
        ].map((c, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 10px',
            background: c.sel ? 'var(--sidebar-accent)' : 'transparent', borderRadius: 8, marginBottom: 2 }}>
            {c.bot ? (
              <div style={{ width: 32, height: 32, borderRadius: 16,
                background: 'linear-gradient(135deg, oklch(0.65 0.22 40), oklch(0.55 0.25 300))',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <Icon name="sparkles" size={15} />
              </div>
            ) : <Avatar name={c.name} size={32} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted-fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>

    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {/* Header */}
      <div style={{ padding: '16px 28px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 19,
          background: 'linear-gradient(135deg, oklch(0.65 0.22 40), oklch(0.55 0.25 300))',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
          <Icon name="sparkles" size={17} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            Bot-Sson
            <Pill tone="brand">Smartout AI</Pill>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted-fg)' }}>Lønnsassistent · ser kun det du ser</div>
        </div>
        <Btn variant="ghost" size="sm" icon="settings">Innstillinger</Btn>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px',
        display: 'flex', flexDirection: 'column', gap: 18 }}>
        <BotMsg time="11:42">
          God morgen Sofia 👋 Jeg har sett gjennom april og fant 3 ting du sannsynligvis vil håndtere før lås:
          <BotCard>
            <div style={{ marginBottom: 8, fontWeight: 600 }}>1 · Skjærtorsdag 17.04</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted-fg)', lineHeight: 1.5 }}>
              Mikkel og Ola jobbet rød dag. Hovedavtalen krever signert tillegg — begge har signert i appen.
              <br/>Du må bare bekrefte for at lås skal gå gjennom.
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
              <Btn variant="default" size="sm" icon="check">Bekreft begge</Btn>
              <Btn variant="outline" size="sm">Vis avvik</Btn>
            </div>
          </BotCard>

          <BotCard>
            <div style={{ marginBottom: 8, fontWeight: 600 }}>2 · Manuelt tillegg for Anna</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted-fg)', lineHeight: 1.5 }}>
              Du sa i sak <span style={{ color: 'var(--brand-orange-dark)' }}>#lønn-1042</span> at Anna skulle få 200 kr ekstra for Skjærtorsdag.
              Skal jeg legge inn linjen?
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
              <Btn variant="default" size="sm" icon="plus">Legg til 200 kr</Btn>
              <Btn variant="outline" size="sm">La være</Btn>
            </div>
          </BotCard>

          <BotCard>
            <div style={{ marginBottom: 8, fontWeight: 600 }}>3 · Tipspott april</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted-fg)', lineHeight: 1.5 }}>
              4 320 kr i tipspotten. Ingen er fordelt enda — vil du dele etter timer (default)?
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
              <Btn variant="default" size="sm" icon="arrow-right">Fordel etter timer</Btn>
              <Btn variant="outline" size="sm">Annet</Btn>
            </div>
          </BotCard>
        </BotMsg>

        <UserMsg time="11:46">Bekreft Skjærtorsdag for begge.</UserMsg>

        <BotMsg time="11:46">
          Gjort ✓ Begge avvik er nå bekreftet og signert med din konto.
          <div style={{ marginTop: 8, padding: '10px 12px', background: 'oklch(0.68 0.15 145 / 0.08)',
            border: '1px solid oklch(0.68 0.15 145 / 0.2)', borderRadius: 10, fontSize: 12.5,
            display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="check-circle" size={14} style={{ color: 'oklch(0.45 0.13 145)' }} />
            <span>2 avvik bekreftet · 5 igjen før perioden kan låses</span>
          </div>
        </BotMsg>
      </div>

      <div style={{ padding: '14px 28px 20px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center',
          padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 12,
          background: 'var(--card)' }}>
          <input style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontSize: 14, fontFamily: 'var(--font-body)', color: 'var(--foreground)' }}
            placeholder="Spør Bot-Sson om lønn …" />
          <Btn variant="default" size="sm" icon="send" style={{ height: 32 }}>Send</Btn>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {['Hvor mye OT i april?', 'Hvem er over 162t?', 'Lås april'].map(s => (
            <span key={s} style={{ padding: '5px 10px', borderRadius: 9999,
              background: 'var(--muted)', fontSize: 11.5, color: 'var(--muted-fg)',
              border: '1px solid var(--border)' }}>{s}</span>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const BotMsg = ({ children, time }) => (
  <div style={{ display: 'flex', gap: 12 }}>
    <div style={{ width: 32, height: 32, borderRadius: 16, flexShrink: 0,
      background: 'linear-gradient(135deg, oklch(0.65 0.22 40), oklch(0.55 0.25 300))',
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
      <Icon name="sparkles" size={14} />
    </div>
    <div style={{ flex: 1, maxWidth: 640 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>Bot-Sson</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted-fg)' }}>{time}</span>
      </div>
      <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>{children}</div>
    </div>
  </div>
);

const BotCard = ({ children }) => (
  <div style={{ marginTop: 10, padding: 14, background: 'var(--card)',
    border: '1px solid var(--border)', borderRadius: 12 }}>{children}</div>
);

const UserMsg = ({ children, time }) => (
  <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
    <div style={{ maxWidth: 480 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4, justifyContent: 'flex-end' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted-fg)' }}>{time}</span>
        <span style={{ fontWeight: 600, fontSize: 13 }}>Sofia</span>
      </div>
      <div style={{ padding: '10px 14px', background: 'var(--brand-orange)', color: '#fff',
        borderRadius: '14px 14px 4px 14px', fontSize: 13.5, lineHeight: 1.5 }}>{children}</div>
    </div>
    <Avatar name="Sofia Berg" size={32} />
  </div>
);

window.PayrollSettings = PayrollSettings;
window.SupplementRules = SupplementRules;
window.BotsonChat = BotsonChat;
window.PolicyToggle = PolicyToggle;
window.RuleCard = RuleCard;
window.Trace = Trace;
window.BotMsg = BotMsg;
window.BotCard = BotCard;
window.UserMsg = UserMsg;
