import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Prosedyrer — SmartOut",
  description: "Standardiserte prosedyrer for konsistent drift.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
