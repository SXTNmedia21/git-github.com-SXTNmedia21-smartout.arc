// packages/design-tokens/src/native.ts
// React Native theme — hex conversions of Nordic Split OKLCH tokens.
// Update these when tokens.ts changes.

export const nativeTheme = {
  light: {
    background: "#fdfcfa", // oklch(0.99 0.004 60) — warm cream
    foreground: "#1c1814", // oklch(0.145 0.01 50) — warm black
    card: "#fdfcfa",
    cardForeground: "#1c1814",
    primary: "#2a241e", // oklch(0.205 0.01 50)
    primaryForeground: "#fafafa",
    secondary: "#f5f3f0", // oklch(0.965 0.005 58)
    secondaryForeground: "#2a241e",
    muted: "#f5f3f0",
    mutedForeground: "#7a756e", // oklch(0.52 0.01 52)
    border: "#e8e5e1", // oklch(0.91 0.006 55)
    destructive: "#e7000b",
    success: "#11ad32",
    warning: "#c18200",
    info: "#2784d5",
    brandOrange: "#f97316",
    brandPurple: "#8b5cf6",
    brandCyan: "#06b6d4",
  },
  dark: {
    background: "#151210", // oklch(0.12 0.015 50) — warm dark
    foreground: "#f0eeeb", // oklch(0.95 0.005 55)
    card: "#1e1a15", // oklch(0.16 0.02 50)
    cardForeground: "#f0eeeb",
    primary: "#e5e5e5",
    primaryForeground: "#2a241e",
    secondary: "#262626",
    secondaryForeground: "#f0eeeb",
    muted: "#262626",
    mutedForeground: "#908a82", // oklch(0.6 0.01 52)
    border: "rgba(255,255,255,0.08)",
    destructive: "#ff6467",
    success: "#11ad32",
    warning: "#c18200",
    info: "#2784d5",
    brandOrange: "#f97316",
    brandPurple: "#a78bfa",
    brandCyan: "#22d3ee",
  },
  panel: {
    surface: "#1a1510", // oklch(0.18 0.03 50)
    deep: "#0d0a06", // oklch(0.06 0.015 50)
    glowWarm: "#7a3e14", // oklch(0.45 0.18 40)
    glowDeep: "#5c2a10", // oklch(0.35 0.14 35)
  },
  department: {
    kitchen: "#ee560c",
    floor: "#00ab93",
    bar: "#864ad2",
    event: "#c18200",
    storage: "#008388",
  },
  status: {
    trainee: "#2784d5",
    active: "#11ad32",
    inactive: "#717171",
    offboarding: "#c18200",
  },
  radius: { sm: 6, md: 8, lg: 10, xl: 14, full: 9999 },
  spacing: { page: 32, section: 24, card: 20, element: 12, tight: 8 },
} as const;
