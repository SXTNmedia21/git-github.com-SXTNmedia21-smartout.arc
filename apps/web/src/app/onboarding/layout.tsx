import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kom i gang | Smartout",
  description: "Sett opp arbeidsplassen din på under fem minutter.",
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-dvh w-full overflow-hidden bg-[oklch(0.10_0.01_250)]">{children}</div>;
}
