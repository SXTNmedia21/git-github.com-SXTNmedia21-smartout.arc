import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kommunikasjon — SmartOut",
  description: "Sømløs kommunikasjon for ditt team.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
