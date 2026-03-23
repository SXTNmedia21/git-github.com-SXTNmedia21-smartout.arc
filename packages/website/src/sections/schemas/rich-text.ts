import { z } from "zod";

export const richTextContentSchema = z.object({
  html: z.string().default(""),
});

export type RichTextContent = z.infer<typeof richTextContentSchema>;

export const richTextDefaults: RichTextContent = {
  html: "",
};
