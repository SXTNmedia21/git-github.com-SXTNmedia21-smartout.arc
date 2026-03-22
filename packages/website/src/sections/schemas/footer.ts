import { z } from "zod";

export const footerContentSchema = z.object({
  showLogo: z.boolean().default(true),
  showSocial: z.boolean().default(true),
  showContact: z.boolean().default(true),
  showHours: z.boolean().default(false),
  copyrightText: z.string().default(""),
  columns: z.enum(["1", "2", "3", "4"]).default("3"),
});

export type FooterContent = z.infer<typeof footerContentSchema>;

export const footerDefaults: FooterContent = {
  showLogo: true,
  showSocial: true,
  showContact: true,
  showHours: false,
  copyrightText: "",
  columns: "3",
};
