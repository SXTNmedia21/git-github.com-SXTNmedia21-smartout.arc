import { z } from "zod";

export const ctaContentSchema = z.object({
  heading: z.string().default(""),
  body: z.string().default(""),
  buttonText: z.string().default(""),
  buttonUrl: z.string().default(""),
  secondaryButtonText: z.string().default(""),
  secondaryButtonUrl: z.string().default(""),
});

export type CtaContent = z.infer<typeof ctaContentSchema>;

export const ctaDefaults: CtaContent = {
  heading: "",
  body: "",
  buttonText: "",
  buttonUrl: "",
  secondaryButtonText: "",
  secondaryButtonUrl: "",
};
