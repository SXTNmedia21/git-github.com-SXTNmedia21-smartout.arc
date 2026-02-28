import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Timeføring — SmartOut",
  description: "Stemplingsur og timeregistrering.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
