import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Smartout",
    short_name: "Smartout",
    description: "AI-drevet workforce management for den norske serveringsbransjen.",
    start_url: "/",
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
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
    categories: ["business", "productivity"],
    lang: "nb",
  };
}
