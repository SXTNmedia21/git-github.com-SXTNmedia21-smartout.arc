import { z } from "zod";

export const contactContentSchema = z.object({
  heading: z.string().default("Contact Us"),
  body: z.string().default(""),
  showEmail: z.boolean().default(true),
  showPhone: z.boolean().default(true),
  showAddress: z.boolean().default(true),
  showSocial: z.boolean().default(true),
});

export type ContactContent = z.infer<typeof contactContentSchema>;

export const contactDefaults: ContactContent = {
  heading: "Contact Us",
  body: "",
  showEmail: true,
  showPhone: true,
  showAddress: true,
  showSocial: true,
};
