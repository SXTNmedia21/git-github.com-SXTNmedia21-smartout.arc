/* Mock test scenario for the Smartout remote control.
 * A "run" is a scripted scenario executed against a staging environment —
 * each step is one user action + its observable effects (events). */
window.REMOTE_DATA = {
  scenario: {
    id: "scn_day_reconciliation_happy_path",
    title: "Dag-oppgjør · happy path",
    target: "staging.smartout.no · workspace: Café Skuta",
    author: "Marcus Lien",
    duration_ms: 184_000, // nominal (at 1x)
  },
  steps: [
    {
      id: "s01",
      label: "Åpne dashboard",
      desc: "Naviger til /dashboard som admin",
      duration_ms: 6_200,
      events: [
        { t: 210,  kind: "nav",    text: "GET /dashboard" },
        { t: 840,  kind: "render", text: "DashboardShell mounted (112ms)" },
        { t: 1480, kind: "net",    text: "GraphQL · currentWorkspace → 200 in 340ms" },
        { t: 2310, kind: "render", text: "KPI strip painted" },
        { t: 5900, kind: "ok",     text: "Dashboard interactive" },
      ],
    },
    {
      id: "s02",
      label: "Åpne uke 17 i avstemming",
      desc: "Klikk 'Avstemming' i sidebar",
      duration_ms: 4_100,
      events: [
        { t: 180,  kind: "click",  text: "nav-item[href='/reconciliation']" },
        { t: 720,  kind: "nav",    text: "GET /dashboard/reconciliation" },
        { t: 1530, kind: "net",    text: "listReconciliations(week=17) → 7 rows" },
        { t: 3800, kind: "ok",     text: "Liste lastet" },
      ],
    },
    {
      id: "s03",
      label: "Velg fredag 18. april",
      desc: "Åpne pending dag-oppgjør",
      duration_ms: 5_800,
      events: [
        { t: 160,  kind: "click",  text: "row[date='2026-04-18']" },
        { t: 760,  kind: "nav",    text: "GET /reconciliation/2026-04-18" },
        { t: 1840, kind: "net",    text: "daily_reconciliation → payload 14.2 KB" },
        { t: 3010, kind: "render", text: "Inntekt-tab aktiv" },
        { t: 5500, kind: "ok",     text: "Detaljer synlig" },
      ],
    },
    {
      id: "s04",
      label: "Verifiser omsetning",
      desc: "Sjekk 94 200 kr mot kasseoppgjør",
      duration_ms: 3_600,
      events: [
        { t: 120,  kind: "assert", text: "revenueTotal === 94 200 kr · OK" },
        { t: 480,  kind: "assert", text: "pos.total === revenueTotal · OK" },
        { t: 1900, kind: "ok",     text: "2/2 assertions passed" },
      ],
    },
    {
      id: "s05",
      label: "Løs avvik · skiftleder",
      desc: "Åpne avvik-tab, resolve sev=critical",
      duration_ms: 12_400,
      events: [
        { t: 220,   kind: "click",  text: "tab[name='Avvik']" },
        { t: 1900,  kind: "render", text: "DeviationList · 3 items" },
        { t: 3100,  kind: "click",  text: "dev-item[id='dev_42']" },
        { t: 5800,  kind: "input",  text: "resolution-note = 'Iselin dekket…'" },
        { t: 8400,  kind: "click",  text: "btn[action='resolve']" },
        { t: 9600,  kind: "net",    text: "mutateDeviation → 200" },
        { t: 11800, kind: "ok",     text: "Avvik lukket" },
      ],
    },
    {
      id: "s06",
      label: "Godkjenn vakter",
      desc: "Bulk-approve 4 innsendte vakter",
      duration_ms: 7_800,
      events: [
        { t: 160,  kind: "click",  text: "tab[name='Vakter']" },
        { t: 1400, kind: "click",  text: "select-all" },
        { t: 2100, kind: "click",  text: "btn[action='bulk-approve']" },
        { t: 3800, kind: "net",    text: "approveShifts(ids=[…4]) → 200" },
        { t: 6900, kind: "ok",     text: "4 vakter godkjent" },
      ],
    },
    {
      id: "s07",
      label: "Lås dagen",
      desc: "Trigger reconciliation_lock mutation",
      duration_ms: 5_200,
      events: [
        { t: 200,  kind: "click",  text: "btn[action='lock-day']" },
        { t: 1100, kind: "render", text: "ConfirmDialog open" },
        { t: 2400, kind: "click",  text: "btn[action='confirm-lock']" },
        { t: 3300, kind: "net",    text: "lockReconciliation(date) → 200" },
        { t: 4900, kind: "ok",     text: "Dag låst · immutable" },
      ],
    },
    {
      id: "s08",
      label: "Verifiser låst state",
      desc: "Sjekk at UI viser 'Låst' og knapper er disabled",
      duration_ms: 2_900,
      events: [
        { t: 140,  kind: "assert", text: "status-pill.text === 'Låst'" },
        { t: 360,  kind: "assert", text: "btn[lock-day].disabled === true" },
        { t: 1800, kind: "ok",     text: "3/3 assertions passed" },
      ],
    },
  ],
};
