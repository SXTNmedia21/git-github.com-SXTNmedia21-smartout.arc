import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Den Daglige Økten — SmartOut",
  description: "Slik fungerer en typisk dag med SmartOut.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
