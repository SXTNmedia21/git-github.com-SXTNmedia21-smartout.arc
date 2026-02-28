import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lokasjoner — SmartOut",
  description: "Kapasitet og datavolum for dine lokasjoner.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
