// Lucide-style icons, inline SVG. Stroke-based, 20px default.
const Ic = ({ name, size = 18, ...props }) => {
  const s = size;
  const common = {
    width: s, height: s,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    ...props,
  };
  const paths = {
    circle: <circle cx="12" cy="12" r="9" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    alertCircle: <><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></>,
    check: <path d="M5 12l5 5L20 7" />,
    checkCircle: <><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></>,
    lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
    alertTriangle: <><path d="M12 3l10 17H2z" /><path d="M12 10v4M12 18h.01" /></>,
    chevronRight: <path d="M9 6l6 6-6 6" />,
    chevronDown: <path d="M6 9l6 6 6-6" />,
    chevronLeft: <path d="M15 6l-6 6 6 6" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
    x: <path d="M6 6l12 12M18 6L6 18" />,
    home: <><path d="M3 12l9-9 9 9" /><path d="M5 10v10h14V10" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></>,
    users: <><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0" /><path d="M16 3.5a4 4 0 0 1 0 7.5" /><path d="M22 21a6 6 0 0 0-4-5.5" /></>,
    graduation: <><path d="M2 9l10-4 10 4-10 4z" /><path d="M6 11v5a6 6 0 0 0 12 0v-5" /></>,
    shield: <path d="M12 3l8 3v6a9 9 0 0 1-8 9 9 9 0 0 1-8-9V6z" />,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
    clipboardCheck: <><rect x="8" y="3" width="8" height="4" rx="1" /><path d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><path d="M9 14l2 2 4-4" /></>,
    tag: <><path d="M20.6 12.6L12 21l-9-9V3h9z" /><circle cx="7.5" cy="7.5" r="1" /></>,
    arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
    filter: <path d="M3 5h18l-7 9v6l-4-2v-4z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    messageSquare: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
    sliders: <><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h14M18 18h2" /><circle cx="16" cy="6" r="2" /><circle cx="8" cy="12" r="2" /><circle cx="16" cy="18" r="2" /></>,
    moreHorizontal: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    phoneForwarded: <><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2z" /><path d="M16 5l3 3-3 3M14 8h5" /></>,
    zap: <path d="M13 2L3 14h8l-1 8 10-12h-8z" />,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
    receipt: <><path d="M4 2l1 2 1-2 1 2 1-2 1 2 1-2 1 2 1-2 1 2 1-2v20l-1-2-1 2-1-2-1 2-1-2-1 2-1-2-1 2-1-2-1 2z" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    trendingUp: <><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M10 21a2 2 0 0 0 4 0" /></>,
    inbox: <><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.5 5.5L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.5A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.5z" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z" /></>,
    fileText: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h6M8 9h2" /></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
};

window.Ic = Ic;
