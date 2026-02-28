import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Priser — SmartOut",
  description: "Enkle og forutsigbare priser. Full kontroll til en fast pris.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
