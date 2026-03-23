import { z } from "zod";

export const heroContentSchema = z.object({
  heading: z.string().min(1),
  subheading: z.string().default(""),
  buttonText: z.string().default(""),
  buttonUrl: z.string().default(""),
  imageAssetId: z.string().uuid().optional(),
  imagePosition: z.enum(["right", "below"]).default("right"),
  alignment: z.enum(["left", "center"]).default("center"),
});

export type HeroContent = z.infer<typeof heroContentSchema>;

export const heroDefaults: HeroContent = {
  heading: "Welcome",
  subheading: "",
  buttonText: "",
  buttonUrl: "",
  imagePosition: "right",
  alignment: "center",
};
