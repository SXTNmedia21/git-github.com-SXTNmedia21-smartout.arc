import type { CSSProperties, ReactNode } from "react";
import type { VariantTheme } from "../../lib/block-schemas";

type ThemeProviderProps = {
  theme: VariantTheme;
  children: ReactNode;
};

export function ThemeProvider({ theme, children }: ThemeProviderProps) {
  const style = {
    "--accent": theme.accentColor,
    "--accent-foreground": theme.accentForeground,
  } as CSSProperties;

  return (
    <div className="dark-section" style={style}>
      {children}
    </div>
  );
}
