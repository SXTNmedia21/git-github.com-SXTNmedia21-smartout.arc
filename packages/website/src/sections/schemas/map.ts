import { z } from "zod";

export const mapContentSchema = z.object({
  heading: z.string().default(""),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  zoom: z.number().min(1).max(20).default(15),
  showDirectionsLink: z.boolean().default(true),
});

export type MapContent = z.infer<typeof mapContentSchema>;

export const mapDefaults: MapContent = {
  heading: "",
  zoom: 15,
  showDirectionsLink: true,
};
