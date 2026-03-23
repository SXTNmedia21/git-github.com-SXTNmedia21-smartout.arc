/** Presentation tokens only. Nothing else goes here. */
export type WebsiteTheme = {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    foreground: string;
    muted: string;
    mutedForeground: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    baseFontSize: number;
  };
  borderRadius: "none" | "sm" | "md" | "lg" | "full";
  spacing: "compact" | "default" | "relaxed";
  shadow: "none" | "sm" | "md" | "lg";
  buttonVariant: "solid" | "outline" | "ghost";
};
