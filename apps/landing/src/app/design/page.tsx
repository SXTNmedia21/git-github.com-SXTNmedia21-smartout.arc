import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nordic Split — Smartout Design System",
  description: "Smartout Design System — 25 sektioner. Light & Dark. Web & Mobile. Interaktiv.",
};

export default function DesignPage() {
  return (
    <iframe
      src="/styleguide.html"
      className="h-screen w-full border-0"
      title="Smartout Style Guide"
    />
  );
}
