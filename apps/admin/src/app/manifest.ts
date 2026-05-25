import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Smartout Admin",
    short_name: "Smartout Admin",
    description: "Smartout — admin portal for partner accountants",
    start_url: "/orders",
    display: "standalone",
    background_color: "#fdfaf6",
    theme_color: "#fdfaf6",
    orientation: "portrait",
    scope: "/",
    icons: [
      {
        src: "/icon.png",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon.png",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "any",
      },
    ],
    categories: ["business", "productivity"],
    lang: "nb",
  };
}
