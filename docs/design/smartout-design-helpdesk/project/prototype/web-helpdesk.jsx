// Web — Helpdesk Ticket Conversation view
// Full Komm surface with query_thread behavior. 1280×860 design frame.

const WebHelpdesk = () => {
  return (
    <div style={{
      width: 1280, height: 860, display: 'flex',
      fontFamily: 'var(--font-body)', color: 'var(--foreground)',
      background: 'var(--background)', overflow: 'hidden',
    }}>
      {/* Sidebar */}
      <div style={{
        width: 220, background: 'var(--sidebar)',
        borderRight: '1px solid var(--border)',
        padding: '16px 14px',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px 18px 8px' }}>
          <img src="smartout-icon.png" style={{ width: 24, height: 24, borderRadius: 6 }} />
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, letterSpacing: '-0.01em' }}>Smartout</div>
        </div>
        {[
          ['home','Hjem', false],
          ['calendar','Vakter', false],
          ['users','Ansatte', false],
          ['message','Kanaler', true],
          ['book','Opplæring', false],
          ['shield','HMS', false],
          ['settings','Innstillinger', false],
        ].map(([icn, lbl, act]) => (
          <div key={lbl} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 10px', fontSize: 13.5,
            background: act ? 'var(--sidebar-accent)' : 'transparent',
            borderRadius: 8,
            color: act ? 'var(--foreground)' : 'var(--muted-fg)',
            fontWeight: act ? 500 : 400,
            marginBottom: 2,
          }}>
            <Icon name={icn} size={16} />
            {lbl}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px' }}>
          <Avatar name="Sofia Berg" size={28} />
          <div style={{ fontSize: 13 }}>
            <div style={{ fontWeight: 500 }}>Sofia Berg</div>
            <div style={{ fontSize: 11, color: 'var(--muted-fg)' }}>Daglig leder</div>
          </div>
        </div>
      </div>

      {/* Channel list */}
      <div style={{
        width: 280, background: 'var(--card)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>Kanaler</div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 10px',
            background: 'var(--muted)', borderRadius: 8,
            fontSize: 13, color: 'var(--muted-fg)',
          }}>
            <Icon name="search" size={13} /> Søk
          </div>
        </div>

        {/* Min kø section */}
        <div style={{ padding: '14px 10px 6px' }}>
          <div style={{
            padding: '0 10px 8px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 10,
              textTransform: 'uppercase', letterSpacing: '0.12em',
              color: 'var(--muted-fg)', fontWeight: 500,
            }}>Min kø</div>
            <Pill tone="muted">3</Pill>
          </div>

          {[
            { name: 'Linn Andersen', summary: 'Kan jeg jobbe i romjula?', time: '14 min', status: 'waiting', active: true, desk: '#lonn' },
            { name: 'Kari Holm', summary: 'Feil i timebank', time: '1 t', status: 'active', desk: '#lonn' },
            { name: 'Ola Hansen', summary: 'Hvordan registrere tillegg', time: '3 t', status: 'active', desk: '#lonn' },
          ].map((t, i) => (
            <div key={i} style={{
              display: 'flex', gap: 10, alignItems: 'flex-start',
              padding: '10px 10px',
              background: t.active ? 'var(--sidebar-accent)' : 'transparent',
              borderRadius: 8, marginBottom: 2,
              position: 'relative',
            }}>
              {t.status === 'waiting' && <Orb size={10} status="waiting" pulse style={{ position: 'absolute', top: 14, right: 10 }} />}
              {t.status === 'waiting' && <div style={{ position: 'absolute', top: 14, right: 10 }}><Orb size={10} status="waiting" pulse /></div>}
              <Avatar name={t.name} size={28} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted-fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.summary}</div>
                <div style={{ fontSize: 10.5, color: 'var(--muted-fg)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>{t.desk} · {t.time}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Channels */}
        <div style={{ padding: '10px 10px', borderTop: '1px solid var(--border)', marginTop: 4 }}>
          <div style={{
            padding: '8px 10px 6px',
            fontFamily: 'var(--font-mono)', fontSize: 10,
            textTransform: 'uppercase', letterSpacing: '0.12em',
            color: 'var(--muted-fg)', fontWeight: 500,
          }}>Kanaler</div>
          {[
            ['#allmenn', false, false],
            ['#kjokken', true, false],
            ['#hms', true, false],
            ['#lonn', true, true],
            ['#bar', false, false],
          ].map(([c, desk, active]) => (
            <div key={c} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 10px', fontSize: 13.5,
              background: active ? 'var(--muted)' : 'transparent',
              borderRadius: 6,
              color: active ? 'var(--foreground)' : 'var(--muted-fg)',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', opacity: 0.6 }}>{c}</span>
              {desk && <Icon name="lifebuoy" size={11} style={{ marginLeft: 'auto', color: 'var(--brand-orange)', opacity: 0.85 }} />}
            </div>
          ))}
        </div>
      </div>

      {/* Ticket conversation */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <div style={{
          padding: '18px 28px',
          borderBottom: '1px solid var(--border)',
          background: 'oklch(0.99 0.004 60 / 0.7)',
          backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', gap: 18,
        }}>
          <button style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            width: 36, height: 36, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--muted-fg)',
          }}>
            <Icon name="chevron-left" size={18} />
          </button>
          <Orb size={52} status="waiting" pulse />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <StatusLabel status="waiting" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted-fg)' }}>·</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted-fg)' }}>#lønn · åpnet 14 min siden</span>
            </div>
            <div style={{
              fontFamily: 'var(--font-heading)', fontSize: 24,
              letterSpacing: '-0.01em', lineHeight: 1.15,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              Kan jeg jobbe i romjula?
            </div>
            <div style={{
              marginTop: 4, fontSize: 13, color: 'var(--muted-fg)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Avatar name="Linn Andersen" size={18} />
              <span>Linn</span>
              <Icon name="arrow-right" size={12} style={{ opacity: 0.5 }} />
              <Avatar name="Sofia Berg" size={18} />
              <span>Sofia (deg)</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="outline" size="md" icon="users">Tildel på nytt</Btn>
            <Btn variant="default" size="md" icon="check">Løs sak</Btn>
          </div>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1, overflowY: 'auto',
          padding: '28px 28px 12px 28px',
          display: 'flex', flexDirection: 'column', gap: 22,
          background: 'var(--background)',
        }}>
          {/* System: opened */}
          <div style={{
            alignSelf: 'center',
            padding: '6px 14px',
            background: 'var(--muted)',
            border: '1px solid var(--border)',
            borderRadius: 9999,
            fontSize: 11, fontFamily: 'var(--font-mono)',
            color: 'var(--muted-fg)',
            letterSpacing: '0.04em',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Icon name="sparkles" size={11} />
            Botsson åpnet privat sak for Linn · 14:09
          </div>

          {/* Linn's message */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', maxWidth: 640 }}>
            <Avatar name="Linn Andersen" size={36} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Linn Andersen</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted-fg)' }}>14:09</span>
              </div>
              <div style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '14px 14px 14px 4px',
                padding: '12px 16px',
                fontSize: 14.5, lineHeight: 1.55,
              }}>
                Hei Sofia, har fått spørsmål om jeg kan ta ekstra vakter mellom jul og nyttår. Har vi egne regler for romjula, eller er det bare vanlig overtid?
              </div>
            </div>
          </div>

          {/* Sofia's typing / composer preview */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', maxWidth: 640, flexDirection: 'row-reverse', alignSelf: 'flex-end' }}>
            <Avatar name="Sofia Berg" size={36} />
            <div style={{ flex: 1 }}>
              <div style={{
                display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4,
                justifyContent: 'flex-end',
              }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted-fg)' }}>14:18</span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Sofia (deg)</span>
              </div>
              <div style={{
                background: 'var(--brand-orange)',
                color: '#fff',
                borderRadius: '14px 14px 4px 14px',
                padding: '12px 16px',
                fontSize: 14.5, lineHeight: 1.55,
              }}>
                Hei Linn — 24., 25. og 26. desember er helligdager, så der er tillegget 133%. Resten av romjula teller som vanlig. Si fra innen fredag hvis du ønsker ekstra vakter.
              </div>
            </div>
          </div>

          {/* Linn's reply */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', maxWidth: 640 }}>
            <Avatar name="Linn Andersen" size={36} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Linn Andersen</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted-fg)' }}>14:21</span>
              </div>
              <div style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '14px 14px 14px 4px',
                padding: '12px 16px',
                fontSize: 14.5, lineHeight: 1.55,
              }}>
                Perfekt, takk. Jeg tar 27.–29. hvis det er ledig.
              </div>
            </div>
          </div>
        </div>

        {/* Composer */}
        <div style={{
          padding: '14px 28px 20px',
          borderTop: '1px solid var(--border)',
          background: 'var(--background)',
        }}>
          <div style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: '12px 14px',
            display: 'flex', alignItems: 'flex-end', gap: 10,
          }}>
            <button style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted-fg)', padding: 4 }}>
              <Icon name="paperclip" size={18} />
            </button>
            <div style={{ flex: 1, minHeight: 22, fontSize: 14.5, color: 'var(--muted-fg)', paddingTop: 2 }}>
              Svar til Linn…
            </div>
            <button style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted-fg)', padding: 4 }}>
              <Icon name="mic" size={18} />
            </button>
            <button style={{
              border: 'none', background: 'var(--brand-orange)', color: '#fff',
              cursor: 'pointer', padding: '8px 10px', borderRadius: 10,
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 13, fontWeight: 600,
              boxShadow: '0 2px 12px rgba(249,115,22,0.25)',
            }}>
              <Icon name="send" size={14} /> Send
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted-fg)', marginTop: 8, fontFamily: 'var(--font-mono)' }}>
            Privat sak · kun Linn og du ser meldingene · løs saken når den er avklart
          </div>
        </div>
      </div>
    </div>
  );
};

window.WebHelpdesk = WebHelpdesk;
