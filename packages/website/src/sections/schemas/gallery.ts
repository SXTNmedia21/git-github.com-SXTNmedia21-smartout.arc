import { z } from "zod";

const galleryImageSchema = z.object({
  assetId: z.string().uuid(),
  caption: z.string().default(""),
});

export const galleryContentSchema = z.object({
  heading: z.string().default(""),
  layout: z.enum(["grid", "masonry", "carousel"]).default("grid"),
  columns: z.enum(["2", "3", "4"]).default("3"),
  images: z.array(galleryImageSchema).default([]),
});

export type GalleryContent = z.infer<typeof galleryContentSchema>;

export const galleryDefaults: GalleryContent = {
  heading: "",
  layout: "grid",
  columns: "3",
  images: [],
};
