import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Oppgaver & Rutiner — SmartOut",
  description: "Digitale oppgavelister og rutiner.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
