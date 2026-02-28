import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "IK-Mat & Avvik — SmartOut",
  description: "Digitalt HACCP-system for mattrygghet.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
