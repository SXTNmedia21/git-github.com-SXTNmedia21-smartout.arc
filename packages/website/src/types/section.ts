/** Design tokens for section layout — never arbitrary CSS. */
export type SectionSettings = {
  spacing: "none" | "sm" | "md" | "lg" | "xl";
  backgroundVariant: "default" | "muted" | "accent" | "dark" | "image";
  containerWidth: "narrow" | "default" | "wide" | "full";
  alignment: "left" | "center" | "right";
  themeSurface: "primary" | "secondary" | "inverse";
};
