/* global React */
// Shared shell — sidebar + page chrome used by all three artboards.

const { useState } = React;

// Lucide-style icons (inline SVG, stroke 1.5)
const Icon = ({ d, size = 16, fill = "none" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    {typeof d === "string" ? <path d={d} /> : d}
  </svg>
);

const Icons = {
  Home: <Icon d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z" />,
  Calendar: <Icon d={<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></>} />,
  Store: <Icon d={<><path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v11h16V9"/><path d="M9 20v-5h6v5"/></>} />,
  Users: <Icon d={<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>} />,
  ArrowsLR: <Icon d={<><path d="M7 7l-4 4 4 4"/><path d="M17 17l4-4-4-4"/><path d="M3 11h18"/></>} />,
  Settings: <Icon d={<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>} />,
  Book: <Icon d={<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></>} />,
  Plus: <Icon d="M12 5v14M5 12h14" />,
  More: <Icon d={<><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/><circle cx="5" cy="12" r="1.2" fill="currentColor"/></>} />,
  X: <Icon d="M18 6 6 18M6 6l12 12" />,
  Check: <Icon d="m4 12 5 5L20 6" />,
  Chevron: <Icon d="m6 9 6 6 6-6" />,
  ChevronRight: <Icon d="m9 6 6 6-6 6" />,
  Search: <Icon d={<><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>} />,
  Bell: <Icon d={<><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></>} />,
  Filter: <Icon d="M3 5h18l-7 9v6l-4-2v-4z" />,
  Clock: <Icon d={<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>} />,
  MapPin: <Icon d={<><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></>} />,
  Sparkle: <Icon d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />,
  AlertTri: <Icon d={<><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></>} />,
  Refresh: <Icon d={<><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M8 16H3v5"/></>} />,
  Link: <Icon d={<><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 1 0-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"/></>} />,
  Unlink: <Icon d={<><path d="m18 6-12 12"/><path d="M10 13a5 5 0 0 0 7.07 0l1-1"/><path d="M14 11a5 5 0 0 0-7.07 0l-1 1"/></>} />,
  Eye: <Icon d={<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></>} />,
  Doc: <Icon d={<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h6"/></>} />,
  Folder: <Icon d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  Globe: <Icon d={<><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></>} />,
  Building: <Icon d={<><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/></>} />,
};

function Avatar({ name, size = 28, color }) {
  const initials = name.split(" ").map(p => p[0]).slice(0, 2).join("");
  const bg = color || `oklch(0.92 0.04 ${(name.charCodeAt(0) * 13) % 360})`;
  return (
    <span className="avatar" style={{ width: size, height: size, background: bg, fontSize: size * 0.4 }}>
      {initials}
    </span>
  );
}

function Sidebar({ active }) {
  const items = [
    { id: "home", label: "Hjem", icon: Icons.Home, href: "#" },
    { id: "schedule", label: "Plan", icon: Icons.Calendar, href: "#", count: 3 },
    { id: "marketplace", label: "Vaktbørs", icon: Icons.ArrowsLR, href: "#" },
    { id: "people", label: "Ansatte", icon: Icons.Users, href: "#" },
    { id: "pos", label: "POS", icon: Icons.Store, href: "#" },
    { id: "docs", label: "Veiledning", icon: Icons.Book, href: "#" },
  ];
  return (
    <aside style={{
      width: 232, height: "100%", padding: "20px 14px",
      borderRight: "1px solid var(--border)",
      background: "var(--background-soft)",
      display: "flex", flexDirection: "column", gap: 4,
      position: "relative", zIndex: 2,
    }}>
      {/* Workspace switcher */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 10px 14px", marginBottom: 6,
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: "var(--foreground)", color: "var(--background)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-heading)", fontSize: 17,
        }}>S</div>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1, flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Strøm Mat &amp; Bar</div>
          <div style={{ fontSize: 11, color: "var(--foreground-faint)" }}>Workspace</div>
        </div>
        <Icon d="m6 9 6 6 6-6" size={14} />
      </div>

      <div style={{ fontSize: 10.5, color: "var(--foreground-faint)", textTransform: "uppercase", letterSpacing: "0.1em", padding: "10px 10px 6px" }}>
        Drift
      </div>
      {items.map((it) => (
        <a key={it.id} href={it.href} style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 10px", borderRadius: 8,
          color: active === it.id ? "var(--foreground)" : "var(--foreground-soft)",
          background: active === it.id ? "var(--card)" : "transparent",
          border: active === it.id ? "1px solid var(--border)" : "1px solid transparent",
          fontSize: 13.5, fontWeight: active === it.id ? 500 : 400,
          textDecoration: "none",
        }}>
          {it.icon}
          <span style={{ flex: 1 }}>{it.label}</span>
          {it.count != null && (
            <span style={{
              fontSize: 11, color: "var(--foreground-faint)",
              background: "var(--muted)", padding: "1px 7px", borderRadius: 999,
            }}>{it.count}</span>
          )}
        </a>
      ))}

      <div style={{ flex: 1 }}></div>

      <div style={{
        padding: 12,
        borderRadius: 12,
        background: "var(--card)",
        border: "1px solid var(--border)",
        marginBottom: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ width: 22, height: 22, borderRadius: 999, background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary-fg)" }}>
            <Icon d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" size={11} />
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 500 }}>Botsson</div>
          <span className="pill pill-success" style={{ marginLeft: "auto", height: 18, fontSize: 10.5 }}><span className="dot"></span>aktiv</span>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--foreground-faint)", lineHeight: 1.45 }}>
          Spør, planlegg, bekreft mutasjoner i chat.
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px" }}>
        <Avatar name="Ida Holm" size={28} color="oklch(0.85 0.08 50)" />
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15, flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 500 }}>Ida Holm</div>
          <div style={{ fontSize: 11, color: "var(--foreground-faint)" }}>Manager · Bar</div>
        </div>
        <button className="btn-ghost" style={{ width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {Icons.Settings}
        </button>
      </div>
    </aside>
  );
}

function Topbar({ crumbs, right }) {
  return (
    <header style={{
      display: "flex", alignItems: "center",
      padding: "14px 28px",
      borderBottom: "1px solid var(--border)",
      background: "color-mix(in oklch, var(--background) 80%, transparent)",
      backdropFilter: "blur(20px)",
      position: "sticky", top: 0, zIndex: 5,
      gap: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--foreground-faint)" }}>
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <Icon d="m9 6 6 6-6 6" size={12} />}
            <span style={{ color: i === crumbs.length - 1 ? "var(--foreground)" : "var(--foreground-faint)" }}>{c}</span>
          </React.Fragment>
        ))}
      </div>
      <div style={{ flex: 1 }}></div>
      <div style={{
        display: "flex", alignItems: "center", gap: 6, height: 32,
        padding: "0 10px", border: "1px solid var(--border)", borderRadius: 8,
        background: "var(--card)", color: "var(--foreground-faint)", width: 240,
        fontSize: 13,
      }}>
        {Icons.Search}
        <span>Søk eller spør Botsson…</span>
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 11, padding: "1px 5px", border: "1px solid var(--border)", borderRadius: 4 }}>⌘K</span>
      </div>
      <button className="btn btn-ghost" style={{ width: 36, height: 36, padding: 0, justifyContent: "center", borderRadius: 8 }}>
        {Icons.Bell}
      </button>
      {right}
    </header>
  );
}

Object.assign(window, { Icon, Icons, Avatar, Sidebar, Topbar });
