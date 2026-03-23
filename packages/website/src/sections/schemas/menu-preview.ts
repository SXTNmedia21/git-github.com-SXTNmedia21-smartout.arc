import { z } from "zod";

export const menuPreviewContentSchema = z.object({
  heading: z.string().default("Our Menu"),
  body: z.string().default(""),
  menuIds: z.array(z.string().uuid()).default([]),
  maxItemsPerMenu: z.number().min(1).max(20).default(6),
  showPrices: z.boolean().default(true),
  linkToFullMenu: z.boolean().default(true),
  linkText: z.string().default("View Full Menu"),
});

export type MenuPreviewContent = z.infer<typeof menuPreviewContentSchema>;

export const menuPreviewDefaults: MenuPreviewContent = {
  heading: "Our Menu",
  body: "",
  menuIds: [],
  maxItemsPerMenu: 6,
  showPrices: true,
  linkToFullMenu: true,
  linkText: "View Full Menu",
};
