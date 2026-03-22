import type { WebsiteTemplate } from "./registry";

export const cafeModern: WebsiteTemplate = {
  key: "cafe-modern",
  version: 1,
  name: "Cafe Modern",
  description: "Clean, modern layout for cafes and bars",
  industry: "cafe",
  defaultPages: [
    {
      type: "home",
      slug: "",
      title: "Home",
      sections: ["hero", "text_image", "menu_preview", "booking_cta"],
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
      title: "About Us",
      sections: ["text_image", "gallery", "testimonials"],
    },
    {
      type: "contact",
      slug: "contact",
      title: "Find Us",
      sections: ["map", "hours", "contact"],
    },
  ],
  defaultTheme: {
    colors: {
      primary: "#2d2d2d",
      secondary: "#f7f3e9",
      accent: "#c8956c",
      background: "#fefefe",
      foreground: "#2d2d2d",
      muted: "#f7f3e9",
      mutedForeground: "#8b8680",
    },
    typography: {
      headingFont: "DM Serif Display",
      bodyFont: "DM Sans",
      baseFontSize: 16,
    },
    borderRadius: "lg",
    spacing: "relaxed",
    shadow: "none",
    buttonVariant: "outline",
  },
};
