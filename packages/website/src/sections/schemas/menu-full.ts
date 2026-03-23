import { z } from "zod";

export const menuFullContentSchema = z.object({
  heading: z.string().default("Menu"),
  menuIds: z.array(z.string().uuid()).default([]),
  showPrices: z.boolean().default(true),
  showDescriptions: z.boolean().default(true),
  showAllergens: z.boolean().default(true),
  showDietaryTags: z.boolean().default(true),
  showImages: z.boolean().default(false),
  layout: z.enum(["list", "cards"]).default("list"),
});

export type MenuFullContent = z.infer<typeof menuFullContentSchema>;

export const menuFullDefaults: MenuFullContent = {
  heading: "Menu",
  menuIds: [],
  showPrices: true,
  showDescriptions: true,
  showAllergens: true,
  showDietaryTags: true,
  showImages: false,
  layout: "list",
};
