import type { WebsiteTemplate } from "./registry";

export const restaurantClassic: WebsiteTemplate = {
  key: "restaurant-classic",
  version: 1,
  name: "Restaurant Classic",
  description: "Traditional restaurant layout with hero, menu, and reservations",
  industry: "restaurant",
  tier: "basic",
  category: "Restaurant",
  defaultPages: [
    {
      type: "home",
      slug: "",
      title: "Home",
      sections: ["hero", "feature_grid", "testimonials", "cta"],
    },
    {
      type: "menu",
      slug: "menu",
      title: "Menu",
      sections: ["menu_full"],
    },
    {
      type: "about",
      slug: "about",
      title: "About",
      sections: ["text_image", "gallery"],
    },
    {
      type: "contact",
      slug: "contact",
      title: "Contact",
      sections: ["hours", "map", "contact"],
    },
  ],
  defaultTheme: {
    colors: {
      primary: "#1a1a2e",
      secondary: "#16213e",
      accent: "#e94560",
      background: "#ffffff",
      foreground: "#1a1a2e",
      muted: "#f5f5f5",
      mutedForeground: "#6b7280",
    },
    typography: {
      headingFont: "Playfair Display",
      bodyFont: "Inter",
      baseFontSize: 16,
    },
    borderRadius: "md",
    spacing: "default",
    shadow: "sm",
    buttonVariant: "solid",
  },
};
