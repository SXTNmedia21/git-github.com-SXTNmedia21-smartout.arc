import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HR & Opplæring — SmartOut",
  description: "Onboarding og opplæring av ansatte.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
