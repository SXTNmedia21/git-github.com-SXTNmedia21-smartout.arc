import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Om Oss — SmartOut",
  description: "Drevet av lidenskap for gjestfrihet. Vår historie.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
