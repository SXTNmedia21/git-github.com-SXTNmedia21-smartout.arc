import { z } from "zod";

const featureItemSchema = z.object({
  icon: z.string().default(""),
  title: z.string().default(""),
  description: z.string().default(""),
});

export const featureGridContentSchema = z.object({
  heading: z.string().default(""),
  subheading: z.string().default(""),
  columns: z.enum(["2", "3", "4"]).default("3"),
  items: z.array(featureItemSchema).default([]),
});

export type FeatureGridContent = z.infer<typeof featureGridContentSchema>;

export const featureGridDefaults: FeatureGridContent = {
  heading: "",
  subheading: "",
  columns: "3",
  items: [],
};
