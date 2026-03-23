import { z } from "zod";

const faqItemSchema = z.object({
  question: z.string().default(""),
  answer: z.string().default(""),
});

export const faqContentSchema = z.object({
  heading: z.string().default("FAQ"),
  items: z.array(faqItemSchema).default([]),
});

export type FaqContent = z.infer<typeof faqContentSchema>;

export const faqDefaults: FaqContent = {
  heading: "FAQ",
  items: [],
};
