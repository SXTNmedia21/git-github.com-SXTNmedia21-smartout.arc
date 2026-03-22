import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ren og Varm — Smartout Design System",
  description: "Smartout Style Guide — 22 sektioner. Light & Dark. Web & Mobile.",
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
