import type { Metadata } from "next";
import { DocsSidebar } from "./_components/docs-sidebar";
import { getUserManualNavigation } from "@/lib/user-manual";
import { FullTracker } from "../../components/tracking";

export const metadata: Metadata = {
  title: "Dokumentasjon – SmartOut",
  description:
    "Brukerveiledning og dokumentasjon for SmartOut. Lær hvordan du setter opp og bruker plattformen.",
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const navigation = getUserManualNavigation();

  return (
    <div className="bg-background text-foreground flex min-h-screen font-sans">
      <FullTracker />
      <DocsSidebar navigation={navigation} />

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-3xl px-6 py-12 lg:px-12 lg:py-16">{children}</div>
      </main>
    </div>
  );
}
