// packages/design-tokens/src/tokens.ts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SINGLE SOURCE OF TRUTH — Change a value here,
// every app (web, landing, mobile) updates automatically.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ─── Brand Colors ──────────────────────────────────────
export const brand = {
  orange: "oklch(0.65 0.22 40)",
  orangeLight: "oklch(0.75 0.18 40)",
  orangeDark: "oklch(0.55 0.22 40)",
  purple: "oklch(0.55 0.25 300)", // Secondary accent for feature sections
  purpleLight: "oklch(0.65 0.20 300)",
  purpleDark: "oklch(0.45 0.25 300)",
} as const;

// ─── Semantic Colors ───────────────────────────────────
export const semantic = {
  success: "oklch(0.65 0.2 145)",
  successForeground: "oklch(0.98 0 0)",
  warning: "oklch(0.75 0.18 85)",
  warningForeground: "oklch(0.15 0 0)",
  error: "oklch(0.577 0.245 27.325)",
  errorForeground: "oklch(0.98 0 0)",
  info: "oklch(0.6 0.15 250)",
  infoForeground: "oklch(0.98 0 0)",
} as const;

// ─── Surface Colors (Light Mode) ──────────────────────
export const light = {
  background: "oklch(1 0 0)",
  foreground: "oklch(0.145 0 0)",
  card: "oklch(1 0 0)",
  cardForeground: "oklch(0.145 0 0)",
  popover: "oklch(1 0 0)",
  popoverForeground: "oklch(0.145 0 0)",
  primary: "oklch(0.205 0 0)",
  primaryForeground: "oklch(0.985 0 0)",
  secondary: "oklch(0.97 0 0)",
  secondaryForeground: "oklch(0.205 0 0)",
  muted: "oklch(0.97 0 0)",
  mutedForeground: "oklch(0.556 0 0)",
  accent: "oklch(0.97 0 0)",
  accentForeground: "oklch(0.205 0 0)",
  destructive: "oklch(0.577 0.245 27.325)",
  border: "oklch(0.922 0 0)",
  input: "oklch(0.922 0 0)",
  ring: "oklch(0.708 0 0)",
  // Sidebar
  sidebar: "oklch(0.985 0 0)",
  sidebarForeground: "oklch(0.145 0 0)",
  sidebarPrimary: "oklch(0.205 0 0)",
  sidebarPrimaryForeground: "oklch(0.985 0 0)",
  sidebarAccent: "oklch(0.97 0 0)",
  sidebarAccentForeground: "oklch(0.205 0 0)",
  sidebarBorder: "oklch(0.922 0 0)",
  sidebarRing: "oklch(0.708 0 0)",
  // Charts
  chart1: "oklch(0.646 0.222 41.116)",
  chart2: "oklch(0.6 0.118 184.704)",
  chart3: "oklch(0.398 0.07 227.392)",
  chart4: "oklch(0.828 0.189 84.429)",
  chart5: "oklch(0.769 0.188 70.08)",
} as const;

// ─── Surface Colors (Dark Mode) ───────────────────────
export const dark = {
  background: "oklch(0.145 0 0)",
  foreground: "oklch(0.985 0 0)",
  card: "oklch(0.205 0 0)",
  cardForeground: "oklch(0.985 0 0)",
  popover: "oklch(0.205 0 0)",
  popoverForeground: "oklch(0.985 0 0)",
  primary: "oklch(0.922 0 0)",
  primaryForeground: "oklch(0.205 0 0)",
  secondary: "oklch(0.269 0 0)",
  secondaryForeground: "oklch(0.985 0 0)",
  muted: "oklch(0.269 0 0)",
  mutedForeground: "oklch(0.708 0 0)",
  accent: "oklch(0.269 0 0)",
  accentForeground: "oklch(0.985 0 0)",
  destructive: "oklch(0.704 0.191 22.216)",
  border: "oklch(1 0 0 / 10%)",
  input: "oklch(1 0 0 / 15%)",
  ring: "oklch(0.556 0 0)",
  // Sidebar
  sidebar: "oklch(0.205 0 0)",
  sidebarForeground: "oklch(0.985 0 0)",
  sidebarPrimary: "oklch(0.488 0.243 264.376)",
  sidebarPrimaryForeground: "oklch(0.985 0 0)",
  sidebarAccent: "oklch(0.269 0 0)",
  sidebarAccentForeground: "oklch(0.985 0 0)",
  sidebarBorder: "oklch(1 0 0 / 10%)",
  sidebarRing: "oklch(0.556 0 0)",
  // Charts
  chart1: "oklch(0.488 0.243 264.376)",
  chart2: "oklch(0.696 0.17 162.48)",
  chart3: "oklch(0.769 0.188 70.08)",
  chart4: "oklch(0.627 0.265 303.9)",
  chart5: "oklch(0.645 0.246 16.439)",
} as const;

// ─── Domain Colors (Smartout-specific) ─────────────────
export const department = {
  kitchen: "oklch(0.65 0.2 40)",
  floor: "oklch(0.65 0.15 180)",
  bar: "oklch(0.55 0.2 300)",
  event: "oklch(0.65 0.18 85)",
  storage: "oklch(0.55 0.1 200)",
} as const;

export const status = {
  trainee: "oklch(0.6 0.15 250)",
  active: "oklch(0.65 0.2 145)",
  inactive: "oklch(0.55 0 0)",
  offboarding: "oklch(0.65 0.18 85)",
} as const;

export const priority = {
  urgent: "oklch(0.577 0.245 27.325)",
  high: "oklch(0.65 0.22 40)",
  normal: "oklch(0.6 0.15 250)",
  low: "oklch(0.55 0 0)",
} as const;

// ─── Spacing ──────────────────────────────────────────
export const spacing = {
  page: "2rem",
  section: "1.5rem",
  card: "1.25rem",
  element: "0.75rem",
  tight: "0.5rem",
} as const;

// ─── Radius ───────────────────────────────────────────
export const radius = {
  base: "0.625rem",
  sm: "calc(0.625rem - 4px)",
  md: "calc(0.625rem - 2px)",
  lg: "0.625rem",
  xl: "calc(0.625rem + 4px)",
  full: "9999px",
} as const;

// ─── Shadows ──────────────────────────────────────────
export const shadows = {
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
  glow: {
    orange: "0 0 15px -3px rgba(249, 115, 22, 0.3)",
    blue: "0 0 15px -3px rgba(59, 130, 246, 0.3)",
  },
} as const;

// -- Wizard Shell Theme Colors -----------------
export const wizard = {
  dark: {
    bg: "oklch(0.12 0.02 50)",
    sidebar: "oklch(0.08 0.01 50)",
    text: "oklch(0.85 0 0)",
    textMuted: "oklch(0.55 0 0)",
    border: "oklch(0.2 0.01 50)",
    stepPending: "oklch(0.35 0 0)",
  },
  warm: {
    bg: "oklch(0.97 0.008 60)",
    sidebar: "oklch(0.94 0.01 60)",
    text: "oklch(0.2 0.02 50)",
    textMuted: "oklch(0.5 0.02 50)",
    border: "oklch(0.88 0.01 60)",
    stepPending: "oklch(0.7 0.01 60)",
  },
} as const;
