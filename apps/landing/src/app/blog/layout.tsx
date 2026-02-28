import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kundehistorier — SmartOut",
  description: "Les om hvordan Norges beste restauranter bruker SmartOut.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
