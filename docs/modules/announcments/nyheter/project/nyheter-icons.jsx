// Lucide-ish stroke icons inlined as React components.
// All 24×24 by default, stroke=currentColor, strokeWidth=1.8.

const _I = (paths, viewBox = "0 0 24 24") => (props) => {
  const { size = 18, strokeWidth = 1.8, style, ...rest } = props || {};
  return (
    <svg
      viewBox={viewBox}
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      {...rest}
    >
      {paths}
    </svg>
  );
};

const IconHome = _I(<><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></>);
const IconCalendar = _I(<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></>);
const IconUsers = _I(<><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16.5 11.5a2.8 2.8 0 1 0 0-5.6"/><path d="M21 20c0-2.3-1.6-4.3-3.8-4.9"/></>);
const IconBook = _I(<><path d="M4 4h11a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4V4z"/><path d="M4 16a4 4 0 0 1 4-4h11"/></>);
const IconShield = _I(<><path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/></>);
const IconSettings = _I(<><circle cx="12" cy="12" r="2.8"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/></>);
const IconMsg = _I(<><path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.3A8 8 0 1 1 21 12z"/></>);
const IconMegaphone = _I(<><path d="M3 11v2a2 2 0 0 0 2 2h2l8 5V4l-8 5H5a2 2 0 0 0-2 2z"/><path d="M18 8a4 4 0 0 1 0 8"/></>);
const IconPin = _I(<><path d="M12 2l3 5 5 1.2-3.5 3.6.9 5.2L12 14.8 6.6 17l.9-5.2L4 8.2 9 7l3-5z" /></>);
const IconPinSolid = (props) => {
  const { size = 18, style, ...rest } = props || {};
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={style} {...rest}>
      <path d="M12 2.2l2.9 4.85L20.3 8.2l-3.6 3.5.95 5.2L12 14.5 6.35 16.9l.95-5.2L3.7 8.2l5.4-1.15L12 2.2z" fill="currentColor"/>
    </svg>
  );
};
const IconPinOff = _I(<><path d="M3 3l18 18"/><path d="M12 4l3 5 5 1.2-3.5 3.6.9 5.2L12 16.6 6.6 19l.9-5.2"/></>);
const IconMore = _I(<><circle cx="12" cy="5.5" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="18.5" r="1.6" fill="currentColor" stroke="none"/></>);
const IconX = _I(<><path d="M6 6l12 12M18 6L6 18"/></>);
const IconChevron = _I(<><path d="M9 6l6 6-6 6"/></>);
const IconCheck = _I(<><path d="M5 12l5 5L20 7"/></>);
const IconSearch = _I(<><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></>);
const IconGlobe = _I(<><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></>);
const IconClock = _I(<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>);
const IconBuilding = _I(<><rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/></>);
const IconBadge = _I(<><path d="M12 2l2 4 4 .6-3 2.9.7 4.1L12 11.6 8.3 13.6 9 9.5 6 6.6 10 6z"/><path d="M9 14v8l3-2 3 2v-8"/></>);
const IconUser = _I(<><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></>);
const IconBell = _I(<><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 19a2 2 0 0 0 4 0"/></>);
const IconSparkles = _I(<><path d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/></>);
const IconSend = _I(<><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></>);
const IconArrowLeft = _I(<><path d="M19 12H5M12 19l-7-7 7-7"/></>);

Object.assign(window, {
  IconHome, IconCalendar, IconUsers, IconBook, IconShield, IconSettings,
  IconMsg, IconMegaphone, IconPin, IconPinSolid, IconPinOff, IconMore, IconX,
  IconChevron, IconCheck, IconSearch, IconGlobe, IconClock, IconBuilding,
  IconBadge, IconUser, IconBell, IconSparkles, IconSend, IconArrowLeft,
});
