import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sesonger — SmartOut",
  description: "Sesongbasert drift med SmartOut.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
