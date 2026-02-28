import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vaktlister & Lønnskjøring — SmartOut",
  description: "AI-drevet vaktplanlegging.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
