import { z } from "zod";

const testimonialSchema = z.object({
  quote: z.string().default(""),
  author: z.string().default(""),
  role: z.string().default(""),
  imageAssetId: z.string().uuid().optional(),
  rating: z.number().min(1).max(5).optional(),
});

export const testimonialsContentSchema = z.object({
  heading: z.string().default(""),
  layout: z.enum(["cards", "carousel", "list"]).default("cards"),
  items: z.array(testimonialSchema).default([]),
});

export type TestimonialsContent = z.infer<typeof testimonialsContentSchema>;

export const testimonialsDefaults: TestimonialsContent = {
  heading: "",
  layout: "cards",
  items: [],
};
