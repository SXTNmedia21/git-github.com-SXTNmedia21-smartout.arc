import type { WebsiteTheme } from "@smartout/website";

const SPACING_MAP = {
  compact: "0.75rem",
  default: "1rem",
  relaxed: "1.5rem",
} as const;

const RADIUS_MAP = {
  none: "0",
  sm: "0.25rem",
  md: "0.5rem",
  lg: "1rem",
  full: "9999px",
} as const;

const SHADOW_MAP = {
  none: "none",
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
} as const;

/**
 * Injects CSS custom properties from the snapshot theme.
 * All section renderers reference these variables for consistent theming.
 */
export function SiteThemeProvider({
  theme,
  children,
}: {
  theme: WebsiteTheme;
  children: React.ReactNode;
}) {
  const cssVars = `
    :root {
      --site-primary: ${theme.colors.primary};
      --site-secondary: ${theme.colors.secondary};
      --site-accent: ${theme.colors.accent};
      --site-background: ${theme.colors.background};
      --site-foreground: ${theme.colors.foreground};
      --site-muted: ${theme.colors.muted};
      --site-muted-foreground: ${theme.colors.mutedForeground};
      --site-font-heading: ${theme.typography.headingFont}, ui-sans-serif, system-ui, sans-serif;
      --site-font-body: ${theme.typography.bodyFont}, ui-sans-serif, system-ui, sans-serif;
      --site-font-size-base: ${theme.typography.baseFontSize}px;
      --site-radius: ${RADIUS_MAP[theme.borderRadius]};
      --site-spacing: ${SPACING_MAP[theme.spacing]};
      --site-shadow: ${SHADOW_MAP[theme.shadow]};
    }
  `;

  return (
    <div
      style={{
        fontFamily: "var(--site-font-body)",
        fontSize: "var(--site-font-size-base)",
        color: "var(--site-foreground)",
        backgroundColor: "var(--site-background)",
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      {children}
    </div>
  );
}
