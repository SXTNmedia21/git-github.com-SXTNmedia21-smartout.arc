// =============================================================================
// Smartout Mobile — BOOKINGS & EVENT
// Reservations + events/selskaper for Bistro Nord. Same simple-list pattern as
// the HMS & Avvik / Kompetanse kartoteker (search + filter chips + rows + a
// detail sheet). Registers window.SO_M_PAGES.bookinger + window.MBookingDetail.
// =============================================================================
(function () {
  const { useState, useMemo } = React;
  const Ic = window.MIc;
  const D = window.SmartoutData;
  const cls = (...xs) => xs.filter(Boolean).join(' ');

  const ST = {
    bekreftet: ['m-pill-ok', 'Bekreftet'], venter: ['m-pill-warn', 'Venter'],
    foresporsel: ['m-pill-muted', 'Forespørsel'], planlegging: ['kt-st-arbeid', 'Planlegging'],
  };

  // ---------------- data (mock, Bistro Nord — today + upcoming) ----------------
  const BOOKINGS = [
    { id: 'b1', time: '18:00', name: 'Familien Berg', guests: 4, area: 'Bord 12 · Sal', status: 'bekreftet', contact: 'Anne Berg · 922 14 880', allergi: 'Ingen', note: 'Bursdag — ønsker dessert med lys.' },
    { id: 'b2', time: '19:00', name: 'Selskap Hansen', guests: 24, area: 'Vinterhagen', status: 'bekreftet', contact: 'Ola Hansen · 901 22 530', allergi: '2 glutenfri (meldt kjøkken)', note: 'Velkomstdrink ved ankomst. Egen meny klar.' },
    { id: 'b3', time: '19:30', name: 'Lie', guests: 2, area: 'Bord 5 · Sal', status: 'venter', contact: 'Mari Lie · 488 30 712', allergi: 'Nøtter', note: 'Ønsker rolig bord. Bekreftelse mangler.' },
    { id: 'b4', time: '20:00', name: 'Firmamiddag Nordkapp AS', guests: 12, area: 'Sal · langbord', status: 'bekreftet', contact: 'Resepsjon · 751 00 200', allergi: '1 vegetar', note: 'Faktura til firma. Avslutter ca. 22:30.' },
    { id: 'b5', time: '20:30', name: 'Walk-in hold', guests: 6, area: 'Bar', status: 'venter', contact: '—', allergi: '—', note: 'Holdes til 20:45, slippes deretter.' },
  ];

  const EVENTS = [
    { id: 'e1', date: '7. jun', name: 'Vinsmaking', guests: 18, area: 'Vinkjeller', status: 'bekreftet', kindLbl: 'Arrangement · åpen påmelding', contact: 'Bistro Nord', allergi: '—', note: '6 viner fra vinkartet. Sommelier Petter.' },
    { id: 'e2', date: '14. jun', name: 'Bryllup — Sandvik & Holt', guests: 60, area: 'Hele lokalet', status: 'planlegging', kindLbl: 'Selskap · privat', contact: 'Ingrid Sandvik · 970 41 220', allergi: '4 spesialkost (under avklaring)', note: 'Meny ikke fastsatt. Befaring 1. jun.' },
    { id: 'e3', date: '21. jun', name: 'Sommermeny-lansering', guests: 30, area: 'Vinterhagen', status: 'bekreftet', kindLbl: 'Internt · presse', contact: 'Maria A.', allergi: 'Buffet merket', note: 'Smaksmeny + presse. All stab på vakt.' },
    { id: 'e4', date: '5. des', name: 'Julebord — Nordkapp AS', guests: 40, area: 'Sal', status: 'foresporsel', kindLbl: 'Selskap · firma', contact: 'Resepsjon · 751 00 200', allergi: 'Ikke meldt ennå', note: 'Forespørsel mottatt — venter på bekreftelse.' },
  ];

  const todayGuests = BOOKINGS.reduce((n, b) => n + b.guests, 0);

  // ---------------- detail (bottom sheet) ----------------
  function BookingDetail({ item, isEvent, onClose }) {
    const { toast } = window.useM();
    const [sc, sl] = ST[item.status];
    return (
      <div className="m-sheet-scrim" onClick={onClose} style={{ zIndex: 47 }}>
        <div className="m-sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '90%' }}>
          <div className="m-sheet-grip" />
          <div className="m-sheet-h"><h3>{isEvent ? 'Arrangement' : 'Reservasjon'}</h3><button className="m-iconbtn" style={{ marginLeft: 'auto' }} onClick={onClose}><Ic n="x" s={20} /></button></div>
          <div className="m-sheet-body" style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
            <div className="m-bk-hero">
              <span className="m-bk-when">{isEvent ? item.date : item.time}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="m-bk-name">{item.name}</div>
                <div className="m-bk-kind">{isEvent ? item.kindLbl : item.area}</div>
              </div>
              <span className={cls('m-pill', sc)} style={{ height: 22, fontSize: 11, flex: '0 0 auto' }}><span className="m-pill-dot" /> {sl}</span>
            </div>
            <div className="m-av-meta" style={{ marginTop: 0 }}>
              <div className="m-av-meta-row"><Ic n="users" s={15} c="var(--muted)" /><span>Gjester</span><b>{item.guests}</b></div>
              <div className="m-av-meta-row"><Ic n="pin" s={15} c="var(--muted)" /><span>{isEvent ? 'Lokale' : 'Plass'}</span><b>{item.area}</b></div>
              <div className="m-av-meta-row"><Ic n="alert" s={15} c="var(--muted)" /><span>Allergi/kost</span><b>{item.allergi}</b></div>
              <div className="m-av-meta-row"><Ic n="phone" s={15} c="var(--muted)" /><span>Kontakt</span><b>{item.contact}</b></div>
            </div>
            <div className="m-av-bot">
              <span className="m-av-bot-ic"><Ic n="bot" s={16} c="#fff" /></span>
              <div><b>Notat</b><span>{item.note}</span></div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, padding: '10px 16px calc(16px + env(safe-area-inset-bottom,0px))', borderTop: '1px solid var(--border)' }}>
            <button className="m-btn m-btn-ghost" style={{ flex: '0 0 auto' }} onClick={() => toast('Åpner i kalender')}><Ic n="calendar" s={16} /></button>
            {item.status === 'venter' || item.status === 'foresporsel'
              ? <button className="m-btn m-btn-primary m-full" onClick={() => { toast(item.name + ' bekreftet ✓', { undo: () => toast('Angret') }); onClose(); }}><Ic n="check" s={16} /> Bekreft</button>
              : <button className="m-btn m-btn-primary m-full" onClick={() => toast('Klargjøring lagt til oppgaver')}><Ic n="checklist" s={16} /> Klargjør</button>}
          </div>
        </div>
      </div>
    );
  }
  window.MBookingDetail = BookingDetail;

  // ---------------- screen ----------------
  const FILTERS = [['alle', 'Alle'], ['booking', 'Bookinger'], ['event', 'Events']];

  function Bookinger() {
    const { toast, takeIntent } = window.useM();
    const intent = takeIntent ? takeIntent('bookinger') : null;
    const [q, setQ] = useState('');
    const [filter, setFilter] = useState((intent && intent.filter) || 'alle');
    const [detail, setDetail] = useState(null); // { item, isEvent }

    const ql = q.trim().toLowerCase();
    const match = (s) => !ql || s.toLowerCase().includes(ql);
    const bookings = useMemo(() => BOOKINGS.filter(b => match(b.name + ' ' + b.area + ' ' + b.note)), [ql]);
    const events = useMemo(() => EVENTS.filter(e => match(e.name + ' ' + e.area + ' ' + e.kindLbl + ' ' + e.note)), [ql]);

    const show = (k) => filter === 'alle' || filter === k;
    const nothing = !(show('booking') && bookings.length) && !(show('event') && events.length);

    return (
      <div className="m-page">
        <div className="m-hero">
          <h1>Bookings & Event</h1>
          <div className="m-hero-sub"><span>Reservasjoner og arrangementer på Bistro Nord.</span></div>
        </div>

        <div className="m-kt-stats">
          <div className="m-kt-stat"><b className="mono">{BOOKINGS.length}</b><span>Bord i dag</span></div>
          <div className="m-kt-stat"><b className="mono" style={{ color: 'var(--orange)' }}>{todayGuests}</b><span>Gjester i dag</span></div>
          <div className="m-kt-stat"><b className="mono">{EVENTS[0].date}</b><span>Neste event</span></div>
        </div>

        <div className="m-kt-search">
          <Ic n="search" s={18} c="var(--muted)" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Søk i bookinger og events…" />
          {q && <button className="m-kt-clear" onClick={() => setQ('')} aria-label="Tøm"><Ic n="x" s={15} /></button>}
        </div>

        <div className="m-kt-seg">
          {FILTERS.map(([v, l]) => (
            <button key={v} className={cls('m-kt-chip', filter === v && 'on')} onClick={() => setFilter(v)}>{l}</button>
          ))}
        </div>

        {nothing && <div className="m-empty" style={{ marginTop: 8 }}><b>Ingen treff</b><p>Prøv et annet søk eller filter.</p></div>}

        {/* BOOKINGER — i dag */}
        {show('booking') && bookings.length > 0 && (
          <div>
            <div className="m-sec-h"><h2>Bookinger i dag</h2><span className="m-sec-count">{bookings.length}</span></div>
            <div className="m-card m-flush" style={{ marginTop: 10 }}>
              {bookings.map(b => {
                const [sc, sl] = ST[b.status];
                return (
                  <button key={b.id} className="m-kt-row" onClick={() => setDetail({ item: b, isEvent: false })}>
                    <span className="m-bk-time mono">{b.time}</span>
                    <div className="m-kt-body">
                      <div className="m-kt-title" style={{ marginTop: 0 }}>{b.name}</div>
                      <div className="m-kt-sub"><Ic n="users" s={12} style={{ verticalAlign: -2 }} /> {b.guests} · {b.area}</div>
                    </div>
                    <span className={cls('m-pill', sc)} style={{ height: 19, fontSize: 10, flex: '0 0 auto' }}>{sl}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* EVENTS & SELSKAPER */}
        {show('event') && events.length > 0 && (
          <div>
            <div className="m-sec-h"><h2>Events & selskaper</h2><span className="m-sec-count">{events.length}</span></div>
            <div className="m-card m-flush" style={{ marginTop: 10 }}>
              {events.map(e => {
                const [sc, sl] = ST[e.status];
                return (
                  <button key={e.id} className="m-kt-row" onClick={() => setDetail({ item: e, isEvent: true })}>
                    <span className="m-kt-ic" style={{ background: 'var(--orange-soft)', color: 'var(--orange)' }}><Ic n="star" s={17} /></span>
                    <div className="m-kt-body">
                      <div className="m-kt-top"><span className="mono m-kt-id">{e.date}</span></div>
                      <div className="m-kt-title">{e.name}</div>
                      <div className="m-kt-sub">{e.kindLbl} · <Ic n="users" s={12} style={{ verticalAlign: -2 }} /> {e.guests} · {e.area}</div>
                    </div>
                    <span className={cls('m-pill', sc)} style={{ height: 19, fontSize: 10, flex: '0 0 auto' }}>{sl}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <button className="m-btn m-btn-primary m-btn-block" onClick={() => toast('Ny booking — kommer snart')} style={{ marginTop: 4 }}><Ic n="plus" s={18} /> Ny booking</button>

        {detail && <BookingDetail item={detail.item} isEvent={detail.isEvent} onClose={() => setDetail(null)} />}
      </div>
    );
  }

  window.SO_M_PAGES = Object.assign(window.SO_M_PAGES || {}, { bookinger: Bookinger });
})();
