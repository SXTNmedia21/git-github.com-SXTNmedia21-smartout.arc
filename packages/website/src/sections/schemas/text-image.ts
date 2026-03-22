import { z } from "zod";

export const textImageContentSchema = z.object({
  heading: z.string().default(""),
  body: z.string().default(""),
  imageAssetId: z.string().uuid().optional(),
  imageAlt: z.string().default(""),
  imagePosition: z.enum(["left", "right"]).default("right"),
  buttonText: z.string().default(""),
  buttonUrl: z.string().default(""),
});

export type TextImageContent = z.infer<typeof textImageContentSchema>;

export const textImageDefaults: TextImageContent = {
  heading: "",
  body: "",
  imageAlt: "",
  imagePosition: "right",
  buttonText: "",
  buttonUrl: "",
};
