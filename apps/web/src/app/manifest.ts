import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Smartout",
    short_name: "Smartout",
    description: "Smartout — den AI-drevne operativsystemet for service- og hospitality-bransjen.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#fdfaf6",
    theme_color: "#fdfaf6",
    orientation: "portrait",
    scope: "/",
    icons: [
      {
        src: "/smartout-icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/smartout-icon-shadow.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
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
