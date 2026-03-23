import { z } from "zod";

export const sectionSettingsSchema = z.object({
  spacing: z.enum(["none", "sm", "md", "lg", "xl"]).default("md"),
  backgroundVariant: z.enum(["default", "muted", "accent", "dark", "image"]).default("default"),
  containerWidth: z.enum(["narrow", "default", "wide", "full"]).default("default"),
  alignment: z.enum(["left", "center", "right"]).default("center"),
  themeSurface: z.enum(["primary", "secondary", "inverse"]).default("primary"),
});

export type SectionSettingsFromSchema = z.infer<typeof sectionSettingsSchema>;

export const defaultSectionSettings: SectionSettingsFromSchema = {
  spacing: "md",
  backgroundVariant: "default",
  containerWidth: "default",
  alignment: "center",
  themeSurface: "primary",
};
